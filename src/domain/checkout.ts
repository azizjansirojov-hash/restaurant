import type {
  CartItem,
  DiscountMode,
  FulfillmentType,
  PromoCode,
  RestaurantSettings,
  User,
} from '../types';
import { calcTax, calcTip } from '../utils/money';

export interface CheckoutInput {
  cart: CartItem[];
  settings: RestaurantSettings;
  user: User | null;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  upsellShownForCheckout: boolean;
  tipPercent: number;
  discountMode: DiscountMode;
  appliedPromoId?: string;
  loyaltyBlocksToRedeem: number;
  promos: PromoCode[];
}

export function cartSubtotalCents(cart: CartItem[]): number {
  return cart.reduce((s, c) => s + c.unitPriceCents * c.quantity, 0);
}

export function discountCents(input: CheckoutInput): number {
  const sub = cartSubtotalCents(input.cart);
  const { discountMode, appliedPromoId, loyaltyBlocksToRedeem, settings, promos } = input;
  if (discountMode === 'promo' && appliedPromoId) {
    const promo = promos.find((p) => p.id === appliedPromoId);
    if (!promo) return 0;
    if (promo.type === 'percent') {
      return Math.min(sub, Math.round(sub * (promo.value / 100)));
    }
    return Math.min(sub, promo.value);
  }
  if (discountMode === 'loyalty' && loyaltyBlocksToRedeem > 0) {
    return Math.min(sub, loyaltyBlocksToRedeem * settings.loyaltyRedeemValueCents);
  }
  return 0;
}

export function taxCents(input: CheckoutInput): number {
  const after = Math.max(0, cartSubtotalCents(input.cart) - discountCents(input));
  return calcTax(after, input.settings.taxRatePercent);
}

export function tipCents(input: CheckoutInput): number {
  const after = Math.max(0, cartSubtotalCents(input.cart) - discountCents(input));
  return calcTip(after, input.tipPercent);
}

export function totalCents(input: CheckoutInput): number {
  return (
    Math.max(0, cartSubtotalCents(input.cart) - discountCents(input)) +
    taxCents(input) +
    tipCents(input)
  );
}

export function validatePlaceOrder(input: CheckoutInput): { ok: boolean; error?: string } {
  const { user, cart, upsellShownForCheckout, fulfillmentType, deliveryAddress, settings } = input;
  if (!user || user.role !== 'guest') {
    return { ok: false, error: 'Sign in as a guest to order.' };
  }
  if (cart.length === 0) {
    return { ok: false, error: 'Your cart is empty.' };
  }
  if (!upsellShownForCheckout) {
    return { ok: false, error: 'Complete the table upsell must be shown first.' };
  }
  if (fulfillmentType === 'delivery') {
    if (!settings.deliveryEnabled) {
      return { ok: false, error: 'Delivery is not available.' };
    }
    if (!deliveryAddress.trim()) {
      return { ok: false, error: 'Enter a delivery address.' };
    }
  }
  const pointsToRedeem = input.loyaltyBlocksToRedeem * settings.loyaltyRedeemBlock;
  if (pointsToRedeem > user.loyaltyBalance) {
    return { ok: false, error: 'Not enough loyalty points.' };
  }
  return { ok: true };
}

export function applyPromoCode(
  code: string,
  promos: PromoCode[]
): { ok: boolean; error?: string; promoId?: string } {
  const promo = promos.find(
    (p) => p.active && p.code.toUpperCase() === code.trim().toUpperCase()
  );
  if (!promo) return { ok: false, error: 'Promo code not found.' };
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return { ok: false, error: 'Promo fully redeemed.' };
  }
  return { ok: true, promoId: promo.id };
}
