import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type { LicenseRecord } from '../../utils/licenseHelpers';
import { updateLicenseAdmin } from '../../services/adminApi';

type Props = {
  open: boolean;
  license: LicenseRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function LicenseEditDialog({ open, license, onClose, onSaved }: Props) {
  const [email, setEmail] = useState('');
  const [maxActivations, setMaxActivations] = useState('1');
  const [note, setNote] = useState('');
  const [extendDays, setExtendDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!license) return;
    setEmail(String(license.assignedToEmail ?? ''));
    setMaxActivations(String(license.maxActivations ?? 1));
    setNote(String(license.note ?? ''));
    setExtendDays('');
    setError(null);
  }, [license]);

  const save = async () => {
    if (!license) return;
    const key = license.id || license.licenseKey || '';
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {
        assignedToEmail: email.trim().toLowerCase(),
        maxActivations: Number(maxActivations) || 0,
        note: note.trim(),
      };
      const ext = extendDays.trim();
      if (ext) patch.extendValidityDays = Number(ext);
      await updateLicenseAdmin(key, patch);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit license</DialogTitle>
      <DialogContent>
        {error && (
          <Stack sx={{ mb: 2, color: 'error.main', fontSize: 14 }}>
            {error}
          </Stack>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Assigned email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField
            label="Max activations"
            value={maxActivations}
            onChange={(e) => setMaxActivations(e.target.value)}
            fullWidth
          />
          <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
          <TextField
            label="Extend validity (days from today)"
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            fullWidth
            placeholder="Optional"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
