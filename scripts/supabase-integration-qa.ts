/**
 * Optional full-stack QA against a Supabase dev project.
 *
 * Smoke (no auth):
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npx tsx scripts/supabase-integration-qa.ts
 *
 * Live create_order price-tamper test (requires guest JWT + migration 002 applied):
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_TEST_ACCESS_TOKEN=... npx tsx scripts/supabase-integration-qa.ts
 *
 * Get a guest JWT by signing in via the app or Supabase dashboard test user, then paste the access_token.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const LOG_PATH = join(process.cwd(), 'debug-01d79a.log');
const SESSION = '01d79a';

function log(message: string, data: Record<string, unknown>) {
  const entry = {
    sessionId: SESSION,
    location: 'scripts/supabase-integration-qa.ts',
    message,
    data,
    timestamp: Date.now(),
    runId: 'integration-qa',
  };
  appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  console.log(message, data.observed ?? data);
}

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const guestToken = process.env.SUPABASE_TEST_ACCESS_TOKEN;

async function smokeTest() {
  const sb = createClient(url!, key!);
  const { data: settings, error } = await sb
    .from('restaurant_settings')
    .select('display_name, tax_rate_percent')
    .eq('id', 'default')
    .single();

  if (error) throw new Error(`Settings query failed: ${error.message}`);
  log('integration smoke', {
    executed: 'select restaurant_settings',
    observed: `display_name=${settings.display_name}, tax=${settings.tax_rate_percent}`,
    result: 'pass',
  });
  return sb;
}

async function tamperTest() {
  if (!guestToken) {
    log('create_order live tamper', {
      executed: 'supabase.rpc(create_order)',
      observed: 'SKIP — set SUPABASE_TEST_ACCESS_TOKEN (guest JWT) to run live adversarial test',
      result: 'not_testable',
    });
    return;
  }

  const sb = createClient(url!, key!, {
    global: { headers: { Authorization: `Bearer ${guestToken}` } },
  });

  const tamperedPayload = {
    items: [
      {
        menu_item_id: 'item_adana',
        name_snapshot: 'Adana Kebab',
        unit_price_cents: 1,
        modifiers_snapshot: [
          {
            modifierId: 'mod_spice',
            modifierName: 'Spice level',
            optionName: 'Hot',
            priceCents: 9999,
          },
        ],
        quantity: 1,
      },
    ],
    fulfillment_type: 'pickup',
    tip_percent: 18,
    discount_mode: 'none',
    loyalty_blocks: 0,
  };

  const { data, error } = await sb.rpc('create_order', { p_payload: tamperedPayload });
  if (error) {
    log('create_order live tamper', {
      executed: 'supabase.rpc(create_order, tampered unit_price_cents=1)',
      observed: `RPC error: ${error.message}`,
      result: 'fail',
    });
    process.exit(1);
  }

  const result = data as {
    ok: boolean;
    error?: string;
    subtotal_cents?: number;
    total_cents?: number;
    order_id?: string;
  };

  if (!result.ok) {
    log('create_order live tamper', {
      executed: 'supabase.rpc(create_order)',
      observed: `RPC returned ok=false: ${result.error}`,
      result: 'fail',
    });
    process.exit(1);
  }

  const expectedSubtotal = 2400;
  const pass = result.subtotal_cents === expectedSubtotal;
  log('create_order live tamper', {
    executed: 'supabase.rpc(create_order, tampered unit_price_cents=1)',
    observed: `subtotal_cents=${result.subtotal_cents} (expected ${expectedSubtotal}), total_cents=${result.total_cents}, order_id=${result.order_id}`,
    result: pass ? 'pass' : 'fail',
  });

  if (!pass) {
    console.error('FAIL: Server accepted tampered price — migration 002 may not be applied.');
    process.exit(1);
  }

  // Cleanup: cancel pending order so test doesn't accumulate
  if (result.order_id) {
    await sb.from('orders').delete().eq('id', result.order_id);
  }
}

async function guestUpsertBlockedTest() {
  const sb = createClient(url!, key!);
  const { data, error } = await sb.rpc('upsert_menu_item', {
    p_item: {
      id: 'item_qa_probe',
      category_id: 'cat_meze',
      name: 'QA Probe',
      price_cents: 100,
    },
  });

  const blocked =
    !error &&
    typeof data === 'object' &&
    data !== null &&
    'ok' in data &&
    (data as { ok: boolean }).ok === false;

  log('guest upsert_menu_item blocked', {
    executed: 'supabase.rpc(upsert_menu_item) as anon',
    observed: error
      ? `error: ${error.message}`
      : JSON.stringify(data),
    result: blocked || !!error ? 'pass' : 'fail',
  });

  if (!blocked && !error) process.exit(1);
}

async function main() {
  if (!url || !key) {
    console.log('Skip: SUPABASE_URL and SUPABASE_ANON_KEY not set.');
    process.exit(0);
  }

  await smokeTest();
  await guestUpsertBlockedTest();
  await tamperTest();
  console.log('\nSupabase integration QA complete.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
