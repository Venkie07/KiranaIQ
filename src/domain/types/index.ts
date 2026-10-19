/**
 * KiranaIQ core domain types.
 *
 * Conventions:
 * - IDs are opaque strings (uuid-ish).
 * - Timestamps are ISO-8601 strings (UTC).
 * - Calendar dates (expiry) are `YYYY-MM-DD` strings (device local date).
 * - Money is stored as integer paise (INR). Never use raw floats for totals.
 * - Stock is counted in *variant packs* (integer). A variant's `packSize`
 *   expresses how many product base units one pack contains.
 * - Records seeded by demo data carry `demo: true`.
 */

export type Language = 'en' | 'ta' | 'hi';
export type ThemePreference = 'light' | 'dark' | 'system';
export type CurrencyCode = 'INR';

export type ProductCategory =
  | 'rice-grains'
  | 'snacks'
  | 'biscuits'
  | 'cooking-oil'
  | 'dairy'
  | 'beverages'
  | 'personal-care'
  | 'household'
  | 'other';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'rice-grains',
  'snacks',
  'biscuits',
  'cooking-oil',
  'dairy',
  'beverages',
  'personal-care',
  'household',
  'other',
];

export type Unit = 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'pack' | 'bottle' | 'dozen';

export const UNITS: Unit[] = ['pcs', 'kg', 'g', 'l', 'ml', 'pack', 'bottle', 'dozen'];

export type MovementType =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'return'
  | 'damage'
  | 'expiry'
  | 'correction';

export type StockStatus = 'out' | 'low' | 'ok';

export type ExpiryRisk = 'expired' | 'critical' | 'warning' | 'upcoming';

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface Product {
  id: string;
  name: string;
  /** Optional display name in another UI language, never auto-translated. */
  localDisplayNames?: Partial<Record<Language, string>>;
  category: ProductCategory;
  unit: Unit;
  active: boolean;
  /** Low-stock threshold, in packs, applied per active variant. */
  reorderThreshold: number;
  /** When true, purchases may create dated batches for this product. */
  expiryTracked: boolean;
  supplier?: string;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  /** Display label, e.g. "500 g" or "Single pack". */
  name: string;
  /** Base-unit quantity contained in one pack (e.g. 0.5 kg for a 500 g pack). */
  packSize: number;
  unit: Unit;
  /** Selling price per pack, in paise. */
  sellingPrice: number;
  /** Purchase cost per pack, in paise (nullable: some products have no cost). */
  costPrice?: number | null;
  barcode?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

export interface SaleItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  /** Packs sold. */
  quantity: number;
  /** Price per pack at sale time, in paise. */
  unitPrice: number;
  /** quantity * unitPrice, in paise. */
  lineTotal: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  /** Sum of line totals, in paise. */
  totalAmount: number;
  createdAt: string;
  status: 'completed';
  demo?: boolean;
}

export interface PurchaseItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  quantity: number;
  /** Cost per pack, in paise. */
  unitCost: number;
  lineTotal: number;
  batchId?: string;
}

export interface Purchase {
  id: string;
  items: PurchaseItem[];
  supplier?: string;
  /** YYYY-MM-DD */
  purchaseDate: string;
  totalCost: number;
  createdAt: string;
  demo?: boolean;
}

export interface StockMovement {
  id: string;
  variantId: string;
  productId: string;
  batchId?: string;
  movementType: MovementType;
  /** Positive = stock in, negative = stock out (packs). */
  signedQuantity: number;
  /** Paise, per pack; used for valuation of incoming stock. */
  unitCost?: number | null;
  timestamp: string;
  /** Translatable type label or free-text reason supplied by the user. */
  reason: string;
  /** Sale / purchase id, or the original movement id for corrections. */
  referenceId?: string;
  demo?: boolean;
}

