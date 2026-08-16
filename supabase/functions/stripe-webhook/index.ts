import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  if (!sig) {
    return new Response('Missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
    );
  } catch (e) {
    return new Response(`Webhook error: ${e instanceof Error ? e.message : 'invalid'}`, {
      status: 400,
    });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    const reservationId = intent.metadata.reservation_id;

    if (orderId) {
      await supabaseAdmin.rpc('confirm_order_payment', {
        p_order_id: orderId,
        p_payment_intent_id: intent.id,
      });
    }

    if (reservationId && intent.metadata.type === 'deposit_hold') {
      await supabaseAdmin
        .from('reservations')
        .update({ deposit_stripe_payment_intent_id: intent.id })
        .eq('id', reservationId);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    if (orderId) {
      await supabaseAdmin.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
