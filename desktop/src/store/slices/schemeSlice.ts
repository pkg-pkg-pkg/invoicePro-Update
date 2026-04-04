import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import schemeService, { Scheme } from '../../services/schemeService';

export interface SchemeState {
  items: Scheme[];
  selectedScheme: Scheme | null;
  applicableSchemes: Record<string, Scheme[]>; // Changed from Map to Record
  loading: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  detecting: boolean;
  error: string | null;
  ignoredSchemes: string[]; // Changed from Set to string array
  isEnabled: boolean; // Toggle scheme on/off
  // Smart Scheme Engine fields
  retailerDashboard: any[];
  overdueRetailers: any[];
  loadingDashboard: boolean;
  loadingOverdue: boolean;
  marginData: Record<string, any>; // Real-time margin data
}

const initialState: SchemeState = {
  items: [],
  selectedScheme: null,
  applicableSchemes: {}, // Changed from Map to plain object
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  detecting: false,
  error: null,
  ignoredSchemes: [], // Changed from Set to array
  isEnabled: true,
  // Smart Scheme Engine fields
  retailerDashboard: [],
  overdueRetailers: [],
  loadingDashboard: false,
  loadingOverdue: false,
  marginData: {}, // Real-time margin data
};

const SCHEMES_STORAGE_KEY = 'pve_schemes';
const IGNORED_SCHEMES_STORAGE_KEY = 'pve_ignored_schemes';

const getStoredSchemes = (): Scheme[] => {
  try {
    const raw = localStorage.getItem(SCHEMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Scheme[]) : [];
  } catch {
    return [];
  }
};

const saveStoredSchemes = (schemes: Scheme[]) => {
  localStorage.setItem(SCHEMES_STORAGE_KEY, JSON.stringify(schemes));
};

