import type {
  Product,
  ProductVariant,
  Purchase,
  Sale,
  SaleItem,
  StockBatch,
  StockMovement,
} from '@/domain/types';
import { db, DEFAULT_SETTINGS } from './database';
import { rupeesToPaise } from '@/domain/money';

/**
 * Synthetic demonstration data for an Indian kirana shop.
 *
 * Everything here is FAKE and clearly flagged with `demo: true`.
 * Dates are generated relative to "now" so expiry/velocity examples always
 * look realistic, but the dataset itself is deterministic: same inputs →
 * same records (no random values).
 */

export const SEED_VERSION_KEY = 'seedVersion';
export const CURRENT_SEED_VERSION = 1;

function daysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface SeedVariantSpec {
  name: string;
  packSize: number;
  sellingPriceRupees: number;
  costPriceRupees: number | null;
  barcode?: string;
}

interface SeedProductSpec {
  id: string;
  name: string;
  category: Product['category'];
  unit: Product['unit'];
  reorderThreshold: number;
  expiryTracked: boolean;
  supplier?: string;
  variants: (SeedVariantSpec & { id: string })[];
  /** Packs added as opening stock, per variant index. */
  openingStock: number[];
}

const PRODUCT_SPECS: SeedProductSpec[] = [
  {
    id: 'prod_sona_masoori',
    name: 'Sona Masoori Rice',
    category: 'rice-grains',
    unit: 'kg',
    reorderThreshold: 8,
    expiryTracked: false,
    supplier: 'Chennai Wholesale Traders',
    variants: [
      { id: 'var_rice_5kg', name: '5 kg bag', packSize: 5, sellingPriceRupees: 420, costPriceRupees: 385, barcode: '8901030512340' },
      { id: 'var_rice_1kg', name: '1 kg pack', packSize: 1, sellingPriceRupees: 88, costPriceRupees: 78 },
    ],
    openingStock: [12, 40],
  },
  {
    id: 'prod_toor_dal',
    name: 'Toor Dal (Thuvaram Paruppu)',
    category: 'rice-grains',
    unit: 'kg',
    reorderThreshold: 6,
    expiryTracked: true,
    supplier: 'Chennai Wholesale Traders',
    variants: [{ id: 'var_dal_1kg', name: '1 kg pack', packSize: 1, sellingPriceRupees: 165, costPriceRupees: 149 }],
    openingStock: [20],
  },
  {
    id: 'prod_lays',
    name: "Lay's Chips",
    category: 'snacks',
    unit: 'pcs',
    reorderThreshold: 24,
    expiryTracked: true,
    supplier: 'SnackLine Distributors',
    variants: [
      { id: 'var_lays_small', name: 'Small (₹10)', packSize: 1, sellingPriceRupees: 10, costPriceRupees: 8, barcode: '8901491101837' },
      { id: 'var_lays_large', name: 'Large (₹20)', packSize: 1, sellingPriceRupees: 20, costPriceRupees: 16 },
    ],
    openingStock: [60, 30],
  },
  {
    id: 'prod_parle_g',
    name: 'Parle-G Biscuit',
    category: 'biscuits',
    unit: 'pack',
    reorderThreshold: 20,
    expiryTracked: true,
    supplier: 'SnackLine Distributors',
    variants: [
      { id: 'var_parle_small', name: 'Small pack', packSize: 1, sellingPriceRupees: 10, costPriceRupees: 8 },
      { id: 'var_parle_family', name: 'Family pack', packSize: 4, sellingPriceRupees: 55, costPriceRupees: 47 },
    ],
    openingStock: [80, 25],
  },
  {
    id: 'prod_gold_winner',
    name: 'Gold Winner Sunflower Oil',
    category: 'cooking-oil',
    unit: 'l',
    reorderThreshold: 6,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [
      { id: 'var_oil_1l', name: '1 L bottle', packSize: 1, sellingPriceRupees: 148, costPriceRupees: 134 },
      { id: 'var_oil_500ml', name: '500 ml bottle', packSize: 0.5, sellingPriceRupees: 78, costPriceRupees: 69 },
    ],
    openingStock: [14, 22],
  },
  {
    id: 'prod_nandini_milk',
    name: 'Nandini Milk',
    category: 'dairy',
    unit: 'l',
    reorderThreshold: 10,
    expiryTracked: true,
    supplier: 'Daily Dairy Route',
    variants: [{ id: 'var_milk_500ml', name: '500 ml packet', packSize: 0.5, sellingPriceRupees: 27, costPriceRupees: 25 }],
    openingStock: [30],
  },
  {
    id: 'prod_amul_curd',
    name: 'Amul Curd',
    category: 'dairy',
    unit: 'pcs',
    reorderThreshold: 8,
    expiryTracked: true,
    supplier: 'Daily Dairy Route',
    variants: [{ id: 'var_curd_400g', name: '400 g cup', packSize: 1, sellingPriceRupees: 40, costPriceRupees: 36 }],
    openingStock: [18],
  },
  {
    id: 'prod_red_label_tea',
    name: 'Red Label Tea',
    category: 'beverages',
    unit: 'pack',
    reorderThreshold: 5,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_tea_250g', name: '250 g pack', packSize: 1, sellingPriceRupees: 145, costPriceRupees: 132 }],
    openingStock: [16],
  },
  {
    id: 'prod_frooti',
    name: 'Frooti Mango Drink',
    category: 'beverages',
    unit: 'pcs',
    reorderThreshold: 12,
    expiryTracked: true,
    supplier: 'SnackLine Distributors',
    variants: [
      { id: 'var_frooti_160', name: '160 ml', packSize: 1, sellingPriceRupees: 10, costPriceRupees: 8 },
      { id: 'var_frooti_250', name: '250 ml tetra', packSize: 1, sellingPriceRupees: 20, costPriceRupees: 17 },
    ],
    openingStock: [40, 24],
  },
  {
    id: 'prod_dove_shampoo',
    name: 'Dove Shampoo',
    category: 'personal-care',
    unit: 'bottle',
    reorderThreshold: 4,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_shampoo_180ml', name: '180 ml bottle', packSize: 1, sellingPriceRupees: 210, costPriceRupees: 186 }],
    openingStock: [9],
  },
  {
    id: 'prod_surf_excel',
    name: 'Surf Excel Easy Wash',
    category: 'household',
    unit: 'kg',
    reorderThreshold: 4,
    expiryTracked: false,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_surf_1kg', name: '1 kg pack', packSize: 1, sellingPriceRupees: 195, costPriceRupees: 175 }],
    openingStock: [11],
  },
  {
    id: 'prod_colgate',
    name: 'Colgate Strong Teeth',
    category: 'personal-care',
    unit: 'pack',
    reorderThreshold: 5,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_colgate_200g', name: '200 g', packSize: 1, sellingPriceRupees: 112, costPriceRupees: 99 }],
    openingStock: [14],
  },
  {
    id: 'prod_bournvita',
    name: 'Bournvita Jar',
    category: 'beverages',
    unit: 'pack',
    reorderThreshold: 3,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_bourn_500g', name: '500 g jar', packSize: 1, sellingPriceRupees: 285, costPriceRupees: 258 }],
    openingStock: [7],
  },
  {
    // Young product (added ~5 days ago, almost no sales) → "insufficient history"
    id: 'prod_horlicks',
    name: 'Horlicks Classic Malt',
    category: 'beverages',
    unit: 'pack',
    reorderThreshold: 4,
    expiryTracked: true,
    supplier: 'Anna Nagar FMCG',
    variants: [{ id: 'var_horlicks_500g', name: '500 g refill', packSize: 1, sellingPriceRupees: 245, costPriceRupees: 222 }],
    openingStock: [6],
  },
];

