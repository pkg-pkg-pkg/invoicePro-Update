import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import type { VoucherEwayBill } from '../../types/ewayBill';
import { EwayBillStatusChip } from './EwayBillStatusChip';
import { getEwayStatusLabel } from '../../services/ewayBillService';

type Props = {
  eway?: VoucherEwayBill | null;
  onEdit?: () => void;
  onPrint?: () => void;
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

export function EwayBillInfoPanel({ eway, onEdit, onPrint }: Props) {
  if (!eway || eway.status === 'NOT_REQUIRED') return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight={800}>
            E-Way Bill Information
          </Typography>
          <EwayBillStatusChip eway={eway} compact />
        </Stack>
        <Divider />
        <InfoRow label="Status" value={getEwayStatusLabel(eway.status)} />
        <InfoRow label="EWB Number" value={eway.ewayBillNo} />
        <InfoRow label="Transporter" value={eway.transporterName} />
        <InfoRow label="Transporter GSTIN" value={eway.transporterGstin} />
        <InfoRow label="Vehicle" value={eway.vehicleNo} />
        <InfoRow label="Distance" value={eway.distanceKm != null ? `${eway.distanceKm} KM` : undefined} />
        <InfoRow label="Mode" value={eway.transportMode} />
        <InfoRow label="Dispatch From" value={eway.dispatchFrom} />
        <InfoRow label="Dispatch To" value={eway.dispatchTo} />
        {eway.remarks ? (
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Remarks
            </Typography>
            <Typography variant="body2">{eway.remarks}</Typography>
          </Box>
        ) : null}
        <Stack direction="row" spacing={1}>
          {onEdit ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Edit EWB
            </Button>
          ) : null}
          {onPrint ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={onPrint}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Print EWB Details
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
