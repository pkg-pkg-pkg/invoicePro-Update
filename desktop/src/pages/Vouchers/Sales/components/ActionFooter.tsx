import { FC } from 'react';
import { Box, Button, Stack, useMediaQuery, useTheme } from '@mui/material';

type VoucherMode = 'edit' | 'view';

interface ActionFooterProps {
  mode: VoucherMode;
  canEdit?: boolean;
  saving?: boolean;
  onCancel?: () => void;
  onSave?: () => void;
  onSaveDraft?: () => void;
  onSaveAndPrint?: () => void;
  onEdit?: () => void;
  onShareWhatsApp?: () => void;
  onDownloadPDF?: () => void;
}

const ActionFooter: FC<ActionFooterProps> = ({
  mode,
  canEdit = true,
  saving,
  onCancel,
  onSave,
  onSaveDraft,
  onSaveAndPrint,
  onEdit,
  onShareWhatsApp,
  onDownloadPDF,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        background: theme.palette.background.paper,
        borderTop: `1px solid ${theme.palette.divider}`,
        py: 1,
        px: { xs: 0.75, md: 1.25 },
        mt: 1.5,
        zIndex: 5,
      }}
    >
      {mode === 'view' ? (
        <Stack direction={isMobile ? 'column' : 'row'} spacing={1} justifyContent="flex-end" flexWrap="wrap">
          {canEdit && (
            <Button variant="contained" onClick={onEdit}>
              Edit
            </Button>
          )}
        </Stack>
      ) : (
        <Stack direction={isMobile ? 'column' : 'row'} spacing={0.75} justifyContent="flex-end" flexWrap="wrap">
          <Button variant="outlined" onClick={onSaveDraft} disabled={saving}>
            {saving ? 'Saving…' : 'Save as Draft'}
          </Button>
          <Button variant="text" onClick={onSaveAndPrint} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Print'}
          </Button>
          <Button variant="text" onClick={onDownloadPDF} disabled={saving}>
            {saving ? 'Saving…' : 'Download PDF'}
          </Button>
          <Button variant="text" onClick={onShareWhatsApp} disabled={saving}>
            {saving ? 'Saving…' : 'Share on WhatsApp'}
          </Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Invoice'}
          </Button>
        </Stack>
      )}
    </Box>
  );
};

export default ActionFooter;
