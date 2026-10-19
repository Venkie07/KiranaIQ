import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Search, Trash2 } from 'lucide-react';
import { PageHeader, StockBadge } from '@/components/common/Badges';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { formatMoney } from '@/domain/money';
import type { ProductStockView, SaleInput } from '@/services/interfaces';
import type { Sale } from '@/domain/types';

interface CartLine extends SaleInput {
  productName: string;
  variantName: string;
  available: number;
}

type Phase = 'cart' | 'review' | 'done';

/**
 * Fast sale entry: search / quick category shortcuts → cart → review →
 * success receipt. Stock is validated at confirm time against *usable*
 * stock; the confirm button locks while the write is in flight so a double
 * tap cannot create duplicate transactions.
 */
export function RecordSaleScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();
  const [params] = useSearchParams();

  const [rows, setRows] = useState<ProductStockView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [phase, setPhase] = useState<Phase>('cart');
  const [sale, setSale] = useState<Sale | null>(null);
  const [submitError, setSubmitError] = useState<{ key: string; params?: Record<string, string | number> } | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);

  const preselectedProduct = params.get('product');

  const load = useCallback(() => {
    setLoadError(null);
    getServices()
      .products.list()
      .then(setRows)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[sale] product load failed', err);
        setLoadError('errors.dbInit');
      });
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => r.usableStock > 0);
    if (preselectedProduct) {
      list = list.filter((r) => r.product.id === preselectedProduct);
    }
    if (q) {
      list = list.filter(
        (r) => r.product.name.toLowerCase().includes(q) || r.variant.name.toLowerCase().includes(q),
      );
    }
    // Frequently sold first: sort by recent sale activity is expensive here;
    // keep name order (deterministic) and show category shortcuts instead.
    return [...list].sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [rows, query, preselectedProduct]);

  const categoryShortcuts = useMemo(() => {
    if (!rows) return [];
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.usableStock > 0) counts.set(r.product.category, (counts.get(r.product.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  const addToCart = (row: ProductStockView) => {
    setSubmitError(null);
    setCart((lines) => {
      const existing = lines.find((l) => l.variantId === row.variant.id);
      if (existing) {
        return lines.map((l) =>
          l.variantId === row.variant.id
            ? { ...l, quantity: Math.min(l.quantity + 1, l.available) }
            : l,
        );
      }
      return [
        ...lines,
        {
          variantId: row.variant.id,
          quantity: 1,
          unitPrice: row.variant.sellingPrice,
          productName: row.product.name,
          variantName: row.variant.name,
          available: row.usableStock,
        },
      ];
    });
  };

  const updateLine = (variantId: string, quantity: number) => {
    setCart((lines) =>
      lines.map((l) =>
        l.variantId === variantId ? { ...l, quantity: Math.max(1, quantity) } : l,
      ),
    );
  };

  const removeLine = (variantId: string) => {
    setCart((lines) => lines.filter((l) => l.variantId !== variantId));
  };

  const total = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const confirmSale = async () => {
    if (submitting.current) return; // synchronous duplicate-submission guard
    submitting.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      const record = await getServices().sales.record({
        items: cart.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      setSale(record);
      setPhase('done');
      toast.push('success', t('messages.saleSaved'));
    } catch (err) {
      const serviceErr = err as { i18nKey?: string; params?: Record<string, string | number> };
      const key =
        typeof serviceErr.i18nKey === 'string' &&
        (serviceErr.i18nKey.startsWith('errors.') || serviceErr.i18nKey.startsWith('validation.'))
          ? serviceErr.i18nKey
          : 'errors.generic';
      setSubmitError({ key, params: serviceErr.params });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setCart([]);
    setSale(null);
    setSubmitError(null);
    setPhase('cart');
    load();
  };

  if (loadError) return <ErrorState errorKey={loadError} onRetry={load} />;
  if (!rows) return <LoadingState />;

  /* ---------------- success receipt ---------------- */
  if (phase === 'done' && sale) {
    const stockAfter = new Map<string, number>();
    for (const r of rows) stockAfter.set(r.variant.id, r.usableStock);
    return (
      <>
        <PageHeader title={t('sales.saleConfirmed')} />
        <div className="card stack" role="status">
          <div className="row" style={{ gap: 'var(--space-2)', color: 'var(--color-success)' }}>
            <CheckCircle2 size={28} aria-hidden="true" />
            <h2>{t('sales.saleConfirmed')}</h2>
          </div>
          <p className="muted text-sm">{t('sales.saleConfirmedBody')}</p>
          <hr className="divider" />
          <h3 style={{ fontSize: 'var(--text-base)' }}>{t('sales.receipt')}</h3>
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
            <strong style={{ fontSize: 'var(--text-lg)' }}>
              {formatMoney(sale.totalAmount, settings.language)}
            </strong>
          </div>
          <hr className="divider" />
          <div className="stack stack--tight text-sm muted">
            {sale.items.map((item) => {
              const after = rows.find((r) => r.variant.id === item.variantId)?.usableStock;
              return (
                <div key={item.variantId} className="row row--between">
                  <span>{item.productName}</span>
                  <span>{t('sales.stockAfter', { count: after ?? 0 })}</span>
                </div>
              );
            })}
          </div>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--primary btn--block" onClick={reset}>
              {t('sales.recordAnother')}
            </button>
            <Link to="/" className="btn btn--secondary btn--block">
              {t('common.goHome')}
            </Link>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- review step ---------------- */
  if (phase === 'review') {
    return (
      <>
        <PageHeader title={t('sales.checkout')} />
        <div className="card stack">
          {submitError ? (
            <div className="alert alert--error" role="alert">
              {t(submitError.key, submitError.params)}
            </div>
          ) : null}
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {cart.map((line) => (
              <li key={line.variantId} className="row row--between">
                <span>
                  {line.quantity} × {line.productName} ({line.variantName})
                  <br />
                  <span className="muted text-xs">
                    {t('sales.pricePerUnit')}:{' '}
                    {formatMoney(line.unitPrice, settings.language)}
                  </span>
                </span>
                <strong>{formatMoney(line.quantity * line.unitPrice, settings.language)}</strong>
              </li>
            ))}
          </ul>
          <hr className="divider" />
          <div className="row row--between">
            <strong>{t('sales.cartTotal')}</strong>
            <strong style={{ fontSize: 'var(--text-xl)' }}>
              {formatMoney(total, settings.language)}
            </strong>
          </div>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => void confirmSale()}
              disabled={busy}
            >
              {busy ? t('common.loading') : t('sales.confirmSale')}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => setPhase('cart')}
              disabled={busy}
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- cart step ---------------- */
  return (
    <>
      <PageHeader title={t('sales.recordSale')} />

      <div className="stack mb-4">
        <label className="field">
          <span className="field__label">{t('sales.searchProducts')}</span>
          <input
            className="input"
            type="search"
            value={query}
            placeholder={t('products.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="row" style={{ gap: 'var(--space-2)' }} aria-label={t('sales.frequentlySold')}>
          <span className="text-xs muted">{t('sales.frequentlySold')}:</span>
          {categoryShortcuts.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setQuery(t(`categories.${cat}`))}
            >
              {t(`categories.${cat}`)} ({count})
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={t('states.noResults')} body={t('products.emptySearch')} />
      ) : (
        <div className="stack mb-4">
          {visible.slice(0, 40).map((row) => {
            const inCart = cart.find((l) => l.variantId === row.variant.id);
            return (
              <div key={row.variant.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
                    {row.product.name} · {row.variant.name}
                  </div>
                  <div className="list-row__meta">
                    {formatMoney(row.variant.sellingPrice, settings.language)} ·{' '}
                    {t('products.currentStock')}: {row.usableStock}
                  </div>
                </div>
                <StockBadge status={row.usableStock <= row.product.reorderThreshold ? 'low' : 'ok'} />
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => addToCart(row)}
                  disabled={Boolean(inCart && inCart.quantity >= inCart.available)}
                >
                  {t('common.add')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <section className="card section" aria-label={t('sales.cart')}>
        <div className="card__title">
          {t('sales.cart')}
          {cart.length > 0 ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setCart([])}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('sales.clearCart')}
            </button>
          ) : null}
        </div>

        {cart.length === 0 ? (
          <p className="muted text-sm">{t('sales.cartEmpty')}</p>
        ) : (
          <div className="stack">
            {cart.map((line) => (
              <div key={line.variantId} className="stack stack--tight">
                <div className="row row--between">
                  <span className="text-sm">
                    <strong>{line.productName}</strong>
                    <br />
                    <span className="muted">{line.variantName}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => removeLine(line.variantId)}
                    aria-label={t('a11y.removeFromCart', { name: line.productName })}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="row row--between">
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(v) => updateLine(line.variantId, v)}
                    min={1}
                    max={line.available}
                    label={`${line.productName} — ${t('common.quantity')}`}
                  />
                  <div className="text-right">
                    <div className="text-xs muted">
                      {formatMoney(line.unitPrice, settings.language)}
                    </div>
                    <strong>{formatMoney(line.quantity * line.unitPrice, settings.language)}</strong>
                  </div>
                </div>
                {line.quantity >= line.available ? (
                  <span className="field__hint">{t('products.currentStock')}: {line.available}</span>
                ) : null}
              </div>
            ))}

            <hr className="divider" />
            <div className="row row--between">
              <strong>{t('sales.cartTotal')}</strong>
              <strong style={{ fontSize: 'var(--text-xl)' }}>
                {formatMoney(total, settings.language)}
              </strong>
            </div>

            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => {
                setSubmitError(null);
                setPhase('review');
              }}
              disabled={cart.length === 0}
            >
              <Search size={18} aria-hidden="true" />
              {t('sales.checkout')}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export default RecordSaleScreen;
