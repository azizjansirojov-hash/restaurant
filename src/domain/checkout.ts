import type { ErrorCode } from './errorCodes';

export interface CheckoutInput {
  cart: import('../types').CartItem[];
  settings: import('../types').RestaurantSettings;
  user: import('../types').User | null;
  fulfillmentType: import('../types').FulfillmentType;
  deliveryAddress: string;
  upsellShownForCheckout: boolean;
  tipPercent: number;
  discountMode: import('../types').DiscountMode;
  appliedPromoId?: string;
  loyaltyBlocksToRedeem: number;
  promos: import('../types').PromoCode[];
}

export function cartSubtotalSom(cart: CheckoutInput['cart']): number {
  return cart.reduce((s, c) => s + c.unitPriceSom * c.quantity, 0);
}

export function discountSom(input: CheckoutInput): number {
  const sub = cartSubtotalSom(input.cart);
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
    return Math.min(sub, loyaltyBlocksToRedeem * settings.loyaltyRedeemValueSom);
  }
  return 0;
}

export function taxSom(input: CheckoutInput): number {
  const after = Math.max(0, cartSubtotalSom(input.cart) - discountSom(input));
  return Math.round(after * (input.settings.taxRatePercent / 100));
}

export function tipSom(input: CheckoutInput): number {
  const after = Math.max(0, cartSubtotalSom(input.cart) - discountSom(input));
  return Math.round(after * (input.tipPercent / 100));
}

export function totalSom(input: CheckoutInput): number {
  return (
    Math.max(0, cartSubtotalSom(input.cart) - discountSom(input)) +
    taxSom(input) +
    tipSom(input)
  );
}

export function validatePlaceOrder(input: CheckoutInput): { ok: boolean; errorCode?: ErrorCode } {
  const { user, cart, upsellShownForCheckout, fulfillmentType, deliveryAddress, settings } = input;
  if (!user || user.role !== 'guest') {
    return { ok: false, errorCode: 'signInGuest' };
  }
  if (cart.length === 0) {
    return { ok: false, errorCode: 'cartEmpty' };
  }
  if (!upsellShownForCheckout) {
    return { ok: false, errorCode: 'upsellRequired' };
  }
  if (fulfillmentType === 'delivery') {
    if (!settings.deliveryEnabled) {
      return { ok: false, errorCode: 'deliveryUnavailable' };
    }
    if (!deliveryAddress.trim()) {
      return { ok: false, errorCode: 'deliveryAddressRequired' };
    }
  }
  const pointsToRedeem = input.loyaltyBlocksToRedeem * settings.loyaltyRedeemBlock;
  if (pointsToRedeem > user.loyaltyBalance) {
    return { ok: false, errorCode: 'notEnoughLoyalty' };
  }
  return { ok: true };
}

export function applyPromoCode(
  code: string,
  promos: CheckoutInput['promos']
): { ok: boolean; errorCode?: ErrorCode; promoId?: string } {
  const promo = promos.find(
    (p) => p.active && p.code.toUpperCase() === code.trim().toUpperCase()
  );
  if (!promo) return { ok: false, errorCode: 'promoNotFound' };
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return { ok: false, errorCode: 'promoFullyRedeemed' };
  }
  return { ok: true, promoId: promo.id };
}
