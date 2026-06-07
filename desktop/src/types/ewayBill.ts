export type EwayBillStatus = 'NOT_REQUIRED' | 'PENDING' | 'MANUAL' | 'GENERATED';

export type TransportMode = 'Road' | 'Rail' | 'Air' | 'Ship';

export type EwayBillProvider = 'manual' | 'masters_india' | 'cleartax';

/** E-Way Bill details stored on sales invoice (voucher). */
export interface VoucherEwayBill {
  ewayBillNo?: string;
  ewayBillDate?: string;
  transporterName?: string;
  transporterGstin?: string;
  vehicleNo?: string;
  transportMode?: TransportMode;
  dispatchFrom?: string;
  dispatchTo?: string;
  distanceKm?: number;
  remarks?: string;
  status: EwayBillStatus;
}

export interface EwayBillFormValues {
  ewayBillNo: string;
  transporterName: string;
  transporterGstin: string;
  vehicleNo: string;
  transportMode: TransportMode;
  dispatchFrom: string;
  dispatchTo: string;
  distanceKm: string;
  remarks: string;
}

export const TRANSPORT_MODES: TransportMode[] = ['Road', 'Rail', 'Air', 'Ship'];

export const DEFAULT_EWAY_THRESHOLD = 50_000;
