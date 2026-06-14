import { formatEan13, composeEan13Body } from './barcodeValue';

import {

  readInventorySettings,

  writeInventorySettings,

} from '../inventory/lowStockSettings';

import { inventoryItemService } from '../masters/inventoryItemService';

import { getItemScanCodes } from './barcodeLookup';



const MAX_ATTEMPTS = 50_000;



function collectUsedCodes(items: Awaited<ReturnType<typeof inventoryItemService.list>>): Set<string> {

  const used = new Set<string>();

  for (const item of items) {

    for (const code of getItemScanCodes(item)) {

      used.add(code.toLowerCase());

    }

    const bc = String(item.barcode ?? '').trim();

    if (bc) used.add(bc.toLowerCase());

  }

  return used;

}



function maxSequenceForPrefix(

  items: Awaited<ReturnType<typeof inventoryItemService.list>>,

  prefix: string

): number {

  const p = prefix.replace(/\D/g, '').slice(0, 7);

  let max = 0;

  for (const item of items) {

    const digits = String(item.barcode ?? '').replace(/\D/g, '');

    if (digits.length !== 13 || !digits.startsWith(p)) continue;

    const seq = Number(digits.slice(7, 12));

    if (Number.isFinite(seq) && seq > max) max = seq;

  }

  return max;

}



/** Allocate unique 13-digit EAN-13 numeric barcode (never from SKU). */

export async function generateUniqueNumericBarcode(): Promise<string> {

  const settings = readInventorySettings();

  const prefix = settings.barcodePrefix ?? '8901000';



  const items = await inventoryItemService.list({ includeInactive: true });

  const used = collectUsedCodes(items);



  const seededMax = maxSequenceForPrefix(items, prefix);

  let seq = Math.max(1, settings.barcodeSequence ?? 1, seededMax + 1);



  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {

    const candidate = formatEan13(prefix, seq);

    if (!used.has(candidate.toLowerCase())) {

      writeInventorySettings({ barcodeSequence: seq + 1 });

      return candidate;

    }

    seq += 1;

  }



  throw new Error('Unable to allocate a unique numeric barcode. Try again or enter manually.');

}



/** Peek next barcode without advancing sequence (preview only). */

export function previewNextNumericBarcode(prefix: string, sequence: number): string {

  return formatEan13(prefix, sequence);

}



export { composeEan13Body };


