import { useCallback, useEffect, useState } from 'react';

/**
 * Service worker update flow (registerType: 'prompt').
 *
 * Registers the SW only in production (tests/dev skip it) and exposes a
 * "new version ready" state so the UI can ask the user before reloading.
 * Users are never force-refreshed mid-transaction.
 */
export function useServiceWorkerUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [updateFailed, setUpdateFailed] = useState(false);

  const register = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const { registerSW } = await import('virtual:pwa-register');
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setUpdateReady(true);
          setApplyUpdate(() => () => {
            void updateSW(true);
          });
        },
        onRegisterError(error: unknown) {
          // eslint-disable-next-line no-console
          console.warn('[pwa] SW registration failed', error);
          setUpdateFailed(true);
        },
      });
    } catch (err) {
      // Offline/dev environments may lack the virtual module bundle.
      // eslint-disable-next-line no-console
      console.warn('[pwa] registerSW unavailable', err);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    void register();
  }, [register]);

  return { updateReady, applyUpdate, updateFailed };
}
