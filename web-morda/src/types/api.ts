export type CookingType = 1 | 2 | 3
export type DietaryFlag = 1 | 2 | 3
export type DishCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type FlagFilterOption = 1 | 2 | 3
export type ProductCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type ProductSortField = 1 | 2 | 3 | 4 | 5
export type SortDirection = 1 | 2

export const cookingTypeValues: readonly CookingType[] = [1, 2, 3]
export const dietaryFlagValues: readonly DietaryFlag[] = [1, 2, 3]
export const dishCategoryValues: readonly DishCategory[] = [1, 2, 3, 4, 5, 6, 7]
export const flagFilterOptionValues: readonly FlagFilterOption[] = [1, 2, 3]
export const productCategoryValues: readonly ProductCategory[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
]
export const productSortFieldValues: readonly ProductSortField[] = [1, 2, 3, 4, 5]
export const sortDirectionValues: readonly SortDirection[] = [1, 2]

export interface DishProductRequest {
  productId?: string
  amount?: number
}

export interface DishProductResponse {
  productId?: string
  productName?: string | null
  amount?: number
}

export interface NutritionResponse {
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
}

export interface ProblemDetails {
  type?: string | null
  title?: string | null
  status?: number | null
  detail?: string | null
  instance?: string | null
  [key: string]: unknown
}

export interface CreateProductRequest {
  name?: string | null
  photos?: string[] | null
  photoFiles?: File[] | null
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
  composition?: string | null
  category?: ProductCategory
  cookingType?: CookingType
  flags?: DietaryFlag[] | null
}

export type UpdateProductRequest = CreateProductRequest

export interface ProductResponse {
  id?: string
  name?: string | null
  photos?: string[] | null
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
  composition?: string | null
  category?: ProductCategory
  cookingType?: CookingType
  flags?: DietaryFlag[] | null
  createdAt?: string
  updatedAt?: string | null
}

export interface CreateDishRequest {
  name?: string | null
  photos?: string[] | null
  photoFiles?: File[] | null
  calories?: number | null
  proteins?: number | null
  fats?: number | null
  carbs?: number | null
  products?: DishProductRequest[] | null
  portionSize?: number
  category?: DishCategory
  flags?: DietaryFlag[] | null
}

export type UpdateDishRequest = CreateDishRequest

export interface DishResponse {
  id?: string
  name?: string | null
  photos?: string[] | null
  calories?: number
  proteins?: number
  fats?: number
  carbs?: number
  autoCalculatedNutrition?: NutritionResponse
  portionSize?: number
  category?: DishCategory
  flags?: DietaryFlag[] | null
  availableFlags?: DietaryFlag[] | null
  products?: DishProductResponse[] | null
  createdAt?: string
  updatedAt?: string | null
}

export interface ProductListQuery {
  Category?: ProductCategory
  CookingType?: CookingType
  Vegan?: FlagFilterOption
  GlutenFree?: FlagFilterOption
  SugarFree?: FlagFilterOption
  Search?: string
  SortBy?: ProductSortField
  SortDirection?: SortDirection
}

export interface DishListQuery {
  Category?: DishCategory
  Vegan?: FlagFilterOption
  GlutenFree?: FlagFilterOption
  SugarFree?: FlagFilterOption
  Search?: string
}
