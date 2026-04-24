import { FC } from 'react';
import { Box, Card, CardContent, Chip, Grid, IconButton, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import { getNormalizedCompanyProfile } from '../../../../utils/companyProfile';

export type VoucherMode = 'edit' | 'view';

export interface CompanyInfo {
  name?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  state?: string;
}

interface InvoiceHeaderProps {
  mode: VoucherMode;
  status?: 'ACTIVE' | 'CANCELLED' | 'DRAFT';
  formState: {
    number: string;
    date: string;
    dueDate?: string;
    paymentTerms?: string;
  };
  onChange: (patch: Partial<InvoiceHeaderProps['formState']>) => void;
  company?: CompanyInfo | null;
  onPrint?: () => void;
  onClose?: () => void;
}

const statusColorMap: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  DRAFT: 'warning',
  CANCELLED: 'error',
};

export const InvoiceHeader: FC<InvoiceHeaderProps> = ({
  mode,
  status = 'ACTIVE',
  formState,
  onChange,
  company,
  onPrint,
  onClose,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const companyFallback = getNormalizedCompanyProfile();
  const companyName = company?.name || companyFallback.name || 'Your Company Name';
  const companyAddress = company?.address || companyFallback.address || 'Company address goes here';
  const companyGstin = company?.gstin || companyFallback.gstin || '';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                {companyName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {companyAddress}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {companyGstin ? `GSTIN: ${companyGstin}` : 'GSTIN not set'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {onPrint && (
                <IconButton onClick={onPrint} size="small">
                  <PrintIcon />
                </IconButton>
              )}
              {onClose && (
                <IconButton onClick={onClose} size="small">
                  <CloseIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              {mode === 'edit' ? (
                <TextField
                  label="Invoice Number"
                  value={formState.number}
                  onChange={(e) => onChange({ number: e.target.value })}
                  fullWidth
                />
              ) : (
                <DisplayField label="Invoice Number" value={formState.number} />
              )}
            </Grid>
            <Grid item xs={12} md={3}>
              {mode === 'edit' ? (
                <TextField
                  label="Invoice Date"
                  type="date"
                  value={formState.date}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => onChange({ date: e.target.value })}
                  fullWidth
                />
              ) : (
                <DisplayField label="Invoice Date" value={formState.date} />
              )}
            </Grid>
            <Grid item xs={12} md={3}>
              {mode === 'edit' ? (
                <TextField
                  label="Due Date"
                  type="date"
                  value={formState.dueDate || ''}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => onChange({ dueDate: e.target.value })}
                  fullWidth
                />
              ) : (
                <DisplayField label="Due Date" value={formState.dueDate || '-'} />
              )}
            </Grid>
            <Grid item xs={12} md={3}>
              {mode === 'edit' ? (
                <TextField
                  label="Payment Terms"
                  value={formState.paymentTerms || ''}
                  onChange={(e) => onChange({ paymentTerms: e.target.value })}
                  fullWidth
                />
              ) : (
                <DisplayField label="Payment Terms" value={formState.paymentTerms || '-'} />
              )}
            </Grid>
          </Grid>

          <Stack
            direction={isMobile ? 'column' : 'row'}
            justifyContent="space-between"
            alignItems={isMobile ? 'flex-start' : 'center'}
            spacing={2}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Voucher Status:
              </Typography>
              <Chip label={status} color={statusColorMap[status] || 'default'} size="small" />
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

const DisplayField: FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="overline" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="subtitle1" fontWeight={600}>
      {value || '-'}
    </Typography>
  </Box>
);

export default InvoiceHeader;
