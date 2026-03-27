import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { productsApi } from '../api/products'
import { ImagePreview } from '../components/ImagePreview'
import { ProblemBanner } from '../components/ProblemBanner'
import { ProductForm } from '../components/ProductForm'
import type {
  CreateProductRequest,
  ProblemDetails,
  ProductListQuery,
  ProductResponse,
  ProductSortField,
  SortDirection,
  UpdateProductRequest,
} from '../types/api'
import {
  cookingTypeValues,
  flagFilterOptionValues,
  productCategoryValues,
  productSortFieldValues,
  sortDirectionValues,
} from '../types/api'
import { formatDateTime, formatNumber } from '../utils/format'
import {
  cookingTypeLabels,
  dietaryFlagLabels,
  flagFilterOptionLabels,
  getEnumLabel,
  getEnumListLabel,
  productCategoryLabels,
  productSortFieldLabels,
  sortDirectionLabels,
} from '../utils/enumLabels'
import { parseNumericSelection } from '../utils/forms'
import { extractRelatedDishNames, toFallbackProblem } from '../utils/problemDetails'

type ProductScreenMode = 'details' | 'create' | 'edit'

interface ProductsPageProps {
  backendBaseUrl: string
}

interface ProductFilterState {
  category: string
  cookingType: string
  vegan: string
  glutenFree: string
  sugarFree: string
  search: string
  sortBy: string
  sortDirection: string
}

const initialFilters: ProductFilterState = {
  category: '',
  cookingType: '',
  vegan: '',
  glutenFree: '',
  sugarFree: '',
  search: '',
  sortBy: '',
  sortDirection: '',
}

function toProductQuery(state: ProductFilterState): ProductListQuery {
  return {
    Category: parseNumericSelection(state.category),
    CookingType: parseNumericSelection(state.cookingType),
    Vegan: parseNumericSelection(state.vegan),
    GlutenFree: parseNumericSelection(state.glutenFree),
    SugarFree: parseNumericSelection(state.sugarFree),
    Search: state.search.trim() || undefined,
    SortBy: parseNumericSelection<ProductSortField>(state.sortBy),
    SortDirection: parseNumericSelection<SortDirection>(state.sortDirection),
  }
}

