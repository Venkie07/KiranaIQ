import { describe, expect, it } from 'vitest';
import { restockReasonTranslationKey } from '@/features/restock/restockTranslations';

describe('restockReasonTranslationKey', () => {
  it('maps kebab-case reasons to exact translation keys', () => {
    expect(restockReasonTranslationKey('low-stock')).toBe('restock.reasonLowStock');
    expect(restockReasonTranslationKey('stockout-risk')).toBe('restock.reasonStockoutRisk');
    expect(restockReasonTranslationKey('insufficient-history')).toBe('restock.reasonInsufficientHistory');
    expect(restockReasonTranslationKey('budget-limit')).toBe('restock.reasonBudgetLimit');
  });

  it('maps every restock reason variant', () => {
    const reasons = [
      'low-stock',
      'stockout-risk',
      'high-sales',
      'expiry-concern',
      'insufficient-history',
      'budget-limit',
      'pack-size',
      'no-cost',
      'manual',
    ] as const;

    for (const reason of reasons) {
      expect(restockReasonTranslationKey(reason)).toMatch(/^restock\.reason[A-Z]/);
    }
  });
});
