import {
  Box,
  Button,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { InventoryItem } from '../../types/masters';
import type { SalesPipelineLineItem } from '../../types/salesDocuments';
import { calcSalesLine } from '../../services/sales/salesPipelineCalc';
import { formatCurrency } from '../../utils/formatters';
import { generateId } from '../../utils/id';
import {
  voucherLineCellSx,
  voucherLineCompactFieldSx,
  voucherLineTableContainerSx,
  voucherLineTableSx,
  voucherLineAmountDisplaySx,
} from '../../theme/voucherLineItemTableStyles';

type Props = {
  lines: SalesPipelineLineItem[];
  catalog: InventoryItem[];
  showHsn?: boolean;
  showStock?: boolean;
  showFulfillment?: boolean;
  onChange: (lines: SalesPipelineLineItem[]) => void;
};

function emptyLine(): SalesPipelineLineItem {
  return {
    id: generateId('line'),
    itemName: '',
    description: '',
    hsnCode: '',
    qty: 1,
    unit: 'pcs',
    rate: 0,
    discountPercent: 0,
    gstPercent: 18,
    amount: 0,
    qtyDispatched: 0,
    qtyPending: 1,
  };
}

export function SalesPipelineLineItemsTable({
  lines,
  catalog,
  showHsn,
  showStock,
  showFulfillment,
  onChange,
}: Props) {
  const updateLine = (index: number, patch: Partial<SalesPipelineLineItem>) => {
    const next = lines.map((line, i) => {
      if (i !== index) return line;
      const merged = { ...line, ...patch };
      const calc = calcSalesLine(merged);
      return {
        ...merged,
        amount: calc.amount,
        qtyPending: showFulfillment ? Math.max(0, Number(merged.qty || 0) - Number(merged.qtyDispatched || 0)) : merged.qtyPending,
      };
    });
    onChange(next);
  };

  const pickItem = (index: number, itemId: string) => {
    const item = catalog.find((x) => x.id === itemId);
    if (!item) return;
    updateLine(index, {
      itemId: item.id,
      itemName: item.name,
      hsnCode: item.hsnCode ?? '',
      rate: item.pricing?.sale ?? 0,
      gstPercent: item.gstRate ?? 18,
      unit: 'pcs',
    });
  };

  return (
    <Box sx={voucherLineTableContainerSx}>
      <Table size="small" sx={voucherLineTableSx}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Item</TableCell>
            {showHsn ? <TableCell>HSN</TableCell> : null}
            <TableCell>Description</TableCell>
            <TableCell align="right" sx={voucherLineCellSx('qty')}>Qty</TableCell>
            <TableCell sx={voucherLineCellSx('unit')}>Unit</TableCell>
            <TableCell align="right" sx={voucherLineCellSx('rate')}>Rate (₹)</TableCell>
            <TableCell align="right" sx={voucherLineCellSx('discPercent')}>Disc %</TableCell>
            <TableCell align="right" sx={voucherLineCellSx('gstPercent')}>GST %</TableCell>
            <TableCell align="right">Amount (₹)</TableCell>
            {showFulfillment ? (
              <>
                <TableCell align="right">Dispatched</TableCell>
                <TableCell align="right">Pending</TableCell>
              </>
            ) : null}
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line, index) => {
            const stockItem = catalog.find((x) => x.id === line.itemId);
            const stock = stockItem?.currentStock ?? 0;
            const overStock = showStock && Number(line.qty) > stock;
            return (
              <TableRow key={line.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={line.itemId ?? ''}
                    onChange={(e) => pickItem(index, e.target.value)}
                  >
                    <MenuItem value="">Select item</MenuItem>
                    {catalog.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {showStock && line.itemId ? (
                    <Typography variant="caption" color={overStock ? 'error.main' : 'text.secondary'}>
                      stock: {stock} {line.unit ?? 'pcs'}
                    </Typography>
                  ) : null}
                </TableCell>
                {showHsn ? (
                  <TableCell>
                    <TextField size="small" value={line.hsnCode ?? ''} onChange={(e) => updateLine(index, { hsnCode: e.target.value })} />
                  </TableCell>
                ) : null}
                <TableCell>
                  <TextField size="small" fullWidth value={line.description ?? ''} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </TableCell>
                <TableCell align="right" sx={voucherLineCellSx('qty')}>
                  <TextField
                    size="small"
                    type="number"
                    sx={voucherLineCompactFieldSx('qty', 'percent')}
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: Number(e.target.value) })}
                    error={overStock}
                  />
                </TableCell>
                <TableCell sx={voucherLineCellSx('unit')}>
                  <TextField size="small" sx={voucherLineCompactFieldSx('unit')} value={line.unit ?? ''} onChange={(e) => updateLine(index, { unit: e.target.value })} />
                </TableCell>
                <TableCell align="right" sx={voucherLineCellSx('rate')}>
                  <TextField size="small" type="number" sx={voucherLineCompactFieldSx('rate')} value={line.rate} onChange={(e) => updateLine(index, { rate: Number(e.target.value) })} />
                </TableCell>
                <TableCell align="right" sx={voucherLineCellSx('discPercent')}>
                  <TextField size="small" type="number" sx={voucherLineCompactFieldSx('discPercent', 'percent')} value={line.discountPercent} onChange={(e) => updateLine(index, { discountPercent: Number(e.target.value) })} />
                </TableCell>
                <TableCell align="right" sx={voucherLineCellSx('gstPercent')}>
                  <TextField size="small" type="number" sx={voucherLineCompactFieldSx('gstPercent', 'percent')} value={line.gstPercent} onChange={(e) => updateLine(index, { gstPercent: Number(e.target.value) })} />
                </TableCell>
                <TableCell align="right">
                  <Typography component="span" sx={voucherLineAmountDisplaySx}>
                    {formatCurrency(line.amount)}
                  </Typography>
                </TableCell>
                {showFulfillment ? (
                  <>
                    <TableCell align="right" sx={voucherLineCellSx('qty')}>
                      <TextField size="small" type="number" sx={voucherLineCompactFieldSx('qty', 'percent')} value={line.qtyDispatched ?? 0} onChange={(e) => updateLine(index, { qtyDispatched: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell align="right">{line.qtyPending ?? 0}</TableCell>
                  </>
                ) : null}
                <TableCell>
                  <IconButton size="small" onClick={() => onChange(lines.filter((_, i) => i !== index))}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Stack direction="row" sx={{ p: 1 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...lines, emptyLine()])}>
          Add Row
        </Button>
      </Stack>
    </Box>
  );
}
