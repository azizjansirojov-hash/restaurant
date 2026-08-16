import type {
  CartItem,
  LoyaltyLedgerEntry,
  Order,
  OrderItem,
  OrderStatus,
  PromoCode,
  RestaurantSettings,
  User,
} from '../types';
import { earnPoints } from '../utils/loyalty';
import { discountCents, type CheckoutInput, validatePlaceOrder } from './checkout';

export const ORDER_FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];

export interface OrderDomainState {
  orders: Order[];
  users: User[];
  loyaltyLedger: LoyaltyLedgerEntry[];
  promos: PromoCode[];
}

export interface PlaceOrderResult {
  ok: boolean;
  error?: string;
  order?: Order;
  statePatch?: Partial<OrderDomainState & { currentUser?: User }>;
}

export function buildOrderItems(orderId: string, cart: CartItem[]): OrderItem[] {
  return cart.map((c) => ({
    orderId,
    menuItemId: c.menuItemId,
    nameSnapshot: c.name,
    unitPriceCents: c.unitPriceCents,
    modifiersSnapshot: c.selectedModifiers,
    quantity: c.quantity,
  }));
}

export function placeOrderDomain(
  input: CheckoutInput,
  state: OrderDomainState,
  orderId: string,
  paymentIntentId: string | null,
  createdAt: string
): PlaceOrderResult {
  const validation = validatePlaceOrder(input);
  if (!validation.ok) return validation;

  const user = input.user!;
  const subtotal = input.cart.reduce((s, c) => s + c.unitPriceCents * c.quantity, 0);
  const discount = discountCents(input);
  const tax = Math.round(
    Math.max(0, subtotal - discount) * (input.settings.taxRatePercent / 100)
  );
  const tip = Math.round(Math.max(0, subtotal - discount) * (input.tipPercent / 100));
  const total = Math.max(0, subtotal - discount) + tax + tip;
  const pointsToRedeem = input.loyaltyBlocksToRedeem * input.settings.loyaltyRedeemBlock;

  const order: Order = {
    id: orderId,
    userId: user.id,
    status: 'received',
    fulfillmentType: input.fulfillmentType,
    subtotalCents: subtotal,
    taxCents: tax,
    tipCents: tip,
    discountCents: discount,
    totalCents: total,
    promoCodeId: input.discountMode === 'promo' ? input.appliedPromoId : undefined,
    loyaltyRedeemedPoints: pointsToRedeem > 0 ? pointsToRedeem : undefined,
    paymentIntentId: paymentIntentId ?? '',
    items: buildOrderItems(orderId, input.cart),
    createdAt,
  };

  let ledger = [...state.loyaltyLedger];
  let users = [...state.users];
  let currentUser = { ...user };
  let promos = [...state.promos];

  if (pointsToRedeem > 0) {
    ledger.push({
      id: `led_${orderId}_redeem`,
      userId: user.id,
      orderId,
      deltaPoints: -pointsToRedeem,
      reason: 'redeem',
      createdAt,
    });
    currentUser.loyaltyBalance -= pointsToRedeem;
  }

  if (order.promoCodeId) {
    promos = promos.map((p) =>
      p.id === order.promoCodeId ? { ...p, redemptionCount: p.redemptionCount + 1 } : p
    );
  }

  users = users.map((u) => (u.id === user.id ? currentUser : u));
  if (!users.some((u) => u.id === user.id)) {
    users = [...users, currentUser];
  }

  return {
    ok: true,
    order,
    statePatch: {
      orders: [order, ...state.orders],
      users,
      loyaltyLedger: ledger,
      promos,
      currentUser,
    },
  };
}

export function bumpOrderStatusDomain(
  orderId: string,
  state: OrderDomainState,
  settings: RestaurantSettings,
  now: string
): {
  ok: boolean;
  error?: string;
  patch?: Partial<OrderDomainState & { currentUser?: User }>;
  notify?: { title: string; body: string };
} {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status === 'cancelled' || order.status === 'completed') {
    return { ok: false, error: 'Order cannot be advanced.' };
  }
  const idx = ORDER_FLOW.indexOf(order.status);
  if (idx < 0 || idx >= ORDER_FLOW.length - 1) {
    return { ok: false, error: 'Invalid status.' };
  }
  const next = ORDER_FLOW[idx + 1];
  let patch: Partial<Order> = { status: next };
  let notify: { title: string; body: string } | undefined;

  if (next === 'ready') {
    patch.readyAt = now;
    notify = {
      title: 'Lale — your order is ready for pickup',
      body: 'Head over whenever you are ready.',
    };
  }

  let ledger = state.loyaltyLedger;
  let users = state.users;
  let currentUser: User | undefined;

  if (next === 'completed') {
    patch.completedAt = now;
    const points = earnPoints(order.subtotalCents, order.discountCents, settings);
    if (points > 0) {
      ledger = [
        ...ledger,
        {
          id: `led_${orderId}_earn`,
          userId: order.userId,
          orderId: order.id,
          deltaPoints: points,
          reason: 'earn',
          createdAt: now,
        },
      ];
      users = users.map((u) =>
        u.id === order.userId ? { ...u, loyaltyBalance: u.loyaltyBalance + points } : u
      );
    }
  }

  return {
    ok: true,
    patch: {
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
      loyaltyLedger: ledger,
      users,
    },
    notify,
  };
}

export function cancelOrderDomain(
  orderId: string,
  reason: string,
  state: OrderDomainState,
  now: string
): { ok: boolean; error?: string; patch?: Partial<OrderDomainState & { currentUser?: User }> } {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { ok: false, error: 'Cannot cancel this order.' };
  }

  let ledger = [...state.loyaltyLedger];
  let users = [...state.users];
  const refundPts = order.loyaltyRedeemedPoints || 0;

  if (refundPts > 0) {
    ledger.push({
      id: `led_${orderId}_refund`,
      userId: order.userId,
      orderId: order.id,
      deltaPoints: refundPts,
      reason: 'adjust',
      createdAt: now,
    });
    users = users.map((u) =>
      u.id === order.userId ? { ...u, loyaltyBalance: u.loyaltyBalance + refundPts } : u
    );
  }

  return {
    ok: true,
    patch: {
      orders: state.orders.map((o) =>
        o.id === orderId ? { ...o, status: 'cancelled' as const, cancelReason: reason } : o
      ),
      loyaltyLedger: ledger,
      users,
    },
  };
}
