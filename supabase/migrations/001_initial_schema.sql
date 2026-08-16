-- Lale initial schema: tables, RLS, RPCs, seed data
-- Run via: supabase db push  OR  supabase migration up

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper: current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Profiles (1:1 with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'staff', 'owner')),
  loyalty_balance integer NOT NULL DEFAULT 0 CHECK (loyalty_balance >= 0),
  push_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'Guest'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guest')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Menu
CREATE TABLE public.menu_categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL
);

CREATE TABLE public.menu_items (
  id text PRIMARY KEY,
  category_id text NOT NULL REFERENCES public.menu_categories(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text NOT NULL DEFAULT '',
  allergens jsonb NOT NULL DEFAULT '[]'::jsonb,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  upsell_tags text[] NOT NULL DEFAULT '{}',
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL
);
CREATE INDEX idx_menu_items_category ON public.menu_items(category_id, sort_order);
CREATE INDEX idx_menu_items_available ON public.menu_items(is_available);

-- Promos
CREATE TABLE public.promo_codes (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent', 'fixed')),
  value integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0
);

-- Settings (singleton)
CREATE TABLE public.restaurant_settings (
  id text PRIMARY KEY CHECK (id = 'default'),
  display_name text NOT NULL DEFAULT 'Lale',
  address text NOT NULL DEFAULT '',
  hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone text NOT NULL DEFAULT 'America/New_York',
  pickup_eta_minutes integer NOT NULL DEFAULT 25,
  delivery_enabled boolean NOT NULL DEFAULT false,
  tax_rate_percent numeric NOT NULL DEFAULT 8.875,
  tip_presets integer[] NOT NULL DEFAULT '{15,18,20}',
  default_tip_percent integer NOT NULL DEFAULT 18,
  loyalty_earn_per_dollar integer NOT NULL DEFAULT 1,
  loyalty_redeem_block integer NOT NULL DEFAULT 100,
  loyalty_redeem_value_cents integer NOT NULL DEFAULT 1000,
  peak_deposit_enabled boolean NOT NULL DEFAULT false,
  peak_deposit_cents integer NOT NULL DEFAULT 2500,
  slot_capacity integer NOT NULL DEFAULT 4
);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'preparing', 'ready', 'completed', 'cancelled')),
  fulfillment_type text NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery')),
  subtotal_cents integer NOT NULL,
  tax_cents integer NOT NULL,
  tip_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  promo_code_id text REFERENCES public.promo_codes(id),
  loyalty_redeemed_points integer,
  payment_intent_id text,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_user ON public.orders(user_id, created_at DESC);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id text NOT NULL REFERENCES public.menu_items(id),
  name_snapshot text NOT NULL,
  unit_price_cents integer NOT NULL,
  modifiers_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity integer NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- Reservations
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 8),
  slot_start timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'reminded', 'seated', 'no_show', 'cancelled')),
  deposit_hold_cents integer,
  deposit_stripe_payment_intent_id text,
  deposit_forfeited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_slot ON public.reservations(slot_start);
CREATE INDEX idx_reservations_status_slot ON public.reservations(status, slot_start);
CREATE INDEX idx_reservations_user ON public.reservations(user_id);

-- Loyalty ledger (append-only)
CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  order_id uuid REFERENCES public.orders(id),
  delta_points integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('earn', 'redeem', 'adjust')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_ledger_user ON public.loyalty_ledger(user_id, created_at DESC);

-- Trigger: update loyalty_balance on ledger insert
CREATE OR REPLACE FUNCTION public.apply_loyalty_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET loyalty_balance = GREATEST(0, loyalty_balance + NEW.delta_points)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_loyalty_ledger_balance
  AFTER INSERT ON public.loyalty_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_loyalty_ledger();

-- Peak slot check (Fri-Sat 17:00-21:00 in America/New_York)
CREATE OR REPLACE FUNCTION public.is_peak_slot(p_slot timestamptz)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  local_ts timestamp;
  dow integer;
  hr integer;
BEGIN
  local_ts := p_slot AT TIME ZONE 'America/New_York';
  dow := EXTRACT(DOW FROM local_ts)::integer;
  hr := EXTRACT(HOUR FROM local_ts)::integer;
  RETURN (dow IN (5, 6)) AND (hr >= 17 AND hr < 21);
