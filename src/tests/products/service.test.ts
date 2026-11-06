import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalServices } from '@/services/local';
import { db } from '@/db/database';

describe('Product Service Integration', () => {
  let services: any;

  beforeEach(async () => {
    services = createLocalServices();
    await db.products.clear();
    await db.variants.clear();
    await db.stockMovements.clear();
    await db.batches.clear();
  });

  it('should create a product with multiple variants and calculate stock correctly', async () => {
    const productId = await services.products.create({
      name: 'Test Product',
      category: 'other',
      unit: 'pcs',
      reorderThreshold: 5,
      expiryTracked: false,
      variants: [
        { name: 'Small', packSize: 1, sellingPrice: 1000, costPrice: 500, initialStock: 10 },
        { name: 'Large', packSize: 2, sellingPrice: 2000, costPrice: 1000, initialStock: 5 },
      ],
    });

    const detail = await services.products.getDetail(productId);
    expect(detail).not.toBeNull();
    expect(detail?.variants.length).toBe(2);
    const stockByName = Object.fromEntries(
      detail?.variants.map((v: { variant: { name: string }; usableStock: number }) =>
        [v.variant.name, v.usableStock],
      ) ?? [],
    );
    expect(stockByName.Small).toBe(10);
    expect(stockByName.Large).toBe(5);
  });

  it('should handle soft-delete for products with history', async () => {
    const productId = await services.products.create({
      name: 'History Product',
      category: 'other',
      unit: 'pcs',
      reorderThreshold: 5,
      expiryTracked: false,
      variants: [{ name: 'V1', packSize: 1, sellingPrice: 100, costPrice: 50, initialStock: 10 }],
    });

    await services.products.delete(productId);
    const product = await db.products.get(productId);
    expect(product?.active).toBe(false); // Soft delete
  });

  it('should hard-delete products without history', async () => {
    const productId = await services.products.create({
      name: 'No History Product',
      category: 'other',
      unit: 'pcs',
      reorderThreshold: 5,
      expiryTracked: false,
      variants: [{ name: 'V1', packSize: 1, sellingPrice: 100, costPrice: 50, initialStock: 0 }],
    });

    await services.products.delete(productId);
    const product = await db.products.get(productId);
    expect(product).toBeUndefined(); // Dexie returns undefined when a record is absent
  });
});
