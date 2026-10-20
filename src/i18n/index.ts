import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Language } from '@/domain/types';

import en from './locales/en/translation.json';
import ta from './locales/ta/translation.json';
import hi from './locales/hi/translation.json';
import kn from './locales/kn/translation.json';

export const SUPPORTED_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

/** Dev-time warning when a key is missing in the active language. */
function missingKeyHandler(key: string, defaultValue?: string): string {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key "${key}" (default: "${defaultValue}")`);
  }
  return key;
}

export function initI18n(language: Language): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        ta: { translation: ta },
        hi: { translation: hi },
        kn: { translation: kn },
      },
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false }, // React escapes already
      returnNull: false,
      parseMissingKeyHandler: missingKeyHandler,
      react: { useSuspense: false },
    });
  } else if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
  return i18n;
}

export async function changeLanguage(language: Language): Promise<void> {
  if (!i18n.isInitialized) initI18n(language);
  await i18n.changeLanguage(language);
}

export default i18n;
