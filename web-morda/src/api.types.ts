export type CookingType = 1 | 2 | 3;

export type DietaryFlag = 1 | 2 | 3;

export type FlagFilterOption = 1 | 2 | 3;

export type DishCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ProductCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ProductSortField = 1 | 2 | 3 | 4 | 5;

export type SortDirection = 1 | 2;

export interface ProblemDetails {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  instance?: string | null;
  [key: string]: unknown;
}

export interface NutritionResponse {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
}

export interface DishProductRequest {
  productId: string;
  amount: number;
}

export interface DishProductResponse {
  productId: string;
  productName?: string | null;
  amount: number;
}

export interface CreateProductRequest {
  name?: string | null;
  photos?: string[] | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  composition?: string | null;
  category: ProductCategory;
  cookingType: CookingType;
  flags?: DietaryFlag[] | null;
}

export interface UpdateProductRequest extends CreateProductRequest {}

export interface ProductResponse {
  id: string;
  name?: string | null;
  photos?: string[] | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  composition?: string | null;
  category: ProductCategory;
  cookingType: CookingType;
  flags?: DietaryFlag[] | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateDishRequest {
  name?: string | null;
  photos?: string[] | null;
  calories?: number | null;
  proteins?: number | null;
  fats?: number | null;
  carbs?: number | null;
  products?: DishProductRequest[] | null;
  portionSize: number;
  category?: DishCategory;
  flags?: DietaryFlag[] | null;
}

export interface UpdateDishRequest extends CreateDishRequest {}

export interface DishResponse {
  id: string;
  name?: string | null;
  photos?: string[] | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  autoCalculatedNutrition: NutritionResponse;
  portionSize: number;
  category: DishCategory;
  flags?: DietaryFlag[] | null;
  availableFlags?: DietaryFlag[] | null;
  products?: DishProductResponse[] | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ProductListFilters {
  Category?: ProductCategory;
  CookingType?: CookingType;
  Vegan?: FlagFilterOption;
  GlutenFree?: FlagFilterOption;
  SugarFree?: FlagFilterOption;
  Search?: string;
  SortBy?: ProductSortField;
  SortDirection?: SortDirection;
}

export interface DishListFilters {
  Category?: DishCategory;
  Vegan?: FlagFilterOption;
  GlutenFree?: FlagFilterOption;
  SugarFree?: FlagFilterOption;
  Search?: string;
}
