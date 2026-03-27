import { apiRequest } from './client'
import { buildProductFormData } from './formData'
import type {
  CreateProductRequest,
  ProductListQuery,
  ProductResponse,
  UpdateProductRequest,
} from '../types/api'

export const productsApi = {
  list(query?: ProductListQuery) {
    return apiRequest<ProductResponse[]>('/api/products', {
      method: 'GET',
      query,
    })
  },

  get(id: string) {
    return apiRequest<ProductResponse>(`/api/products/${id}`, {
      method: 'GET',
    })
  },

  create(body: CreateProductRequest) {
    return apiRequest<ProductResponse, FormData>('/api/products', {
      method: 'POST',
      body: buildProductFormData(body),
    })
  },

  update(id: string, body: UpdateProductRequest) {
    return apiRequest<ProductResponse, FormData>(`/api/products/${id}`, {
      method: 'PUT',
      body: buildProductFormData(body),
    })
  },

  remove(id: string) {
    return apiRequest<void>(`/api/products/${id}`, {
      method: 'DELETE',
    })
  },
}
