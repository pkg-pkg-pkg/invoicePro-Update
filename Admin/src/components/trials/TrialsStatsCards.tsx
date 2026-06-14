import { Grid, Paper, Typography } from '@mui/material';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={800}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

type Props = {
  total: number;
  active: number;
  expired: number;
  converted: number;
  todaySignups: number;
};

export default function TrialsStatsCards({ total, active, expired, converted, todaySignups }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6} md={2.4}>
        <StatCard label="Total Trials" value={total} />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <StatCard label="Active Now" value={active} />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <StatCard label="Expired" value={expired} />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <StatCard label="Converted" value={converted} />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <StatCard label="Today's Signups" value={todaySignups} />
      </Grid>
    </Grid>
  );
}
