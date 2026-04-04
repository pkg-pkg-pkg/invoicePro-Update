// D:\PVEB\Desktop\src\pages\invoices.tsx
// GST Invoice screen with: mobile, item search, MRP, discount, GST breakup, print

import React, { useState, ChangeEvent, FormEvent } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Divider,
  Grid,
  MenuItem,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Print as PrintIcon } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";

// ==== Types ====

type SupplyType = "INTRA" | "INTER"; // Intra-state (CGST+SGST), Inter-state (IGST)

interface PartyDetails {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
}

interface InvoiceItem {
  id: number;
  description: string;
  hsn: string;
  qty: number;
  mrp: number;
  discountPercent: number;
  rate: number; // taxable rate after discount
  gstRate: number; // %
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number; // taxable + gst
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  supplyType: SupplyType;
  billTo: PartyDetails;
  shipTo: PartyDetails;
  items: InvoiceItem[];
  taxableAmountTotal: number;
  gstAmountTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
}

interface InvoiceItemForm {
  description: string;
  hsn: string;
  qty: string;
  mrp: string;
  discountPercent: string;
  rate: string;
  gstRate: string;
}

interface InvoiceFormState {
  date: string;
  dueDate: string;
  supplyType: SupplyType;
  billToName: string;
  billToAddress: string;
  billToGstin: string;
  billToMobile: string;
  shipToName: string;
  shipToAddress: string;
  shipToGstin: string;
  shipToMobile: string;
  items: InvoiceItemForm[];
}

// Product master just for suggestions
interface Product {
  id: number;
  name: string;
  hsn: string;
  mrp: number;
  gstRate: number;
}

// ==== Sample Products (aap apni zarurat ke hisab se badha sakte hain) ====

const products: Product[] = [
  { id: 1, name: "1.5 sqmm Copper Wire Roll 90m", hsn: "8544", mrp: 1450, gstRate: 18 },
  { id: 2, name: "10A Switch – Modular", hsn: "8536", mrp: 65, gstRate: 18 },
  { id: 3, name: "16A Socket – Modular", hsn: "8536", mrp: 95, gstRate: 18 },
  { id: 4, name: "LED Bulb 9W", hsn: "9405", mrp: 120, gstRate: 12 },
  { id: 5, name: "MCB 16A SP", hsn: "8536", mrp: 210, gstRate: 18 },
];

const today = () => new Date().toISOString().slice(0, 10);

// ==== Helper functions ====

const calculateItem = (formItem: InvoiceItemForm, id: number): InvoiceItem | null => {
  const qty = Number(formItem.qty);
  const mrp = Number(formItem.mrp);
  const discountPercent = Number(formItem.discountPercent || "0");
  let rate = Number(formItem.rate);

  if (Number.isNaN(qty) || qty <= 0) return null;

  // If rate not given, derive from MRP and discount
  if (!rate && mrp) {
    const factor = 1 - discountPercent / 100;
    rate = mrp * (factor > 0 ? factor : 1);
  }

  if (Number.isNaN(rate) || rate < 0) return null;

  const gstRate = Number(formItem.gstRate || "0");
  if (Number.isNaN(gstRate) || gstRate < 0) return null;

  const taxableAmount = qty * rate;
  const gstAmount = (taxableAmount * gstRate) / 100;
  const totalAmount = taxableAmount + gstAmount;

  return {
    id,
    description: formItem.description.trim(),
    hsn: formItem.hsn.trim(),
    qty,
    mrp: mrp || rate,
    discountPercent: discountPercent || 0,
    rate,
    gstRate,
    taxableAmount,
    gstAmount,
    totalAmount,
  };
};

const calculateTotals = (items: InvoiceItem[]) => {
  let taxableAmountTotal = 0;
  let gstAmountTotal = 0;
  let grandTotal = 0;

  for (const item of items) {
    taxableAmountTotal += item.taxableAmount;
    gstAmountTotal += item.gstAmount;
    grandTotal += item.totalAmount;
  }

  return { taxableAmountTotal, gstAmountTotal, grandTotal };
};

const formatMoney = (amount: number) =>
  amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const perUnitInclusivePrice = (rate: number, gstRate: number) =>
  rate + (rate * gstRate) / 100;

