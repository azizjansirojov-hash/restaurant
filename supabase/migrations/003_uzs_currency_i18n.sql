-- UZS currency migration: rename *_cents columns to *_som (whole som units, not fractional).
-- Also rename loyalty_earn_per_dollar → loyalty_earn_per_som.

ALTER TABLE public.menu_items RENAME COLUMN price_cents TO price_som;
ALTER TABLE public.order_items RENAME COLUMN unit_price_cents TO unit_price_som;
ALTER TABLE public.orders RENAME COLUMN subtotal_cents TO subtotal_som;
ALTER TABLE public.orders RENAME COLUMN tax_cents TO tax_som;
ALTER TABLE public.orders RENAME COLUMN tip_cents TO tip_som;
ALTER TABLE public.orders RENAME COLUMN discount_cents TO discount_som;
ALTER TABLE public.orders RENAME COLUMN total_cents TO total_som;
ALTER TABLE public.reservations RENAME COLUMN deposit_hold_cents TO deposit_hold_som;
ALTER TABLE public.restaurant_settings RENAME COLUMN loyalty_redeem_value_cents TO loyalty_redeem_value_som;
ALTER TABLE public.restaurant_settings RENAME COLUMN peak_deposit_cents TO peak_deposit_som;
ALTER TABLE public.restaurant_settings RENAME COLUMN loyalty_earn_per_dollar TO loyalty_earn_per_som;

-- Update settings defaults for Uzbekistan (placeholder values — owner must confirm)
UPDATE public.restaurant_settings SET
  address = '[PLACEHOLDER — owner to supply real address]',
  timezone = 'Asia/Tashkent',
  tax_rate_percent = 12,
  tip_presets = ARRAY[0, 5, 10],
  default_tip_percent = 0,
  loyalty_earn_per_som = 1,
  loyalty_redeem_value_som = 50000,
  peak_deposit_som = 200000
WHERE id = 'default';

