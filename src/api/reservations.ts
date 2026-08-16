import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { mapReservation } from './mappers';
import { queryKeys } from '../providers/QueryProvider';
import type { Reservation, ReservationStatus } from '../types';

export function useReservations() {
  return useQuery({
    queryKey: queryKeys.reservations,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as Reservation[];
      const { data, error } = await getSupabase()
        .from('reservations')
        .select('*')
        .order('slot_start', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapReservation);
    },
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ partySize, slotStart }: { partySize: number; slotStart: Date }) => {
      const { data, error } = await getSupabase().rpc('create_reservation', {
        p_party_size: partySize,
        p_slot_start: slotStart.toISOString(),
      });
      if (error) throw error;
      const result = data as {
        ok: boolean;
        error?: string;
        reservation_id?: string;
        requires_deposit?: boolean;
      };
      if (!result.ok) throw new Error(result.error ?? 'Failed to book');
      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reservations }),
  });
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReservationStatus }) => {
      const { data, error } = await getSupabase().rpc('update_reservation_status', {
        p_reservation_id: id,
        p_status: status,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed to update');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reservations }),
  });
}

export function useCancelGuestReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await getSupabase().rpc('cancel_guest_reservation', {
        p_reservation_id: id,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed to cancel');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reservations }),
  });
}
