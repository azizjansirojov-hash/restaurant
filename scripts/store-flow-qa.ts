/**
 * Full guest → kitchen → loyalty integration test against domain simulator.
 * Run: npx tsx scripts/store-flow-qa.ts
 */
import assert from 'node:assert/strict';
import { seedMenuItems } from '../src/data/seed';
import { discountCents, type CheckoutInput } from '../src/domain/checkout';
import { createSimulatorState, simulatorActions } from '../src/domain/storeSimulator';

async function main() {
  let state = createSimulatorState();

  console.log('\n→ Auth guest');
  let r = simulatorActions.loginGuest(state, '5559998888', 'Ayla');
  assert.equal(r.ok, true);
  state = r.state;
  assert.equal(state.currentUser?.role, 'guest');

  console.log('→ Add grill item with required modifier');
  const adana = seedMenuItems.find((i) => i.id === 'item_adana')!;
  state = simulatorActions.addToCart(state, adana, 1, [
    {
      modifierId: 'mod_spice',
      modifierName: 'Spice level',
      optionName: 'Hot',
      priceCents: 0,
    },
  ]);
  assert.equal(state.cart.length, 1);

  console.log('→ Place order blocked without upsell');
  r = simulatorActions.placeOrder(state);
  assert.equal(r.ok, false);

  console.log('→ Upsell + pay');
  state = simulatorActions.markUpsellShown(state);
  state = simulatorActions.applyPromo(state, 'WELCOME10').state;
  const beforePay = state.cart.reduce((s, c) => s + c.unitPriceCents * c.quantity, 0);
  assert.ok(beforePay > 0);
  r = simulatorActions.placeOrder(state);
  assert.equal(r.ok, true);
  state = r.state;
  const orderId = r.orderId!;
  assert.equal(state.orders[0].status, 'received');
  assert.equal(state.cart.length, 0);

  console.log('→ Kitchen bump to ready (notify) then completed (earn)');
  state = simulatorActions.bumpOrderStatus(state, orderId);
  assert.equal(state.orders[0].status, 'preparing');
  state = simulatorActions.bumpOrderStatus(state, orderId);
  assert.equal(state.orders[0].status, 'ready');
  assert.ok(state.lastNotification?.title.includes('ready'));
  state = simulatorActions.bumpOrderStatus(state, orderId);
  assert.equal(state.orders[0].status, 'completed');
  const earned = state.loyaltyLedger.filter((l) => l.reason === 'earn');
  assert.ok(earned.length >= 1);
  assert.ok((state.currentUser?.loyaltyBalance || 0) > 0);

  console.log('→ Loyalty redeem on next order');
  const bal = state.currentUser!.loyaltyBalance;
  state = simulatorActions.setUserBalance(state, Math.max(bal, 100));
  const ayran = seedMenuItems.find((i) => i.id === 'item_ayran')!;
  const baklava = seedMenuItems.find((i) => i.id === 'item_baklava')!;
  const pide = seedMenuItems.find((i) => i.id === 'item_pide')!;
  state = simulatorActions.addToCart(state, pide, 1, []);
  state = simulatorActions.addToCart(state, baklava, 1, []);
  state = simulatorActions.markUpsellShown(state);
  state = simulatorActions.setLoyaltyBlocks(state, 1);
  const checkoutInput: CheckoutInput = {
    cart: state.cart,
    settings: state.settings,
    user: state.currentUser,
    fulfillmentType: state.fulfillmentType,
    deliveryAddress: state.deliveryAddress,
    upsellShownForCheckout: state.upsellShownForCheckout,
    tipPercent: state.tipPercent,
    discountMode: state.discountMode,
    appliedPromoId: state.appliedPromoId,
    loyaltyBlocksToRedeem: state.loyaltyBlocksToRedeem,
    promos: state.promos,
  };
  assert.equal(discountCents(checkoutInput), 1000);
  r = simulatorActions.placeOrder(state);
  assert.equal(r.ok, true);
  state = r.state;
  const order2 = r.orderId!;
  assert.equal(state.orders[0].loyaltyRedeemedPoints, 100);

  console.log('→ Cancel refunds loyalty');
  const balAfterRedeem = state.currentUser!.loyaltyBalance;
  state = simulatorActions.cancelOrder(state, order2, 'Guest changed mind');
  assert.equal(state.orders.find((o) => o.id === order2)?.status, 'cancelled');
  assert.equal(state.currentUser!.loyaltyBalance, balAfterRedeem + 100);

  console.log('→ Empty cart resets upsell gate');
  state = simulatorActions.addToCart(state, ayran, 1, []);
  state = simulatorActions.markUpsellShown(state);
  assert.equal(state.upsellShownForCheckout, true);
  const key = state.cart[0].key;
  state = simulatorActions.removeFromCart(state, key);
  assert.equal(state.upsellShownForCheckout, false);

  console.log('→ Custom tip clear restores default 18%');
  state = simulatorActions.setCustomTipPercent(state, '22');
  assert.equal(state.tipPercent, 22);
  state = simulatorActions.setCustomTipPercent(state, '');
  assert.equal(state.tipPercent, 18);

  console.log('→ Delivery disable forces pickup');
  state = simulatorActions.updateSettings(state, { deliveryEnabled: true });
  state = { ...state, fulfillmentType: 'delivery' };
  state = simulatorActions.updateSettings(state, { deliveryEnabled: false });
  assert.equal(state.fulfillmentType, 'pickup');

  console.log('→ Reservation book + remind');
  const slot = new Date();
  slot.setHours(slot.getHours() + 3, 0, 0, 0);
  r = simulatorActions.createReservation(state, 2, slot);
  assert.equal(r.ok, true);
  state = r.state;
  const resId = r.reservationId!;
  const soon = new Date(Date.now() + 90 * 60 * 1000);
  state = simulatorActions.patchReservationSlot(state, resId, soon.toISOString());
  state = simulatorActions.runReminderPass(state);
  assert.equal(state.reservations.find((x) => x.id === resId)?.status, 'reminded');

  console.log('→ Staff login');
  state = createSimulatorState();
  r = simulatorActions.loginStaff(state);
  assert.equal(r.ok, true);
  assert.equal(r.state.currentUser?.role, 'staff');

  console.log('→ Owner sold-out toggle');
  state = createSimulatorState();
  r = simulatorActions.loginOwner(state);
  assert.equal(r.ok, true);
  const before = state.menuItems.find((i) => i.id === 'item_hummus')!.isAvailable;
  state = simulatorActions.toggleItemAvailable(state, 'item_hummus');
  assert.equal(
    state.menuItems.find((i) => i.id === 'item_hummus')!.isAvailable,
    !before
  );

  console.log('\nAll store flow QA assertions passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