// ==== Component ====

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState(1);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  const [form, setForm] = useState<InvoiceFormState>({
    date: today(),
    dueDate: today(),
    supplyType: "INTRA",
    billToName: "",
    billToAddress: "",
    billToGstin: "",
    billToMobile: "",
    shipToName: "",
    shipToAddress: "",
    shipToGstin: "",
    shipToMobile: "",
    items: [
      {
        description: "",
        hsn: "",
        qty: "",
        mrp: "",
        discountPercent: "",
        rate: "",
        gstRate: "18",
      },
    ],
  });

  const openNewInvoiceDialog = () => {
    setForm({
      date: today(),
      dueDate: today(),
      supplyType: "INTRA",
      billToName: "",
      billToAddress: "",
      billToGstin: "",
      billToMobile: "",
      shipToName: "",
      shipToAddress: "",
      shipToGstin: "",
      shipToMobile: "",
      items: [
        {
          description: "",
          hsn: "",
          qty: "",
          mrp: "",
          discountPercent: "",
          rate: "",
          gstRate: "18",
        },
      ],
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const handleFormChange =
    (field: keyof InvoiceFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value as any,
      }));
    };

  const handleItemChange =
    (index: number, field: keyof InvoiceItemForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => {
        const newItems = [...prev.items];
        newItems[index] = {
          ...newItems[index],
          [field]: value,
        };
        return { ...prev, items: newItems };
      });
    };

  // Jab product select kare (search/dropdown se)
  const handleProductSelect = (index: number, product: Product | null) => {
    if (!product) return;
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        description: product.name,
        hsn: product.hsn,
        mrp: product.mrp.toString(),
        gstRate: product.gstRate.toString(),
        // rate empty rakhenge, taaki mrp+discount se auto nikle
      };
      return { ...prev, items: newItems };
    });
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          hsn: "",
          qty: "",
          mrp: "",
          discountPercent: "",
          rate: "",
          gstRate: "18",
        },
      ],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((prev) => {
      if (prev.items.length === 1) return prev; // at least one row
      const newItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: newItems };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!form.billToName.trim()) {
      alert("Bill To Name is required");
      return;
    }

    const calculatedItems: InvoiceItem[] = [];
    form.items.forEach((itemForm, idx) => {
      if (!itemForm.description.trim()) return; // skip empty rows
      const calculated = calculateItem(itemForm, idx + 1);
      if (calculated) {
        calculatedItems.push(calculated);
      }
    });

    if (calculatedItems.length === 0) {
      alert("Please add at least one valid item");
      return;
    }

    const { taxableAmountTotal, gstAmountTotal, grandTotal } =
      calculateTotals(calculatedItems);

    const invoiceNumber = `INV-${currentInvoiceNumber.toString().padStart(4, "0")}`;

    let igstTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;

    if (form.supplyType === "INTER") {
      igstTotal = gstAmountTotal;
    } else {
      cgstTotal = gstAmountTotal / 2;
      sgstTotal = gstAmountTotal / 2;
    }

    const newInvoice: Invoice = {
      id: invoices.length ? invoices[invoices.length - 1].id + 1 : 1,
      invoiceNumber,
      date: form.date,
      dueDate: form.dueDate,
      supplyType: form.supplyType,
      billTo: {
        name: form.billToName.trim(),
        address: form.billToAddress.trim(),
        gstin: form.billToGstin.trim(),
        mobile: form.billToMobile.trim(),
      },
      shipTo: {
        name: form.shipToName.trim() || form.billToName.trim(),
        address: form.shipToAddress.trim() || form.billToAddress.trim(),
        gstin: form.shipToGstin.trim() || form.billToGstin.trim(),
        mobile: form.shipToMobile.trim() || form.billToMobile.trim(),
      },
      items: calculatedItems,
      taxableAmountTotal,
      gstAmountTotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal,
    };

    setInvoices((prev) => [...prev, newInvoice]);
    setCurrentInvoiceNumber((prev) => prev + 1);
    setIsDialogOpen(false);
  };

  const handlePrint = (invoice: Invoice) => {
    setPrintInvoice(invoice);
    // Thoda delay de kar print call karein taaki layout render ho jaye
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Live totals preview for current form
  const getPreviewTotals = () => {
    const itemsPreview: InvoiceItem[] = [];
    form.items.forEach((itemForm, idx) => {
      const calc = calculateItem(itemForm, idx + 1);
      if (calc) itemsPreview.push(calc);
    });
    const { taxableAmountTotal, gstAmountTotal, grandTotal } =
      calculateTotals(itemsPreview);

    let igstTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;

    if (form.supplyType === "INTER") {
      igstTotal = gstAmountTotal;
    } else {
      cgstTotal = gstAmountTotal / 2;
      sgstTotal = gstAmountTotal / 2;
    }

    return { taxableAmountTotal, gstAmountTotal, grandTotal, igstTotal, cgstTotal, sgstTotal };
  };

  const previewTotals = getPreviewTotals();

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">GST Invoices</Typography>
          <Typography variant="body2" color="textSecondary">
            Create and manage GST-compliant tax invoices
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={openNewInvoiceDialog}
          startIcon={<AddIcon />}
        >
          New GST Invoice
        </Button>
      </Box>

      {/* Invoices List */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Customer (Bill To)</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell align="right">Taxable (₹)</TableCell>
              <TableCell align="right">GST (₹)</TableCell>
              <TableCell align="right">Total (₹)</TableCell>
              <TableCell align="center">Print</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No invoices yet. Click &quot;New GST Invoice&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell>{inv.invoiceNumber}</TableCell>
                  <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                  <TableCell>{inv.billTo.name}</TableCell>
                  <TableCell>{inv.billTo.mobile}</TableCell>
                  <TableCell align="right">{formatMoney(inv.taxableAmountTotal)}</TableCell>
                  <TableCell align="right">{formatMoney(inv.gstAmountTotal)}</TableCell>
                  <TableCell align="right">{formatMoney(inv.grandTotal)}</TableCell>
                  <TableCell align="center">
                    <IconButton onClick={() => handlePrint(inv)} size="small">
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* New Invoice Dialog */}
      <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="lg">
        <DialogTitle>New GST Invoice</DialogTitle>
        <DialogContent dividers>
          <Box component="form" onSubmit={handleSubmit} mt={1}>
            {/* Top row: Invoice info & supply type */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Invoice Number"
                  value={`INV-${currentInvoiceNumber.toString().padStart(4, "0")}`}
                  fullWidth
                  margin="normal"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Invoice Date"
                  type="date"
                  value={form.date}
                  onChange={handleFormChange("date")}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Due Date"
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange("dueDate")}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label="Supply Type"
                  value={form.supplyType}
                  onChange={handleFormChange("supplyType")}
                  fullWidth
                  margin="normal"
                >
                  <MenuItem value="INTRA">Intra-State (CGST + SGST)</MenuItem>
                  <MenuItem value="INTER">Inter-State (IGST)</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Bill To / Ship To */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Bill To
                </Typography>
                <TextField
                  label="Customer Name"
                  value={form.billToName}
                  onChange={handleFormChange("billToName")}
                  fullWidth
                  margin="normal"
                  required
                />
                <TextField
                  label="Address"
                  value={form.billToAddress}
                  onChange={handleFormChange("billToAddress")}
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                />
                <TextField
                  label="GSTIN"
                  value={form.billToGstin}
                  onChange={handleFormChange("billToGstin")}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Mobile"
                  value={form.billToMobile}
                  onChange={handleFormChange("billToMobile")}
                  fullWidth
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Ship To
                </Typography>
                <TextField
                  label="Name"
                  value={form.shipToName}
                  onChange={handleFormChange("shipToName")}
                  fullWidth
                  margin="normal"
                  placeholder="Leave blank to use Bill To"
                />
                <TextField
                  label="Address"
                  value={form.shipToAddress}
                  onChange={handleFormChange("shipToAddress")}
                  fullWidth
                  margin="normal"
                  multiline
                  minRows={2}
                  placeholder="Leave blank to use Bill To"
                />
                <TextField
                  label="GSTIN"
                  value={form.shipToGstin}
                  onChange={handleFormChange("shipToGstin")}
                  fullWidth
                  margin="normal"
                  placeholder="Leave blank to use Bill To"
                />
                <TextField
                  label="Mobile"
                  value={form.shipToMobile}
                  onChange={handleFormChange("shipToMobile")}
                  fullWidth
                  margin="normal"
                  placeholder="Leave blank to use Bill To"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Items Table */}
            <Typography variant="subtitle1" gutterBottom>
              Items
            </Typography>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="22%">Item (search & select)</TableCell>
                    <TableCell>HSN/SAC</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">MRP (₹)</TableCell>
                    <TableCell align="right">Disc (%)</TableCell>
                    <TableCell align="right">Rate (₹)</TableCell>
                    <TableCell align="right">GST %</TableCell>
                    <TableCell align="right">Incl. Price / Unit (₹)</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.items.map((item, index) => {
                    const rateNum = Number(item.rate || item.mrp || "0") || 0;
                    const gstNum = Number(item.gstRate || "0") || 0;
                    const incl = perUnitInclusivePrice(rateNum, gstNum);

                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={products}
                            getOptionLabel={(option) => option.name}
                            onChange={(_, value) => handleProductSelect(index, value)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                variant="standard"
                                placeholder="Search item"
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(index, "description")(e as any)
                                }
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.hsn}
                            onChange={handleItemChange(index, "hsn")}
                            fullWidth
                            variant="standard"
                            placeholder="HSN/SAC"
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 80 }}>
                          <TextField
                            value={item.qty}
                            onChange={handleItemChange(index, "qty")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "1" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 110 }}>
                          <TextField
                            value={item.mrp}
                            onChange={handleItemChange(index, "mrp")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 90 }}>
                          <TextField
                            value={item.discountPercent}
                            onChange={handleItemChange(index, "discountPercent")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.1" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 110 }}>
                          <TextField
                            value={item.rate}
                            onChange={handleItemChange(index, "rate")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.01" }}
                            placeholder="Auto from MRP/Disc"
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 80 }}>
                          <TextField
                            value={item.gstRate}
                            onChange={handleItemChange(index, "gstRate")}
                            type="number"
                            variant="standard"
                            fullWidth
                            inputProps={{ min: 0, step: "0.1" }}
                          />
                        </TableCell>
                        <TableCell align="right" style={{ minWidth: 130 }}>
                          <Typography variant="body2">
                            {formatMoney(incl || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => removeItemRow(index)} size="small">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  <TableRow>
                    <TableCell colSpan={9}>
                      <Button startIcon={<AddIcon />} onClick={addItemRow} size="small">
                        Add Item
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Box>
        </DialogContent>

        {/* Totals preview */}
        <DialogActions sx={{ flexDirection: "column", alignItems: "stretch" }}>
          <Box display="flex" justifyContent="flex-end" width="100%" mb={1}>
            <Box textAlign="right">
              <Typography variant="body2">
                Taxable Amount: ₹ {formatMoney(previewTotals.taxableAmountTotal)}
              </Typography>
              <Typography variant="body2">
                Total GST: ₹ {formatMoney(previewTotals.gstAmountTotal)}
              </Typography>
              <Typography variant="body2">
                CGST: ₹ {formatMoney(previewTotals.cgstTotal)} | SGST: ₹{" "}
                {formatMoney(previewTotals.sgstTotal)} | IGST: ₹{" "}
                {formatMoney(previewTotals.igstTotal)}
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold">
                Grand Total: ₹ {formatMoney(previewTotals.grandTotal)}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" justifyContent="flex-end" width="100%">
            <Button onClick={closeDialog} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Save Invoice
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Simple print layout (hidden, same page print) */}
      {printInvoice && (
        <Box
          id="print-area"
          sx={{
            display: "none",
            "@media print": {
              display: "block",
            },
          }}
        >
          <Typography variant="h5" gutterBottom>
            Invoice #{printInvoice.invoiceNumber}
          </Typography>
          <Typography variant="body2">
            Date: {new Date(printInvoice.date).toLocaleDateString()}
          </Typography>
          <Typography variant="body2">
            Supply Type: {printInvoice.supplyType === "INTER" ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}
          </Typography>

          <Divider sx={{ my: 1 }} />

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle1">Bill To</Typography>
              <Typography variant="body2">{printInvoice.billTo.name}</Typography>
              <Typography variant="body2">{printInvoice.billTo.address}</Typography>
              <Typography variant="body2">GSTIN: {printInvoice.billTo.gstin}</Typography>
              <Typography variant="body2">Mobile: {printInvoice.billTo.mobile}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle1">Ship To</Typography>
              <Typography variant="body2">{printInvoice.shipTo.name}</Typography>
              <Typography variant="body2">{printInvoice.shipTo.address}</Typography>
              <Typography variant="body2">GSTIN: {printInvoice.shipTo.gstin}</Typography>
              <Typography variant="body2">Mobile: {printInvoice.shipTo.mobile}</Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1 }} />

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>HSN</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">GST %</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">GST</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {printInvoice.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.description}</TableCell>
                  <TableCell>{it.hsn}</TableCell>
                  <TableCell align="right">{it.qty}</TableCell>
                  <TableCell align="right">{formatMoney(it.rate)}</TableCell>
                  <TableCell align="right">{it.gstRate}</TableCell>
                  <TableCell align="right">{formatMoney(it.taxableAmount)}</TableCell>
                  <TableCell align="right">{formatMoney(it.gstAmount)}</TableCell>
                  <TableCell align="right">{formatMoney(it.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box mt={2} textAlign="right">
            <Typography variant="body2">
              Taxable Amount: ₹ {formatMoney(printInvoice.taxableAmountTotal)}
            </Typography>
            <Typography variant="body2">
              CGST: ₹ {formatMoney(printInvoice.cgstTotal)} | SGST: ₹{" "}
              {formatMoney(printInvoice.sgstTotal)} | IGST: ₹{" "}
              {formatMoney(printInvoice.igstTotal)}
            </Typography>
            <Typography variant="h6">
              Grand Total: ₹ {formatMoney(printInvoice.grandTotal)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Invoices;
