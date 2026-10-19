import { useEffect, useState } from 'react';
import { Delete, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  /** Error text shown under the dots. */
  error?: string | null;
  /** Wait countdown (seconds) while attempt lockout is active. */
  waitSeconds?: number;
}

/**
 * Numeric keypad + masked dot display for PIN entry.
 * - Large 72×64 keys, keyboard input supported (numbers, Backspace, Enter).
 * - Digits masked by default; optional show/hide toggle for correction.
 * - aria-live errors; no PIN digits are ever placed in the URL or logs.
 */
export function PinPad({
  value,
  onChange,
  maxLength,
  disabled,
  error,
  waitSeconds = 0,
}: PinPadProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const locked = waitSeconds > 0;

  const push = (digit: string) => {
    if (disabled || locked) return;
    if (value.length >= maxLength) return;
    onChange(value + digit);
  };

  const backspace = () => {
    if (disabled || locked) return;
    onChange(value.slice(0, -1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        push(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, disabled, locked, maxLength]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

  return (
    <div className="stack" style={{ alignItems: 'center', width: '100%' }}>
      <div
        className={`pin-dots${revealed ? ' pin-dots--text' : ''}`}
        role="status"
        aria-live="polite"
        aria-label={t('privacy.pinUnlockTitle')}
      >
        {Array.from({ length: Math.max(maxLength, value.length || maxLength) }).map((_, i) => {
          const filled = i < value.length;
          return (
            <span
              key={i}
              className={`pin-dots__dot${filled ? ' pin-dots__dot--filled' : ''}`}
              style={revealed && filled ? { fontWeight: 700 } : undefined}
            >
              {revealed && filled ? value[i] : ''}
            </span>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setRevealed((r) => !r)}
        aria-pressed={revealed}
      >
        {revealed ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {revealed ? t('privacy.pinHide') : t('privacy.pinShow')}
      </button>

      <div
        className="keypad"
        role="group"
        aria-label={t('privacy.pinKeypadLabel')}
        aria-disabled={disabled || locked}
      >
        {keys.map((k, i) => {
          if (k === '') return <span key={`blank-${i}`} className="keypad__key keypad__key--blank" />;
          if (k === 'back') {
            return (
              <button
                key="back"
                type="button"
                className="keypad__key"
                onClick={backspace}
                disabled={disabled || locked || value.length === 0}
                aria-label={t('a11y.pinBackspace')}
              >
                <Delete size={24} aria-hidden="true" />
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              className="keypad__key"
              onClick={() => push(k)}
              disabled={disabled || locked}
              aria-label={k}
            >
              {k}
            </button>
          );
        })}
      </div>

      <div aria-live="assertive" className="text-sm" style={{ minHeight: 24 }}>
        {locked ? (
          <span className="field__error">{t('privacy.pinWait', { seconds: waitSeconds })}</span>
        ) : error ? (
          <span className="field__error">{error}</span>
        ) : null}
      </div>
    </div>
  );
}
