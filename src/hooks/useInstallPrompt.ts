import { useCallback, useEffect, useState } from 'react';

/**
 * Captures the browser `beforeinstallprompt` event.
 *
 * Notes:
 * - The event is not available in every browser (Safari iOS, Firefox…).
 *   `promptAvailable=false` there → the UI shows manual instructions.
 * - `prompt()` is only invoked after an explicit user click.
 * - A dismissed prompt is recorded so we don't pester the user again.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'kiranaiq.installDismissed';

export type InstallState =
  | 'unsupported' // browser never fires the event → manual help only
  | 'available' // event captured, button can show
  | 'accepted'
  | 'dismissed'
  | 'unavailable'; // standalone or already installed

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>('unsupported');
  const [error, setError] = useState<string | null>(null);

  // Detect standalone display mode.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true);

  useEffect(() => {
    if (isStandalone) {
      setState('unavailable');
      return;
    }
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setState(dismissed ? 'dismissed' : 'available');
    };
    const installed = () => {
      setDeferred(null);
      setState('unavailable');
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, [isStandalone]);

  const promptInstall = useCallback(async () => {
    if (!deferred) {
      setError('errors.installFailed');
      return;
    }
    setError(null);
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setState('accepted');
    } else {
      setState('dismissed');
      try {
        // Remember dismissal: show manual instructions instead of nagging.
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
      setDeferred(null);
    }
  }, [deferred]);

  return { state, isStandalone, promptInstall, error };
}
