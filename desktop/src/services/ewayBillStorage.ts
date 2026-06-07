import { companyScopedKey } from '../utils/companyStorage';
import { readList, writeList } from './masters/storageHelpers';

const STORAGE_KEY = companyScopedKey('pve_eway_bills');

export interface EwayBillRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  ewayBillNumber: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

async function readRecords(): Promise<EwayBillRecord[]> {
  return readList<EwayBillRecord>(STORAGE_KEY);
}

export async function getEwayBillRecord(invoiceId: string): Promise<EwayBillRecord | null> {
  const rows = await readRecords();
  return rows.find((r) => r.invoiceId === invoiceId) ?? null;
}

export async function listEwayBillRecords(): Promise<EwayBillRecord[]> {
  return readRecords();
}

export async function saveEwayBillRecord(record: Omit<EwayBillRecord, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<EwayBillRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const rows = await readRecords();
  const now = new Date().toISOString();
  const existing = rows.find((r) => r.invoiceId === record.invoiceId);
  const nextRecord: EwayBillRecord = {
    id: record.id ?? record.invoiceId,
    invoiceId: record.invoiceId,
    invoiceNumber: record.invoiceNumber,
    ewayBillNumber: record.ewayBillNumber,
    generatedAt: record.generatedAt,
    createdAt: record.createdAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = rows.filter((r) => r.invoiceId !== record.invoiceId);
  next.push(nextRecord);
  await writeList(STORAGE_KEY, next);
}

export function buildLocalEwayBillNumber(): string {
  return `EWB${Date.now()}`;
}
