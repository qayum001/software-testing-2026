import { useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  CookingType,
  CreateProductRequest,
  DietaryFlag,
  ProblemDetails,
  ProductCategory,
  ProductResponse,
  UpdateProductRequest,
} from '../types/api'
import { cookingTypeValues, dietaryFlagValues, productCategoryValues } from '../types/api'
import {
  cleanNullableText,
  parseNumericSelection,
  parseRequiredNumber,
  toggleNumericValue,
} from '../utils/forms'
import {
  cookingTypeLabels,
  dietaryFlagLabels,
  productCategoryLabels,
} from '../utils/enumLabels'
import { validateMacroValues } from '../utils/nutrition'
import { MAX_PHOTOS } from '../utils/photos'
import { getFieldErrors, getValidationErrors } from '../utils/problemDetails'
import { FieldErrors } from './FieldErrors'
import { PhotoManager, type PendingPhotoFile } from './PhotoManager'

interface ProductFormProps {
  initialProduct?: ProductResponse | null
  backendBaseUrl: string
  pending: boolean
  problem?: ProblemDetails | null
  onCancel: () => void
  onSubmit: (payload: CreateProductRequest | UpdateProductRequest) => Promise<void>
}

interface ProductFormState {
  name: string
  photos: string[]
  newPhotoPath: string
  photoFiles: PendingPhotoFile[]
  calories: string
  proteins: string
  fats: string
  carbs: string
  composition: string
  category: string
  cookingType: string
  flags: number[]
}

function buildInitialState(product?: ProductResponse | null): ProductFormState {
  return {
    name: product?.name ?? '',
    photos: [...(product?.photos ?? [])],
    newPhotoPath: '',
    photoFiles: [],
    calories:
      product?.calories === undefined || product.calories === null ? '' : String(product.calories),
    proteins:
      product?.proteins === undefined || product.proteins === null ? '' : String(product.proteins),
    fats: product?.fats === undefined || product.fats === null ? '' : String(product.fats),
    carbs: product?.carbs === undefined || product.carbs === null ? '' : String(product.carbs),
    composition: product?.composition ?? '',
    category: product?.category ? String(product.category) : '',
    cookingType: product?.cookingType ? String(product.cookingType) : '',
    flags: (product?.flags ?? []).map((flag) => Number(flag)),
  }
}

