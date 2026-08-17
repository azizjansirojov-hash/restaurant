import type { RestaurantSettings } from '../types';

export function pointsToNextBlock(balance: number, block: number): number {
  if (block <= 0) return 0;
  const remainder = balance % block;
  return remainder === 0 && balance > 0 ? block : block - remainder;
}

export function maxRedeemableBlocks(
  balance: number,
  block: number,
  subtotalSom: number,
  redeemValueSom: number
): number {
  const byBalance = Math.floor(balance / block);
  const bySubtotal = Math.floor(subtotalSom / redeemValueSom);
  return Math.max(0, Math.min(byBalance, bySubtotal));
}

/** Earn points from eligible subtotal (whole som, no fractional units). */
export function earnPoints(
  subtotalSom: number,
  discountSom: number,
  settings: RestaurantSettings
): number {
  const eligible = Math.max(0, subtotalSom - discountSom);
  return Math.floor(eligible / 1000) * settings.loyaltyEarnPerSom;
}
