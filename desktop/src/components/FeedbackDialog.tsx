import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Alert,
  CircularProgress,
  Typography,
  FormControlLabel,
  Checkbox,
  Rating,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PreviewIcon from '@mui/icons-material/Preview';
import { FEEDBACK_CATEGORY_OPTIONS, type FeedbackCategory } from '../types/privacyDiagnostics';
import { privacyFeedbackService } from '../services/privacy/privacyFeedbackService';
import {
  buildDiagnosticsPayload,
  previewDiagnosticsPayload,
} from '../services/privacy/diagnosticsService';
import { getPrivacySettings } from '../services/privacy/privacySettingsService';
import DiagnosticsPreviewDialog from './privacy/DiagnosticsPreviewDialog';

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onClose }) => {
  const defaults = getPrivacySettings();
  const [rating, setRating] = useState<number | null>(4);
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(defaults.sendAnonymousDiagnostics);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewJson, setPreviewJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = () => {
    setRating(4);
    setCategory('bug');
    setMessage('');
    setIncludeDiagnostics(getPrivacySettings().sendAnonymousDiagnostics);
    setError('');
    setSuccess(false);
    setSuccessMessage('');
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter your feedback message');
      return;
    }
    if (!rating || rating < 1) {
      setError('Please select a rating from 1 to 5');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const diagnostics = includeDiagnostics
        ? await buildDiagnosticsPayload({ userConsented: true })
        : undefined;
      const res = await privacyFeedbackService.send({
        type: 'user_feedback',
        rating,
        category,
        message: message.trim(),
        includeDiagnostics: Boolean(diagnostics),
        diagnostics: diagnostics ?? undefined,
      });
      setSuccessMessage(res.message);
      setSuccess(true);
      window.setTimeout(() => {
        resetForm();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const openPreview = async () => {
    const json = await previewDiagnosticsPayload({
      userConsented: includeDiagnostics,
    });
    setPreviewJson(json);
    setPreviewOpen(true);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            Send Feedback
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Help → Send Feedback · Privacy-first · no customer or financial data unless you opt in to
            diagnostics.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {success ? (
              <Alert severity="success">{successMessage || 'Thank you! Your feedback was sent.'}</Alert>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                Rating
              </Typography>
              <Rating
                value={rating}
                onChange={(_, v) => setRating(v)}
                disabled={loading}
                max={5}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Feedback Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                label="Feedback Category"
                disabled={loading}
              >
                {FEEDBACK_CATEGORY_OPTIONS.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Message"
              placeholder="Describe your experience, bug steps, or suggestion…"
              fullWidth
              multiline
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              error={!!error && !message.trim()}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                  disabled={loading}
                />
              }
              label="Include optional anonymous diagnostics (app version, OS, error logs, usage counters)"
            />

            <Button
              size="small"
              startIcon={<PreviewIcon />}
              onClick={() => void openPreview()}
              disabled={loading}
              sx={{ alignSelf: 'flex-start' }}
            >
              Preview diagnostics payload
            </Button>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {loading ? 'Sending…' : 'Send Feedback'}
          </Button>
        </DialogActions>
      </Dialog>

      <DiagnosticsPreviewDialog
        open={previewOpen}
        previewJson={previewJson}
        onClose={() => setPreviewOpen(false)}
        readOnly
      />
    </>
  );
};

export default FeedbackDialog;
