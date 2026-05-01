import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material';

import { Godown } from '../../../types/masters';
import { godownService } from '../../../services/masters/godownService';
import { useMasterForm } from '../../../hooks/useMasterForm';
import { usePermission } from '../../../hooks/usePermission';
import { useFocusField } from '../../../hooks/useFocusField';

interface GodownInput {
  name: string;
  code?: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
}

const SCREEN_ID = 'godown-form';

const GodownForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { can } = usePermission();

  const { entity, loading, saving, error, load, create, update, resetError } = useMasterForm<Godown, GodownInput>({
    load: async (entityId) => {
      const godown = await godownService.getById(entityId);
      if (!godown) {
        throw new Error('Godown not found');
      }
      return godown;
    },
    create: async (payload) =>
      godownService.create({
        ...payload,
      }),
    update: async (entityId, payload) =>
      godownService.update(entityId, {
        ...payload,
      }),
  });

  useEffect(() => {
    if (isEditMode && id) {
      void load(id);
    }
  }, [id, isEditMode, load]);

  const [formState, setFormState] = useState<GodownInput>({
    name: '',
    code: '',
    address: '',
    isDefault: false,
    isActive: true,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (entity && isEditMode) {
      setFormState({
        name: entity.name,
        code: entity.code ?? '',
        address: entity.address ?? '',
        isDefault: Boolean(entity.isDefault),
        isActive: entity.isActive !== false,
      });
    }
  }, [entity, isEditMode]);

  const canView = can('view-inventory');
  const canManage = can('manage-inventory');
  const formDisabled = saving || loading || !canManage;

  const nameFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 1,
    disabled: formDisabled,
  });
  const codeFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 2,
    disabled: formDisabled,
  });
  const addressFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'details',
    order: 3,
    disabled: formDisabled,
  });

  const handleChange = <K extends keyof GodownInput>(field: K, value: GodownInput[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      setSubmitError('You do not have permission to manage godowns.');
      return;
    }
    if (!formState.name.trim()) {
      setSubmitError('Godown name is required.');
      return;
    }
    try {
      setSubmitError(null);
      if (isEditMode && id) {
        await update(id, formState);
      } else {
        await create(formState);
      }
      navigate('/masters/godowns');
    } catch (err) {
      setSubmitError((err as Error).message ?? 'Failed to save godown');
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view godowns.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card component="form" onSubmit={handleSubmit}>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={600}>
                {isEditMode ? 'Edit Godown' : 'New Godown'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isEditMode ? 'Update stock location details' : 'Create a stock location to track inventory by godown'}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} flexWrap="wrap" justifyContent="flex-end" sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Button type="submit" variant="contained" disabled={saving || !canManage}>
                {saving ? <CircularProgress size={18} color="inherit" /> : isEditMode ? 'Save Changes' : 'Create'}
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" onClose={resetError}>
              {error.message}
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Godown Name"
                value={formState.name}
                onChange={(event) => handleChange('name', event.target.value)}
                fullWidth
                required
                disabled={formDisabled}
                inputRef={nameFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Code"
                value={formState.code ?? ''}
                onChange={(event) => handleChange('code', event.target.value)}
                fullWidth
                disabled={formDisabled}
                inputRef={codeFieldRef}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address / Notes"
                value={formState.address ?? ''}
                onChange={(event) => handleChange('address', event.target.value)}
                fullWidth
                multiline
                minRows={3}
                disabled={formDisabled}
                inputRef={addressFieldRef}
              />
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={formState.isDefault}
                  onChange={(_, checked) => handleChange('isDefault', checked)}
                  disabled={formDisabled}
                />
              }
              label="Set as Default Godown"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formState.isActive}
                  onChange={(_, checked) => handleChange('isActive', checked)}
                  disabled={formDisabled || !isEditMode}
                />
              }
              label="Active"
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default GodownForm;
