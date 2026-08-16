import { useStripe } from '@stripe/stripe-react-native';

export function useStripePayment() {
  return useStripe();
}
