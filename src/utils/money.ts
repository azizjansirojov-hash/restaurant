/** Format whole UZS som with locale-appropriate unit label and space thousands separator. */
let activeLocale: 'uz' | 'ru' = 'uz';

export function setMoneyLocale(locale: 'uz' | 'ru'): void {
  activeLocale = locale;
}

export function formatSom(som: number, locale?: 'uz' | 'ru'): string {
  const lang = locale ?? activeLocale;
  const rounded = Math.round(som);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const unit = lang === 'ru' ? 'сум' : "so'm";
  return `${formatted} ${unit}`;
}

export function calcTax(subtotalAfterDiscount: number, taxRatePercent: number): number {
  return Math.round(subtotalAfterDiscount * (taxRatePercent / 100));
}

export function calcTip(subtotalAfterDiscount: number, tipPercent: number): number {
  return Math.round(subtotalAfterDiscount * (tipPercent / 100));
}
