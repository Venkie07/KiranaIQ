import { db } from '@/db/database';
import { resetDemoData, seedDemoData, CURRENT_SEED_VERSION } from '@/db/seed';
import { computeUsableStock, expiredBatchQuantity } from '@/domain/inventory';
import { buildRestockPlan, buildVariantContexts } from '@/domain/restock';
import { buildExpiryAlerts, buildLowStockAlerts, buildSlowMovingProducts } from '@/domain/inventory';
import type { SalesHistoryEntry, VariantContext } from '@/domain/inventory';
import { nowISO, todayISODate } from '@/domain/dates';
import type {
  AppSettings,
  BackupFile,
  ExpiryAlert,
  LowStockAlert,
  Product,
  ProductVariant,
  Purchase,
  RestockPlan,
  Sale,
  SlowMovingProduct,
  StockBatch,
  StockMovement,
} from '@/domain/types';
import type {
  AlertService,
  AppServices,
  BackupService,
  MovementFilter,
  NewProductInput,
  ProductDetail,
  ProductService,
  ProductStockView,
  PurchaseInput,
  PurchaseService,
  RestockService,
  SaleInput,
  SalesService,
  SettingsService,
  StockMovementService,
  StockMovementView,
} from '../interfaces';
import { DEFAULT_SETTINGS } from '@/db/database';

/** Service-layer error carrying an i18n key instead of a raw message. */
export class ServiceError extends Error {
  constructor(
    readonly i18nKey: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(i18nKey);
    this.name = 'ServiceError';
  }
}

function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

/* ------------------------------------------------------------------ */
/* Context loading shared by list/alert services                       */
/* ------------------------------------------------------------------ */

async function loadContexts(now = new Date()): Promise<VariantContext[]> {
  const [products, variants, movements, batches] = await Promise.all([
    db.products.toArray(),
    db.variants.toArray(),
    db.stockMovements.toArray(),
    db.batches.toArray(),
  ]);
  return buildVariantContexts({ products, variants, movements, batches, now });
}

