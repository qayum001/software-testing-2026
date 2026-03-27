import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { dishesApi } from '../api/dishes'
import { productsApi } from '../api/products'
import { DishForm } from '../components/DishForm'
import { ImagePreview } from '../components/ImagePreview'
import { ProblemBanner } from '../components/ProblemBanner'
import type {
  CreateDishRequest,
  DishListQuery,
  DishResponse,
  ProblemDetails,
  ProductResponse,
  UpdateDishRequest,
} from '../types/api'
import { dishCategoryValues, flagFilterOptionValues } from '../types/api'
import { formatDateTime, formatNumber } from '../utils/format'
import {
  dietaryFlagLabels,
  dishCategoryLabels,
  flagFilterOptionLabels,
  getEnumLabel,
  getEnumListLabel,
} from '../utils/enumLabels'
import { parseNumericSelection } from '../utils/forms'
import { toFallbackProblem } from '../utils/problemDetails'

type DishScreenMode = 'details' | 'create' | 'edit'

interface DishesPageProps {
  backendBaseUrl: string
}

interface DishFilterState {
  category: string
  vegan: string
  glutenFree: string
  sugarFree: string
  search: string
}

const initialFilters: DishFilterState = {
  category: '',
  vegan: '',
  glutenFree: '',
  sugarFree: '',
  search: '',
}

function toDishQuery(state: DishFilterState): DishListQuery {
  return {
    Category: parseNumericSelection(state.category),
    Vegan: parseNumericSelection(state.vegan),
    GlutenFree: parseNumericSelection(state.glutenFree),
    SugarFree: parseNumericSelection(state.sugarFree),
    Search: state.search.trim() || undefined,
  }
}

