/**
 * Senior QA harness — pure logic + store-critical paths (Node-safe utils).
 * Run: npx tsx scripts/qa-harness.ts
 */
import assert from 'node:assert/strict';
import { earnPoints, maxRedeemableBlocks, pointsToNextBlock } from '../src/utils/loyalty';
import { calcTax, calcTip, formatSom } from '../src/utils/money';
import { generateSlots, isPeakSlot } from '../src/utils/reservations';
import { seedMenuItems, seedPromos, seedSettings } from '../src/data/seed';
import { computeCreateOrderTotals } from '../src/domain/serverOrderPricing';

async function main() {

  function section(name: string) {
    console.log(`\n✓ ${name}`);
  }

  // --- Money (UZS whole som) ---
  section('money');
  assert.equal(formatSom(12500), "12 500 so'm");
  assert.equal(calcTax(100000, 12), 12000);
  assert.equal(calcTip(100000, 10), 10000);
  assert.equal(calcTax(0, 12), 0);

  // --- Loyalty ---
  section('loyalty');
  assert.equal(pointsToNextBlock(0, 100), 100);
  assert.equal(pointsToNextBlock(40, 100), 60);
  assert.equal(pointsToNextBlock(100, 100), 100);
  assert.equal(maxRedeemableBlocks(250, 100, 250000, 50000), 2);
  assert.equal(maxRedeemableBlocks(250, 100, 40000, 50000), 0);
  assert.equal(
    earnPoints(78000, 0, seedSettings),
    78
  );

  // --- Peak slots ---
  section('peak slots');
  const friEvening = new Date('2026-08-14T18:30:00');
  assert.equal(friEvening.getDay(), 5);
  assert.equal(isPeakSlot(friEvening, seedSettings.timezone), true);
  const wedNoon = new Date('2026-08-12T12:00:00');
  assert.equal(isPeakSlot(wedNoon, seedSettings.timezone), false);

  // --- Slot generation capacity ---
  section('reservation slots');
  let probe = new Date();
  probe.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const h = seedSettings.hours.find((x) => x.day === probe.getDay());
    if (h && !h.closed) break;
    probe.setDate(probe.getDate() + 1);
  }
  const slots = generateSlots(seedSettings, probe, []);
  assert.ok(slots.every((s) => s.remaining === seedSettings.slotCapacity));

  if (slots.length > 0) {
    const target = slots[0].slotStart;
    const fakeRes = Array.from({ length: seedSettings.slotCapacity }, (_, i) => ({
      id: `r${i}`,
      userId: 'u',
      partySize: 2,
      slotStart: target.toISOString(),
      status: 'booked' as const,
      depositForfeited: false,
      createdAt: new Date().toISOString(),
    }));
    const after = generateSlots(seedSettings, probe, fakeRes);
    const hit = after.find((s) => s.slotStart.getTime() === target.getTime());
    assert.ok(hit);
    assert.equal(hit!.remaining, 0);
  }

  // --- create_order RPC price trust ---
  section('create_order price trust');
  const adana = seedMenuItems.find((i) => i.id === 'item_adana')!;
  const realUnit = adana.priceSom;
  const tamperedPayload = {
    items: [
      {
        menu_item_id: adana.id,
        name_snapshot: adana.name,
        unit_price_som: 1,
        modifiers_snapshot: [
          {
            modifierId: 'mod_spice',
            modifierName: 'Spice level',
            optionName: 'Hot',
            priceSom: 9999,
          },
        ],
        quantity: 1,
      },
    ],
    fulfillment_type: 'pickup',
    tip_percent: 10,
    discount_mode: 'none' as const,
    loyalty_blocks: 0,
  };
  const trusted = computeCreateOrderTotals(
    seedMenuItems,
    seedSettings,
    seedPromos,
    tamperedPayload,
    0
  );
  assert.equal(trusted.ok, true);
  if (!trusted.ok) throw new Error('expected ok');
  assert.equal(trusted.lines[0].unitPriceSom, realUnit);
  assert.notEqual(trusted.lines[0].unitPriceSom, 1);
  assert.equal(trusted.subtotalSom, realUnit);
  assert.equal(
    trusted.totalSom,
    realUnit + calcTax(realUnit, seedSettings.taxRatePercent) + calcTip(realUnit, 10)
  );

  console.log('\nAll QA harness assertions passed.\n');
}

main();
