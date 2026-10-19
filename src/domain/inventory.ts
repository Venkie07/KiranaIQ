import type {
  ExpiryAlert,
  LowStockAlert,
  Product,
  ProductVariant,
  SlowMovingProduct,
  StockBatch,
  StockMovement,
  StockStatus,
} from './types';
import { daysUntilExpiry } from './dates';

/**
 * Current stock for a variant = sum of the movement ledger.
 * The ledger is the single source of truth; there is no independently
 * editable "stock" field.
 */
export function computeStockFromMovements(
  movements: StockMovement[],
  variantId: string,
): number {
  return movements
    .filter((m) => m.variantId === variantId)
    .reduce((sum, m) => sum + m.signedQuantity, 0);
}

/** Sum of ledger entries grouped by variant id. */
export function computeAllStock(movements: StockMovement[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    map.set(m.variantId, (map.get(m.variantId) ?? 0) + m.signedQuantity);
  }
  return map;
}

/**
 * Usable stock = ledger stock minus quantities remaining in batches whose
 * expiry date has passed (when expiry data is known).
 */
export function computeUsableStock(
  totalStock: number,
  batches: StockBatch[],
  variantId: string,
  now = new Date(),
): number {
  const expired = batches
    .filter(
      (b) => b.variantId === variantId && b.expiryDate && daysUntilExpiry(b.expiryDate, now) < 0,
    )
    .reduce((sum, b) => sum + b.remainingQuantity, 0);
  return Math.max(0, totalStock - expired);
}

/** Remaining quantity of already-expired batches for a variant. */
export function expiredBatchQuantity(
  batches: StockBatch[],
  variantId: string,
  now = new Date(),
): number {
  return batches
    .filter(
      (b) => b.variantId === variantId && b.expiryDate && daysUntilExpiry(b.expiryDate, now) < 0,
    )
    .reduce((sum, b) => sum + b.remainingQuantity, 0);
}

/** Low-stock classification against the product's reorder threshold. */
export function stockStatus(usableStock: number, reorderThreshold: number): StockStatus {
  if (usableStock <= 0) return 'out';
  if (usableStock <= reorderThreshold) return 'low';
  return 'ok';
}

/**
 * Reorder quantity:
 *   max(0, expectedDemandDuringLeadTime + safetyStock - usableStock - confirmedIncoming)
 * `expectedDemand` and `safetyStock` are caller-computed (in packs).
 * Result is rounded up to a whole pack (quantities are integers anyway).
 */
export function reorderQuantity(input: {
  expectedDemand: number;
  safetyStock: number;
  usableStock: number;
  confirmedIncoming: number;
}): number {
  const raw =
    input.expectedDemand + input.safetyStock - input.usableStock - input.confirmedIncoming;
  return Math.max(0, Math.ceil(raw));
}

/** Round a pack quantity up to a multiple of `packMultiple` (min 1). */
export function roundUpToPack(quantity: number, packMultiple: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const multiple = Number.isFinite(packMultiple) && packMultiple > 0 ? Math.floor(packMultiple) : 1;
  if (multiple <= 1) return Math.ceil(quantity);
  return Math.ceil(quantity / multiple) * multiple;
}

/* ------------------------------------------------------------------ */
/* Alert builders (pure, deterministic)                                */
/* ------------------------------------------------------------------ */

export interface VariantContext {
  product: Product;
  variant: ProductVariant;
  totalStock: number;
  usableStock: number;
}

/** Build low-stock alerts from variant contexts. */
export function buildLowStockAlerts(contexts: VariantContext[]): LowStockAlert[] {
  const alerts: LowStockAlert[] = [];
  for (const ctx of contexts) {
    const status = stockStatus(ctx.usableStock, ctx.product.reorderThreshold);
    if (status === 'ok') continue;
    alerts.push({
      productId: ctx.product.id,
      variantId: ctx.variant.id,
      productName: ctx.product.name,
      variantName: ctx.variant.name,
      currentStock: ctx.usableStock,
      reorderThreshold: ctx.product.reorderThreshold,
      status,
    });
  }
  // Out-of-stock first, then lowest stock ratio.
  alerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'out' ? -1 : 1;
    return a.currentStock - b.currentStock;
  });
  return alerts;
}

