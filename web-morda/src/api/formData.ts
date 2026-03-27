import type {
  CreateDishRequest,
  CreateProductRequest,
  UpdateDishRequest,
  UpdateProductRequest,
} from '../types/api'

function appendText(formData: FormData, key: string, value: string | null | undefined) {
  if (value === null || value === undefined) {
    return
  }

  formData.append(key, value)
}

function appendNumber(formData: FormData, key: string, value: number | null | undefined) {
  if (value === null || value === undefined) {
    return
  }

  formData.append(key, String(value))
}

function appendPhotos(formData: FormData, photos: string[] | null | undefined) {
  for (const photo of photos ?? []) {
    appendText(formData, 'Photos', photo)
  }
}

function appendPhotoFiles(formData: FormData, photoFiles: File[] | null | undefined) {
  for (const file of photoFiles ?? []) {
    formData.append('PhotoFiles', file)
  }
}

function appendFlags(formData: FormData, flags: number[] | null | undefined) {
  for (const flag of flags ?? []) {
    formData.append('Flags', String(flag))
  }
}

export function buildProductFormData(
  request: CreateProductRequest | UpdateProductRequest,
) {
  const formData = new FormData()

  appendText(formData, 'Name', request.name)
  appendPhotos(formData, request.photos)
  appendPhotoFiles(formData, request.photoFiles)
  appendNumber(formData, 'Calories', request.calories)
  appendNumber(formData, 'Proteins', request.proteins)
  appendNumber(formData, 'Fats', request.fats)
  appendNumber(formData, 'Carbs', request.carbs)
  appendText(formData, 'Composition', request.composition)
  appendNumber(formData, 'Category', request.category)
  appendNumber(formData, 'CookingType', request.cookingType)
  appendFlags(formData, request.flags)

  return formData
}

export function buildDishFormData(
  request: CreateDishRequest | UpdateDishRequest,
) {
  const formData = new FormData()

  appendText(formData, 'Name', request.name)
  appendPhotos(formData, request.photos)
  appendPhotoFiles(formData, request.photoFiles)
  appendNumber(formData, 'Calories', request.calories)
  appendNumber(formData, 'Proteins', request.proteins)
  appendNumber(formData, 'Fats', request.fats)
  appendNumber(formData, 'Carbs', request.carbs)
  appendNumber(formData, 'PortionSize', request.portionSize)
  appendNumber(formData, 'Category', request.category)
  appendFlags(formData, request.flags)

  request.products?.forEach((product, index) => {
    appendText(formData, `Products[${index}].ProductId`, product.productId)
    appendNumber(formData, `Products[${index}].Amount`, product.amount)
  })

  return formData
}
