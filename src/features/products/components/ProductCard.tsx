import { Link } from 'react-router-dom';
import { Edit3, Eye, Trash2 } from 'lucide-react';
import { StockBadge } from '@/components/common/Badges';
import { formatMoney } from '@/domain/money';

interface ProductCardProps {
  product: any; // Using any for brevity, should use ProductStockView
  onDelete?: (id: string) => void;
  language: string;
}

export function ProductCard({ product, onDelete, language }: ProductCardProps) {
  return (
    <div className="card list-card">
      <div className="list-row">
        <div className="list-row__main">
          <div className="list-row__title">
            <Link to={`/products/${product.product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {product.product.name}
            </Link>
          </div>
          <div className="list-row__meta">
            {product.variant.name} · {formatMoney(product.variant.sellingPrice, language)}
          </div>
        </div>
        <div className="list-row__end">
          <div className="stack" style={{ flexDirection: 'row', gap: 'var(--space-2)', alignItems: 'center' }}>
            <Link to={`/products/${product.product.id}/edit`} className="btn btn--ghost btn--sm" title="Edit">
              <Edit3 size={16} />
            </Link>
            <Link to={`/products/${product.product.id}`} className="btn btn--ghost btn--sm" title="View">
              <Eye size={16} />
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete?.(product.product.id);
              }}
              className="btn btn--ghost btn--sm text-danger"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <span className="product-card__stock">{product.usableStock}</span>
            <StockBadge status={product.usableStock <= 0 ? 'out' : product.usableStock <= product.product.reorderThreshold ? 'low' : 'ok'} />
          </div>
        </div>
      </div>
    </div>
  );
}