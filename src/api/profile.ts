import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { seedOwnerUser, seedStaffUser } from '../data/seed';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { mapLedger, mapProfile } from './mappers';
import { queryKeys } from '../providers/QueryProvider';
import type { User } from '../types';

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async (): Promise<User | null> => {
      if (!isSupabaseConfigured()) return null;
      const sb = getSupabase();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) return null;
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.session.user.id)
        .single();
      if (error) throw error;
      return mapProfile(data);
    },
    enabled: isSupabaseConfigured(),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name?: string; push_token?: string }) => {
      const sb = getSupabase();
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');
      const { error } = await sb
        .from('profiles')
        .update(patch)
        .eq('id', session.session.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile }),
  });
}

export function useLoyaltyLedger() {
  return useQuery({
    queryKey: queryKeys.loyaltyLedger,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();
      const { data: session } = await sb.auth.getSession();
      const role = (await sb.from('profiles').select('role').eq('id', session.session!.user.id).single())
        .data?.role;
      let q = sb.from('loyalty_ledger').select('*').order('created_at', { ascending: false });
      if (role !== 'owner') {
        q = q.eq('user_id', session.session!.user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapLedger);
    },
    enabled: isSupabaseConfigured(),
  });
}

/** Dev fallback when Supabase is not configured — uses seed staff/owner for local UI */
export function useDevRoleUser(phone: string | undefined): User | null {
  if (isSupabaseConfigured()) return null;
  if (phone === seedStaffUser.phone) return seedStaffUser;
  if (phone === seedOwnerUser.phone) return seedOwnerUser;
  return null;
}
