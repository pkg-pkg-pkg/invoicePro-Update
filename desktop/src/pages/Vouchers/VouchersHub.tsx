import {
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
  },
  {
    id: 'sales-return',
    label: 'Sales Return',
    hint: 'Customer return / credit',
    openPath: '/vouchers/sales-return',
    newPath: '/vouchers/sales-return/new',
    listLinkLabel: 'Sales return list',
    help: 'Jab customer maal wapas kare ya credit note dena ho tab is voucher ka use karein.',
  },
  {
    id: 'purchase',
    label: 'Purchase',
    hint: 'Khareed entry',
    openPath: '/vouchers/purchase',
    newPath: '/vouchers/purchase/new',
    listLinkLabel: 'Purchase list',
    help: 'Supplier purchase bills aur input GST entry ke liye use karein.',
  },
  {
    id: 'purchase-return',
    label: 'Purchase Return',
    hint: 'Supplier ko maal return',
    openPath: '/vouchers/purchase-return',
    newPath: '/vouchers/purchase-return/new',
    listLinkLabel: 'Purchase return list',
    help: 'Supplier ko stock return ya debit note create karna ho to is option ko choose karein.',
  },
  {
    id: 'journal',
    label: 'Journal',
    hint: 'Adjustment entries',
    openPath: '/vouchers/journal',
    newPath: '/vouchers/journal/new',
    listLinkLabel: 'Journal list',
    help: 'Non-cash adjustments, transfer, contra-type manual accounting entries ke liye.',
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
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h5" fontWeight={800} sx={{ mb: 0.75 }}>
            Vouchers
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Dahini list se voucher type par click karein — seedha nayi entry khulegi. Purani / saved entries niche se list screens par
            kholein.
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography fontWeight={700} sx={{ mb: 0.5 }}>
              {selected.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selected.help}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            Purani / listed entries
          </Typography>
          <Stack spacing={0.75} sx={{ mb: 2 }}>
            {ACTIONS.map((action) => (
              <Button
                key={action.id}
                component={RouterLink}
                to={action.openPath}
                size="small"
                variant="outlined"
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                {action.listLinkLabel}
              </Button>
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>
            Party ledger
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Kisi customer ya supplier ka poora hisaab dekhne ke liye party select karke ledger screen par jaayein.
          </Typography>
          <Button
            component={RouterLink}
            to="/parties/ledger-report"
            variant="contained"
            size="small"
            sx={{ textTransform: 'none' }}
          >
            Party ledger kholen
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Tip: Payment aur Receipt ke liye left menu me &ldquo;Payment & Receipt&rdquo; tab use karein.
          </Typography>
        </Paper>
      </Grid>

      <Grid item xs={12} lg={4}>
        <Paper sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
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
                sx={{ py: 1.25, px: 2 }}
              >
                <ListItemText
                  primary={action.label}
                  secondary={action.hint}
                  primaryTypographyProps={{ fontWeight: 700 }}
                  secondaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Grid>
    </Grid>
  );
}
