import type { RestockReason } from '@/domain/types';

const RESTOCK_REASON_KEYS: Record<RestockReason, string> = {
  'low-stock': 'restock.reasonLowStock',
  'stockout-risk': 'restock.reasonStockoutRisk',
  'high-sales': 'restock.reasonHighSales',
  'expiry-concern': 'restock.reasonExpiryConcern',
  'insufficient-history': 'restock.reasonInsufficientHistory',
  'budget-limit': 'restock.reasonBudgetLimit',
  'pack-size': 'restock.reasonPackSize',
  'no-cost': 'restock.reasonNoCost',
  manual: 'restock.reasonManual',
};

export function restockReasonTranslationKey(reason: RestockReason): string {
  return RESTOCK_REASON_KEYS[reason];
}
