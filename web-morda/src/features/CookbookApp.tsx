
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api.http';
import { cookbookApi } from '../cookbookApi';
import type {
  CookingType,
  CreateDishRequest,
  CreateProductRequest,
  DietaryFlag,
  DishCategory,
  DishListFilters,
  DishProductRequest,
  DishResponse,
  FlagFilterOption,
  ProductCategory,
  ProductListFilters,
  ProductResponse,
  ProductSortField,
  SortDirection,
} from '../api.types';

type Tab = 'products' | 'dishes';
type Mode = 'list' | 'create' | 'edit' | 'details';

type ProductFiltersState = { category: string; cookingType: string; vegan: string; glutenFree: string; sugarFree: string; search: string; sortBy: string; sortDirection: string };
type DishFiltersState = { category: string; vegan: string; glutenFree: string; sugarFree: string; search: string };
type ProductFormState = { name: string; photos: string; calories: string; proteins: string; fats: string; carbs: string; composition: string; category: string; cookingType: string; flags: DietaryFlag[] };
type DishProductRowState = { productId: string; amount: string };
type DishFormState = { name: string; photos: string; calories: string; proteins: string; fats: string; carbs: string; portionSize: string; category: string; flags: DietaryFlag[]; products: DishProductRowState[] };
type ProductDeleteBlockedDetails = { message?: string; dishes?: { id?: string; name?: string }[] };
type CalculatedNutrition = { calories: number; proteins: number; fats: number; carbs: number };

const labels = {
  cookingType: { 1: 'Ready to Eat', 2: 'Semi-finished', 3: 'Requires Cooking' } as Record<CookingType, string>,
  dietaryFlag: { 1: 'Vegan', 2: 'Gluten Free', 3: 'Sugar Free' } as Record<DietaryFlag, string>,
  dishCategory: { 1: 'Dessert', 2: 'First Course', 3: 'Second Course', 4: 'Drink', 5: 'Salad', 6: 'Soup', 7: 'Snack' } as Record<DishCategory, string>,
  productCategory: { 1: 'Frozen', 2: 'Meat', 3: 'Vegetables', 4: 'Greens', 5: 'Spices', 6: 'Grains', 7: 'Canned', 8: 'Liquid', 9: 'Sweets' } as Record<ProductCategory, string>,
  productSort: { 1: 'Name', 2: 'Calories', 3: 'Proteins', 4: 'Fats', 5: 'Carbs' } as Record<ProductSortField, string>,
  sortDirection: { 1: 'Ascending', 2: 'Descending' } as Record<SortDirection, string>,
  flagFilter: { 1: 'Any', 2: 'Yes', 3: 'No' } as Record<FlagFilterOption, string>,
};

const defaultProductFilters: ProductFiltersState = { category: '', cookingType: '', vegan: '', glutenFree: '', sugarFree: '', search: '', sortBy: '', sortDirection: '' };
const defaultDishFilters: DishFiltersState = { category: '', vegan: '', glutenFree: '', sugarFree: '', search: '' };
const emptyProductForm: ProductFormState = { name: '', photos: '', calories: '', proteins: '', fats: '', carbs: '', composition: '', category: '1', cookingType: '1', flags: [] };
const emptyDishForm: DishFormState = { name: '', photos: '', calories: '', proteins: '', fats: '', carbs: '', portionSize: '', category: '', flags: [], products: [] };

const parseNumber = <T extends number>(value: string): T | undefined => (value ? (Number(value) as T) : undefined);
const splitPhotos = (value: string): string[] | null => {
  const items = value.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);
  return items.length ? items : null;
};
const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return `${error.problem?.title ?? 'API Error'}: ${error.problem?.detail ?? error.message}`;
  if (error instanceof Error) return error.message;
  return 'Unexpected error.';
};
const toggleFlag = (flags: DietaryFlag[], flag: DietaryFlag): DietaryFlag[] => flags.includes(flag) ? flags.filter((entry) => entry !== flag) : [...flags, flag].sort((a, b) => a - b);
const round2 = (value: number): number => Math.round(value * 100) / 100;
const allDietaryFlags: DietaryFlag[] = [1, 2, 3];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const parseDeleteBlockedDetails = (value: unknown): ProductDeleteBlockedDetails | null => {
  if (!isObject(value)) return null;
  const message = typeof value.message === 'string' ? value.message : undefined;
  const dishes = Array.isArray(value.dishes)
    ? value.dishes
      .filter(isObject)
      .map((dish) => ({
        id: typeof dish.id === 'string' ? dish.id : undefined,
        name: typeof dish.name === 'string' ? dish.name : undefined,
      }))
    : undefined;
  return { message, dishes };
};
const getDeleteProductBlockedMessage = (error: unknown): string | null => {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const details = parseDeleteBlockedDetails(error.problem?.details);
  if (!details || !details.dishes?.length) return null;
  const usedIn = details.dishes.map((dish) => dish.name || dish.id || 'Unknown dish').join(', ');
  return `${details.message ?? 'Cannot delete product because it is used in dishes.'} Used in: ${usedIn}.`;
};

