import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  Box,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { VoucherItem, StockItem, Godown, SalesOrder, SalesOrderItem } from '../../services/vouchers/enhancedVoucherService';
import { enhancedVoucherService } from '../../services/vouchers/enhancedVoucherService';

interface ItemAllocationPopupProps {
  open: boolean;
  onClose: () => void;
  onSave: (allocations: any[]) => void;
  item: StockItem | null;
  totalQuantity: number;
  partyId?: number;
}

interface AllocationRow {
  id: string;
  orderNo: string;
  quantity: number;
  rateInclTax: number;
  rateExclTax: number;
  unit: string;
  discPercent: number;
  amount: number;
  godownId?: number;
  batchId?: number;
  orderItemId?: number;
}

const PICKER_COLORS = {
  headerBg: '#1F3864',
  formBg: '#FFFFFF',
  tableHeaderBg: '#E8E8E8',
  tableRowEven: '#FFFFFF',
  tableRowOdd: '#F8F8F8',
  primaryBlue: '#1976D2',
  successGreen: '#4CAF50',
  warningYellow: '#FFA726',
};

const ItemAllocationPopup: React.FC<ItemAllocationPopupProps> = ({
  open,
  onClose,
  onSave,
  item,
  totalQuantity,
  partyId,
}) => {
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Initialize allocations on mount
  useEffect(() => {
    if (open && item) {
      // Start with one allocation row
      setAllocations([{
        id: Date.now().toString(),
        orderNo: 'Not Applicable',
        quantity: totalQuantity,
        rateInclTax: item.sale_rate || 0,
        rateExclTax: calculateExclusiveRate(item.sale_rate || 0, item.gst_rate || 0),
        unit: item.unit,
        discPercent: 0,
        amount: (totalQuantity * (item.sale_rate || 0)),
        godownId: item.godown_id,
      }]);

      // Load godowns
      enhancedVoucherService.getGodowns().then(setGodowns).catch(console.error);

      // Load sales orders for this party
      if (partyId) {
        enhancedVoucherService.getSalesOrders(partyId)
          .then(setSalesOrders)
          .catch(console.error);
      }
    }
  }, [open, item, totalQuantity, partyId]);

  // Load order items when an order is selected
  useEffect(() => {
    const selectedOrderIds = allocations
      .filter(a => a.orderNo && a.orderNo !== 'Not Applicable')
      .map(a => parseInt(a.orderNo));

    if (selectedOrderIds.length > 0) {
      const orderId = selectedOrderIds[0];
      enhancedVoucherService.getSalesOrderItems(orderId)
        .then(setOrderItems)
        .catch(console.error);
    }
  }, [allocations]);

  const calculateExclusiveRate = (inclusive: number, gstRate: number) => {
    return inclusive / (1 + gstRate / 100);
  };

  const calculateInclusiveRate = (exclusive: number, gstRate: number) => {
    return exclusive * (1 + gstRate / 100);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalQty = allocations.reduce((sum, a) => sum + a.quantity, 0);
    const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
    
    return {
      totalQuantity: totalQty,
      totalAmount: totalAmount,
      quantityMatch: Math.abs(totalQty - totalQuantity) < 0.01,
      warning: totalQty !== totalQuantity ? 
        `Allocated quantity (${totalQty}) does not match required quantity (${totalQuantity})` : 
        null
    };
  }, [allocations, totalQuantity]);

  const addAllocationRow = () => {
    setAllocations(prev => [...prev, {
      id: Date.now().toString(),
      orderNo: 'Not Applicable',
      quantity: 0,
      rateInclTax: item?.sale_rate || 0,
      rateExclTax: item ? calculateExclusiveRate(item.sale_rate, item.gst_rate) : 0,
      unit: item?.unit || 'PCS',
      discPercent: 0,
      amount: 0,
      godownId: item?.godown_id,
    }]);
  };

  const removeAllocationRow = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
  };

  const updateAllocation = (id: string, field: keyof AllocationRow, value: any) => {
    setAllocations(prev => prev.map(a => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        
        // Recalculate amount when quantity, rate, or discount changes
        if (['quantity', 'rateInclTax', 'discPercent'].includes(field)) {
          const taxableAmount = updated.quantity * updated.rateExclTax * (1 - updated.discPercent / 100);
          updated.amount = taxableAmount + (taxableAmount * (item?.gst_rate || 0) / 100);
        }
        
        // Update exclusive rate when inclusive rate changes
        if (field === 'rateInclTax') {
          updated.rateExclTax = calculateExclusiveRate(value, item?.gst_rate || 0);
        }
        
        // Update inclusive rate when exclusive rate changes
        if (field === 'rateExclTax') {
          updated.rateInclTax = calculateInclusiveRate(value, item?.gst_rate || 0);
        }
        
        return updated;
      }
      return a;
    }));
  };

  const handleSave = () => {
    if (!totals.quantityMatch) {
      setWarning(totals.warning || 'Quantity mismatch');
      return;
    }

    onSave(allocations);
    setAllocations([]);
    setWarning(null);
  };

  const handleOrderSelect = (allocationId: string, orderId: number) => {
    const order = salesOrders.find(o => o.id === orderId);
    const orderItem = orderItems.find(oi => oi.order_id === orderId);
    
    if (order && orderItem) {
      updateAllocation(allocationId, 'orderNo', order.order_number);
      updateAllocation(allocationId, 'quantity', orderItem.pending_quantity);
      updateAllocation(allocationId, 'rateInclTax', orderItem.rate_incl_tax);
      updateAllocation(allocationId, 'rateExclTax', orderItem.rate_excl_tax);
      updateAllocation(allocationId, 'orderItemId', orderItem.id);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: PICKER_COLORS.formBg,
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: PICKER_COLORS.headerBg, 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">
          Stock Item Allocations - {item?.item_name}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 2 }}>
        {warning && (
          <Box sx={{ mb: 2, p: 2, bgcolor: PICKER_COLORS.warningYellow + '20' }}>
            <Typography color="warning.main" fontWeight="bold">
              {warning}
            </Typography>
          </Box>
        )}

        {/* Allocation Table */}
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: PICKER_COLORS.tableHeaderBg }}>
              <TableCell width="15%">Order No.</TableCell>
              <TableCell width="20%">Quantity</TableCell>
              <TableCell width="15%">Rate (Incl. of Tax)</TableCell>
              <TableCell width="15%">Rate (excl.)</TableCell>
              <TableCell width="10%">per</TableCell>
              <TableCell width="10%">Disc %</TableCell>
              <TableCell width="15%">Amount</TableCell>
              <TableCell width="10%">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allocations.map((allocation, index) => (
              <TableRow
                key={allocation.id}
                sx={{
                  bgcolor: index % 2 === 0 ? PICKER_COLORS.tableRowEven : PICKER_COLORS.tableRowOdd,
                }}
              >
                <TableCell>
                  {salesOrders.length > 0 ? (
                    <FormControl size="small" fullWidth>
                      <Select
                        value={allocation.orderNo}
                        onChange={(e) => handleOrderSelect(allocation.id, parseInt(e.target.value as string))}
                      >
                        <MenuItem value="Not Applicable">Not Applicable</MenuItem>
                        {salesOrders.map(order => (
                          <MenuItem key={order.id} value={order.id}>
                            {order.order_number} ({order.total_amount})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography>{allocation.orderNo}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={allocation.quantity}
                    onChange={(e) => updateAllocation(allocation.id, 'quantity', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={allocation.rateInclTax}
                    onChange={(e) => updateAllocation(allocation.id, 'rateInclTax', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={allocation.rateExclTax}
                    onChange={(e) => updateAllocation(allocation.id, 'rateExclTax', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </TableCell>
                <TableCell>{allocation.unit}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={allocation.discPercent}
                    onChange={(e) => updateAllocation(allocation.id, 'discPercent', parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 'bold' }}>
                    ₹{allocation.amount.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => removeAllocationRow(allocation.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            
            {/* Summary Row */}
            <TableRow sx={{ bgcolor: PICKER_COLORS.tableHeaderBg, fontWeight: 'bold' }}>
              <TableCell colSpan={2}>
                <Typography fontWeight="bold">
                  Total Quantity: {totals.totalQuantity} {item?.unit}
                </Typography>
              </TableCell>
              <TableCell colSpan={5}>
                <Typography fontWeight="bold" align="right">
                  Total Amount: ₹{totals.totalAmount.toFixed(2)}
                </Typography>
              </TableCell>
              <TableCell>
                <IconButton onClick={addAllocationRow} size="small">
                  <AddIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Required Quantity Info */}
        <Box sx={{ 
          p: 2, 
          bgcolor: totals.quantityMatch ? PICKER_COLORS.successGreen + '10' : PICKER_COLORS.warningYellow + '10',
          borderRadius: 1,
          mb: 2
        }}>
          <Typography variant="body2" fontWeight="bold">
            Required Quantity: {totalQuantity} {item?.unit}
          </Typography>
          <Typography variant="body2">
            Allocated Quantity: {totals.totalQuantity} {item?.unit}
          </Typography>
          {totals.warning && (
            <Typography color="error.main" variant="caption">
              {totals.warning}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        bgcolor: PICKER_COLORS.tableHeaderBg, 
        p: 2 
      }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!totals.quantityMatch}
          sx={{ mr: 1 }}
        >
          Accept (A)
        </Button>
        <Button
          variant="outlined"
          onClick={onClose}
        >
          Cancel (Esc)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ItemAllocationPopup;