export function ProductsPage({ backendBaseUrl }: ProductsPageProps) {
  const [filters, setFilters] = useState<ProductFilterState>(initialFilters)
  const [activeQuery, setActiveQuery] = useState<ProductListQuery>({})
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductResponse | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitPending, setSubmitPending] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [listProblem, setListProblem] = useState<ProblemDetails | null>(null)
  const [detailProblem, setDetailProblem] = useState<ProblemDetails | null>(null)
  const [submitProblem, setSubmitProblem] = useState<ProblemDetails | null>(null)
  const [deleteProblem, setDeleteProblem] = useState<ProblemDetails | null>(null)
  const [mode, setMode] = useState<ProductScreenMode>('details')

  async function loadProducts(query: ProductListQuery) {
    setListLoading(true)
    setListProblem(null)

    try {
      const response = await productsApi.list(query)
      setProducts(response)
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

  async function loadProductDetails(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    setDetailProblem(null)
    setDeleteProblem(null)
    setSubmitProblem(null)

    try {
      const response = await productsApi.get(id)
      setSelectedProduct(response)
    } catch (error) {
      setSelectedProduct(null)

      if (error instanceof ApiError) {
        setDetailProblem(error.problem ?? toFallbackProblem(error.status, error.message))
        return
      }

      throw error
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts(activeQuery)
  }, [activeQuery])

  async function handleSave(payload: CreateProductRequest | UpdateProductRequest) {
    setSubmitPending(true)
    setSubmitProblem(null)

    try {
      const saved =
        mode === 'edit' && selectedId
          ? await productsApi.update(selectedId, payload)
          : await productsApi.create(payload)

      setMode('details')
      await loadProducts(activeQuery)

      if (saved.id) {
        await loadProductDetails(saved.id)
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
    if (!selectedId || !selectedProduct) {
      return
    }

    const accepted = window.confirm(
      `Удалить продукт "${selectedProduct.name ?? selectedProduct.id}"?`,
    )

    if (!accepted) {
      return
    }

    setDeletePending(true)
    setDeleteProblem(null)

    try {
      await productsApi.remove(selectedId)
      setSelectedId(null)
      setSelectedProduct(null)
      setMode('details')
      await loadProducts(activeQuery)
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

  function beginCreate() {
    setMode('create')
    setSelectedId(null)
    setSelectedProduct(null)
    setDetailProblem(null)
    setSubmitProblem(null)
    setDeleteProblem(null)
  }

  function beginEdit() {
    if (!selectedProduct) {
      return
    }

    setMode('edit')
    setSubmitProblem(null)
  }

  function restoreDetails() {
    setMode('details')
    setSubmitProblem(null)
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActiveQuery(toProductQuery(filters))
  }

  function resetFilters() {
    setFilters(initialFilters)
    setActiveQuery({})
  }

  const relatedDishNames = extractRelatedDishNames(deleteProblem)

  return (
    <section className="screen-layout">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Продукты</p>
            <h2>Список продуктов</h2>
          </div>
          <button type="button" className="button button-primary" onClick={beginCreate}>
            Создать продукт
          </button>
        </div>

        <form className="filters-grid" onSubmit={applyFilters}>
          <div className="form-field">
            <label htmlFor="product-filter-search">Поиск</label>
            <input
              id="product-filter-search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Название продукта"
            />
          </div>

          <div className="form-field">
            <label htmlFor="product-filter-category">Категория</label>
            <select
              id="product-filter-category"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            >
              <option value="">Все</option>
              {productCategoryValues.map((value) => (
                <option key={value} value={value}>
                  {productCategoryLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="product-filter-cookingType">Тип приготовления</label>
            <select
              id="product-filter-cookingType"
              value={filters.cookingType}
              onChange={(event) => setFilters({ ...filters, cookingType: event.target.value })}
            >
              <option value="">Все</option>
              {cookingTypeValues.map((value) => (
                <option key={value} value={value}>
                  {cookingTypeLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="product-filter-vegan">Веганское</label>
            <select
              id="product-filter-vegan"
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
            <label htmlFor="product-filter-glutenFree">Без глютена</label>
            <select
              id="product-filter-glutenFree"
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
            <label htmlFor="product-filter-sugarFree">Без сахара</label>
            <select
              id="product-filter-sugarFree"
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

          <div className="form-field">
            <label htmlFor="product-filter-sortBy">Сортировать по</label>
            <select
              id="product-filter-sortBy"
              value={filters.sortBy}
              onChange={(event) => setFilters({ ...filters, sortBy: event.target.value })}
            >
              <option value="">Без сортировки</option>
              {productSortFieldValues.map((value) => (
                <option key={value} value={value}>
                  {productSortFieldLabels[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="product-filter-sortDirection">Направление</label>
            <select
              id="product-filter-sortDirection"
              value={filters.sortDirection}
              onChange={(event) =>
                setFilters({ ...filters, sortDirection: event.target.value })
              }
            >
              <option value="">По умолчанию</option>
              {sortDirectionValues.map((value) => (
                <option key={value} value={value}>
                  {sortDirectionLabels[value]}
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

          {!listLoading && products.length === 0 ? (
            <div className="empty-state">
              Продукты не найдены. Измените фильтры или создайте новый элемент.
            </div>
          ) : null}

          <div className="entity-list">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                className={product.id === selectedId ? 'entity-card is-active' : 'entity-card'}
                onClick={() => {
                  setMode('details')
                  if (product.id) {
                    void loadProductDetails(product.id)
                  }
                }}
              >
                <ImagePreview
                  path={product.photos?.[0] ?? ''}
                  alt={product.name ?? 'Фотография продукта'}
                  backendBaseUrl={backendBaseUrl}
                  compact
                />
                <div className="entity-card__body">
                  <strong>{product.name ?? 'Без названия'}</strong>
                  <span>
                    {getEnumLabel(product.category, productCategoryLabels)} •{' '}
                    {getEnumLabel(product.cookingType, cookingTypeLabels)}
                  </span>
                  <span>
                    КБЖУ: {formatNumber(product.calories)} / {formatNumber(product.proteins)} /{' '}
                    {formatNumber(product.fats)} / {formatNumber(product.carbs)}
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
                ? 'Новый продукт'
                : mode === 'edit'
                  ? 'Редактирование продукта'
                  : 'Карточка продукта'}
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
            <ProblemBanner problem={submitProblem} />
            <ProductForm
              key={mode === 'edit' ? selectedProduct?.id ?? 'edit-product' : 'create-product'}
              initialProduct={mode === 'edit' ? selectedProduct : null}
              backendBaseUrl={backendBaseUrl}
              pending={submitPending}
              problem={submitProblem}
              onCancel={restoreDetails}
              onSubmit={handleSave}
            />
          </>
        ) : detailLoading ? (
          <div className="empty-state">Загружаем детали продукта...</div>
        ) : detailProblem ? (
          <ProblemBanner problem={detailProblem} />
        ) : selectedProduct ? (
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

            <ProblemBanner problem={deleteProblem} relatedDishNames={relatedDishNames} />

            <div className="detail-card">
              <div className="detail-headline">
                <div>
                  <h3>{selectedProduct.name ?? 'Без названия'}</h3>
                </div>
                <div className="chips">
                  <span className="chip">
                    {getEnumLabel(selectedProduct.category, productCategoryLabels)}
                  </span>
                  <span className="chip">
                    {getEnumLabel(selectedProduct.cookingType, cookingTypeLabels)}
                  </span>
                </div>
              </div>

              <div className="photo-grid photo-grid--detail">
                {(selectedProduct.photos ?? []).length > 0 ? (
                  (selectedProduct.photos ?? []).map((photoPath, index) => (
                    <ImagePreview
                      key={`${photoPath}-${index}`}
                      path={photoPath}
                      alt={`${selectedProduct.name ?? 'Продукт'} ${index + 1}`}
                      backendBaseUrl={backendBaseUrl}
                    />
                  ))
                ) : (
                  <div className="empty-state empty-state--inline">
                    Для продукта не указаны фотографии.
                  </div>
                )}
              </div>

              <dl className="detail-grid">
                <div>
                  <dt>Калории</dt>
                  <dd>{formatNumber(selectedProduct.calories)}</dd>
                </div>
                <div>
                  <dt>Белки</dt>
                  <dd>{formatNumber(selectedProduct.proteins)}</dd>
                </div>
                <div>
                  <dt>Жиры</dt>
                  <dd>{formatNumber(selectedProduct.fats)}</dd>
                </div>
                <div>
                  <dt>Углеводы</dt>
                  <dd>{formatNumber(selectedProduct.carbs)}</dd>
                </div>
                <div>
                  <dt>Состав</dt>
                  <dd>{selectedProduct.composition || '—'}</dd>
                </div>
                <div>
                  <dt>Флаги</dt>
                  <dd>{getEnumListLabel(selectedProduct.flags, dietaryFlagLabels)}</dd>
                </div>
                <div>
                  <dt>Создано</dt>
                  <dd>{formatDateTime(selectedProduct.createdAt)}</dd>
                </div>
                <div>
                  <dt>Обновлено</dt>
                  <dd>{formatDateTime(selectedProduct.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Выберите продукт слева, чтобы загрузить его детали.
          </div>
        )}
      </div>
    </section>
  )
}
