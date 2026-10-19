/**
 * Date helpers.
 *
 * - Timestamps are ISO-8601 UTC strings.
 * - Calendar dates (expiry) are `YYYY-MM-DD` strings based on the *device*
 *   date. Production deployments that must be timezone-correct across
 *   regions should store expiry with an explicit timezone (documented in
 *   docs/DATA_MODEL.md).
 */

export function todayISODate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(fromISODate: string, toISODate: string): number {
  const from = Date.parse(`${fromISODate.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toISODate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function daysUntilExpiry(expiryDate: string, now = new Date()): number {
  return daysBetween(todayISODate(now), expiryDate);
}

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
};

export function formatDate(iso: string, language = 'en'): string {
  const locale = LOCALE_BY_LANGUAGE[language] ?? 'en-IN';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string, language = 'en'): string {
  const locale = LOCALE_BY_LANGUAGE[language] ?? 'en-IN';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return iso;
  }
}

/** Weekday + date for the dashboard greeting line. */
export function formatLongDate(iso: string, language = 'en'): string {
  const locale = LOCALE_BY_LANGUAGE[language] ?? 'en-IN';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}
