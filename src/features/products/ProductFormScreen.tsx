import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/Badges';
import { ErrorState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { productFormSchema } from '@/domain/validation';
import { rupeesToPaise } from '@/domain/money';
import { PRODUCT_CATEGORIES, UNITS } from '@/domain/types';
import type { Language, ProductCategory, Unit } from '@/domain/types';

interface FormState {
  name: string;
  localDisplayNameTa: string;
  localDisplayNameHi: string;
  category: ProductCategory;
  unit: Unit;
  variantName: string;
  packSize: number;
  sellingPrice: number;
  costPrice: number | null;
  initialStock: number;
  reorderThreshold: number;
  barcode: string;
  supplier: string;
  expiryTracked: boolean;
  active: boolean;
}

type Errors = Partial<Record<keyof FormState, string>>;

function defaultState(threshold: number): FormState {
  return {
    name: '',
    localDisplayNameTa: '',
    localDisplayNameHi: '',
    category: 'other',
    unit: 'pcs',
    variantName: '',
    packSize: 1,
    sellingPrice: 0,
    costPrice: null,
    initialStock: 0,
    reorderThreshold: threshold,
    barcode: '',
    supplier: '',
    expiryTracked: false,
    active: true,
  };
}

/**
 * Add / edit product with client-side Zod validation.
 * Typed values are preserved when validation fails (state is not cleared).
 * Create and edit share this screen; edits never rewrite existing sales.
 */
export function ProductFormScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEdit = Boolean(productId);

  const [state, setState] = useState<FormState>(() => defaultState(settings.defaultReorderThreshold));
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit mode: prefill from the existing product (first variant).
  useEffect(() => {
    if (!productId) return;
    void (async () => {
      try {
        const detail = await getServices().products.getDetail(productId);
        if (!detail) {
          setLoadError('errors.notFound');
          return;
        }
        const primary = detail.variants[0];
        const p = detail.product;
        setState({
          name: p.name,
          localDisplayNameTa: p.localDisplayNames?.ta ?? '',
          localDisplayNameHi: p.localDisplayNames?.hi ?? '',
          category: p.category,
          unit: p.unit,
          variantName: primary?.variant.name ?? '',
          packSize: primary?.variant.packSize ?? 1,
          sellingPrice: primary ? primary.variant.sellingPrice / 100 : 0,
          costPrice: primary?.variant.costPrice != null ? primary.variant.costPrice / 100 : null,
          initialStock: 0, // only meaningful when creating
          reorderThreshold: p.reorderThreshold,
          barcode: primary?.variant.barcode ?? '',
          supplier: p.supplier ?? '',
          expiryTracked: p.expiryTracked,
          active: p.active,
        });
        setLoaded(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[product-form] load failed', err);
        setLoadError('errors.dbInit');
      }
    })();
  }, [productId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const candidate = {
      name: state.name,
      localDisplayNameTa: state.localDisplayNameTa,
      localDisplayNameHi: state.localDisplayNameHi,
      category: state.category,
      unit: state.unit,
      variantName: state.variantName,
      packSize: state.packSize,
      sellingPrice: state.sellingPrice,
      costPrice: state.costPrice === null || state.costPrice === ('' as never) ? null : state.costPrice,
      initialStock: state.initialStock,
      reorderThreshold: state.reorderThreshold,
      barcode: state.barcode,
      supplier: state.supplier,
      expiryTracked: state.expiryTracked,
      active: state.active,
    };
    const result = productFormSchema.safeParse(candidate);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FormState;
      if (!next[key]) next[key] = t(issue.message);
    }
    setErrors(next);
    return false;
  };

  const submit = async () => {
    if (busy) return;
    setSubmitError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const services = getServices();
      const localDisplayNames: Partial<Record<Language, string>> = {};
      if (state.localDisplayNameTa.trim()) localDisplayNames.ta = state.localDisplayNameTa.trim();
      if (state.localDisplayNameHi.trim()) localDisplayNames.hi = state.localDisplayNameHi.trim();

      if (isEdit && productId) {
        await services.products.update(productId, {
          name: state.name.trim(),
          localDisplayNames,
          category: state.category,
          unit: state.unit,
          reorderThreshold: state.reorderThreshold,
          expiryTracked: state.expiryTracked,
          supplier: state.supplier.trim() || undefined,
          active: state.active,
        });
        const detail = await services.products.getDetail(productId);
        const primary = detail?.variants[0];
        if (primary) {
          await services.products.updateVariant(primary.variant.id, {
            name: state.variantName.trim(),
            packSize: state.packSize,
            unit: state.unit,
            sellingPrice: rupeesToPaise(state.sellingPrice),
            costPrice: state.costPrice == null ? null : rupeesToPaise(state.costPrice),
            barcode: state.barcode.trim() || undefined,
          });
        }
        toast.push('success', t('productForm.updatedSuccess'));
        navigate(`/products/${productId}`, { replace: true });
      } else {
        const newId = await services.products.create({
          name: state.name.trim(),
          localDisplayNames,
          category: state.category,
          unit: state.unit,
          reorderThreshold: state.reorderThreshold,
          expiryTracked: state.expiryTracked,
          supplier: state.supplier.trim() || undefined,
          variant: {
            name: state.variantName.trim(),
            packSize: state.packSize,
            sellingPrice: rupeesToPaise(state.sellingPrice),
            costPrice: state.costPrice == null ? null : rupeesToPaise(state.costPrice),
            barcode: state.barcode.trim() || undefined,
          },
          initialStock: state.initialStock,
        });
        toast.push('success', t('productForm.createdSuccess'));
        navigate(`/products/${newId}`, { replace: true });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[product-form] save failed', err);
      // Form values are preserved — user can retry directly.
      setSubmitError('errors.dbWrite');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <ErrorState errorKey={loadError} onRetry={() => navigate(-1)} />;
  if (!loaded) return <ErrorState onRetry={() => setLoaded(true)} />;

  const priceLabel = (key: 'sellingPrice' | 'costPrice') =>
    key === 'sellingPrice' ? t('productForm.sellingPriceRupees') : t('productForm.costPriceRupees');

  return (
    <>
      <PageHeader title={isEdit ? t('productForm.editTitle') : t('productForm.addTitle')} />

      <form
        className="card stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {submitError ? (
          <div className="alert alert--error" role="alert">
            {t(submitError)}
          </div>
        ) : null}

        <label className="field">
          <span className="field__label">
            {t('productForm.productName')} <span className="muted">({t('common.required')})</span>
          </span>
          <input
            className="input"
            value={state.name}
            placeholder={t('productForm.productNamePlaceholder')}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'err-name' : undefined}
            maxLength={80}
          />
          {errors.name ? (
            <span className="field__error" id="err-name">
              {errors.name}
            </span>
          ) : null}
        </label>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">
              {t('productForm.localDisplayName', { lang: 'தமிழ்' })}{' '}
              <span className="muted">({t('common.optional')})</span>
            </span>
            <input
              className="input"
              value={state.localDisplayNameTa}
              onChange={(e) => set('localDisplayNameTa', e.target.value)}
              maxLength={80}
            />
            <span className="field__hint">{t('productForm.localDisplayNameHint')}</span>
          </label>

          <label className="field">
            <span className="field__label">
              {t('productForm.localDisplayName', { lang: 'हिन्दी' })}{' '}
              <span className="muted">({t('common.optional')})</span>
            </span>
            <input
              className="input"
              value={state.localDisplayNameHi}
              onChange={(e) => set('localDisplayNameHi', e.target.value)}
              maxLength={80}
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('common.category')}</span>
            <select
              className="select"
              value={state.category}
              onChange={(e) => set('category', e.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">{t('common.unit')}</span>
            <select
              className="select"
              value={state.unit}
              onChange={(e) => set('unit', e.target.value as Unit)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`units.${u}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('productForm.variantName')}</span>
            <input
              className="input"
              value={state.variantName}
              placeholder={t('productForm.variantNamePlaceholder')}
              onChange={(e) => set('variantName', e.target.value)}
              aria-invalid={errors.variantName ? true : undefined}
              maxLength={40}
            />
            {errors.variantName ? (
              <span className="field__error">{errors.variantName}</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">
              {t('productForm.packSize', { unit: t(`units.${state.unit}`) })}
            </span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="any"
              value={state.packSize}
              onChange={(e) => set('packSize', Number(e.target.value))}
              aria-invalid={errors.packSize ? true : undefined}
            />
            {errors.packSize ? <span className="field__error">{errors.packSize}</span> : null}
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{priceLabel('sellingPrice')}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={state.sellingPrice}
              onChange={(e) => set('sellingPrice', Number(e.target.value))}
              aria-invalid={errors.sellingPrice ? true : undefined}
            />
            {errors.sellingPrice ? (
              <span className="field__error">{errors.sellingPrice}</span>
            ) : null}
          </label>

          <label className="field">
            <span className="field__label">{priceLabel('costPrice')}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={state.costPrice ?? ''}
              placeholder="—"
              onChange={(e) =>
                set('costPrice', e.target.value === '' ? null : Number(e.target.value))
              }
              aria-invalid={errors.costPrice ? true : undefined}
            />
            <span className="field__hint">{t('productForm.costPriceHint')}</span>
            {errors.costPrice ? <span className="field__error">{errors.costPrice}</span> : null}
          </label>
        </div>

        {!isEdit ? (
          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">{t('productForm.initialStock')}</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={state.initialStock}
                onChange={(e) => set('initialStock', Number(e.target.value))}
                aria-invalid={errors.initialStock ? true : undefined}
              />
              {errors.initialStock ? (
                <span className="field__error">{errors.initialStock}</span>
              ) : null}
            </label>

            <label className="field">
              <span className="field__label">{t('productForm.reorderThreshold')}</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={state.reorderThreshold}
                onChange={(e) => set('reorderThreshold', Number(e.target.value))}
                aria-invalid={errors.reorderThreshold ? true : undefined}
              />
              {errors.reorderThreshold ? (
                <span className="field__error">{errors.reorderThreshold}</span>
              ) : null}
            </label>
          </div>
        ) : (
          <label className="field" style={{ maxWidth: 260 }}>
            <span className="field__label">{t('productForm.reorderThreshold')}</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={state.reorderThreshold}
              onChange={(e) => set('reorderThreshold', Number(e.target.value))}
              aria-invalid={errors.reorderThreshold ? true : undefined}
            />
            {errors.reorderThreshold ? (
              <span className="field__error">{errors.reorderThreshold}</span>
            ) : null}
          </label>
        )}

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">
              {t('productForm.barcode')} <span className="muted">({t('common.optional')})</span>
            </span>
            <input
              className="input"
              value={state.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              maxLength={64}
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('productForm.supplier')} <span className="muted">({t('common.optional')})</span>
            </span>
            <input
              className="input"
              value={state.supplier}
              onChange={(e) => set('supplier', e.target.value)}
              maxLength={80}
            />
          </label>
        </div>

        <div className="checkbox-row">
          <input
            type="checkbox"
            id="expiryTracked"
            checked={state.expiryTracked}
            onChange={(e) => set('expiryTracked', e.target.checked)}
          />
          <label htmlFor="expiryTracked">
            {t('productForm.expiryTracked')}
            <br />
            <span className="field__hint">{t('productForm.expiryTrackedHint')}</span>
          </label>
        </div>

        <div className="checkbox-row">
          <input
            type="checkbox"
            id="productActive"
            checked={state.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <label htmlFor="productActive">{t('common.status')}</label>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(isEdit && productId ? `/products/${productId}` : '/products')}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t('common.loading') : isEdit ? t('productForm.submitSave') : t('productForm.submitAdd')}
          </button>
        </div>
      </form>
    </>
  );
}

export default ProductFormScreen;
