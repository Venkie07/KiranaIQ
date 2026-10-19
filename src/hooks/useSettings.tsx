import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, Language, ThemePreference } from '@/domain/types';
import { getServices } from '@/services/serviceFactory';
import { changeLanguage } from '@/i18n';
import { DEFAULT_SETTINGS } from '@/db/database';

const THEME_STORAGE_KEY = 'kiranaiq.themePreference';

export interface SettingsContextValue {
  settings: AppSettings;
  /** True while the first settings load is in flight. */
  loading: boolean;
  loadError: string | null;
  updateSettings: (patch: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>) => Promise<void>;
  retry: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    root.dataset.theme = dark ? 'dark' : 'light';
  } else {
    root.dataset.theme = preference;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage unavailable (private mode) — theme still applies for this session */
  }
}

export function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    theme: readStoredTheme(),
  }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // Initial load from the local database.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getServices()
      .settings.get()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        applyTheme(loaded.theme);
        void changeLanguage(loaded.language);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[settings] load failed', err);
        setLoadError('errors.dbInit');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // Follow OS theme when preference = system.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const updateSettings = useCallback(
    async (patch: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>) => {
      const next = await getServices().settings.update(patch);
      setSettings(next);
      if (patch.theme) applyTheme(next.theme);
      if (patch.language) await changeLanguage(next.language as Language);
    },
    [],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, loadError, updateSettings, retry }),
    [settings, loading, loadError, updateSettings, retry],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
