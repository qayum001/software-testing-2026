import { apiConfig } from './api.config';
import { requestJson, toQueryString } from './api.http';
import type {
  CreateDishRequest,
  CreateProductRequest,
  DishListFilters,
  DishResponse,
  ProductListFilters,
  ProductResponse,
  UpdateDishRequest,
  UpdateProductRequest,
} from './api.types';

function withBase(path: string): string {
  return `${apiConfig.baseUrl}${path}`;
}

export const cookbookApi = {
  getProducts(filters: ProductListFilters): Promise<ProductResponse[]> {
    const query = toQueryString(filters as Record<string, string | number | boolean | undefined>);
    return requestJson<ProductResponse[]>(withBase(`/api/products${query}`));
  },

  getProduct(id: string): Promise<ProductResponse> {
    return requestJson<ProductResponse>(withBase(`/api/products/${id}`));
  },

  createProduct(payload: CreateProductRequest): Promise<ProductResponse> {
    return requestJson<ProductResponse>(withBase('/api/products'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  updateProduct(id: string, payload: UpdateProductRequest): Promise<ProductResponse> {
    return requestJson<ProductResponse>(withBase(`/api/products/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  deleteProduct(id: string): Promise<null> {
    return requestJson<null>(withBase(`/api/products/${id}`), { method: 'DELETE' });
  },

  getDishes(filters: DishListFilters): Promise<DishResponse[]> {
    const query = toQueryString(filters as Record<string, string | number | boolean | undefined>);
    return requestJson<DishResponse[]>(withBase(`/api/dishes${query}`));
  },

  getDish(id: string): Promise<DishResponse> {
    return requestJson<DishResponse>(withBase(`/api/dishes/${id}`));
  },

  createDish(payload: CreateDishRequest): Promise<DishResponse> {
    return requestJson<DishResponse>(withBase('/api/dishes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  updateDish(id: string, payload: UpdateDishRequest): Promise<DishResponse> {
    return requestJson<DishResponse>(withBase(`/api/dishes/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  deleteDish(id: string): Promise<null> {
    return requestJson<null>(withBase(`/api/dishes/${id}`), { method: 'DELETE' });
  },
};