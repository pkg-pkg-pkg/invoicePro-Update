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
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { StockItem } from '../../services/vouchers/enhancedVoucherService';
import {
  inventoryItemService,
  INVENTORY_ITEMS_CHANGED_EVENT,
} from '../../services/masters/inventoryItemService';
import type { InventoryItem } from '../../types/masters';
import { unitOfMeasureService } from '../../services/masters/unitOfMeasureService';

function mapInventoryToStockItem(item: InventoryItem, unitLabel: string): StockItem {
  return {
    item_code: item.sku,
    item_name: item.name,
    hsn_code: item.hsnCode ?? undefined,
    gst_rate: Number(item.gstRate ?? 0),
    purchase_rate: Number(item.pricing?.purchase ?? 0),
    sale_rate: Number(item.pricing?.sale ?? item.pricing?.mrp ?? 0),
    mrp: Number(item.pricing?.mrp ?? item.pricing?.sale ?? 0),
    unit: unitLabel,
    current_stock: Number(item.currentStock ?? 0),
    min_stock_level: Number(item.reorderLevel ?? 0),
    is_taxable: Number(item.gstRate ?? 0) > 0,
    is_active: item.status === 'ACTIVE',
  };
}

interface StockItemSelectionPopupProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: StockItem) => void;
  onCreateNew: () => void;
}

const TALLY_COLORS = {
  headerBg: '#1F3864',
  formBg: '#FFFFFF',
  tableHeaderBg: '#E8E8E8',
  tableRowEven: '#FFFFFF',
  tableRowOdd: '#F8F8F8',
  primaryBlue: '#1976D2',
  dangerRed: '#D32F2F',
  warningYellow: '#FFA726',
};

const StockItemSelectionPopup: React.FC<StockItemSelectionPopupProps> = ({
  open,
  onClose,
  onSelect,
  onCreateNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [items, units] = await Promise.all([
        inventoryItemService.list({ includeInactive: false, status: 'ACTIVE' }),
        unitOfMeasureService.list(),
      ]);
      const unitMap = new Map(units.map((u) => [u.id, u.symbol || u.name]));
      setStockItems(
        items.map((item) => mapInventoryToStockItem(item, unitMap.get(item.unitId) ?? '—'))
      );
    } catch (err) {
      console.error(err);
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stock items when opened — same source as Items desk & sales voucher picker
  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return;
    const onChange = () => void loadItems();
    window.addEventListener(INVENTORY_ITEMS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INVENTORY_ITEMS_CHANGED_EVENT, onChange);
  }, [open, loadItems]);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!searchTerm) return stockItems;
    
    const lowerSearch = searchTerm.toLowerCase();
    return stockItems.filter(item =>
      item.item_name.toLowerCase().includes(lowerSearch) ||
      item.item_code?.toLowerCase().includes(lowerSearch) ||
      item.hsn_code?.toLowerCase().includes(lowerSearch)
    );
  }, [stockItems, searchTerm]);

  // Handle keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleClose = useCallback(() => {
    setSearchTerm('');
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!open) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        break;
    }
  }, [open, filteredItems, selectedIndex, onSelect, handleClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, handleKeyDown]);

  const handleItemSelect = (item: StockItem) => {
    onSelect(item);
    handleClose();
  };

  const formatStock = (quantity: number, unit: string) => {
    if (quantity < 0) {
      return (
        <Typography 
          sx={{ color: TALLY_COLORS.dangerRed, fontWeight: 'bold' }}
          component="span"
        >
          (-) {Math.abs(quantity)} {unit}
        </Typography>
      );
    } else if (quantity === 0) {
      return (
        <Typography 
          sx={{ color: 'text.secondary' }}
          component="span"
        >
          0 {unit}
        </Typography>
      );
    } else {
      return (
        <Typography 
          sx={{ color: 'success.main', fontWeight: 'bold' }}
          component="span"
        >
          {quantity} {unit}
        </Typography>
      );
    }
  };

  const highlightMatch = (text: string) => {
    if (!searchTerm) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? 
        <span key={index} style={{ backgroundColor: '#FFEB3B', fontWeight: 'bold' }}>
          {part}
        </span> : part
    );
  };

  const getStockStatus = (quantity: number) => {
    if (quantity < 0) return 'negative';
    if (quantity === 0) return 'zero';
    return 'positive';
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      disableRestoreFocus
      maxWidth="lg"
      fullWidth
      PaperProps={{
        'data-tally-picker-modal': '',
        sx: {
          bgcolor: TALLY_COLORS.formBg,
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: TALLY_COLORS.headerBg, 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">List of Inventory Items</Typography>
        <IconButton type="button" onClick={handleClose} sx={{ color: 'white' }} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {/* Search Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
          <TextField
            fullWidth
            placeholder="Search item name, item code, or HSN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            size="small"
            InputProps={{
              startAdornment: (
                <Typography variant="caption" sx={{ mr: 1, color: 'textSecondary' }}>
                  Type to search, ↑↓ to navigate, Enter to select
                </Typography>
              ),
            }}
          />
        </Box>

        {/* Create New Button */}
        <Box sx={{ p: 2, bgcolor: TALLY_COLORS.tableRowOdd }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateNew}
            fullWidth
            sx={{ mb: 1 }}
          >
            Create New Item
          </Button>
        </Box>

        {/* Stock Items List */}
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography>Loading stock items...</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: TALLY_COLORS.tableHeaderBg }}>
                <TableCell width="5%">#</TableCell>
                <TableCell width="35%">Item Name</TableCell>
                <TableCell width="20%">Item Code</TableCell>
                <TableCell width="25%">Current Stock</TableCell>
                <TableCell width="15%">Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item, index) => (
                <TableRow
                  key={item.id}
                  selected={index === selectedIndex}
                  onClick={() => handleItemSelect(item)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: index === selectedIndex 
                      ? TALLY_COLORS.primaryBlue + '20' 
                      : index % 2 === 0 
                        ? TALLY_COLORS.tableRowEven 
                        : TALLY_COLORS.tableRowOdd,
                    '&:hover': {
                      bgcolor: TALLY_COLORS.primaryBlue + '10',
                    },
                    position: 'relative',
                  }}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {highlightMatch(item.item_name)}
                      </Typography>
                      {item.hsn_code && (
                        <Typography variant="caption" color="textSecondary" display="block">
                          HSN: {item.hsn_code}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">
                      {highlightMatch(item.item_code || '-')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {formatStock(item.current_stock, item.unit)}
                      {getStockStatus(item.current_stock) === 'negative' && (
                        <WarningIcon 
                          sx={{ 
                            color: TALLY_COLORS.dangerRed, 
                            fontSize: 16 
                          }} 
                          titleAccess="Negative stock - item is oversold"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 'medium' }}>
                      ₹{item.sale_rate?.toFixed(2) || '0.00'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filteredItems.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">
              {searchTerm ? 'No items found matching your search.' : 'No stock items found.'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        bgcolor: TALLY_COLORS.tableHeaderBg, 
        p: 2 
      }}>
        <Typography variant="caption" color="textSecondary">
          ↑↓ Navigate | Enter Select | Escape Close | Ctrl+N Create New
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="textSecondary">
            <Box component="span" sx={{ color: TALLY_COLORS.dangerRed }}>
              (-) Negative Stock
            </Box>
            {' | '}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              0 Zero Stock
            </Box>
            {' | '}
            <Box component="span" sx={{ color: 'success.main' }}>
              Positive Stock
            </Box>
          </Typography>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default StockItemSelectionPopup;
