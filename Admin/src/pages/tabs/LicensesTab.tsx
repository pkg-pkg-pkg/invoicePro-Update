import { Grid, Paper } from '@mui/material';
import LicenseGeneratePanel from '../../components/licenses/LicenseGeneratePanel';
import LicensesTable from '../../components/licenses/LicensesTable';
import { useLicenses } from '../../hooks/useLicenses';

export default function LicensesTab() {
  const { rows, loading, error, reload } = useLicenses();

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4} lg={3}>
        <LicenseGeneratePanel onGenerated={reload} />
      </Grid>
      <Grid item xs={12} md={8} lg={9}>
        <Paper sx={{ p: 2.5 }}>
          <LicensesTable
            title="Generated licenses (pending activation)"
            subtitle="Only unused keys appear here. After assign + activate, the key moves to Users → Active users."
            rows={rows}
            loading={loading}
            error={error}
            mode="pending"
            onRefresh={reload}
          />
        </Paper>
      </Grid>
    </Grid>
  );
}
