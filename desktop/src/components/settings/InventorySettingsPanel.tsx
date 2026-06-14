import { useState } from 'react';

import {

  Alert,

  Box,

  Button,

  Checkbox,

  Divider,

  FormControl,

  FormControlLabel,

  Radio,

  RadioGroup,

  Stack,

  TextField,

  Typography,

} from '@mui/material';

import {

  readInventorySettings,

  writeInventorySettings,

  type BarcodeLabelFields,

  type BarcodeLabelSizeKey,

  type BarcodeScanMode,

} from '../../services/inventory/lowStockSettings';



export default function InventorySettingsPanel() {

  const initial = readInventorySettings();

  const [threshold, setThreshold] = useState(initial.globalLowStockThreshold);

  const [scanMode, setScanMode] = useState<BarcodeScanMode>(initial.barcodeScanMode);

  const [labelSize, setLabelSize] = useState<BarcodeLabelSizeKey>(initial.barcodeLabelSize);

  const [customW, setCustomW] = useState(initial.barcodeLabelCustomWidthMm ?? 38);

  const [customH, setCustomH] = useState(initial.barcodeLabelCustomHeightMm ?? 25);

  const [labelFields, setLabelFields] = useState<BarcodeLabelFields>(initial.barcodeLabelFields);

  const [saved, setSaved] = useState(false);



  const toggleField = (key: keyof BarcodeLabelFields) => {

    setLabelFields((prev) => ({ ...prev, [key]: !prev[key] }));

  };



  const save = () => {

    writeInventorySettings({

      globalLowStockThreshold: Number(threshold) || 10,

      barcodeScanMode: scanMode,

      barcodeLabelSize: labelSize,

      barcodeLabelCustomWidthMm: Number(customW) || 38,

      barcodeLabelCustomHeightMm: Number(customH) || 25,

      barcodeLabelFields: labelFields,

    });

    setSaved(true);

    window.setTimeout(() => setSaved(false), 2500);

  };



  return (

    <Stack spacing={3}>

      <Box>

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>

          Low Stock

        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>

          Default threshold when a new item has no per-item reorder level.

        </Typography>

        <TextField

          label="Default Low Stock Threshold (pcs)"

          type="number"

          size="small"

          value={threshold}

          onChange={(e) => setThreshold(Number(e.target.value) || 0)}

          inputProps={{ min: 0 }}

          sx={{ maxWidth: 280 }}

        />

      </Box>



      <Divider />



      <Box>

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>

          Barcode Settings

        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>

          Scan mode (Sales / Purchase vouchers)

        </Typography>

        <FormControl>

          <RadioGroup value={scanMode} onChange={(e) => setScanMode(e.target.value as BarcodeScanMode)}>

            <FormControlLabel value="AUTO_ADD" control={<Radio />} label="Auto Add Qty +1" />

            <FormControlLabel value="ASK_QUANTITY" control={<Radio />} label="Ask Quantity After Scan" />

          </RadioGroup>

        </FormControl>

      </Box>



      <Divider />



      <Box>

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>

          Barcode Labels

        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>

          Label size

        </Typography>

        <FormControl sx={{ mb: 2 }}>

          <RadioGroup value={labelSize} onChange={(e) => setLabelSize(e.target.value as BarcodeLabelSizeKey)}>

            <FormControlLabel value="25x15" control={<Radio />} label="25×15 mm" />

            <FormControlLabel value="38x25" control={<Radio />} label="38×25 mm" />

            <FormControlLabel value="50x25" control={<Radio />} label="50×25 mm" />

            <FormControlLabel value="custom" control={<Radio />} label="Custom" />

          </RadioGroup>

        </FormControl>

        {labelSize === 'custom' ? (

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>

            <TextField

              label="Width (mm)"

              type="number"

              size="small"

              value={customW}

              onChange={(e) => setCustomW(Number(e.target.value) || 0)}

            />

            <TextField

              label="Height (mm)"

              type="number"

              size="small"

              value={customH}

              onChange={(e) => setCustomH(Number(e.target.value) || 0)}

            />

          </Stack>

        ) : null}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>

          Fields on printed label

        </Typography>

        <Stack>

          <FormControlLabel control={<Checkbox checked={labelFields.itemName} onChange={() => toggleField('itemName')} />} label="Item Name" />

          <FormControlLabel control={<Checkbox checked={labelFields.barcode} onChange={() => toggleField('barcode')} />} label="Barcode" />

          <FormControlLabel control={<Checkbox checked={labelFields.sku} onChange={() => toggleField('sku')} />} label="SKU" />

          <FormControlLabel control={<Checkbox checked={labelFields.mrp} onChange={() => toggleField('mrp')} />} label="MRP" />

          <FormControlLabel control={<Checkbox checked={labelFields.salePrice} onChange={() => toggleField('salePrice')} />} label="Sale Price" />

        </Stack>

      </Box>



      <Button variant="contained" onClick={save} sx={{ alignSelf: 'flex-start' }}>

        Save inventory settings

      </Button>

      {saved ? <Alert severity="success">Inventory settings saved.</Alert> : null}

    </Stack>

  );

}


