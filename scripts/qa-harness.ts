/**
 * Senior QA harness — pure logic + store-critical paths (Node-safe utils).
 * Run: npx tsx scripts/qa-harness.ts
 */
import assert from 'node:assert/strict';
import { earnPoints, maxRedeemableBlocks, pointsToNextBlock } from '../src/utils/loyalty';
import { calcTax, calcTip, formatCents } from '../src/utils/money';
import { generateSlots, isPeakSlot } from '../src/utils/reservations';
import { seedMenuItems, seedPromos, seedSettings } from '../src/data/seed';
import { computeCreateOrderTotals } from '../src/domain/serverOrderPricing';

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

// --- Money ---
section('money');
assert.equal(formatCents(1999), '$19.99');
assert.equal(calcTax(10000, 8.875), 888); // 887.5 rounds to 888
assert.equal(calcTip(10000, 18), 1800);
assert.equal(calcTax(0, 8.875), 0);

// --- Loyalty ---
section('loyalty');
assert.equal(pointsToNextBlock(0, 100), 100);
assert.equal(pointsToNextBlock(40, 100), 60);
assert.equal(pointsToNextBlock(100, 100), 100);
assert.equal(maxRedeemableBlocks(250, 100, 2500, 1000), 2);
assert.equal(maxRedeemableBlocks(250, 100, 500, 1000), 0);
assert.equal(
  earnPoints(2400, 400, seedSettings),
  20
); // ($24 - $4) = $20 → 20 pts

// --- Peak slots ---
section('peak slots');
const friEvening = new Date('2026-08-14T18:30:00'); // Friday
assert.equal(friEvening.getDay(), 5);
assert.equal(isPeakSlot(friEvening), true);
const wedNoon = new Date('2026-08-12T12:00:00');
assert.equal(isPeakSlot(wedNoon), false);

// --- Slot generation capacity ---
section('reservation slots');
const openDay = new Date();
// find a day that isn't Monday closed
let probe = new Date();
probe.setHours(0, 0, 0, 0);
for (let i = 0; i < 7; i++) {
  const h = seedSettings.hours.find((x) => x.day === probe.getDay());
  if (h && !h.closed) break;
  probe.setDate(probe.getDate() + 1);
}
const slots = generateSlots(seedSettings, probe, []);
assert.ok(slots.every((s) => s.remaining === seedSettings.slotCapacity));

// Fill one slot to capacity
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

// --- create_order RPC price trust (faithful server-side pricing simulation) ---
section('create_order price trust');
const adana = seedMenuItems.find((i) => i.id === 'item_adana')!;
const realUnit = adana.priceCents; // 2400
const tamperedPayload = {
  items: [
    {
      menu_item_id: adana.id,
      name_snapshot: adana.name,
      unit_price_cents: 1, // attacker-supplied price — must be ignored
      modifiers_snapshot: [
        {
          modifierId: 'mod_spice',
          modifierName: 'Spice level',
          optionName: 'Hot',
          priceCents: 9999, // tampered modifier price — must be ignored
        },
      ],
      quantity: 1,
    },
  ],
  fulfillment_type: 'pickup',
  tip_percent: 18,
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
assert.equal(trusted.lines[0].unitPriceCents, realUnit);
assert.notEqual(trusted.lines[0].unitPriceCents, 1);
assert.equal(trusted.subtotalCents, realUnit);
assert.equal(trusted.totalCents, realUnit + calcTax(realUnit, seedSettings.taxRatePercent) + calcTip(realUnit, 18));

console.log('\nAll QA harness assertions passed.\n');
