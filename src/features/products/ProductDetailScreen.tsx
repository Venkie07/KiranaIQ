import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Edit3, PackagePlus, ShoppingCart } from 'lucide-react';
import { DemoBadge, ExpiryBadge, PageHeader, StockBadge } from '@/components/common/Badges';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { getServices } from '@/services/serviceFactory';
import { formatDate, formatDateTime } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { classifyExpiryRisk } from '@/domain/inventory';
import type { ProductDetail } from '@/services/interfaces';
import type { StockStatus } from '@/domain/types';

function statusOf(usable: number, threshold: number): StockStatus {
  if (usable <= 0) return 'out';
  if (usable <= threshold) return 'low';
  return 'ok';
}

/**
 * Product details: info, pack sizes with stock, recent movements, sales
 * history, expiry batches, plus quick actions. No forecasts are shown.
 */
export function ProductDetailScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { productId = '' } = useParams();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setErrorKey(null);
    setDetail(null);
    getServices()
      .products.getDetail(productId)
      .then((result) => {
        if (!result) setErrorKey('errors.notFound');
        else setDetail(result);
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[product-detail] load failed', err);
        setErrorKey('errors.dbInit');
      });
  }, [productId]);

  useEffect(load, [load]);

  if (errorKey) return <ErrorState errorKey={errorKey} onRetry={load} />;
  if (!detail) return <LoadingState />;

  const { product, variants, movements, sales, batches } = detail;
  const movementLabel = (type: string) =>
    ({
      opening: t('movements.opening'),
      purchase: t('movements.purchase'),
      sale: t('movements.sale'),
      return: t('movements.return'),
      damage: t('movements.damage'),
      expiry: t('movements.expiry'),
      correction: t('movements.correction'),
    })[type] ?? type;

  return (
    <>
      <PageHeader
        title={product.name}
        actions={
          <>
            {product.demo ? <DemoBadge /> : null}
            <Link to={`/products/${product.id}/edit`} className="btn btn--secondary btn--sm">
              <Edit3 size={16} aria-hidden="true" />
              {t('productDetail.editProduct')}
            </Link>
          </>
        }
      />

      <div className="row mb-4" style={{ gap: 'var(--space-2)' }}>
        <Link to={`/sales/new?product=${product.id}`} className="btn btn--primary btn--sm">
          <ShoppingCart size={16} aria-hidden="true" />
          {t('productDetail.recordSale')}
        </Link>
        <Link to={`/purchases/new?product=${product.id}`} className="btn btn--secondary btn--sm">
          <PackagePlus size={16} aria-hidden="true" />
          {t('productDetail.receiveStock')}
        </Link>
      </div>

      <section className="card section">
        <h2 className="card__title">{t('productDetail.productInfo')}</h2>
        <dl className="stack stack--tight" style={{ margin: 0 }}>
          <div className="row row--between">
            <dt className="muted text-sm">{t('common.category')}</dt>
            <dd style={{ margin: 0 }}>{t(`categories.${product.category}`)}</dd>
          </div>
          <div className="row row--between">
            <dt className="muted text-sm">{t('common.unit')}</dt>
            <dd style={{ margin: 0 }}>{t(`units.${product.unit}`)}</dd>
          </div>
          {product.supplier ? (
            <div className="row row--between">
              <dt className="muted text-sm">{t('productForm.supplier')}</dt>
              <dd style={{ margin: 0 }}>{product.supplier}</dd>
            </div>
          ) : null}
          <div className="row row--between">
            <dt className="muted text-sm">{t('productDetail.batches')}</dt>
            <dd style={{ margin: 0 }}>
              {product.expiryTracked ? t('common.yes') : t('productDetail.notTracked')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card section">
        <h2 className="card__title">{t('productDetail.variants')}</h2>
        <div className="stack">
          {variants.map((row) => (
            <div key={row.variant.id} className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">{row.variant.name}</div>
                <div className="list-row__meta">
                  {t('products.sellingPrice')}: {formatMoney(row.variant.sellingPrice, settings.language)}
                  {row.variant.costPrice != null ? (
                    <>
                      {' · '}
                      {t('products.purchaseCost')}:{' '}
                      {formatMoney(row.variant.costPrice, settings.language)}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="list-row__end">
                <span className="product-card__stock">
                  {t('productDetail.currentStock')}: {row.usableStock}
                </span>
                {row.expiredQuantity > 0 ? (
                  <span className="badge badge--out">
                    {t('productDetail.expiredStock')}: {row.expiredQuantity}
                  </span>
                ) : null}
                <StockBadge status={statusOf(row.usableStock, product.reorderThreshold)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card section">
        <h2 className="card__title">{t('productDetail.recentMovements')}</h2>
        {movements.length === 0 ? (
          <p className="muted text-sm">{t('productDetail.noMovements')}</p>
        ) : (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {movements.slice(0, 12).map((m) => (
              <li key={m.id} className="row row--between text-sm" style={{ gap: 8 }}>
                <span>
                  {movementLabel(m.movementType)} ·{' '}
                  <span className={m.signedQuantity < 0 ? 'badge badge--out' : 'badge badge--ok'}>
                    {m.signedQuantity > 0 ? '+' : ''}
                    {m.signedQuantity}
                  </span>
                </span>
                <span className="muted nowrap">{formatDateTime(m.timestamp, settings.language)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/movements" className="btn btn--ghost btn--sm mt-3">
          {t('dashboard.viewAll')}
        </Link>
      </section>

      <section className="card section">
        <h2 className="card__title">{t('productDetail.salesHistory')}</h2>
        {sales.length === 0 ? (
          <p className="muted text-sm">{t('productDetail.noSales')}</p>
        ) : (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sales.slice(0, 10).map((sale) => {
              const line = sale.items.find((i) =>
                variants.some((v) => v.variant.id === i.variantId),
              );
              if (!line) return null;
              return (
                <li key={sale.id} className="row row--between text-sm">
                  <span>
                    {line.quantity} × {line.variantName}
                  </span>
                  <span className="muted nowrap">
                    {formatDateTime(sale.createdAt, settings.language)} ·{' '}
                    {formatMoney(line.lineTotal, settings.language)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card section">
        <h2 className="card__title">{t('productDetail.batches')}</h2>
        {!product.expiryTracked ? (
          <p className="muted text-sm">{t('productDetail.notTracked')}</p>
        ) : batches.length === 0 ? (
          <p className="muted text-sm">{t('productDetail.noBatches')}</p>
        ) : (
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {batches.map((batch) => (
              <li key={batch.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
                    {batch.batchCode ?? batch.variantName}
                  </div>
                  <div className="list-row__meta">
                    {t('productDetail.batchRemaining', {
                      remaining: batch.remainingQuantity,
                      received: batch.receivedQuantity,
                    })}
                    {batch.expiryDate ? ` · ${formatDate(batch.expiryDate, settings.language)}` : ''}
                  </div>
                </div>
                {batch.expiryDate ? (
                  <ExpiryBadge
                    risk={classifyExpiryRisk(batch.expiryDate, settings.expiryWarningDays).risk}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default ProductDetailScreen;