-- Recreate pricing RPC with som field names and priceSom in modifier JSON
CREATE OR REPLACE FUNCTION public.validate_modifiers_and_unit_price(
  p_menu_modifiers jsonb,
  p_modifiers_snapshot jsonb,
  p_base_price_som integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mod jsonb;
  v_sel jsonb;
  v_def jsonb;
  v_opt jsonb;
  v_unit integer := p_base_price_som;
  v_validated jsonb := '[]'::jsonb;
  v_required_ids text[] := ARRAY[]::text[];
  v_selected_ids text[] := ARRAY[]::text[];
  v_found boolean;
BEGIN
  FOR v_def IN SELECT * FROM jsonb_array_elements(COALESCE(p_menu_modifiers, '[]'::jsonb))
  LOOP
    IF COALESCE((v_def->>'required')::boolean, false) THEN
      v_required_ids := array_append(v_required_ids, v_def->>'id');
    END IF;
  END LOOP;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(COALESCE(p_modifiers_snapshot, '[]'::jsonb))
  LOOP
    v_found := false;
    FOR v_def IN SELECT * FROM jsonb_array_elements(COALESCE(p_menu_modifiers, '[]'::jsonb))
    LOOP
      IF v_def->>'id' = v_sel->>'modifierId' THEN
        v_found := true;
        v_selected_ids := array_append(v_selected_ids, v_def->>'id');

        v_opt := NULL;
        FOR v_mod IN SELECT * FROM jsonb_array_elements(COALESCE(v_def->'options', '[]'::jsonb))
        LOOP
          IF v_mod->>'name' = v_sel->>'optionName' THEN
            v_opt := v_mod;
            EXIT;
          END IF;
        END LOOP;

        IF v_opt IS NULL THEN
          RETURN jsonb_build_object('ok', false, 'error', 'Invalid modifier option.');
        END IF;

        v_unit := v_unit + COALESCE(
          (v_opt->>'priceSom')::integer,
          (v_opt->>'priceCents')::integer,
          0
        );
        v_validated := v_validated || jsonb_build_array(jsonb_build_object(
          'modifierId', v_def->>'id',
          'modifierName', v_def->>'name',
          'optionName', v_opt->>'name',
          'priceSom', COALESCE(
            (v_opt->>'priceSom')::integer,
            (v_opt->>'priceCents')::integer,
            0
          )
        ));
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_found THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid modifier selection.');
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(v_required_ids) req(id)
    WHERE NOT (req.id = ANY (v_selected_ids))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required modifier missing.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'unit_price_som', v_unit,
    'modifiers_snapshot', v_validated
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings record;
  v_order_id uuid;
  v_item jsonb;
  v_menu record;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_tax integer;
  v_tip integer;
  v_total integer;
  v_promo record;
  v_points integer := 0;
  v_line jsonb;
  v_qty integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF public.current_user_role() != 'guest' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in as a guest to order.');
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings WHERE id = 'default';

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    SELECT * INTO v_menu FROM public.menu_items
    WHERE id = v_item->>'menu_item_id' AND is_available = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Menu item unavailable.');
    END IF;

    v_line := public.validate_modifiers_and_unit_price(
      v_menu.modifiers,
      COALESCE(v_item->'modifiers_snapshot', '[]'::jsonb),
      v_menu.price_som
    );
    IF NOT (v_line->>'ok')::boolean THEN
      RETURN v_line;
    END IF;

    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity.');
    END IF;

    v_subtotal := v_subtotal + (v_line->>'unit_price_som')::integer * v_qty;
  END LOOP;

  IF v_subtotal = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your cart is empty.');
  END IF;

  IF (p_payload->>'discount_mode') = 'promo' AND p_payload->>'promo_code_id' IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE id = p_payload->>'promo_code_id' AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid promo.');
    END IF;
    IF v_promo.max_redemptions IS NOT NULL AND v_promo.redemption_count >= v_promo.max_redemptions THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Promo fully redeemed.');
    END IF;
    IF v_promo.type = 'percent' THEN
      v_discount := LEAST(v_subtotal, round(v_subtotal * v_promo.value / 100.0));
    ELSE
      v_discount := LEAST(v_subtotal, v_promo.value);
    END IF;
  ELSIF (p_payload->>'discount_mode') = 'loyalty' THEN
    v_points := COALESCE((p_payload->>'loyalty_blocks')::integer, 0) * v_settings.loyalty_redeem_block;
    IF v_points > (SELECT loyalty_balance FROM public.profiles WHERE id = v_user_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not enough loyalty points.');
    END IF;
    v_discount := LEAST(
      v_subtotal,
      COALESCE((p_payload->>'loyalty_blocks')::integer, 0) * v_settings.loyalty_redeem_value_som
    );
  END IF;

  v_tax := round(GREATEST(0, v_subtotal - v_discount) * v_settings.tax_rate_percent / 100.0);
  v_tip := round(
    GREATEST(0, v_subtotal - v_discount)
    * COALESCE((p_payload->>'tip_percent')::numeric, v_settings.default_tip_percent) / 100.0
  );
  v_total := GREATEST(0, v_subtotal - v_discount) + v_tax + v_tip;

  INSERT INTO public.orders (
    user_id, status, fulfillment_type,
    subtotal_som, tax_som, tip_som, discount_som, total_som,
    promo_code_id, loyalty_redeemed_points
  ) VALUES (
    v_user_id, 'pending_payment', p_payload->>'fulfillment_type',
    v_subtotal, v_tax, v_tip, v_discount, v_total,
    CASE WHEN (p_payload->>'discount_mode') = 'promo' THEN p_payload->>'promo_code_id' ELSE NULL END,
    CASE WHEN v_points > 0 THEN v_points ELSE NULL END
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id = v_item->>'menu_item_id';

    v_line := public.validate_modifiers_and_unit_price(
      v_menu.modifiers,
      COALESCE(v_item->'modifiers_snapshot', '[]'::jsonb),
      v_menu.price_som
    );

    INSERT INTO public.order_items (
      order_id, menu_item_id, name_snapshot, unit_price_som, modifiers_snapshot, quantity
    ) VALUES (
      v_order_id,
      v_item->>'menu_item_id',
      COALESCE(v_item->>'name_snapshot', v_menu.name),
      (v_line->>'unit_price_som')::integer,
      v_line->'modifiers_snapshot',
      (v_item->>'quantity')::integer
    );
  END LOOP;

  IF v_points > 0 THEN
    INSERT INTO public.loyalty_ledger (user_id, order_id, delta_points, reason)
    VALUES (v_user_id, v_order_id, -v_points, 'redeem');
  END IF;

  IF (p_payload->>'discount_mode') = 'promo' AND p_payload->>'promo_code_id' IS NOT NULL THEN
    UPDATE public.promo_codes SET redemption_count = redemption_count + 1
    WHERE id = p_payload->>'promo_code_id';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'subtotal_som', v_subtotal,
    'total_som', v_total,
    'requires_payment', true
  );
END;
$$;
