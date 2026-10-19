import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, DemoBadge } from '@/components/common/Badges';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, SkeletonRow } from '@/components/feedback/States';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { formatDateTime, todayISODate } from '@/domain/dates';
import { correctionFormSchema } from '@/domain/validation';
import { MOVEMENT_TYPES } from '@/domain/validation';
import type { MovementType } from '@/domain/types';
import type { ProductStockView, StockMovementView } from '@/services/interfaces';

/**
 * Stock history: ledger of opening stock, purchases, sales, returns,
 * damage, expiry write-offs and corrections, with type + date filters.
 * Corrections APPEND a new movement (originals are never edited).
 */
export function MovementsScreen() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const toast = useToast();

  const [rows, setRows] = useState<StockMovementView[] | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<MovementType | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Correction dialog state
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [products, setProducts] = useState<ProductStockView[]>([]);
  const [variantId, setVariantId] = useState('');
  const [newQty, setNewQty] = useState(0);
  const [reason, setReason] = useState('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const load = useCallback(() => {
    setErrorKey(null);
    setRows(null);
    getServices()
      .movements.list({
        movementType: typeFilter,
        from: from || undefined,
        to: to || undefined,
      })
      .then(setRows)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[movements] load failed', err);
        setErrorKey('errors.dbInit');
      });
  }, [typeFilter, from, to]);

  useEffect(load, [load]);

  const openCorrection = async () => {
    setCorrectionOpen(true);
    setCorrectionError(null);
    setReason('');
    if (products.length === 0) {
      try {
        const list = await getServices().products.list();
        setProducts(list);
        if (list[0]) {
          setVariantId(list[0].variant.id);
          setNewQty(list[0].totalStock);
        }
      } catch {
        setCorrectionError('errors.dbInit');
      }
    }
  };

  const onPickVariant = (id: string) => {
    setVariantId(id);
    const row = products.find((p) => p.variant.id === id);
    // Corrections target the movement-ledger total (not usable stock).
    if (row) setNewQty(row.totalStock);
  };

  const submitCorrection = async () => {
    if (submitting.current) return;
    const parsed = correctionFormSchema.safeParse({ variantId, newQuantity: newQty, reason });
    if (!parsed.success) {
      setCorrectionError(t(parsed.error.issues[0]?.message ?? 'errors.generic'));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setCorrectionError(null);
    try {
      await getServices().movements.correct({
        variantId: parsed.data.variantId,
        newQuantity: parsed.data.newQuantity,
        reason: parsed.data.reason,
      });
      toast.push('success', t('movements.correctionSuccess'));
      setCorrectionOpen(false);
      load();
    } catch (err) {
      const key = (err as { i18nKey?: string }).i18nKey ?? 'errors.dbWrite';
      setCorrectionError(t(key));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const typeLabel = (type: MovementType) =>
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
        title={t('movements.title')}
        actions={
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => void openCorrection()}>
            {t('movements.correctionTitle')}
          </button>
        }
      />

      <div className="stack mb-4">
        <label className="field">
          <span className="field__label">{t('movements.typeFilter')}</span>
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MovementType | 'all')}
          >
            <option value="all">{t('common.all')}</option>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('movements.dateFrom')}</span>
            <input
              className="input"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('movements.dateTo')}</span>
            <input
              className="input"
              type="date"
              value={to}
              min={from || undefined}
              max={todayISODate()}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        {(from || to) && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            {t('common.clear')}
          </button>
        )}
      </div>

      {errorKey ? (
        <ErrorState errorKey={errorKey} onRetry={load} />
      ) : !rows ? (
        <div className="stack">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('states.noResults')} body={t('movements.empty')} />
      ) : (
        <div className="stack">
          {rows.map((m) => (
            <div key={m.id} className="list-row">
              <div className="list-row__main">
                <div className="list-row__title" style={{ fontSize: 'var(--text-sm)' }}>
                  {m.productName} <span className="muted">({m.variantName})</span>{' '}
                  {m.demo ? <DemoBadge /> : null}
                </div>
                <div className="list-row__meta">
                  {typeLabel(m.movementType)} · {formatDateTime(m.timestamp, settings.language)}
                </div>
                <div className="list-row__meta">{m.reason}</div>
              </div>
              <div className="list-row__end">
                <span
                  className={`badge ${m.signedQuantity < 0 ? 'badge--out' : 'badge--ok'}`}
                  aria-label={`${t('movements.changeColumn')}: ${m.signedQuantity}`}
                >
                  {m.signedQuantity > 0 ? '+' : ''}
                  {m.signedQuantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={correctionOpen}
        title={t('movements.correctionTitle')}
        confirmLabel={t('movements.submitCorrection')}
        busy={busy}
        onConfirm={() => void submitCorrection()}
        onCancel={() => setCorrectionOpen(false)}
        body={
          <div className="stack">
            <p>{t('movements.correctionIntro')}</p>

            <label className="field">
              <span className="field__label">{t('common.product')}</span>
              <select
                className="select"
                value={variantId}
                onChange={(e) => onPickVariant(e.target.value)}
              >
                {products.map((row) => (
                  <option key={row.variant.id} value={row.variant.id}>
                    {row.product.name} — {row.variant.name} ({row.totalStock})
                  </option>
                ))}
              </select>
            </label>

            <div className="row row--between">
              <span className="field__label">{t('movements.newQuantity')}</span>
              <QuantityStepper
                value={newQty}
                onChange={setNewQty}
                min={0}
                label={t('movements.newQuantity')}
              />
            </div>

            <label className="field">
              <span className="field__label">{t('movements.reason')}</span>
              <input
                className="input"
                value={reason}
                placeholder={t('movements.reasonPlaceholder')}
                onChange={(e) => setReason(e.target.value)}
                maxLength={120}
              />
            </label>

            {correctionError ? (
              <div className="alert alert--error" role="alert">
                {correctionError}
              </div>
            ) : null}
          </div>
        }
      />
    </>
  );
}

export default MovementsScreen;
