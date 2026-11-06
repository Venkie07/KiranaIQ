import { useState, useCallback } from 'react';
import { getServices } from '@/services/serviceFactory';
import type { ProductDetail } from '@/services/interfaces';

export function useProduct(productId: string) {
  const services = getServices();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await services.products.getDetail(productId);
      if (!result) {
        setError('errors.notFound');
      } else {
        setDetail(result);
      }
    } catch (err) {
      console.error('[useProduct] load failed', err);
      setError('errors.dbInit');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const updateProduct = async (patch: any) => {
    try {
      await services.products.update(productId, patch);
      await loadProduct();
    } catch (err) {
      console.error('[useProduct] update failed', err);
      throw err;
    }
  };

  const updateVariant = async (variantId: string, patch: any) => {
    try {
      await services.products.updateVariant(variantId, patch);
      await loadProduct();
    } catch (err) {
      console.error('[useProduct] updateVariant failed', err);
      throw err;
    }
  };

  return { detail, loading, error, loadProduct, updateProduct, updateVariant };
}