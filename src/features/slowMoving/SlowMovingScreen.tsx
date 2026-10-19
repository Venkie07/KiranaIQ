import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/Badges';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatDate } from '@/domain/dates';
import type { SlowMovingProduct } from '@/domain/types';

const WINDOW_CHOICES = [7, 14, 30, 60, 90];

export function SlowMovingScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [items, setItems] = useState<SlowMovingProduct[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(settings.slowMovingDays);
  const [savingWindow, setSavingWindow] = useState(false);

  const load = useCallback(() => {
    setErrorKey(null);
    setItems(null);
    getServices()
      .alerts.slowMoving(windowDays)
      .then(setItems)
      .catch((err: unknown) => {
        console.error('[slowMoving] load failed', err);
        setErrorKey('errors.dbInit');
      });
  }, [windowDays]);

  useEffect(load, [load]);

  const changeWindow = async (days: number) => {
    if (savingWindow) return;
    setSavingWindow(true);
    try { await updateSettings({ slowMovingDays: days }); setWindowDays(days); }
    finally { setSavingWindow(false); }
  };

  const flagged = items?.filter((i) => i.reason === 'no-recent-sales') ?? [];
  const newProducts = items?.filter((i) => i.reason === 'no-sales-history') ?? [];

  if (errorKey) return <ErrorState errorKey={errorKey} onRetry={load} />;
  if (!items) return <LoadingState />;

  return (
    <>
      <PageHeader
        title={t('slowMoving.title')}
        actions={
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span className="text-sm muted">{t('slowMoving.windowLabel')}</span>
            <select
              className="select"
              value={windowDays}
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

      {flagged.length > 0 && (
        <section className="card section" aria-label={t('slowMoving.flagged')}>
          <h2 className="card__title">
            {t('slowMoving.flagged')} <span className="badge badge--warning">{flagged.length}</span>
          </h2>
          <div className="stack">
            {flagged.map((p) => (
              <div key={p.variantId} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{p.productName} <span className="muted">({p.variantName})</span></div>
                  <div className="list-row__meta">
                    {t('slowMoving.salesInWindow')}: {p.salesCount} ·
                    {t('slowMoving.lastSale')}: {p.lastSaleAt ? formatDate(p.lastSaleAt, settings.language) : t('slowMoving.never')}
                  </div>
                </div>
                <div className="list-row__end">
                  <span className="badge badge--warning">{t('slowMoving.reasonSlow')}</span>
                  <span className="text-sm muted">{t('slowMoving.actionSuggestion')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {newProducts.length > 0 && (
        <section className="card section" aria-label={t('slowMoving.notFlagged')}>
          <h2 className="card__title">
            {t('slowMoving.notFlagged')} <span className="badge badge--neutral">{newProducts.length}</span>
          </h2>
          <div className="stack">
            {newProducts.map((p) => (
              <div key={p.variantId} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{p.productName} <span className="muted">({p.variantName})</span></div>
                  <div className="list-row__meta">
                    {t('slowMoving.salesInWindow')}: {p.salesCount} ·
                    {t('slowMoving.lastSale')}: {p.lastSaleAt ? formatDate(p.lastSaleAt, settings.language) : t('slowMoving.never')}
                  </div>
                </div>
                <div className="list-row__end">
                  <span className="badge badge--neutral">{t('slowMoving.reasonNew')}</span>
                  <span className="text-sm muted">{t('slowMoving.actionNew')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {flagged.length === 0 && newProducts.length === 0 && (
        <EmptyState title={t('slowMoving.empty')} />
      )}
    </>
  );
}
export default SlowMovingScreen;