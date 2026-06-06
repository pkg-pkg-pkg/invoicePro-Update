import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import type { Party, PartyInput } from '../../types/party';
import type { PartyProfile } from '../../types/partyProfile';
import { PartyFullForm } from '../party/PartyFullForm';
import { customersApi } from '../../services/customers/customersApi';
import { partyProfileService } from '../../services/masters/partyProfileService';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  party: Party | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
};

export function CustomerFormModal({ open, mode, party, saving: savingProp, onClose, onSubmit }: Props) {
  const [loadedParty, setLoadedParty] = useState<Party | null>(party);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadedParty(party);
  }, [open, party]);

  const handleSave = async (input: PartyInput, profile: Omit<PartyProfile, 'partyId'>, saveAndNew?: boolean) => {
    setSaving(true);
    try {
      if (mode === 'edit' && party) {
        await customersApi.update(party.id, input);
        await partyProfileService.save({ ...profile, partyId: party.id });
      } else {
        const created = await customersApi.create(input);
        await partyProfileService.save({ ...profile, partyId: created.id });
      }
      onSubmit?.();
      if (!saveAndNew) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
      <DialogTitle>{mode === 'create' ? 'New Customer' : 'Edit Customer'}</DialogTitle>
      <DialogContent dividers>
        <PartyFullForm
          mode="customer"
          party={loadedParty}
          embedded
          saving={saving || savingProp}
          onCancel={onClose}
          onSave={handleSave}
        />
      </DialogContent>
    </Dialog>
  );
}
