import { useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  CreateDishRequest,
  DietaryFlag,
  DishCategory,
  DishProductRequest,
  DishResponse,
  ProblemDetails,
  ProductResponse,
  UpdateDishRequest,
} from '../types/api'
import { dietaryFlagValues, dishCategoryValues } from '../types/api'
import {
  cleanNullableText,
  parseNumericSelection,
  parseOptionalNumber,
  parseRequiredNumber,
  toggleNumericValue,
} from '../utils/forms'
import { dietaryFlagLabels, dishCategoryLabels } from '../utils/enumLabels'
import { validateDishMacroValues } from '../utils/nutrition'
import { MAX_PHOTOS } from '../utils/photos'
import { getFieldErrors, getValidationErrors } from '../utils/problemDetails'
import { FieldErrors } from './FieldErrors'
import { PhotoManager, type PendingPhotoFile } from './PhotoManager'

interface DishFormProps {
  initialDish?: DishResponse | null
  backendBaseUrl: string
  productOptions: ProductResponse[]
  pending: boolean
  problem?: ProblemDetails | null
  onCancel: () => void
  onSubmit: (payload: CreateDishRequest | UpdateDishRequest) => Promise<void>
}

interface DishProductFormRow {
  productId: string
  amount: string
}

interface DishFormState {
  name: string
  photos: string[]
  newPhotoPath: string
  photoFiles: PendingPhotoFile[]
  calories: string
  proteins: string
  fats: string
  carbs: string
  portionSize: string
  category: string
  flags: number[]
  products: DishProductFormRow[]
}

interface DishAutoNutrition {
  calories: string
  proteins: string
  fats: string
  carbs: string
}

function getAvailableFlagsForSelectedProducts(
  products: DishProductFormRow[],
  productOptions: ProductResponse[],
): number[] | null {
  const selectedProducts = products
    .map((row) => row.productId.trim())
    .filter(Boolean)
    .map((productId) => productOptions.find((product) => product.id === productId))
    .filter((product): product is ProductResponse => Boolean(product))

  if (selectedProducts.length === 0) {
    return null
  }

  const intersection = new Set((selectedProducts[0].flags ?? []).map((flag) => Number(flag)))

  selectedProducts.slice(1).forEach((product) => {
    const productFlags = new Set((product.flags ?? []).map((flag) => Number(flag)))

    Array.from(intersection).forEach((flag) => {
      if (!productFlags.has(flag)) {
        intersection.delete(flag)
      }
    })
  })

  return Array.from(intersection)
}

function roundNutritionValue(value: number) {
  return Math.round(value * 100) / 100
}

function formatNutritionInput(value: number) {
  return String(roundNutritionValue(value))
}

