import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExpiryBadge, PageHeader } from '@/components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatDate } from '@/domain/dates';
import type { ExpiryAlert } from '@/domain/types';

const WINDOW_CHOICES = [7, 14, 30, 60, 90];

function AlertRow({ a }: { a: ExpiryAlert }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  return (
    <div className="list-row">
      <div className="list-row__main">
        <div className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
          {a.productName} <span className="muted">({a.variantName})</span>
        </div>
        <div className="list-row__meta">
          {a.batchCode ? `${a.batchCode} · ` : ''}
          {formatDate(a.expiryDate, settings.language)} ·{' '}
          {a.daysUntilExpiry < 0
            ? t('expiry.expiredDaysAgo', { days: Math.abs(a.daysUntilExpiry) })
            : a.daysUntilExpiry === 0
              ? t('expiry.expiresToday')
              : t('expiry.daysLeft', { days: a.daysUntilExpiry })}
        </div>
      </div>
      <div className="list-row__end">
        <span className="badge badge--neutral">
          {t('expiry.quantityLeft', { count: a.quantity })}
        </span>
        <ExpiryBadge risk={a.risk} />
      </div>
    </div>
  );
}

function Group({ title, items }: { title: string; items: ExpiryAlert[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card section" aria-label={title}>
      <h2 className="card__title">
        {title} <span className="badge badge--neutral">{items.length}</span>
      </h2>
      <div className="stack">
        {items.map((a) => <AlertRow key={a.batchId} a={a} />)}
      </div>
    </section>
  );
}

export function ExpiryScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [alerts, setAlerts] = useState<ExpiryAlert[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [savingWindow, setSavingWindow] = useState(false);

  const load = useCallback(() => {
    setErrorKey(null);
    setAlerts(null);
    getServices()
      .alerts.expiry(settings.expiryWarningDays)
      .then(setAlerts)
      .catch((err: unknown) => {
        console.error('[expiry] load failed', err);
        setErrorKey('errors.dbInit');
      });
  }, [settings.expiryWarningDays]);

  useEffect(load, [load]);

  const changeWindow = async (days: number) => {
    if (savingWindow) return;
    setSavingWindow(true);
    try { await updateSettings({ expiryWarningDays: days }); }
    finally { setSavingWindow(false); }
  };

  const expired = alerts?.filter((a) => a.risk === 'expired') ?? [];
  const soon = alerts?.filter((a) => a.risk === 'critical' || a.risk === 'warning') ?? [];
  const upcoming = alerts?.filter((a) => a.risk === 'upcoming') ?? [];

  if (errorKey) return <ErrorState errorKey={errorKey} onRetry={load} />;
  if (!alerts) return <LoadingState />;

  return (
    <>
      <PageHeader
        title={t('expiry.title')}
        actions={
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span className="text-sm muted">{t('expiry.warningWindowLabel')}</span>
            <select
              className="select"
              value={settings.expiryWarningDays}
              onChange={(e) => changeWindow(Number(e.target.value))}
              disabled={savingWindow}
            >
              {WINDOW_CHOICES.map((d) => (
                <option key={d} value={d}>{d} {t('slowMoving.daysUnit')}</option>
              ))}
            </select>
          </div>
        }
      />

      {expired.length > 0 && <Group title={t('expiry.expired')} items={expired} />}
      {soon.length > 0 && <Group title={t('expiry.expiringSoon')} items={soon} />}
      {upcoming.length > 0 && <Group title={t('expiry.upcoming')} items={upcoming} />}
      {expired.length === 0 && soon.length === 0 && upcoming.length === 0 && (
        <EmptyState title={t('expiry.empty')} />
      )}
    </>
  );
}
export default ExpiryScreen;