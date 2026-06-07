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
  Chip,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Ledger } from '../../services/vouchers/enhancedVoucherService';
import { enhancedVoucherService } from '../../services/vouchers/enhancedVoucherService';

interface PartySelectionPopupProps {
  open: boolean;
  onClose: () => void;
  onSelect: (party: Ledger) => void;
  onCreateNew: () => void;
}

const PICKER_COLORS = {
  headerBg: '#1F3864',
  formBg: '#FFFFFF',
  tableHeaderBg: '#E8E8E8',
  tableRowEven: '#FFFFFF',
  tableRowOdd: '#F8F8F8',
  primaryBlue: '#1976D2',
};

const PartySelectionPopup: React.FC<PartySelectionPopupProps> = ({
  open,
  onClose,
  onSelect,
  onCreateNew,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [parties, setParties] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load parties on mount
  useEffect(() => {
    if (open) {
      setLoading(true);
      enhancedVoucherService.getCustomerLedgers()
        .then(setParties)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open]);

  // Filter parties based on search term
  const filteredParties = useMemo(() => {
    if (!searchTerm) return parties;
    
    const lowerSearch = searchTerm.toLowerCase();
    return parties.filter(party =>
      party.name.toLowerCase().includes(lowerSearch) ||
      party.alias?.toLowerCase().includes(lowerSearch) ||
      party.gstin?.toLowerCase().includes(lowerSearch)
    );
  }, [parties, searchTerm]);

  // Handle keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!open) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredParties.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredParties[selectedIndex]) {
          onSelect(filteredParties[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [open, filteredParties, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePartySelect = (party: Ledger) => {
    onSelect(party);
    setSearchTerm('');
    onClose();
  };

  const formatBalance = (balance: number, type: string) => {
    const formatted = Math.abs(balance).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
    return `${type} ${formatted}`;
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

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
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
        <Typography variant="h6">List of Ledger Accounts</Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        {/* Search Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid #ddd' }}>
          <TextField
            fullWidth
            placeholder="Search party name, alias, or GSTIN..."
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
        <Box sx={{ p: 2, bgcolor: PICKER_COLORS.tableRowOdd }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateNew}
            fullWidth
            sx={{ mb: 1 }}
          >
            Create New Party
          </Button>
        </Box>

        {/* Party List */}
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography>Loading parties...</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: PICKER_COLORS.tableHeaderBg }}>
                <TableCell width="5%">#</TableCell>
                <TableCell width="45%">Party Name</TableCell>
                <TableCell width="35%">Outstanding Balance</TableCell>
                <TableCell width="15%">GSTIN</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredParties.map((party, index) => (
                <TableRow
                  key={party.id}
                  selected={index === selectedIndex}
                  onClick={() => handlePartySelect(party)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: index === selectedIndex 
                      ? PICKER_COLORS.primaryBlue + '20' 
                      : index % 2 === 0 
                        ? PICKER_COLORS.tableRowEven 
                        : PICKER_COLORS.tableRowOdd,
                    '&:hover': {
                      bgcolor: PICKER_COLORS.primaryBlue + '10',
                    },
                  }}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    {highlightMatch(party.name)}
                    {party.alias && (
                      <Typography variant="caption" display="block" color="textSecondary">
                        Alias: {highlightMatch(party.alias)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        color: party.opening_balance < 0 ? 'error.main' : 'success.main',
                        fontWeight: 'bold'
                      }}
                    >
                      {formatBalance(party.opening_balance || 0, party.balance_type || 'Dr')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">
                      {party.gstin || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filteredParties.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">
              {searchTerm ? 'No parties found matching your search.' : 'No parties found.'}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        bgcolor: PICKER_COLORS.tableHeaderBg, 
        p: 2 
      }}>
        <Typography variant="caption" color="textSecondary">
          ↑↓ Navigate | Enter Select | Escape Close | Ctrl+N Create New
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

export default PartySelectionPopup;
