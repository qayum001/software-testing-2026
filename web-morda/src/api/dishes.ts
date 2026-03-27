import { apiRequest } from './client'
import { buildDishFormData } from './formData'
import type {
  CreateDishRequest,
  DishListQuery,
  DishResponse,
  UpdateDishRequest,
} from '../types/api'

export const dishesApi = {
  list(query?: DishListQuery) {
    return apiRequest<DishResponse[]>('/api/dishes', {
      method: 'GET',
      query,
    })
  },

  get(id: string) {
    return apiRequest<DishResponse>(`/api/dishes/${id}`, {
      method: 'GET',
    })
  },

  create(body: CreateDishRequest) {
    return apiRequest<DishResponse, FormData>('/api/dishes', {
      method: 'POST',
      body: buildDishFormData(body),
    })
  },

  update(id: string, body: UpdateDishRequest) {
    return apiRequest<DishResponse, FormData>(`/api/dishes/${id}`, {
      method: 'PUT',
      body: buildDishFormData(body),
    })
  },

  remove(id: string) {
    return apiRequest<void>(`/api/dishes/${id}`, {
      method: 'DELETE',
    })
  },
}
