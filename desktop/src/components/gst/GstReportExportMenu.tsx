import { Button, ButtonGroup, Menu, MenuItem } from '@mui/material';
import { FileDownload as FileDownloadIcon } from '@mui/icons-material';
import { useState } from 'react';
import { exportGstBundle, type GstExportFormat } from '../../services/gstReportExportService';

export function GstReportExportMenu(props: {
  title: string;
  baseFileName: string;
  sections: Array<{ heading: string; sheetName: string; rows: Record<string, unknown>[] }>;
  disabled?: boolean;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [busy, setBusy] = useState(false);

  const runExport = async (format: GstExportFormat) => {
    setAnchor(null);
    setBusy(true);
    try {
      await exportGstBundle({
        title: props.title,
        baseFileName: props.baseFileName,
        format,
        sections: props.sections,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ButtonGroup variant="outlined" disabled={props.disabled || busy}>
        <Button startIcon={<FileDownloadIcon />} onClick={(e) => setAnchor(e.currentTarget)}>
          Export
        </Button>
      </ButtonGroup>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => void runExport('pdf')}>PDF</MenuItem>
        <MenuItem onClick={() => void runExport('excel')}>Excel</MenuItem>
        <MenuItem onClick={() => void runExport('csv')}>CSV</MenuItem>
      </Menu>
    </>
  );
}
