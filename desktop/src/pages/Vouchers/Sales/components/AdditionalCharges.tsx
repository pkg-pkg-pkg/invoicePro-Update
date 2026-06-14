/**
 * Additional Charges Component
 * Handles freight, packing, transport, insurance, etc.
 * Each charge can be taxable or non-taxable with its own GST %
 */

import { useCallback, memo } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { generateId } from "../../../../utils/id";
import {
  voucherLineCellSx,
  voucherLineCompactFieldSx,
  voucherLineNumericInputSx,
} from '../../../../theme/voucherLineItemTableStyles';

export interface AdditionalChargeState {
  chargeId: string;
  name: string;
  amount: string;
  isTaxable: boolean;
  gstPercent: string;
  ledgerId?: string;
}

export const STANDARD_CHARGES = ['Freight', 'Packing', 'Transport', 'Insurance', 'Handling', 'Other'];
export const STANDARD_GST_RATES = [0, 5, 12, 18, 28];

interface AdditionalChargesProps {
  charges: AdditionalChargeState[];
  onChange: (charges: AdditionalChargeState[]) => void;
  readOnly?: boolean;
}

const calculateChargeGST = (amount: number, isTaxable: boolean, gstPercent: number): number => {
  if (!isTaxable || gstPercent === 0) return 0;
  return (amount * gstPercent) / 100;
};

const AdditionalCharges = memo(({ charges, onChange, readOnly = false }: AdditionalChargesProps) => {
  const addCharge = useCallback(() => {
    const newCharge: AdditionalChargeState = {
      chargeId: generateId('charge'),
      name: 'Freight',
      amount: '0',
      isTaxable: false,
      gstPercent: '0',
    };
    onChange([...charges, newCharge]);
  }, [charges, onChange]);

  const removeCharge = useCallback(
    (index: number) => {
      onChange(charges.filter((_, idx) => idx !== index));
    },
    [charges, onChange]
  );

  const updateCharge = useCallback(
    (index: number, patch: Partial<AdditionalChargeState>) => {
      onChange(
        charges.map((charge, idx) => {
          if (idx !== index) return charge;
          return { ...charge, ...patch };
        })
      );
    },
    [charges, onChange]
  );

  const totalCharges = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const totalChargeGST = charges.reduce((sum, charge) => {
    const amount = Number(charge.amount) || 0;
    const isTaxable = charge.isTaxable;
    const gstPercent = Number(charge.gstPercent) || 0;
    return sum + calculateChargeGST(amount, isTaxable, gstPercent);
  }, 0);

  if (charges.length === 0 && readOnly) {
    return null;
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Additional Charges (Optional)
            </Typography>
            {!readOnly && charges.length > 0 && (
              <Button startIcon={<AddIcon />} size="small" onClick={addCharge} variant="outlined">
                Add Charge
              </Button>
            )}
          </Box>

          {charges.length > 0 ? (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Charge Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      Amount
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">
                      Taxable?
                    </TableCell>
                    <TableCell align="center" sx={{ ...voucherLineCellSx('gstPercent'), fontWeight: 600 }}>
                      GST %
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      GST Amount
                    </TableCell>
                    {!readOnly && <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {charges.map((charge, index) => {
                    const chargeAmount = Number(charge.amount) || 0;
                    const gstAmount = calculateChargeGST(
                      chargeAmount,
                      charge.isTaxable,
                      Number(charge.gstPercent) || 0
                    );

                    return (
                      <TableRow key={charge.chargeId}>
                        <TableCell>
                          {readOnly ? (
                            <Typography variant="body2">{charge.name}</Typography>
                          ) : (
                            <TextField
                              select
                              value={charge.name}
                              onChange={(e) => updateCharge(index, { name: e.target.value })}
                              size="small"
                              fullWidth
                              variant="standard"
                            >
                              {STANDARD_CHARGES.map((type) => (
                                <MenuItem key={type} value={type}>
                                  {type}
                                </MenuItem>
                              ))}
                            </TextField>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {readOnly ? (
                            <Typography variant="body2">₹{chargeAmount.toFixed(2)}</Typography>
                          ) : (
                            <TextField
                              type="number"
                              value={charge.amount}
                              onChange={(e) => updateCharge(index, { amount: e.target.value })}
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0, step: '0.01' }}
                              sx={{ ...voucherLineNumericInputSx, minWidth: 88, width: 88, maxWidth: 88 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {readOnly ? (
                            <Typography variant="body2">{charge.isTaxable ? '✓' : '✗'}</Typography>
                          ) : (
                            <Checkbox
                              checked={charge.isTaxable}
                              onChange={(e) => updateCharge(index, { isTaxable: e.target.checked })}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell align="center" sx={voucherLineCellSx('gstPercent')}>
                          {readOnly ? (
                            <Typography variant="body2">{charge.gstPercent}%</Typography>
                          ) : (
                            <TextField
                              type="number"
                              value={charge.gstPercent}
                              onChange={(e) => updateCharge(index, { gstPercent: e.target.value })}
                              disabled={!charge.isTaxable}
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0, max: 28, step: '0.01' }}
                              sx={voucherLineCompactFieldSx('gstPercent', 'percent')}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">₹{gstAmount.toFixed(2)}</Typography>
                        </TableCell>
                        {!readOnly && (
                          <TableCell align="center">
                            <IconButton
                              onClick={() => removeCharge(index)}
                              size="small"
                              disabled={charges.length === 1}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Box sx={{ p: 1.5, backgroundColor: '#f9f9f9', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="body2">
                      <strong>Total Charges:</strong> ₹{totalCharges.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Typography variant="body2">
                      <strong>Total Charge GST:</strong> ₹{totalChargeGST.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2">
                      <strong>Charge Total (with GST):</strong> ₹{(totalCharges + totalChargeGST).toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </>
          ) : (
            !readOnly && (
              <Button startIcon={<AddIcon />} onClick={addCharge} fullWidth variant="outlined">
                Add Additional Charge
              </Button>
            )
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

AdditionalCharges.displayName = 'AdditionalCharges';

export default AdditionalCharges;
