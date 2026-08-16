import type { DayHours, Reservation, RestaurantSettings } from '../types';

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map(Number);
  return { h, m };
}

export function isPeakSlot(slotStart: Date): boolean {
  const day = slotStart.getDay(); // 5=Fri, 6=Sat
  const hour = slotStart.getHours();
  const isFriSat = day === 5 || day === 6;
  return isFriSat && hour >= 17 && hour < 21;
}

export function getHoursForDate(settings: RestaurantSettings, date: Date): DayHours | undefined {
  return settings.hours.find((h) => h.day === date.getDay());
}

export function generateSlots(
  settings: RestaurantSettings,
  date: Date,
  reservations: Reservation[]
): { slotStart: Date; remaining: number }[] {
  const hours = getHoursForDate(settings, date);
  if (!hours || hours.closed) return [];

  const open = parseHm(hours.open);
  const close = parseHm(hours.close);
  const slots: { slotStart: Date; remaining: number }[] = [];

  const cursor = new Date(date);
  cursor.setHours(open.h, open.m, 0, 0);
  const end = new Date(date);
  end.setHours(close.h, close.m, 0, 0);

  const now = new Date();

  while (cursor < end) {
    if (cursor > now) {
      const localKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}-${cursor.getHours()}-${cursor.getMinutes()}`;
      const takenLocal = reservations.filter((r) => {
        if (r.status === 'cancelled' || r.status === 'no_show') return false;
        const d = new Date(r.slotStart);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        return key === localKey;
      }).length;

      slots.push({
        slotStart: new Date(cursor),
        remaining: Math.max(0, settings.slotCapacity - takenLocal),
      });
    }
    cursor.setMinutes(cursor.getMinutes() + 15);
  }

  return slots;
}

export function formatSlotLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