/** Sale plan: [variantId, daysAgo, quantity, priceRupees] — deterministic. */
type SaleSpec = [string, number, number, number];

function buildSales(): SaleSpec[] {
  const sales: SaleSpec[] = [];
  const push = (variantId: string, days: number, qty: number, price: number) =>
    sales.push([variantId, days, qty, price]);

  // Fast movers: near-daily sales over the last 30 days.
  for (let d = 1; d <= 30; d += 1) {
    if (d % 7 !== 0) push('var_lays_small', d, 6 + (d % 5), 10);
    if (d % 5 !== 0) push('var_parle_small', d, 5 + (d % 4), 10);
    push('var_milk_500ml', d, 14 + (d % 7), 27);
    if (d % 3 !== 0) push('var_frooti_160', d, 8 + (d % 6), 10);
    if (d % 2 === 0) push('var_rice_1kg', d, 3, 88);
    if (d % 4 === 0) push('var_oil_1l', d, 2, 148);
    if (d % 6 === 0) push('var_curd_400g', d, 5, 40);
    if (d % 7 === 1) push('var_tea_250g', d, 1, 145);
    if (d % 10 === 2) push('var_surf_1kg', d, 1, 195);
    if (d % 9 === 3) push('var_rice_5kg', d, 1, 420);
    if (d % 12 === 4) push('var_lays_large', d, 3, 20);
  }

  // Slow mover: last sale 22 days ago, then nothing.
  push('var_shampoo_180ml', 22, 1, 210);
  push('var_shampoo_180ml', 45, 1, 210);

  // No sales at all for these two (young or dormant).
  push('var_bourn_500g', 40, 1, 285);
  // var_horlicks_500g has no sales at all (added 5 days ago).

  return sales;
}

