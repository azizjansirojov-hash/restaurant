export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function calcTax(subtotalAfterDiscount: number, taxRatePercent: number): number {
  return Math.round(subtotalAfterDiscount * (taxRatePercent / 100));
}

export function calcTip(subtotalAfterDiscount: number, tipPercent: number): number {
  return Math.round(subtotalAfterDiscount * (tipPercent / 100));
}
