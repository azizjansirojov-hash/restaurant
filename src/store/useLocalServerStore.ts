import { create } from 'zustand';
import { createSimulatorState, simulatorActions } from '../domain/storeSimulator';
import type { MenuItem, PromoCode, Reservation, RestaurantSettings, User } from '../types';
import { seedMenuItems } from '../data/seed';

/** Local-only server state when Supabase is not configured (dev/QA UI). */
interface LocalServerState {
  sim: ReturnType<typeof createSimulatorState>;
  localGuest: User | null;
  setLocalGuest: (user: User | null) => void;
  toggleItemAvailableLocal: (id: string) => void;
  updateSettingsLocal: (patch: Partial<RestaurantSettings>) => void;
  updateMenuItemLocal: (item: MenuItem) => void;
  addPromoLocal: (promo: Omit<PromoCode, 'id' | 'redemptionCount'>) => void;
  togglePromoLocal: (id: string) => void;
}

export const useLocalServerStore = create<LocalServerState>((set, get) => ({
  sim: createSimulatorState(),
  localGuest: null,

  setLocalGuest: (user) => set({ localGuest: user }),

  toggleItemAvailableLocal: (id) =>
    set({ sim: simulatorActions.toggleItemAvailable(get().sim, id) }),

  updateSettingsLocal: (patch) =>
    set({ sim: simulatorActions.updateSettings(get().sim, patch) }),

  updateMenuItemLocal: (item) =>
    set({
      sim: {
        ...get().sim,
        menuItems: get().sim.menuItems.map((i) => (i.id === item.id ? item : i)),
      },
    }),

  addPromoLocal: (promo) =>
    set({
      sim: {
        ...get().sim,
        promos: [
          ...get().sim.promos,
          { ...promo, id: `promo_${Date.now()}`, redemptionCount: 0 },
        ],
      },
    }),

  togglePromoLocal: (id) =>
    set({
      sim: {
        ...get().sim,
        promos: get().sim.promos.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
      },
    }),
}));

export function getLocalOrders() {
  return useLocalServerStore.getState().sim.orders;
}

export function getLocalReservations(): Reservation[] {
  return useLocalServerStore.getState().sim.reservations;
}

export function getLocalMenuItems(): MenuItem[] {
  return useLocalServerStore.getState().sim.menuItems;
}

export function resetLocalMenuFromSeed() {
  useLocalServerStore.setState((s) => ({
    sim: { ...s.sim, menuItems: seedMenuItems },
  }));
}