export interface SeedResult {
  productCount: number;
  variantCount: number;
  saleCount: number;
}

/**
 * Insert (or fully replace) the synthetic demo dataset.
 * Deterministic: no randomness — identical across runs for the same day.
 */
export async function seedDemoData(): Promise<SeedResult> {
  const products: Product[] = [];
  const variants: ProductVariant[] = [];
  const movements: StockMovement[] = [];
  const batches: StockBatch[] = [];
  const sales: Sale[] = [];
  const purchases: Purchase[] = [];

  for (const spec of PRODUCT_SPECS) {
    const createdAt = daysAgo(spec.id === 'prod_horlicks' ? 5 : 60);
    const product: Product = {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      unit: spec.unit,
      active: true,
      reorderThreshold: spec.reorderThreshold,
      expiryTracked: spec.expiryTracked,
      supplier: spec.supplier,
      createdAt,
      updatedAt: createdAt,
      demo: true,
    };
    products.push(product);

    spec.variants.forEach((v, index) => {
      const variant: ProductVariant = {
        id: v.id,
        productId: spec.id,
        name: v.name,
        packSize: v.packSize,
        unit: spec.unit,
        sellingPrice: rupeesToPaise(v.sellingPriceRupees),
        costPrice: v.costPriceRupees == null ? null : rupeesToPaise(v.costPriceRupees),
        barcode: v.barcode,
        active: true,
        createdAt,
        updatedAt: createdAt,
        demo: true,
      };
      variants.push(variant);

      const opening = spec.openingStock[index] ?? 0;
      movements.push({
        id: `mov_open_${v.id}`,
        variantId: v.id,
        productId: spec.id,
        movementType: 'opening',
        signedQuantity: opening,
        unitCost: v.costPriceRupees == null ? null : rupeesToPaise(v.costPriceRupees),
        timestamp: createdAt,
        reason: 'opening',
        demo: true,
      });
    });
  }

  // --- one past purchase receipt per tracked product (creates movement) ---
  for (const spec of PRODUCT_SPECS) {
    if (!spec.expiryTracked) continue;
    const firstVariant = spec.variants[0];
    if (!firstVariant) continue;
    const qty = 12;
    const unitCost = rupeesToPaise(firstVariant.costPriceRupees ?? 0);
    const purchaseId = `purch_${spec.id}`;
    const receivedAt = daysAgo(18, 11);
    const batch: StockBatch = {
      id: `batch_${spec.id}`,
      variantId: firstVariant.id,
      productId: spec.id,
      batchCode: `B-${spec.id.slice(-6).toUpperCase()}`,
      receivedQuantity: qty,
      remainingQuantity: qty,
      expiryDate: dateAfter(45),
      receivedAt,
      unitCost,
      demo: true,
    };
    batches.push(batch);
    movements.push({
      id: `mov_purch_${firstVariant.id}`,
      variantId: firstVariant.id,
      productId: spec.id,
      batchId: batch.id,
      movementType: 'purchase',
      signedQuantity: qty,
      unitCost,
      timestamp: receivedAt,
      reason: 'purchase',
      referenceId: purchaseId,
      demo: true,
    });
    purchases.push({
      id: purchaseId,
      items: [
        {
          variantId: firstVariant.id,
          productId: spec.id,
          productName: spec.name,
          variantName: firstVariant.name,
          quantity: qty,
          unitCost,
          lineTotal: qty * unitCost,
          batchId: batch.id,
        },
      ],
      supplier: spec.supplier,
      purchaseDate: receivedAt.slice(0, 10),
      totalCost: qty * unitCost,
      createdAt: receivedAt,
      demo: true,
    });
  }

  // --- targeted expiry examples ---
  const bumpBatch = (batchId: string, expiryDate: string, remaining?: number) => {
    const b = batches.find((x) => x.id === batchId);
    if (b) {
      b.expiryDate = expiryDate;
      if (remaining !== undefined) b.remainingQuantity = remaining;
    }
  };
  bumpBatch('batch_prod_nandini_milk', dateAfter(1), 9); // critical: expires tomorrow
  bumpBatch('batch_prod_amul_curd', dateAfter(-2), 4); // expired 2 days ago
  bumpBatch('batch_prod_frooti', dateAfter(3), 14); // warning
  bumpBatch('batch_prod_lays', dateAfter(12), 20); // warning band
  bumpBatch('batch_prod_parle_g', dateAfter(-1), 6); // expired
  bumpBatch('batch_prod_toor_dal', dateAfter(25), 15); // warning band (≤30d)

  // --- sales ---
  const salesSpecs = buildSales();
  let saleIndex = 0;
  for (const [variantId, days, qty, priceRupees] of salesSpecs) {
    saleIndex += 1;
    const variant = variants.find((v) => v.id === variantId);
    const product = variant ? products.find((p) => p.id === variant.productId) : undefined;
    if (!variant || !product) continue;
    const createdAt = daysAgo(days, 9 + (saleIndex % 10));
    const unitPrice = rupeesToPaise(priceRupees);
    const item: SaleItem = {
      variantId,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      quantity: qty,
      unitPrice,
      lineTotal: qty * unitPrice,
    };
    sales.push({
      id: `sale_${String(saleIndex).padStart(4, '0')}`,
      items: [item],
      totalAmount: item.lineTotal,
      createdAt,
      status: 'completed',
      demo: true,
    });
    movements.push({
      id: `mov_sale_${String(saleIndex).padStart(4, '0')}`,
      variantId,
      productId: product.id,
      movementType: 'sale',
      signedQuantity: -qty,
      timestamp: createdAt,
      reason: 'sale',
      referenceId: sales[sales.length - 1].id,
      demo: true,
    });
  }

  // --- a couple of damage / return movements for history richness ---
  movements.push({
    id: 'mov_damage_lays_1',
    variantId: 'var_lays_small',
    productId: 'prod_lays',
    movementType: 'damage',
    signedQuantity: -4,
    timestamp: daysAgo(9, 17),
    reason: 'damage',
    demo: true,
  });
  movements.push({
    id: 'mov_return_parle_1',
    variantId: 'var_parle_small',
    productId: 'prod_parle_g',
    movementType: 'return',
    signedQuantity: 2,
    timestamp: daysAgo(6, 12),
    reason: 'return',
    demo: true,
  });

  // --- write everything in one transaction ---
  await db.transaction(
    'rw',
    [db.products, db.variants, db.sales, db.purchases, db.stockMovements, db.batches, db.settings],
    async () => {
      await db.products.bulkPut(products);
      await db.variants.bulkPut(variants);
      await db.sales.bulkPut(sales);
      await db.purchases.bulkPut(purchases);
      await db.stockMovements.bulkPut(movements);
      await db.batches.bulkPut(batches);
      const existing = await db.settings.get('app');
      const settings = existing ?? { ...DEFAULT_SETTINGS };
      await db.settings.put({
        ...settings,
        id: 'app',
        updatedAt: new Date().toISOString(),
      });
    },
  );

  return {
    productCount: products.length,
    variantCount: variants.length,
    saleCount: sales.length,
  };
}

