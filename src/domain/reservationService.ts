import type { Reservation, ReservationStatus, RestaurantSettings, User } from '../types';
import { isPeakSlot } from '../utils/reservations';

export interface ReservationDomainState {
  reservations: Reservation[];
}

export function slotKey(slotStart: Date): string {
  return `${slotStart.getFullYear()}-${slotStart.getMonth()}-${slotStart.getDate()}-${slotStart.getHours()}-${slotStart.getMinutes()}`;
}

export function countActiveForSlot(reservations: Reservation[], slotStart: Date): number {
  const key = slotKey(slotStart);
  return reservations.filter((r) => {
    if (r.status === 'cancelled' || r.status === 'no_show') return false;
    return slotKey(new Date(r.slotStart)) === key;
  }).length;
}

export function createReservationDomain(
  partySize: number,
  slotStart: Date,
  user: User | null,
  settings: RestaurantSettings,
  state: ReservationDomainState,
  reservationId: string,
  createdAt: string
): {
  ok: boolean;
  error?: string;
  reservation?: Reservation;
  requiresDeposit?: boolean;
} {
  if (!user || user.role !== 'guest') {
    return { ok: false, error: 'Sign in as a guest to reserve.' };
  }
  if (partySize < 1 || partySize > 8) {
    return { ok: false, error: 'Party size must be 1–8.' };
  }

  const taken = countActiveForSlot(state.reservations, slotStart);
  if (taken >= settings.slotCapacity) {
    return { ok: false, error: 'That slot is full.' };
  }

  const peak = isPeakSlot(slotStart);
  const needsDeposit = settings.peakDepositEnabled && peak;

  const reservation: Reservation = {
    id: reservationId,
    userId: user.id,
    partySize,
    slotStart: slotStart.toISOString(),
    status: 'booked',
    depositHoldSom: needsDeposit ? settings.peakDepositSom : undefined,
    depositForfeited: false,
    createdAt,
  };

  return { ok: true, reservation, requiresDeposit: needsDeposit };
}

export function updateReservationStatusDomain(
  id: string,
  status: ReservationStatus,
  state: ReservationDomainState
): { ok: boolean; error?: string; reservation?: Reservation; notify?: { title: string; body: string } } {
  const res = state.reservations.find((r) => r.id === id);
  if (!res) return { ok: false, error: 'Reservation not found.' };

  let depositForfeited = res.depositForfeited;
  if (status === 'no_show' && res.depositHoldSom) {
    depositForfeited = true;
  }
  if (status === 'seated' || status === 'cancelled') {
    depositForfeited = false;
  }

  let notify: { title: string; body: string } | undefined;
  if (status === 'reminded') {
    notify = { title: 'See you at Lale in 2 hours', body: 'Your table is waiting.' };
  }

  return {
    ok: true,
    reservation: { ...res, status, depositForfeited },
    notify,
  };
}

export function cancelGuestReservationDomain(
  id: string,
  user: User | null,
  state: ReservationDomainState
): { ok: boolean; error?: string; reservation?: Reservation } {
  const res = state.reservations.find((r) => r.id === id);
  if (!res || !user || res.userId !== user.id) {
    return { ok: false, error: 'Reservation not found.' };
  }
  const slot = new Date(res.slotStart);
  const hoursUntil = (slot.getTime() - Date.now()) / (1000 * 60 * 60);
  return {
    ok: true,
    reservation: {
      ...res,
      status: 'cancelled',
      depositForfeited: hoursUntil < 2 && !!res.depositHoldSom ? true : false,
    },
  };
}

export function runReminderPassDomain(
  state: ReservationDomainState,
  now: number
): { id: string; reservation: Reservation; notify: { title: string; body: string } }[] {
  const twoHours = 2 * 60 * 60 * 1000;
  const results: { id: string; reservation: Reservation; notify: { title: string; body: string } }[] = [];

  state.reservations.forEach((r) => {
    if (r.status !== 'booked') return;
    const start = new Date(r.slotStart).getTime();
    const delta = start - now;
    if (delta <= twoHours && delta > 0) {
      const updated = updateReservationStatusDomain(r.id, 'reminded', state);
      if (updated.ok && updated.reservation && updated.notify) {
        results.push({ id: r.id, reservation: updated.reservation, notify: updated.notify });
      }
    }
  });

  return results;
}
