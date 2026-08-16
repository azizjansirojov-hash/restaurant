import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const EDGE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (_req) => {
  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const windowEnd = new Date(now.getTime() + twoHoursMs);

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, user_id, slot_start')
    .eq('status', 'booked')
    .gte('slot_start', now.toISOString())
    .lte('slot_start', windowEnd.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let reminded = 0;
  for (const r of reservations ?? []) {
    await supabase.rpc('update_reservation_status', {
      p_reservation_id: r.id,
      p_status: 'reminded',
    });

    await fetch(`${EDGE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        userId: r.user_id,
        title: 'See you at Lale in 2 hours',
        body: 'Your table is waiting.',
        smsFallback: true,
      }),
    });
    reminded++;
  }

  return new Response(JSON.stringify({ ok: true, reminded }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
