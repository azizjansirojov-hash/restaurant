import React from 'react';

/** Web: Stripe PaymentSheet is native-only; pass through without importing @stripe/stripe-react-native. */
export function StripeWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
