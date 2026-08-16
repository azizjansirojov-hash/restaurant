import type { RestaurantSettings } from '../types';

export function pointsToNextBlock(balance: number, block: number): number {
  if (block <= 0) return 0;
  const remainder = balance % block;
  return remainder === 0 && balance > 0 ? block : block - remainder;
}

export function maxRedeemableBlocks(
  balance: number,
  block: number,
  subtotalCents: number,
  redeemValueCents: number
): number {
  const byBalance = Math.floor(balance / block);
  const bySubtotal = Math.floor(subtotalCents / redeemValueCents);
  return Math.max(0, Math.min(byBalance, bySubtotal));
}

export function earnPoints(
  subtotalCents: number,
  discountCents: number,
  settings: RestaurantSettings
): number {
  const eligible = Math.max(0, subtotalCents - discountCents);
  return Math.floor(eligible / 100) * settings.loyaltyEarnPerDollar;
}
