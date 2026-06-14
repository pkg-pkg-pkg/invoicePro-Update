import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import FlashlightOnIcon from '@mui/icons-material/FlashlightOn';
import FlashlightOffIcon from '@mui/icons-material/FlashlightOff';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

export default function BarcodeScanner({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [lastCode, setLastCode] = useState('');

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    stopScanner();
    try {
      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();
      const cams = await BrowserMultiFormatReader.listVideoInputDevices();
      setDevices(cams);
      const deviceId = cams[deviceIndex]?.deviceId;
      if (!videoRef.current) return;

      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            const text = result.getText().trim();
            if (!text || text === lastCode) return;
            setLastCode(text);
            onScan(text);
            stopScanner();
            onClose();
          }
          if (err && String(err).indexOf('NotFoundException') < 0) {
            // continuous scan noise — ignore
          }
        }
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Camera unavailable. Use a USB barcode scanner or check permissions.'
      );
    }
  }, [deviceIndex, lastCode, onClose, onScan, stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setLastCode('');
      return;
    }
    void startScanner();
    return () => stopScanner();
  }, [open, startScanner, stopScanner]);

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
      if (!caps?.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      // torch not supported
    }
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    setDeviceIndex((i) => (i + 1) % devices.length);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" data-barcode-scanner>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Scan Barcode
        <IconButton onClick={onClose} aria-label="Close scanner">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            position: 'relative',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: '#000',
            minHeight: 280,
          }}
        >
          <video ref={videoRef} style={{ width: '100%', display: 'block' }} muted playsInline />
          <Box
            sx={{
              position: 'absolute',
              inset: '20% 10%',
              border: '2px solid',
              borderColor: lastCode ? 'success.main' : 'rgba(255,255,255,0.6)',
              borderRadius: 1,
              pointerEvents: 'none',
              boxShadow: lastCode ? '0 0 12px #4caf50' : 'none',
            }}
          />
        </Box>
        {error ? (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Point the camera at a barcode. USB scanners work without the camera — scan while this form is open.
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" startIcon={<CameraswitchIcon />} onClick={switchCamera} disabled={devices.length < 2}>
            Switch camera
          </Button>
          <Button
            size="small"
            startIcon={torchOn ? <FlashlightOffIcon /> : <FlashlightOnIcon />}
            onClick={() => void toggleTorch()}
          >
            Torch
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
