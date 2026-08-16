import { useMemo } from 'react';
import { isLocalFallbackMode } from '../lib/env';
import { useAuth } from '../providers/AuthProvider';
import { useMenuCategories, useMenuItems, usePromos, useSettings } from '../api/menu';
import { useOrders } from '../api/orders';
import { useReservations } from '../api/reservations';
import { useLoyaltyLedger } from '../api/profile';
import { useLocalServerStore } from '../store/useLocalServerStore';
import type { User } from '../types';

/** Unified data access: Supabase when configured, local simulator otherwise. */
export function useCurrentUser(): User | null {
  const { user } = useAuth();
  const localGuest = useLocalServerStore((s) => s.localGuest);
  const simUser = useLocalServerStore((s) => s.sim.currentUser);

  if (!isLocalFallbackMode()) return user;
  return localGuest ?? simUser;
}

export function useAppMenuItems() {
  const remote = useMenuItems();
  const local = useLocalServerStore((s) => s.sim.menuItems);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false }
    : remote;
}

export function useAppCategories() {
  const remote = useMenuCategories();
  const local = useLocalServerStore((s) => s.sim.categories);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false }
    : remote;
}

export function useAppSettings() {
  const remote = useSettings();
  const local = useLocalServerStore((s) => s.sim.settings);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false }
    : remote;
}

export function useAppPromos() {
  const remote = usePromos();
  const local = useLocalServerStore((s) => s.sim.promos);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false }
    : remote;
}

export function useAppOrders() {
  const remote = useOrders();
  const local = useLocalServerStore((s) => s.sim.orders);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false, refetch: async () => {} }
    : remote;
}

export function useAppReservations() {
  const remote = useReservations();
  const local = useLocalServerStore((s) => s.sim.reservations);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false, refetch: async () => {} }
    : remote;
}

export function useAppLoyaltyLedger() {
  const remote = useLoyaltyLedger();
  const local = useLocalServerStore((s) => s.sim.loyaltyLedger);
  return isLocalFallbackMode()
    ? { ...remote, data: local, isLoading: false, isError: false }
    : remote;
}

export function useAppOrder(orderId: string | undefined) {
  const { data: orders } = useAppOrders();
  return useMemo(() => orders?.find((o) => o.id === orderId), [orders, orderId]);
}

export function useLastNotification() {
  return useLocalServerStore((s) => s.sim.lastNotification);
}

export function setLastNotification(title: string, body: string) {
  useLocalServerStore.setState({
    sim: {
      ...useLocalServerStore.getState().sim,
      lastNotification: { title, body, at: new Date().toISOString() },
    },
  });
}
