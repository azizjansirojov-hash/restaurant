let activeLocale = 'uz-UZ';

const LOCALE_MAP: Record<string, string> = {
  uz: 'uz-UZ',
  ru: 'ru-UZ',
};

export function setFormatLocale(lang: 'uz' | 'ru'): void {
  activeLocale = LOCALE_MAP[lang] ?? 'uz-UZ';
}

function resolveLocale(): string {
  return activeLocale;
}

export function formatTime(d: Date, timezone?: string): string {
  return d.toLocaleTimeString(resolveLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export function formatDate(d: Date, timezone?: string): string {
  return d.toLocaleDateString(resolveLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export function formatDateTime(d: Date, timezone?: string): string {
  return d.toLocaleString(resolveLocale(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(resolveLocale(), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}