export interface StockBatch {
  id: string;
  variantId: string;
  productId: string;
  batchCode?: string;
  receivedQuantity: number;
  remainingQuantity: number;
  /** YYYY-MM-DD, device local date. */
  expiryDate?: string | null;
  /** ISO timestamp */
  receivedAt: string;
  unitCost?: number | null;
  demo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export interface ExpiryAlert {
  batchId: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  batchCode?: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  risk: ExpiryRisk;
}

export interface LowStockAlert {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  currentStock: number;
  reorderThreshold: number;
  status: 'out' | 'low';
}

export type SlowMovingReason = 'no-recent-sales' | 'no-sales-history';

export interface SlowMovingProduct {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  currentStock: number;
  salesCount: number;
  windowDays: number;
  lastSaleAt: string | null;
  /** null = flagged as slow moving; string = flagged but not slow (young product). */
  reason: SlowMovingReason;
}

/* ------------------------------------------------------------------ */
/* Restock planning                                                    */
/* ------------------------------------------------------------------ */

export type RestockReason =
  | 'low-stock'
  | 'stockout-risk'
  | 'high-sales'
  | 'expiry-concern'
  | 'insufficient-history'
  | 'budget-limit'
  | 'pack-size'
  | 'no-cost'
  | 'manual';

export interface RestockPlanItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  /** Engine suggestion (packs). */
  recommendedQuantity: number;
  /** Final quantity after user edits (packs). */
  quantity: number;
  /** Paise per pack; 0 when cost is unknown. */
  unitCost: number;
  /** quantity * unitCost, paise. */
  lineTotal: number;
  /** 1 = highest priority. */
  priority: number;
  reasons: RestockReason[];
  included: boolean;
  /** True when the engine had to reduce quantity to fit the budget. */
  budgetAdjusted: boolean;
}

export type RestockPlanStatus = 'draft' | 'confirmed';

export interface RestockPlanAssumptions {
  lookbackDays: number;
  leadTimeDays: number;
  safetyDays: number;
  currency: CurrencyCode;
  generatedAt: string;
}

export interface RestockPlan {
  id: string;
  budget: number;
  items: RestockPlanItem[];
  estimatedTotal: number;
  remainingBudget: number;
  status: RestockPlanStatus;
  createdAt: string;
  assumptions: RestockPlanAssumptions;
  demo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** Lock triggers: explicit lock, inactivity timeout, app reopened after backgrounding. */
export type LockPolicy = 'immediate' | 'minute-1' | 'minute-5' | 'minute-15';

export interface AppSettings {
  id: 'app';
  language: Language;
  theme: ThemePreference;
  currency: CurrencyCode;
  shopName?: string;
  /** Expiry-warning window in days. */
  expiryWarningDays: number;
  /** Default low-stock threshold for new products, in packs. */
  defaultReorderThreshold: number;
  /** Window for slow-moving detection, in days. */
  slowMovingDays: number;
  /** Restock planner look-back window, in days. */
  restockLookbackDays: number;
  lockPolicy: LockPolicy;
  onboardingComplete: boolean;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* PIN lock                                                            */
/* ------------------------------------------------------------------ */

/** Never stores the PIN itself: salted PBKDF2 verifier only. */
export interface PinCredential {
  id: 'pin';
  /** Base64 salt. */
  salt: string;
  /** Base64 derived key (verifier). */
  verifier: string;
  /** PBKDF2 iteration count used at creation. */
  iterations: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Backup / restore                                                    */
/* ------------------------------------------------------------------ */

export interface BackupFile {
  /** Schema version of this export format. */
  schemaVersion: 1;
  app: 'kiranaiq';
  exportedAt: string;
  data: {
    products: Product[];
    variants: ProductVariant[];
    sales: Sale[];
    purchases: Purchase[];
    stockMovements: StockMovement[];
    batches: StockBatch[];
    settings: AppSettings | null;
  };
  meta: {
    demoDataIncluded: boolean;
    recordCount: number;
  };
}
