import { z } from 'zod';
import type { Language, MovementType, ProductCategory, ThemePreference, Unit } from './types';

const languageSchema = z.enum(['en', 'ta', 'hi', 'kn']);
const categorySchema = z.enum([
  'rice-grains',
  'snacks',
  'biscuits',
  'cooking-oil',
  'dairy',
  'beverages',
  'personal-care',
  'household',
  'other',
]);
const unitSchema = z.enum(['pcs', 'kg', 'g', 'l', 'ml', 'pack', 'bottle', 'dozen']);

/** Positive whole number of packs. */
export const packQuantitySchema = z
  .number({ invalid_type_error: 'validation.quantityInvalid' })
  .int('validation.quantityInteger')
  .min(1, 'validation.quantityMin')
  .max(100_000, 'validation.quantityMax');

/** Money entered in rupees by the user, converted to paise before validation. */
export const rupeeAmountSchema = z
  .number({ invalid_type_error: 'validation.amountInvalid' })
  .min(0, 'validation.amountNegative')
  .max(1_000_000, 'validation.amountTooLarge');

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameMin').max(80, 'validation.nameMax'),
  localDisplayNameTa: z.string().trim().max(80).optional().or(z.literal('')),
  localDisplayNameHi: z.string().trim().max(80).optional().or(z.literal('')),
  category: categorySchema,
  unit: unitSchema,
  variantName: z.string().trim().min(1, 'validation.variantNameRequired').max(40),
  packSize: z
    .number({ invalid_type_error: 'validation.packSizeInvalid' })
    .positive('validation.packSizePositive')
    .max(10_000, 'validation.packSizeMax'),
  sellingPrice: rupeeAmountSchema,
  costPrice: rupeeAmountSchema.nullable(),
  initialStock: packQuantitySchema,
  reorderThreshold: z
    .number({ invalid_type_error: 'validation.thresholdInvalid' })
    .int('validation.thresholdInteger')
    .min(0, 'validation.thresholdNegative')
    .max(10_000, 'validation.thresholdMax'),
  barcode: z.string().trim().max(64).optional().or(z.literal('')),
  supplier: z.string().trim().max(80).optional().or(z.literal('')),
  expiryTracked: z.boolean(),
  active: z.boolean(),
});

export type ProductFormValues = z.input<typeof productFormSchema>;

export const productUpdateSchema = productFormSchema;

export const saleFormSchema = z.object({
  variantId: z.string().min(1, 'validation.productRequired'),
  quantity: packQuantitySchema,
  /** Paise per pack. */
  unitPrice: z
    .number({ invalid_type_error: 'validation.priceInvalid' })
    .min(0, 'validation.priceNegative')
    .max(10_000_000, 'validation.priceTooLarge'),
});

export type SaleFormValues = z.input<typeof saleFormSchema>;

export const purchaseFormSchema = z.object({
  variantId: z.string().min(1, 'validation.productRequired'),
  quantity: packQuantitySchema,
  /** Paise per pack. */
  unitCost: z
    .number({ invalid_type_error: 'validation.costInvalid' })
    .min(0, 'validation.costNegative')
    .max(10_000_000, 'validation.costTooLarge'),
  supplier: z.string().trim().max(80).optional().or(z.literal('')),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateInvalid'),
  trackBatch: z.boolean(),
  batchCode: z.string().trim().max(40).optional().or(z.literal('')),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateInvalid')
    .optional()
    .or(z.literal('')),
});

export type PurchaseFormValues = z.input<typeof purchaseFormSchema>;

export const MOVEMENT_TYPES: MovementType[] = [
  'opening',
  'purchase',
  'sale',
  'return',
  'damage',
  'expiry',
  'correction',
];

export const correctionFormSchema = z.object({
  variantId: z.string().min(1, 'validation.productRequired'),
  /** New corrected value (packs) for the variant. */
  newQuantity: z
    .number({ invalid_type_error: 'validation.quantityInvalid' })
    .int('validation.quantityInteger')
    .min(0, 'validation.thresholdNegative')
    .max(100_000, 'validation.quantityMax'),
  reason: z.string().trim().min(3, 'validation.reasonMin').max(120, 'validation.reasonMax'),
});

export type CorrectionFormValues = z.input<typeof correctionFormSchema>;

export const restockBudgetSchema = z.object({
  /** Rupees entered by the user. */
  budgetRupees: z
    .number({ invalid_type_error: 'validation.budgetInvalid' })
    .positive('validation.budgetPositive')
    .max(10_000_000, 'validation.budgetTooLarge'),
});

export const settingsSchema = z.object({
  language: languageSchema,
  theme: z.enum(['light', 'dark', 'system']),
  currency: z.literal('INR'),
  shopName: z.string().trim().max(60).optional().or(z.literal('')),
  expiryWarningDays: z.number().int().min(1).max(365),
  defaultReorderThreshold: z.number().int().min(0).max(10_000),
  slowMovingDays: z.number().int().min(7).max(365),
  restockLookbackDays: z.number().int().min(7).max(180),
  lockPolicy: z.enum(['immediate', 'minute-1', 'minute-5', 'minute-15']),
  onboardingComplete: z.boolean(),
});

export const pinSchema = z.string().regex(/^\d{4,6}$/, 'validation.pinFormat');

/* ------------------------------------------------------------------ */
/* Backup validation                                                   */
/* ------------------------------------------------------------------ */

const productRecord = z.object({
  id: z.string(),
  name: z.string(),
  category: categorySchema,
  unit: unitSchema,
  active: z.boolean(),
  reorderThreshold: z.number().int().min(0),
  expiryTracked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const variantRecord = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  packSize: z.number().positive(),
  unit: unitSchema,
  sellingPrice: z.number().int().min(0),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

const movementRecord = z.object({
  id: z.string(),
  variantId: z.string(),
  movementType: z.enum(MOVEMENT_TYPES as [MovementType, ...MovementType[]]),
  signedQuantity: z.number().int(),
  timestamp: z.string(),
  reason: z.string(),
}).passthrough();

/** Full backup file validation — runs before any local write. */
export const backupFileSchema = z.object({
  schemaVersion: z.literal(1),
  app: z.literal('kiranaiq'),
  exportedAt: z.string(),
  data: z.object({
    products: z.array(productRecord),
    variants: z.array(variantRecord),
    sales: z.array(z.object({ id: z.string() }).passthrough()),
    purchases: z.array(z.object({ id: z.string() }).passthrough()),
    stockMovements: z.array(movementRecord),
    batches: z.array(z.object({ id: z.string() }).passthrough()),
    settings: z
      .object({ id: z.literal('app') })
      .passthrough()
      .nullable(),
  }),
  meta: z.object({ demoDataIncluded: z.boolean(), recordCount: z.number() }).passthrough(),
});

/** Casts a validated backup payload into typed records. */
export function parseBackup(raw: unknown):
  | { ok: true; backup: import('./types').BackupFile }
  | { ok: false; error: string } {
  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'errors.importInvalid' };
  }
  return { ok: true, backup: raw as import('./types').BackupFile };
}

export type { Language, ProductCategory, ThemePreference, Unit };
