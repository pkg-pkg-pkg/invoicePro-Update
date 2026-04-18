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
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { feedbackService } from '../services/feedbackService';

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'new-feature', label: '✨ New Feature Request' },
  { value: 'missing-feature', label: '❌ Missing Feature' },
  { value: 'improvement', label: '⚡ Improvement Suggestion' },
  { value: 'requirement', label: '📋 My Requirement' },
  { value: 'other', label: '💬 Other' },
];

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onClose }) => {
  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      setError('Please enter your feedback message');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await feedbackService.sendFeedback({
        category,
        subject,
        message,
      });
      setSuccessMessage(res?.message || 'Thank you! Your feedback has been sent successfully.');
      setSuccess(true);
      setTimeout(() => {
        setSubject('');
        setMessage('');
        setCategory('bug');
        setSuccess(false);
        setSuccessMessage('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSubject('');
      setMessage('');
      setCategory('bug');
      setError('');
      setSuccess(false);
      setSuccessMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          Send Feedback to Developer
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Help us improve the software - pve.2020@hotmail.com
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {success && (
            <Alert severity="success">
              ✓ {successMessage || 'Thank you! Your feedback has been sent successfully.'}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              label="Category"
              disabled={loading}
            >
              {FEEDBACK_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Subject"
            placeholder="Brief title of your feedback"
            fullWidth
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={loading}
            size="small"
            error={!!error && !subject.trim()}
          />

          <TextField
            label="Message"
            placeholder="Describe your feedback in detail..."
            fullWidth
            multiline
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            error={!!error && !message.trim()}
          />

          <Typography variant="caption" color="text.secondary">
            💡 Tip: Include screenshots or detailed steps to reproduce for bug reports
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {loading ? 'Sending...' : 'Send Feedback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeedbackDialog;
