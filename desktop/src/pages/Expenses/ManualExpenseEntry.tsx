import { Box, Stack, Typography } from '@mui/material';
import ExpenseHeadsSection from './ExpenseHeadsSection';

export default function ManualExpenseEntry() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Expenses
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 900 }}>
        Manage your <strong>expense categories</strong> (heads) here. To record actual payments (money going out), 
        use the <strong>Payment Vouchers</strong> section under Vouchers.
      </Typography>

      <Stack spacing={3}>
        <ExpenseHeadsSection />
      </Stack>
    </Box>
  );
}
