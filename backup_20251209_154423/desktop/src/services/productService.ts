import api from './api';

export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  hsnCode?: string;
  sacCode?: string;
  unit: string;
  uqc?: string;
  purchasePrice: number;
  salePrice: number;
  mrp?: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  openingStock: number;
  currentStock: number;
  lowStockAlert: number;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  images?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductsResponse {
  data: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Category {
  id: string;
  name: string;
}

export const productService = {
  async getProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.category) params.append('category', filters.category);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get<ProductsResponse>(`/products?${params.toString()}`);
    return response.data;
  },

  async getProduct(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  async getProductByBarcode(barcode: string): Promise<Product> {
    const response = await api.get<Product>(`/products/barcode/${barcode}`);
    return response.data;
  },

  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await api.post<Product>('/products', data);
    return response.data;
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
  },

  async deleteProduct(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async getLowStockProducts(): Promise<Product[]> {
    const response = await api.get<Product[]>('/products/low-stock');
    return response.data;
  },

  async getCategories(): Promise<Category[]> {
    const response = await api.get<Category[]>('/products/categories');
    return response.data;
  },

  async bulkUpdateStock(updates: Array<{ id: string; currentStock: number }>): Promise<void> {
    await api.post('/products/bulk-update-stock', { updates });
  },
};

