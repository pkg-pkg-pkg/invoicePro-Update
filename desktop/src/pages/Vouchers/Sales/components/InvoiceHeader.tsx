import { FC, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
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
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);
  const companyFallback = getNormalizedCompanyProfile();
  const companyName = company?.name || companyFallback.name || 'Your Company Name';
  const companyAddress = company?.address || companyFallback.address || '';
  const companyGstin = company?.gstin || companyFallback.gstin || '';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ py: 1.5, px: { xs: 1.25, md: 1.5 }, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1.25}>
          <Stack direction="row" justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.1}>
                {companyName}
              </Typography>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 0.25 : 1.5}>
                {companyAddress ? (
                  <Typography variant="caption" color="text.secondary">
                    {companyAddress}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  {companyGstin ? `GSTIN: ${companyGstin}` : 'GSTIN not set'}
                </Typography>
              </Stack>
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

          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              {mode === 'edit' ? (
                <TextField
                  label="Invoice Number"
                  value={formState.number}
                  onChange={(e) => onChange({ number: e.target.value })}
                  fullWidth
                  size="small"
                />
              ) : (
                <DisplayField label="Invoice Number" value={formState.number} />
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              {mode === 'edit' ? (
                <TextField
                  label="Invoice Date"
                  type="date"
                  value={formState.date}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => onChange({ date: e.target.value })}
                  fullWidth
                  size="small"
                />
              ) : (
                <DisplayField label="Invoice Date" value={formState.date} />
              )}
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Status:
                </Typography>
                <Chip label={status} color={statusColorMap[status] || 'default'} size="small" />
              </Stack>
              {mode === 'edit' && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setShowAdvancedMeta((prev) => !prev)}
                >
                  {showAdvancedMeta ? 'Hide terms' : 'More fields'}
                </Button>
              )}
            </Grid>
          </Grid>

          <Collapse in={mode !== 'edit' || showAdvancedMeta} unmountOnExit={mode === 'edit'}>
            <Grid container spacing={1} sx={{ pt: 0.5 }}>
              <Grid item xs={12} md={6}>
                {mode === 'edit' ? (
                  <TextField
                    label="Due Date"
                    type="date"
                    value={formState.dueDate || ''}
                    InputLabelProps={{ shrink: true }}
                    onChange={(e) => onChange({ dueDate: e.target.value })}
                    fullWidth
                    size="small"
                  />
                ) : (
                  <DisplayField label="Due Date" value={formState.dueDate || '-'} />
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                {mode === 'edit' ? (
                  <TextField
                    label="Payment Terms (Days)"
                    type="number"
                    value={formState.paymentTerms || ''}
                    onChange={(e) => onChange({ paymentTerms: e.target.value })}
                    inputProps={{ min: 0 }}
                    fullWidth
                    size="small"
                  />
                ) : (
                  <DisplayField label="Payment Terms" value={formState.paymentTerms || '-'} />
                )}
              </Grid>
            </Grid>
          </Collapse>
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
