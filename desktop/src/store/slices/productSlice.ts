// src/store/slices/productSlice.ts
/// <reference types="vite/client" />

const API = (import.meta.env?.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { docApi, getHostBaseUrl } from '../../services/docApi';
import { companyScopedKey, readCompanyScopedRaw } from '../../utils/companyStorage';

export interface Product {
  id: string;
  name: string;
  brandName: string;
  companyName: string;
  sku?: string;
  code?: string;
  hsn?: string;
  mrp?: number;
  salePrice?: number;
  purchasePrice?: number;
  stock?: number;
  unit?: string;
  gstRate?: number;
  minStockLevel?: number;
  categoryId?: string;
  barcode?: string;
  hsnCode?: string;
  sacCode?: string;
  uqc?: string;
  wholesalePrice?: number;
  distributorPrice?: number;
  openingStock?: number;
  currentStock?: number;
  lowStockAlert?: number;
  trackBatch?: boolean;
  trackSerial?: boolean;
  trackExpiry?: boolean;
  images?: any[];
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface ProductState {
  items: Product[];
  currentProduct: Product | null;
  categories: Category[];
  categoriesLoading: boolean;
  loading: boolean;
  uploading: boolean;
  error: string | null;
}

const initialState: ProductState = {
  items: [],
  currentProduct: null,
  categories: [],
  categoriesLoading: false,
  loading: false,
  uploading: false,
  error: null,
};

const isOfflineRuntime = () => {
  try {
    if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('electron')) return true;
    if ((window as any)?.process?.type === 'renderer') return true;
    if ((window as any).__TAURI__ != null) return true;
    if ((window as any).__TAURI_INTERNALS__ != null) return true;
    if ((window as any).__TAURI_IPC__ != null) return true;
    if ((window as any).__TAURI_METADATA__ != null) return true;
    if ((navigator as any)?.userAgent && String((navigator as any).userAgent).toLowerCase().includes('tauri')) return true;
    if (window.location.hostname === 'tauri.localhost') return true;
    const p = window.location.protocol;
    return p === 'tauri:' || p === 'file:';
  } catch {
    return false;
  }
};

const isLanDocsEnabled = () => {
  try {
    return !!getHostBaseUrl();
  } catch {
    return false;
  }
};

const PRODUCTS_STORAGE_KEY = companyScopedKey('pve_products');
const INVENTORY_ITEMS_STORAGE_KEY = companyScopedKey('pve_inventory_items');
const CATEGORIES_STORAGE_KEY = companyScopedKey('pve_product_categories');

const SALES_INVOICES_STORAGE_KEY = companyScopedKey('pve_invoicepro_invoices');
const PURCHASE_BILLS_STORAGE_KEY = companyScopedKey('pve_invoicepro_purchase_invoices');
const CREDIT_NOTES_STORAGE_KEY = companyScopedKey('pve_invoicepro_credit_notes');
const DEBIT_NOTES_STORAGE_KEY = companyScopedKey('pve_invoicepro_debit_notes');

const getStoredProducts = (): Product[] => {
  try {
    const mapInventoryToProducts = (invParsed: any[]): Product[] =>
      invParsed.map((it: any, idx: number) => {
        const name = String(it?.name ?? '').trim();
        const sku = String(it?.sku ?? '').trim();
        return {
          id: String((it?.id ?? sku) || `itm-${Date.now()}-${idx}`),
          name: name || `Item ${idx + 1}`,
          brandName: String(it?.brand ?? 'Generic'),
          companyName: String(it?.companyName ?? 'Generic'),
          sku: sku || undefined,
          code: sku || String(it?.id ?? `CODE-${idx + 1}`),
          hsn: String(it?.hsnCode ?? it?.hsn ?? '0000'),
          hsnCode: String(it?.hsnCode ?? it?.hsn ?? ''),
          mrp: Number(it?.pricing?.mrp ?? 0) || 0,
          salePrice: Number(it?.pricing?.sale ?? 0) || 0,
          purchasePrice: Number(it?.pricing?.purchase ?? 0) || 0,
          stock: Number(it?.currentStock ?? it?.openingStock ?? 0) || 0,
          openingStock: Number(it?.openingStock ?? 0) || 0,
          currentStock: Number(it?.currentStock ?? it?.openingStock ?? 0) || 0,
          unit: String(it?.unitName ?? it?.unit ?? 'Pcs'),
          gstRate: Number(it?.gstRate ?? 0) || 0,
          lowStockAlert: Number(it?.reorderLevel ?? 0) || 0,
          minStockLevel: Number(it?.reorderLevel ?? 0) || 0,
          isActive: it?.status ? String(it.status).toUpperCase() === 'ACTIVE' : true,
          barcode: String(it?.barcode ?? ''),
          categoryId: String(it?.categoryId ?? ''),
        } as Product;
      });

    const raw = readCompanyScopedRaw('pve_products');
    if (!raw) {
      const invRaw = readCompanyScopedRaw('pve_inventory_items');
      if (!invRaw) return [];
      const invParsed = JSON.parse(invRaw);
      if (!Array.isArray(invParsed)) return [];
      return mapInventoryToProducts(invParsed);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (parsed.length > 0) return parsed as Product[];
    const invRaw = readCompanyScopedRaw('pve_inventory_items');
    if (!invRaw) return [];
    const invParsed = JSON.parse(invRaw);
    if (!Array.isArray(invParsed)) return [];
    return mapInventoryToProducts(invParsed);
  } catch {
    return [];
  }
};

const saveStoredProducts = (products: Product[]) => {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
};

const loadStoredList = (key: string): any[] => {
  try {
    const raw = readCompanyScopedRaw(key.replace(/::.*$/, '')) ?? localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isProductUsedInBilling = (product: Pick<Product, 'id' | 'name' | 'code' | 'hsn' | 'hsnCode'>): boolean => {
  const nameKey = String(product?.name ?? '').trim().toLowerCase();
  if (!nameKey) return false;

  const hasMatch = (doc: any) => {
    const items = Array.isArray(doc?.items) ? doc.items : [];
    return items.some((it: any) => String(it?.description ?? '').trim().toLowerCase() === nameKey);
  };

  const salesInvoices = loadStoredList(SALES_INVOICES_STORAGE_KEY);
  if (salesInvoices.some(hasMatch)) return true;

  const purchaseBills = loadStoredList(PURCHASE_BILLS_STORAGE_KEY);
  if (purchaseBills.some(hasMatch)) return true;

  const creditNotes = loadStoredList(CREDIT_NOTES_STORAGE_KEY);
  if (creditNotes.some(hasMatch)) return true;

  const debitNotes = loadStoredList(DEBIT_NOTES_STORAGE_KEY);
  if (debitNotes.some(hasMatch)) return true;

  return false;
};

const getStoredCategories = (): Category[] => {
  try {
    const raw = readCompanyScopedRaw('pve_product_categories');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Category[];
    }
  } catch {
    // ignore
  }

  return [];
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** FETCH ALL PRODUCTS */
export const fetchProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  'products/fetchProducts',
  async (_, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        try {
          const items = await docApi.listPayloads<Product>('product');
          saveStoredProducts(items);
          return items;
        } catch {
          // fall back
        }
      }
      if (isOfflineRuntime()) {
        return getStoredProducts();
      }
      const res = await fetch(`${API}/api/products`, {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      const parsed = await res.json();
      if (Array.isArray(parsed)) return parsed as Product[];
      if (Array.isArray(parsed?.data)) return parsed.data as Product[];
      return [];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

export const bulkDeleteProducts = createAsyncThunk<
  { deleted: string[]; blocked: Array<{ id: string; reason: string }> },
  string[],
  { rejectValue: string }
>(
  'products/bulkDeleteProducts',
  async (productIds, thunkAPI) => {
    try {
      const ids = Array.isArray(productIds) ? productIds.map(String) : [];
      if (ids.length === 0) return { deleted: [], blocked: [] };

      const existing = getStoredProducts();
      const byId = new Map(existing.map((p) => [String(p.id), p] as const));

      const blocked: Array<{ id: string; reason: string }> = [];
      const deletable: string[] = [];

      for (const id of ids) {
        const p = byId.get(String(id));
        if (p && isProductUsedInBilling(p)) {
          blocked.push({ id: String(id), reason: 'used in billing' });
        } else {
          deletable.push(String(id));
        }
      }

      if (isLanDocsEnabled() || isOfflineRuntime()) {
        if (isLanDocsEnabled()) {
          await Promise.all(
            deletable.map((id) =>
              docApi.deleteDoc('product', String(id)).catch(() => {
                blocked.push({ id: String(id), reason: 'failed to delete on host' });
              })
            )
          );
        }

        const blockedSet = new Set(blocked.map((b) => String(b.id)));
        const okIds = deletable.filter((id) => !blockedSet.has(String(id)));
        const next = existing.filter((p) => !okIds.includes(String(p.id)));
        saveStoredProducts(next);
        return { deleted: okIds, blocked };
      }

      const deleted: string[] = [];
      for (const id of deletable) {
        try {
          const res = await fetch(`${API}/api/products/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: getAuthHeaders() as Record<string, string>,
          });
          if (!res.ok) {
            const txt = await res.text();
            blocked.push({ id: String(id), reason: `server error: ${res.status} ${txt}` });
          } else {
            deleted.push(String(id));
          }
        } catch (e: any) {
          blocked.push({ id: String(id), reason: e?.message ?? 'network error' });
        }
      }

      return { deleted, blocked };
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Bulk delete failed');
    }
  }
);

/** FETCH SINGLE PRODUCT (by id) - required by ProductForm.tsx */
export const fetchProduct = createAsyncThunk<Product, string, { rejectValue: string }>(
  'products/fetchProduct',
  async (id, thunkAPI) => {
    try {
      if (isLanDocsEnabled()) {
        try {
          const row = await docApi.getDoc('product', String(id));
          const p = row?.payload as Product | undefined;
          if (!p) return thunkAPI.rejectWithValue('Product not found');
          const existing = getStoredProducts();
          const next = [p, ...existing.filter((x) => String(x.id) !== String(p.id))];
          saveStoredProducts(next);
          return p;
        } catch (e: any) {
          return thunkAPI.rejectWithValue(e?.message ?? 'Network error');
        }
      }
      if (isOfflineRuntime()) {
        const products = getStoredProducts();
        const p = products.find((x) => String(x.id) === String(id));
        if (!p) return thunkAPI.rejectWithValue('Product not found');
        return p;
      }
      const res = await fetch(`${API}/api/products/${encodeURIComponent(id)}`, {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return (await res.json()) as Product;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** FETCH CATEGORIES */
export const fetchCategories = createAsyncThunk<Category[], void, { rejectValue: string }>(
  'products/fetchCategories',
  async (_, thunkAPI) => {
    try {
      if (isOfflineRuntime()) {
        return getStoredCategories();
      }
      const res = await fetch(`${API}/api/categories`, {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return (await res.json()) as Category[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** CREATE PRODUCT */
export const createProduct = createAsyncThunk<Product, Partial<Product>, { rejectValue: string }>(
  'products/createProduct',
  async (payload, thunkAPI) => {
    try {
      if (isLanDocsEnabled() || isOfflineRuntime()) {
        const products = getStoredProducts();
        const id = String(payload.id ?? payload.code ?? `prod-${Date.now()}`);
        const created: Product = {
          id,
          name: String(payload.name ?? ''),
          brandName: String(payload.brandName ?? ''),
          companyName: String(payload.companyName ?? ''),
          sku: payload.sku,
          code: payload.code,
          hsn: payload.hsn ?? payload.hsnCode,
          mrp: payload.mrp,
          salePrice: payload.salePrice,
          purchasePrice: payload.purchasePrice,
          stock: payload.stock ?? payload.currentStock ?? payload.openingStock,
          unit: payload.unit,
          gstRate: payload.gstRate,
          minStockLevel: payload.minStockLevel,
          categoryId: payload.categoryId,
          barcode: payload.barcode,
          hsnCode: payload.hsnCode,
          sacCode: payload.sacCode,
          uqc: payload.uqc,
          wholesalePrice: payload.wholesalePrice,
          distributorPrice: payload.distributorPrice,
          openingStock: payload.openingStock,
          currentStock: payload.currentStock,
          lowStockAlert: payload.lowStockAlert,
          trackBatch: payload.trackBatch,
          trackSerial: payload.trackSerial,
          trackExpiry: payload.trackExpiry,
          images: payload.images,
          isActive: payload.isActive ?? true,
        };
        const next = [created, ...products.filter((p) => String(p.id) !== id)];
        saveStoredProducts(next);

        if (isLanDocsEnabled()) {
          await docApi.upsertDoc('product', String(created.id), {
            docNumber: created.code,
            partyName: created.name,
            payload: created,
            updatedAt: new Date().toISOString(),
          });
        }
        return created;
      }
      const res = await fetch(`${API}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() as Record<string, string>) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return (await res.json()) as Product;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** UPDATE PRODUCT */
export const updateProduct = createAsyncThunk<Product, { id: string; changes: Partial<Product> }, { rejectValue: string }>(
  'products/updateProduct',
  async ({ id, changes }, thunkAPI) => {
    try {
      if (isLanDocsEnabled() || isOfflineRuntime()) {
        const products = getStoredProducts();
        const idx = products.findIndex((p) => String(p.id) === String(id));
        if (idx < 0) return thunkAPI.rejectWithValue('Product not found');
        const updated: Product = {
          ...products[idx],
          ...changes,
          id: String(products[idx].id),
          hsn: changes.hsn ?? changes.hsnCode ?? products[idx].hsn ?? products[idx].hsnCode,
          stock: changes.stock ?? changes.currentStock ?? changes.openingStock ?? products[idx].stock ?? products[idx].currentStock ?? products[idx].openingStock,
        } as Product;
        const next = [...products];
        next[idx] = updated;
        saveStoredProducts(next);

        if (isLanDocsEnabled()) {
          await docApi.upsertDoc('product', String(updated.id), {
            docNumber: updated.code,
            partyName: updated.name,
            payload: updated,
            updatedAt: new Date().toISOString(),
          });
        }
        return updated;
      }
      const res = await fetch(`${API}/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() as Record<string, string>) },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return (await res.json()) as Product;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** DELETE PRODUCT */
export const deleteProduct = createAsyncThunk<string, string, { rejectValue: string }>(
  'products/deleteProduct',
  async (productId, thunkAPI) => {
    try {
      const productsForCheck = getStoredProducts();
      const p = productsForCheck.find((x) => String(x.id) === String(productId));
      if (p && isProductUsedInBilling(p)) {
        return thunkAPI.rejectWithValue('Cannot delete product: used in billing');
      }

      if (isLanDocsEnabled() || isOfflineRuntime()) {
        if (isLanDocsEnabled()) {
          await docApi.deleteDoc('product', String(productId));
        }
        const products = getStoredProducts();
        const next = products.filter((p) => String(p.id) !== String(productId));
        saveStoredProducts(next);
        return productId;
      }
      const res = await fetch(`${API}/api/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return productId;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

/** BULK IMPORT PRODUCTS */
export const bulkImportProducts = createAsyncThunk<Product[], Product[], { rejectValue: string }>(
  'products/bulkImportProducts',
  async (productsToImport, thunkAPI) => {
    try {
      if (isLanDocsEnabled() || isOfflineRuntime()) {
        const existing = getStoredProducts();
        const map = new Map<string, Product>();
        for (const p of existing) map.set(String(p.id), p);
        for (const p of productsToImport) map.set(String(p.id), p);
        const merged = Array.from(map.values());
        saveStoredProducts(merged);

        if (isLanDocsEnabled()) {
          await Promise.all(
            productsToImport.map((p) =>
              docApi.upsertDoc('product', String(p.id), {
                docNumber: (p as any)?.code,
                partyName: p.name,
                payload: p,
                updatedAt: new Date().toISOString(),
              })
            )
          );
        }
        return productsToImport;
      }
      const res = await fetch(`${API}/api/products/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() as Record<string, string>) },
        body: JSON.stringify(productsToImport),
      });
      if (!res.ok) {
        const txt = await res.text();
        return thunkAPI.rejectWithValue(`Server error: ${res.status} ${txt}`);
      }
      return (await res.json()) as Product[];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Network error');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setCurrentProduct(state, action: PayloadAction<Product>) {
      state.currentProduct = action.payload;
    },
    clearCurrentProduct(state) {
      state.currentProduct = null;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProducts
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Unknown error';
      })

      // fetchProduct (single)
      .addCase(fetchProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.loading = false;
        state.currentProduct = action.payload;
        // optionally upsert into items
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.unshift(action.payload);
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Fetch product failed';
      })

      // fetchCategories
      .addCase(fetchCategories.pending, (state) => {
        state.categoriesLoading = true;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.categoriesLoading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state) => {
        state.categoriesLoading = false;
      })

      // createProduct
      .addCase(createProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.loading = false;
        state.items.unshift(action.payload);
        state.currentProduct = action.payload;
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Create product failed';
      })

      // updateProduct
      .addCase(updateProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProduct.fulfilled, (state, action: PayloadAction<Product>) => {
        state.loading = false;
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        state.currentProduct = action.payload;
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Update failed';
      })

      // deleteProduct
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.items = state.items.filter((p) => p.id !== action.payload);
        if (state.currentProduct?.id === action.payload) state.currentProduct = null;
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Delete failed';
      })

      // bulkDeleteProducts
      .addCase(bulkDeleteProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        bulkDeleteProducts.fulfilled,
        (state, action: PayloadAction<{ deleted: string[]; blocked: Array<{ id: string; reason: string }> }>) => {
          state.loading = false;
          const deletedSet = new Set((action.payload?.deleted ?? []).map(String));
          state.items = state.items.filter((p) => !deletedSet.has(String(p.id)));
          if (state.currentProduct?.id && deletedSet.has(String(state.currentProduct.id))) {
            state.currentProduct = null;
          }
        }
      )
      .addCase(bulkDeleteProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Bulk delete failed';
      })

      // bulkImportProducts
      .addCase(bulkImportProducts.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(bulkImportProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
        state.uploading = false;
        state.items = [...action.payload, ...state.items];
      })
      .addCase(bulkImportProducts.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload ?? action.error?.message ?? 'Bulk import error';
      });
  },
});

export const { setCurrentProduct, clearCurrentProduct, clearError } = productSlice.actions;

/** SELECTORS */
export const selectProducts = (state: any): Product[] => {
  const items = state.products?.items;
  if (Array.isArray(items)) return items;
  if (Array.isArray(items?.data)) return items.data;
  return [];
};
export const selectCurrentProduct = (state: any): Product | null => state.products?.currentProduct ?? null;
export const selectCategories = (state: any): Category[] => state.products?.categories ?? [];
export const selectCategoriesLoading = (state: any): boolean => !!state.products?.categoriesLoading;
export const selectProductsLoading = (state: any): boolean => !!state.products?.loading;
export const selectProductsUploading = (state: any): boolean => !!state.products?.uploading;
export const selectProductsError = (state: any): string | null => state.products?.error ?? null;

export default productSlice.reducer;

