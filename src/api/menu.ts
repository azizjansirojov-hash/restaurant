import { useQuery } from '@tanstack/react-query';
import { seedCategories, seedMenuItems, seedPromos, seedSettings } from '../data/seed';
import { isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import { mapCategory, mapMenuItem, mapPromo, mapSettings } from './mappers';
import { queryKeys } from '../providers/QueryProvider';

export function useMenuCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return seedCategories;
      const { data, error } = await getSupabase().from('menu_categories').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []).map(mapCategory);
    },
  });
}

export function useMenuItems() {
  return useQuery({
    queryKey: queryKeys.menu,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return seedMenuItems;
      const { data, error } = await getSupabase().from('menu_items').select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []).map(mapMenuItem);
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return seedSettings;
      const { data, error } = await getSupabase()
        .from('restaurant_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (error) throw error;
      return mapSettings(data);
    },
  });
}

export function usePromos() {
  return useQuery({
    queryKey: queryKeys.promos,
    queryFn: async () => {
      if (!isSupabaseConfigured()) return seedPromos;
      const { data, error } = await getSupabase().from('promo_codes').select('*');
      if (error) throw error;
      return (data ?? []).map(mapPromo);
    },
  });
}
