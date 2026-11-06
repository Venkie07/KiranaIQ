import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { DemoBadge, PageHeader } from '@/components/common/Badges';
import { EmptyState, ErrorState, SkeletonRow } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatDateTime, todayISODate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Sale } from '@/domain/types';

type SaleSource = 'all' | 'demo' | 'real';

export function SalesHistoryScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<SaleSource>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(() => {
    setErrorKey(null);
    setSales(null);
    getServices()
      .sales.list()
      .then(setSales)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[sales history] load failed', err);
        setErrorKey('errors.dbInit');
      });
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!sales) return [];
    const query = search.trim().toLowerCase();
    return sales.filter((sale) => {
      if (source === 'demo' && !sale.demo) return false;
      if (source === 'real' && sale.demo) return false;

      const date = sale.createdAt.slice(0, 10);
      if (from && date < from) return false;
      if (to && date > to) return false;

      if (!query) return true;
      return (
        sale.id.toLowerCase().includes(query) ||
        sale.items.some((item) =>
          `${item.productName} ${item.variantName}`.toLowerCase().includes(query),
        )
      );
    });
  }, [sales, search, source, from, to]);

  return (
    <>
      <PageHeader
        title={t('sales.historyTitle')}
        actions={
          <Link to="/sales/new" className="btn btn--primary btn--sm">
            {t('sales.recordSale')}
          </Link>
        }
      />

      <div className="stack mb-4">
        <label className="field">
          <span className="field__label">{t('common.search')}</span>
          <span className="input-group">
            <Search className="input-group__icon" size={18} aria-hidden="true" />
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('sales.historySearchPlaceholder')}
            />
          </span>
        </label>

        <div className="sales-history-filters">
          <label className="field">
            <span className="field__label">{t('sales.historySource')}</span>
            <select
              className="select"
              value={source}
              onChange={(event) => setSource(event.target.value as SaleSource)}
            >
              <option value="all">{t('common.all')}</option>
              <option value="real">{t('sales.historyReal')}</option>
              <option value="demo">{t('common.demoBadge')}</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('sales.historyDateFrom')}</span>
            <input
              className="input"
              type="date"
              value={from}
              max={to || todayISODate()}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">{t('sales.historyDateTo')}</span>
            <input
              className="input"
              type="date"
              value={to}
              min={from || undefined}
              max={todayISODate()}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>

        {(search || source !== 'all' || from || to) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setSearch('');
              setSource('all');
              setFrom('');
              setTo('');
            }}
          >
            {t('common.clear')}
          </button>
        )}
      </div>

      {errorKey ? (
        <ErrorState errorKey={errorKey} onRetry={load} />
      ) : !sales ? (
        <div className="stack">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          title={t('sales.historyEmpty')}
          body={t('sales.historyEmptyBody')}
          action={
            <div className="stack" style={{ alignItems: 'center' }}>
              <Link to="/sales/new" className="btn btn--primary">
                {t('sales.recordSale')}
              </Link>
              <Link to="/" className="btn btn--secondary">
                {t('common.goHome')}
              </Link>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState title={t('states.noResults')} body={t('sales.historyNoResults')} />
      ) : (
        <div className="stack">
          {visible.map((sale) => (
            <details key={sale.id} className="card">
              <summary className="sales-history-summary">
                <div className="list-row__main">
                  <div className="list-row__title">
                    {sale.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ')}
                  </div>
                  <div className="list-row__meta">
                    {formatDateTime(sale.createdAt, settings.language)}
                  </div>
                </div>
                <div className="list-row__end">
                  <strong>{formatMoney(sale.totalAmount, settings.language)}</strong>
                  {sale.demo ? <DemoBadge /> : null}
                </div>
              </summary>

              <div className="stack mt-3">
                <div className="list-row__meta">
                  {t('sales.historyTransaction')}: {sale.id}
                </div>
                <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {sale.items.map((item) => (
                    <li key={item.variantId} className="row row--between text-sm">
                      <span>
                        {item.quantity} × {item.productName} ({item.variantName})
                      </span>
                      <span>{formatMoney(item.lineTotal, settings.language)}</span>
                    </li>
                  ))}
                </ul>
                <div className="row row--between">
                  <strong>{t('sales.cartTotal')}</strong>
                  <strong>{formatMoney(sale.totalAmount, settings.language)}</strong>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Link to="/" className="btn btn--secondary btn--block">
          {t('common.goHome')}
        </Link>
      </div>
    </>
  );
}

export default SalesHistoryScreen;
