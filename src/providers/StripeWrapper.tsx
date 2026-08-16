import { StripeProvider } from '@stripe/stripe-react-native';
import React from 'react';
import { env } from '../lib/env';

/** iOS/Android: wrap app in StripeProvider when publishable key is configured. */
export function StripeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <StripeProvider
      publishableKey={env.stripePublishableKey}
      merchantIdentifier="merchant.com.lale"
    >
      {children as React.ReactElement}
    </StripeProvider>
  );
}
