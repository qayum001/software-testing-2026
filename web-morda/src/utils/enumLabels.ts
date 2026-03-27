import type {
  CookingType,
  DietaryFlag,
  DishCategory,
  FlagFilterOption,
  ProductCategory,
  ProductSortField,
  SortDirection,
} from '../types/api'

export const cookingTypeLabels: Record<CookingType, string> = {
  1: 'Готово к употреблению',
  2: 'Полуфабрикат',
  3: 'Требует приготовления',
}

export const dietaryFlagLabels: Record<DietaryFlag, string> = {
  1: 'Веганское',
  2: 'Без глютена',
  3: 'Без сахара',
}

export const dishCategoryLabels: Record<DishCategory, string> = {
  1: 'Десерт',
  2: 'Первое',
  3: 'Второе',
  4: 'Напиток',
  5: 'Салат',
  6: 'Суп',
  7: 'Перекус',
}

export const flagFilterOptionLabels: Record<FlagFilterOption, string> = {
  1: 'Любой',
  2: 'Да',
  3: 'Нет',
}

export const productCategoryLabels: Record<ProductCategory, string> = {
  1: 'Замороженное',
  2: 'Мясо',
  3: 'Овощи',
  4: 'Зелень',
  5: 'Специи',
  6: 'Крупы',
  7: 'Консервы',
  8: 'Жидкости',
  9: 'Сладости',
}

export const productSortFieldLabels: Record<ProductSortField, string> = {
  1: 'Название',
  2: 'Калории',
  3: 'Белки',
  4: 'Жиры',
  5: 'Углеводы',
}

export const sortDirectionLabels: Record<SortDirection, string> = {
  1: 'По возрастанию',
  2: 'По убыванию',
}

export function getEnumLabel<T extends number>(
  value: T | null | undefined,
  labels: Record<number, string>,
) {
  if (value === null || value === undefined) {
    return '—'
  }

  return labels[value] ?? String(value)
}

export function getEnumListLabel<T extends number>(
  values: T[] | null | undefined,
  labels: Record<number, string>,
) {
  if (!values || values.length === 0) {
    return '—'
  }

  return values.map((value) => labels[value] ?? String(value)).join(', ')
}
