import {
  Chip,
  Box,
  Button,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';

type VoucherAction = {
  id: string;
  label: string;
  hint: string;
  openPath: string;
  newPath: string;
  help: string;
  listLinkLabel: string;
  shortcut: string;
};

const ACTIONS: VoucherAction[] = [
  {
    id: 'sales',
    label: 'Sales Invoice',
    hint: 'Bikri bill banayein',
    openPath: '/vouchers/sales',
    newPath: '/vouchers/sales/new',
    listLinkLabel: 'Sales invoice list',
    help: 'Customer ko bill generate karne ke liye use karein. Item, GST aur totals yahi se manage hote hain.',
    shortcut: 'F8',
  },
  {
    id: 'sales-return',
    label: 'Sales Return',
    hint: 'Customer return / credit',
    openPath: '/vouchers/sales-return',
    newPath: '/vouchers/sales-return/new',
    listLinkLabel: 'Sales return list',
    help: 'Jab customer maal wapas kare ya credit note dena ho tab is voucher ka use karein.',
    shortcut: 'Ctrl+F8',
  },
  {
    id: 'purchase',
    label: 'Purchase',
    hint: 'Khareed entry',
    openPath: '/vouchers/purchase',
    newPath: '/vouchers/purchase/new',
    listLinkLabel: 'Purchase list',
    help: 'Supplier purchase bills aur input GST entry ke liye use karein.',
    shortcut: 'F9',
  },
  {
    id: 'purchase-return',
    label: 'Purchase Return',
    hint: 'Supplier ko maal return',
    openPath: '/vouchers/purchase-return',
    newPath: '/vouchers/purchase-return/new',
    listLinkLabel: 'Purchase return list',
    help: 'Supplier ko stock return ya debit note create karna ho to is option ko choose karein.',
    shortcut: 'Ctrl+F9',
  },
  {
    id: 'journal',
    label: 'Journal',
    hint: 'Adjustment entries',
    openPath: '/vouchers/journal',
    newPath: '/vouchers/journal/new',
    listLinkLabel: 'Journal list',
    help: 'Non-cash adjustments, transfer, contra-type manual accounting entries ke liye.',
    shortcut: 'F7',
  },
];

export default function VouchersHub() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>(ACTIONS[0].id);

  const selected = useMemo(
    () => ACTIONS.find((x) => x.id === selectedId) ?? ACTIONS[0],
    [selectedId]
  );

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} lg={8}>
        <Paper sx={{ p: 2, border: '1px solid #cbd5e1' }}>
          <Box
            sx={{
              mb: 1.5,
              p: 1.5,
              border: '1px solid #cbd5e1',
              bgcolor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                Vouchers Control Desk
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Hover right panel for preview, click to open new entry.
              </Typography>
            </Box>
            <Chip label="Dense Mode" size="small" sx={{ fontWeight: 700 }} />
          </Box>

          <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
            Vouchers
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8125rem' }}>
            Dahini list se voucher type par click karein — seedha nayi entry khulegi. Purani / saved entries niche se list screens par
            kholein.
          </Typography>

          <Box sx={{ mb: 1.5, border: '1px solid #cbd5e1', bgcolor: '#f8fafc', p: 1.25 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography fontWeight={800}>{selected.label}</Typography>
              <Chip label={selected.shortcut} size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
              {selected.help}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Purani / listed entries
          </Typography>
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            {ACTIONS.map((action) => (
              <Button
                key={action.id}
                component={RouterLink}
                to={action.openPath}
                size="small"
                variant="outlined"
                sx={{
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: '#cbd5e1',
                  color: '#1e3a5f',
                  fontSize: '0.8rem',
                }}
              >
                {action.listLinkLabel} <strong>{action.shortcut}</strong>
              </Button>
            ))}
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>
            Party ledger
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
            Kisi customer ya supplier ka poora hisaab dekhne ke liye party select karke ledger screen par jaayein.
          </Typography>
          <Button
            component={RouterLink}
            to="/customers/ledger-report"
            variant="contained"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Party ledger kholen
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Tip: Payment aur Receipt ke liye left menu me &ldquo;Payment & Receipt&rdquo; tab use karein.
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12} lg={4}>
        <Paper sx={{ p: 0, height: '100%', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={800}>
              Voucher types
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click = nayi entry
            </Typography>
          </Box>
          <List dense disablePadding sx={{ py: 0.5 }}>
            {ACTIONS.map((action) => (
              <ListItemButton
                key={action.id}
                selected={selectedId === action.id}
                onMouseEnter={() => setSelectedId(action.id)}
                onFocus={() => setSelectedId(action.id)}
                onClick={() => navigate(action.newPath)}
                alignItems="flex-start"
                sx={{
                  py: 1.15,
                  px: 2,
                  borderBottom: '1px solid #e2e8f0',
                  '&.Mui-selected': { bgcolor: '#dbeafe' },
                  '&:hover': { bgcolor: '#eef2ff' },
                }}
              >
                <ListItemText
                  primary={action.label}
                  secondary={action.hint}
                  primaryTypographyProps={{ fontWeight: 700, fontSize: '0.86rem' }}
                  secondaryTypographyProps={{ variant: 'body2', fontSize: '0.76rem' }}
                />
                <Chip
                  label={action.shortcut}
                  size="small"
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#e2e8f0' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );
}
