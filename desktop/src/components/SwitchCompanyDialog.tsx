import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { listCompanies, switchCompany, type CompanyRecord } from '../services/companyRegistryService';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SwitchCompanyDialog({ open, onClose }: Props) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [activeId, setActiveId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await listCompanies();
        setCompanies(res.companies);
        setActiveId(res.activeId);
      } catch (e: unknown) {
        setError(String((e as Error)?.message ?? 'Failed to load companies'));
      }
    })();
  }, [open]);

  const handleSwitch = async (id: string) => {
    if (id === activeId) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await switchCompany(id);
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to switch company'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Switch Company</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {companies.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No companies found. Create one from Company Desk.
          </Typography>
        ) : (
          <List dense>
            {companies.map((c) => (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                disabled={busy}
                onClick={() => void handleSwitch(c.id)}
              >
                <ListItemText
                  primary={`${c.id} · ${c.name}`}
                  secondary={c.gstin ? `GSTIN: ${c.gstin}` : `Created ${c.created}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
