export type Role = 'guest' | 'staff' | 'owner';

export type FulfillmentType = 'pickup' | 'delivery';

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type ReservationStatus =
  | 'booked'
  | 'reminded'
  | 'seated'
  | 'no_show'
  | 'cancelled';

export type LoyaltyReason = 'earn' | 'redeem' | 'adjust';

export interface ModifierOption {
  name: string;
  priceCents: number;
}

export interface Modifier {
  id: string;
  name: string;
  required: boolean;
  options: ModifierOption[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  allergens: string[];
  modifiers: Modifier[];
  upsellTags: string[];
  isAvailable: boolean;
  sortOrder: number;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  loyaltyBalance: number;
  pushToken?: string;
  createdAt: string;
}

export interface SelectedModifier {
  modifierId: string;
  modifierName: string;
  optionName: string;
  priceCents: number;
}

export interface CartItem {
  key: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  imageUrl: string;
  isUpsell?: boolean;
}

export interface OrderItem {
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPriceCents: number;
  modifiersSnapshot: SelectedModifier[];
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  discountCents: number;
  totalCents: number;
  promoCodeId?: string;
  loyaltyRedeemedPoints?: number;
  paymentIntentId: string;
  items: OrderItem[];
  cancelReason?: string;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
}

export interface Reservation {
  id: string;
  userId: string;
  partySize: number;
  slotStart: string;
  status: ReservationStatus;
  depositHoldCents?: number;
  depositForfeited: boolean;
  createdAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  userId: string;
  orderId?: string;
  deltaPoints: number;
  reason: LoyaltyReason;
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  maxRedemptions?: number;
  redemptionCount: number;
}

export interface DayHours {
  day: number; // 0=Sun … 6=Sat
  open: string; // "12:00"
  close: string; // "22:00"
  closed?: boolean;
}

export interface RestaurantSettings {
  displayName: string;
  address: string;
  hours: DayHours[];
  timezone: string;
  pickupEtaMinutes: number;
  deliveryEnabled: boolean;
  taxRatePercent: number;
  tipPresets: number[];
  defaultTipPercent: number;
  loyaltyEarnPerDollar: number;
  loyaltyRedeemBlock: number;
  loyaltyRedeemValueCents: number;
  peakDepositEnabled: boolean;
  peakDepositCents: number;
  slotCapacity: number;
}

export type DiscountMode = 'none' | 'promo' | 'loyalty';
