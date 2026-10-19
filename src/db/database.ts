import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  PinCredential,
  Product,
  ProductVariant,
  Purchase,
  RestockPlan,
  Sale,
  StockBatch,
  StockMovement,
} from '@/domain/types';

/**
 * KiranaIQ local database (IndexedDB via Dexie).
 *
 * This is the *initial* adapter only. A future native SQLite adapter for
 * Capacitor implements the same repository interfaces (see
 * src/services/interfaces). Browser IndexedDB and native SQLite do NOT
 * share data automatically — migration is a deliberate future task.
 *
 * The service worker caches *static app assets*; this database stores
 * *business data*. The SW cache is never used as an inventory database.
 */
export class KiranaDB extends Dexie {
  products!: Table<Product, string>;
  variants!: Table<ProductVariant, string>;
  sales!: Table<Sale, string>;
  purchases!: Table<Purchase, string>;
  stockMovements!: Table<StockMovement, string>;
  batches!: Table<StockBatch, string>;
  restockPlans!: Table<RestockPlan, string>;
  settings!: Table<AppSettings, string>;
  pinCredentials!: Table<PinCredential, string>;
  /** Small key/value bookkeeping (seed version, etc.). */
  meta!: Table<{ id: string; [key: string]: unknown }, string>;

  constructor(name = 'kirana-iq') {
    super(name);
    this.version(1).stores({
      products: 'id, category, active, createdAt, updatedAt',
      variants: 'id, productId, active, createdAt',
      sales: 'id, createdAt, status',
      purchases: 'id, purchaseDate, createdAt',
      stockMovements: 'id, variantId, movementType, timestamp, [variantId+timestamp]',
      batches: 'id, variantId, expiryDate, receivedAt',
      restockPlans: 'id, createdAt, status',
      settings: 'id',
      pinCredentials: 'id',
      meta: 'id',
    });
  }
}

export const db = new KiranaDB();

/** Tables cleared when demo data is reset (PIN credential + settings survive). */
export const BUSINESS_TABLES = [
  'products',
  'variants',
  'sales',
  'purchases',
  'stockMovements',
  'batches',
  'restockPlans',
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  language: 'en',
  theme: 'system',
  currency: 'INR',
  expiryWarningDays: 30,
  defaultReorderThreshold: 5,
  slowMovingDays: 30,
  restockLookbackDays: 30,
  lockPolicy: 'minute-5',
  onboardingComplete: false,
  updatedAt: new Date().toISOString(),
};