/** Seed bookkeeping row lives in the `meta` table. */
interface SeedMeta {
  id: 'seed';
  seedVersion: number;
}

/**
 * Versioned seed initialization: seeds only when not yet seeded (or when
 * the stored seed version is older). Never duplicates data on reload.
 */
export async function ensureSeeded(): Promise<void> {
  const meta = (await db.meta.get('seed')) as SeedMeta | undefined;
  const productCount = await db.products.count();
  if (productCount > 0 && meta && meta.seedVersion >= CURRENT_SEED_VERSION) return;
  if (productCount === 0) {
    await seedDemoData();
    await db.meta.put({ id: 'seed', seedVersion: CURRENT_SEED_VERSION } satisfies SeedMeta);
  }
}

/** Full reset: clears business tables, restores the synthetic dataset. */
export async function resetDemoData(): Promise<SeedResult> {
  await db.transaction(
    'rw',
    [db.products, db.variants, db.sales, db.purchases, db.stockMovements, db.batches, db.restockPlans],
    async () => {
      await db.products.clear();
      await db.variants.clear();
      await db.sales.clear();
      await db.purchases.clear();
      await db.stockMovements.clear();
      await db.batches.clear();
      await db.restockPlans.clear();
    },
  );
  await db.meta.put({ id: 'seed', seedVersion: CURRENT_SEED_VERSION } satisfies SeedMeta);
  return seedDemoData();
}
