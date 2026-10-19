import { ReactNode, useEffect, Suspense, lazy } from 'react';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { ToastProvider } from '@/hooks/useToast';
import { LockProvider, useLock } from '@/hooks/useLock';
import { getServices } from '@/services/serviceFactory';
import { initI18n } from '@/i18n';
import { syncPinCache } from '@/hooks/useLock';

const PinSetupScreen = lazy(() => import('@/features/pin/PinSetupScreen'));
const PinUnlockScreen = lazy(() => import('@/features/pin/PinUnlockScreen'));

export function ServicesProvider({ children }: { children: ReactNode }) {
  getServices(); // Initialize services singleton
  return <>{children}</>;
}

function InitGate({ children }: { children: ReactNode }) {
  const { settings, loading, loadError, retry } = useSettings();
  const { phase, refresh } = useLock();

  useEffect(() => {
    if (!loading && !loadError) {
      void initI18n(settings.language);
      void syncPinCache();
      void refresh();
    }
  }, [loading, loadError, settings.language, refresh]);

  if (loading) return <div className="state-box" role="status">Initializing…</div>;
  if (loadError) {
    return (
      <div className="card stack" style={{ maxWidth: 400, margin: 'var(--space-6) auto' }}>
        <p>{loadError}</p>
        <button className="btn btn--primary" onClick={retry}>Retry</button>
      </div>
    );
  }
  if (phase === 'checking') return <div className="state-box" role="status">Checking app lock…</div>;

  return <>{children}</>;
}

function PinGate({ children }: { children: ReactNode }) {
  const { phase } = useLock();
  if (phase === 'setup') {
    return (
      <Suspense fallback={<div className="state-box" role="status">Loading…</div>}>
        <PinSetupScreen />
      </Suspense>
    );
  }
  if (phase === 'locked') {
    return (
      <Suspense fallback={<div className="state-box" role="status">Loading…</div>}>
        <PinUnlockScreen />
      </Suspense>
    );
  }
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <LockProvider>
          <InitGate>
            <PinGate>
              <ServicesProvider>{children}</ServicesProvider>
            </PinGate>
          </InitGate>
        </LockProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}