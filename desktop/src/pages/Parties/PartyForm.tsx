import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Typography } from '@mui/material';
import { Party } from '../../types/party';
import { partyService } from '../../services/masters/partyService';
import { partyProfileService } from '../../services/masters/partyProfileService';
import { PartyFullForm } from '../../components/party/PartyFullForm';
import type { PartyInput } from '../../types/party';
import type { PartyProfile } from '../../types/partyProfile';

export type PartyFormProps = {
  embedded?: boolean;
  vendorMode?: boolean;
  onSaved?: (party: Party) => void;
  onCancel?: () => void;
};

const PartyForm = ({ embedded = false, vendorMode, onSaved, onCancel }: PartyFormProps = {}) => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(!embedded && id);
  const navigate = useNavigate();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParty = useCallback(async (partyId: string) => {
    try {
      setLoading(true);
      const loaded = await partyService.getById(partyId);
      setParty(loaded);
    } catch {
      setError('Failed to load party');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEditMode && id) void loadParty(id);
  }, [id, isEditMode, loadParty]);

  const formMode = vendorMode || party?.partyType === 'SUPPLIER' ? 'vendor' : 'customer';

  const handleSave = async (input: PartyInput, profile: Omit<PartyProfile, 'partyId'>, saveAndNew?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      let saved: Party;
      if (isEditMode && id) {
        saved = await partyService.update(id, input);
      } else {
        saved = await partyService.create(input);
      }
      await partyProfileService.save({ ...profile, partyId: saved.id });
      if (embedded && onSaved) {
        onSaved(saved);
      } else if (saveAndNew) {
        setParty(null);
      } else {
        navigate('/customers');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to save party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {!embedded && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {isEditMode ? (formMode === 'vendor' ? 'Edit Vendor' : 'Edit Customer') : formMode === 'vendor' ? 'New Vendor' : 'New Customer'}
        </Typography>
      )}
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <PartyFullForm
        mode={formMode}
        party={party}
        embedded={embedded}
        saving={loading}
        onCancel={embedded ? onCancel : () => navigate('/customers')}
        onSave={handleSave}
      />
    </Box>
  );
};

export default PartyForm;
