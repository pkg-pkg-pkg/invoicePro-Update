// src/store/slices/productSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  id: string;
  name: string;
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

/** FETCH ALL PRODUCTS */
export const fetchProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  'products/fetchProducts',
  async (_, thunkAPI) => {
    try {
      const res = await fetch('/api/products');
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

/** FETCH SINGLE PRODUCT (by id) - required by ProductForm.tsx */
export const fetchProduct = createAsyncThunk<Product, string, { rejectValue: string }>(
  'products/fetchProduct',
  async (id, thunkAPI) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
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
      const res = await fetch('/api/categories');
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
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
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
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
export const selectProducts = (state: any): Product[] => state.products?.items ?? [];
export const selectCurrentProduct = (state: any): Product | null => state.products?.currentProduct ?? null;
export const selectCategories = (state: any): Category[] => state.products?.categories ?? [];
export const selectCategoriesLoading = (state: any): boolean => !!state.products?.categoriesLoading;
export const selectProductsLoading = (state: any): boolean => !!state.products?.loading;
export const selectProductsUploading = (state: any): boolean => !!state.products?.uploading;
export const selectProductsError = (state: any): string | null => state.products?.error ?? null;

export default productSlice.reducer;
