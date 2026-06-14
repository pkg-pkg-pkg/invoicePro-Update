import { useCallback, useState } from 'react';

import { Button } from '@mui/material';

import PrintIcon from '@mui/icons-material/Print';

import type { InventoryItem } from '../../types/masters';

import { renderBarcodeDataUrl } from '../../services/barcode/barcodeRenderer';

import { buildBulkBarcodeHtml, openBarcodePrintWindow } from '../items/barcodePrintStyles';

import { resolvePrintBarcode } from '../../services/barcode/barcodeLookup';



type Props = {

  items: InventoryItem[];

  disabled?: boolean;

};



export function BulkBarcodePrintButton({ items, disabled }: Props) {

  const [printing, setPrinting] = useState(false);



  const handlePrint = useCallback(async () => {

    if (!items.length) return;

    setPrinting(true);

    try {

      const labels = await Promise.all(

        items.map(async (item) => {

          const code = resolvePrintBarcode(item);

          return {

            imageDataUrl: code ? await renderBarcodeDataUrl(code) : '',

            itemName: item.name,

            sku: item.sku,

            price: item.pricing?.sale != null ? String(item.pricing.sale) : undefined,

            mrp: item.pricing?.mrp != null ? String(item.pricing.mrp) : undefined,

            barcodeText: code ?? '',

          };

        })

      );

      openBarcodePrintWindow(buildBulkBarcodeHtml(labels.filter((l) => l.imageDataUrl), 4));

    } finally {

      setPrinting(false);

    }

  }, [items]);



  return (

    <Button

      size="small"

      variant="outlined"

      startIcon={<PrintIcon />}

      disabled={disabled || printing || !items.length}

      onClick={() => void handlePrint()}

    >

      Print Selected Labels ({items.length})

    </Button>

  );

}