END;
$$;

-- RPC: create_reservation with slot capacity lock
CREATE OR REPLACE FUNCTION public.create_reservation(p_party_size integer, p_slot_start timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_capacity integer;
  v_taken integer;
  v_id uuid;
  v_needs_deposit boolean;
  v_deposit_cents integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF public.current_user_role() != 'guest' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in as a guest to reserve.');
  END IF;
  IF p_party_size < 1 OR p_party_size > 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party size must be 1–8.');
  END IF;

  SELECT slot_capacity, peak_deposit_enabled, peak_deposit_cents
  INTO v_capacity, v_needs_deposit, v_deposit_cents
  FROM public.restaurant_settings WHERE id = 'default';

  PERFORM pg_advisory_xact_lock(hashtext(p_slot_start::text));

  SELECT count(*) INTO v_taken
  FROM public.reservations
  WHERE slot_start = p_slot_start
    AND status NOT IN ('cancelled', 'no_show');

  IF v_taken >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That slot is full.');
  END IF;

  v_needs_deposit := v_needs_deposit AND public.is_peak_slot(p_slot_start);

  INSERT INTO public.reservations (user_id, party_size, slot_start, deposit_hold_cents)
  VALUES (
    v_user_id,
    p_party_size,
    p_slot_start,
    CASE WHEN v_needs_deposit THEN v_deposit_cents ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reservation_id', v_id,
    'requires_deposit', v_needs_deposit
  );
END;
$$;

-- RPC: bump_order_status (one step at a time)
CREATE OR REPLACE FUNCTION public.bump_order_status(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_status text;
  v_next text;
  v_order record;
  v_points integer;
  v_settings record;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('staff', 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found.');
  END IF;
  IF v_order.status IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order cannot be advanced.');
  END IF;

  v_status := v_order.status;
  v_next := CASE v_status
    WHEN 'received' THEN 'preparing'
    WHEN 'preparing' THEN 'ready'
    WHEN 'ready' THEN 'completed'
    ELSE NULL
  END;

  IF v_next IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status.');
  END IF;

  UPDATE public.orders SET status = v_next,
    ready_at = CASE WHEN v_next = 'ready' THEN now() ELSE ready_at END,
    completed_at = CASE WHEN v_next = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_order_id;

  IF v_next = 'completed' THEN
    SELECT * INTO v_settings FROM public.restaurant_settings WHERE id = 'default';
    v_points := floor(GREATEST(0, v_order.subtotal_cents - v_order.discount_cents) / 100.0)
                * v_settings.loyalty_earn_per_dollar;
    IF v_points > 0 THEN
      INSERT INTO public.loyalty_ledger (user_id, order_id, delta_points, reason)
      VALUES (v_order.user_id, p_order_id, v_points, 'earn');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_next, 'notify_ready', v_next = 'ready');
END;
$$;

-- RPC: cancel_order
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_order record;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('staff', 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found.');
  END IF;
  IF v_order.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot cancel this order.');
  END IF;

  IF v_order.loyalty_redeemed_points IS NOT NULL AND v_order.loyalty_redeemed_points > 0 THEN
    INSERT INTO public.loyalty_ledger (user_id, order_id, delta_points, reason)
    VALUES (v_order.user_id, p_order_id, v_order.loyalty_redeemed_points, 'adjust');
  END IF;

  UPDATE public.orders SET status = 'cancelled', cancel_reason = p_reason WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: create_order (validates server-side; payment confirmed separately)
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
  v_points integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF public.current_user_role() != 'guest' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in as a guest to order.');
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings WHERE id = 'default';

  -- Validate and sum cart from payload
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id = v_item->>'menu_item_id' AND is_available = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Menu item unavailable.');
    END IF;
    v_subtotal := v_subtotal + (v_item->>'unit_price_cents')::integer * (v_item->>'quantity')::integer;
  END LOOP;

  IF v_subtotal = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Your cart is empty.');
  END IF;

  -- Discount
  IF (p_payload->>'discount_mode') = 'promo' AND p_payload->>'promo_code_id' IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes
    WHERE id = p_payload->>'promo_code_id' AND active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid promo.');
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
    v_discount := LEAST(v_subtotal, COALESCE((p_payload->>'loyalty_blocks')::integer, 0) * v_settings.loyalty_redeem_value_cents);
  END IF;

  v_tax := round(GREATEST(0, v_subtotal - v_discount) * v_settings.tax_rate_percent / 100.0);
  v_tip := round(GREATEST(0, v_subtotal - v_discount) * COALESCE((p_payload->>'tip_percent')::numeric, v_settings.default_tip_percent) / 100.0);
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, name_snapshot, unit_price_cents, modifiers_snapshot, quantity)
    VALUES (
      v_order_id,
      v_item->>'menu_item_id',
      v_item->>'name_snapshot',
      (v_item->>'unit_price_cents')::integer,
      COALESCE(v_item->'modifiers_snapshot', '[]'::jsonb),
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

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'total_cents', v_total, 'requires_payment', true);
END;
$$;

-- Add pending_payment status for pre-Stripe orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_payment', 'received', 'preparing', 'ready', 'completed', 'cancelled'));

-- RPC: confirm_order_payment (called after Stripe success or webhook)
CREATE OR REPLACE FUNCTION public.confirm_order_payment(p_order_id uuid, p_payment_intent_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'received', payment_intent_id = p_payment_intent_id
  WHERE id = p_order_id AND status = 'pending_payment';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found or already paid.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: update_reservation_status
CREATE OR REPLACE FUNCTION public.update_reservation_status(p_reservation_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_res record;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('staff', 'owner') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
  END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reservation not found.');
  END IF;

  UPDATE public.reservations SET
    status = p_status,
    deposit_forfeited = CASE
      WHEN p_status = 'no_show' AND deposit_hold_cents IS NOT NULL THEN true
      WHEN p_status IN ('seated', 'cancelled') THEN false
      ELSE deposit_forfeited
    END
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object('ok', true, 'notify_reminded', p_status = 'reminded');
END;
$$;

-- RPC: cancel_guest_reservation
CREATE OR REPLACE FUNCTION public.cancel_guest_reservation(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_res record;
  v_hours numeric;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reservation not found.');
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_res.slot_start - now())) / 3600.0;

  UPDATE public.reservations SET
    status = 'cancelled',
    deposit_forfeited = CASE WHEN v_hours < 2 AND deposit_hold_cents IS NOT NULL THEN true ELSE false END
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: toggle_item_available
CREATE OR REPLACE FUNCTION public.toggle_item_available(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() != 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Owner only.');
  END IF;
  UPDATE public.menu_items SET is_available = NOT is_available WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Item not found.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: update_restaurant_settings
CREATE OR REPLACE FUNCTION public.update_restaurant_settings(p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() != 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Owner only.');
  END IF;

  UPDATE public.restaurant_settings SET
    display_name = COALESCE(p_patch->>'display_name', display_name),
    address = COALESCE(p_patch->>'address', address),
    hours = COALESCE(p_patch->'hours', hours),
    timezone = COALESCE(p_patch->>'timezone', timezone),
    pickup_eta_minutes = COALESCE((p_patch->>'pickup_eta_minutes')::integer, pickup_eta_minutes),
    delivery_enabled = COALESCE((p_patch->>'delivery_enabled')::boolean, delivery_enabled),
    tax_rate_percent = COALESCE((p_patch->>'tax_rate_percent')::numeric, tax_rate_percent),
    tip_presets = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_patch->'tip_presets')::integer),
      tip_presets
    ),
    default_tip_percent = COALESCE((p_patch->>'default_tip_percent')::integer, default_tip_percent),
    loyalty_earn_per_dollar = COALESCE((p_patch->>'loyalty_earn_per_dollar')::integer, loyalty_earn_per_dollar),
    loyalty_redeem_block = COALESCE((p_patch->>'loyalty_redeem_block')::integer, loyalty_redeem_block),
    loyalty_redeem_value_cents = COALESCE((p_patch->>'loyalty_redeem_value_cents')::integer, loyalty_redeem_value_cents),
    peak_deposit_enabled = COALESCE((p_patch->>'peak_deposit_enabled')::boolean, peak_deposit_enabled),
    peak_deposit_cents = COALESCE((p_patch->>'peak_deposit_cents')::integer, peak_deposit_cents),
    slot_capacity = COALESCE((p_patch->>'slot_capacity')::integer, slot_capacity)
  WHERE id = 'default';

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: upsert_menu_item
CREATE OR REPLACE FUNCTION public.upsert_menu_item(p_item jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() != 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Owner only.');
  END IF;

  INSERT INTO public.menu_items (
    id, category_id, name, description, price_cents, image_url,
    allergens, modifiers, upsell_tags, is_available, sort_order
  ) VALUES (
    p_item->>'id',
    p_item->>'category_id',
    p_item->>'name',
    COALESCE(p_item->>'description', ''),
    (p_item->>'price_cents')::integer,
    COALESCE(p_item->>'image_url', ''),
    COALESCE(p_item->'allergens', '[]'::jsonb),
    COALESCE(p_item->'modifiers', '[]'::jsonb),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_item->'upsell_tags')), '{}'),
    COALESCE((p_item->>'is_available')::boolean, true),
    COALESCE((p_item->>'sort_order')::integer, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    image_url = EXCLUDED.image_url,
    allergens = EXCLUDED.allergens,
    modifiers = EXCLUDED.modifiers,
    upsell_tags = EXCLUDED.upsell_tags,
    is_available = EXCLUDED.is_available,
    sort_order = EXCLUDED.sort_order;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: delete_menu_item
CREATE OR REPLACE FUNCTION public.delete_menu_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() != 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Owner only.');
  END IF;
  DELETE FROM public.menu_items WHERE id = p_item_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.current_user_role() IN ('staff', 'owner')
);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Menu read for all authenticated
CREATE POLICY menu_categories_select ON public.menu_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY menu_items_select ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY menu_items_owner_write ON public.menu_items FOR ALL TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

-- Settings
CREATE POLICY settings_select ON public.restaurant_settings FOR SELECT TO authenticated USING (true);

-- Promos
CREATE POLICY promos_select ON public.promo_codes FOR SELECT TO authenticated USING (active = true OR public.current_user_role() = 'owner');
CREATE POLICY promos_owner_write ON public.promo_codes FOR ALL TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

-- Orders
CREATE POLICY orders_guest_select ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() IN ('staff', 'owner'));
CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR public.current_user_role() IN ('staff', 'owner'))
  ));