export function ProductForm({
  initialProduct,
  backendBaseUrl,
  pending,
  problem,
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const [state, setState] = useState<ProductFormState>(() => buildInitialState(initialProduct))
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({})
  const photoFilesRef = useRef<PendingPhotoFile[]>(state.photoFiles)

  useEffect(() => {
    photoFilesRef.current = state.photoFiles
  }, [state.photoFiles])

  useEffect(() => {
    return () => {
      photoFilesRef.current.forEach((photoFile) => {
        URL.revokeObjectURL(photoFile.previewUrl)
      })
    }
  }, [])

  const serverErrors = getValidationErrors(problem)

  function fieldErrors(fieldName: string) {
    return [...(localErrors[fieldName] ?? []), ...getFieldErrors(serverErrors, fieldName)]
  }

  function setPhotoErrors(messages: string[]) {
    setLocalErrors((current) => ({
      ...current,
      photos: messages,
    }))
  }

  function clearPhotoErrors() {
    setLocalErrors((current) => {
      if (!current.photos) {
        return current
      }

      const next = { ...current }
      delete next.photos
      return next
    })
  }

  function handleAddPhotoPath() {
    const nextPath = state.newPhotoPath.trim()
    if (!nextPath) {
      setPhotoErrors(['Укажите путь или URL изображения.'])
      return
    }

    if (state.photos.length + state.photoFiles.length >= MAX_PHOTOS) {
      setPhotoErrors([`Нельзя добавить больше ${MAX_PHOTOS} изображений.`])
      return
    }

    if (state.photos.some((photo) => photo.toLowerCase() === nextPath.toLowerCase())) {
      setPhotoErrors(['Такой путь уже добавлен.'])
      return
    }

    clearPhotoErrors()
    setState({
      ...state,
      photos: [...state.photos, nextPath],
      newPhotoPath: '',
    })
  }

  function handleAddPhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const remainingSlots = MAX_PHOTOS - state.photos.length - state.photoFiles.length
    if (remainingSlots <= 0) {
      setPhotoErrors([`Нельзя добавить больше ${MAX_PHOTOS} изображений.`])
      return
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    if (selectedFiles.length < files.length) {
      setPhotoErrors([`Можно выбрать только ${remainingSlots} файл(ов) из-за лимита ${MAX_PHOTOS}.`])
    } else {
      clearPhotoErrors()
    }

    setState({
      ...state,
      photoFiles: [...state.photoFiles, ...selectedFiles],
    })
  }

  function handleRemovePhotoPath(index: number) {
    clearPhotoErrors()
    setState({
      ...state,
      photos: state.photos.filter((_, photoIndex) => photoIndex !== index),
    })
  }

  function handleRemovePhotoFile(id: string) {
    const removedFile = state.photoFiles.find((photoFile) => photoFile.id === id)
    if (removedFile) {
      URL.revokeObjectURL(removedFile.previewUrl)
    }

    clearPhotoErrors()
    setState({
      ...state,
      photoFiles: state.photoFiles.filter((photoFile) => photoFile.id !== id),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: Record<string, string[]> = {}
    const calories = parseRequiredNumber(state.calories, 'Калории')
    const proteins = parseRequiredNumber(state.proteins, 'Белки')
    const fats = parseRequiredNumber(state.fats, 'Жиры')
    const carbs = parseRequiredNumber(state.carbs, 'Углеводы')

    if (calories.error) {
      errors.calories = [calories.error]
    }

    if (proteins.error) {
      errors.proteins = [proteins.error]
    }

    if (fats.error) {
      errors.fats = [fats.error]
    }

    if (carbs.error) {
      errors.carbs = [carbs.error]
    }

    if (state.photos.length + state.photoFiles.length > MAX_PHOTOS) {
      errors.photos = [`Нельзя сохранить больше ${MAX_PHOTOS} изображений.`]
    }

    Object.assign(
      errors,
      validateMacroValues({
        proteins: proteins.value,
        fats: fats.value,
        carbs: carbs.value,
      }),
    )

    const category = parseNumericSelection<ProductCategory>(state.category)
    if (!category) {
      errors.category = ['Выберите категорию.']
    }

    const cookingType = parseNumericSelection<CookingType>(state.cookingType)
    if (!cookingType) {
      errors.cookingType = ['Выберите тип приготовления.']
    }

    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors)
      return
    }

    setLocalErrors({})

    await onSubmit({
      name: cleanNullableText(state.name),
      photos: state.photos,
      photoFiles: state.photoFiles.map((photoFile) => photoFile.file),
      calories: calories.value ?? undefined,
      proteins: proteins.value ?? undefined,
      fats: fats.value ?? undefined,
      carbs: carbs.value ?? undefined,
      composition: cleanNullableText(state.composition),
      category,
      cookingType,
      flags: state.flags.map((flag) => flag as DietaryFlag),
    })
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="product-name">Название</label>
          <input
            id="product-name"
            value={state.name}
            onChange={(event) => setState({ ...state, name: event.target.value })}
            placeholder="Название продукта"
          />
          <FieldErrors errors={fieldErrors('name')} />
        </div>

        <div className="form-field">
          <label htmlFor="product-composition">Состав</label>
          <textarea
            id="product-composition"
            rows={3}
            value={state.composition}
            onChange={(event) => setState({ ...state, composition: event.target.value })}
            placeholder="Состав продукта"
          />
          <FieldErrors errors={fieldErrors('composition')} />
        </div>

        <PhotoManager
          photos={state.photos}
          newPhotoPath={state.newPhotoPath}
          photoFiles={state.photoFiles}
          backendBaseUrl={backendBaseUrl}
          maxPhotos={MAX_PHOTOS}
          onNewPhotoPathChange={(newPhotoPath) => setState({ ...state, newPhotoPath })}
          onAddPhotoPath={handleAddPhotoPath}
          onRemovePhotoPath={handleRemovePhotoPath}
          onAddPhotoFiles={handleAddPhotoFiles}
          onRemovePhotoFile={handleRemovePhotoFile}
        />
        <FieldErrors errors={fieldErrors('photos')} />

        <div className="form-field">
          <label htmlFor="product-category">Категория</label>
          <select
            id="product-category"
            value={state.category}
            onChange={(event) => setState({ ...state, category: event.target.value })}
          >
            <option value="">Выберите значение</option>
            {productCategoryValues.map((value) => (
              <option key={value} value={value}>
                {productCategoryLabels[value]}
              </option>
            ))}
          </select>
          <FieldErrors errors={fieldErrors('category')} />
        </div>

        <div className="form-field">
          <label htmlFor="product-cookingType">Тип приготовления</label>
          <select
            id="product-cookingType"
            value={state.cookingType}
            onChange={(event) => setState({ ...state, cookingType: event.target.value })}
          >
            <option value="">Выберите значение</option>
            {cookingTypeValues.map((value) => (
              <option key={value} value={value}>
                {cookingTypeLabels[value]}
              </option>
            ))}
          </select>
          <FieldErrors errors={fieldErrors('cookingType')} />
        </div>
      </div>

      <div className="nutrition-block">
        <div className="nutrition-grid">
          <div className="form-field">
            <label htmlFor="product-calories">Калории</label>
            <input
              id="product-calories"
              inputMode="decimal"
              value={state.calories}
              onChange={(event) => setState({ ...state, calories: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('calories')} />
          </div>

          <div className="form-field">
            <label htmlFor="product-proteins">Белки</label>
            <input
              id="product-proteins"
              inputMode="decimal"
              value={state.proteins}
              onChange={(event) => setState({ ...state, proteins: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('proteins')} />
          </div>

          <div className="form-field">
            <label htmlFor="product-fats">Жиры</label>
            <input
              id="product-fats"
              inputMode="decimal"
              value={state.fats}
              onChange={(event) => setState({ ...state, fats: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('fats')} />
          </div>

          <div className="form-field">
            <label htmlFor="product-carbs">Углеводы</label>
            <input
              id="product-carbs"
              inputMode="decimal"
              value={state.carbs}
              onChange={(event) => setState({ ...state, carbs: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('carbs')} />
          </div>
        </div>
        <FieldErrors errors={fieldErrors('macros')} />
      </div>

      <fieldset className="checkbox-group">
        <legend>Флаги</legend>
        <div className="checkbox-list">
          {dietaryFlagValues.map((flag) => (
            <label key={flag} className="checkbox-chip">
              <input
                type="checkbox"
                checked={state.flags.includes(flag)}
                onChange={(event) =>
                  setState({
                    ...state,
                    flags: toggleNumericValue(state.flags, flag, event.target.checked),
                  })
                }
              />
              <span>{dietaryFlagLabels[flag]}</span>
            </label>
          ))}
        </div>
        <FieldErrors errors={fieldErrors('flags')} />
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? 'Сохраняем...' : initialProduct ? 'Сохранить изменения' : 'Создать продукт'}
        </button>
        <button type="button" className="button button-secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