/** Classify expiry risk for a batch with a known expiry date. */
export function classifyExpiryRisk(
  expiryDate: string,
  warningDays: number,
  now = new Date(),
): { risk: ExpiryAlert['risk']; daysUntilExpiry: number } {
  const days = daysUntilExpiry(expiryDate, now);
  if (days < 0) return { risk: 'expired', daysUntilExpiry: days };
  if (days <= Math.max(1, Math.floor(warningDays / 3))) return { risk: 'critical', daysUntilExpiry: days };
  if (days <= warningDays) return { risk: 'warning', daysUntilExpiry: days };
  return { risk: 'upcoming', daysUntilExpiry: days };
}

/** Build expiry alerts for batches that still have quantity. */
export function buildExpiryAlerts(input: {
  batches: StockBatch[];
  products: Product[];
  variants: ProductVariant[];
  warningDays: number;
  now?: Date;
}): ExpiryAlert[] {
  const now = input.now ?? new Date();
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const variantById = new Map(input.variants.map((v) => [v.id, v]));
  const alerts: ExpiryAlert[] = [];
  for (const batch of input.batches) {
    if (!batch.expiryDate || batch.remainingQuantity <= 0) continue;
    const { risk, daysUntilExpiry: days } = classifyExpiryRisk(batch.expiryDate, input.warningDays, now);
    if (risk === 'upcoming') continue;
    const variant = variantById.get(batch.variantId);
    const product = productById.get(batch.productId) ?? (variant && productById.get(variant.productId));
    if (!variant || !product) continue;
    alerts.push({
      batchId: batch.id,
      variantId: batch.variantId,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      batchCode: batch.batchCode,
      quantity: batch.remainingQuantity,
      expiryDate: batch.expiryDate,
      daysUntilExpiry: days,
      risk,
    });
  }
  const order = { expired: 0, critical: 1, warning: 2, upcoming: 3 } as const;
  alerts.sort((a, b) => order[a.risk] - order[b.risk] || a.daysUntilExpiry - b.daysUntilExpiry);
  return alerts;
}

export interface SalesHistoryEntry {
  variantId: string;
  /** ISO timestamp of the sale. */
  timestamp: string;
  quantity: number;
}

/**
 * Slow-moving detection.
 *
 * - Product younger than the window with no sales → `no-sales-history`
 *   (reported, but NOT counted as a slow-moving dead-stock problem).
 * - Product with at least `windowDays` of history and ≤ 1 sale in the
 *   window → `no-recent-sales` (genuinely slow).
 * - Variants with no stock and no sales are skipped (nothing to flag).
 */
export function buildSlowMovingProducts(input: {
  contexts: VariantContext[];
  sales: SalesHistoryEntry[];
  windowDays: number;
  now?: Date;
}): SlowMovingProduct[] {
  const now = input.now ?? new Date();
  const windowStart = now.getTime() - input.windowDays * 86_400_000;
  const results: SlowMovingProduct[] = [];

  for (const ctx of input.contexts) {
    if (!ctx.variant.active || !ctx.product.active) continue;
    const variantSales = input.sales.filter((s) => s.variantId === ctx.variant.id);
    const inWindow = variantSales.filter((s) => Date.parse(s.timestamp) >= windowStart);
    const salesCount = inWindow.reduce((sum, s) => sum + s.quantity, 0);
    const lastSale = variantSales.reduce<string | null>(
      (latest, s) => (latest === null || s.timestamp > latest ? s.timestamp : latest),
      null,
    );
    const createdAt = Date.parse(ctx.product.createdAt);
    const historyDays = (now.getTime() - createdAt) / 86_400_000;
    const hasStock = ctx.usableStock > 0;

    if (salesCount === 0 && hasStock) {
      if (historyDays < input.windowDays) {
        results.push({
          productId: ctx.product.id,
          variantId: ctx.variant.id,
          productName: ctx.product.name,
          variantName: ctx.variant.name,
          currentStock: ctx.usableStock,
          salesCount,
          windowDays: input.windowDays,
          lastSaleAt: lastSale,
          reason: 'no-sales-history',
        });
      } else if (lastSale === null || lastSale < new Date(windowStart).toISOString()) {
        results.push({
          productId: ctx.product.id,
          variantId: ctx.variant.id,
          productName: ctx.product.name,
          variantName: ctx.variant.name,
          currentStock: ctx.usableStock,
          salesCount,
          windowDays: input.windowDays,
          lastSaleAt: lastSale,
          reason: 'no-recent-sales',
        });
      }
    }
  }

  results.sort((a, b) =>
    a.reason === b.reason
      ? a.productName.localeCompare(b.productName)
      : a.reason === 'no-recent-sales'
        ? -1
        : 1,
  );
  return results;
}
