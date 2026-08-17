/** Stable error codes for client-side i18n — never display raw RPC strings. */
export type ErrorCode =
  | 'signInGuest'
  | 'cartEmpty'
  | 'upsellRequired'
  | 'deliveryUnavailable'
  | 'deliveryAddressRequired'
  | 'notEnoughLoyalty'
  | 'promoNotFound'
  | 'promoFullyRedeemed'
  | 'cannotPlaceOrder'
  | 'paymentFailed'
  | 'stripeNotConfigured'
  | 'supabaseNotConfigured'
  | 'sendCodeFailed'
  | 'verifyFailed'
  | 'invalidPhone'
  | 'saveSettingsFailed'
  | 'itemNotFound'
  | 'orderNotFound'
  | 'menuItemUnavailable'
  | 'invalidQuantity'
  | 'invalidPromo'
  | 'invalidModifierSelection'
  | 'invalidModifierOption'
  | 'requiredModifierMissing'
  | 'notAuthenticated'
  | 'unknown';

/** Map legacy RPC / domain English error strings to stable codes. */
const RPC_ERROR_MAP: Record<string, ErrorCode> = {
  'Sign in as a guest to order.': 'signInGuest',
  'Your cart is empty.': 'cartEmpty',
  'Complete the table upsell must be shown first.': 'upsellRequired',
  'Delivery is not available.': 'deliveryUnavailable',
  'Enter a delivery address.': 'deliveryAddressRequired',
  'Not enough loyalty points.': 'notEnoughLoyalty',
  'Promo code not found.': 'promoNotFound',
  'Promo fully redeemed.': 'promoFullyRedeemed',
  'Menu item unavailable.': 'menuItemUnavailable',
  'Invalid quantity.': 'invalidQuantity',
  'Invalid promo.': 'invalidPromo',
  'Invalid modifier selection.': 'invalidModifierSelection',
  'Invalid modifier option.': 'invalidModifierOption',
  'Required modifier missing.': 'requiredModifierMissing',
  'Not authenticated.': 'notAuthenticated',
};

export function resolveErrorCode(message: string): ErrorCode {
  return RPC_ERROR_MAP[message.trim()] ?? 'unknown';
}
