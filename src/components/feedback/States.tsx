import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/** Initial loading state with spinner + text. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="state-box" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label ?? t('states.loading')}</p>
    </div>
  );
}

/** Empty state with icon, title, optional body and action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="state-box">
      <div className="state-box__icon" aria-hidden="true">
        <Inbox size={26} />
      </div>
      <h2>{title || t('states.emptyTitle')}</h2>
      {body ? <p className="text-sm">{body}</p> : null}
      {action}
    </div>
  );
}

/**
 * Recoverable error state with a retry button.
 * `errorKey` is an i18n key (services throw i18n keys, not raw messages).
 */
export function ErrorState({
  errorKey,
  detail,
  onRetry,
}: {
  errorKey?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const message = errorKey ? t(errorKey) : t('states.errorTitle');
  return (
    <div className="state-box" role="alert">
      <div
        className="state-box__icon"
        aria-hidden="true"
        style={{ color: 'var(--color-danger)' }}
      >
        <AlertTriangle size={26} />
      </div>
      <h2>{t('states.errorTitle')}</h2>
      <p className="text-sm">{detail ?? message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          <RefreshCw size={18} aria-hidden="true" />
          {t('states.retry')}
        </button>
      ) : null}
    </div>
  );
}

/** Skeleton placeholder row for list loading. */
export function SkeletonRow() {
  return (
    <div className="list-row" aria-hidden="true">
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
      <div className="list-row__main">
        <div className="skeleton" style={{ width: '55%', height: 16, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '35%', height: 12 }} />
      </div>
      <div className="skeleton" style={{ width: 56, height: 32 }} />
    </div>
  );
}
