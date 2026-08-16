/**
 * Part B — Credential-backed final integration pass.
 *
 * Required env (see .env.example):
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_TEST_ACCESS_TOKEN (guest JWT)
 *   SUPABASE_TEST_STAFF_TOKEN (optional, for bump tests)
 *   SUPABASE_TEST_OWNER_TOKEN (optional, for settings/menu/realtime)
 *   STRIPE_SECRET_KEY (optional, for deposit capture test)
 *
 * Run: npx tsx scripts/credential-backed-qa.ts
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const guestToken = process.env.SUPABASE_TEST_ACCESS_TOKEN;
const staffToken = process.env.SUPABASE_TEST_STAFF_TOKEN;
const ownerToken = process.env.SUPABASE_TEST_OWNER_TOKEN;
const LOG = join(process.cwd(), 'debug-01d79a.log');

function record(step: string, executed: string, observed: string, result: string) {
  const line = { step, executed, observed, result, ts: new Date().toISOString() };
  appendFileSync(LOG, `${JSON.stringify(line)}\n`);
  console.log(`[${result.toUpperCase()}] ${step}\n  executed: ${executed}\n  observed: ${observed}\n`);
}

function client(token?: string): SupabaseClient {
  const opts = token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {};
  return createClient(url!, anonKey!, opts);
}

async function main() {
  if (!url || !anonKey) {
    console.log('BLOCKED: No .env with EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    console.log('Create a Supabase project, copy .env.example → .env, apply migrations, seed menu, then re-run.');
    process.exit(2);
  }

  const fallback = !(url && anonKey);
  record('B.1 isLocalFallbackMode', 'check env vars', `supabase configured=${!fallback}`, fallback ? 'fail' : 'pass');

  const { data: menuCount } = await client().from('menu_items').select('id', { count: 'exact', head: true });
  record('B.1 seed verify', 'select count from menu_items', `count=${menuCount ?? 'query needs auth may still work via RLS'}`, menuCount !== null ? 'pass' : 'fail');

  if (!guestToken) {
    record('1.2b phone auth', 'Supabase OTP', 'SKIP — no SUPABASE_TEST_ACCESS_TOKEN; configure Twilio in Supabase Auth or paste guest JWT from app session', 'blocked');
    record('1.8b live RPC tamper', 'create_order', 'SKIP — requires guest JWT', 'blocked');
    record('2.3 realtime', 'two sessions', 'SKIP — requires guest + staff JWT', 'blocked');
    record('2.5 deposit capture', 'Stripe no-show', 'SKIP — requires Stripe + guest JWT', 'blocked');
    record('3.2b settings RPC', 'update_restaurant_settings', 'SKIP — requires owner JWT', 'blocked');
    record('3.3 guest upsert block', 'upsert_menu_item', 'running anon-only', 'pending');
  }

  // 3.3 anon upsert (no token)
  const anon = client();
  const { data: upsertData, error: upsertErr } = await anon.rpc('upsert_menu_item', {
    p_item: { id: 'qa_probe', category_id: 'cat_meze', name: 'Probe', price_cents: 100 },
  });
  record(
    '3.3 guest upsert block',
    'rpc upsert_menu_item as anon',
    upsertErr ? `error: ${upsertErr.message}` : JSON.stringify(upsertData),
    upsertErr || (upsertData as { ok?: boolean })?.ok === false ? 'pass' : 'fail'
  );

  if (guestToken) {
    const guest = client(guestToken);
    const tampered = {
      items: [{
        menu_item_id: 'item_adana',
        unit_price_cents: 1,
        modifiers_snapshot: [{ modifierId: 'mod_spice', modifierName: 'Spice', optionName: 'Hot', priceCents: 9999 }],
        quantity: 1,
      }],
      fulfillment_type: 'pickup',
      tip_percent: 18,
      discount_mode: 'none',
      loyalty_blocks: 0,
    };
    const { data, error } = await guest.rpc('create_order', { p_payload: tampered });
    record(
      '1.8b live RPC tamper',
      'create_order tampered unit_price_cents=1',
      error ? `error: ${error.message}` : JSON.stringify(data),
      !error && (data as { subtotal_cents?: number }).subtotal_cents === 2400 ? 'pass' : 'fail'
    );
  }

  if (ownerToken) {
    const owner = client(ownerToken);
    const patch = { tax_rate_percent: 9.25 };
    const { data: settingsRes } = await owner.rpc('update_restaurant_settings', { p_patch: patch });
    const { data: refetch } = await owner.from('restaurant_settings').select('tax_rate_percent').eq('id', 'default').single();
    record('3.2b settings persist', 'update_restaurant_settings + select', JSON.stringify({ rpc: settingsRes, tax: refetch?.tax_rate_percent }), refetch?.tax_rate_percent === 9.25 ? 'pass' : 'fail');
  } else {
    record('3.2b settings RPC', 'update_restaurant_settings', 'SKIP — no SUPABASE_TEST_OWNER_TOKEN', 'blocked');
  }

  record('3.4 realtime menu', 'owner toggle + guest subscription', 'SKIP — requires owner+guest JWT and manual/subscription harness', ownerToken && guestToken ? 'pending' : 'blocked');
  record('3.5/3.6 analytics', 'hand-verify analytics', 'SKIP — run after creating orders in this pass', 'blocked');
  record('4.4 network failure UI', 'PaymentSheet airplane mode', 'SKIP — requires iOS/Android device + Stripe keys', 'blocked');
  record('4.5 concurrent bump', 'parallel bump_order_status', staffToken ? 'pending' : 'SKIP — no SUPABASE_TEST_STAFF_TOKEN', 'blocked');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
