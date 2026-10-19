import type {
  Product,
  ProductVariant,
  RestockPlan,
  RestockPlanItem,
  RestockReason,
} from './types';
import { computeUsableStock, expiredBatchQuantity, roundUpToPack } from './inventory';
import type { SalesHistoryEntry, VariantContext } from './inventory';
import type { StockBatch, StockMovement } from './types';
import { nowISO } from './dates';

/**
 * Deterministic budget-aware restock planner.
 *
 * Rules (all deterministic, no AI):
 *  1. Only active products/variants with usable stock are considered;
 *     out-of-stock variants are considered too (usable 0).
 *  2. Demand estimate = packs sold per day over the look-back window.
 *     If the product has less history than `minHistoryDays`, the estimate
 *     falls back to `fallbackDailyDemand` and the item is labelled
 *     `insufficient-history` (no forecast is presented as fact).
 *  3. recommended = roundUpToPack(
 *        expectedDemandDuringLeadTime + safetyStock - usableStock - incoming,
 *        packSize)  where packSize here = the *supplier case pack* = 1 pack
 *     (variants are already the sellable pack); rounding to a case multiple
 *     uses `packMultiple` (default 1).
 *  4. Items are ranked by an urgency score, then budgeted greedily.
 *     If an item's cost exceeds the remaining budget, its quantity is
 *     reduced to the largest multiple of the unit cost that fits; if not
 *     even one pack fits, the item is excluded with `budget-limit` and
 *     `pack-size` reasons so the UI can explain why.
 *  5. Total never exceeds budget (integer paise maths).
 *  6. Expired batch quantities are already removed from usable stock, so
 *     expired stock never inflates the recommendation.
 */

export interface RestockEngineInput {
  contexts: VariantContext[];
  movements: StockMovement[];
  batches: StockBatch[];
  sales: SalesHistoryEntry[];
  budget: number; // paise
  lookbackDays: number;
  leadTimeDays: number;
  safetyDays: number;
  minHistoryDays?: number;
  fallbackDailyDemand?: number;
  /** Quantities the user edited, keyed by variantId. */
  overrides?: Record<string, number>;
  /** Items the user excluded, keyed by variantId. */
  excluded?: Record<string, boolean>;
  now?: Date;
}

const DEFAULT_MIN_HISTORY = 7;
const DEFAULT_FALLBACK_DAILY = 1;

interface ScoredItem {
  item: RestockPlanItem;
  score: number;
}

