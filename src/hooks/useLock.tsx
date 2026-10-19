import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { pinService } from '@/services/pin/pinService';
import type { LockPolicy } from '@/domain/types';

/**
 * App lock state (separate from inventory/transaction state by design).
 *
 * Triggers for locking:
 *  1. Explicit "Lock app now".
 *  2. Configurable inactivity timeout (immediate / 1 / 5 / 15 min).
 *  3. App reopened after being backgrounded beyond the same policy.
 *
 * The lock state lives in memory only: a full page reload with PIN enabled
 * starts locked again. Users actively interacting never see the PIN screen
 * (activity resets the inactivity timer).
 */

export type LockPhase = 'checking' | 'unlocked' | 'locked' | 'setup';

interface LockContextValue {
  phase: LockPhase;
  policy: LockPolicy;
  setPolicy: (policy: LockPolicy) => void;
  /** Called after a successful unlock (or after setup completes). */
  unlock: () => void;
  lock: () => void;
  /** Ask for setup screen on next launch (first-run optional PIN). */
  startSetup: () => void;
  skipSetup: () => void;
  /** Re-read PIN status (after enable/disable from Settings). */
  refresh: () => Promise<void>;
}

const LockContext = createContext<LockContextValue | null>(null);

const SETUP_SEEN_KEY = 'kiranaiq.pinSetupSeen';

const POLICY_MS: Record<LockPolicy, number> = {
  immediate: 0,
  'minute-1': 60_000,
  'minute-5': 300_000,
  'minute-15': 900_000,
};

export function LockProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<LockPhase>('checking');
  const [policy, setPolicyState] = useState<LockPolicy>('minute-5');
  const lastActivity = useRef(Date.now());
  const lockedRef = useRef(false);
  const visibleRef = useRef(true);

  const refresh = useCallback(async () => {
    const enabled = await syncPinCache();
    if (!enabled) {
      // No PIN: never block. Also remember setup was offered once.
      let seen = false;
      try {
        seen = localStorage.getItem(SETUP_SEEN_KEY) === '1';
      } catch {
        seen = true; // no storage → don't nag every launch
      }
      setPhase(seen ? 'unlocked' : 'setup');
      return;
    }
    setPhase((prev) => (prev === 'unlocked' ? 'unlocked' : 'locked'));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lock = useCallback(() => {
    lockedRef.current = true;
    pinService.resetAttempts();
    setPhase('locked');
  }, []);

  const unlock = useCallback(() => {
    lockedRef.current = false;
    lastActivity.current = Date.now();
    setPhase('unlocked');
    void syncPinCache();
  }, []);

  const startSetup = useCallback(() => setPhase('setup'), []);

  const skipSetup = useCallback(() => {
    try {
      localStorage.setItem(SETUP_SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setPhase('unlocked');
  }, []);

  const setPolicy = useCallback((next: LockPolicy) => setPolicyState(next), []);

  // Activity tracking + lock checks.
  useEffect(() => {
    if (phase === 'checking' || phase === 'setup') return;

    const markActivity = () => {
      lastActivity.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const ev of events) window.addEventListener(ev, markActivity, { passive: true });

    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      if (!hidden && visibleRef.current) {
        // Reopened after backgrounding: apply the same policy.
        const limit = POLICY_MS[policy];
        if (lockedRef.current || Date.now() - lastActivity.current >= limit) {
          if (pinServiceLocks()) lock();
        }
        lastActivity.current = Date.now();
      }
      visibleRef.current = !hidden;
      if (hidden && policy === 'immediate' && pinServiceLocks()) lock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      if (phase !== 'unlocked') return;
      if (!pinServiceLocks()) return;
      if (Date.now() - lastActivity.current >= POLICY_MS[policy]) lock();
    }, 5_000);

    return () => {
      for (const ev of events) window.removeEventListener(ev, markActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [phase, policy, lock]);

  const value = useMemo<LockContextValue>(
    () => ({ phase, policy, setPolicy, unlock, lock, startSetup, skipSetup, refresh }),
    [phase, policy, setPolicy, unlock, lock, startSetup, skipSetup, refresh],
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

/**
 * Sync check backed by a cache refreshed whenever `refresh()` runs.
 * Returns true only when a PIN credential exists.
 */
function pinServiceLocks(): boolean {
  return pinEnabledCache;
}

/** Cache maintained by refresh()/status reads. */
let pinEnabledCache = false;

export async function syncPinCache(): Promise<boolean> {
  const status = await pinService.status();
  pinEnabledCache = status.enabled;
  return status.enabled;
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}