async function loadSalesHistory(): Promise<SalesHistoryEntry[]> {
  const sales = await db.sales.toArray();
  const entries: SalesHistoryEntry[] = [];
  for (const sale of sales) {
    for (const item of sale.items) {
      entries.push({ variantId: item.variantId, timestamp: sale.createdAt, quantity: item.quantity });
    }
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

class LocalProductService implements ProductService {
  async list(filter?: Parameters<ProductService['list']>[0]): Promise<ProductStockView[]> {
    const now = new Date();
    const contexts = await loadContexts(now);
    const allBatches = await db.batches.toArray();
    const includeInactive = filter?.includeInactive ?? false;

    let rows = contexts;
    if (!includeInactive) {
      rows = rows.filter((c) => c.product.active && c.variant.active);
    }
    if (filter?.category && filter.category !== 'all') {
      rows = rows.filter((c) => c.product.category === filter.category);
    }
    if (filter?.status && filter.status !== 'all') {
      const wanted = filter.status;
      rows = rows.filter((c) => {
        const status =
          c.usableStock <= 0 ? 'out' : c.usableStock <= c.product.reorderThreshold ? 'low' : 'ok';
        return status === wanted;
      });
    }
    if (filter?.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          c.product.name.toLowerCase().includes(q) ||
          c.variant.name.toLowerCase().includes(q) ||
          (c.product.supplier ?? '').toLowerCase().includes(q) ||
          (c.variant.barcode ?? '').toLowerCase().includes(q),
      );
    }

    const sort = filter?.sort ?? 'name-asc';
    rows.sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return b.product.name.localeCompare(a.product.name);
        case 'stock-asc':
          return a.usableStock - b.usableStock;
        case 'stock-desc':
          return b.usableStock - a.usableStock;
        case 'recent':
          return b.product.createdAt.localeCompare(a.product.createdAt);
        case 'name-asc':
        default:
          return a.product.name.localeCompare(b.product.name) || a.variant.name.localeCompare(b.variant.name);
      }
    });

    return rows.map((c) => ({
      variant: c.variant,
      product: c.product,
      totalStock: c.totalStock,
      usableStock: c.usableStock,
      expiredQuantity: expiredBatchQuantity(allBatches, c.variant.id, now),
    }));
  }

  async getDetail(productId: string): Promise<ProductDetail | null> {
    const product = await db.products.get(productId);
    if (!product) return null;
    const [variants, movements, sales, batches] = await Promise.all([
      db.variants.where('productId').equals(productId).toArray(),
      db.stockMovements.where('productId').equals(productId).reverse().sortBy('timestamp'),
      db.sales.toArray(),
      db.batches.where('productId').equals(productId).toArray(),
    ]);
    const now = new Date();
    const stockRows: ProductDetail['variants'] = variants.map((variant) => {
      const totalStock = movements
        .filter((m) => m.variantId === variant.id)
        .reduce((s, m) => s + m.signedQuantity, 0);
      return {
        variant,
        product,
        totalStock,
        usableStock: computeUsableStock(totalStock, batches, variant.id, now),
        expiredQuantity: expiredBatchQuantity(batches, variant.id, now),
      };
    });

    const variantIds = new Set(variants.map((v) => v.id));
    const relatedSales = sales
      .filter((s) => s.items.some((i) => variantIds.has(i.variantId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);

    const variantNameById = new Map(variants.map((v) => [v.id, v.name]));
    const relatedBatches = batches.map((b) => ({
      ...b,
      productName: product.name,
      variantName: variantNameById.get(b.variantId) ?? '',
    }));

    return {
      product,
      variants: stockRows,
      movements: movements.slice(0, 100),
      sales: relatedSales,
      batches: relatedBatches,
    };
  }

  async create(input: NewProductInput): Promise<string> {
    const now = nowISO();
    const productId = newId('prod');
    const variantId = newId('var');
    const localDisplayNames = input.localDisplayNames
      ? Object.fromEntries(Object.entries(input.localDisplayNames).filter(([, v]) => v))
      : undefined;

    const product: Product = {
      id: productId,
      name: input.name.trim(),
      localDisplayNames: localDisplayNames as Product['localDisplayNames'],
      category: input.category,
      unit: input.unit,
      active: true,
      reorderThreshold: input.reorderThreshold,
      expiryTracked: input.expiryTracked,
      supplier: input.supplier?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const variant: ProductVariant = {
      id: variantId,
      productId,
      name: input.variant.name.trim(),
      packSize: input.variant.packSize,
      unit: input.unit,
      sellingPrice: input.variant.sellingPrice,
      costPrice: input.variant.costPrice ?? null,
      barcode: input.variant.barcode?.trim() || undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    const movements: StockMovement[] = [];
    if (input.initialStock > 0) {
      movements.push({
        id: newId('mov'),
        variantId,
        productId,
        movementType: 'opening',
        signedQuantity: input.initialStock,
        unitCost: input.variant.costPrice ?? null,
        timestamp: now,
        reason: 'opening',
      });
    }

    await db.transaction('rw', [db.products, db.variants, db.stockMovements], async () => {
      await db.products.add(product);
      await db.variants.add(variant);
      if (movements.length) await db.stockMovements.bulkAdd(movements);
    });
    return productId;
  }

  async update(productId: string, patch: Partial<Product>): Promise<void> {
    const existing = await db.products.get(productId);
    if (!existing) throw new ServiceError('errors.notFound');
    await db.products.put({ ...existing, ...patch, id: productId, updatedAt: nowISO() });
  }

  async updateVariant(variantId: string, patch: Partial<ProductVariant>): Promise<void> {
    const existing = await db.variants.get(variantId);
    if (!existing) throw new ServiceError('errors.notFound');
    await db.variants.put({ ...existing, ...patch, id: variantId, updatedAt: nowISO() });
  }
}

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

class LocalSalesService implements SalesService {
  async record(input: { items: SaleInput[] }): Promise<Sale> {
    if (!input.items.length) throw new ServiceError('validation.cartEmpty');
    const now = nowISO();

    const sale = await db.transaction(
      'rw',
      [db.sales, db.products, db.variants, db.stockMovements, db.batches],
      async () => {
        const items = [];
        for (const line of input.items) {
          const variant = await db.variants.get(line.variantId);
          if (!variant) throw new ServiceError('errors.notFound');
          if (line.quantity <= 0 || !Number.isInteger(line.quantity)) {
            throw new ServiceError('validation.quantityInteger');
          }
          if (line.unitPrice < 0) throw new ServiceError('validation.priceNegative');

          // Stock check uses usable stock (expired batch quantities excluded).
          const movements = await db.stockMovements.where('variantId').equals(line.variantId).toArray();
          const batches = await db.batches.where('variantId').equals(line.variantId).toArray();
          const totalStock = movements.reduce((s, m) => s + m.signedQuantity, 0);
          const usable = computeUsableStock(totalStock, batches, line.variantId);
          if (line.quantity > usable) {
            throw new ServiceError('errors.insufficientStock', {
              available: usable,
              requested: line.quantity,
            });
          }

          items.push({
            variantId: variant.id,
            productId: variant.productId,
            productName:
              (await db.products.get(variant.productId))?.name ?? variant.name,
            variantName: variant.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.quantity * line.unitPrice,
          });
        }

        const record: Sale = {
          id: newId('sale'),
          items,
          totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
          createdAt: now,
          status: 'completed',
        };
        await db.sales.add(record);

        for (const item of items) {
          await db.stockMovements.add({
            id: newId('mov'),
            variantId: item.variantId,
            productId: item.productId,
            movementType: 'sale',
            signedQuantity: -item.quantity,
            timestamp: now,
            reason: 'sale',
            referenceId: record.id,
          });
        }
        return record;
      },
    );
    return sale;
  }

  async list(limit = 50): Promise<Sale[]> {
    const sales = await db.sales.orderBy('createdAt').reverse().limit(limit).toArray();
    return sales;
  }
}

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */

class LocalPurchaseService implements PurchaseService {
  async record(input: PurchaseInput): Promise<Purchase> {
    if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
      throw new ServiceError('validation.quantityInteger');
    }
    if (input.unitCost < 0) throw new ServiceError('validation.costNegative');
    if (input.trackBatch && input.expiryDate && input.expiryDate < todayISODate()) {
      // Allow receiving already-expired stock? Business rule: reject with a
      // clear message — the shopkeeper likely scanned a wrong date.
      throw new ServiceError('errors.expiryInPast');
    }

    const now = nowISO();
    return db.transaction(
      'rw',
      [db.purchases, db.products, db.stockMovements, db.batches, db.variants],
      async () => {
        const variant = await db.variants.get(input.variantId);
        if (!variant) throw new ServiceError('errors.notFound');
        const product = await db.products.get(variant.productId);
        if (!product) throw new ServiceError('errors.notFound');

        let batchId: string | undefined;
        if (input.trackBatch && product.expiryTracked) {
          const batch: StockBatch = {
            id: newId('batch'),
            variantId: variant.id,
            productId: product.id,
            batchCode: input.batchCode?.trim() || undefined,
            receivedQuantity: input.quantity,
            remainingQuantity: input.quantity,
            expiryDate: input.expiryDate || null,
            receivedAt: now,
            unitCost: input.unitCost,
          };
          await db.batches.add(batch);
          batchId = batch.id;
        }

        const purchase: Purchase = {
          id: newId('purch'),
          items: [
            {
              variantId: variant.id,
              productId: product.id,
              productName: product.name,
              variantName: variant.name,
              quantity: input.quantity,
              unitCost: input.unitCost,
              lineTotal: input.quantity * input.unitCost,
              batchId,
            },
          ],
          supplier: input.supplier?.trim() || undefined,
          purchaseDate: input.purchaseDate,
          totalCost: input.quantity * input.unitCost,
          createdAt: now,
        };
        await db.purchases.add(purchase);

        await db.stockMovements.add({
          id: newId('mov'),
          variantId: variant.id,
          productId: product.id,
          batchId,
          movementType: 'purchase',
          signedQuantity: input.quantity,
          unitCost: input.unitCost,
          timestamp: now,
          reason: 'purchase',
          referenceId: purchase.id,
        });
        return purchase;
      },
    );
  }

  async list(limit = 50): Promise<Purchase[]> {
    return db.purchases.orderBy('createdAt').reverse().limit(limit).toArray();
  }
}

/* ------------------------------------------------------------------ */
/* Stock movements                                                     */
/* ------------------------------------------------------------------ */

class LocalStockMovementService implements StockMovementService {
  async list(filter?: MovementFilter): Promise<StockMovementView[]> {
    let rows = await db.stockMovements.orderBy('timestamp').reverse().toArray();
    if (filter?.variantId) rows = rows.filter((r) => r.variantId === filter.variantId);
    if (filter?.movementType && filter.movementType !== 'all') {
      rows = rows.filter((r) => r.movementType === filter.movementType);
    }
    if (filter?.from) rows = rows.filter((r) => r.timestamp.slice(0, 10) >= filter.from!);
    if (filter?.to) rows = rows.filter((r) => r.timestamp.slice(0, 10) <= filter.to!);

    const variants = await db.variants.toArray();
    const products = await db.products.toArray();
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const productById = new Map(products.map((p) => [p.id, p]));

    return rows.slice(0, 500).map((r) => {
      const variant = variantById.get(r.variantId);
      const product = productById.get(r.productId) ?? (variant && productById.get(variant.productId));
      return {
        ...r,
        productName: product?.name ?? '',
        variantName: variant?.name ?? '',
      };
    });
  }

  async correct(input: { variantId: string; newQuantity: number; reason: string }): Promise<void> {
    if (input.newQuantity < 0 || !Number.isInteger(input.newQuantity)) {
      throw new ServiceError('validation.quantityInteger');
    }
    await db.transaction('rw', [db.stockMovements, db.variants], async () => {
      const variant = await db.variants.get(input.variantId);
      if (!variant) throw new ServiceError('errors.notFound');
      const movements = await db.stockMovements.where('variantId').equals(input.variantId).toArray();
      const current = movements.reduce((s, m) => s + m.signedQuantity, 0);
      const delta = input.newQuantity - current;
      if (delta === 0) throw new ServiceError('errors.correctionNoChange');
      // A correction is an additional ledger entry referencing the state it
      // fixes — the original history is preserved and remains auditable.
      await db.stockMovements.add({
        id: newId('mov'),
        variantId: input.variantId,
        productId: variant.productId,
        movementType: 'correction',
        signedQuantity: delta,
        timestamp: nowISO(),
        reason: input.reason.trim(),
        referenceId: `correction_from_${current}`,
      });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

class LocalAlertService implements AlertService {
  async lowStock(): Promise<LowStockAlert[]> {
    const contexts = await loadContexts();
    return buildLowStockAlerts(contexts.filter((c) => c.product.active && c.variant.active));
  }

  async expiry(warningDays: number): Promise<ExpiryAlert[]> {
    const [batches, products, variants] = await Promise.all([
      db.batches.toArray(),
      db.products.toArray(),
      db.variants.toArray(),
    ]);
    return buildExpiryAlerts({ batches, products, variants, warningDays });
  }

  async slowMoving(windowDays: number): Promise<SlowMovingProduct[]> {
    const contexts = (await loadContexts()).filter((c) => c.product.active && c.variant.active);
    const sales = await loadSalesHistory();
    return buildSlowMovingProducts({ contexts, sales, windowDays });
  }
}

/* ------------------------------------------------------------------ */
/* Restock                                                             */
/* ------------------------------------------------------------------ */

class LocalRestockService implements RestockService {
  async preview(input: { budget: number; overrides?: Record<string, number>; excluded?: Record<string, boolean> }): Promise<RestockPlan> {
    const [products, variants, movements, batches, sales, settings] = await Promise.all([
      db.products.toArray(),
      db.variants.toArray(),
      db.stockMovements.toArray(),
      db.batches.toArray(),
      loadSalesHistory(),
      getSettings(),
    ]);
    const contexts = buildVariantContexts({ products, variants, movements, batches });
    return buildRestockPlan({
      contexts,
      movements,
      batches,
      sales,
      budget: input.budget,
      lookbackDays: settings.restockLookbackDays,
      leadTimeDays: 7,
      safetyDays: 3,
      overrides: input.overrides,
      excluded: input.excluded,
    });
  }

  async save(plan: RestockPlan): Promise<void> {
    await db.restockPlans.put(plan);
  }

  async list(): Promise<RestockPlan[]> {
    return db.restockPlans.orderBy('createdAt').reverse().limit(20).toArray();
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get('app');
  if (stored) return stored;
  const defaults: AppSettings = { ...DEFAULT_SETTINGS, updatedAt: nowISO() };
  await db.settings.put(defaults);
  return defaults;
}

class LocalSettingsService implements SettingsService {
  async get(): Promise<AppSettings> {
    return getSettings();
  }

  async update(patch: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>): Promise<AppSettings> {
    const current = await getSettings();
    const next: AppSettings = { ...current, ...patch, updatedAt: nowISO() };
    await db.settings.put(next);
    return next;
  }

  async resetDemoData(): Promise<import('@/db/seed').SeedResult> {
    return resetDemoData();
  }
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

class LocalBackupService implements BackupService {
  async exportAll(): Promise<BackupFile> {
    const [products, variants, sales, purchases, stockMovements, batches, settings] =
      await Promise.all([
        db.products.toArray(),
        db.variants.toArray(),
        db.sales.toArray(),
        db.purchases.toArray(),
        db.stockMovements.toArray(),
        db.batches.toArray(),
        db.settings.get('app'),
      ]);
    const recordCount =
      products.length +
      variants.length +
      sales.length +
      purchases.length +
      stockMovements.length +
      batches.length;
    const demoDataIncluded =
      products.some((p) => p.demo) ||
      sales.some((s) => s.demo) ||
      purchases.some((p) => p.demo);

    return {
      schemaVersion: 1,
      app: 'kiranaiq',
      exportedAt: nowISO(),
      data: {
        products,
        variants,
        sales,
        purchases,
        stockMovements,
        batches,
        settings: settings ?? null,
      },
      meta: { demoDataIncluded, recordCount },
    };
  }

  async importAll(backup: BackupFile): Promise<{ productCount: number; saleCount: number }> {
    // Caller (UI) validated with parseBackup() first. Replace-all inside one
    // transaction so an interrupted import cannot leave partial data.
    await db.transaction(
      'rw',
      [
        db.products,
        db.variants,
        db.sales,
        db.purchases,
        db.stockMovements,
        db.batches,
        db.restockPlans,
      ],
      async () => {
        await db.products.clear();
        await db.variants.clear();
        await db.sales.clear();
        await db.purchases.clear();
        await db.stockMovements.clear();
        await db.batches.clear();
        await db.restockPlans.clear();

        await db.products.bulkPut(backup.data.products);
        await db.variants.bulkPut(backup.data.variants);
        await db.sales.bulkPut(backup.data.sales);
        await db.purchases.bulkPut(backup.data.purchases);
        await db.stockMovements.bulkPut(backup.data.stockMovements);
        await db.batches.bulkPut(backup.data.batches);
        if (backup.data.settings) {
          await db.settings.put({ ...backup.data.settings, id: 'app' });
        }
      },
    );
    await db.meta.put({ id: 'seed', seedVersion: CURRENT_SEED_VERSION });
    return {
      productCount: backup.data.products.length,
      saleCount: backup.data.sales.length,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function createLocalServices(): AppServices {
  return {
    products: new LocalProductService(),
    sales: new LocalSalesService(),
    purchases: new LocalPurchaseService(),
    movements: new LocalStockMovementService(),
    alerts: new LocalAlertService(),
    restock: new LocalRestockService(),
    settings: new LocalSettingsService(),
    backup: new LocalBackupService(),
  };
}

export { getSettings, seedDemoData, resetDemoData };
