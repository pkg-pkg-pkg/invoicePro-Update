import { Chip } from '@mui/material';
import type { SalesDocumentStatus } from '../../types/salesDocuments';

const STATUS_CONFIG: Record<
  SalesDocumentStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  DRAFT: { label: 'Draft', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  SENT: { label: 'Sent', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  APPROVED: { label: 'Approved', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  PARTIALLY_PAID: { label: 'Partially Paid', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  PAID: { label: 'Paid', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  OVERDUE: { label: 'Overdue', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  CANCELLED: { label: 'Cancelled', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  ACCEPTED: { label: 'Accepted', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  DECLINED: { label: 'Declined', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  EXPIRED: { label: 'Expired', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  CONFIRMED: { label: 'Confirmed', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  IN_PROGRESS: { label: 'In Progress', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  PARTIALLY_DISPATCHED: { label: 'Partially Dispatched', bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  DISPATCHED: { label: 'Dispatched', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  CLOSED: { label: 'Closed', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  PAYMENT_RECEIVED: { label: 'Payment Received', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  CONVERTED: { label: 'Converted', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
};

type Props = {
  status: SalesDocumentStatus;
  size?: 'small' | 'medium';
};

export function SalesStatusBadge({ status, size = 'small' }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <Chip
      label={cfg.label}
      size={size}
      sx={{
        height: size === 'small' ? 24 : 28,
        fontWeight: 700,
        fontSize: size === 'small' ? '0.6875rem' : '0.75rem',
        letterSpacing: '0.02em',
        bgcolor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        borderRadius: '6px',
      }}
    />
  );
}

export const SALES_STATUS_FILTER_OPTIONS: { value: SalesDocumentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
