import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import type { Godown, ItemCategory, UnitOfMeasure } from '../../types/masters';
import {
  attachImagesFromZip,
  buildImportPreview,
  downloadItemImportTemplate,
  importValidRows,
  type ItemImportPreview,
  type ItemImportResult,
} from '../../services/items/itemImportService';

type Props = {
  open: boolean;
  categories: ItemCategory[];
  units: UnitOfMeasure[];
  godowns: Godown[];
  onClose: () => void;
  onImported: (summary: ItemImportResult) => void;
};

export function ItemImportDialog({ open, categories, units, godowns, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ItemImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewTab, setPreviewTab] = useState(0);
  const [importResult, setImportResult] = useState<ItemImportResult | null>(null);
  const [imageResult, setImageResult] = useState<string | null>(null);

  const reset = () => {
    setPreview(null);
    setFileName(null);
    setParseError(null);
    setPreviewTab(0);
    setImageResult(null);
    setImportResult(null);
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setPreview(null);
    setFileName(file.name);
    setImageResult(null);
    try {
      const result = await buildImportPreview(file, categories, units);
      setPreview(result);
      setPreviewTab(result.invalid.length ? 1 : 0);
    } catch (err) {
      setParseError((err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!preview?.valid.length) {
      setParseError('No valid records to import');
      return;
    }
    const defaultUnitId = units[0]?.id;
    if (!defaultUnitId) {
      setParseError('Create at least one Unit of Measure before importing items.');
      return;
    }
    const defaultGodown = godowns.find((g) => g.isDefault) ?? godowns[0];
    setImporting(true);
    setParseError(null);
    try {
      const result = await importValidRows(preview, {
        defaultUnitId,
        defaultGodownId: defaultGodown?.id ?? null,
      });
      setImportResult(result);
      onImported(result);
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleZipImages = async (file: File) => {
    setImageResult(null);
    setParseError(null);
    setImporting(true);
    try {
      const { matched, skipped } = await attachImagesFromZip(file);
      setImageResult(`Attached ${matched} image(s). Skipped ${skipped} file(s).`);
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle fontWeight={800}>Import Items</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Upload Excel (.xlsx) or CSV (.csv). Download the template, fill your items, then import. Valid rows sync
            instantly with Sales, Purchase, Price Lists, and Reports.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => void downloadItemImportTemplate('xlsx')}
            >
              Template (Excel)
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => void downloadItemImportTemplate('csv')}
            >
              Template (CSV)
            </Button>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
              Upload Excel / CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
          </Stack>

          {fileName ? (
            <Typography variant="caption" color="text.secondary">
              Selected file: {fileName}
            </Typography>
          ) : null}

          {parseError ? <Alert severity="error">{parseError}</Alert> : null}
          {importResult ? (
            <Alert severity={importResult.failed > 0 ? 'warning' : 'success'}>
              Imported: {importResult.imported} · Updated: {importResult.updated} · Failed:{' '}
              {importResult.failed}
              {importResult.errors.length ? (
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  {importResult.errors.slice(0, 8).map((e) => (
                    <li key={e}>
                      <Typography variant="caption">{e}</Typography>
                    </li>
                  ))}
                </Box>
              ) : null}
            </Alert>
          ) : null}

          {imageResult ? <Alert severity="success">{imageResult}</Alert> : null}

          {importing ? <LinearProgress /> : null}

          {preview ? (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="success.main" fontWeight={700}>
                  Valid: {preview.valid.length}
                </Typography>
                <Typography variant="subtitle2" color="error.main" fontWeight={700}>
                  Invalid: {preview.invalid.length}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  Total rows: {preview.total}
                </Typography>
              </Stack>

              <Tabs value={previewTab} onChange={(_, v) => setPreviewTab(v)} sx={{ mb: 1 }}>
                <Tab label={`Valid (${preview.valid.length})`} />
                <Tab label={`Invalid (${preview.invalid.length})`} />
              </Tabs>

              <TableContainer sx={{ maxHeight: 280, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 56 }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                      {previewTab === 1 ? (
                        <TableCell sx={{ fontWeight: 700 }}>Errors</TableCell>
                      ) : (
                        <>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            GST %
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Stock
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(previewTab === 0 ? preview.valid : preview.invalid).slice(0, 200).map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.partial.name}</TableCell>
                        <TableCell>{row.partial.sku || '—'}</TableCell>
                        {previewTab === 1 ? (
                          <TableCell>
                            {row.errors.map((e) => (
                              <Typography key={e} variant="caption" display="block" color="error">
                                {e}
                              </Typography>
                            ))}
                          </TableCell>
                        ) : (
                          <>
                            <TableCell align="right">{row.partial.gstRate ?? '—'}</TableCell>
                            <TableCell align="right">{row.partial.openingStock ?? 0}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {(previewTab === 0 ? preview.valid : preview.invalid).length > 200 ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Showing first 200 rows…
                </Typography>
              ) : null}
            </Box>
          ) : null}

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Bulk images (optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Upload a ZIP with files named SKU.jpg or SKU.png (e.g. PVC150.jpg). Run after items are imported.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              disabled={importing}
              onClick={() => zipRef.current?.click()}
            >
              Upload image ZIP
            </Button>
            <input
              ref={zipRef}
              type="file"
              hidden
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleZipImages(f);
                e.target.value = '';
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={handleClose} disabled={importing}>
          {importResult ? 'Done' : 'Cancel'}
        </Button>
        <Button
          variant="contained"
          disabled={importing || importResult !== null || !preview?.valid.length}
          onClick={() => void handleImport()}
        >
          {importing ? 'Importing…' : `Import ${preview?.valid.length ?? 0} valid item(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ItemImportDialog;
