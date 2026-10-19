import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock } from 'lucide-react';
import { PinPad } from './PinPad';
import { pinService, PIN_MAX_LENGTH } from '@/services/pin/pinService';
import { useLock } from '@/hooks/useLock';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

/**
 * PIN unlock gate shown before any dashboard/business data.
 * - Wrong PIN → clear message, never reveals the correct PIN.
 * - Repeated failures → increasing delay with visible countdown.
 * - "Forgot PIN" recovery explains consequences BEFORE resetting, and
 *   business data is explicitly preserved.
 */
export function PinUnlockScreen() {
  const { t } = useTranslation();
  const { unlock, refresh } = useLock();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  // Countdown ticker for the attempt lockout.
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const id = window.setInterval(() => {
      const remaining = Math.ceil(pinService.remainingLockoutMs() / 1000);
      setWaitSeconds(remaining);
      if (remaining <= 0) window.clearInterval(id);
    }, 300);
    return () => window.clearInterval(id);
  }, [waitSeconds]);

  const submit = async () => {
    if (busy || waitSeconds > 0) return;
    setBusy(true);
    try {
      const ok = await pinService.verify(entry);
      if (ok) {
        setError(null);
        unlock();
        return;
      }
      const remaining = Math.ceil(pinService.remainingLockoutMs() / 1000);
      setEntry('');
      if (remaining > 0) {
        setError(null);
        setWaitSeconds(remaining);
      } else {
        setError(t('privacy.pinWrong'));
      }
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (resetBusy) return;
    setResetBusy(true);
    try {
      await pinService.resetForgotten();
      await refresh();
      unlock();
    } finally {
      setResetBusy(false);
      setResetOpen(false);
    }
  };

  return (
    <div className="pin-screen">
      <Lock size={48} color="var(--color-primary)" aria-hidden="true" />
      <h1>{t('privacy.pinUnlockTitle')}</h1>
      <p className="muted text-sm">{t('privacy.pinUnlockBody')}</p>

      <PinPad
        value={entry}
        onChange={(v) => {
          setEntry(v);
          setError(null);
        }}
        maxLength={PIN_MAX_LENGTH}
        error={error}
        waitSeconds={waitSeconds}
        disabled={busy}
      />

      <button
        type="button"
        className="btn btn--primary btn--lg"
        onClick={submit}
        disabled={busy || entry.length < 4 || waitSeconds > 0}
        style={{ maxWidth: 360, width: '100%' }}
      >
        <KeyRound size={20} aria-hidden="true" />
        {busy ? t('common.loading') : t('privacy.pinUnlockTitle')}
      </button>

      <button type="button" className="btn btn--ghost" onClick={() => setResetOpen(true)}>
        {t('privacy.pinForgot')}
      </button>

      <ConfirmDialog
        open={resetOpen}
        danger
        title={t('privacy.pinResetTitle')}
        body={
          <div className="stack stack--tight">
            <p>{t('privacy.pinResetBody')}</p>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="pin-reset-ack"
                checked={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.checked)}
              />
              <label htmlFor="pin-reset-ack">{t('privacy.pinResetConfirm')}</label>
            </div>
          </div>
        }
        confirmLabel={t('privacy.pinResetConfirm')}
        busy={resetBusy}
        onConfirm={() => {
          if (resetConfirm) void doReset();
        }}
        onCancel={() => {
          setResetOpen(false);
          setResetConfirm(false);
        }}
      />
    </div>
  );
}

export default PinUnlockScreen;
