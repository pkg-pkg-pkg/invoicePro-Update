import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export default function PrintWindow() {
  const html = useMemo(() => localStorage.getItem('pve_print_html') || '', []);
  const [zoom, setZoom] = useState(100);

  const previewInfo = useMemo(() => {
    const normalized = html.toLowerCase();
    if (normalized.includes('@page { size: 58mm')) return 'Thermal 58mm';
    if (normalized.includes('@page { size: 80mm')) return 'Thermal 80mm';
    if (normalized.includes('@page { size: a5')) return 'A5';
    if (normalized.includes('@page { size: a4')) return 'A4';
    return 'Auto';
  }, [html]);

  const zoomIn = () => setZoom((z) => Math.min(200, z + 10));
  const zoomOut = () => setZoom((z) => Math.max(50, z - 10));
  const zoomReset = () => setZoom(100);

  const handlePrint = () => {
    try {
      const iframe = document.getElementById('print-preview-frame') as HTMLIFrameElement | null;
      const w = iframe?.contentWindow;
      if (!w) {
        alert('Preview frame not ready yet. Please try again.');
        return;
      }
      w.focus();
      w.print();
    } catch {
      alert('Printing blocked. Please try again.');
    }
  };

  const handleClose = () => {
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  if (!html) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Print preview unavailable
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No printable content was found.
        </Typography>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f5f5f5' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ p: 1.25, borderBottom: '1px solid #ddd', bgcolor: '#fff' }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="subtitle1" fontWeight={600}>
            Print Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Page: {previewInfo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Zoom: {zoom}%
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="text" startIcon={<ZoomOutIcon />} onClick={zoomOut}>
            Zoom Out
          </Button>
          <Button variant="text" startIcon={<ZoomInIcon />} onClick={zoomIn}>
            Zoom In
          </Button>
          <Button variant="text" startIcon={<RestartAltIcon />} onClick={zoomReset}>
            Reset
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={handleClose}>
            Close
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ flex: 1, p: 1.25 }}>
        <iframe
          id="print-preview-frame"
          title="Print Preview"
          srcDoc={html}
          style={{
            width: '100%',
            height: '100%',
            border: '1px solid #ddd',
            background: '#fff',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        />
      </Box>
    </Box>
  );
}