export function CookbookApp() {
  const [tab, setTab] = useState<Tab>('products');
  const [mode, setMode] = useState<Mode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [dishes, setDishes] = useState<DishResponse[]>([]);
  const [dishProductOptions, setDishProductOptions] = useState<ProductResponse[]>([]);
  const [dishProductOptionsLoading, setDishProductOptionsLoading] = useState(false);
  const [dishProductOptionsError, setDishProductOptionsError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [productFilters, setProductFilters] = useState<ProductFiltersState>(defaultProductFilters);
  const [dishFilters, setDishFilters] = useState<DishFiltersState>(defaultDishFilters);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [dishForm, setDishForm] = useState<DishFormState>(emptyDishForm);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductResponse | null>(null);
  const [selectedDish, setSelectedDish] = useState<DishResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const productApiFilters = useMemo<ProductListFilters>(() => ({
    Category: parseNumber<ProductCategory>(productFilters.category),
    CookingType: parseNumber<CookingType>(productFilters.cookingType),
    Vegan: parseNumber<FlagFilterOption>(productFilters.vegan),
    GlutenFree: parseNumber<FlagFilterOption>(productFilters.glutenFree),
    SugarFree: parseNumber<FlagFilterOption>(productFilters.sugarFree),
    Search: productFilters.search.trim() || undefined,
    SortBy: parseNumber<ProductSortField>(productFilters.sortBy),
    SortDirection: parseNumber<SortDirection>(productFilters.sortDirection),
  }), [productFilters]);

  const dishApiFilters = useMemo<DishListFilters>(() => ({
    Category: parseNumber<DishCategory>(dishFilters.category),
    Vegan: parseNumber<FlagFilterOption>(dishFilters.vegan),
    GlutenFree: parseNumber<FlagFilterOption>(dishFilters.glutenFree),
    SugarFree: parseNumber<FlagFilterOption>(dishFilters.sugarFree),
    Search: dishFilters.search.trim() || undefined,
  }), [dishFilters]);
  const dishProductsById = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    dishProductOptions.forEach((product) => map.set(product.id, product));
    return map;
  }, [dishProductOptions]);
  const availableDishFlags = useMemo<DietaryFlag[]>(() => {
    if (dishForm.products.length === 0) return [];
    const selectedProducts = dishForm.products.map((row) => row.productId ? dishProductsById.get(row.productId) : undefined);
    if (selectedProducts.some((product) => !product)) return [];
    return allDietaryFlags.filter((flag) =>
      selectedProducts.every((product) => (product?.flags ?? []).includes(flag)));
  }, [dishForm.products, dishProductsById]);
  const autoNutritionDraft = useMemo<CalculatedNutrition | null>(() => {
    if (dishForm.products.length === 0) return null;
    let calories = 0;
    let proteins = 0;
    let fats = 0;
    let carbs = 0;

    for (const row of dishForm.products) {
      const amount = Number(row.amount);
      const product = row.productId ? dishProductsById.get(row.productId) : undefined;
      if (!product || !Number.isFinite(amount) || amount <= 0) return null;
      const factor = amount / 100;
      calories += product.calories * factor;
      proteins += product.proteins * factor;
      fats += product.fats * factor;
      carbs += product.carbs * factor;
    }

    return {
      calories: round2(calories),
      proteins: round2(proteins),
      fats: round2(fats),
      carbs: round2(carbs),
    };
  }, [dishForm.products, dishProductsById]);

  useEffect(() => {
    if (mode !== 'list') return;
    let cancelled = false;
    setLoadingList(true);
    setListError(null);
    const promise = tab === 'products' ? cookbookApi.getProducts(productApiFilters) : cookbookApi.getDishes(dishApiFilters);
    promise.then((result) => {
      if (cancelled) return;
      if (tab === 'products') setProducts(result as ProductResponse[]);
      else setDishes(result as DishResponse[]);
    }).catch((error) => {
      if (!cancelled) setListError(getErrorMessage(error));
    }).finally(() => {
      if (!cancelled) setLoadingList(false);
    });
    return () => { cancelled = true; };
  }, [mode, tab, productApiFilters, dishApiFilters, reloadKey]);
  useEffect(() => {
    if ((mode !== 'details' && mode !== 'edit') || !selectedId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    const promise = tab === 'products' ? cookbookApi.getProduct(selectedId) : cookbookApi.getDish(selectedId);
    promise.then((result) => {
      if (cancelled) return;
      if (tab === 'products') setSelectedProduct(result as ProductResponse);
      else setSelectedDish(result as DishResponse);
    }).catch((error) => {
      if (!cancelled) setDetailError(getErrorMessage(error));
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, tab, selectedId]);

  useEffect(() => {
    if (mode !== 'edit' || tab !== 'products' || !selectedProduct) return;
    setProductForm({
      name: selectedProduct.name ?? '',
      photos: (selectedProduct.photos ?? []).join(', '),
      calories: String(selectedProduct.calories),
      proteins: String(selectedProduct.proteins),
      fats: String(selectedProduct.fats),
      carbs: String(selectedProduct.carbs),
      composition: selectedProduct.composition ?? '',
      category: String(selectedProduct.category),
      cookingType: String(selectedProduct.cookingType),
      flags: selectedProduct.flags ?? [],
    });
  }, [mode, tab, selectedProduct]);

  useEffect(() => {
    if (mode !== 'edit' || tab !== 'dishes' || !selectedDish) return;
    setDishForm({
      name: selectedDish.name ?? '',
      photos: (selectedDish.photos ?? []).join(', '),
      calories: String(selectedDish.calories),
      proteins: String(selectedDish.proteins),
      fats: String(selectedDish.fats),
      carbs: String(selectedDish.carbs),
      portionSize: String(selectedDish.portionSize),
      category: String(selectedDish.category),
      flags: selectedDish.flags ?? [],
      products: (selectedDish.products ?? []).map((item) => ({ productId: item.productId, amount: String(item.amount) })),
    });
  }, [mode, tab, selectedDish]);

  useEffect(() => {
    if (tab !== 'dishes' || (mode !== 'create' && mode !== 'edit')) return;
    let cancelled = false;
    setDishProductOptionsLoading(true);
    setDishProductOptionsError(null);
    cookbookApi.getProducts({}).then((result) => {
      if (!cancelled) setDishProductOptions(result);
    }).catch((error) => {
      if (!cancelled) setDishProductOptionsError(getErrorMessage(error));
    }).finally(() => {
      if (!cancelled) setDishProductOptionsLoading(false);
    });
    return () => { cancelled = true; };
  }, [tab, mode]);
  useEffect(() => {
    if (tab !== 'dishes' || (mode !== 'create' && mode !== 'edit')) return;
    if (!autoNutritionDraft) return;
    setDishForm((state) => {
      const nextCalories = String(autoNutritionDraft.calories);
      const nextProteins = String(autoNutritionDraft.proteins);
      const nextFats = String(autoNutritionDraft.fats);
      const nextCarbs = String(autoNutritionDraft.carbs);
      if (
        state.calories === nextCalories &&
        state.proteins === nextProteins &&
        state.fats === nextFats &&
        state.carbs === nextCarbs
      ) {
        return state;
      }

      return {
        ...state,
        calories: nextCalories,
        proteins: nextProteins,
        fats: nextFats,
        carbs: nextCarbs,
      };
    });
  }, [tab, mode, autoNutritionDraft]);
  useEffect(() => {
    if (tab !== 'dishes' || (mode !== 'create' && mode !== 'edit')) return;
    setDishForm((state) => {
      const normalizedFlags = state.flags.filter((flag) => availableDishFlags.includes(flag));
      if (normalizedFlags.length === state.flags.length) return state;
      return { ...state, flags: normalizedFlags };
    });
  }, [tab, mode, availableDishFlags]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.app-shell');
    if (!root) return;

    const existingIds = new Set<string>();
    root.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
      existingIds.add(element.id);
    });

    let nextIndex = 1;
    root.querySelectorAll<HTMLElement>('*:not([id])').forEach((element) => {
      const baseId = `auto-${element.tagName.toLowerCase()}`;
      let generatedId = `${baseId}-${nextIndex}`;
      while (existingIds.has(generatedId)) {
        nextIndex += 1;
        generatedId = `${baseId}-${nextIndex}`;
      }
      element.id = generatedId;
      existingIds.add(generatedId);
      nextIndex += 1;
    });
  }, [
    tab,
    mode,
    loadingList,
    listError,
    detailLoading,
    detailError,
    products,
    dishes,
    dishProductOptionsLoading,
    dishProductOptionsError,
    dishProductOptions,
    dishForm.products,
    submitting,
    bannerError,
    bannerSuccess,
  ]);

  const resetBanner = () => { setBannerError(null); setBannerSuccess(null); };

  const goToList = (nextTab?: Tab) => {
    if (nextTab) setTab(nextTab);
    setMode('list');
    setSelectedId(null);
    setSelectedProduct(null);
    setSelectedDish(null);
    resetBanner();
  };

  const openCreate = () => {
    resetBanner();
    if (tab === 'products') setProductForm(emptyProductForm);
    else setDishForm(emptyDishForm);
    setMode('create');
  };

  const openDetails = (id: string) => { resetBanner(); setSelectedId(id); setMode('details'); };
  const openEdit = (id: string) => { resetBanner(); setSelectedId(id); setMode('edit'); };

  const removeProduct = async (id: string) => {
    if (!window.confirm('Delete this product?')) return;
    resetBanner();
    try {
      await cookbookApi.deleteProduct(id);
      setBannerSuccess('Product deleted.');
      setReloadKey((value) => value + 1);
    } catch (error) {
      setBannerError(getDeleteProductBlockedMessage(error) ?? getErrorMessage(error));
    }
  };

  const removeDish = async (id: string) => {
    if (!window.confirm('Delete this dish?')) return;
    resetBanner();
    try {
      await cookbookApi.deleteDish(id);
      setBannerSuccess('Dish deleted.');
      setReloadKey((value) => value + 1);
    } catch (error) {
      setBannerError(getErrorMessage(error));
    }
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetBanner();
    if (!productForm.calories || Number.isNaN(Number(productForm.calories))) return setBannerError('Calories is required and must be a number.');
    if (!productForm.proteins || Number.isNaN(Number(productForm.proteins))) return setBannerError('Proteins is required and must be a number.');
    if (!productForm.fats || Number.isNaN(Number(productForm.fats))) return setBannerError('Fats is required and must be a number.');
    if (!productForm.carbs || Number.isNaN(Number(productForm.carbs))) return setBannerError('Carbs is required and must be a number.');

    const payload: CreateProductRequest = {
      name: productForm.name.trim() || null,
      photos: splitPhotos(productForm.photos),
      calories: Number(productForm.calories),
      proteins: Number(productForm.proteins),
      fats: Number(productForm.fats),
      carbs: Number(productForm.carbs),
      composition: productForm.composition.trim() || null,
      category: Number(productForm.category) as ProductCategory,
      cookingType: Number(productForm.cookingType) as CookingType,
      flags: productForm.flags.length ? productForm.flags : null,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await cookbookApi.createProduct(payload);
        setBannerSuccess('Product created.');
      } else if (selectedId) {
        await cookbookApi.updateProduct(selectedId, payload);
        setBannerSuccess('Product updated.');
      }
      setReloadKey((value) => value + 1);
      setMode('list');
    } catch (error) {
      setBannerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetBanner();
    if (dishForm.products.length === 0) return setBannerError('Dish must contain at least one product.');
    if (!dishForm.portionSize || Number.isNaN(Number(dishForm.portionSize))) return setBannerError('Portion size is required and must be a number.');
    for (const row of dishForm.products) {
      if (!row.productId) return setBannerError('Please select product for each row.');
      if (!row.amount || Number.isNaN(Number(row.amount))) return setBannerError('Each product amount must be numeric.');
    }

    const products: DishProductRequest[] = dishForm.products.map((row) => ({ productId: row.productId, amount: Number(row.amount) }));
    const payload: CreateDishRequest = {
      name: dishForm.name.trim() || null,
      photos: splitPhotos(dishForm.photos),
      calories: dishForm.calories ? Number(dishForm.calories) : null,
      proteins: dishForm.proteins ? Number(dishForm.proteins) : null,
      fats: dishForm.fats ? Number(dishForm.fats) : null,
      carbs: dishForm.carbs ? Number(dishForm.carbs) : null,
      products: products.length ? products : null,
      portionSize: Number(dishForm.portionSize),
      category: dishForm.category ? Number(dishForm.category) as DishCategory : undefined,
      flags: dishForm.flags.filter((flag) => availableDishFlags.includes(flag)).length
        ? dishForm.flags.filter((flag) => availableDishFlags.includes(flag))
        : null,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await cookbookApi.createDish(payload);
        setBannerSuccess('Dish created.');
      } else if (selectedId) {
        await cookbookApi.updateDish(selectedId, payload);
        setBannerSuccess('Dish updated.');
      }
      setReloadKey((value) => value + 1);
      setMode('list');
    } catch (error) {
      setBannerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="app-shell" className="app-shell">
      <header className="topbar">
        <div>
          <h1>Cookbook</h1>
        </div>
        <div className="topbar-actions">
          <button className={tab === 'products' ? 'active' : ''} onClick={() => goToList('products')}>Products</button>
          <button className={tab === 'dishes' ? 'active' : ''} onClick={() => goToList('dishes')}>Dishes</button>
          {mode === 'list' ? <button className="primary" onClick={openCreate}>Create {tab === 'products' ? 'Product' : 'Dish'}</button> : <button onClick={() => goToList()}>Back to list</button>}
        </div>
      </header>

      {bannerSuccess && <div className="banner success">{bannerSuccess}</div>}
      {bannerError && <div className="banner error">{bannerError}</div>}

      <main className="content">
        {mode === 'list' && (
          <section className="panel">
            <h2>{tab === 'products' ? 'Products' : 'Dishes'}</h2>
            {tab === 'products' ? (
              <>
                <div className="filters">
                  <input placeholder="Search" value={productFilters.search} onChange={(event) => setProductFilters((state) => ({ ...state, search: event.target.value }))} />
                  <select value={productFilters.category} onChange={(event) => setProductFilters((state) => ({ ...state, category: event.target.value }))}>
                    <option value="">Any category</option>
                    {Object.entries(labels.productCategory).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <select value={productFilters.cookingType} onChange={(event) => setProductFilters((state) => ({ ...state, cookingType: event.target.value }))}>
                    <option value="">Any cooking type</option>
                    {Object.entries(labels.cookingType).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <select value={productFilters.vegan} onChange={(event) => setProductFilters((state) => ({ ...state, vegan: event.target.value }))}>
                    <option value="">Vegan: any</option>
                    <option value="2">Vegan: yes</option>
                    <option value="3">Vegan: no</option>
                  </select>
                  <select value={productFilters.glutenFree} onChange={(event) => setProductFilters((state) => ({ ...state, glutenFree: event.target.value }))}>
                    <option value="">Gluten Free: any</option>
                    <option value="2">Gluten Free: yes</option>
                    <option value="3">Gluten Free: no</option>
                  </select>
                  <select value={productFilters.sugarFree} onChange={(event) => setProductFilters((state) => ({ ...state, sugarFree: event.target.value }))}>
                    <option value="">Sugar Free: any</option>
                    <option value="2">Sugar Free: yes</option>
                    <option value="3">Sugar Free: no</option>
                  </select>
                  <select value={productFilters.sortBy} onChange={(event) => setProductFilters((state) => ({ ...state, sortBy: event.target.value }))}>
                    <option value="">Sort by</option>
                    {Object.entries(labels.productSort).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <select value={productFilters.sortDirection} onChange={(event) => setProductFilters((state) => ({ ...state, sortDirection: event.target.value }))}>
                    <option value="">Direction</option>
                    {Object.entries(labels.sortDirection).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <button type="button" className="ghost" onClick={() => setProductFilters(defaultProductFilters)}>Reset</button>
                </div>

                {loadingList && <p>Loading products...</p>}
                {listError && <p className="error-text">{listError}</p>}
                {!loadingList && !listError && products.length === 0 && <p>No products found.</p>}
                {!loadingList && !listError && products.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Category</th><th>Cooking</th><th>K/P/F/C</th><th>Flags</th><th>Actions</th></tr></thead>
                      <tbody>
                        {products.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name || '-'}</td>
                            <td>{labels.productCategory[item.category] ?? item.category}</td>
                            <td>{labels.cookingType[item.cookingType] ?? item.cookingType}</td>
                            <td>{`${item.calories}/${item.proteins}/${item.fats}/${item.carbs}`}</td>
                            <td>{(item.flags ?? []).map((flag) => labels.dietaryFlag[flag] ?? String(flag)).join(', ') || '-'}</td>
                            <td className="actions"><button onClick={() => openDetails(item.id)}>Details</button><button onClick={() => openEdit(item.id)}>Edit</button><button className="danger" onClick={() => void removeProduct(item.id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="filters">
                  <input placeholder="Search" value={dishFilters.search} onChange={(event) => setDishFilters((state) => ({ ...state, search: event.target.value }))} />
                  <select value={dishFilters.category} onChange={(event) => setDishFilters((state) => ({ ...state, category: event.target.value }))}>
                    <option value="">Any category</option>
                    {Object.entries(labels.dishCategory).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                  <select value={dishFilters.vegan} onChange={(event) => setDishFilters((state) => ({ ...state, vegan: event.target.value }))}>
                    <option value="">Vegan: any</option>
                    <option value="2">Vegan: yes</option>
                    <option value="3">Vegan: no</option>
                  </select>
                  <select value={dishFilters.glutenFree} onChange={(event) => setDishFilters((state) => ({ ...state, glutenFree: event.target.value }))}>
                    <option value="">Gluten Free: any</option>
                    <option value="2">Gluten Free: yes</option>
                    <option value="3">Gluten Free: no</option>
                  </select>
                  <select value={dishFilters.sugarFree} onChange={(event) => setDishFilters((state) => ({ ...state, sugarFree: event.target.value }))}>
                    <option value="">Sugar Free: any</option>
                    <option value="2">Sugar Free: yes</option>
                    <option value="3">Sugar Free: no</option>
                  </select>
                  <button type="button" className="ghost" onClick={() => setDishFilters(defaultDishFilters)}>Reset</button>
                </div>

                {loadingList && <p>Loading dishes...</p>}
                {listError && <p className="error-text">{listError}</p>}
                {!loadingList && !listError && dishes.length === 0 && <p>No dishes found.</p>}
                {!loadingList && !listError && dishes.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Category</th><th>Portion</th><th>K/P/F/C</th><th>Flags</th><th>Actions</th></tr></thead>
                      <tbody>
                        {dishes.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name || '-'}</td>
                            <td>{labels.dishCategory[item.category] ?? item.category}</td>
                            <td>{item.portionSize}</td>
                            <td>{`${item.calories}/${item.proteins}/${item.fats}/${item.carbs}`}</td>
                            <td>{(item.flags ?? []).map((flag) => labels.dietaryFlag[flag] ?? String(flag)).join(', ') || '-'}</td>
                            <td className="actions"><button onClick={() => openDetails(item.id)}>Details</button><button onClick={() => openEdit(item.id)}>Edit</button><button className="danger" onClick={() => void removeDish(item.id)}>Delete</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {(mode === 'create' || mode === 'edit') && (
          <section className="panel">
            <h2>{mode === 'create' ? `Create ${tab === 'products' ? 'Product' : 'Dish'}` : `Edit ${tab === 'products' ? 'Product' : 'Dish'}`}</h2>
            {tab === 'products' ? (
              <form className="editor" onSubmit={(event) => void submitProduct(event)}>
                <input placeholder="Name" value={productForm.name} onChange={(event) => setProductForm((state) => ({ ...state, name: event.target.value }))} />
                <textarea placeholder="Photos (comma/new line separated)" value={productForm.photos} onChange={(event) => setProductForm((state) => ({ ...state, photos: event.target.value }))} />
                <div className="grid-4">
                  <input placeholder="Calories*" value={productForm.calories} onChange={(event) => setProductForm((state) => ({ ...state, calories: event.target.value }))} />
                  <input placeholder="Proteins*" value={productForm.proteins} onChange={(event) => setProductForm((state) => ({ ...state, proteins: event.target.value }))} />
                  <input placeholder="Fats*" value={productForm.fats} onChange={(event) => setProductForm((state) => ({ ...state, fats: event.target.value }))} />
                  <input placeholder="Carbs*" value={productForm.carbs} onChange={(event) => setProductForm((state) => ({ ...state, carbs: event.target.value }))} />
                </div>
                <textarea placeholder="Composition" value={productForm.composition} onChange={(event) => setProductForm((state) => ({ ...state, composition: event.target.value }))} />
                <div className="grid-2">
                  <select value={productForm.category} onChange={(event) => setProductForm((state) => ({ ...state, category: event.target.value }))}>{Object.entries(labels.productCategory).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
                  <select value={productForm.cookingType} onChange={(event) => setProductForm((state) => ({ ...state, cookingType: event.target.value }))}>{Object.entries(labels.cookingType).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
                </div>
                <fieldset>
                  <legend>Dietary flags</legend>
                  <div className="checks">{Object.entries(labels.dietaryFlag).map(([value, text]) => { const flag = Number(value) as DietaryFlag; return <label key={value} className="check-item"><input type="checkbox" checked={productForm.flags.includes(flag)} onChange={() => setProductForm((state) => ({ ...state, flags: toggleFlag(state.flags, flag) }))} />{text}</label>; })}</div>
                </fieldset>
                <div className="form-actions"><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : mode === 'create' ? 'Create Product' : 'Save Product'}</button><button type="button" onClick={() => goToList()}>Cancel</button></div>
              </form>
            ) : (
              <form className="editor" onSubmit={(event) => void submitDish(event)}>
                <input placeholder="Name" value={dishForm.name} onChange={(event) => setDishForm((state) => ({ ...state, name: event.target.value }))} />
                <textarea placeholder="Photos (comma/new line separated)" value={dishForm.photos} onChange={(event) => setDishForm((state) => ({ ...state, photos: event.target.value }))} />
                <div className="grid-4">
                  <input placeholder="Calories" value={dishForm.calories} onChange={(event) => setDishForm((state) => ({ ...state, calories: event.target.value }))} />
                  <input placeholder="Proteins" value={dishForm.proteins} onChange={(event) => setDishForm((state) => ({ ...state, proteins: event.target.value }))} />
                  <input placeholder="Fats" value={dishForm.fats} onChange={(event) => setDishForm((state) => ({ ...state, fats: event.target.value }))} />
                  <input placeholder="Carbs" value={dishForm.carbs} onChange={(event) => setDishForm((state) => ({ ...state, carbs: event.target.value }))} />
                </div>
                {autoNutritionDraft && (
                  <p className="subtitle">
                    Auto draft from composition: {autoNutritionDraft.calories}/{autoNutritionDraft.proteins}/{autoNutritionDraft.fats}/{autoNutritionDraft.carbs}
                  </p>
                )}
                <div className="grid-2">
                  <input placeholder="Portion size*" value={dishForm.portionSize} onChange={(event) => setDishForm((state) => ({ ...state, portionSize: event.target.value }))} />
                  <select value={dishForm.category} onChange={(event) => setDishForm((state) => ({ ...state, category: event.target.value }))}>
                    <option value="">Use macro / choose manually</option>
                    {Object.entries(labels.dishCategory).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </div>
                <fieldset>
                  <legend>Dish products</legend>
                  {dishProductOptionsLoading && <p>Loading products for selection...</p>}
                  {dishProductOptionsError && <p className="error-text">{dishProductOptionsError}</p>}
                  {!dishProductOptionsLoading && !dishProductOptionsError && dishProductOptions.length === 0 && (
                    <p className="error-text">No products found. Create products first.</p>
                  )}
                  <div className="rows">
                    {dishForm.products.map((row, index) => (
                      <div key={`${row.productId}-${index}`} className="row-item">
                        <select
                          value={row.productId}
                          onChange={(event) =>
                            setDishForm((state) => {
                              const products = [...state.products];
                              products[index] = { ...products[index], productId: event.target.value };
                              return { ...state, products };
                            })
                          }
                        >
                          <option value="">Select product</option>
                          {dishProductOptions.map((product) => (
                            <option key={product.id} value={product.id}>
                              {(product.name || 'Unnamed product') + ' | ' + product.id}
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="amount"
                          value={row.amount}
                          onChange={(event) =>
                            setDishForm((state) => {
                              const products = [...state.products];
                              products[index] = { ...products[index], amount: event.target.value };
                              return { ...state, products };
                            })
                          }
                        />
                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setDishForm((state) => ({
                              ...state,
                              products: state.products.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDishForm((state) => ({
                        ...state,
                        products: [
                          ...state.products,
                          { productId: dishProductOptions[0]?.id ?? '', amount: '' },
                        ],
                      }))
                    }
                    disabled={dishProductOptionsLoading || dishProductOptions.length === 0}
                  >
                    Add Product Row
                  </button>
                </fieldset>
                <fieldset>
                  <legend>Dietary flags</legend>
                  <div className="checks">
                    {Object.entries(labels.dietaryFlag).map(([value, text]) => {
                      const flag = Number(value) as DietaryFlag;
                      const enabled = availableDishFlags.includes(flag);
                      return (
                        <label key={value} className="check-item">
                          <input
                            type="checkbox"
                            checked={dishForm.flags.includes(flag)}
                            disabled={!enabled}
                            onChange={() => setDishForm((state) => ({ ...state, flags: toggleFlag(state.flags, flag) }))}
                          />
                          {text}{enabled ? '' : ' (Unavailable by composition)'}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="form-actions"><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : mode === 'create' ? 'Create Dish' : 'Save Dish'}</button><button type="button" onClick={() => goToList()}>Cancel</button></div>
              </form>
            )}
          </section>
        )}

        {mode === 'details' && (
          <section className="panel">
            <h2>{tab === 'products' ? 'Product Details' : 'Dish Details'}</h2>
            {detailLoading && <p>Loading details...</p>}
            {detailError && <p className="error-text">{detailError}</p>}
            {!detailLoading && !detailError && tab === 'products' && selectedProduct && <div className="details-grid"><p><strong>ID:</strong> {selectedProduct.id}</p><p><strong>Name:</strong> {selectedProduct.name || '-'}</p><p><strong>Category:</strong> {labels.productCategory[selectedProduct.category]}</p><p><strong>Cooking:</strong> {labels.cookingType[selectedProduct.cookingType]}</p><p><strong>K/P/F/C:</strong> {`${selectedProduct.calories}/${selectedProduct.proteins}/${selectedProduct.fats}/${selectedProduct.carbs}`}</p><p><strong>Created:</strong> {formatDate(selectedProduct.createdAt)}</p><p><strong>Updated:</strong> {formatDate(selectedProduct.updatedAt)}</p></div>}
            {!detailLoading && !detailError && tab === 'dishes' && selectedDish && <div className="details-grid"><p><strong>ID:</strong> {selectedDish.id}</p><p><strong>Name:</strong> {selectedDish.name || '-'}</p><p><strong>Category:</strong> {labels.dishCategory[selectedDish.category]}</p><p><strong>Portion:</strong> {selectedDish.portionSize}</p><p><strong>K/P/F/C:</strong> {`${selectedDish.calories}/${selectedDish.proteins}/${selectedDish.fats}/${selectedDish.carbs}`}</p><p><strong>Auto Nutrition:</strong> {`${selectedDish.autoCalculatedNutrition.calories}/${selectedDish.autoCalculatedNutrition.proteins}/${selectedDish.autoCalculatedNutrition.fats}/${selectedDish.autoCalculatedNutrition.carbs}`}</p><p><strong>Created:</strong> {formatDate(selectedDish.createdAt)}</p><p><strong>Updated:</strong> {formatDate(selectedDish.updatedAt)}</p><div><strong>Products:</strong>{(selectedDish.products ?? []).length ? <ul>{(selectedDish.products ?? []).map((item) => <li key={`${item.productId}-${item.amount}`}>{item.productName || item.productId}: {item.amount}</li>)}</ul> : <p>-</p>}</div></div>}
          </section>
        )}
      </main>
    </div>
  );
}