const getStoredIgnoredSchemes = (): string[] => {
  try {
    const raw = localStorage.getItem(IGNORED_SCHEMES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredIgnoredSchemes = (ignored: string[]) => {
  localStorage.setItem(
    IGNORED_SCHEMES_STORAGE_KEY,
    JSON.stringify(ignored)
  );
};

// Async Thunks
export const fetchSchemes = createAsyncThunk<
  Scheme[],
  { companyId: string },
  { rejectValue: string }
>('schemes/fetchSchemes', async ({ companyId }, thunkAPI) => {
  try {
    const schemes = await schemeService.getSchemes(companyId);
    saveStoredSchemes(schemes);
    return schemes;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch schemes');
  }
});

export const createScheme = createAsyncThunk<
  Scheme,
  {
    companyId: string;
    name: string;
    schemeType: string;
    schemeDetails: Record<string, any>;
    appliesTo: string;
    startDate: Date;
    endDate: Date;
    productIds: string[];
    isActive: boolean;
  },
  { rejectValue: string }
>('schemes/createScheme', async (payload, thunkAPI) => {
  try {
    const scheme = await schemeService.createScheme(payload);
    const schemes = (thunkAPI.getState() as any).schemes?.items ?? [];
    saveStoredSchemes(Array.isArray(schemes) ? [...schemes, scheme] : [scheme]);
    return scheme;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create scheme');
  }
});

export const updateScheme = createAsyncThunk<
  Scheme,
  {
    schemeId: string;
    data: Partial<Scheme> & { productIds?: string[] };
  },
  { rejectValue: string }
>('schemes/updateScheme', async ({ schemeId, data }, thunkAPI) => {
  try {
    const scheme = await schemeService.updateScheme(schemeId, data);
    const schemes = (thunkAPI.getState() as any).schemes?.items ?? [];
    const updated = Array.isArray(schemes) 
      ? schemes.map((s: Scheme) => (s.id === schemeId ? scheme : s))
      : [scheme];
    saveStoredSchemes(updated);
    return scheme;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update scheme');
  }
});

export const deleteScheme = createAsyncThunk<
  string,
  { schemeId: string },
  { rejectValue: string }
>('schemes/deleteScheme', async ({ schemeId }, thunkAPI) => {
  try {
    await schemeService.deleteScheme(schemeId);
    const schemes = (thunkAPI.getState() as any).schemes?.items ?? [];
    const updated = Array.isArray(schemes) 
      ? schemes.filter((s: Scheme) => s.id !== schemeId)
      : [];
    saveStoredSchemes(updated);
    return schemeId;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete scheme');
  }
});

export const detectSchemesForProduct = createAsyncThunk<
  { productId: string; schemes: Scheme[] },
  {
    companyId: string;
    productId: string;
    invoiceDate: Date;
    appliesTo?: 'SALES' | 'PURCHASE';
  },
  { rejectValue: string }
>(
  'schemes/detectSchemesForProduct',
  async ({ companyId, productId, invoiceDate, appliesTo }, thunkAPI) => {
    try {
      const schemes = await schemeService.detectSchemes(
        companyId,
        productId,
        invoiceDate,
        appliesTo
      );
      return { productId, schemes };
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? 'Failed to detect schemes'
      );
    }
  }
);

// Smart Scheme Engine Thunks
export const createSmartScheme = createAsyncThunk<
  Scheme,
  {
    companyId: string;
    name: string;
    giftCost: number;
    marginBurnPercentage: number;
    paymentTerms: '7_days' | '15_days' | '30_days' | 'COD';
    startDate: Date;
    endDate: Date;
    productIds: string[];
    appliesTo?: 'SALES' | 'PURCHASE' | 'BOTH';
  },
  { rejectValue: string }
>('schemes/createSmartScheme', async (schemeData, thunkAPI) => {
  try {
    const scheme = await schemeService.createSmartScheme(schemeData);
    return scheme;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create smart scheme');
  }
});

export const fetchRetailerDashboard = createAsyncThunk<
  any[],
  string,
  { rejectValue: string }
>('schemes/fetchRetailerDashboard', async (retailerId, thunkAPI) => {
  try {
    const dashboard = await schemeService.getRetailerSchemeDashboard(retailerId);
    return dashboard;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch retailer dashboard');
  }
});

export const fetchOverdueRetailers = createAsyncThunk<
  any[],
  void,
  { rejectValue: string }
>('schemes/fetchOverdueRetailers', async (_, thunkAPI) => {
  try {
    const retailers = await schemeService.getOverdueAndAtRiskRetailers();
    return retailers;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to fetch overdue retailers');
  }
});

export const updateSchemeProgress = createAsyncThunk<
  any,
  {
    schemeId: string;
    retailerId: string;
    invoiceAmount: number;
    paymentReceived: number;
    paymentPending: number;
  },
  { rejectValue: string }
>('schemes/updateSchemeProgress', async (progressData, thunkAPI) => {
  try {
    const result = await schemeService.updateSchemeProgress(progressData);
    return result;
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update scheme progress');
  }
});

export const freezeScheme = createAsyncThunk<
  void,
  { schemeId: string; retailerId: string; reason: string },
  { rejectValue: string }
>('schemes/freezeScheme', async ({ schemeId, retailerId, reason }, thunkAPI) => {
  try {
    await schemeService.freezeScheme(schemeId, retailerId, reason);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to freeze scheme');
  }
});

export const releaseScheme = createAsyncThunk<
  void,
  { schemeId: string; retailerId: string },
  { rejectValue: string }
>('schemes/releaseScheme', async ({ schemeId, retailerId }, thunkAPI) => {
  try {
    await schemeService.releaseScheme(schemeId, retailerId);
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err?.message ?? 'Failed to release scheme');
  }
});

// Slice
const schemeSlice = createSlice({
  name: 'schemes',
  initialState,
  reducers: {
    setSelectedScheme: (state, action: PayloadAction<Scheme | null>) => {
      state.selectedScheme = action.payload;
    },
    ignoreScheme: (state, action: PayloadAction<string>) => {
      // Format: "productId-schemeId"
      if (!state.ignoredSchemes.includes(action.payload)) {
        state.ignoredSchemes.push(action.payload);
      }
      saveStoredIgnoredSchemes(state.ignoredSchemes);
    },
    clearIgnoredSchemes: (state) => {
      state.ignoredSchemes = [];
      localStorage.removeItem(IGNORED_SCHEMES_STORAGE_KEY);
    },
    clearError: (state) => {
      state.error = null;
    },
    setApplicableSchemes: (
      state,
      action: PayloadAction<Record<string, Scheme[]>>
    ) => {
      state.applicableSchemes = action.payload;
    },
    toggleSchemes: (state, action: PayloadAction<boolean>) => {
      state.isEnabled = action.payload;
      // Reset applicable schemes when toggling OFF
      if (!action.payload) {
        state.applicableSchemes = {};
        state.selectedScheme = null;
      }
    },
    clearApplicableSchemes: (state) => {
      state.applicableSchemes = {};
    },
    loadSchemesFromStorage: (state) => {
      const stored = getStoredSchemes();
      state.items = stored;
      state.ignoredSchemes = getStoredIgnoredSchemes();
    },
    // Smart Scheme Engine reducers
    updateMarginData: (state, action: PayloadAction<Record<string, any>>) => {
      state.marginData = { ...state.marginData, ...action.payload };
    },
    clearRetailerDashboard: (state) => {
      state.retailerDashboard = [];
    },
    clearOverdueRetailers: (state) => {
      state.overdueRetailers = [];
    },
  },
  extraReducers: (builder) => {
    // fetchSchemes
    builder
      .addCase(fetchSchemes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSchemes.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchSchemes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch schemes';
        // Fall back to stored schemes
        state.items = getStoredSchemes();
      });

    // createScheme
    builder
      .addCase(createScheme.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createScheme.fulfilled, (state, action) => {
        state.creating = false;
        state.items.push(action.payload);
      })
      .addCase(createScheme.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload || 'Failed to create scheme';
      });

    // updateScheme
    builder
      .addCase(updateScheme.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateScheme.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.items.findIndex((s) => s.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateScheme.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload || 'Failed to update scheme';
      });

    // deleteScheme
    builder
      .addCase(deleteScheme.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteScheme.fulfilled, (state, action) => {
        state.deleting = false;
        state.items = state.items.filter((s) => s.id !== action.payload);
      })
      .addCase(deleteScheme.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload || 'Failed to delete scheme';
      });

    // detectSchemesForProduct
    builder
      .addCase(detectSchemesForProduct.pending, (state) => {
        state.detecting = true;
        state.error = null;
      })
      .addCase(detectSchemesForProduct.fulfilled, (state, action) => {
        state.detecting = false;
        const { productId, schemes } = action.payload;
        // Always ensure schemes is an array and use plain object assignment
        state.applicableSchemes[productId] = schemes;
      })
      .addCase(detectSchemesForProduct.rejected, (state, action) => {
        state.detecting = false;
        state.error = action.payload || 'Failed to detect schemes';
        // Don't leave undefined - keep it as empty object
      });

    // Smart Scheme Engine extraReducers
    builder
      // createSmartScheme
      .addCase(createSmartScheme.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createSmartScheme.fulfilled, (state, action) => {
        state.creating = false;
        state.items.push(action.payload);
      })
      .addCase(createSmartScheme.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload || 'Failed to create smart scheme';
      })

      // fetchRetailerDashboard
      .addCase(fetchRetailerDashboard.pending, (state) => {
        state.loadingDashboard = true;
        state.error = null;
      })
      .addCase(fetchRetailerDashboard.fulfilled, (state, action) => {
        state.loadingDashboard = false;
        state.retailerDashboard = action.payload;
      })
      .addCase(fetchRetailerDashboard.rejected, (state, action) => {
        state.loadingDashboard = false;
        state.error = action.payload || 'Failed to fetch retailer dashboard';
      })

      // fetchOverdueRetailers
      .addCase(fetchOverdueRetailers.pending, (state) => {
        state.loadingOverdue = true;
        state.error = null;
      })
      .addCase(fetchOverdueRetailers.fulfilled, (state, action) => {
        state.loadingOverdue = false;
        state.overdueRetailers = action.payload;
      })
      .addCase(fetchOverdueRetailers.rejected, (state, action) => {
        state.loadingOverdue = false;
        state.error = action.payload || 'Failed to fetch overdue retailers';
      })

      // updateSchemeProgress
      .addCase(updateSchemeProgress.pending, (state) => {
        state.error = null;
      })
      .addCase(updateSchemeProgress.fulfilled, (state, action) => {
        // Update the relevant scheme in retailer dashboard if present
        const updatedProgress = action.payload;
        const retailerIndex = state.retailerDashboard.findIndex(
          (scheme: any) => scheme.id === updatedProgress.schemeId
        );
        if (retailerIndex !== -1) {
          state.retailerDashboard[retailerIndex] = {
            ...state.retailerDashboard[retailerIndex],
            ...updatedProgress
          };
        }
      })
      .addCase(updateSchemeProgress.rejected, (state, action) => {
        state.error = action.payload || 'Failed to update scheme progress';
      })

      // freezeScheme
      .addCase(freezeScheme.pending, (state) => {
        state.error = null;
      })
      .addCase(freezeScheme.fulfilled, (state, action) => {
        // Update scheme status to frozen in both items and retailer dashboard
        const { schemeId, retailerId } = action.meta.arg;
        
        // Update main schemes list
        const schemeIndex = state.items.findIndex((scheme: any) => scheme.id === schemeId);
        if (schemeIndex !== -1) {
          state.items[schemeIndex] = {
            ...state.items[schemeIndex],
            isFrozen: true
          };
        }
        
        // Update retailer dashboard
        const retailerIndex = state.retailerDashboard.findIndex(
          (scheme: any) => scheme.id === schemeId && scheme.retailerId === retailerId
        );
        if (retailerIndex !== -1) {
          state.retailerDashboard[retailerIndex] = {
            ...state.retailerDashboard[retailerIndex],
            status: 'red',
            isFrozen: true
          };
        }
      })
      .addCase(freezeScheme.rejected, (state, action) => {
        state.error = action.payload || 'Failed to freeze scheme';
      })

      // releaseScheme
      .addCase(releaseScheme.pending, (state) => {
        state.error = null;
      })
      .addCase(releaseScheme.fulfilled, (state, action) => {
        // Update scheme status to released (green) in retailer dashboard
        const { schemeId, retailerId } = action.meta.arg;
        
        const retailerIndex = state.retailerDashboard.findIndex(
          (scheme: any) => scheme.id === schemeId && scheme.retailerId === retailerId
        );
        if (retailerIndex !== -1) {
          state.retailerDashboard[retailerIndex] = {
            ...state.retailerDashboard[retailerIndex],
            status: 'green',
            isReleased: true
          };
        }
      })
      .addCase(releaseScheme.rejected, (state, action) => {
        state.error = action.payload || 'Failed to release scheme';
      });
  },
});

export const {
  setSelectedScheme,
  ignoreScheme,
  clearIgnoredSchemes,
  clearError,
  setApplicableSchemes,
  toggleSchemes,
  clearApplicableSchemes,
  loadSchemesFromStorage,
} = schemeSlice.actions;

export default schemeSlice.reducer;
