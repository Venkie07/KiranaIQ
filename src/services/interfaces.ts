import type {
  AppSettings,
  BackupFile,
  ExpiryAlert,
  Language,
  LowStockAlert,
  MovementType,
  Product,
  ProductCategory,
  ProductVariant,
  Purchase,
  RestockPlan,
  Sale,
  SlowMovingProduct,
  StockMovement,
  StockStatus,
} from '@/domain/types';

/**
 * Service interfaces used by every screen.
 *
 * The current implementation is `Local*Service` (Dexie/IndexedDB +
 * deterministic domain maths). A future implementation can swap in a
 * remote API client (see src/services/api/endpoints.ts) or a native
 * SQLite adapter (Capacitor) WITHOUT rewriting UI components — screens
 * only depend on these interfaces, obtained from the service factory.
 */

export interface ProductListFilter {
  search?: string;
  category?: ProductCategory | 'all';
  status?: StockStatus | 'all';
  sort?: 'name-asc' | 'name-desc' | 'stock-asc' | 'stock-desc' | 'recent';
  includeInactive?: boolean;
}

export interface VariantStockView {
  variant: ProductVariant;
  product: Product;
  totalStock: number;
  usableStock: number;
  expiredQuantity: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProductStockView extends VariantStockView {}

export interface ProductDetail {
  product: Product;
  variants: VariantStockView[];
  movements: StockMovement[];
  sales: Sale[];
  batches: (import('@/domain/types').StockBatch & { productName: string; variantName: string })[];
}

export interface NewProductInput {
  name: string;
  localDisplayNames?: Partial<Record<Language, string>>;
  category: ProductCategory;
  unit: Product['unit'];
  reorderThreshold: number;
  expiryTracked: boolean;
  supplier?: string;
  variant: {
    name: string;
    packSize: number;
    sellingPrice: number; // paise
    costPrice?: number | null; // paise
    barcode?: string;
  };
  initialStock: number;
}

export interface ProductService {
  list(filter?: ProductFilterLike): Promise<ProductStockView[]>;
  getDetail(productId: string): Promise<ProductDetail | null>;
  create(input: NewProductInput): Promise<string>;
  update(productId: string, patch: Partial<Product>): Promise<void>;
  updateVariant(variantId: string, patch: Partial<ProductVariant>): Promise<void>;
}
type ProductFilterLike = ProductListFilter;

export interface SaleInput {
  variantId: string;
  quantity: number;
  unitPrice: number; // paise
}

export interface SalesService {
  /** Records a sale, decrements stock via the movement ledger atomically. */
  record(input: { items: SaleInput[] }): Promise<Sale>;
  list(limit?: number): Promise<Sale[]>;
}

export interface PurchaseInput {
  variantId: string;
  quantity: number;
  unitCost: number; // paise
  supplier?: string;
  purchaseDate: string; // YYYY-MM-DD
  trackBatch: boolean;
  batchCode?: string;
  expiryDate?: string | null;
}

export interface PurchaseService {
  /** Receives stock, creates batches + ledger entries atomically. */
  record(input: PurchaseInput): Promise<Purchase>;
  list(limit?: number): Promise<Purchase[]>;
}

export interface MovementFilter {
  variantId?: string;
  movementType?: MovementType | 'all';
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface StockMovementView extends StockMovement {
  productName: string;
  variantName: string;
}

export interface StockMovementService {
  list(filter?: MovementFilter): Promise<StockMovementView[]>;
  /** Creates a correction movement; original history is never overwritten. */
  correct(input: {
    variantId: string;
    newQuantity: number;
    reason: string;
  }): Promise<void>;
}

export interface AlertService {
  lowStock(): Promise<LowStockAlert[]>;
  expiry(warningDays: number): Promise<ExpiryAlert[]>;
  slowMoving(windowDays: number): Promise<SlowMovingProduct[]>;
}

export interface RestockService {
  preview(input: { budget: number; overrides?: Record<string, number>; excluded?: Record<string, boolean> }): Promise<RestockPlan>;
  save(plan: RestockPlan): Promise<void>;
  list(): Promise<RestockPlan[]>;
}

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(patch: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>): Promise<AppSettings>;
  resetDemoData(): Promise<import('@/db/seed').SeedResult>;
}

export interface BackupService {
  exportAll(): Promise<BackupFile>;
  /** Validates fully before writing; throws with an i18n error key on failure. */
  importAll(backup: BackupFile): Promise<{ productCount: number; saleCount: number }>;
}

export interface AppServices {
  products: ProductService;
  sales: SalesService;
  purchases: PurchaseService;
  movements: StockMovementService;
  alerts: AlertService;
  restock: RestockService;
  settings: SettingsService;
  backup: BackupService;
}