function getAutoNutritionFromProducts(
  products: DishProductFormRow[],
  productOptions: ProductResponse[],
): DishAutoNutrition | null {
  let calories = 0
  let proteins = 0
  let fats = 0
  let carbs = 0
  let hasValidProduct = false

  products.forEach((row) => {
    const productId = row.productId.trim()
    const amount = Number(row.amount.trim().replace(',', '.'))
    const product = productOptions.find((item) => item.id === productId)

    if (!product || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    const factor = amount / 100
    calories += (product.calories ?? 0) * factor
    proteins += (product.proteins ?? 0) * factor
    fats += (product.fats ?? 0) * factor
    carbs += (product.carbs ?? 0) * factor
    hasValidProduct = true
  })

  if (!hasValidProduct) {
    return null
  }

  return {
    calories: formatNutritionInput(calories),
    proteins: formatNutritionInput(proteins),
    fats: formatNutritionInput(fats),
    carbs: formatNutritionInput(carbs),
  }
}

function buildInitialState(dish?: DishResponse | null): DishFormState {
  return {
    name: dish?.name ?? '',
    photos: [...(dish?.photos ?? [])],
    newPhotoPath: '',
    photoFiles: [],
    calories: dish?.calories === undefined || dish.calories === null ? '' : String(dish.calories),
    proteins: dish?.proteins === undefined || dish.proteins === null ? '' : String(dish.proteins),
    fats: dish?.fats === undefined || dish.fats === null ? '' : String(dish.fats),
    carbs: dish?.carbs === undefined || dish.carbs === null ? '' : String(dish.carbs),
    portionSize:
      dish?.portionSize === undefined || dish.portionSize === null
        ? ''
        : String(dish.portionSize),
    category: dish?.category ? String(dish.category) : '',
    flags: (dish?.flags ?? []).map((flag) => Number(flag)),
    products: (dish?.products ?? []).map((product) => ({
      productId: product.productId ?? '',
      amount: product.amount === undefined || product.amount === null ? '' : String(product.amount),
    })),
  }
}

export function DishForm({
  initialDish,
  backendBaseUrl,
  productOptions,
  pending,
  problem,
  onCancel,
  onSubmit,
}: DishFormProps) {
  const [state, setState] = useState<DishFormState>(() => buildInitialState(initialDish))
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({})
  const photoFilesRef = useRef<PendingPhotoFile[]>(state.photoFiles)
  const selectedProductAvailableFlags = getAvailableFlagsForSelectedProducts(
    state.products,
    productOptions,
  )
  const availableFlagsList =
    selectedProductAvailableFlags ??
    (initialDish ? (initialDish.availableFlags ?? []).map((flag) => Number(flag)) : null)
  const availableFlags = availableFlagsList ? new Set(availableFlagsList) : null
  const shouldRestrictFlags = availableFlags !== null

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

  function applyDerivedDishValues(nextState: DishFormState): DishFormState {
    const autoNutrition = getAutoNutritionFromProducts(nextState.products, productOptions)
    const stateWithNutrition = {
      ...nextState,
      calories: autoNutrition?.calories ?? '',
      proteins: autoNutrition?.proteins ?? '',
      fats: autoNutrition?.fats ?? '',
      carbs: autoNutrition?.carbs ?? '',
    }

    const nextAvailableFlags =
      getAvailableFlagsForSelectedProducts(stateWithNutrition.products, productOptions) ??
      (initialDish ? (initialDish.availableFlags ?? []).map((flag) => Number(flag)) : null)

    if (!nextAvailableFlags) {
      return stateWithNutrition
    }

    const nextFlags = stateWithNutrition.flags.filter((flag) => nextAvailableFlags.includes(flag))
    return nextFlags.length === stateWithNutrition.flags.length
      ? stateWithNutrition
      : { ...stateWithNutrition, flags: nextFlags }
  }

  function updateProductRow(index: number, patch: Partial<DishProductFormRow>) {
    setState(
      applyDerivedDishValues({
        ...state,
        products: state.products.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row,
        ),
      }),
    )
  }

  function appendProductRow() {
    setState(
      applyDerivedDishValues({
        ...state,
        products: [...state.products, { productId: '', amount: '' }],
      }),
    )
  }

  function removeProductRow(index: number) {
    setState(
      applyDerivedDishValues({
        ...state,
        products: state.products.filter((_, rowIndex) => rowIndex !== index),
      }),
    )
  }

  function isFlagDisabled(flag: number) {
    return shouldRestrictFlags && !availableFlags?.has(flag)
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
    const calories = parseOptionalNumber(state.calories, 'Калории')
    const proteins = parseOptionalNumber(state.proteins, 'Белки')
    const fats = parseOptionalNumber(state.fats, 'Жиры')
    const carbs = parseOptionalNumber(state.carbs, 'Углеводы')
    const portionSize = parseRequiredNumber(state.portionSize, 'Размер порции')

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

    if (portionSize.error) {
      errors.portionSize = [portionSize.error]
    }

    if (state.photos.length + state.photoFiles.length > MAX_PHOTOS) {
      errors.photos = [`Нельзя сохранить больше ${MAX_PHOTOS} изображений.`]
    }

    Object.assign(
      errors,
      validateDishMacroValues(
        {
          proteins: proteins.value,
          fats: fats.value,
          carbs: carbs.value,
        },
        portionSize.value,
      ),
    )

    const category = parseNumericSelection<DishCategory>(state.category)
    const products: DishProductRequest[] = []

    state.products.forEach((row, index) => {
      const productId = row.productId.trim()
      const amount = parseRequiredNumber(row.amount, `Количество ингредиента #${index + 1}`)

      if (!productId) {
        errors.products = [...(errors.products ?? []), `Ингредиент #${index + 1}: выберите продукт.`]
      }

      if (amount.error) {
        errors.products = [...(errors.products ?? []), amount.error]
      }

      if (productId && amount.value !== null) {
        products.push({
          productId,
          amount: amount.value,
        })
      }
    })

    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors)
      return
    }

    setLocalErrors({})

    const allowedFlags = shouldRestrictFlags
      ? state.flags.filter((flag) => availableFlags?.has(flag))
      : state.flags

    await onSubmit({
      name: cleanNullableText(state.name),
      photos: state.photos,
      photoFiles: state.photoFiles.map((photoFile) => photoFile.file),
      calories: calories.value,
      proteins: proteins.value,
      fats: fats.value,
      carbs: carbs.value,
      portionSize: portionSize.value ?? undefined,
      category,
      flags: allowedFlags.map((flag) => flag as DietaryFlag),
      products,
    })
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="dish-name">Название</label>
          <input
            id="dish-name"
            value={state.name}
            onChange={(event) => setState({ ...state, name: event.target.value })}
            placeholder="Название блюда"
          />
          <FieldErrors errors={fieldErrors('name')} />
        </div>

        <div className="form-field">
          <label htmlFor="dish-portionSize">Размер порции</label>
          <input
            id="dish-portionSize"
            inputMode="decimal"
            value={state.portionSize}
            onChange={(event) => setState({ ...state, portionSize: event.target.value })}
            placeholder="Размер порции"
          />
          <FieldErrors errors={fieldErrors('portionSize')} />
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
          <label htmlFor="dish-category">Категория</label>
          <select
            id="dish-category"
            value={state.category}
            onChange={(event) => setState({ ...state, category: event.target.value })}
          >
            <option value="">Оставить пустым</option>
            {dishCategoryValues.map((value) => (
              <option key={value} value={value}>
                {dishCategoryLabels[value]}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Категорию можно не выбирать: сервер сможет определить её по макросу в названии блюда.
          </p>
          <FieldErrors errors={fieldErrors('category')} />
        </div>
      </div>

      <div className="nutrition-block">
        <div className="nutrition-grid">
          <div className="form-field">
            <label htmlFor="dish-calories">Калории</label>
            <input
              id="dish-calories"
              inputMode="decimal"
              value={state.calories}
              onChange={(event) => setState({ ...state, calories: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('calories')} />
          </div>

          <div className="form-field">
            <label htmlFor="dish-proteins">Белки</label>
            <input
              id="dish-proteins"
              inputMode="decimal"
              value={state.proteins}
              onChange={(event) => setState({ ...state, proteins: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('proteins')} />
          </div>

          <div className="form-field">
            <label htmlFor="dish-fats">Жиры</label>
            <input
              id="dish-fats"
              inputMode="decimal"
              value={state.fats}
              onChange={(event) => setState({ ...state, fats: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('fats')} />
          </div>

          <div className="form-field">
            <label htmlFor="dish-carbs">Углеводы</label>
            <input
              id="dish-carbs"
              inputMode="decimal"
              value={state.carbs}
              onChange={(event) => setState({ ...state, carbs: event.target.value })}
            />
            <FieldErrors errors={fieldErrors('carbs')} />
          </div>
        </div>
        <p className="field-hint">
          КБЖУ подставляется автоматически по выбранным продуктам. При необходимости значения
          можно скорректировать вручную перед сохранением.
        </p>
        <p className="field-hint">
          КБЖУ указывается на порцию, но ограничение суммы БЖУ проверяется по 100 г блюда с
          учетом размера порции.
        </p>
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
                disabled={isFlagDisabled(flag)}
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
        {shouldRestrictFlags ? (
          <p className="field-hint">
            Доступные флаги пересчитываются по выбранным продуктам, поэтому несовместимые значения
            блокируются автоматически.
          </p>
        ) : null}
        <FieldErrors errors={fieldErrors('flags')} />
      </fieldset>

      <fieldset className="ingredients-block">
        <legend>Продукты</legend>
        <div className="ingredient-rows">
          {state.products.map((row, index) => (
            <div key={`${row.productId}-${index}`} className="ingredient-row">
              <select
                value={row.productId}
                onChange={(event) => updateProductRow(index, { productId: event.target.value })}
              >
                <option value="">Выберите продукт</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name ?? 'Без названия'}
                  </option>
                ))}
              </select>
              <input
                inputMode="decimal"
                value={row.amount}
                onChange={(event) => updateProductRow(index, { amount: event.target.value })}
                placeholder="Количество"
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={() => removeProductRow(index)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
        <div className="subtle-actions">
          <button type="button" className="button button-secondary" onClick={appendProductRow}>
            Добавить продукт
          </button>
        </div>
        <FieldErrors errors={fieldErrors('products')} />
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? 'Сохраняем...' : initialDish ? 'Сохранить изменения' : 'Создать блюдо'}
        </button>
        <button type="button" className="button button-secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  )
}
