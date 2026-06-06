import {
  Box,
  Breadcrumbs,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import type { SalesDocumentFilters } from '../../types/salesDocuments';
import { SALES_STATUS_FILTER_OPTIONS } from './SalesStatusBadge';
import type { PartyFilterOption } from '../../services/customers/customersApi';

type Props = {
  title: string;
  subtitle?: string;
  moduleName?: string;
  filters: SalesDocumentFilters;
  onFiltersChange: (patch: Partial<SalesDocumentFilters>) => void;
  customers: PartyFilterOption[];
  partyFilterLabel?: string;
  createLabel: string;
  onCreate: () => void;
  canCreate?: boolean;
};

export function SalesToolbar({
  title,
  subtitle,
  moduleName = 'Sales',
  filters,
  onFiltersChange,
  customers,
  partyFilterLabel = 'Customer',
  createLabel,
  onCreate,
  canCreate = true,
}: Props) {
  return (
    <Box
      sx={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden',
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          maxHeight: 72,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Breadcrumbs
              separator="/"
              sx={{
                mb: 0.25,
                '& .MuiBreadcrumbs-separator': { mx: 0.5, color: '#94a3b8', fontSize: 12 },
              }}
            >
              <Typography component="span" sx={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                {moduleName}
              </Typography>
              <Typography component="span" sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {title}
              </Typography>
            </Breadcrumbs>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.15, lineHeight: 1.3 }} noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {canCreate ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreate}
              sx={{
                flexShrink: 0,
                background: 'linear-gradient(135deg, #B8860B 0%, #E8B923 100%)',
                color: '#0B1F3A',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 1,
                px: 2,
                boxShadow: '0 2px 8px rgba(201, 162, 39, 0.25)',
                '&:hover': { filter: 'brightness(1.05)' },
              }}
            >
              {createLabel}
            </Button>
          ) : null}
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1.25, bgcolor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
          <TextField
            size="small"
            placeholder="Quick search number, customer…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: { lg: 220 } }}
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <TextField
              size="small"
              type="date"
              label="From"
              value={filters.fromDate}
              onChange={(e) => onFiltersChange({ fromDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150 }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={filters.toDate}
              onChange={(e) => onFiltersChange({ toDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150 }}
            />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{partyFilterLabel}</InputLabel>
              <Select
                label={partyFilterLabel}
                value={filters.customerId}
                onChange={(e) => onFiltersChange({ customerId: e.target.value })}
              >
                <MenuItem value="">All {partyFilterLabel.toLowerCase()}s</MenuItem>
                {customers.map((c) => (
                  <MenuItem key={c.ledgerId} value={c.ledgerId}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => onFiltersChange({ status: e.target.value as SalesDocumentFilters['status'] })}
              >
                {SALES_STATUS_FILTER_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
