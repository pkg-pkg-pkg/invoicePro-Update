import ExcelJS from 'exceljs';
import type { Party, PartyInput, PartyType } from '../../types/party';

export const PARTY_BULK_SHEET = 'Parties';
export const PARTY_EXCEL_HEADERS = [
  'name',
  'mobile',
  'partyType',
  'gstin',
  'address',
  'state',
  'pincode',
  'email',
  'whatsapp',
  'openingBalance',
] as const;

function normHeader(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function parsePartyType(v: unknown): PartyType {
  const s = str(v).toUpperCase();
  if (s === 'BUYER' || s === 'CUSTOMER') return 'BUYER';
  if (s === 'SUPPLIER' || s === 'VENDOR') return 'SUPPLIER';
  if (s === 'BOTH') return 'BOTH';
  return 'BUYER';
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

function rowObjectFromWorksheet(
  ws: ExcelJS.Worksheet,
  colMap: Map<number, string>,
  rowIndex: number
): Record<string, unknown> | null {
  const row = ws.getRow(rowIndex);
  const o: Record<string, unknown> = {};
  let any = false;
  colMap.forEach((headerKey, colNumber) => {
    const cell = row.getCell(colNumber);
    const raw = cell.value;
    let val: unknown;
    if (raw === null || raw === undefined) {
      val = '';
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      val = raw;
    } else if (typeof raw === 'object' && raw !== null && 'result' in raw) {
      val = (raw as { result?: unknown }).result ?? '';
    } else {
      val = cell.text?.trim() ?? str(raw);
    }
    if (val !== '' && val !== null && val !== undefined) any = true;
    o[headerKey] = val;
  });
  return any ? o : null;
}

function applyPartyAliases(o: Record<string, unknown>): void {
  const copy = (target: string, sources: string[]) => {
    if (str(o[target])) return;
    for (const s of sources) {
      const v = str(o[s]);
      if (v) {
        o[target] = v;
        return;
      }
    }
  };
  copy('name', ['partyname', 'customername', 'suppliername', 'ledgername']);
  copy('mobile', ['phone', 'mobileno', 'contact', 'contactnumber']);
  copy('gstin', ['gst', 'gstnumber']);
  copy('address', ['addressline1', 'addr']);
  copy('state', ['province']);
  copy('parttype', ['type', 'partytype']);
}

function buildPartyInput(o: Record<string, unknown>): PartyInput {
  return {
    name: str(o['name']),
    mobile: str(o['mobile']),
    gstin: str(o['gstin']) || undefined,
    address: str(o['address']) || undefined,
    state: str(o['state']) || undefined,
    pincode: str(o['pincode']) || undefined,
    partyType: parsePartyType(o['partytype'] ?? o['parttype']),
    email: str(o['email']) || undefined,
    whatsapp: str(o['whatsapp']) || undefined,
    openingBalance: num(o['openingbalance']) ?? 0,
  };
}

export async function parsePartiesFile(file: File): Promise<PartyInput[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
    const rows = parsed as Record<string, unknown>[];
    const out = rows.map((r) => buildPartyInput(r));
    return out.filter((x) => x.name && x.mobile);
  }

  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel file has no worksheet');

  const headerRow = ws.getRow(1);
  const colMap = new Map<number, string>();
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = normHeader(cell.text ?? String(cell.value ?? ''));
    if (key) colMap.set(colNumber, key);
  });
  if (!colMap.size) throw new Error('Header row missing');

  const out: PartyInput[] = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    const o = rowObjectFromWorksheet(ws, colMap, r);
    if (!o) continue;
    applyPartyAliases(o);
    const party = buildPartyInput(o);
    if (party.name && party.mobile) out.push(party);
  }
  if (!out.length) throw new Error('No valid party rows found');
  return out;
}

export function mergePartyByMobileOrName(existing: Party[], incoming: PartyInput): Party | undefined {
  const m = incoming.mobile.trim();
  const n = incoming.name.trim().toLowerCase();
  return existing.find(
    (p) => p.mobile.trim() === m || p.name.trim().toLowerCase() === n
  );
}

export async function exportPartyTemplateExcel(existing: Party[] = []): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(PARTY_BULK_SHEET);
  ws.addRow([...PARTY_EXCEL_HEADERS]);

  if (existing.length) {
    existing.forEach((p) => {
      ws.addRow([
        p.name,
        p.mobile,
        p.partyType,
        p.gstin ?? '',
        p.address ?? '',
        p.state ?? '',
        p.pincode ?? '',
        p.email ?? '',
        p.whatsapp ?? '',
        p.openingBalance ?? 0,
      ]);
    });
  } else {
    ws.addRow([
      'Sample Customer',
      '9876543210',
      'BUYER',
      '',
      'Main Road',
      'Jharkhand',
      '834001',
      '',
      '',
      0,
    ]);
    ws.addRow([
      'Sample Supplier',
      '9876500000',
      'SUPPLIER',
      '',
      '',
      'Jharkhand',
      '',
      '',
      '',
      0,
    ]);
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
