import { useCallback } from 'react';
import { getServices } from '@/services/serviceFactory';
import type { NewProductInput } from '@/services/interfaces';

export function useProducts() {
  const services = getServices();

  const loadProducts = useCallback(async (filter?: any) => {
    try {
      return await services.products.list(filter);
    } catch (err) {
      console.error('[useProducts] load failed', err);
      throw err;
    }
  }, []);

  const createProduct = async (input: NewProductInput) => {
    try {
      const id = await services.products.create(input);
      return id;
    } catch (err) {
      console.error('[useProducts] create failed', err);
      throw err;
    }
  };

  return { loadProducts, createProduct };
}