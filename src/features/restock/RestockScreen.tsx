
import { useState, useRef } from 'react';
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
import { restockReasonTranslationKey } from './restockTranslations';

export function RestockScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();

  const [plan, setPlan] = useState<RestockPlan | null>(null);
  const [budgetRupees, setBudgetRupees] = useState(5000);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'form' | 'preview' | 'done'>('form');

  const submitting = useRef(false);

  // Always calculate amounts from current quantities and unit costs.
  const buildCalculatedPlan = (source: RestockPlan): RestockPlan => {
    const items = source.items.map((item) => ({
      ...item,
      lineTotal: item.quantity * item.unitCost,
    }));

    const estimatedTotal = items
      .filter((item) => item.included)
      .reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      ...source,
      items,
      estimatedTotal,
    };
  };

  // Derived calculations from the current plan.
  const includedItems = plan?.items.filter((item) => item.included) ?? [];
  const excludedItems = plan?.items.filter((item) => !item.included) ?? [];

  const totalSpend = includedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  const remainingBudget = budgetRupees * 100 - totalSpend;

  // Generate a new restock recommendation.
  const generate = async () => {
    setErrorKey(null);
    setBusy(true);

    try {
      const result = await getServices().restock.preview({
        budget: budgetRupees * 100,
      });

      setPlan(buildCalculatedPlan(result));
      setPhase('preview');
    } catch (err) {
      console.error('[restock] preview failed', err);
      setErrorKey('errors.dbInit');
    } finally {
      setBusy(false);
    }
  };

  // Recalculate recommendations using the current quantities.
  const recalc = async () => {
    if (!plan || busy) return;

    setErrorKey(null);
    setBusy(true);

    try {
      const result = await getServices().restock.preview({
        budget: budgetRupees * 100,
        overrides: Object.fromEntries(
          plan.items.map((item) => [item.variantId, item.quantity])
        ),
        excluded: Object.fromEntries(
          plan.items.map((item) => [item.variantId, !item.included])
        ),
      });

      setPlan(buildCalculatedPlan(result));
    } catch (err) {
      console.error('[restock] recalc failed', err);
      setErrorKey('errors.dbInit');
    } finally {
      setBusy(false);
    }
  };

  // Update one product quantity immediately.
  const updateQuantity = (variantId: string, quantity: number) => {
    const safeQuantity = Math.max(0, Math.min(9999, Math.floor(quantity)));

    setPlan((current) => {
      if (!current) return null;

      const updated = {
        ...current,
        items: current.items.map((item) =>
          item.variantId === variantId
            ? {
                ...item,
                quantity: safeQuantity,
                lineTotal: safeQuantity * item.unitCost,
              }
            : item
        ),
      };

      return buildCalculatedPlan(updated);
    });
  };

  // Save the latest calculated draft.
  const saveDraft = async () => {
    if (!plan || busy) return;

    setErrorKey(null);
    setBusy(true);

    try {
      const draft = {
        ...buildCalculatedPlan(plan),
        status: 'draft' as const,
      };

      await getServices().restock.save(draft);

      setPlan(draft);
      toast.push('success', t('restock.planSaved'));
    } catch (err) {
      console.error('[restock] save failed', err);
      setErrorKey('errors.dbWrite');
    } finally {
      setBusy(false);
    }
  };

  // Confirm the latest calculated plan.
  const confirmPlan = async () => {
    if (!plan || busy || submitting.current) return;

    submitting.current = true;
    setBusy(true);
    setErrorKey(null);

    try {
      const confirmed = {
        ...buildCalculatedPlan(plan),
        status: 'confirmed' as const,
      };

      await getServices().restock.save(confirmed);

      setPlan(confirmed);
      setPhase('done');

      toast.push('success', t('restock.planConfirmed'));
    } catch (err) {
      console.error('[restock] confirm failed', err);
      setErrorKey('errors.dbWrite');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  // Reset the restock workflow.
  const reset = () => {
    setPlan(null);
    setPhase('form');
    setErrorKey(null);
  };

  // Initial budget form.
  if (phase === 'form') {
    return (
      <>
        <PageHeader title={t('restock.title')} />

        <div className="card stack" style={{ maxWidth: 400 }}>
          <label className="field">
            <span className="field__label">
              {t('restock.budgetRupees')}
            </span>

            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={1}
              step="100"
              value={budgetRupees}
              onChange={(e) =>
                setBudgetRupees(Math.max(0, Number(e.target.value) || 0))
              }
            />

            <span className="field__hint">
              {t('restock.budgetHint')}
            </span>
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

          {errorKey && (
            <div className="alert alert--error">
              {t(errorKey)}
            </div>
          )}
        </div>
      </>
    );
  }

  if (!plan) return <LoadingState />;

  // Confirmed plan screen.
  if (phase === 'done') {
    return (
      <>
        <PageHeader title={t('restock.planConfirmedTitle')} />

        <div className="card stack" role="status">
          <div
            className="row"
            style={{
              gap: 'var(--space-2)',
              color: 'var(--color-success)',
            }}
          >
            <CheckCircle2 size={28} aria-hidden="true" />
            <p className="text-sm">
              {t('restock.planConfirmedNote')}
            </p>
          </div>

          <hr className="divider" />

          <h3 style={{ fontSize: 'var(--text-base)' }}>
            {t('restock.suggestedProducts')}
          </h3>

          <ul
            className="stack stack--tight"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {includedItems.map((item) => (
              <li
                key={item.variantId}
                className="row row--between text-sm"
              >
                <span>
                  {item.quantity} × {item.productName} ({item.variantName})
                </span>

                <span>
                  {formatMoney(
                    item.quantity * item.unitCost,
                    settings.language
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="row row--between">
            <strong>{t('restock.totalSpend')}</strong>

            <strong style={{ fontSize: 'var(--text-lg)' }}>
              {formatMoney(totalSpend, settings.language)}
            </strong>
          </div>

          <div className="row row--between">
            <span className="muted">
              {t('restock.remainingBudget')}
            </span>

            <strong
              style={{
                color:
                  remainingBudget >= 0
                    ? 'var(--color-success)'
                    : 'var(--color-danger)',
              }}
            >
              {formatMoney(remainingBudget, settings.language)}
            </strong>
          </div>

          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={reset}
            >
              {t('common.done')}
            </button>

            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => setPhase('preview')}
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Restock preview screen.
  return (
    <>
      <PageHeader
        title={t('restock.title')}
        actions={
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={reset}
          >
            {t('common.back')}
          </button>
        }
      />

      <div className="card section mb-4">
        <h3 className="card__title">
          {t('restock.enterBudget')}
        </h3>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={1}
            step="100"
            value={budgetRupees}
            onChange={(e) =>
              setBudgetRupees(Math.max(0, Number(e.target.value) || 0))
            }
            style={{ maxWidth: 180 }}
          />

          <span className="muted">₹</span>

          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void recalc()}
            disabled={busy || budgetRupees < 1}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t('restock.recalculate')}
          </button>
        </div>

        <p className="text-xs muted">
          {t('restock.budgetHint')}
        </p>
      </div>

      {plan.assumptions && (
        <div className="alert alert--info mb-4" role="note">
          <strong>{t('restock.assumptions')}</strong>

          <ul
            className="stack stack--tight"
            style={{
              margin: 'var(--space-2) 0 0',
              paddingLeft: 20,
            }}
          >
            <li>
              {t('restock.assumptionDemand', {
                days: plan.assumptions.lookbackDays,
              })}
            </li>

            <li>
              {t('restock.assumptionLead', {
                days: plan.assumptions.leadTimeDays,
              })}
            </li>

            <li>
              {t('restock.assumptionSafety', {
                days: plan.assumptions.safetyDays,
              })}
            </li>
          </ul>
        </div>
      )}

      <section
        className="card section"
        aria-label={t('restock.suggestedProducts')}
      >
        <h2 className="card__title">
          {t('restock.suggestedProducts')}{' '}
          <span className="badge badge--neutral">
            {includedItems.length}
          </span>
        </h2>

        <ul
          className="stack stack--tight"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {includedItems.map((item) => (
            <li key={item.variantId} className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">
                  {item.productName}{' '}
                  <span className="muted">
                    ({item.variantName})
                  </span>
                </div>

                <div className="list-row__meta">
                  {t('restock.unitCost')}:{' '}
                  {formatMoney(item.unitCost, settings.language)}
                  {' · '}
                  {t('restock.priority')}: #{item.priority}

                  {item.budgetAdjusted && (
                    <span className="badge badge--warning">
                      {t('restock.reasonBudgetLimit')}
                    </span>
                  )}
                </div>
              </div>

              <div className="list-row__end">
                <QuantityStepper
                  value={item.quantity}
                  onChange={(value) =>
                    updateQuantity(item.variantId, value)
                  }
                  min={0}
                  max={9999}
                  label={`${item.productName} qty`}
                />
              </div>

              <div className="text-right">
                <strong>
                  {formatMoney(
                    item.quantity * item.unitCost,
                    settings.language
                  )}
                </strong>
              </div>
            </li>
          ))}
        </ul>

        <div className="row row--between mt-3">
          <strong>{t('restock.totalSpend')}</strong>

          <strong style={{ fontSize: 'var(--text-lg)' }}>
            {formatMoney(totalSpend, settings.language)}
          </strong>
        </div>

        <div className="row row--between">
          <span className="muted">
            {t('restock.remainingBudget')}
          </span>

          <strong
            style={{
              color:
                remainingBudget >= 0
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
            }}
          >
            {formatMoney(remainingBudget, settings.language)}
          </strong>
        </div>

        {remainingBudget < 0 && (
          <div className="alert alert--warning mt-3" role="alert">
            Your selected quantities exceed the available budget.
          </div>
        )}

        {errorKey && (
          <div className="alert alert--error mt-3">
            {t(errorKey)}
          </div>
        )}

        <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={() => void confirmPlan()}
            disabled={
              busy ||
              includedItems.length === 0 ||
              remainingBudget < 0
            }
          >
            {busy
              ? t('common.loading')
              : t('restock.confirmPlan')}
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => void saveDraft()}
            disabled={busy}
          >
            {t('restock.draftPlan')}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={reset}
          >
            {t('common.cancel')}
          </button>
        </div>
      </section>

      {excludedItems.length > 0 && (
        <section
          className="card section"
          aria-label={t('restock.excludedTitle')}
        >
          <h2 className="card__title">
            {t('restock.excludedTitle')}{' '}
            <span className="badge badge--neutral">
              {excludedItems.length}
            </span>
          </h2>

          <ul
            className="stack stack--tight"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {excludedItems.map((item) => (
              <li key={item.variantId} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">
                    {item.productName}{' '}
                    <span className="muted">
                      ({item.variantName})
                    </span>
                  </div>

                  <div className="list-row__meta">
                    {item.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="badge badge--neutral mr-1"
                      >
                        {t(restockReasonTranslationKey(reason))}
                      </span>
                    ))}
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
