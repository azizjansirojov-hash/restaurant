-- Fix release-blocking price tampering in create_order.
-- Server must never trust client-supplied unit_price_cents or modifier prices.

CREATE OR REPLACE FUNCTION public.validate_modifiers_and_unit_price(
  p_menu_modifiers jsonb,
  p_modifiers_snapshot jsonb,
  p_base_price_cents integer
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
  v_unit integer := p_base_price_cents;
  v_validated jsonb := '[]'::jsonb;
  v_required_ids text[] := ARRAY[]::text[];
  v_selected_ids text[] := ARRAY[]::text[];
  v_found boolean;
BEGIN
  -- Collect required modifier ids from menu definition
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

        v_unit := v_unit + COALESCE((v_opt->>'priceCents')::integer, 0);
        v_validated := v_validated || jsonb_build_array(jsonb_build_object(
          'modifierId', v_def->>'id',
          'modifierName', v_def->>'name',
          'optionName', v_opt->>'name',
          'priceCents', COALESCE((v_opt->>'priceCents')::integer, 0)
        ));
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_found THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid modifier selection.');
    END IF;
  END LOOP;

  -- Ensure all required modifiers were selected
  IF EXISTS (
    SELECT 1 FROM unnest(v_required_ids) req(id)
    WHERE NOT (req.id = ANY (v_selected_ids))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required modifier missing.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'unit_price_cents', v_unit,
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
  v_unit integer;
  v_validated_mods jsonb;
  v_qty integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF public.current_user_role() != 'guest' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in as a guest to order.');
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings WHERE id = 'default';

  -- Pass 1: compute subtotal from authoritative menu prices + validated modifiers
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
      v_menu.price_cents
    );
    IF NOT (v_line->>'ok')::boolean THEN
      RETURN v_line;
    END IF;

    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity.');
    END IF;

    v_subtotal := v_subtotal + (v_line->>'unit_price_cents')::integer * v_qty;
  END LOOP;

  IF v_subtotal = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your cart is empty.');
  END IF;

  -- Discount (promo looked up server-side; loyalty uses server settings)
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
      COALESCE((p_payload->>'loyalty_blocks')::integer, 0) * v_settings.loyalty_redeem_value_cents
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
    subtotal_cents, tax_cents, tip_cents, discount_cents, total_cents,
    promo_code_id, loyalty_redeemed_points
  ) VALUES (
    v_user_id, 'pending_payment', p_payload->>'fulfillment_type',
    v_subtotal, v_tax, v_tip, v_discount, v_total,
    CASE WHEN (p_payload->>'discount_mode') = 'promo' THEN p_payload->>'promo_code_id' ELSE NULL END,
    CASE WHEN v_points > 0 THEN v_points ELSE NULL END
  ) RETURNING id INTO v_order_id;

  -- Pass 2: persist order_items with server-computed prices only
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id = v_item->>'menu_item_id';

    v_line := public.validate_modifiers_and_unit_price(
      v_menu.modifiers,
      COALESCE(v_item->'modifiers_snapshot', '[]'::jsonb),
      v_menu.price_cents
    );

    INSERT INTO public.order_items (
      order_id, menu_item_id, name_snapshot, unit_price_cents, modifiers_snapshot, quantity
    ) VALUES (
      v_order_id,
      v_item->>'menu_item_id',
      COALESCE(v_item->>'name_snapshot', v_menu.name),
      (v_line->>'unit_price_cents')::integer,
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
    'subtotal_cents', v_subtotal,
    'total_cents', v_total,
    'requires_payment', true
  );
END;
$$;
