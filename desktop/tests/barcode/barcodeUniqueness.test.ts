/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import type { InventoryItem } from '../../src/types/masters';
import {
  assertInventoryBarcodeIndex,
  BarcodeDuplicateError,
  findItemByBarcode,
  getAllBarcodesForItem,
} from '../../src/services/barcode/barcodeUniqueness';
import {
  isValidBarcodeFormat,
  isValidGstRate,
  parseAdditionalBarcodes,
  validateBarcodeList,
} from '../../src/services/barcode/barcodeValidation';

const item = (overrides: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'sku' | 'name'>): InventoryItem =>
  ({
    status: 'ACTIVE',
    unitId: 'u1',
    gstRate: 18,
    openingStock: 0,
    openingValue: 0,
    currentStock: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as InventoryItem;

describe('barcodeUniqueness multi-barcode', () => {
  const items = [
    item({
      id: 'a',
      sku: 'SKU-A',
      name: 'Item A',
      barcode: '8901000000012',
      additionalBarcodes: ['8901000000099'],
    }),
    item({ id: 'b', sku: 'SKU-B', name: 'Item B', barcode: '8901000000013' }),
  ];

  it('resolves additional barcodes to the same item', () => {
    expect(findItemByBarcode(items, '8901000000099')?.id).toBe('a');
    expect(getAllBarcodesForItem(items[0])).toEqual(['8901000000012', '8901000000099']);
  });

  it('rejects duplicate additional barcode across items in index', () => {
    const dupList = [
      ...items,
      item({
        id: 'c',
        sku: 'SKU-C',
        name: 'Item C',
        barcode: '8901000000099',
      }),
    ];
    expect(() => assertInventoryBarcodeIndex(dupList)).toThrow(BarcodeDuplicateError);
  });
});

describe('barcodeValidation', () => {
  it('parses additional barcodes from delimited text', () => {
    expect(parseAdditionalBarcodes('A1; B2\nC3')).toEqual(['A1', 'B2', 'C3']);
  });

  it('validates GST and barcode format', () => {
    expect(isValidGstRate(18)).toBe(true);
    expect(isValidGstRate(150)).toBe(false);
    expect(isValidBarcodeFormat('8901000000012')).toBe(true);
    expect(isValidBarcodeFormat('AB')).toBe(false);
    expect(validateBarcodeList(['8901000000012', '8901000000012'])).toMatch(/Duplicate/);
  });
});
