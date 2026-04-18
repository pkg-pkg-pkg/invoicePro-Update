import React from 'react';
import { Box, Paper, Typography, Button, Stack, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import GroupsIcon from '@mui/icons-material/Groups';
import { APP_DISPLAY_NAME } from '@/constants/appBranding';

/**
 * Hub for Tally / Busy / Marg style data migration.
 * Bulk Excel flows live on Inventory Items and (optional) party tools — this page routes users there.
 */
export default function ImportFromErp(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UploadFileIcon color="primary" />
          Import from Tally / Busy / Marg
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Export ledgers / stock items to <strong>.xlsx</strong> from your ERP, then use {APP_DISPLAY_NAME} bulk import on
          the pages below. Column names are mapped automatically where possible (see each screen for supported headers).
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Quick links
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Inventory2Icon />}
            onClick={() => navigate('/masters/inventory-items')}
          >
            Inventory items (bulk Excel)
          </Button>
          <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/parties')}>
            Parties / ledgers
          </Button>
        </Stack>

        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Suggested flow
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText primary="1. Export item / stock list from Tally/Busy/Marg as Excel." />
          </ListItem>
          <ListItem>
            <ListItemText primary="2. Open Inventory Items → use bulk upload to create/update items and opening stock." />
          </ListItem>
          <ListItem>
            <ListItemText primary="3. Export party / ledger list if needed; maintain party master in Parties." />
          </ListItem>
        </List>

        <Button variant="text" onClick={() => navigate(-1)} sx={{ mt: 1 }}>
          ← Back
        </Button>
      </Paper>
    </Box>
  );
}
