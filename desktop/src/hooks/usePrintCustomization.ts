import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../store/slices/authSlice';

export interface PrintSettings {
  // Paper Settings
  paperSize: 'A4' | 'A5' | 'A3' | 'Letter' | 'Legal' | 'THERMAL_80' | 'THERMAL_58';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  // Layout Settings
  showLogo: boolean;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  logoSize: 'small' | 'medium' | 'large';

  // Header Settings
  showHeader: boolean;
  headerStyle: 'minimal' | 'detailed' | 'boxed';
  showCompanyName: boolean;
  showCompanyAddress: boolean;
  showCompanyContact: boolean;
  showGSTIN: boolean;

  // Content Settings
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'Arial' | 'Times New Roman' | 'Calibri' | 'Verdana';
  lineHeight: number;

  // Color Settings
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;

  // Table Settings
  tableStyle: 'minimal' | 'bordered' | 'striped' | 'modern';
  showTableHeaders: boolean;
  tableHeaderStyle: 'bold' | 'uppercase' | 'normal';

  // Footer Settings
  showFooter: boolean;
  footerStyle: 'minimal' | 'detailed';
  showTermsAndConditions: boolean;
  showSignature: boolean;
  signaturePosition: 'left' | 'center' | 'right';

  // Document Specific Settings
  showQRCode: boolean;
  qrCodePosition: 'top-right' | 'bottom-right' | 'bottom-left';
  showBarCode: boolean;
  barCodePosition: 'top' | 'bottom';
  // Print Quality
  printQuality: 'draft' | 'normal' | 'high';
  duplexPrinting: boolean;
  pageBreak: 'auto' | 'avoid' | 'always';

  // Advanced Settings
  customCSS: string;
  showPageNumbers: boolean;

  // Invoice-specific advanced settings
  showHSN: boolean;
  showItemDescription: boolean;
  showCustomerGSTIN: boolean;
  showBankDetails: boolean;
  showNotes: boolean;
  showTerms: boolean;
  taxDisplayMode: 'separate' | 'combined' | 'detailed';
  showTaxBreakup: boolean;
  watermarkText: string;
  showWatermark: boolean;
  watermarkOpacity: number;
  duplicateCopy: boolean;
  showBarcode: boolean;
  signatureText: string;
  footerText: string;
  cellPadding: number;
}

export interface DocumentTypeSettings {
  invoice: PrintSettings;
  payment: PrintSettings;
  receipt: PrintSettings;
  quotation: PrintSettings;
  purchaseOrder: PrintSettings;
  deliveryNote: PrintSettings;
  creditNote: PrintSettings;
  debitNote: PrintSettings;
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  // Paper Settings
  paperSize: 'A4',
  orientation: 'portrait',
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },

  // Layout Settings
  showLogo: true,
  logoPosition: 'top-left',
  logoSize: 'medium',

  // Header Settings
  showHeader: true,
  headerStyle: 'detailed',
  showCompanyName: true,
  showCompanyAddress: true,
  showCompanyContact: true,
  showGSTIN: true,

  // Content Settings
  fontSize: 'medium',
  fontFamily: 'Arial',
  lineHeight: 1.4,

  // Color Settings
  primaryColor: '#1976d2',
  secondaryColor: '#424242',
  textColor: '#000000',
  backgroundColor: '#ffffff',

  // Table Settings
  tableStyle: 'bordered',
  showTableHeaders: true,
  tableHeaderStyle: 'bold',

  // Footer Settings
  showFooter: true,
  footerStyle: 'detailed',
  showTermsAndConditions: true,
  showSignature: true,
  signaturePosition: 'right',

  // Document Specific Settings
  showQRCode: false,
  qrCodePosition: 'bottom-right',
  showBarCode: false,
  barCodePosition: 'bottom',

  // Print Quality
  printQuality: 'normal',
  duplexPrinting: false,
  pageBreak: 'auto',

  // Advanced Settings
  customCSS: '',
  showPageNumbers: false,

  // Invoice-specific advanced settings
  showHSN: true,
  showItemDescription: false,
  showCustomerGSTIN: true,
  showBankDetails: true,
  showNotes: true,
  showTerms: true,
  taxDisplayMode: 'separate',
  showTaxBreakup: true,
  watermarkText: '',
  showWatermark: false,
  watermarkOpacity: 0.1,
  duplicateCopy: false,
  showBarcode: false,
  signatureText: 'Authorized Signatory',
  footerText: 'This is a computer generated invoice',
  cellPadding: 8,
};

