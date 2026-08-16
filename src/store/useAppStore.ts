import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEMO_ACCOUNTS,
  seedCategories,
  seedMenuItems,
  seedOwnerUser,
  seedPromos,
  seedSettings,
  seedStaffUser,
} from '../data/seed';
import type {
  CartItem,
  DiscountMode,
  FulfillmentType,
  LoyaltyLedgerEntry,
  MenuItem,
  Order,
  OrderStatus,
  PromoCode,
  Reservation,
  ReservationStatus,
  RestaurantSettings,
  SelectedModifier,
  User,
} from '../types';
import { createId } from '../utils/id';
import { earnPoints } from '../utils/loyalty';
import { calcTax, calcTip } from '../utils/money';
import { isPeakSlot } from '../utils/reservations';

const ORDER_FLOW: OrderStatus[] = ['received', 'preparing', 'ready', 'completed'];

type NotifyFn = (title: string, body: string) => void;

interface AppState {
  hydrated: boolean;
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
  notifyHandler?: NotifyFn;

  setNotifyHandler: (fn: NotifyFn) => void;
  loginWithOtp: (phone: string, otp: string, name?: string) => { ok: boolean; error?: string };
  logout: () => void;
  updateProfileName: (name: string) => void;

  addToCart: (item: MenuItem, qty: number, mods: SelectedModifier[], isUpsell?: boolean) => void;
  updateCartQty: (key: string, qty: number) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  setFulfillmentType: (t: FulfillmentType) => void;
  setDeliveryAddress: (a: string) => void;
  markUpsellShown: () => void;
  resetCheckoutFlags: () => void;
  setTipPercent: (p: number) => void;
  setCustomTipPercent: (v: string) => void;
  applyPromo: (code: string) => { ok: boolean; error?: string };
  clearPromo: () => void;
  setLoyaltyBlocks: (blocks: number) => void;
  clearLoyaltyRedeem: () => void;

  cartSubtotalCents: () => number;
  discountCents: () => number;
  taxCents: () => number;
  tipCents: () => number;
  totalCents: () => number;

  placeOrder: () => { ok: boolean; orderId?: string; error?: string };
  bumpOrderStatus: (orderId: string) => { ok: boolean; error?: string };
  cancelOrder: (orderId: string, reason: string) => { ok: boolean; error?: string };

  createReservation: (
    partySize: number,
    slotStart: Date
  ) => { ok: boolean; reservationId?: string; error?: string; requiresDeposit?: boolean };
  updateReservationStatus: (
    id: string,
    status: ReservationStatus
  ) => { ok: boolean; error?: string };
  cancelGuestReservation: (id: string) => { ok: boolean; error?: string };
  runReminderPass: () => void;

  toggleItemAvailable: (itemId: string) => void;
  updateMenuItem: (item: MenuItem) => void;
  updateSettings: (patch: Partial<RestaurantSettings>) => void;
  addPromo: (promo: Omit<PromoCode, 'id' | 'redemptionCount'>) => void;
  togglePromoActive: (id: string) => void;