export function DishesPage({ backendBaseUrl }: DishesPageProps) {
  const [filters, setFilters] = useState<DishFilterState>(initialFilters)
  const [activeQuery, setActiveQuery] = useState<DishListQuery>({})
  const [dishes, setDishes] = useState<DishResponse[]>([])
  const [productOptions, setProductOptions] = useState<ProductResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDish, setSelectedDish] = useState<DishResponse | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitPending, setSubmitPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [listProblem, setListProblem] = useState<ProblemDetails | null>(null)
  const [detailProblem, setDetailProblem] = useState<ProblemDetails | null>(null)
  const [submitProblem, setSubmitProblem] = useState<ProblemDetails | null>(null)
  const [productsProblem, setProductsProblem] = useState<ProblemDetails | null>(null)
  const [deleteProblem, setDeleteProblem] = useState<ProblemDetails | null>(null)
  const [mode, setMode] = useState<DishScreenMode>('details')

  async function loadDishes(query: DishListQuery) {
    setListLoading(true)
    setListProblem(null)

    try {
      const response = await dishesApi.list(query)
      setDishes(response)
    } catch (error) {
      if (error instanceof ApiError) {
        setListProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    } finally {
      setListLoading(false)
    }
  }

  async function loadDishDetails(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    setDetailProblem(null)
    setSubmitProblem(null)
    setDeleteProblem(null)

    try {
      const response = await dishesApi.get(id)
      setSelectedDish(response)
    } catch (error) {
      setSelectedDish(null)

      if (error instanceof ApiError) {
        setDetailProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    } finally {
      setDetailLoading(false)
    }
  }

  async function loadProductOptions() {
    setProductsProblem(null)

    try {
      const response = await productsApi.list()
      setProductOptions(response)
    } catch (error) {
      if (error instanceof ApiError) {
        setProductsProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    }
  }

  useEffect(() => {
    void loadDishes(activeQuery)
  }, [activeQuery])

  useEffect(() => {
    void loadProductOptions()
  }, [])

  async function handleSave(payload: CreateDishRequest | UpdateDishRequest) {
    setSubmitPending(true)
    setSubmitProblem(null)

    try {
      const saved =
        mode === 'edit' && selectedId
          ? await dishesApi.update(selectedId, payload)
          : await dishesApi.create(payload)

      setMode('details')
      await loadDishes(activeQuery)

      if (saved.id) {
        await loadDishDetails(saved.id)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    } finally {
      setSubmitPending(false)
    }
  }

  async function handleDelete() {
    if (!selectedId || !selectedDish) {
      return
    }

    const accepted = window.confirm(`Удалить блюдо "${selectedDish.name ?? selectedDish.id}"?`)

    if (!accepted) {
      return
    }

    setDeletePending(true)
    setDeleteProblem(null)

    try {
      await dishesApi.remove(selectedId)
      setSelectedId(null)
      setSelectedDish(null)
      setMode('details')
      await loadDishes(activeQuery)
    } catch (error) {
      if (error instanceof ApiError) {
        setDeleteProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    } finally {
      setDeletePending(false)
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActiveQuery(toDishQuery(filters))
  }

  function resetFilters() {
    setFilters(initialFilters)
    setActiveQuery({})
  }

  function beginCreate() {
    setMode('create')
    setSelectedId(null)
    setSelectedDish(null)
    setDetailProblem(null)
    setSubmitProblem(null)
    setDeleteProblem(null)
  }

  function beginEdit() {
    if (!selectedDish) {
      return
    }

    setMode('edit')
    setSubmitProblem(null)
  }

  function restoreDetails() {
    setMode('details')
    setSubmitProblem(null)
  }

  return (
    <section className="screen-layout">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Блюда</p>
            <h2>Список блюд</h2>
          </div>
          <button type="button" className="button button-primary" onClick={beginCreate}>
            Создать блюдо
          </button>
        </div>

        <form className="filters-grid filters-grid--dishes" onSubmit={applyFilters}>
          <div className="form-field">
            <label htmlFor="dish-filter-search">Поиск</label>
            <input
              id="dish-filter-search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Название блюда"
            />
          </div>

          <div className="form-field">
            <label htmlFor="dish-filter-category">Категория</label>
            <select
              id="dish-filter-category"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            >
              <option value="">Все</option>
              {dishCategoryValues.map((value) => (
                <option key={value} value={value}>
                  {dishCategoryLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="dish-filter-vegan">Веганское</label>
            <select
              id="dish-filter-vegan"
              value={filters.vegan}
              onChange={(event) => setFilters({ ...filters, vegan: event.target.value })}
            >
              <option value="">Все</option>
              {flagFilterOptionValues.map((value) => (
                <option key={value} value={value}>
                  {flagFilterOptionLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="dish-filter-glutenFree">Без глютена</label>
            <select
              id="dish-filter-glutenFree"
              value={filters.glutenFree}
              onChange={(event) => setFilters({ ...filters, glutenFree: event.target.value })}
            >
              <option value="">Все</option>
              {flagFilterOptionValues.map((value) => (
                <option key={value} value={value}>
                  {flagFilterOptionLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="dish-filter-sugarFree">Без сахара</label>
            <select
              id="dish-filter-sugarFree"
              value={filters.sugarFree}
              onChange={(event) => setFilters({ ...filters, sugarFree: event.target.value })}
            >
              <option value="">Все</option>
              {flagFilterOptionValues.map((value) => (
                <option key={value} value={value}>
                  {flagFilterOptionLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button type="submit" className="button button-primary">
              Применить
            </button>
            <button type="button" className="button button-secondary" onClick={resetFilters}>
              Сбросить
            </button>
          </div>
        </form>

        <ProblemBanner problem={listProblem} />

        <div className="list-panel">
          {listLoading ? <div className="empty-state">Загружаем список...</div> : null}

          {!listLoading && dishes.length === 0 ? (
            <div className="empty-state">
              Блюда не найдены. Измените фильтры или создайте новый элемент.
            </div>
          ) : null}

          <div className="entity-list">
            {dishes.map((dish) => (
              <button
                key={dish.id}
                type="button"
                className={dish.id === selectedId ? 'entity-card is-active' : 'entity-card'}
                onClick={() => {
                  setMode('details')
                  if (dish.id) {
                    void loadDishDetails(dish.id)
                  }
                }}
              >
                <ImagePreview
                  path={dish.photos?.[0] ?? ''}
                  alt={dish.name ?? 'Фотография блюда'}
                  backendBaseUrl={backendBaseUrl}
                  compact
                />
                <div className="entity-card__body">
                  <strong>{dish.name ?? 'Без названия'}</strong>
                  <span>{getEnumLabel(dish.category, dishCategoryLabels)}</span>
                  <span>
                    Порция {formatNumber(dish.portionSize)} • Продуктов {(dish.products ?? []).length}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel panel-detail">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Детали</p>
            <h2>
              {mode === 'create'
                ? 'Новое блюдо'
                : mode === 'edit'
                  ? 'Редактирование блюда'
                  : 'Карточка блюда'}
            </h2>
          </div>
          {mode !== 'details' ? (
            <button type="button" className="button button-secondary" onClick={restoreDetails}>
              Закрыть форму
            </button>
          ) : null}
        </div>

        {mode === 'create' || mode === 'edit' ? (
          <>
            <ProblemBanner problem={productsProblem} />
            <ProblemBanner problem={submitProblem} />
            <DishForm
              key={mode === 'edit' ? selectedDish?.id ?? 'edit-dish' : 'create-dish'}
              initialDish={mode === 'edit' ? selectedDish : null}
              backendBaseUrl={backendBaseUrl}
              productOptions={productOptions}
              pending={submitPending}
              problem={submitProblem}
              onCancel={restoreDetails}
              onSubmit={handleSave}
            />
          </>
        ) : detailLoading ? (
          <div className="empty-state">Загружаем детали блюда...</div>
        ) : detailProblem ? (
          <ProblemBanner problem={detailProblem} />
        ) : selectedDish ? (
          <div className="detail-stack">
            <div className="detail-actions">
              <button type="button" className="button button-primary" onClick={beginEdit}>
                Редактировать
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => void handleDelete()}
                disabled={deletePending}
              >
                {deletePending ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>

            <ProblemBanner problem={deleteProblem} />

            <div className="detail-card">
              <div className="detail-headline">
                <div>
                  <h3>{selectedDish.name ?? 'Без названия'}</h3>
                </div>
                <div className="chips">
                  <span className="chip">{getEnumLabel(selectedDish.category, dishCategoryLabels)}</span>
                  <span className="chip">Порция {formatNumber(selectedDish.portionSize)}</span>
                </div>
              </div>

              <div className="photo-grid photo-grid--detail">
                {(selectedDish.photos ?? []).length > 0 ? (
                  (selectedDish.photos ?? []).map((photoPath, index) => (
                    <ImagePreview
                      key={`${photoPath}-${index}`}
                      path={photoPath}
                      alt={`${selectedDish.name ?? 'Блюдо'} ${index + 1}`}
                      backendBaseUrl={backendBaseUrl}
                    />
                  ))
                ) : (
                  <div className="empty-state empty-state--inline">
                    Для блюда не указаны фотографии.
                  </div>
                )}
              </div>

              <dl className="detail-grid">
                <div>
                  <dt>Калории</dt>
                  <dd>{formatNumber(selectedDish.calories)}</dd>
                </div>
                <div>
                  <dt>Белки</dt>
                  <dd>{formatNumber(selectedDish.proteins)}</dd>
                </div>
                <div>
                  <dt>Жиры</dt>
                  <dd>{formatNumber(selectedDish.fats)}</dd>
                </div>
                <div>
                  <dt>Углеводы</dt>
                  <dd>{formatNumber(selectedDish.carbs)}</dd>
                </div>
                <div>
                  <dt>Авторасчёт КБЖУ</dt>
                  <dd>
                    {selectedDish.autoCalculatedNutrition
                      ? `${formatNumber(selectedDish.autoCalculatedNutrition.calories)} / ${formatNumber(selectedDish.autoCalculatedNutrition.proteins)} / ${formatNumber(selectedDish.autoCalculatedNutrition.fats)} / ${formatNumber(selectedDish.autoCalculatedNutrition.carbs)}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Флаги</dt>
                  <dd>{getEnumListLabel(selectedDish.flags, dietaryFlagLabels)}</dd>
                </div>
                <div>
                  <dt>Доступные флаги</dt>
                  <dd>{getEnumListLabel(selectedDish.availableFlags, dietaryFlagLabels)}</dd>
                </div>
                <div>
                  <dt>Создано</dt>
                  <dd>{formatDateTime(selectedDish.createdAt)}</dd>
                </div>
                <div>
                  <dt>Обновлено</dt>
                  <dd>{formatDateTime(selectedDish.updatedAt)}</dd>
                </div>
              </dl>

              <div className="related-list">
                <h4>Продукты</h4>
                {(selectedDish.products ?? []).length > 0 ? (
                  <ul>
                    {(selectedDish.products ?? []).map((product, index) => (
                      <li key={`${product.productId}-${index}`}>
                        <strong>{product.productName ?? product.productId}</strong>
                        <span>{formatNumber(product.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state empty-state--inline">
                    Для блюда не указаны продукты.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Выберите блюдо слева, чтобы загрузить его детали.
          </div>
        )}
      </div>
    </section>
  )
}