const DEFAULT_DOCUMENT_SETTINGS: DocumentTypeSettings = {
  invoice: { ...DEFAULT_PRINT_SETTINGS },
  payment: { ...DEFAULT_PRINT_SETTINGS },
  receipt: { ...DEFAULT_PRINT_SETTINGS },
  quotation: { ...DEFAULT_PRINT_SETTINGS },
  purchaseOrder: { ...DEFAULT_PRINT_SETTINGS },
  deliveryNote: { ...DEFAULT_PRINT_SETTINGS },
  creditNote: { ...DEFAULT_PRINT_SETTINGS },
  debitNote: { ...DEFAULT_PRINT_SETTINGS },
};

const STORAGE_KEY_PREFIX = 'pve_print_settings';

export const usePrintCustomization = () => {
  const user = useSelector(selectAuthUser);
  const userId = user?.id || 'guest';
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}_${userId}`;

  const [documentSettings, setDocumentSettings] = useState<DocumentTypeSettings>(DEFAULT_DOCUMENT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new settings
        const merged: DocumentTypeSettings = { ...DEFAULT_DOCUMENT_SETTINGS };

        Object.keys(DEFAULT_DOCUMENT_SETTINGS).forEach(docType => {
          if (parsed[docType]) {
            merged[docType as keyof DocumentTypeSettings] = {
              ...DEFAULT_DOCUMENT_SETTINGS[docType as keyof DocumentTypeSettings],
              ...parsed[docType],
            };
          }
        });

        setDocumentSettings(merged);
      }
    } catch (error) {
      console.warn('Failed to load print settings:', error);
    }
    setIsLoaded(true);
  }, [userId, STORAGE_KEY]);

  // Save settings to localStorage
  const saveSettings = (settings: DocumentTypeSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setDocumentSettings(settings);
    } catch (error) {
      console.warn('Failed to save print settings:', error);
    }
  };

  // Update settings for a specific document type
  const updateDocumentSettings = (documentType: keyof DocumentTypeSettings, settings: Partial<PrintSettings>) => {
    const updated = {
      ...documentSettings,
      [documentType]: {
        ...documentSettings[documentType],
        ...settings,
      },
    };
    saveSettings(updated);
  };

  // Reset settings for a specific document type
  const resetDocumentSettings = (documentType: keyof DocumentTypeSettings) => {
    const updated = {
      ...documentSettings,
      [documentType]: { ...DEFAULT_PRINT_SETTINGS },
    };
    saveSettings(updated);
  };

  // Reset all settings
  const resetAllSettings = () => {
    saveSettings(DEFAULT_DOCUMENT_SETTINGS);
  };

  // Get settings for a specific document type
  const getDocumentSettings = (documentType: keyof DocumentTypeSettings): PrintSettings => {
    return documentSettings[documentType];
  };

  // Export settings as JSON
  const exportSettings = (): string => {
    return JSON.stringify(documentSettings, null, 2);
  };

  // Import settings from JSON
  const importSettings = (jsonString: string): boolean => {
    try {
      const imported = JSON.parse(jsonString);
      // Validate structure
      if (typeof imported === 'object' && imported !== null) {
        const merged: DocumentTypeSettings = { ...DEFAULT_DOCUMENT_SETTINGS };

        Object.keys(DEFAULT_DOCUMENT_SETTINGS).forEach(docType => {
          if (imported[docType]) {
            merged[docType as keyof DocumentTypeSettings] = {
              ...DEFAULT_DOCUMENT_SETTINGS[docType as keyof DocumentTypeSettings],
              ...imported[docType],
            };
          }
        });

        saveSettings(merged);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Failed to import print settings:', error);
      return false;
    }
  };

  return {
    documentSettings,
    isLoaded,
    updateDocumentSettings,
    resetDocumentSettings,
    resetAllSettings,
    getDocumentSettings,
    exportSettings,
    importSettings,
  };
};
