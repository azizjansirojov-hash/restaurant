import type { LoyaltyLedgerEntry, MenuItem, Order, Reservation } from '../types';

export function dayAnalytics(
  orders: Order[],
  reservations: Reservation[],
  loyaltyLedger: LoyaltyLedgerEntry[],
  menuItems: MenuItem[],
  day: Date = new Date()
) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);

  const dayOrders = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime() && o.status !== 'cancelled';
  });
  const completed = dayOrders.filter(
    (o) =>
      o.status === 'completed' ||
      o.status === 'ready' ||
      o.status === 'preparing' ||
      o.status === 'received'
  );
  const gmv = completed.reduce((s, o) => s + o.totalCents, 0);
  const tips = completed.reduce((s, o) => s + o.tipCents, 0);
  const withUpsell = completed.filter((o) =>
    o.items.some((it) => {
      const menu = menuItems.find((m) => m.id === it.menuItemId);
      return menu?.upsellTags.includes('complete_the_table');
    })
  ).length;

  const dayRes = reservations.filter((r) => {
    const t = new Date(r.slotStart).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
  const closedRes = dayRes.filter((r) => r.status === 'seated' || r.status === 'no_show');
  const noShows = dayRes.filter((r) => r.status === 'no_show').length;

  const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const guestCompleted = orders.filter(
    (o) => o.status === 'completed' && new Date(o.createdAt).getTime() >= thirtyAgo
  );
  const counts = new Map<string, number>();
  guestCompleted.forEach((o) => counts.set(o.userId, (counts.get(o.userId) || 0) + 1));
  const guests = counts.size || 1;
  const repeaters = [...counts.values()].filter((n) => n >= 2).length;

  const dayLedger = loyaltyLedger.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  return {
    ordersCount: completed.length,
    gmvCents: gmv,
    aovCents: completed.length ? Math.round(gmv / completed.length) : 0,
    tipTotalCents: tips,
    upsellAttachRate: completed.length ? withUpsell / completed.length : 0,
    noShowRate: closedRes.length
      ? noShows / closedRes.length
      : dayRes.length
        ? noShows / dayRes.length
        : 0,
    loyaltyEarned: dayLedger.filter((l) => l.reason === 'earn').reduce((s, l) => s + l.deltaPoints, 0),
    loyaltyRedeemed: Math.abs(
      dayLedger.filter((l) => l.reason === 'redeem').reduce((s, l) => s + l.deltaPoints, 0)
    ),
    repeatRate: repeaters / guests,
  };
}
