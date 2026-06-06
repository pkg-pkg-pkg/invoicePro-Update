import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../pages/contexts/auth';
import Logo from './Logo';
import { APP_DISPLAY_NAME } from '../constants/appBranding';
import CreateCompanyDialog from './CreateCompanyDialog';
import {
  listCompaniesEnriched,
  setDefaultCompany,
  switchCompany,
  deleteCompany,
  reloadAfterCompanySwitch,
  type EnrichedCompanyRecord,
} from '../services/companyRegistryService';
import { useUserDisplayName } from '../hooks/useUserDisplayName';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getBundledAppVersion } from '../services/appUpdateService';
import { ERP_HEADER_BG } from '../theme/erpColors';
import { erpContainedButtonSx, erpOutlinedButtonSx } from '../theme/erpButtonStyles';

type Props = {
  mode?: 'startup' | 'switch' | 'embedded';
  open?: boolean;
  onClose?: () => void;
};

export default function CompanySelectScreen({ mode = 'startup', open = true, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<EnrichedCompanyRecord[]>([]);
  const [activeId, setActiveId] = useState('');
  const [defaultId, setDefaultId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCompaniesEnriched();
      setCompanies(res.companies);
      setActiveId(res.activeId);
      setDefaultId(res.defaultCompany || '');
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load companies'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const finishOpen = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const target = companies.find((c) => c.id === id);
      if (!target?.folderOk) {
        setError(`Data folder for ${id} is missing or corrupt. Choose another company or restore backup.`);
        return;
      }
      await switchCompany(id);
      window.dispatchEvent(new Event('activeCompanyChanged'));
      if (mode === 'startup') {
        window.dispatchEvent(new Event('companyGateReady'));
        navigate('/dashboard', { replace: true });
      } else {
        onClose?.();
        window.location.reload();
      }
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to open company'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setBusyId(`def-${id}`);
    try {
      await setDefaultCompany(id);
      setDefaultId(id);
      await refresh();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to set default'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteCompany = async (c: EnrichedCompanyRecord) => {
    if (companies.length <= 1) {
      setError('Cannot delete the only company. Create another company first.');
      return;
    }
    const label = c.name || c.id;
    const ok = window.confirm(
      `Delete company "${label}" (${c.id})?\n\n` +
        'The company will be removed from your list. Data folder is kept on disk for safety.\n' +
        'This cannot be undone from the app.'
    );
    if (!ok) return;

    setBusyId(`del-${c.id}`);
    setError(null);
    try {
      const res = await deleteCompany(c.id);
      if (res.switched) {
        window.dispatchEvent(new Event('activeCompanyChanged'));
        if (mode === 'switch') {
          onClose?.();
          reloadAfterCompanySwitch();
          return;
        }
        if (mode === 'embedded' || mode === 'startup') {
          reloadAfterCompanySwitch();
          return;
        }
      }
      await refresh();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to delete company'));
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  const welcomeName = useUserDisplayName();
  const isModal = mode === 'switch';
  const isEmbedded = mode === 'embedded';

  const companyCards = (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {companies.map((c) => {
            const isDefault = c.id === defaultId || c.is_default;
            const isActive = c.id === activeId;
            return (
              <Card
                key={c.id}
                variant="outlined"
                sx={{
                  borderColor: isActive ? 'primary.main' : 'divider',
                  borderWidth: isActive ? 2 : 1,
                  boxShadow: isActive ? 2 : 1,
                  bgcolor: '#fff',
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    {isDefault ? (
                      <StarIcon sx={{ color: '#ca8a04', mt: 0.25 }} fontSize="small" />
                    ) : (
                      <StarBorderIcon sx={{ color: '#94a3b8', mt: 0.25 }} fontSize="small" />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={700}>
                        {c.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[c.city, c.district, c.state].filter(Boolean).join(', ') || 'City not set'}
                        {' · '}
                        FY {c.fy || '—'} | GST: {c.gstin?.trim() ? c.gstin : 'Not Set'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {c.id}
                      </Typography>
                      {!c.folderOk && (
                        <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5 }}>
                          Data folder missing — restore backup or contact support.
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={Boolean(busyId) || companies.length <= 1}
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => void handleDeleteCompany(c)}
                      sx={{ flexShrink: 0, textTransform: 'none' }}
                    >
                      Delete Company
                    </Button>
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    variant="contained"
                    disabled={Boolean(busyId) || !c.folderOk}
                    onClick={() => void finishOpen(c.id)}
                    sx={erpContainedButtonSx}
                  >
                    Open
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={Boolean(busyId) || isDefault}
                    onClick={() => void handleSetDefault(c.id)}
                    sx={erpOutlinedButtonSx}
                  >
                    Set as Default
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={Boolean(busyId)}
                    sx={erpOutlinedButtonSx}
                    onClick={() => {
                      if (mode === 'switch') onClose?.();
                      navigate('/settings?tab=companydesk');
                      window.location.hash = '#/settings?tab=companydesk';
                    }}
                  >
                    Edit
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" justifyContent="center" spacing={2} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          onClick={() => setCreateOpen(true)}
          disabled={Boolean(busyId)}
          sx={erpOutlinedButtonSx}
        >
          + Create New Company
        </Button>
        {isModal && onClose && (
          <Button onClick={onClose} disabled={Boolean(busyId)}>
            Cancel
          </Button>
        )}
      </Stack>

      <CreateCompanyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void refresh();
        }}
      />
    </>
  );

  if (isEmbedded) {
    if (!open) return null;
    return <Box sx={{ py: 0 }}>{companyCards}</Box>;
  }

  const body = (
    <Container maxWidth="md" sx={{ py: isModal ? 2 : 4 }}>
      <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
        {!isModal && <Logo size="auth" />}
        <Typography variant="h5" fontWeight={800} color={isModal ? 'text.primary' : '#fff'}>
          {APP_DISPLAY_NAME}
        </Typography>
        <Typography variant="subtitle1" color={isModal ? 'text.secondary' : 'rgba(255,255,255,0.85)'}>
          Welcome, {welcomeName}
        </Typography>
        <Typography variant="body1" fontWeight={600}>
          Select Company to Open
        </Typography>
      </Stack>

      {companyCards}

      {!isModal && (
        <Typography variant="caption" color="rgba(255,255,255,0.6)" align="center" display="block" sx={{ mt: 4 }}>
          v{getBundledAppVersion()}
        </Typography>
      )}
    </Container>
  );

  if (isModal) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1400,
          bgcolor: 'rgba(15,23,42,0.55)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: 'auto',
          py: 2,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <Box
          sx={{
            bgcolor: '#f8fafc',
            borderRadius: 2,
            width: '100%',
            maxWidth: 720,
            mx: 2,
            boxShadow: 6,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: ERP_HEADER_BG,
        backgroundImage: 'linear-gradient(180deg, #0b1628 0%, #1e3a5f 100%)',
      }}
    >
      {body}
    </Box>
  );
}
