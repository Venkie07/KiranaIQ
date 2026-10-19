import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog for destructive or important actions.
 * - role="dialog" + aria-modal
 * - Escape cancels, focus moves into the dialog on open
 * - Confirm button disabled while `busy` (prevents double submission)
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="dialog__title" id={titleId}>
          <span className="row" style={{ gap: 'var(--space-2)' }}>
            {danger ? <AlertTriangle size={20} aria-hidden="true" /> : null}
            {title}
          </span>
        </div>
        <div className="dialog__body">{body}</div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('common.loading') : (confirmLabel ?? t('common.confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
}
