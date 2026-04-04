import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';

import { voucherService } from '../../../services/vouchers/voucherService';
import { Voucher } from '../../../types/vouchers';
import { usePermission } from '../../../hooks/usePermission';

const PurchaseReturnVoucherList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVouchers = async () => {
      try {
        setLoading(true);
        const allVouchers = await voucherService.list();
        const purchaseReturnVouchers = allVouchers.filter((v) => v.type === 'PURCHASE_RETURN');
        setVouchers(purchaseReturnVouchers);
      } catch (error) {
        console.error('Error loading purchase return vouchers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVouchers();
  }, []);

  const getTotalAmount = (voucher: Voucher) => {
    return voucher.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Purchase Return Vouchers</Typography>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/vouchers/purchase-return/new')}
          >
            New Purchase Return
          </Button>
        )}
      </Box>

      <Card>
        <CardContent>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : vouchers.length === 0 ? (
            <Typography color="text.secondary">No purchase return vouchers found.</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Voucher No</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vouchers.map((voucher) => (
                    <TableRow key={voucher.id} hover>
                      <TableCell>{dayjs(voucher.date).format('DD MMM YYYY')}</TableCell>
                      <TableCell>{voucher.number}</TableCell>
                      <TableCell>₹{getTotalAmount(voucher).toFixed(2)}</TableCell>
                      <TableCell>{voucher.narration || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={voucher.status}
                          color={voucher.status === 'ACTIVE' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PurchaseReturnVoucherList;
