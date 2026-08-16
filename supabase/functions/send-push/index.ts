import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function sendExpoPush(token: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default' }),
  });
}

async function sendTwilioSms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');
  if (!sid || !token || !from) return;

  const auth = btoa(`${sid}:${token}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { userId, title, body, smsFallback } = await req.json();

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token, phone')
    .eq('id', userId)
    .single();

  let sent = false;
  if (profile?.push_token) {
    await sendExpoPush(profile.push_token, title, body);
    sent = true;
  }

  if (!sent && smsFallback && profile?.phone) {
    await sendTwilioSms(profile.phone, body);
    sent = true;
  }

  return new Response(JSON.stringify({ ok: sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
