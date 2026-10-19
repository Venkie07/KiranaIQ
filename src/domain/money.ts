/**
 * Money helpers. All money values are integer paise.
 */

export const PAISE_PER_RUPEE = 100;

/** Convert rupees (display input) to paise, rounding half away from zero. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Convert paise to rupees for display maths only. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
};

export function localeFor(language: string): string {
  return LOCALE_BY_LANGUAGE[language] ?? 'en-IN';
}

/** Format paise as ₹1,234.50 using the given UI language locale. */
export function formatMoney(paise: number, language = 'en'): string {
  const locale = localeFor(language);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: paise % PAISE_PER_RUPEE === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(paiseToRupees(paise));
  } catch {
    return `₹${paiseToRupees(paise).toFixed(2)}`;
  }
}

/** Safe integer addition of paise amounts. */
export function sumPaise(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.round(v), 0);
}
