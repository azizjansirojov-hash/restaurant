import { env, isStripeConfigured, isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
}

export async function createPaymentIntent(orderId: string): Promise<PaymentIntentResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Payments require Supabase configuration.');
  }

  const { data: session } = await getSupabase().auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const url = `${env.supabaseUrl}/functions/v1/create-payment-intent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Payment setup failed (${res.status})`);
  }

  return res.json();
}

export async function createDepositHold(
  reservationId: string,
  amountSom: number
): Promise<PaymentIntentResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Deposits require Supabase configuration.');
  }

  const { data: session } = await getSupabase().auth.getSession();
  if (!session.session) throw new Error('Not authenticated');

  const url = `${env.supabaseUrl}/functions/v1/create-deposit-hold`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: JSON.stringify({ reservationId, amountSom }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Deposit hold failed (${res.status})`);
  }

  return res.json();
}

export { isStripeConfigured };
