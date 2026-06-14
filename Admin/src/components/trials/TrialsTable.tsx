import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { extendTrialMobile, runTrialAdminAction } from '../../services/trialAdminService';
import {
  daysLeft,
  deviceTail,
  formatTrialDate,
  maskTrialMobile,
  trialStatus,
  type TrialRecord,
} from '../../utils/trialHelpers';

type Props = {
  rows: TrialRecord[];
  loading: boolean;
  acting: string | null;
  onAction: (mobile: string, label: string, fn: () => Promise<void>) => void;
};

export default function TrialsTable({ rows, loading, acting, onAction }: Props) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Mobile</TableCell>
            <TableCell>City</TableCell>
            <TableCell>State</TableCell>
            <TableCell>Pincode</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>End</TableCell>
            <TableCell>Days</TableCell>
            <TableCell>Logins</TableCell>
            <TableCell>Device</TableCell>
            <TableCell>OTP</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const st = trialStatus(r);
            const left = daysLeft(r);
            const pin = r.location?.final_pincode || r.location?.pincode || '—';
            const busy = acting?.startsWith(`${r.mobile_no}:`) ?? false;
            return (
              <TableRow key={r.id}>
                <TableCell>{maskTrialMobile(r.mobile_no)}</TableCell>
                <TableCell>{r.location?.city || '—'}</TableCell>
                <TableCell>{r.location?.state || '—'}</TableCell>
                <TableCell>{pin}</TableCell>
                <TableCell>{formatTrialDate(r.trial_start_date)}</TableCell>
                <TableCell>{formatTrialDate(r.trial_end_date)}</TableCell>
                <TableCell>{st === 'Active' ? `${left}d` : st === 'Expired' ? 'Expired' : '—'}</TableCell>
                <TableCell>{r.login_count ?? 0}</TableCell>
                <TableCell>{deviceTail(r.device_id)}</TableCell>
                <TableCell>{r.otp_verified ? '✅' : '❌'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={st}
                    color={st === 'Active' ? 'success' : st === 'Converted' ? 'info' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => void onAction(r.mobile_no, 'extend', () => extendTrialMobile(r.mobile_no, 7))}
                    >
                      +7d
                    </Button>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() =>
                        void onAction(r.mobile_no, 'reset', () => runTrialAdminAction(r.mobile_no, 'reset_device'))
                      }
                    >
                      Reset device
                    </Button>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() =>
                        void onAction(r.mobile_no, 'convert', () => runTrialAdminAction(r.mobile_no, 'mark_converted'))
                      }
                    >
                      Converted
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      disabled={busy}
                      onClick={() => void onAction(r.mobile_no, 'block', () => runTrialAdminAction(r.mobile_no, 'block'))}
                    >
                      Block
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} align="center">
                No trial users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
