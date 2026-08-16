import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { queryKeys } from '../providers/QueryProvider';

export function useOrdersRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = getSupabase()
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.orders });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.orders });
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [qc]);
}

export function useReservationsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = getSupabase()
      .channel('reservations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.reservations });
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [qc]);
}

export function useMenuRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = getSupabase()
      .channel('menu-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.menu });
        }
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [qc]);
}

export function useAppRealtime() {
  useOrdersRealtime();
  useReservationsRealtime();
  useMenuRealtime();
}
