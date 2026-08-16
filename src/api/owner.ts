import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { menuItemToDb, settingsToDbPatch } from './mappers';
import { queryKeys } from '../providers/QueryProvider';
import type { MenuItem, PromoCode, RestaurantSettings } from '../types';

export function useToggleItemAvailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await getSupabase().rpc('toggle_item_available', {
        p_item_id: itemId,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menu }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<RestaurantSettings>) => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await getSupabase().rpc('update_restaurant_settings', {
        p_patch: settingsToDbPatch(patch) as unknown as import('../lib/database.types').Json,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}

export function useUpsertMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: MenuItem) => {
      const { data, error } = await getSupabase().rpc('upsert_menu_item', {
        p_item: menuItemToDb(item) as unknown as import('../lib/database.types').Json,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menu }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await getSupabase().rpc('delete_menu_item', {
        p_item_id: itemId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.menu }),
  });
}

export function useAddPromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (promo: Omit<PromoCode, 'id' | 'redemptionCount'>) => {
      const id = `promo_${Date.now()}`;
      const { error } = await getSupabase().from('promo_codes').insert({
        id,
        code: promo.code,
        type: promo.type,
        value: promo.value,
        active: promo.active,
        max_redemptions: promo.maxRedemptions ?? null,
        redemption_count: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.promos }),
  });
}

export function useTogglePromoActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await getSupabase().from('promo_codes').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.promos }),
  });
}
