import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { simulatorActions } from '../domain/storeSimulator';
import {
  useBumpOrderStatus,
  useCancelOrder,
  useConfirmOrderPayment,
  useCreateOrder,
} from '../api/orders';
import {
  useCancelGuestReservation,
  useCreateReservation,
  useUpdateReservationStatus,
} from '../api/reservations';
import { useToggleItemAvailable, useUpdateSettings, useUpsertMenuItem } from '../api/owner';
import { isLocalFallbackMode } from '../lib/env';
import { queryKeys } from '../providers/QueryProvider';
import { useLocalServerStore } from '../store/useLocalServerStore';
import { setLastNotification } from '../hooks/useAppData';
import type { MenuItem, ReservationStatus, RestaurantSettings } from '../types';
import type { CreateOrderPayload } from '../api/orders';

export function useOrderActions() {
  const createOrder = useCreateOrder();
  const bumpRemote = useBumpOrderStatus();
  const cancelRemote = useCancelOrder();
  const confirmPayment = useConfirmOrderPayment();
  const qc = useQueryClient();

  const bumpOrderStatus = useCallback(
    async (orderId: string) => {
      if (!isLocalFallbackMode()) {
        const result = await bumpRemote.mutateAsync(orderId);
        if (result.notify_ready) {
          setLastNotification(
            'Lale — your order is ready for pickup',
            'Head over whenever you are ready.'
          );
        }
        return { ok: true as const };
      }
      const sim = useLocalServerStore.getState().sim;
      const next = simulatorActions.bumpOrderStatus(sim, orderId);
      useLocalServerStore.setState({ sim: next });
      return { ok: true as const };
    },
    [bumpRemote]
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!isLocalFallbackMode()) {
        await cancelRemote.mutateAsync({ orderId, reason });
        return { ok: true as const };
      }
      const sim = useLocalServerStore.getState().sim;
      useLocalServerStore.setState({ sim: simulatorActions.cancelOrder(sim, orderId, reason) });
      return { ok: true as const };
    },
    [cancelRemote]
  );

  const placeOrderRemote = useCallback(
    async (payload: CreateOrderPayload) => {
      return createOrder.mutateAsync(payload);
    },
    [createOrder]
  );

  const confirmOrderPayment = useCallback(
    async (orderId: string, paymentIntentId: string) => {
      if (!isLocalFallbackMode()) {
        await confirmPayment.mutateAsync({ orderId, paymentIntentId });
      }
    },
    [confirmPayment]
  );

  const invalidateOrders = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.orders });
    qc.invalidateQueries({ queryKey: queryKeys.profile });
  }, [qc]);

  return {
    bumpOrderStatus,
    cancelOrder,
    placeOrderRemote,
    confirmOrderPayment,
    invalidateOrders,
    isPending: createOrder.isPending || bumpRemote.isPending,
  };
}

export function useReservationActions() {
  const createRemote = useCreateReservation();
  const updateRemote = useUpdateReservationStatus();
  const cancelRemote = useCancelGuestReservation();

  const createReservation = useCallback(
    async (partySize: number, slotStart: Date) => {
      if (!isLocalFallbackMode()) {
        const result = await createRemote.mutateAsync({ partySize, slotStart });
        return {
          ok: true as const,
          reservationId: result.reservation_id!,
          requiresDeposit: result.requires_deposit,
        };
      }
      const sim = useLocalServerStore.getState().sim;
      const result = simulatorActions.createReservation(sim, partySize, slotStart);
      if (result.ok) useLocalServerStore.setState({ sim: result.state });
      return {
        ok: result.ok,
        error: result.error,
        reservationId: result.reservationId,
        requiresDeposit: false,
      };
    },
    [createRemote]
  );

  const updateReservationStatus = useCallback(
    async (id: string, status: ReservationStatus) => {
      if (!isLocalFallbackMode()) {
        await updateRemote.mutateAsync({ id, status });
        if (status === 'reminded') {
          setLastNotification('See you at Lale in 2 hours', 'Your table is waiting.');
        }
        return { ok: true as const };
      }
      const sim = useLocalServerStore.getState().sim;
      const { updateReservationStatusDomain } = await import('../domain/reservationService');
      const result = updateReservationStatusDomain(id, status, { reservations: sim.reservations });
      if (!result.ok) return result;
      useLocalServerStore.setState({
        sim: {
          ...sim,
          reservations: sim.reservations.map((r) =>
            r.id === id ? result.reservation! : r
          ),
          lastNotification: result.notify
            ? { ...result.notify, at: new Date().toISOString() }
            : sim.lastNotification,
        },
      });
      return { ok: true as const };
    },
    [updateRemote]
  );

  const cancelGuestReservation = useCallback(
    async (id: string) => {
      if (!isLocalFallbackMode()) {
        await cancelRemote.mutateAsync(id);
        return { ok: true as const };
      }
      const sim = useLocalServerStore.getState().sim;
      const { cancelGuestReservationDomain } = await import('../domain/reservationService');
      const r = cancelGuestReservationDomain(id, sim.currentUser, { reservations: sim.reservations });
      if (!r.ok) return r;
      useLocalServerStore.setState({
        sim: {
          ...sim,
          reservations: sim.reservations.map((x) => (x.id === id ? r.reservation! : x)),
        },
      });
      return { ok: true as const };
    },
    [cancelRemote]
  );

  const runReminderPass = useCallback(() => {
    const sim = useLocalServerStore.getState().sim;
    useLocalServerStore.setState({ sim: simulatorActions.runReminderPass(sim) });
  }, []);

  return { createReservation, updateReservationStatus, cancelGuestReservation, runReminderPass };
}

export function useOwnerActions() {
  const toggleRemote = useToggleItemAvailable();
  const updateRemote = useUpdateSettings();
  const upsertRemote = useUpsertMenuItem();
  const toggleLocal = useLocalServerStore((s) => s.toggleItemAvailableLocal);
  const updateLocal = useLocalServerStore((s) => s.updateSettingsLocal);
  const updateMenuLocal = useLocalServerStore((s) => s.updateMenuItemLocal);
  const addPromoLocal = useLocalServerStore((s) => s.addPromoLocal);
  const togglePromoLocal = useLocalServerStore((s) => s.togglePromoLocal);

  const toggleItemAvailable = useCallback(
    async (itemId: string) => {
      if (!isLocalFallbackMode()) await toggleRemote.mutateAsync(itemId);
      else toggleLocal(itemId);
    },
    [toggleRemote, toggleLocal]
  );

  const updateSettings = useCallback(
    async (patch: Partial<RestaurantSettings>) => {
      if (!isLocalFallbackMode()) await updateRemote.mutateAsync(patch);
      else updateLocal(patch);
    },
    [updateRemote, updateLocal]
  );

  const updateMenuItem = useCallback(
    async (item: MenuItem) => {
      if (!isLocalFallbackMode()) await upsertRemote.mutateAsync(item);
      else updateMenuLocal(item);
    },
    [upsertRemote, updateMenuLocal]
  );

  return { toggleItemAvailable, updateSettings, updateMenuItem, addPromoLocal, togglePromoLocal };
}
