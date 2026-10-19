import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/common/Badges';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { formatMoney, rupeesToPaise } from '@/domain/money';
import { todayISODate } from '@/domain/dates';
import { purchaseFormSchema } from '@/domain/validation';
import type { PurchaseFormValues } from '@/domain/validation';
import type { ProductStockView } from '@/services/interfaces';
import type { Purchase } from '@/domain/types';

type Errors = Partial<Record<keyof PurchaseFormValues, string>>;

/**
 * Receive incoming stock: product → quantity, cost, supplier, date and
 * optional batch/expiry (only when the product has expiry tracking on).
 * Review-then-confirm; the button locks during the write.
 */
export function ReceivePurchaseScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();
  const [params] = useSearchParams();

  const [rows, setRows] = useState<ProductStockView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState(params.get('variant') ?? '');
  const [quantity, setQuantity] = useState(12);
  const [costRupees, setCostRupees] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISODate());
  const [trackBatch, setTrackBatch] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<{ key: string; params?: Record<string, string | number> } | null>(null);
  const [phase, setPhase] = useState<'form' | 'review' | 'done'>('form');
  const [done, setDone] = useState<Purchase | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const preselectedProduct = params.get('product');

  const load = useCallback(() => {
    setLoadError(null);
    getServices()
      .products.list()
      .then((list) => {
        setRows(list);
        const first = preselectedProduct
          ? list.find((r) => r.product.id === preselectedProduct)
          : list[0];
        setVariantId((prev) => prev || first?.variant.id || '');
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[purchase] product load failed', err);
        setLoadError('errors.dbInit');
      });
  }, [preselectedProduct]);

  useEffect(load, [load]);

  const selected = useMemo(() => rows?.find((r) => r.variant.id === variantId) ?? null, [rows, variantId]);

  // Keep cost synced with the selected variant's known cost.
  useEffect(() => {
    if (!selected) return;
    const cost = selected.variant.costPrice;
    setCostRupees(cost != null ? cost / 100 : 0);
    if (!supplier) setSupplier(selected.product.supplier ?? '');
    if (!selected.product.expiryTracked) {
      setTrackBatch(false);
      setExpiryDate('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.variant.id]);

  const formValues = (): PurchaseFormValues => ({
    variantId,
    quantity,
    unitCost: rupeesToPaise(costRupees || 0),
    supplier,
    purchaseDate,
    trackBatch,
    batchCode,
    expiryDate: trackBatch ? expiryDate : '',
  });

  const validate = (): boolean => {
    const values = formValues();
    // Expiry date is optional even in batch mode — schema accepts ''.
    const result = purchaseFormSchema.safeParse({ ...values, expiryDate: values.expiryDate || '' });
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof PurchaseFormValues;
      if (!next[key]) next[key] = t(issue.message);
    }
    setErrors(next);
    return false;
  };

  const goReview = () => {
    setSubmitError(null);
    if (!validate()) return;
    setPhase('review');
  };

  const confirm = async () => {
    if (submitting.current) return; // synchronous duplicate guard
    submitting.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      const purchase = await getServices().purchases.record({
        variantId,
        quantity,
        unitCost: rupeesToPaise(costRupees || 0),
        supplier: supplier.trim() || undefined,
        purchaseDate,
        trackBatch: trackBatch && Boolean(selected?.product.expiryTracked),
        batchCode: batchCode.trim() || undefined,
        expiryDate: expiryDate || null,
      });
      setDone(purchase);
      setPhase('done');
      toast.push('success', t('messages.purchaseSaved'));
    } catch (err) {
      const serviceErr = err as { i18nKey?: string; params?: Record<string, string | number> };
      const key =
        typeof serviceErr.i18nKey === 'string' &&
        (serviceErr.i18nKey.startsWith('errors.') || serviceErr.i18nKey.startsWith('validation.'))
          ? serviceErr.i18nKey
          : 'errors.generic';
      setSubmitError({ key, params: serviceErr.params });
      setPhase('form');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setQuantity(12);
    setBatchCode('');
    setExpiryDate('');
    setTrackBatch(false);
    setSubmitError(null);
    setDone(null);
    setPhase('form');
    load();
  };

  if (loadError) return <ErrorState errorKey={loadError} onRetry={load} />;
  if (!rows) return <LoadingState />;

  if (phase === 'done' && done) {
    const item = done.items[0];
    return (
      <>
        <PageHeader title={t('purchases.receivedSuccess')} />
        <div className="card stack" role="status">
          <div className="row" style={{ gap: 'var(--space-2)', color: 'var(--color-success)' }}>
            <CheckCircle2 size={28} aria-hidden="true" />
            <h2>{t('purchases.receivedSuccess')}</h2>
          </div>
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="row row--between text-sm">
              <span>
                {item.productName} ({item.variantName})
              </span>
              <span>
                +{item.quantity} · {formatMoney(item.lineTotal, settings.language)}
              </span>
            </li>
            {done.supplier ? (
              <li className="row row--between text-sm muted">
                <span>{t('purchases.supplier')}</span>
                <span>{done.supplier}</span>
              </li>
            ) : null}
            <li className="row row--between text-sm muted">
              <span>{t('purchases.purchaseDate')}</span>
              <span>{done.purchaseDate}</span>
            </li>
          </ul>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--primary btn--block" onClick={reset}>
              {t('purchases.receiveStock')}
            </button>
            <Link to="/" className="btn btn--secondary btn--block">
              {t('common.goHome')}
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (phase === 'review' && selected) {
    return (
      <>
        <PageHeader title={t('purchases.review')} />
        <div className="card stack">
          {submitError ? (
            <div className="alert alert--error" role="alert">
              {t(submitError.key, submitError.params)}
            </div>
          ) : null}
          <dl className="stack stack--tight" style={{ margin: 0 }}>
            <div className="row row--between">
              <dt className="muted text-sm">{t('common.product')}</dt>
              <dd style={{ margin: 0 }}>
                {selected.product.name} ({selected.variant.name})
              </dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('purchases.quantityReceived')}</dt>
              <dd style={{ margin: 0 }}>{quantity}</dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('purchases.purchaseCostRupees')}</dt>
              <dd style={{ margin: 0 }}>{formatMoney(rupeesToPaise(costRupees || 0), settings.language)}</dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('common.total')}</dt>
              <dd style={{ margin: 0 }}>
                <strong>{formatMoney(rupeesToPaise(costRupees || 0) * quantity, settings.language)}</strong>
              </dd>
            </div>
            <div className="row row--between">
              <dt className="muted text-sm">{t('purchases.purchaseDate')}</dt>
              <dd style={{ margin: 0 }}>{purchaseDate}</dd>
            </div>
            {trackBatch && expiryDate ? (
              <div className="row row--between">
                <dt className="muted text-sm">{t('purchases.expiryDate')}</dt>
                <dd style={{ margin: 0 }}>{expiryDate}</dd>
              </div>
            ) : null}
          </dl>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy ? t('common.loading') : t('purchases.confirmReceive')}
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => setPhase('form')}
              disabled={busy}
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('purchases.receiveStock')} />

      <form
        className="card stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          goReview();
        }}
      >
        {submitError ? (
          <div className="alert alert--error" role="alert">
            {t(submitError.key, submitError.params)}
          </div>
        ) : null}

        <label className="field">
          <span className="field__label">{t('common.product')}</span>
          <select
            className="select"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setSubmitError(null);
            }}
            aria-invalid={errors.variantId ? true : undefined}
          >
            {!variantId ? <option value="">{t('purchases.selectProduct')}</option> : null}
            {rows.map((row) => (
              <option key={row.variant.id} value={row.variant.id}>
                {row.product.name} — {row.variant.name}
              </option>
            ))}
          </select>
          {errors.variantId ? <span className="field__error">{errors.variantId}</span> : null}
        </label>

        <div className="row row--between">
          <span className="field__label">{t('purchases.quantityReceived')}</span>
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            label={t('purchases.quantityReceived')}
          />
        </div>
        {errors.quantity ? <span className="field__error">{errors.quantity}</span> : null}

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('purchases.purchaseCostRupees')}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={costRupees}
              onChange={(e) => setCostRupees(Number(e.target.value))}
              aria-invalid={errors.unitCost ? true : undefined}
            />
            {errors.unitCost ? <span className="field__error">{errors.unitCost}</span> : null}
          </label>

          <label className="field">
            <span className="field__label">{t('purchases.purchaseDate')}</span>
            <input
              className="input"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              aria-invalid={errors.purchaseDate ? true : undefined}
            />
            {errors.purchaseDate ? <span className="field__error">{errors.purchaseDate}</span> : null}
          </label>
        </div>

        <label className="field">
          <span className="field__label">
            {t('purchases.supplier')} <span className="muted">({t('common.optional')})</span>
          </span>
          <input
            className="input"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            maxLength={80}
          />
        </label>

        {selected?.product.expiryTracked ? (
          <>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="trackBatch"
                checked={trackBatch}
                onChange={(e) => setTrackBatch(e.target.checked)}
              />
              <label htmlFor="trackBatch">{t('purchases.trackBatch')}</label>
            </div>

            {trackBatch ? (
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">
                    {t('purchases.batchLabel')} <span className="muted">({t('common.optional')})</span>
                  </span>
                  <input
                    className="input"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    maxLength={40}
                    placeholder="B-001"
                  />
                  <span className="field__hint">{t('purchases.batchHint')}</span>
                </label>

                <label className="field">
                  <span className="field__label">
                    {t('purchases.expiryDate')} <span className="muted">({t('common.optional')})</span>
                  </span>
                  <input
                    className="input"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    aria-invalid={errors.expiryDate ? true : undefined}
                  />
                  <span className="field__hint">{t('purchases.expiryHint')}</span>
                  {errors.expiryDate ? (
                    <span className="field__error">{errors.expiryDate}</span>
                  ) : null}
                </label>
              </div>
            ) : null}
          </>
        ) : null}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || !variantId}>
          {t('purchases.review')}
        </button>
      </form>
    </>
  );
}

export default ReceivePurchaseScreen;
