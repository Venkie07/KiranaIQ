import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DemoBadge, PageHeader, StockBadge } from '@/components/common/Badges';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { EmptyState, ErrorState, SkeletonRow } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatMoney } from '@/domain/money';
import { PRODUCT_CATEGORIES } from '@/domain/types';
import type { ProductCategory, StockStatus } from '@/domain/types';
import type { ProductStockView } from '@/services/interfaces';

type SortKey = 'name-asc' | 'name-desc' | 'stock-asc' | 'stock-desc' | 'recent';

function statusOf(row: ProductStockView): StockStatus {
  if (row.usableStock <= 0) return 'out';
  if (row.usableStock <= row.product.reorderThreshold) return 'low';
  return 'ok';
}

/**
 * Product catalogue: search + category/status filters + sort.
 * Mobile: card list. Wide screens (≥768px): data table (CSS-switched).
 */
export function ProductsScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ProductStockView[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const search = params.get('q') ?? '';
  const category = (params.get('category') ?? 'all') as ProductCategory | 'all';
  const status = (params.get('status') ?? 'all') as StockStatus | 'all';
  const sort = (params.get('sort') ?? 'name-asc') as SortKey;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const load = () => {
    setErrorKey(null);
    setRows(null);
    getServices()
      .products.list({ includeInactive: false })
      .then(setRows)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[products] load failed', err);
        setErrorKey('errors.dbInit');
      });
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.product.name.toLowerCase().includes(q) ||
          r.variant.name.toLowerCase().includes(q) ||
          (r.product.supplier ?? '').toLowerCase().includes(q) ||
          (r.variant.barcode ?? '').toLowerCase().includes(q),
      );
    }
    if (category !== 'all') out = out.filter((r) => r.product.category === category);
    if (status !== 'all') out = out.filter((r) => statusOf(r) === status);
    const sorted = [...out];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return b.product.name.localeCompare(a.product.name);
        case 'stock-asc':
          return a.usableStock - b.usableStock;
        case 'stock-desc':
          return b.usableStock - a.usableStock;
        case 'recent':
          return b.product.createdAt.localeCompare(a.product.createdAt);
        case 'name-asc':
        default:
          return (
            a.product.name.localeCompare(b.product.name) ||
            a.variant.name.localeCompare(b.variant.name)
          );
      }
    });
    return sorted;
  }, [rows, search, category, status, sort]);

  const addButton = (
    <Link to="/products/new" className="btn btn--primary btn--sm">
      <Plus size={18} aria-hidden="true" />
      {t('products.addProduct')}
    </Link>
  );

  if (errorKey) return <ErrorState errorKey={errorKey} onRetry={load} />;

  return (
    <>
      <PageHeader title={t('products.title')} actions={addButton} />

      <div className="stack mb-4">
        <label className="field">
          <span className="field__label">{t('common.search')}</span>
          <input
            className="input"
            type="search"
            value={search}
            placeholder={t('products.searchPlaceholder')}
            onChange={(e) => setParam('q', e.target.value)}
          />
        </label>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('products.categoryFilter')}</span>
            <select
              className="select"
              value={category}
              onChange={(e) => setParam('category', e.target.value)}
            >
              <option value="all">{t('common.all')}</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('products.statusFilter')}</span>
            <select
              className="select"
              value={status}
              onChange={(e) => setParam('status', e.target.value)}
            >
              <option value="all">{t('common.all')}</option>
              <option value="out">{t('products.stockStatusOut')}</option>
              <option value="low">{t('products.stockStatusLow')}</option>
              <option value="ok">{t('products.stockStatusOk')}</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field__label">{t('products.sortLabel')}</span>
          <select
            className="select"
            aria-label={t('a11y.sortByLabel')}
            value={sort}
            onChange={(e) => setParam('sort', e.target.value)}
          >
            <option value="name-asc">{t('products.sortNameAsc')}</option>
            <option value="name-desc">{t('products.sortNameDesc')}</option>
            <option value="stock-asc">{t('products.sortStockAsc')}</option>
            <option value="stock-desc">{t('products.sortStockDesc')}</option>
            <option value="recent">{t('products.sortRecent')}</option>
          </select>
        </label>
      </div>

      {!rows ? (
        <div className="stack">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search || category !== 'all' || status !== 'all' ? t('states.noResults') : t('products.empty')}
          body={
            search || category !== 'all' || status !== 'all' ? t('products.emptySearch') : undefined
          }
        />
      ) : (
        <>
          {/* Mobile / narrow: cards */}
          <div className="stack card-list-only">
            {filtered.map((row) => (
              <Link
                key={row.variant.id}
                to={`/products/${row.product.id}`}
                className="list-row"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <CategoryIcon category={row.product.category} />
                <div className="list-row__main">
                  <div className="list-row__title">
                    {row.product.name} {row.product.demo ? <DemoBadge /> : null}
                  </div>
                  <div className="list-row__meta">
                    {row.variant.name} ·{' '}
                    {formatMoney(row.variant.sellingPrice, settings.language)}
                  </div>
                </div>
                <div className="list-row__end">
                  <span className="product-card__stock">{row.usableStock}</span>
                  <StockBadge status={statusOf(row)} />
                </div>
              </Link>
            ))}
          </div>

          {/* Wide: table */}
          <div className="table-wrap card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.category')}</th>
                  <th>{t('products.packSize')}</th>
                  <th>{t('products.sellingPrice')}</th>
                  <th>{t('products.purchaseCost')}</th>
                  <th>{t('products.currentStock')}</th>
                  <th>{t('products.reorderThreshold')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.variant.id}>
                    <td>
                      <Link to={`/products/${row.product.id}`}>{row.product.name}</Link>
                    </td>
                    <td>{t(`categories.${row.product.category}`)}</td>
                    <td>{row.variant.name}</td>
                    <td>{formatMoney(row.variant.sellingPrice, settings.language)}</td>
                    <td>
                      {row.variant.costPrice != null
                        ? formatMoney(row.variant.costPrice, settings.language)
                        : '—'}
                    </td>
                    <td>{row.usableStock}</td>
                    <td>{row.product.reorderThreshold}</td>
                    <td>
                      <StockBadge status={statusOf(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default ProductsScreen;
