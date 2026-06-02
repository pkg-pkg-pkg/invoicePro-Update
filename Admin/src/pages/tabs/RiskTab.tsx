import { Paper } from '@mui/material';
import LicensesTable from '../../components/licenses/LicensesTable';
import { useLicenses } from '../../hooks/useLicenses';

export default function RiskTab() {
  const { rows, loading, error, reload } = useLicenses();
  const revoked = rows.filter((r) => r.revoked);

  return (
    <Paper sx={{ p: 2.5 }}>
      <LicensesTable
        title="Risk — revoked licenses"
        subtitle="Revoked or blacklisted keys"
        rows={revoked}
        loading={loading}
        error={error}
        mode="all"
        onRefresh={reload}
      />
    </Paper>
  );
}