  dayAnalytics: (day?: Date) => {
    ordersCount: number;
    gmvCents: number;
    aovCents: number;
    tipTotalCents: number;
    upsellAttachRate: number;
    noShowRate: number;
    loyaltyEarned: number;
    loyaltyRedeemed: number;
    repeatRate: number;
  };
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

function notify(get: () => AppState, title: string, body: string) {
  const at = new Date().toISOString();
  get().notifyHandler?.(title, body);
  useAppStore.setState({ lastNotification: { title, body, at } });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
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
      appliedPromoId: undefined,
      loyaltyBlocksToRedeem: 0,
      orders: [],
      reservations: [],
      loyaltyLedger: [],
      lastNotification: undefined,
      notifyHandler: undefined,

      setNotifyHandler: (fn) => set({ notifyHandler: fn }),

      loginWithOtp: (phone, otp, name) => {
        if (otp !== DEMO_ACCOUNTS.guestOtp) {
          return { ok: false, error: 'Invalid code. Use 123456 for demo.' };
        }
        const cleaned = digitsOnly(phone);
        if (cleaned.length < 10) {
          return { ok: false, error: 'Enter a valid phone number.' };
        }

        const existing = get().users.find((u) => digitsOnly(u.phone) === cleaned);
        if (existing) {
          set({ currentUser: existing });
          return { ok: true };
        }

        let role: User['role'] = 'guest';
        let displayName = name?.trim() || 'Guest';
        if (cleaned === DEMO_ACCOUNTS.staffPhone) {
          role = 'staff';
          displayName = seedStaffUser.name;
        } else if (cleaned === DEMO_ACCOUNTS.ownerPhone) {
          role = 'owner';
          displayName = seedOwnerUser.name;
        }

        const user: User = {
          id: createId('user'),
          phone: cleaned,
          name: displayName,
          role,
          loyaltyBalance: 0,
          createdAt: new Date().toISOString(),
        };

        // Prefer seeded staff/owner records
        if (role === 'staff') {
          set({ currentUser: seedStaffUser });
          return { ok: true };
        }
        if (role === 'owner') {
          set({ currentUser: seedOwnerUser });
          return { ok: true };
        }

        set({ currentUser: user, users: [...get().users, user] });
        return { ok: true };
      },

      logout: () =>
        set({
          currentUser: null,
          cart: [],
          upsellShownForCheckout: false,
          discountMode: 'none',
          appliedPromoId: undefined,
          loyaltyBlocksToRedeem: 0,
          tipPercent: get().settings.defaultTipPercent,
        }),

      updateProfileName: (name) => {
        const user = get().currentUser;
        if (!user) return;
        const updated = { ...user, name };
        set({
          currentUser: updated,
          users: get().users.map((u) => (u.id === user.id ? updated : u)),
        });
      },

      addToCart: (item, qty, mods, isUpsell) => {
        const unit =
          item.priceCents + mods.reduce((s, m) => s + m.priceCents, 0);
        const key = createId('cart');
        const entry: CartItem = {
          key,
          menuItemId: item.id,
          name: item.name,
          unitPriceCents: unit,
          quantity: qty,
          selectedModifiers: mods,
          imageUrl: item.imageUrl,
          isUpsell,
        };
        set({ cart: [...get().cart, entry] });
      },

      updateCartQty: (key, qty) => {
        if (qty <= 0) {
          const cart = get().cart.filter((c) => c.key !== key);
          set({
            cart,
            upsellShownForCheckout: cart.length === 0 ? false : get().upsellShownForCheckout,
          });
          return;
        }
        set({
          cart: get().cart.map((c) => (c.key === key ? { ...c, quantity: qty } : c)),
        });
      },

      removeFromCart: (key) => {
        const cart = get().cart.filter((c) => c.key !== key);
        set({
          cart,
          upsellShownForCheckout: cart.length === 0 ? false : get().upsellShownForCheckout,
        });
      },

      clearCart: () => set({ cart: [], upsellShownForCheckout: false }),

      setFulfillmentType: (t) => set({ fulfillmentType: t }),
      setDeliveryAddress: (a) => set({ deliveryAddress: a }),
      markUpsellShown: () => set({ upsellShownForCheckout: true }),
      resetCheckoutFlags: () =>
        set({
          upsellShownForCheckout: false,
          discountMode: 'none',
          appliedPromoId: undefined,
          promoCodeInput: '',
          loyaltyBlocksToRedeem: 0,
          tipPercent: get().settings.defaultTipPercent,
          customTipPercent: '',
        }),

      setTipPercent: (p) => set({ tipPercent: p, customTipPercent: '' }),
      setCustomTipPercent: (v) => {
        const trimmed = v.trim();
        if (trimmed === '') {
          // Clearing custom restores restaurant default tip — never silently 0%.
          set({
            customTipPercent: '',
            tipPercent: get().settings.defaultTipPercent,
          });
          return;
        }
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          set({ customTipPercent: v });
          return;
        }
        set({ customTipPercent: v, tipPercent: n });
      },

