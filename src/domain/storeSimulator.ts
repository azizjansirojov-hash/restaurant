/**
 * In-memory store simulator for QA scripts — tests domain logic without Supabase.
 */
import {
  seedCategories,
  seedMenuItems,
  seedOwnerUser,
  seedPromos,
  seedSettings,
  seedStaffUser,
} from '../data/seed';
import { dayAnalytics } from './analyticsService';
import { applyPromoCode, type CheckoutInput } from './checkout';
import {
  bumpOrderStatusDomain,
  cancelOrderDomain,
  placeOrderDomain,
} from './orderService';
import {
  cancelGuestReservationDomain,
  createReservationDomain,
  runReminderPassDomain,
  updateReservationStatusDomain,
} from './reservationService';
import type {
  CartItem,
  DiscountMode,
  FulfillmentType,
  LoyaltyLedgerEntry,
  MenuItem,
  Order,
  PromoCode,
  Reservation,
  RestaurantSettings,
  SelectedModifier,
  User,
} from '../types';
import { createId } from '../utils/id';

export interface SimulatorState {
  currentUser: User | null;
  users: User[];
  categories: typeof seedCategories;
  menuItems: MenuItem[];
  settings: RestaurantSettings;
  promos: PromoCode[];
  cart: CartItem[];
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  upsellShownForCheckout: boolean;
  tipPercent: number;
  customTipPercent: string;
  discountMode: DiscountMode;
  promoCodeInput: string;
  appliedPromoId?: string;
  loyaltyBlocksToRedeem: number;
  orders: Order[];
  reservations: Reservation[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  lastNotification?: { title: string; body: string; at: string };
}

export function createSimulatorState(): SimulatorState {
  return {
    currentUser: null,
    users: [seedStaffUser, seedOwnerUser],
    categories: seedCategories,
    menuItems: seedMenuItems,
    settings: seedSettings,
    promos: seedPromos,
    cart: [],
    fulfillmentType: 'pickup',
    deliveryAddress: '',
    upsellShownForCheckout: false,
    tipPercent: seedSettings.defaultTipPercent,
    customTipPercent: '',
    discountMode: 'none',
    promoCodeInput: '',
    loyaltyBlocksToRedeem: 0,
    orders: [],
    reservations: [],
    loyaltyLedger: [],
  };
}

function checkoutInput(state: SimulatorState): CheckoutInput {
  return {
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
}

export const simulatorActions = {
  loginGuest(state: SimulatorState, phone: string, name: string): { ok: boolean; state: SimulatorState } {
    const cleaned = phone.replace(/\D/g, '');
    const user: User = {
      id: createId('user'),
      phone: cleaned,
      name: name.trim() || 'Guest',
      role: 'guest',
      loyaltyBalance: 0,
      createdAt: new Date().toISOString(),
    };
    return { ok: true, state: { ...state, currentUser: user, users: [...state.users, user] } };
  },

  loginStaff(state: SimulatorState): { ok: boolean; state: SimulatorState } {
    return { ok: true, state: { ...state, currentUser: seedStaffUser } };
  },

  loginOwner(state: SimulatorState): { ok: boolean; state: SimulatorState } {
    return { ok: true, state: { ...state, currentUser: seedOwnerUser } };
  },

  addToCart(
    state: SimulatorState,
    item: MenuItem,
    qty: number,
    mods: SelectedModifier[],
    isUpsell?: boolean
  ): SimulatorState {
    const unit = item.priceSom + mods.reduce((s, m) => s + m.priceSom, 0);
    const entry: CartItem = {
      key: createId('cart'),
      menuItemId: item.id,
      name: item.name,
      unitPriceSom: unit,
      quantity: qty,
      selectedModifiers: mods,
      imageUrl: item.imageUrl,
      isUpsell,
    };
    return { ...state, cart: [...state.cart, entry] };
  },

  markUpsellShown(state: SimulatorState): SimulatorState {
    return { ...state, upsellShownForCheckout: true };
  },

  applyPromo(state: SimulatorState, code: string): { ok: boolean; errorCode?: string; state: SimulatorState } {
    const res = applyPromoCode(code, state.promos);
    if (!res.ok) return { ok: false, errorCode: res.errorCode, state };
    const promo = state.promos.find((p) => p.id === res.promoId)!;
    return {
      ok: true,
      state: {
        ...state,
        discountMode: 'promo',
        appliedPromoId: res.promoId,
        promoCodeInput: promo.code,
        loyaltyBlocksToRedeem: 0,
      },
    };
  },

  setLoyaltyBlocks(state: SimulatorState, blocks: number): SimulatorState {
    return {
      ...state,
      loyaltyBlocksToRedeem: Math.max(0, blocks),
      discountMode: blocks > 0 ? 'loyalty' : 'none',
      appliedPromoId: blocks > 0 ? undefined : state.appliedPromoId,
      promoCodeInput: blocks > 0 ? '' : state.promoCodeInput,
    };
  },

  placeOrder(state: SimulatorState): { ok: boolean; errorCode?: string; orderId?: string; state: SimulatorState } {
    const result = placeOrderDomain(
      checkoutInput(state),
      {
        orders: state.orders,
        users: state.users,
        loyaltyLedger: state.loyaltyLedger,
        promos: state.promos,
      },
      createId('order'),
      'pi_test_simulated',
      new Date().toISOString()
    );
    if (!result.ok || !result.order) return { ok: false, errorCode: result.errorCode, state };
    const patch = result.statePatch!;
    return {
      ok: true,
      orderId: result.order.id,
      state: {
        ...state,
        orders: patch.orders!,
        users: patch.users!,
        currentUser: patch.currentUser ?? state.currentUser,
        loyaltyLedger: patch.loyaltyLedger!,
        promos: patch.promos!,
        cart: [],
        upsellShownForCheckout: false,
        discountMode: 'none',
        appliedPromoId: undefined,
        promoCodeInput: '',
        loyaltyBlocksToRedeem: 0,
        tipPercent: state.settings.defaultTipPercent,
        customTipPercent: '',
      },
    };
  },

  bumpOrderStatus(state: SimulatorState, orderId: string): SimulatorState {
    const result = bumpOrderStatusDomain(
      orderId,
      { orders: state.orders, users: state.users, loyaltyLedger: state.loyaltyLedger, promos: state.promos },
      state.settings,
      new Date().toISOString()
    );
    if (!result.ok || !result.patch) return state;
    let next = {
      ...state,
      orders: result.patch.orders!,
      users: result.patch.users!,
      loyaltyLedger: result.patch.loyaltyLedger!,
    };
    if (result.notify) {
      next = {
        ...next,
        lastNotification: { ...result.notify, at: new Date().toISOString() },
      };
    }
    if (state.currentUser && result.patch.users) {
      const updated = result.patch.users.find((u) => u.id === state.currentUser!.id);
      if (updated) next = { ...next, currentUser: updated };
    }
    return next;
  },

  cancelOrder(state: SimulatorState, orderId: string, reason: string): SimulatorState {
    const result = cancelOrderDomain(
      orderId,
      reason,
      { orders: state.orders, users: state.users, loyaltyLedger: state.loyaltyLedger, promos: state.promos },
      new Date().toISOString()
    );
    if (!result.ok || !result.patch) return state;
    let next = {
      ...state,
      orders: result.patch.orders!,
      users: result.patch.users!,
      loyaltyLedger: result.patch.loyaltyLedger!,
    };
    if (state.currentUser && result.patch.users) {
      const updated = result.patch.users.find((u) => u.id === state.currentUser!.id);
      if (updated) next = { ...next, currentUser: updated };
    }
    return next;
  },

  createReservation(
    state: SimulatorState,
    partySize: number,
    slotStart: Date
  ): { ok: boolean; error?: string; reservationId?: string; state: SimulatorState } {
    const result = createReservationDomain(
      partySize,
      slotStart,
      state.currentUser,
      state.settings,
      { reservations: state.reservations },
      createId('res'),
      new Date().toISOString()
    );
    if (!result.ok || !result.reservation) return { ok: false, error: result.error, state };
    return {
      ok: true,
      reservationId: result.reservation.id,
      state: { ...state, reservations: [result.reservation, ...state.reservations] },
    };
  },

  runReminderPass(state: SimulatorState): SimulatorState {
    const results = runReminderPassDomain({ reservations: state.reservations }, Date.now());
    if (results.length === 0) return state;
    let next = { ...state };
    for (const r of results) {
      next = {
        ...next,
        reservations: next.reservations.map((x) => (x.id === r.id ? r.reservation : x)),
        lastNotification: { ...r.notify, at: new Date().toISOString() },
      };
    }
    return next;
  },

  removeFromCart(state: SimulatorState, key: string): SimulatorState {
    const cart = state.cart.filter((c) => c.key !== key);
    return {
      ...state,
      cart,
      upsellShownForCheckout: cart.length === 0 ? false : state.upsellShownForCheckout,
    };
  },

  setCustomTipPercent(state: SimulatorState, v: string): SimulatorState {
    const trimmed = v.trim();
    if (trimmed === '') {
      return { ...state, customTipPercent: '', tipPercent: state.settings.defaultTipPercent };
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ...state, customTipPercent: v };
    }
    return { ...state, customTipPercent: v, tipPercent: n };
  },

  updateSettings(state: SimulatorState, patch: Partial<RestaurantSettings>): SimulatorState {
    const settings = { ...state.settings, ...patch };
    if (patch.deliveryEnabled === false && state.fulfillmentType === 'delivery') {
      return { ...state, settings, fulfillmentType: 'pickup', deliveryAddress: '' };
    }
    return { ...state, settings };
  },

  toggleItemAvailable(state: SimulatorState, itemId: string): SimulatorState {
    return {
      ...state,
      menuItems: state.menuItems.map((i) =>
        i.id === itemId ? { ...i, isAvailable: !i.isAvailable } : i
      ),
    };
  },

  setUserBalance(state: SimulatorState, balance: number): SimulatorState {
    if (!state.currentUser) return state;
    const currentUser = { ...state.currentUser, loyaltyBalance: balance };
    return {
      ...state,
      currentUser,
      users: state.users.map((u) => (u.id === currentUser.id ? currentUser : u)),
    };
  },

  patchReservationSlot(state: SimulatorState, id: string, slotStart: string): SimulatorState {
    return {
      ...state,
      reservations: state.reservations.map((x) => (x.id === id ? { ...x, slotStart } : x)),
    };
  },

  dayAnalytics(state: SimulatorState, day?: Date) {
    return dayAnalytics(
      state.orders,
      state.reservations,
      state.loyaltyLedger,
      state.menuItems,
      day
    );
  },
};
