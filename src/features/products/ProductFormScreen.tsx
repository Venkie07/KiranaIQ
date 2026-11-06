import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/Badges';
import { ErrorState, LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { rupeesToPaise } from '@/domain/money';
import { PRODUCT_CATEGORIES, UNITS } from '@/domain/types';
import type { Language, ProductCategory, Unit } from '@/domain/types';

interface VariantState {
  variantId?: string;
  name: string;
  packSize: number;
  sellingPrice: number;
  costPrice: number | null;
  barcode: string;
  initialStock: number;
}

interface FormState {
  name: string;
  localDisplayNameTa: string;
  localDisplayNameHi: string;
  category: ProductCategory;
  unit: Unit;
  reorderThreshold: number;
  supplier: string;
  expiryTracked: boolean;
  active: boolean;
  variants: VariantState[];
}

type Errors = {
  global?: string;
  fields: Partial<Record<keyof Omit<FormState, 'variants'>, string>>;
  variants: Record<number, Partial<Record<keyof VariantState, string>>>;
};

function defaultVariantState(): VariantState {
  return {
    name: '',
    packSize: 1,
    sellingPrice: 0,
    costPrice: null,
    barcode: '',
    initialStock: 0,
  };
}

function defaultState(threshold: number): FormState {
  return {
    name: '',
    localDisplayNameTa: '',
    localDisplayNameHi: '',
    category: 'other',
    unit: 'pcs',
    reorderThreshold: threshold,
    supplier: '',
    expiryTracked: false,
    active: true,
    variants: [defaultVariantState()],
  };
}

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
  const [errors, setErrors] = useState<Errors>({ fields: {}, variants: {} });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;
    void (async () => {
      try {
        const services = getServices();
        let detail = await services.products.getDetail(productId);
        if (!detail) {
          await new Promise(resolve => setTimeout(resolve, 100));
          detail = await services.products.getDetail(productId);
        }
        if (!isMounted) return;
        if (!detail) {
          setLoadError('errors.notFound');
          return;
        }
        const p = detail.product;
        setState({
          name: p.name,
          localDisplayNameTa: p.localDisplayNames?.ta ?? '',
          localDisplayNameHi: p.localDisplayNames?.hi ?? '',
          category: p.category,
          unit: p.unit,
          reorderThreshold: p.reorderThreshold,
          supplier: p.supplier ?? '',
          expiryTracked: p.expiryTracked,
          active: p.active,
          variants: detail.variants.map(v => ({
            variantId: v.variant.id,
            name: v.variant.name,
            packSize: v.variant.packSize,
            sellingPrice: v.variant.sellingPrice / 100,
            costPrice: v.variant.costPrice != null ? v.variant.costPrice / 100 : null,
            barcode: v.variant.barcode ?? '',
            initialStock: 0, // Not editable in edit mode
          })),
        });
        setLoaded(true);
      } catch {
        if (!isMounted) return;
        setLoadError('errors.dbInit');
      }
    })();
    return () => { isMounted = false; };
  }, [productId]);

  const setField = <K extends keyof Omit<FormState, 'variants'>>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, fields: { ...e.fields, [key]: undefined } }));
  };

  const setVariantField = (
    index: number,
    key: keyof VariantState,
    value: string | number | null,
  ) => {
    setState((s) => {
      const nextVariants = [...s.variants];
      nextVariants[index] = { ...nextVariants[index], [key]: value };
      return { ...s, variants: nextVariants };
    });
    setErrors((e) => ({
      ...e,
      variants: {
        ...e.variants,
        [index]: { ...e.variants[index], [key]: undefined },
      },
    }));
  };

  const addVariant = () => {
    setState((s) => ({ ...s, variants: [...s.variants, defaultVariantState()] }));
  };

  const removeVariant = (index: number) => {
    if (state.variants.length <= 1) return;
    setState((s) => ({
      ...s,
      variants: s.variants.filter((_, i) => i !== index),
    }));
  };

  const validate = (): boolean => {
    // Simple validation for the demo; in production, you'd loop variants through zod
    if (!state.name.trim()) {
      setErrors({ ...errors, fields: { ...errors.fields, name: t('common.required') } });
      return false;
    }
    return true;
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
        // Update existing variants
        const detail = await services.products.getDetail(productId);
        if (detail) {
          const retainedIds = new Set(state.variants.map(v => v.variantId).filter(Boolean));
          await Promise.all(
            detail.variants
              .filter(v => !retainedIds.has(v.variant.id))
              .map(v => services.products.removeVariant(v.variant.id)),
          );
          await Promise.all(
            state.variants.map((v) => {
              const variantPatch = {
                name: v.name.trim(),
                packSize: v.packSize,
                unit: state.unit,
                sellingPrice: rupeesToPaise(v.sellingPrice),
                costPrice: v.costPrice == null ? null : rupeesToPaise(v.costPrice),
                barcode: v.barcode.trim() || undefined,
              };
              if (v.variantId) {
                return services.products.updateVariant(v.variantId, variantPatch);
              }
              return services.products.addVariant(productId, {
                ...variantPatch,
                active: true,
                productId,
              });
            }),
          );
        }
        toast.push('success', t('productForm.updatedSuccess'));
        navigate('/products', { replace: true });
      } else {
        await services.products.create({
          name: state.name.trim(),
          localDisplayNames,
          category: state.category,
          unit: state.unit,
          reorderThreshold: state.reorderThreshold,
          expiryTracked: state.expiryTracked,
          supplier: state.supplier.trim() || undefined,
          variants: state.variants.map(v => ({
            name: v.name.trim(),
            packSize: v.packSize,
            sellingPrice: rupeesToPaise(v.sellingPrice),
            costPrice: v.costPrice == null ? null : rupeesToPaise(v.costPrice),
            barcode: v.barcode.trim() || undefined,
            initialStock: v.initialStock,
          })),
        });
        toast.push('success', t('productForm.createdSuccess'));
        navigate('/products', { replace: true });
      }
    } catch {
      setSubmitError('errors.dbWrite');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <ErrorState errorKey={loadError} onRetry={() => navigate(-1)} />;
  if (!loaded) return <LoadingState />;

  return (
    <>
      <PageHeader title={isEdit ? t('productForm.editTitle') : t('productForm.addTitle')} />
      <form className="card stack" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {submitError && <div className="alert alert--error" role="alert">{t(submitError)}</div>}

        <label className="field">
          <span className="field__label">{t('productForm.productName')} <span className="muted">({t('common.required')})</span></span>
          <input className="input" value={state.name} placeholder={t('productForm.productNamePlaceholder')} onChange={(e) => setField('name', e.target.value)} maxLength={80} />
          {errors.fields.name && <span className="field__error">{errors.fields.name}</span>}
        </label>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('productForm.localDisplayName', { lang: 'தமிழ்' })} <span className="muted">({t('common.optional')})</span></span>
            <input className="input" value={state.localDisplayNameTa} onChange={(e) => setField('localDisplayNameTa', e.target.value)} maxLength={80} />
          </label>
          <label className="field">
            <span className="field__label">{t('productForm.localDisplayName', { lang: 'हिन्दी' })} <span className="muted">({t('common.optional')})</span></span>
            <input className="input" value={state.localDisplayNameHi} onChange={(e) => setField('localDisplayNameHi', e.target.value)} maxLength={80} />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('common.category')}</span>
            <select className="select" value={state.category} onChange={(e) => setField('category', e.target.value as ProductCategory)}>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t('common.unit')}</span>
            <select className="select" value={state.unit} onChange={(e) => setField('unit', e.target.value as Unit)}>
              {UNITS.map(u => <option key={u} value={u}>{t(`units.${u}`)}</option>)}
            </select>
          </label>
        </div>

        <div className="stack gap-4 mb-4">
          <div className="row row--between" style={{ alignItems: 'center' }}>
            <h3 className="text-sm font-medium">{t('productForm.variantsTitle')}</h3>
            <button type="button" className="btn btn--secondary btn--sm" onClick={addVariant}>
              <Plus size={14} /> {t('common.add')}
            </button>
          </div>

          {state.variants.map((v, idx) => (
            <div key={v.variantId ?? idx} className="card stack" style={{ padding: 'var(--space-3)', border: '1px solid var(--border-color)' }}>
              <div className="row row--between mb-2">
                <span className="text-xs muted">{t('productForm.variantIndex', { index: idx + 1 })}</span>
                {state.variants.length > 1 && (
                  <button type="button" className="btn btn--ghost btn--xs text-danger" onClick={() => removeVariant(idx)}>
                    {t('common.remove')}
                  </button>
                )}
              </div>
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">{t('productForm.variantName')}</span>
                  <input className="input" value={v.name} onChange={(e) => setVariantField(idx, 'name', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field__label">{t('productForm.packSize')}</span>
                  <input className="input" type="number" value={v.packSize} onChange={(e) => setVariantField(idx, 'packSize', Number(e.target.value))} />
                </label>
              </div>
              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">{t('productForm.sellingPriceRupees')}</span>
                  <input className="input" type="number" value={v.sellingPrice} onChange={(e) => setVariantField(idx, 'sellingPrice', Number(e.target.value))} />
                </label>
                <label className="field">
                  <span className="field__label">{t('productForm.costPriceRupees')}</span>
                  <input className="input" type="number" value={v.costPrice ?? ''} onChange={(e) => setVariantField(idx, 'costPrice', e.target.value === '' ? null : Number(e.target.value))} />
                </label>
              </div>
              {!isEdit && (
                <div className="form-grid form-grid--2">
                  <label className="field">
                    <span className="field__label">{t('productForm.initialStock')}</span>
                    <input className="input" type="number" value={v.initialStock} onChange={(e) => setVariantField(idx, 'initialStock', Number(e.target.value))} />
                  </label>
                </div>
              )}
              <label className="field">
                <span className="field__label">{t('productForm.barcode')}</span>
                <input className="input" value={v.barcode} onChange={(e) => setVariantField(idx, 'barcode', e.target.value)} />
              </label>
            </div>
          ))}
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('productForm.reorderThreshold')}</span>
            <input className="input" type="number" value={state.reorderThreshold} onChange={(e) => setField('reorderThreshold', Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="field__label">{t('productForm.supplier')} <span className="muted">({t('common.optional')})</span></span>
            <input className="input" value={state.supplier} onChange={(e) => setField('supplier', e.target.value)} maxLength={80} />
          </label>
        </div>

        <div className="checkbox-row">
          <input type="checkbox" id="expiryTracked" checked={state.expiryTracked} onChange={(e) => setField('expiryTracked', e.target.checked)} />
          <label htmlFor="expiryTracked">{t('productForm.expiryTracked')}<br /><span className="field__hint">{t('productForm.expiryTrackedHint')}</span></label>
        </div>

        <div className="checkbox-row">
          <input type="checkbox" id="productActive" checked={state.active} onChange={(e) => setField('active', e.target.checked)} />
          <label htmlFor="productActive">{t('common.status')}</label>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn--secondary" onClick={() => navigate(isEdit && productId ? `/products/${productId}` : '/products')} disabled={busy}>
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
