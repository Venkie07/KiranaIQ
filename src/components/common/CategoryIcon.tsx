import {
  Beef,
  Cookie,
  CupSoda,
  Droplets,
  House,
  Package,
  ShoppingBasket,
  Sparkles,
  Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProductCategory } from '@/domain/types';

const ICONS: Record<ProductCategory, LucideIcon> = {
  'rice-grains': Wheat,
  snacks: ShoppingBasket,
  biscuits: Cookie,
  'cooking-oil': Droplets,
  dairy: Beef,
  beverages: CupSoda,
  'personal-care': Sparkles,
  household: House,
  other: Package,
};

/** Category icon tile. Decorative — the category name is always in text. */
export function CategoryIcon({ category, size = 22 }: { category: ProductCategory; size?: number }) {
  const Icon = ICONS[category] ?? Package;
  return (
    <span className="cat-icon" aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
