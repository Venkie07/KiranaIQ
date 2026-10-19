# Data Model Documentation

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Money** | Integer paise (₹1 = 100 paise). No floating-point arithmetic. |
| **Dates** | Timestamps: ISO 8601 UTC (`2026-10-19T10:30:00.000Z`). Calendar dates: `YYYY-MM-DD` (device local). |
| **IDs** | Opaque strings (`prod_abc123`, `var_xyz789`, `sale_0001`). UUID-like, sortable by creation time. |
| **Stock Unit** | **Variant packs** (integer). A variant's `packSize` = base units per pack. |
| **Provenance** | Seeded records: `demo: true`. User records: `demo: false` / absent. |
| **Ledger** | Stock movements are the **single source of truth**. No independent stock field. |

---

## Entity Definitions

### Product
```typescript
interface Product {
  id: string;                    // "prod_abc"
  name: string;                  // "Sona Masoori Rice"
  localDisplayNames?: {          // optional, never auto-translated
    en?: string; ta?: string; hi?: string;
  };
  category: ProductCategory;     // rice-grains | snacks | biscuits | cooking-oil | dairy | beverages | personal-care | household | other
  unit: Unit;                    // pcs | kg | g | l | ml | pack | bottle | dozen
  active: boolean;
  reorderThreshold: number;      // packs, applied per active variant
  expiryTracked: boolean;        // enables batch expiry on receive
  supplier?: string;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  demo?: boolean;                // provenance flag
}
```

### ProductVariant
```typescript
interface ProductVariant {
  id: string;                    // "var_abc"
  productId: string;             // FK → Product
  name: string;                  // "5 kg bag"
  packSize: number;              // base units per pack (5 kg → 5)
  unit: Unit;                    // same as product or different display unit
  sellingPrice: number;          // paise per pack
  costPrice?: number | null;     // paise per pack (nullable)
  barcode?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}
```

### Sale
```typescript
interface Sale {
  id: string;                    // "sale_0001"
  items: SaleItem[];
  totalAmount: number;           // paise
  createdAt: string;             // ISO timestamp
  status: 'completed';
  demo?: boolean;
}

interface SaleItem {
  variantId: string;
  productId: string;
  productName: string;           // denormalized for history
  variantName: string;
  quantity: number;              // packs
  unitPrice: number;             // paise per pack at sale time
  lineTotal: number;             // quantity × unitPrice
}
```

### Purchase
```typescript
interface Purchase {
  id: string;                    // "purch_0001"
  items: PurchaseItem[];
  supplier?: string;
  purchaseDate: string;          // YYYY-MM-DD
  totalCost: number;             // paise
  createdAt: string;
  demo?: boolean;
}

interface PurchaseItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitCost: number;              // paise per pack
  lineTotal: number;
  batchId?: string;              // if batch created
}
```

### StockMovement
```typescript
type MovementType = 'opening' | 'purchase' | 'sale' | 'return' | 'damage' | 'expiry' | 'correction';

interface StockMovement {
  id: string;                    // "mov_abc"
  variantId: string;
  productId: string;             // denormalized for queries
  batchId?: string;
  movementType: MovementType;
  signedQuantity: number;        // + in, - out (packs)
  unitCost?: number | null;      // paise
  timestamp: string;             // ISO timestamp
  reason: string;                // i18n key or free text
  referenceId?: string;          // sale/purchase id or original movement id
  demo?: boolean;
}
```

**Movement Sign Convention:**
| Type | SignedQty | Description |
|------|-----------|-------------|
| opening | + | Initial stock |
| purchase | + | Received stock |
| sale | - | Sold |
| return | + | Customer return |
| damage | - | Written off |
| expiry | - | Expired write-off |
| correction | ± | Delta to reach target |

### StockBatch
```typescript
interface StockBatch {
  id: string;                    // "batch_abc"
  variantId: string;
  productId: string;
  batchCode?: string;            // supplier batch number
  receivedQuantity: number;      // packs received
  remainingQuantity: number;     // packs remaining
  expiryDate?: string | null;    // YYYY-MM-DD (device local date)
  receivedAt: string;            // ISO timestamp
  unitCost?: number | null;      // paise
  demo?: boolean;
}
```

