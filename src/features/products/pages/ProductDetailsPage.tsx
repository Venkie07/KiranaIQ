import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Edit3, ArrowLeft } from 'lucide-react';
import { PageHeader, DemoBadge } from '@/components/common/Badges';
import { formatMoney } from '@/domain/money';
import { formatDateTime } from '@/domain/dates';
import { StockBadge } from '@/components/common/Badges';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/hooks/useSettings';
import { useProduct } from '@/features/products/hooks/useProduct';
import { ErrorState, LoadingState, NotFoundState } from '@/components/feedback/States';
import { SafeText } from '@/components/common/SafeText';

export function ProductDetailsPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { productId } = useParams();
  const { detail, loading, error, loadProduct } = useProduct(productId || '');

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState errorKey={error} onRetry={loadProduct} />;
  if (!detail) {
    return (
      <NotFoundState
        action={
          <Link to="/products/new" className="btn btn--primary">
            {t('products.createNewProduct')}
          </Link>
        }
      />
    );
  }

  const { product, variants, movements } = detail;

  // Calculate financial metrics for the primary variant
  const primaryVariant = variants[0]?.variant;
  const sellingPrice = primaryVariant?.sellingPrice ?? 0;
  const costPrice = primaryVariant?.costPrice ?? 0;
  const profit = sellingPrice - costPrice;
  const marginPercentage =
    sellingPrice > 0 && primaryVariant?.costPrice != null
      ? (profit / sellingPrice) * 100
      : null;

  return (
    <>
      <PageHeader
        title={product.name}
        actions={
          <>
            {product.demo ? <DemoBadge /> : null}
            <Link to={`/products/${product.id}/edit`} className="btn btn--secondary btn--sm">
              <Edit3 size={16} /> {t('productDetail.editProduct')}
            </Link>
          </>
        }
      />

      <div className="stack gap-4">
        <section className="card section">
          <h2 className="card__title">{t('productDetail.productInfo')}</h2>
          <dl className="stack stack--tight">
            <div className="row row--between">
              <dt className="muted text-sm">{t('common.category')}</dt>
              <dd>{t(`categories.${product.category}`)}</dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('common.unit')}</dt>
              <dd>{t(`units.${product.unit}`)}</dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('productForm.supplier')}</dt>
              <dd className="font-medium"><SafeText>{product.supplier}</SafeText></dd>
            </div>
          </dl>
        </section>

        <section className="card section">
          <h2 className="card__title">{t('productDetail.financials')}</h2>
          <dl className="stack stack--tight">
            <div className="row row--between">
              <dt className="muted text-sm">{t('productDetail.unitProfit')}</dt>
              <dd className="font-medium"><SafeText>{formatMoney(profit, settings.language)}</SafeText></dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('productDetail.marginPercentage')}</dt>
              <dd className="font-medium">
                <SafeText>{marginPercentage == null ? undefined : `${marginPercentage.toFixed(1)}%`}</SafeText>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card section">
          <h2 className="card__title">{t('productDetail.variants')}</h2>
          <div className="stack gap-2">
            {variants.map(v => (
              <div key={v.variant.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{v.variant.name}</div>
                  <div className="list-row__meta">
                    {formatMoney(v.variant.sellingPrice, settings.language)}
                  </div>
                </div>
                <div className="list-row__end">
                  <span className="product-card__stock">{v.usableStock}</span>
                  <StockBadge status={v.usableStock <= 0 ? 'out' : v.usableStock <= product.reorderThreshold ? 'low' : 'ok'} />
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
            <ul className="stack stack--tight" style={{ listStyle: 'none', padding: 0 }}>
              {movements.slice(0, 10).map(m => (
                <li key={m.id} className="row row--between text-sm">
                  <span>{m.movementType} {m.signedQuantity > 0 ? '+' : ''}{m.signedQuantity}</span>
                  <span className="muted">{formatDateTime(m.timestamp, settings.language)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link to="/products" className="btn btn--secondary">
            <ArrowLeft size={16} /> {t('common.back')}
          </Link>
        </div>
      </div>
    </>
  );
}

export default ProductDetailsPage;
