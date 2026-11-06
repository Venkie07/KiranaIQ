import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Edit3, Eye, Trash2 } from 'lucide-react';
import { DemoBadge, PageHeader, StockBadge } from '@/components/common/Badges';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { EmptyState, ErrorState, SkeletonRow } from '@/components/feedback/States';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
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

export function ProductsScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ProductStockView[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        console.error('[products] load failed', err);
        setErrorKey('errors.dbInit');
      });
  };

  const handleDelete = async (id: string) => {
    try {
      await getServices().products.delete(id);
      toast.push('success', t('products.deleteSuccess'));
      await load();
    } catch (err) {
      console.error('[products] delete failed', err);
      toast.push('error', t('errors.dbWrite'));
    } finally {
      setDeletingId(null);
    }
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
        case 'name-desc': return b.product.name.localeCompare(a.product.name);
        case 'stock-asc': return a.usableStock - b.usableStock;
        case 'stock-desc': return b.usableStock - a.usableStock;
        case 'recent': return b.product.createdAt.localeCompare(a.product.createdAt);
        case 'name-asc':
        default: return a.product.name.localeCompare(b.product.name) || a.variant.name.localeCompare(b.variant.name);
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

      <ConfirmDialog
        open={!!deletingId}
        title={t('products.deleteTitle')}
        body={t('products.deleteBody', { name: filtered.find(r => r.product.id === deletingId)?.product.name })}
        danger
        confirmLabel={t('common.confirm')}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      <div className="stack mb-4">
        <div className="product-toolbar-row">
          <div className="field product-toolbar-search">
            <div className="input-group">
              <Search size={18} className="input-group__icon" />
              <input
                className="input"
                type="search"
                value={search}
                placeholder={t('products.searchPlaceholder')}
                onChange={(e) => setParam('q', e.target.value)}
              />
            </div>
          </div>
          <div className="field product-toolbar-category">
            <div className="select-group">
              <Filter size={18} className="select-group__icon" />
              <select
                className="select"
                value={category}
                onChange={(e) => setParam('category', e.target.value)}
              >
                <option value="all">{t('common.all')} {t('products.categoryFilter')}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`categories.${c}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="product-toolbar-sort-row">
          <div className="product-toolbar-sort-controls">
            <select
              className="select select--sm"
              value={status}
              onChange={(e) => setParam('status', e.target.value)}
            >
              <option value="all">{t('products.statusFilter')} ({t('common.all')})</option>
              <option value="out">{t('products.stockStatusOut')}</option>
              <option value="low">{t('products.stockStatusLow')}</option>
              <option value="ok">{t('products.stockStatusOk')}</option>
            </select>
            <select
              className="select select--sm"
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
            >
              <option value="name-asc">{t('products.sortNameAsc')}</option>
              <option value="name-desc">{t('products.sortNameDesc')}</option>
              <option value="stock-asc">{t('products.sortStockAsc')}</option>
              <option value="stock-desc">{t('products.sortStockDesc')}</option>
              <option value="recent">{t('products.sortRecent')}</option>
            </select>
          </div>
          <div className="text-sm muted">
            {filtered.length} {t('products.itemsFound', { count: filtered.length })}
          </div>
        </div>
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
          body={search || category !== 'all' || status !== 'all' ? t('products.emptySearch') : undefined}
        />
      ) : (
        <>
          <div className="stack card-list-only">
            {filtered.map((row) => (
              <div key={row.variant.id} className="card list-card">
                <div className="list-row">
                  <CategoryIcon category={row.product.category} />
                  <div className="list-row__main">
                    <div className="list-row__title">
                      <Link to={`/products/${row.product.id}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>
                        {row.product.name}
                      </Link>
                      {row.product.demo ? <DemoBadge /> : null}
                    </div>
                    <div className="list-row__meta">
                      {row.variant.name} · {formatMoney(row.variant.sellingPrice, settings.language)}
                    </div>
                  </div>
                  <div className="list-row__end">
                    <div className="stack" style={{ flexDirection: 'row', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <Link to={`/products/${row.product.id}/edit`} className="btn btn--ghost btn--sm" title={t('common.edit')}>
                        <Edit3 size={16} />
                      </Link>
                      <Link to={`/products/${row.product.id}`} className="btn btn--ghost btn--sm" title={t('common.view')}>
                        <Eye size={16} />
                      </Link>
                      <button
                        className="btn btn--ghost btn--sm text-danger"
                        title={t('common.delete')}
                        onClick={() => setDeletingId(row.product.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="product-card__stock">{row.usableStock}</span>
                      <StockBadge status={statusOf(row)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
                  <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.variant.id}>
                    <td>
                      <Link to={`/products/${row.product.id}`} className="font-medium">
                        {row.product.name}
                      </Link>
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
                    <td><StockBadge status={statusOf(row)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <Link to={`/products/${row.product.id}/edit`} className="btn btn--ghost btn--xs">
                          <Edit3 size={14} /> {t('common.edit')}
                        </Link>
                        <Link to={`/products/${row.product.id}`} className="btn btn--ghost btn--xs">
                          <Eye size={14} /> {t('common.view')}
                        </Link>
                        <button
                          className="btn btn--ghost btn--xs text-danger"
                          title={t('common.delete')}
                          onClick={() => setDeletingId(row.product.id)}
                        >
                          <Trash2 size={14} /> {t('common.delete')}
                        </button>
                      </div>
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
