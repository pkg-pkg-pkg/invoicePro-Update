import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Dialog,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type TallyPickerColumn<T> = {
  id: string;
  header: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
};

export type TallyListPickerModalProps<T> = {
  open: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder: string;
  hintText?: string;
  rows: T[];
  getRowKey: (row: T) => string;
  filterRow: (row: T, query: string) => boolean;
  columns: TallyPickerColumn<T>[];
  onSelect: (row: T) => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
  emptyMessage?: string;
  footerHint?: string;
  /** When this value changes while the dialog is open, search + highlight reset (e.g. pick item for another line). */
  sessionKey?: string | null;
  /** Optional initial query to prefill search when modal opens. */
  initialQuery?: string;
};

const HEADER_BG = 'primary.dark';

export function TallyListPickerModal<T>({
  open,
  onClose,
  title,
  searchPlaceholder,
  hintText = 'Type to search, ↑ ↓ to navigate, Enter to select.',
  rows,
  getRowKey,
  filterRow,
  columns,
  onSelect,
  onCreateNew,
  createNewLabel = '+ Create new',
  emptyMessage = 'No results.',
  footerHint = '↑ ↓ Navigate | Enter Select | Escape Close' + (onCreateNew ? ' | Ctrl+N Create New' : ''),
  sessionKey,
  initialQuery = '',
}: TallyListPickerModalProps<T>) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const highlightRef = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((r) => filterRow(r, q));
  }, [rows, query, filterRow]);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setHighlight(0);
    highlightRef.current = 0;
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, sessionKey, initialQuery]);

  useEffect(() => {
    highlightRef.current = highlight;
  }, [highlight]);

  useEffect(() => {
    setHighlight((h) => {
      if (filtered.length === 0) return 0;
      return Math.min(h, filtered.length - 1);
    });
  }, [filtered.length]);

  useEffect(() => {
    const el = rowRefs.current.get(highlight);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, filtered]);

  const selectIndex = useCallback(
    (idx: number) => {
      const list = filtered;
      const safe = Math.max(0, Math.min(idx, list.length - 1));
      const row = list[safe];
      if (row) onSelect(row);
    },
    [filtered, onSelect]
  );

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (onCreateNew && e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onCreateNew();
      }
    };
    document.addEventListener('keydown', onDocKey, true);
    return () => document.removeEventListener('keydown', onDocKey, true);
  }, [open, onCreateNew]);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((h) => {
        const n = Math.min(h + 1, Math.max(filtered.length - 1, 0));
        highlightRef.current = n;
        return n;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((h) => {
        const n = Math.max(h - 1, 0);
        highlightRef.current = n;
        return n;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) selectIndex(highlightRef.current);
    }
  };

  const onTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((h) => {
        const n = Math.min(h + 1, Math.max(filtered.length - 1, 0));
        highlightRef.current = n;
        return n;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((h) => {
        const n = Math.max(h - 1, 0);
        highlightRef.current = n;
        return n;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filtered.length) selectIndex(highlightRef.current);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      disableAutoFocus={false}
      disableEnforceFocus={false}
      fullWidth
      maxWidth="md"
      scroll="paper"
      sx={{ zIndex: (t) => t.zIndex.modal + 400 }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.55)' } },
      }}
      PaperProps={{
        elevation: 12,
        'data-tally-picker-modal': '',
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
          maxHeight: 'min(900px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: HEADER_BG,
          color: 'common.white',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <IconButton
          type="button"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{ color: 'common.white' }}
          aria-label="Close"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          {hintText}
        </Typography>
        <TextField
          inputRef={searchRef}
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onSearchKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
          autoComplete="off"
        />
      </Box>

      {onCreateNew && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Button
            type="button"
            fullWidth
            variant="contained"
            color="primary"
            onClick={onCreateNew}
            sx={{ py: 1, fontWeight: 700 }}
          >
            {createNewLabel}
          </Button>
        </Box>
      )}

      <TableContainer
        component={Paper}
        variant="outlined"
        square
        tabIndex={0}
        onKeyDown={onTableKeyDown}
        sx={{ flex: 1, minHeight: 200, mx: 2, mb: 1, borderRadius: 1 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48, bgcolor: 'action.hover', fontWeight: 700 }}>#</TableCell>
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  sx={{
                    bgcolor: 'action.hover',
                    fontWeight: 700,
                    width: c.width,
                  }}
                  align={c.align}
                >
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, idx) => (
                <TableRow
                  key={getRowKey(row)}
                  hover
                  selected={idx === highlight}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(row);
                  }}
                  onMouseEnter={() => {
                    setHighlight(idx);
                    highlightRef.current = idx;
                  }}
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                    else rowRefs.current.delete(idx);
                  }}
                  sx={{
                    cursor: 'pointer',
                    ...(idx === highlight
                      ? {
                          bgcolor: alpha(theme.palette.primary.main, 0.14),
                          boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
                        }
                      : {}),
                  }}
                >
                  <TableCell>{idx + 1}</TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.id} align={c.align}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1.5, textAlign: 'right', display: 'block' }}>
        {footerHint}
      </Typography>
    </Dialog>
  );
}