### RestockPlan
```typescript
type RestockReason = 'low-stock' | 'stockout-risk' | 'high-sales' | 'expiry-concern' | 'insufficient-history' | 'budget-limit' | 'pack-size' | 'no-cost' | 'manual';

interface RestockPlanItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  recommendedQuantity: number;   // engine suggestion
  quantity: number;              // final (after user edits)
  unitCost: number;              // paise (0 = unknown)
  lineTotal: number;             // quantity × unitCost
  priority: number;              // 1 = highest
  reasons: RestockReason[];
  included: boolean;
  budgetAdjusted: boolean;       // reduced to fit budget
}

interface RestockPlan {
  id: string;
  budget: number;                // paise
  items: RestockPlanItem[];
  estimatedTotal: number;        // paise
  remainingBudget: number;       // paise
  status: 'draft' | 'confirmed';
  createdAt: string;
  assumptions: {
    lookbackDays: number;
    leadTimeDays: number;
    safetyDays: number;
    currency: 'INR';
    generatedAt: string;
  };
  demo?: boolean;
}
```

### AppSettings
```typescript
type ThemePreference = 'light' | 'dark' | 'system';
type LockPolicy = 'immediate' | 'minute-1' | 'minute-5' | 'minute-15';
type Language = 'en' | 'ta' | 'hi';

interface AppSettings {
  id: 'app';
  language: Language;
  theme: ThemePreference;
  currency: 'INR';
  shopName?: string;
  expiryWarningDays: number;         // default 30
  defaultReorderThreshold: number;   // default 5
  slowMovingDays: number;            // default 30
  restockLookbackDays: number;       // default 30
  lockPolicy: LockPolicy;            // default minute-5
  onboardingComplete: boolean;
  updatedAt: string;
}
```

### PIN Credential (Separate Table)
```typescript
interface PinCredential {
  id: 'pin';
  salt: string;              // base64, 16 bytes
  verifier: string;          // base64, 32 bytes (PBKDF2-SHA256, 210k iters)
  iterations: number;        // 210000
  createdAt: string;
}
```

### Backup File (Export/Import)
```typescript
interface BackupFile {
  schemaVersion: 1;
  app: 'kiranaiq';
  exportedAt: string;        // ISO timestamp
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
```

---

## Stock Calculation Rules

1. **Total Stock** = Σ `signedQuantity` from `stockMovements` for a variant
2. **Expired Quantity** = Σ `remainingQuantity` from `batches` where `expiryDate < today` (device date)
3. **Usable Stock** = `max(0, Total Stock - Expired Quantity)`
4. **Low Stock** = `Usable Stock ≤ Product.reorderThreshold`
5. **Out of Stock** = `Usable Stock ≤ 0`

**Note:** Expired batch quantities are subtracted from usable stock *only when expiry data exists*. Products without batch tracking use total stock = usable stock.

---

## Restock Algorithm (Deterministic)

For each active variant with `costPrice > 0`:

1. **Demand Estimate** = `(sales in lookbackDays) / lookbackDays` packs/day
2. **Expected Demand** = `demandPerDay × leadTimeDays`
3. **Safety Stock** = `demandPerDay × safetyDays`
4. **Raw Need** = `max(0, ceil(Expected + Safety - Usable - Incoming))`
5. **Pack Rounding** = `ceil(Raw / packMultiple) × packMultiple` (default packMultiple = 1)
6. **Priority Score** = urgency (inverse days of cover) + low-stock boost + velocity boost - expiry penalty - insufficient-history penalty
7. **Budget Allocation** = greedy by score; reduce qty to fit budget; exclude if even 1 pack exceeds remaining budget

**Excluded with Reasons:**
- `no-cost` — no purchase cost recorded
- `insufficient-history` — product younger than `minHistoryDays` with no sales
- `budget-limit` / `pack-size` — cannot afford minimum pack

---

## Provenance & Demo Data

- All seeded records carry `demo: true`
- UI shows **Demo** badge on seeded products/sales/purchases
- **Reset Demo Data** clears all business tables, re-seeds identically
- User-created records never have `demo: true`
- Settings and PIN credentials **survive** demo reset