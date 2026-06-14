import { useCallback, useEffect, useState } from 'react';

import {

  Box,

  Button,

  FormControl,

  InputLabel,

  MenuItem,

  Select,

  Stack,

  Typography,

} from '@mui/material';

import PrintIcon from '@mui/icons-material/Print';

import type { BarcodeFormat } from '../../services/barcode/barcodeValue';

import { pickBarcodeFormat } from '../../services/barcode/barcodeValue';

import { renderBarcodeDataUrl } from '../../services/barcode/barcodeRenderer';

import {

  buildBarcodeLabelHtml,

  LABEL_SIZES,

  openBarcodePrintWindow,

  type LabelSize,

} from './barcodePrintStyles';



type Props = {

  barcode: string;

  itemName: string;

  sku?: string;

  price?: string;

  mrp?: string;

  format?: BarcodeFormat;

  compact?: boolean;

};



export function BarcodeGenerator({ barcode, itemName, sku, price, mrp, format, compact }: Props) {

  const [imgUrl, setImgUrl] = useState('');

  const [labelSize, setLabelSize] = useState<LabelSize>('medium');

  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>(

    format ?? pickBarcodeFormat(barcode)

  );



  useEffect(() => {

    let cancelled = false;

    void (async () => {

      if (!barcode.trim()) {

        setImgUrl('');

        return;

      }

      const url = await renderBarcodeDataUrl(barcode, barcodeFormat);

      if (!cancelled) setImgUrl(url);

    })();

    return () => {

      cancelled = true;

    };

  }, [barcode, barcodeFormat]);



  const handlePrint = useCallback(() => {

    if (!imgUrl) return;

    openBarcodePrintWindow(

      buildBarcodeLabelHtml({

        imageDataUrl: imgUrl,

        itemName,

        sku,

        price,

        mrp,

        barcodeText: barcode,

        size: labelSize,

      })

    );

  }, [barcode, imgUrl, itemName, sku, price, mrp, labelSize]);



  if (!barcode.trim()) return null;



  return (

    <Stack spacing={1.5} sx={{ mt: 1 }}>

      <Box

        sx={{

          border: '1px solid',

          borderColor: 'divider',

          borderRadius: 1,

          p: compact ? 1 : 2,

          textAlign: 'center',

          bgcolor: '#fff',

        }}

      >

        {imgUrl ? (

          <Box component="img" src={imgUrl} alt="Barcode" sx={{ maxWidth: '100%', maxHeight: compact ? 72 : 120 }} />

        ) : (

          <Typography variant="caption" color="text.secondary">

            Rendering…

          </Typography>

        )}

        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>

          {itemName}

        </Typography>

        {sku ? (

          <Typography variant="caption" color="text.secondary" display="block">

            SKU: {sku}

          </Typography>

        ) : null}

        {price ? (

          <Typography variant="caption" color="text.secondary">

            Sale: ₹ {price}

          </Typography>

        ) : null}

        {mrp ? (

          <Typography variant="caption" color="text.secondary" display="block">

            MRP: ₹ {mrp}

          </Typography>

        ) : null}

        <Typography variant="caption" display="block" color="text.secondary" sx={{ letterSpacing: 1 }}>

          {barcode}

        </Typography>

      </Box>



      {!compact && (

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>

          <FormControl size="small" sx={{ minWidth: 140 }}>

            <InputLabel>Format</InputLabel>

            <Select

              label="Format"

              value={barcodeFormat}

              onChange={(e) => setBarcodeFormat(e.target.value as BarcodeFormat)}

            >

              <MenuItem value="CODE128">CODE128</MenuItem>

              <MenuItem value="EAN13">EAN-13</MenuItem>

              <MenuItem value="QR">QR Code</MenuItem>

            </Select>

          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>

            <InputLabel>Label size</InputLabel>

            <Select

              label="Label size"

              value={labelSize}

              onChange={(e) => setLabelSize(e.target.value as LabelSize)}

            >

              {Object.entries(LABEL_SIZES).map(([key, v]) => (

                <MenuItem key={key} value={key}>

                  {v.label}

                </MenuItem>

              ))}

            </Select>

          </FormControl>

          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!imgUrl}>

            Print label

          </Button>

        </Stack>

      )}

    </Stack>

  );

}


