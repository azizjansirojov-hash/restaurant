import type { Database } from '../lib/database.types';
import type {
  DayHours,
  LoyaltyLedgerEntry,
  MenuCategory,
  MenuItem,
  Modifier,
  Order,
  OrderItem,
  PromoCode,
  Reservation,
  RestaurantSettings,
  SelectedModifier,
  User,
} from '../types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type MenuItemRow = Database['public']['Tables']['menu_items']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type SettingsRow = Database['public']['Tables']['restaurant_settings']['Row'];
type PromoRow = Database['public']['Tables']['promo_codes']['Row'];
type LedgerRow = Database['public']['Tables']['loyalty_ledger']['Row'];

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    role: row.role,
    loyaltyBalance: row.loyalty_balance,
    pushToken: row.push_token ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceSom: row.price_som,
    imageUrl: row.image_url,
    allergens: row.allergens as string[],
    modifiers: row.modifiers as unknown as Modifier[],
    upsellTags: row.upsell_tags,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
  };
}

export function mapCategory(row: Database['public']['Tables']['menu_categories']['Row']): MenuCategory {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export function mapSettings(row: SettingsRow): RestaurantSettings {
  return {
    displayName: row.display_name,
    address: row.address,
    hours: row.hours as unknown as DayHours[],
    timezone: row.timezone,
    pickupEtaMinutes: row.pickup_eta_minutes,
    deliveryEnabled: row.delivery_enabled,
    taxRatePercent: Number(row.tax_rate_percent),
    tipPresets: row.tip_presets,
    defaultTipPercent: row.default_tip_percent,
    loyaltyEarnPerSom: row.loyalty_earn_per_som,
    loyaltyRedeemBlock: row.loyalty_redeem_block,
    loyaltyRedeemValueSom: row.loyalty_redeem_value_som,
    peakDepositEnabled: row.peak_deposit_enabled,
    peakDepositSom: row.peak_deposit_som,
    slotCapacity: row.slot_capacity,
  };
}

export function mapPromo(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    active: row.active,
    maxRedemptions: row.max_redemptions ?? undefined,
    redemptionCount: row.redemption_count,
  };
}

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    nameSnapshot: row.name_snapshot,
    unitPriceSom: row.unit_price_som,
    modifiersSnapshot: row.modifiers_snapshot as unknown as SelectedModifier[],
    quantity: row.quantity,
  };
}

export function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  const status = row.status === 'pending_payment' ? 'received' : row.status;
  return {
    id: row.id,
    userId: row.user_id,
    status: status as Order['status'],
    fulfillmentType: row.fulfillment_type,
    subtotalSom: row.subtotal_som,
    taxSom: row.tax_som,
    tipSom: row.tip_som,
    discountSom: row.discount_som,
    totalSom: row.total_som,
    promoCodeId: row.promo_code_id ?? undefined,
    loyaltyRedeemedPoints: row.loyalty_redeemed_points ?? undefined,
    paymentIntentId: row.payment_intent_id ?? '',
    items,
    cancelReason: row.cancel_reason ?? undefined,
    createdAt: row.created_at,
    readyAt: row.ready_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export function mapReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    userId: row.user_id,
    partySize: row.party_size,
    slotStart: row.slot_start,
    status: row.status,
    depositHoldSom: row.deposit_hold_som ?? undefined,
    depositForfeited: row.deposit_forfeited,
    createdAt: row.created_at,
  };
}

export function mapLedger(row: LedgerRow): LoyaltyLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id ?? undefined,
    deltaPoints: row.delta_points,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function menuItemToDb(item: MenuItem) {
  return {
    id: item.id,
    category_id: item.categoryId,
    name: item.name,
    description: item.description,
    price_som: item.priceSom,
    image_url: item.imageUrl,
    allergens: item.allergens,
    modifiers: item.modifiers,
    upsell_tags: item.upsellTags,
    is_available: item.isAvailable,
    sort_order: item.sortOrder,
  };
}

export function settingsToDbPatch(patch: Partial<RestaurantSettings>) {
  const out: Record<string, unknown> = {};
  if (patch.displayName != null) out.display_name = patch.displayName;
  if (patch.address != null) out.address = patch.address;
  if (patch.hours != null) out.hours = patch.hours;
  if (patch.timezone != null) out.timezone = patch.timezone;
  if (patch.pickupEtaMinutes != null) out.pickup_eta_minutes = patch.pickupEtaMinutes;
  if (patch.deliveryEnabled != null) out.delivery_enabled = patch.deliveryEnabled;
  if (patch.taxRatePercent != null) out.tax_rate_percent = patch.taxRatePercent;
  if (patch.tipPresets != null) out.tip_presets = patch.tipPresets;
  if (patch.defaultTipPercent != null) out.default_tip_percent = patch.defaultTipPercent;
  if (patch.loyaltyEarnPerSom != null) out.loyalty_earn_per_som = patch.loyaltyEarnPerSom;
  if (patch.loyaltyRedeemBlock != null) out.loyalty_redeem_block = patch.loyaltyRedeemBlock;
  if (patch.loyaltyRedeemValueSom != null) out.loyalty_redeem_value_som = patch.loyaltyRedeemValueSom;
  if (patch.peakDepositEnabled != null) out.peak_deposit_enabled = patch.peakDepositEnabled;
  if (patch.peakDepositSom != null) out.peak_deposit_som = patch.peakDepositSom;
  if (patch.slotCapacity != null) out.slot_capacity = patch.slotCapacity;
  return out;
}
