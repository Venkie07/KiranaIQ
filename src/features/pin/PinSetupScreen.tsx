import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { PinPad } from './PinPad';
import { pinService, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/services/pin/pinService';
import { useLock } from '@/hooks/useLock';

type Step = 'intro' | 'enter' | 'confirm' | 'done';

/**
 * First-run optional PIN setup.
 * - Skip is always available (core app works without a PIN).
 * - PIN activates only when both entries match.
 * - Explains what the PIN does and does NOT protect.
 */
export function PinSetupScreen() {
  const { t } = useTranslation();
  const { unlock, skipSetup, refresh } = useLock();
  const [step, setStep] = useState<Step>('intro');
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setFirst('');
    setEntry('');
    setError(null);
    setStep('enter');
  };

  const onEntryChange = (value: string) => {
    setError(null);
    setEntry(value);
  };

  const submit = async () => {
    if (busy) return;
    if (entry.length < PIN_MIN_LENGTH || entry.length > PIN_MAX_LENGTH) {
      setError(t('validation.pinFormat'));
      return;
    }
    if (step === 'enter') {
      setFirst(entry);
      setEntry('');
      setStep('confirm');
      return;
    }
    // step === 'confirm'
    if (entry !== first) {
      setError(t('privacy.pinMismatch'));
      setEntry('');
      setFirst('');
      setStep('enter');
      return;
    }
    setBusy(true);
    try {
      await pinService.setup(entry);
      await refresh();
      setStep('done');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="pin-screen">
        <ShieldCheck size={56} color="var(--color-success)" aria-hidden="true" />
        <h1>{t('privacy.pinEnabled')}</h1>
        <p className="muted text-sm">{t('privacy.pinStoredNote')}</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={unlock}>
          {t('common.continue')}
        </button>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="pin-screen">
        <ShieldCheck size={56} color="var(--color-primary)" aria-hidden="true" />
        <h1>{t('privacy.pinSetupTitle')}</h1>
        <p className="muted text-sm" style={{ maxWidth: 420 }}>
          {t('privacy.pinSetupBody')}
        </p>
        <div className="alert alert--info" style={{ textAlign: 'left', maxWidth: 440 }}>
          <span>{t('privacy.pinWhatItDoes')}</span>
        </div>
        <div className="stack full-width" style={{ maxWidth: 440, gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={start}>
            {t('privacy.pinSetupEnable')}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => {
              skipSetup();
            }}
          >
            {t('privacy.pinSetupSkip')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-screen">
      <h1>{step === 'enter' ? t('privacy.pinEnterNew') : t('privacy.pinConfirmNew')}</h1>
      <p className="muted text-sm">
        {step === 'enter'
          ? `${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} · ${t('privacy.pinStoredNote')}`
          : t('privacy.pinConfirmNew')}
      </p>
      <PinPad
        value={entry}
        onChange={onEntryChange}
        maxLength={PIN_MAX_LENGTH}
        error={error}
        disabled={busy}
      />
      <div className="stack full-width" style={{ maxWidth: 400, gap: 'var(--space-3)' }}>
        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={submit}
          disabled={busy || entry.length < PIN_MIN_LENGTH}
        >
          {busy ? t('common.loading') : step === 'enter' ? t('common.next') : t('common.save')}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            if (step === 'confirm') {
              setStep('enter');
              setFirst('');
              setEntry('');
              setError(null);
            } else {
              skipSetup();
            }
          }}
          disabled={busy}
        >
          {step === 'confirm' ? t('common.back') : t('privacy.pinSetupSkip')}
        </button>
      </div>
    </div>
  );
}

export default PinSetupScreen;
