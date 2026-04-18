import { Box, Paper, Typography, Button } from '@mui/material';

/** Minimal admin shell — replace with your full license dashboard from backup. */
export default function Dashboard(props: { onLoggedOut: () => void }) {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 640 }}>
        <Typography variant="h6" gutterBottom>
          InvoicePro Admin (minimal)
                      </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
          Full admin UI was not in this workspace copy. Restore your backed-up <code>Admin/src</code> (Firebase
          license tools, tables, etc.) and wire <code>main.tsx</code> again.
          </Typography>
        <Button variant="contained" onClick={() => props.onLoggedOut()}>
          Logout
                        </Button>
          </Paper>
    </Box>
  );
}
