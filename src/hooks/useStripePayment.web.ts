/** Web stub — PaymentSheet requires native Stripe SDK. */
export function useStripePayment() {
  return {
    initPaymentSheet: async () => ({
      error: { message: 'Payments require the native app (iOS/Android).' },
    }),
    presentPaymentSheet: async () => ({
      error: { code: 'Failed', message: 'Payments require the native app (iOS/Android).' },
    }),
  };
}
