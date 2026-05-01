import { useCallback } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useMasterList } from '../../hooks/useMasterList';
import { approvalService, ApprovalRequest } from '../../services/approvals/approvalService';

const statusColor = (status: ApprovalRequest['status']) => {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'error';
  return 'warning';
};

export default function ApprovalPendingPage() {
  const fetchApprovals = useCallback(() => approvalService.list(), []);
  const { data, loading, error, refresh } = useMasterList<ApprovalRequest>(fetchApprovals);

  const handleApprove = async (id: string) => {
    await approvalService.approve(id);
    await refresh();
  };

  const handleReject = async (id: string) => {
    await approvalService.reject(id);
    await refresh();
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight={700}>
          Approval Pending
        </Typography>
        <Button variant="outlined" onClick={() => void refresh()}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              Loading...
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Requested At</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Record</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No approval requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{new Date(row.requestedAt).toLocaleString()}</TableCell>
                      <TableCell>{row.section}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.entityLabel}</TableCell>
                      <TableCell>{row.requestedBy}</TableCell>
                      <TableCell>
                        <Chip size="small" color={statusColor(row.status) as any} label={row.status} />
                      </TableCell>
                      <TableCell align="right">
                        {row.status === 'PENDING' ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="contained" onClick={() => void handleApprove(row.id)}>
                              Approve
                            </Button>
                            <Button size="small" color="error" variant="outlined" onClick={() => void handleReject(row.id)}>
                              Reject
                            </Button>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {row.reviewedBy ? `By ${row.reviewedBy}` : 'Completed'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

