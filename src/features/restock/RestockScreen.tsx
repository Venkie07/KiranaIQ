import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/Badges';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { LoadingState } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { formatMoney } from '@/domain/money';
import type { RestockPlan } from '@/domain/types';

export function RestockScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();
  const [plan, setPlan] = useState<RestockPlan | null>(null);
  const [budgetRupees, setBudgetRupees] = useState(5000);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'form' | 'preview' | 'done'>('form');
  const submitting = { current: false };

  const generate = async () => {
    setErrorKey(null);
    setBusy(true);
    try {
      const result = await getServices().restock.preview({ budget: budgetRupees * 100 });
      setPlan(result);
      setPhase('preview');
    } catch (err) {
      console.error('[restock] preview failed', err);
      setErrorKey('errors.dbInit');
    } finally { setBusy(false); }
  };

  const recalc = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const result = await getServices().restock.preview({
        budget: budgetRupees * 100,
        overrides: Object.fromEntries(plan.items.map(i => [i.variantId, i.quantity])),
        excluded: Object.fromEntries(plan.items.map(i => [i.variantId, !i.included])),
      });
      setPlan(result);
    } catch (err) {
      console.error('[restock] recalc failed', err);
      setErrorKey('errors.dbInit');
    } finally { setBusy(false); }
  };

  const saveDraft = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await getServices().restock.save({ ...plan, status: 'draft' });
      toast.push('success', t('restock.planSaved'));
    } catch (err) {
      console.error('[restock] save failed', err);
      setErrorKey('errors.dbWrite');
    } finally { setBusy(false); }
  };

  const confirmPlan = async () => {
    if (!plan || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const confirmed = { ...plan, status: 'confirmed' as const };
      await getServices().restock.save(confirmed);
      toast.push('success', t('restock.planConfirmed'));
      setPlan(confirmed);
    } catch (err) {
      console.error('[restock] confirm failed', err);
      setErrorKey('errors.dbWrite');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setPlan(null);
    setPhase('form');
    setErrorKey(null);
  };

  if (phase === 'form') {
    return (
      <>
        <PageHeader title={t('restock.title')} />
        <div className="card stack" style={{ maxWidth: 400 }}>
          <label className="field">
            <span className="field__label">{t('restock.budgetRupees')}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={1}
              step="100"
              value={budgetRupees}
              onChange={(e) => setBudgetRupees(Number(e.target.value))}
            />
            <span className="field__hint">{t('restock.budgetHint')}</span>
          </label>
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={generate}
            disabled={busy || budgetRupees < 10}
          >
            <RefreshCw size={18} aria-hidden="true" />
            {busy ? t('common.loading') : t('restock.generate')}
          </button>
          {errorKey && <div className="alert alert--error">{t(errorKey)}</div>}
        </div>
      </>
    );
  }

  if (!plan) return <LoadingState />;

  const includedItems = plan.items.filter((i) => i.included);
  const excludedItems = plan.items.filter((i) => !i.included);

  if (phase === 'done') {
    return (
      <>
        <PageHeader title={t('restock.planConfirmed')} />
        <div className="card stack" role="status">
          <div className="row" style={{ gap: 'var(--space-2)', color: 'var(--color-success)' }}>
            <CheckCircle2 size={28} aria-hidden="true" />
            <h2>{t('restock.planConfirmed')}</h2>
          </div>
          <p className="muted text-sm">{t('restock.planConfirmed')}</p>
          <hr className="divider" />
          <h3 style={{ fontSize: 'var(--text-base)' }}>{t('restock.suggestedProducts')}</h3>
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {includedItems.map((item) => (
              <li key={item.variantId} className="row row--between text-sm">
                <span>
                  {item.quantity} × {item.productName} ({item.variantName})
                </span>
                <span>{formatMoney(item.lineTotal, settings.language)}</span>
              </li>
            ))}
          </ul>
          <div className="row row--between">
            <strong>{t('restock.totalSpend')}</strong>
            <strong style={{ fontSize: 'var(--text-lg)' }}>
              {formatMoney(plan.estimatedTotal, settings.language)}
            </strong>
          </div>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--primary btn--block" onClick={reset}>
              {t('common.done')}
            </button>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => setPhase('preview')}>
              {t('common.back')}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('restock.title')}
        actions={
          <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
            {t('common.back')}
          </button>
        }
      />

      <div className="card section mb-4">
        <h3 className="card__title">{t('restock.enterBudget')}</h3>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={1}
            step="100"
            value={budgetRupees}
            onChange={(e) => setBudgetRupees(Number(e.target.value))}
            style={{ maxWidth: 180 }}
          />
          <span className="muted">₹</span>
          <button type="button" className="btn btn--primary" onClick={recalc} disabled={busy}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('restock.recalculate')}
          </button>
        </div>
        <p className="text-xs muted">{t('restock.budgetHint')}</p>
      </div>

      {plan.assumptions && (
        <div className="alert alert--info mb-4" role="note">
          <strong>{t('restock.assumptions')}</strong>
          <ul className="stack stack--tight" style={{ margin: 'var(--space-2) 0 0', paddingLeft: 20 }}>
            <li>{t('restock.assumptionDemand', { days: plan.assumptions.lookbackDays })}</li>
            <li>{t('restock.assumptionLead', { days: plan.assumptions.leadTimeDays })}</li>
            <li>{t('restock.assumptionSafety', { days: plan.assumptions.safetyDays })}</li>
          </ul>
        </div>
      )}

      <section className="card section" aria-label={t('restock.suggestedProducts')}>
        <h2 className="card__title">
          {t('restock.suggestedProducts')} <span className="badge badge--neutral">{includedItems.length}</span>
        </h2>
        <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {includedItems.map((item) => (
            <li key={item.variantId} className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">{item.productName} <span className="muted">({item.variantName})</span></div>
                <div className="list-row__meta">
                  {t('restock.unitCost')}: {formatMoney(item.unitCost, settings.language)} ·
                  {t('restock.priority')}: #{item.priority}
                  {item.budgetAdjusted && <span className="badge badge--warning">{t('restock.reasonBudgetLimit')}</span>}
                </div>
              </div>
              <div className="list-row__end">
                <QuantityStepper
                  value={item.quantity}
                  onChange={(v) => setPlan(p => p ? { ...p, items: p.items.map(i => i.variantId === item.variantId ? { ...i, quantity: v } : i) } : null)}
                  min={0}
                  max={9999}
                  label={`${item.productName} qty`}
                />
                </div>
                <div className="text-right">
                  <strong>{formatMoney(item.lineTotal, settings.language)}</strong>
                </div>
              </li>
          ))}
        </ul>
        <div className="row row--between mt-3">
          <strong>{t('restock.totalSpend')}</strong>
          <strong style={{ fontSize: 'var(--text-lg)' }}>
            {formatMoney(plan.estimatedTotal, settings.language)}
          </strong>
        </div>
        <div className="row row--between">
          <span className="muted">{t('restock.remainingBudget')}</span>
          <strong style={{ color: plan.remainingBudget >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatMoney(plan.remainingBudget, settings.language)}
          </strong>
        </div>
        {errorKey && <div className="alert alert--error mt-3">{t(errorKey)}</div>}
        <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => void confirmPlan()} disabled={busy || includedItems.length === 0}>
            {busy ? t('common.loading') : t('restock.confirmPlan')}
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={saveDraft} disabled={busy}>
            {t('restock.draftPlan')}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={reset}>
            {t('common.cancel')}
          </button>
        </div>
      </section>

      {excludedItems.length > 0 && (
        <section className="card section" aria-label={t('restock.excludedTitle')}>
          <h2 className="card__title">
            {t('restock.excludedTitle')} <span className="badge badge--neutral">{excludedItems.length}</span>
          </h2>
          <ul className="stack stack--tight" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {excludedItems.map((item) => (
              <li key={item.variantId} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{item.productName} <span className="muted">({item.variantName})</span></div>
                  <div className="list-row__meta">
                    {item.reasons.map((r) => <span key={r} className="badge badge--neutral mr-1">{t(`restock.reason${r.charAt(0).toUpperCase() + r.slice(1)}`)}</span>)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
export default RestockScreen;