-- Reservations
CREATE POLICY reservations_select ON public.reservations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() IN ('staff', 'owner'));

-- Loyalty
CREATE POLICY loyalty_select ON public.loyalty_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_role() = 'owner');

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

-- Seed categories
INSERT INTO public.menu_categories (id, name, sort_order) VALUES
  ('cat_meze', 'Meze', 1),
  ('cat_grill', 'Grill', 2),
  ('cat_flatbreads', 'Flatbreads', 3),
  ('cat_desserts', 'Desserts', 4),
  ('cat_drinks', 'Drinks', 5)
ON CONFLICT (id) DO NOTHING;

-- Seed settings
INSERT INTO public.restaurant_settings (id, display_name, address, hours, timezone) VALUES (
  'default',
  'Lale',
  '214 Atlas Avenue, Brooklyn, NY',
  '[
    {"day":0,"open":"12:00","close":"22:00"},
    {"day":1,"open":"12:00","close":"22:00","closed":true},
    {"day":2,"open":"12:00","close":"22:00"},
    {"day":3,"open":"12:00","close":"22:00"},
    {"day":4,"open":"12:00","close":"22:00"},
    {"day":5,"open":"12:00","close":"22:00"},
    {"day":6,"open":"12:00","close":"22:00"}
  ]'::jsonb,
  'America/New_York'
) ON CONFLICT (id) DO NOTHING;

-- Seed promos
INSERT INTO public.promo_codes (id, code, type, value, active, max_redemptions, redemption_count) VALUES
  ('promo_welcome', 'WELCOME10', 'percent', 10, true, 500, 0),
  ('promo_flat5', 'LALE5', 'fixed', 500, true, NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Menu items seeded via scripts/seed-supabase.ts (reads src/data/seed.ts)

-- Reminder cron job (requires pg_cron extension on Supabase Pro)
-- SELECT cron.schedule('reservation-reminders', '*/15 * * * *', $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.edge_url') || '/reservation-reminders',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_key')),
--     body := '{}'::jsonb
--   );
-- $$);