export function buildRestockPlan(input: RestockEngineInput): RestockPlan {
  const now = input.now ?? new Date();
  const minHistory = input.minHistoryDays ?? DEFAULT_MIN_HISTORY;
  const fallbackDaily = input.fallbackDailyDemand ?? DEFAULT_FALLBACK_DAILY;
  const windowStart = now.getTime() - input.lookbackDays * 86_400_000;

  // --- per-variant demand ---
  const demandByVariant = new Map<string, { perDay: number; sold: number; historyDays: number }>();
  for (const ctx of input.contexts) {
    const variantSales = input.sales.filter((s) => s.variantId === ctx.variant.id);
    const inWindow = variantSales.filter((s) => Date.parse(s.timestamp) >= windowStart);
    const sold = inWindow.reduce((sum, s) => sum + s.quantity, 0);
    const historyDays = (now.getTime() - Date.parse(ctx.product.createdAt)) / 86_400_000;
    demandByVariant.set(ctx.variant.id, {
      perDay: sold / input.lookbackDays,
      sold,
      historyDays,
    });
  }

  const build = (ctx: VariantContext): { item: RestockPlanItem; score: number } | null => {
    const { product, variant } = ctx;
    if (!product.active || !variant.active) return null;

    const usable = computeUsableStock(
      ctx.totalStock,
      input.batches,
      variant.id,
      now,
    );
    const expiredQty = expiredBatchQuantity(input.batches, variant.id, now);
    const demand = demandByVariant.get(variant.id) ?? {
      perDay: 0,
      sold: 0,
      historyDays: 0,
    };
    const insufficientHistory = demand.historyDays < minHistory;
    const dailyDemand = insufficientHistory ? fallbackDaily : demand.perDay;

    const expectedDemand = dailyDemand * input.leadTimeDays;
    const safetyStock = dailyDemand * input.safetyDays;
    const raw = Math.max(0, Math.ceil(expectedDemand + safetyStock - usable));

    const reasons: RestockReason[] = [];
    if (usable <= product.reorderThreshold) reasons.push('low-stock');
    if (usable <= Math.ceil(expectedDemand)) reasons.push('stockout-risk');
    if (!insufficientHistory && demand.perDay >= 2) reasons.push('high-sales');
    if (insufficientHistory) reasons.push('insufficient-history');
    if (expiredQty > 0) reasons.push('expiry-concern');

    let recommended = raw;
    if (recommended <= 0 && usable > 0 && usable <= product.reorderThreshold) {
      // Still top up to just above the threshold even if demand model says no.
      recommended = product.reorderThreshold - usable + 1;
      if (!reasons.includes('low-stock')) reasons.push('low-stock');
    }
    if (recommended <= 0) return null;

    // Score: urgency of running out first.
    const daysOfCover = dailyDemand > 0 ? usable / dailyDemand : 999;
    let score = 100 - Math.min(99, daysOfCover * 4);
    if (usable <= 0) score += 60;
    else if (usable <= product.reorderThreshold) score += 30;
    if (!insufficientHistory && demand.perDay >= 2) score += 15;
    if (insufficientHistory) score -= 10;
    if (variant.costPrice == null || variant.costPrice <= 0) score -= 1000;

    const unitCost = variant.costPrice && variant.costPrice > 0 ? variant.costPrice : 0;
    const override = input.overrides?.[variant.id];
    const finalQty = typeof override === 'number' ? Math.max(0, Math.floor(override)) : recommended;

    const item: RestockPlanItem = {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      recommendedQuantity: recommended,
      quantity: finalQty,
      unitCost,
      lineTotal: finalQty * unitCost,
      priority: 0,
      reasons,
      included: !input.excluded?.[variant.id],
      budgetAdjusted: false,
    };
    return { item, score };
  };

  const scored: ScoredItem[] = [];
  for (const ctx of input.contexts) {
    const built = build(ctx);
    if (built) scored.push(built);
  }

  // Sort by score desc, then name for stable deterministic output.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameCmp = a.item.productName.localeCompare(b.item.productName);
    return nameCmp !== 0 ? nameCmp : a.item.variantId.localeCompare(b.item.variantId);
  });

  // --- greedy budget allocation ---
  let remaining = input.budget;
  const items: RestockPlanItem[] = [];

  for (const { item } of scored) {
    if (item.unitCost <= 0) {
      // No cost data: never silently included — excluded with an explanation.
      item.included = false;
      if (!item.reasons.includes('no-cost')) item.reasons.push('no-cost');
      item.quantity = 0;
      item.lineTotal = 0;
      items.push(item);
      continue;
    }
    if (!item.included) {
      item.quantity = 0;
      item.lineTotal = 0;
      items.push(item);
      continue;
    }

    const qty = item.quantity;
    let cost = qty * item.unitCost;

    if (cost > remaining) {
      const affordable = Math.floor(remaining / item.unitCost);
      if (affordable <= 0) {
        item.included = false;
        item.quantity = 0;
        item.lineTotal = 0;
        if (!item.reasons.includes('budget-limit')) item.reasons.push('budget-limit');
        if (!item.reasons.includes('pack-size')) item.reasons.push('pack-size');
        items.push(item);
        continue;
      }
      item.quantity = affordable;
      item.lineTotal = affordable * item.unitCost;
      item.budgetAdjusted = true;
      if (!item.reasons.includes('budget-limit')) item.reasons.push('budget-limit');
      cost = item.lineTotal;
      remaining -= cost;
    } else {
      item.lineTotal = cost;
      remaining -= cost;
    }
    items.push(item);
  }

  const includedItems = items.filter((i) => i.included);
  const estimatedTotal = includedItems.reduce((sum, i) => sum + i.lineTotal, 0);

  // Assign 1-based priorities to included items (already ranked).
  let priority = 0;
  for (const item of items) {
    if (item.included) {
      priority += 1;
      item.priority = priority;
    }
  }

  return {
    id: `plan_${now.getTime().toString(36)}`,
    budget: input.budget,
    items,
    estimatedTotal,
    remainingBudget: Math.max(0, input.budget - estimatedTotal),
    status: 'draft',
    createdAt: nowISO(),
    assumptions: {
      lookbackDays: input.lookbackDays,
      leadTimeDays: input.leadTimeDays,
      safetyDays: input.safetyDays,
      currency: 'INR',
      generatedAt: nowISO(),
    },
  };
}

/** Convenience: build VariantContext list from raw tables (used by services). */
export function buildVariantContexts(input: {
  products: Product[];
  variants: ProductVariant[];
  movements: StockMovement[];
  batches: StockBatch[];
  now?: Date;
}): VariantContext[] {
  const now = input.now ?? new Date();
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const stockByVariant = new Map<string, number>();
  for (const m of input.movements) {
    stockByVariant.set(m.variantId, (stockByVariant.get(m.variantId) ?? 0) + m.signedQuantity);
  }
  const contexts: VariantContext[] = [];
  for (const variant of input.variants) {
    const product = productById.get(variant.productId);
    if (!product) continue;
    const totalStock = stockByVariant.get(variant.id) ?? 0;
    contexts.push({
      product,
      variant,
      totalStock,
      usableStock: computeUsableStock(totalStock, input.batches, variant.id, now),
    });
  }
  return contexts;
}

/** Round helper re-exported for the UI (quantity steppers). */
export { roundUpToPack };