      applyPromo: (code) => {
        const promo = get().promos.find(
          (p) => p.active && p.code.toUpperCase() === code.trim().toUpperCase()
        );
        if (!promo) return { ok: false, error: 'Promo code not found.' };
        if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
          return { ok: false, error: 'Promo fully redeemed.' };
        }
        set({
          discountMode: 'promo',
          appliedPromoId: promo.id,
          promoCodeInput: promo.code,
          loyaltyBlocksToRedeem: 0,
        });
        return { ok: true };
      },

      clearPromo: () =>
        set({
          appliedPromoId: undefined,
          promoCodeInput: '',
          discountMode: get().loyaltyBlocksToRedeem > 0 ? 'loyalty' : 'none',
        }),

      setLoyaltyBlocks: (blocks) => {
        set({
          loyaltyBlocksToRedeem: Math.max(0, blocks),
          discountMode: blocks > 0 ? 'loyalty' : 'none',
          appliedPromoId: blocks > 0 ? undefined : get().appliedPromoId,
          promoCodeInput: blocks > 0 ? '' : get().promoCodeInput,
        });
      },

      clearLoyaltyRedeem: () =>
        set({
          loyaltyBlocksToRedeem: 0,
          discountMode: get().appliedPromoId ? 'promo' : 'none',
        }),

      cartSubtotalCents: () =>
        get().cart.reduce((s, c) => s + c.unitPriceCents * c.quantity, 0),

      discountCents: () => {
        const sub = get().cartSubtotalCents();
        const { discountMode, appliedPromoId, loyaltyBlocksToRedeem, settings, promos } = get();
        if (discountMode === 'promo' && appliedPromoId) {
          const promo = promos.find((p) => p.id === appliedPromoId);
          if (!promo) return 0;
          if (promo.type === 'percent') {
            return Math.min(sub, Math.round(sub * (promo.value / 100)));
          }
          return Math.min(sub, promo.value);
        }
        if (discountMode === 'loyalty' && loyaltyBlocksToRedeem > 0) {
          return Math.min(
            sub,
            loyaltyBlocksToRedeem * settings.loyaltyRedeemValueCents
          );
        }
        return 0;
      },

      taxCents: () => {
        const after = Math.max(0, get().cartSubtotalCents() - get().discountCents());
        return calcTax(after, get().settings.taxRatePercent);
      },

      tipCents: () => {
        const after = Math.max(0, get().cartSubtotalCents() - get().discountCents());
        return calcTip(after, get().tipPercent);
      },

      totalCents: () =>
        Math.max(0, get().cartSubtotalCents() - get().discountCents()) +
        get().taxCents() +
        get().tipCents(),

      placeOrder: () => {
        const user = get().currentUser;
        if (!user || user.role !== 'guest') {
          return { ok: false, error: 'Sign in as a guest to order.' };
        }
        if (get().cart.length === 0) {
          return { ok: false, error: 'Your cart is empty.' };
        }
        if (!get().upsellShownForCheckout) {
          return { ok: false, error: 'Complete the table upsell must be shown first.' };
        }
        if (get().fulfillmentType === 'delivery') {
          if (!get().settings.deliveryEnabled) {
            return { ok: false, error: 'Delivery is not available.' };
          }
          if (!get().deliveryAddress.trim()) {
            return { ok: false, error: 'Enter a delivery address.' };
          }
        }

        const subtotal = get().cartSubtotalCents();
        const discount = get().discountCents();
        const tax = get().taxCents();
        const tip = get().tipCents();
        const total = get().totalCents();
        const settings = get().settings;
        const blocks = get().loyaltyBlocksToRedeem;
        const pointsToRedeem = blocks * settings.loyaltyRedeemBlock;

        if (pointsToRedeem > user.loyaltyBalance) {
          return { ok: false, error: 'Not enough loyalty points.' };
        }

        // Simulate payment success
        const orderId = createId('order');
        const items = get().cart.map((c) => ({
          orderId,
          menuItemId: c.menuItemId,
          nameSnapshot: c.name,
          unitPriceCents: c.unitPriceCents,
          modifiersSnapshot: c.selectedModifiers,
          quantity: c.quantity,
        }));

        const order: Order = {
          id: orderId,
          userId: user.id,
          status: 'received',
          fulfillmentType: get().fulfillmentType,
          subtotalCents: subtotal,
          taxCents: tax,
          tipCents: tip,
          discountCents: discount,
          totalCents: total,
          promoCodeId: get().discountMode === 'promo' ? get().appliedPromoId : undefined,
          loyaltyRedeemedPoints: pointsToRedeem > 0 ? pointsToRedeem : undefined,
          paymentIntentId: createId('pi'),
          items,
          createdAt: new Date().toISOString(),
        };

        let ledger = [...get().loyaltyLedger];
        let users = [...get().users];
        let currentUser = { ...user };
        let promos = [...get().promos];

        if (pointsToRedeem > 0) {
          ledger.push({
            id: createId('led'),
            userId: user.id,
            orderId,
            deltaPoints: -pointsToRedeem,
            reason: 'redeem',
            createdAt: new Date().toISOString(),
          });
          currentUser.loyaltyBalance -= pointsToRedeem;
        }

        if (order.promoCodeId) {
          promos = promos.map((p) =>
            p.id === order.promoCodeId
              ? { ...p, redemptionCount: p.redemptionCount + 1 }
              : p
          );
        }

        users = users.map((u) => (u.id === user.id ? currentUser : u));
        if (!users.some((u) => u.id === user.id)) {
          users = [...users, currentUser];
        }

        set({
          orders: [order, ...get().orders],
          cart: [],
          users,
          currentUser,
          loyaltyLedger: ledger,
          promos,
          upsellShownForCheckout: false,
          discountMode: 'none',
          appliedPromoId: undefined,
          promoCodeInput: '',
          loyaltyBlocksToRedeem: 0,
          tipPercent: settings.defaultTipPercent,
          customTipPercent: '',
        });

        return { ok: true, orderId };
      },

      bumpOrderStatus: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: 'Order not found.' };
        if (order.status === 'cancelled' || order.status === 'completed') {
          return { ok: false, error: 'Order cannot be advanced.' };
        }
        const idx = ORDER_FLOW.indexOf(order.status);
        if (idx < 0 || idx >= ORDER_FLOW.length - 1) {
          return { ok: false, error: 'Invalid status.' };
        }
        const next = ORDER_FLOW[idx + 1];
        const now = new Date().toISOString();
        let patch: Partial<Order> = { status: next };
        if (next === 'ready') {
          patch.readyAt = now;
          notify(get, 'Lale — your order is ready for pickup', 'Head over whenever you are ready.');
        }

        let ledger = get().loyaltyLedger;
        let users = get().users;
        let currentUser = get().currentUser;

        if (next === 'completed') {
          patch.completedAt = now;
          const points = earnPoints(order.subtotalCents, order.discountCents, get().settings);
          if (points > 0) {
            ledger = [
              ...ledger,
              {
                id: createId('led'),
                userId: order.userId,
                orderId: order.id,
                deltaPoints: points,
                reason: 'earn',
                createdAt: now,
              },
            ];
            users = users.map((u) =>
              u.id === order.userId
                ? { ...u, loyaltyBalance: u.loyaltyBalance + points }
                : u
            );
            if (currentUser?.id === order.userId) {
              currentUser = {
                ...currentUser,
                loyaltyBalance: currentUser.loyaltyBalance + points,
              };
            }
          }
        }

        set({
          orders: get().orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
          loyaltyLedger: ledger,
          users,
          currentUser,
        });
        return { ok: true };
      },

      cancelOrder: (orderId, reason) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, error: 'Order not found.' };
        if (order.status === 'completed' || order.status === 'cancelled') {
          return { ok: false, error: 'Cannot cancel this order.' };
        }

        let ledger = [...get().loyaltyLedger];
        let users = [...get().users];
        let currentUser = get().currentUser;
        const refundPts = order.loyaltyRedeemedPoints || 0;

        // Refund loyalty redeemed at pay time — cancelled tickets never earn, never keep the redeem.
        if (refundPts > 0) {
          const now = new Date().toISOString();
          ledger.push({
            id: createId('led'),
            userId: order.userId,
            orderId: order.id,
            deltaPoints: refundPts,
            reason: 'adjust',
            createdAt: now,
          });
          users = users.map((u) =>
            u.id === order.userId
              ? { ...u, loyaltyBalance: u.loyaltyBalance + refundPts }
              : u
          );
          if (currentUser?.id === order.userId) {
            currentUser = {
              ...currentUser,
              loyaltyBalance: currentUser.loyaltyBalance + refundPts,
            };
          }
        }

        set({
          orders: get().orders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'cancelled' as const, cancelReason: reason }
              : o
          ),
          loyaltyLedger: ledger,
          users,
          currentUser,
        });
        return { ok: true };
      },

      createReservation: (partySize, slotStart) => {
        const user = get().currentUser;
        if (!user || user.role !== 'guest') {
          return { ok: false, error: 'Sign in as a guest to reserve.' };
        }
        if (partySize < 1 || partySize > 8) {
          return { ok: false, error: 'Party size must be 1–8.' };
        }

        const settings = get().settings;
        const localKey = `${slotStart.getFullYear()}-${slotStart.getMonth()}-${slotStart.getDate()}-${slotStart.getHours()}-${slotStart.getMinutes()}`;
        const taken = get().reservations.filter((r) => {
          if (r.status === 'cancelled' || r.status === 'no_show') return false;
          const d = new Date(r.slotStart);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
          return key === localKey;
        }).length;
        if (taken >= settings.slotCapacity) {
          return { ok: false, error: 'That slot is full.' };
        }

        const peak = isPeakSlot(slotStart);
        const needsDeposit = settings.peakDepositEnabled && peak;
        const reservation: Reservation = {
          id: createId('res'),
          userId: user.id,
          partySize,
          slotStart: slotStart.toISOString(),
          status: 'booked',
          depositHoldCents: needsDeposit ? settings.peakDepositCents : undefined,
          depositForfeited: false,
          createdAt: new Date().toISOString(),
        };

        set({ reservations: [reservation, ...get().reservations] });
        return {
          ok: true,
          reservationId: reservation.id,
          requiresDeposit: needsDeposit,
        };
      },

      updateReservationStatus: (id, status) => {
        const res = get().reservations.find((r) => r.id === id);
        if (!res) return { ok: false, error: 'Reservation not found.' };

        let depositForfeited = res.depositForfeited;
        if (status === 'no_show' && res.depositHoldCents) {
          depositForfeited = true;
        }
        if (status === 'seated' || status === 'cancelled') {
          depositForfeited = false;
        }

        if (status === 'reminded') {
          notify(get, 'See you at Lale in 2 hours', 'Your table is waiting.');
        }

        set({
          reservations: get().reservations.map((r) =>
            r.id === id ? { ...r, status, depositForfeited } : r
          ),
        });
        return { ok: true };
      },

      cancelGuestReservation: (id) => {
        const user = get().currentUser;
        const res = get().reservations.find((r) => r.id === id);
        if (!res || !user || res.userId !== user.id) {
          return { ok: false, error: 'Reservation not found.' };
        }
        const slot = new Date(res.slotStart);
        const hoursUntil = (slot.getTime() - Date.now()) / (1000 * 60 * 60);
        // Release hold if cancel ≥2h before
        set({
          reservations: get().reservations.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'cancelled',
                  depositForfeited: hoursUntil < 2 && !!r.depositHoldCents ? true : false,
                }
              : r
          ),
        });
        return { ok: true };
      },

      runReminderPass: () => {
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;
        get().reservations.forEach((r) => {
          if (r.status !== 'booked') return;
          const start = new Date(r.slotStart).getTime();
          const delta = start - now;
          if (delta <= twoHours && delta > 0) {
            get().updateReservationStatus(r.id, 'reminded');
          }
        });
      },

      toggleItemAvailable: (itemId) => {
        set({
          menuItems: get().menuItems.map((i) =>
            i.id === itemId ? { ...i, isAvailable: !i.isAvailable } : i
          ),
        });
      },

      updateMenuItem: (item) => {
        set({
          menuItems: get().menuItems.map((i) => (i.id === item.id ? item : i)),
        });
      },

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch };
        if (patch.deliveryEnabled === false && get().fulfillmentType === 'delivery') {
          set({
            settings,
            fulfillmentType: 'pickup',
            deliveryAddress: '',
          });
          return;
        }
        set({ settings });
      },

      addPromo: (promo) => {
        set({
          promos: [
            ...get().promos,
            { ...promo, id: createId('promo'), redemptionCount: 0 },
          ],
        });
      },

      togglePromoActive: (id) => {
        set({
          promos: get().promos.map((p) =>
            p.id === id ? { ...p, active: !p.active } : p
          ),
        });
      },

      dayAnalytics: (day = new Date()) => {
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setHours(23, 59, 59, 999);

        const dayOrders = get().orders.filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= start.getTime() && t <= end.getTime() && o.status !== 'cancelled';
        });
        const completed = dayOrders.filter((o) => o.status === 'completed' || o.status === 'ready' || o.status === 'preparing' || o.status === 'received');
        const gmv = completed.reduce((s, o) => s + o.totalCents, 0);
        const tips = completed.reduce((s, o) => s + o.tipCents, 0);
        const withUpsell = completed.filter((o) =>
          o.items.some((it) => {
            const menu = get().menuItems.find((m) => m.id === it.menuItemId);
            return menu?.upsellTags.includes('complete_the_table');
          })
        ).length;

        const dayRes = get().reservations.filter((r) => {
          const t = new Date(r.slotStart).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
        const closedRes = dayRes.filter(
          (r) => r.status === 'seated' || r.status === 'no_show'
        );
        const noShows = dayRes.filter((r) => r.status === 'no_show').length;

        const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const guestCompleted = get().orders.filter(
          (o) => o.status === 'completed' && new Date(o.createdAt).getTime() >= thirtyAgo
        );
        const counts = new Map<string, number>();
        guestCompleted.forEach((o) => counts.set(o.userId, (counts.get(o.userId) || 0) + 1));
        const guests = counts.size || 1;
        const repeaters = [...counts.values()].filter((n) => n >= 2).length;

        const dayLedger = get().loyaltyLedger.filter((l) => {
          const t = new Date(l.createdAt).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });

        return {
          ordersCount: completed.length,
          gmvCents: gmv,
          aovCents: completed.length ? Math.round(gmv / completed.length) : 0,
          tipTotalCents: tips,
          upsellAttachRate: completed.length ? withUpsell / completed.length : 0,
          noShowRate: closedRes.length ? noShows / closedRes.length : dayRes.length ? noShows / dayRes.length : 0,
          loyaltyEarned: dayLedger.filter((l) => l.reason === 'earn').reduce((s, l) => s + l.deltaPoints, 0),
          loyaltyRedeemed: Math.abs(
            dayLedger.filter((l) => l.reason === 'redeem').reduce((s, l) => s + l.deltaPoints, 0)
          ),
          repeatRate: repeaters / guests,
        };
      },
    }),
    {
      name: 'lale-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        currentUser: s.currentUser,
        users: s.users,
        menuItems: s.menuItems,
        settings: s.settings,
        promos: s.promos,
        orders: s.orders,
        reservations: s.reservations,
        loyaltyLedger: s.loyaltyLedger,
        cart: s.cart,
      }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hydrated: true });
      },
    }
  )
);
