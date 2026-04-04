import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Grid, FormControl, InputLabel, Select,
  MenuItem, Switch, FormControlLabel, TextField, Button, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Card, CardContent,
  Slider, Chip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  RotateLeft as RotateLeftIcon,
  Download as DownloadIcon,
  Mail as MailIcon,
  Save as SaveIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { usePrintCustomization } from '../hooks/usePrintCustomization';

const sampleInvoice = {
  invoiceNumber: 'INV-PREVIEW-001',
  date: '2025-01-01',
  dueDate: '2025-01-15',
  customer: {
    name: 'Customer',
    address: 'Customer Address',
    gstin: '22AAAAA0000A1Z5',
    phone: '0000000000',
    email: 'customer@example.com'
  },
  items: [
    { name: 'Item 1', hsn: '0000', qty: 1, rate: 100, tax: 18, amount: 118 },
    { name: 'Item 2', hsn: '0000', qty: 2, rate: 50, tax: 18, amount: 118 }
  ],
  subtotal: 200,
  cgst: 18,
  sgst: 18,
  total: 236,
  amountInWords: 'Two Hundred Thirty Six Only',
  notes: '',
  terms: ''
};

const invoiceFormats = [
  { id: 'classic', name: 'Classic', description: 'Traditional layout with header at top' },
  { id: 'modern', name: 'Modern', description: 'Contemporary design with bold colors' },
  { id: 'minimal', name: 'Minimal', description: 'Clean, simple design' }
];

const defaultSettings = {
  pageSize: 'A4',
  orientation: 'portrait',
  fontSize: '12',
  fontFamily: 'Arial',
  showHSN: true,
  showCustomerGSTIN: true,
  showBankDetails: true,
  showNotes: true,
  showTerms: true,
  showSignature: true,
  primaryColor: '#1976d2',
  secondaryColor: '#f5f5f5'
};

const defaultCompanyInfo = {
  name: '',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  bank: '',
  accountNo: '',
  ifsc: '',
  logo: '',
  signature: '',
  termsAndConditions: ''
};

export default function PrintCustomization() {
  const { isLoaded } = usePrintCustomization();
  const [openSettings, setOpenSettings] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('classic');
  const [settings, setSettings] = useState(defaultSettings);
  const [companyInfo, setCompanyInfo] = useState(defaultCompanyInfo);
  const [saveStatus, setSaveStatus] = useState('');

  const upsertCompanyInfo = (partial: Record<string, any>) => {
    try {
      const raw = localStorage.getItem('company-info');
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, ...partial };
      localStorage.setItem('company-info', JSON.stringify(next));
      if (Object.prototype.hasOwnProperty.call(partial, 'logo')) {
        localStorage.setItem('companyLogo', String(partial.logo ?? ''));
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'signature')) {
        localStorage.setItem('companySignature', String(partial.signature ?? ''));
      }
      window.dispatchEvent(new Event('companyProfileUpdated'));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('invoice-settings');
      const savedCompany = localStorage.getItem('company-info');
      const savedFormat = localStorage.getItem('selected-format');
      if (saved) setSettings(JSON.parse(saved));
      if (savedCompany) setCompanyInfo(JSON.parse(savedCompany));
      if (savedFormat) setSelectedFormat(savedFormat);
    } catch (e) {
      console.log('No saved settings');
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCompanyInfoChange = (key: string, value: string) => {
    setCompanyInfo(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        setSaveStatus('Logo file too large. Max 500KB allowed.');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const logo = e.target!.result as string;
          setCompanyInfo(prev => ({ ...prev, logo }));
          upsertCompanyInfo({ logo });
          setSaveStatus('Logo uploaded successfully!');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 300000) {
        setSaveStatus('Signature file too large. Max 300KB allowed.');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const signature = e.target!.result as string;
          setCompanyInfo(prev => ({ ...prev, signature }));
          upsertCompanyInfo({ signature });
          setSaveStatus('Signature uploaded successfully!');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setCompanyInfo(prev => ({ ...prev, logo: '' }));
    upsertCompanyInfo({ logo: '' });
    setSaveStatus('Logo removed');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const removeSignature = () => {
    setCompanyInfo(prev => ({ ...prev, signature: '' }));
    upsertCompanyInfo({ signature: '' });
    setSaveStatus('Signature removed');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('invoice-settings', JSON.stringify(settings));
      localStorage.setItem('company-info', JSON.stringify(companyInfo));
      localStorage.setItem('companyLogo', String((companyInfo as any)?.logo ?? ''));
      localStorage.setItem('companySignature', String((companyInfo as any)?.signature ?? ''));
      localStorage.setItem('selected-format', selectedFormat);
      window.dispatchEvent(new Event('companyProfileUpdated'));
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const resetAllSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      setSelectedFormat('classic');
      setSettings(defaultSettings);
      setCompanyInfo(defaultCompanyInfo);
      setSaveStatus('Settings reset to default!');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const exportSettings = () => {
    const data = {
      settings,
      companyInfo,
      selectedFormat,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (e.target && e.target.result) {
            const data = JSON.parse(e.target.result as string);
            if (data.settings) setSettings(data.settings);
            if (data.companyInfo) setCompanyInfo(data.companyInfo);
            if (data.selectedFormat) setSelectedFormat(data.selectedFormat);
            setSaveStatus('Settings imported successfully!');
            setTimeout(() => setSaveStatus(''), 3000);
          }
        } catch (error) {
          setSaveStatus('Error importing settings');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  const printInvoice = () => {
    const html = generateInvoiceHTML();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      try {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      } catch {
        // ignore
      }
    };

    const attachCleanup = () => {
      try {
        const cw = iframe.contentWindow;
        if (cw) {
          cw.onafterprint = () => cleanup();
        }
      } catch {
        // ignore
      }
      setTimeout(cleanup, 15000);
    };

    const attemptPrint = () => {
      try {
        const cw = iframe.contentWindow;
        if (cw) {
          cw.focus();
          cw.print();
          attachCleanup();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    iframe.onload = () => {
      if (!attemptPrint()) {
        alert('Printing blocked. Please try again.');
        cleanup();
      }
    };

    try {
      (iframe as any).srcdoc = html;
    } catch {
      const cd = iframe.contentDocument || iframe.contentWindow?.document;
      cd?.open();
      cd?.write(html);
      cd?.close();
    }

    if (!attemptPrint()) {
      // no-op, onload will retry
    }
  };

  const downloadPDF = () => {
    printInvoice();
    alert('Use your browser\'s "Save as PDF" option in the print dialog to save as PDF');
  };

  const emailInvoice = () => {
    const companyName = String(companyInfo.name || '').trim() || 'Your Company';
    const subject = `Invoice ${sampleInvoice.invoiceNumber} from ${companyName}`;
    const body = `Dear ${sampleInvoice.customer.name},\n\nPlease find attached invoice ${sampleInvoice.invoiceNumber} for ₹${sampleInvoice.total.toFixed(2)}.\n\nDue Date: ${new Date(sampleInvoice.dueDate).toLocaleDateString('en-IN')}\n\nThank you for your business!\n\nBest regards,\n${companyName}`;
    window.location.href = `mailto:${sampleInvoice.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const generateInvoiceHTML = () => {
    const companyName = String(companyInfo.name || '').trim() || 'Your Company';
    const itemsHTML = sampleInvoice.items.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${item.name}</strong></td>
        ${settings.showHSN ? `<td>${item.hsn}</td>` : ''}
        <td class="text-right">${item.qty}</td>
        <td class="text-right">₹${item.rate.toFixed(2)}</td>
        <td class="text-right">${item.tax}%</td>
        <td class="text-right"><strong>₹${item.amount.toFixed(2)}</strong></td>
      </tr>
    `).join('');

    const commonStyles = `
      @media print {
        @page { size: ${settings.pageSize}; margin: 15mm; }
        body { margin: 0; }
      }
      * { box-sizing: border-box; }
      body { font-family: ${settings.fontFamily}, sans-serif; font-size: ${settings.fontSize}px; color: black; line-height: 1.5; margin: 0; padding: 20px; }
      .invoice-container { max-width: ${settings.pageSize === 'A4' ? '210mm' : '216mm'}; margin: 0 auto; position: relative; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid ${settings.primaryColor}; }
      .company-info { flex: 1; }
      .company-name { font-size: 24px; font-weight: bold; color: ${settings.primaryColor}; margin: 0 0 10px 0; }
      .company-details { font-size: 12px; line-height: 1.6; }
      .invoice-title { text-align: right; background: ${settings.primaryColor}; color: white; padding: 15px 25px; border-radius: 5px; }
      .invoice-title h1 { margin: 0; font-size: 32px; font-weight: bold; }
      .invoice-number { font-size: 14px; margin-top: 5px; }
      .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
      .info-box { background: ${settings.secondaryColor}; padding: 15px; border-radius: 5px; border: 1px solid #ddd; }
      .info-box h3 { margin: 0 0 10px 0; color: ${settings.primaryColor}; font-size: 14px; text-transform: uppercase; font-weight: bold; }
      .info-box p { margin: 5px 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th { background: ${settings.primaryColor}; color: white; padding: 10px; text-align: left; font-weight: bold; font-size: 13px; }
      td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
      tbody tr:nth-child(even) { background: ${settings.secondaryColor}; }
      .text-right { text-align: right; }
      .totals-section { margin: 20px 0; display: flex; justify-content: flex-end; }
      .totals-table { width: 300px; border: 2px solid #ddd; }
      .totals-table td { padding: 10px; font-size: 13px; }
      .totals-table tr { border-bottom: 1px solid #ddd; }
      .grand-total { background: ${settings.primaryColor}; color: white; font-weight: bold; font-size: 16px; }
      .amount-words { background: #fff9e6; padding: 12px; border-left: 4px solid ${settings.primaryColor}; margin: 15px 0; font-weight: 500; }
      .bank-details { background: ${settings.secondaryColor}; padding: 15px; margin: 20px 0; border-radius: 5px; border: 1px solid #ddd; }
      .bank-details h3 { margin: 0 0 10px 0; color: ${settings.primaryColor}; font-size: 14px; text-transform: uppercase; }
      .bank-details-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .notes-section { background: #fff9e6; padding: 15px; border-left: 4px solid ${settings.primaryColor}; margin: 20px 0; }
      .terms-section { margin: 15px 0; padding: 10px; background: #f8f8f8; }
      .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; }
      .signature-section { display: flex; justify-content: space-between; margin-top: 50px; }
      .signature-box { text-align: center; min-width: 200px; }
      .signature-line { border-top: 2px solid #000; margin-top: 60px; padding-top: 5px; font-size: 12px; }
    `;

    let formatSpecificStyles = '';
    let headerHTML = '';

    if (selectedFormat === 'modern') {
      formatSpecificStyles = `
        .modern-header { background: linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%); color: white; padding: 30px; margin: -20px -20px 30px -20px; }
        .header-flex { display: flex; justify-content: space-between; align-items: center; }
        .company-name { font-size: 24px; font-weight: bold; margin: 0 0 10px 0; }
        .company-details { font-size: 12px; opacity: 0.95; line-height: 1.6; }
        .invoice-badge { background: white; color: ${settings.primaryColor}; padding: 12px 25px; border-radius: 30px; font-size: 20px; font-weight: bold; }
        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .info-box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .info-box h3 { margin: 0 0 10px 0; color: ${settings.primaryColor}; font-size: 14px; text-transform: uppercase; font-weight: bold; }
        .info-box p { margin: 5px 0; font-size: 13px; }
      `;
      headerHTML = `<div class="modern-header"><div class="header-flex"><div>${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="Logo" style="max-width:100px;max-height:50px;margin-bottom:8px;object-fit:contain;">` : ''}<h1 class="company-name">${companyName}</h1><div class="company-details"><p>${companyInfo.address}</p><p>Phone: ${companyInfo.phone} | Email: ${companyInfo.email}</p><p>GSTIN: ${companyInfo.gstin}</p></div></div><div class="invoice-badge">INVOICE<br>#${sampleInvoice.invoiceNumber}</div></div></div>`;
    } else if (selectedFormat === 'minimal') {
      formatSpecificStyles = `
        .minimal-header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 30px; }
        .header-grid { display: grid; grid-template-columns: 1fr auto; gap: 30px; }
        .company-name { font-size: 24px; font-weight: 300; color: ${settings.primaryColor}; margin: 0 0 5px 0; letter-spacing: 2px; }
        .company-details { font-size: 11px; color: #666; margin-top: 3px; }
        .invoice-info { text-align: right; }
        .invoice-title { font-size: 28px; font-weight: 300; color: black; margin: 0; letter-spacing: 1px; }
        .invoice-number { font-size: 14px; color: #666; margin-top: 5px; }
        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
        .info-box { padding: 0; }
        .info-box h3 { margin: 0 0 10px 0; color: black; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; }
        .info-box p { margin: 5px 0; font-size: 13px; color: #666; }
      `;
      headerHTML = `<div class="minimal-header"><div class="header-grid"><div>${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="Logo" style="max-width:80px;max-height:40px;margin-bottom:6px;object-fit:contain;">` : ''}<h1 class="company-name">${companyName}</h1><div class="company-details">${companyInfo.address} | ${companyInfo.phone} | ${companyInfo.email} | GSTIN: ${companyInfo.gstin}</div></div><div class="invoice-info"><h2 class="invoice-title">INVOICE</h2><div class="invoice-number">#${sampleInvoice.invoiceNumber}</div></div></div></div>`;
    } else {
      // Classic format
      formatSpecificStyles = `
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid ${settings.primaryColor}; }
        .company-info { flex: 1; }
        .company-name { font-size: 24px; font-weight: bold; color: ${settings.primaryColor}; margin: 0 0 10px 0; }
        .company-details { font-size: 12px; line-height: 1.6; }
        .invoice-title { text-align: right; background: ${settings.primaryColor}; color: white; padding: 15px 25px; border-radius: 5px; }
        .invoice-title h1 { margin: 0; font-size: 32px; font-weight: bold; }
        .invoice-number { font-size: 14px; margin-top: 5px; }
        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .info-box { background: ${settings.secondaryColor}; padding: 15px; border-radius: 5px; border: 1px solid #ddd; }
        .info-box h3 { margin: 0 0 10px 0; color: ${settings.primaryColor}; font-size: 14px; text-transform: uppercase; font-weight: bold; }
        .info-box p { margin: 5px 0; font-size: 13px; }
      `;
      headerHTML = `<div class="header"><div class="company-info">${companyInfo.logo ? `<img src="${companyInfo.logo}" alt="Logo" style="max-width:120px;max-height:60px;margin-bottom:8px;object-fit:contain;">` : ''}<h1 class="company-name">${companyName}</h1><div class="company-details"><p>${companyInfo.address}</p><p><strong>Phone:</strong> ${companyInfo.phone} | <strong>Email:</strong> ${companyInfo.email}</p><p><strong>GSTIN:</strong> ${companyInfo.gstin}</p></div></div><div class="invoice-title"><h1>INVOICE</h1><div class="invoice-number">#${sampleInvoice.invoiceNumber}</div></div></div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${sampleInvoice.invoiceNumber}</title><style>${commonStyles}${formatSpecificStyles}</style></head><body><div class="invoice-container">${headerHTML}<div class="info-section"><div class="info-box"><h3>Invoice Details</h3><p><strong>Invoice Date:</strong> ${new Date(sampleInvoice.date).toLocaleDateString('en-IN')}</p><p><strong>Due Date:</strong> ${new Date(sampleInvoice.dueDate).toLocaleDateString('en-IN')}</p></div><div class="info-box"><h3>Bill To</h3><p><strong>${sampleInvoice.customer.name}</strong></p><p>${sampleInvoice.customer.address}</p>${settings.showCustomerGSTIN ? `<p><strong>GSTIN:</strong> ${sampleInvoice.customer.gstin}</p>` : ''}<p><strong>Phone:</strong> ${sampleInvoice.customer.phone}</p><p><strong>Email:</strong> ${sampleInvoice.customer.email}</p></div></div><table><thead><tr><th style="width: 40px;">#</th><th>Item Description</th>${settings.showHSN ? '<th style="width: 80px;">HSN</th>' : ''}<th class="text-right" style="width: 60px;">Qty</th><th class="text-right" style="width: 100px;">Rate</th><th class="text-right" style="width: 60px;">Tax%</th><th class="text-right" style="width: 120px;">Amount</th></tr></thead><tbody>${itemsHTML}</tbody></table><div class="totals-section"><table class="totals-table"><tr><td><strong>Subtotal:</strong></td><td class="text-right"><strong>₹${sampleInvoice.subtotal.toFixed(2)}</strong></td></tr><tr><td>CGST (9%):</td><td class="text-right">₹${sampleInvoice.cgst.toFixed(2)}</td></tr><tr><td>SGST (9%):</td><td class="text-right">₹${sampleInvoice.sgst.toFixed(2)}</td></tr><tr class="grand-total"><td><strong>Total Amount:</strong></td><td class="text-right"><strong>₹${sampleInvoice.total.toFixed(2)}</strong></td></tr></table></div><div class="amount-words"><strong>Amount in Words:</strong> ${sampleInvoice.amountInWords}</div>${settings.showBankDetails && companyInfo.bank ? `<div class="bank-details"><h3>Bank Details for Payment</h3><div class="bank-details-grid"><p><strong>Bank Name:</strong><br>${companyInfo.bank}</p><p><strong>Account Number:</strong><br>${companyInfo.accountNo}</p><p><strong>IFSC Code:</strong><br>${companyInfo.ifsc}</p></div></div>` : ''}${settings.showNotes && sampleInvoice.notes ? `<div class="notes-section"><strong>Notes:</strong><br>${sampleInvoice.notes}</div>` : ''}${settings.showTerms && companyInfo.termsAndConditions ? `<div class="terms-section"><strong>Terms & Conditions:</strong><br>${companyInfo.termsAndConditions.replace(/\n/g, '<br>')}</div>` : ''}<div class="footer">${settings.showSignature ? `<div class="signature-section"><div class="signature-box"><div class="signature-line">Customer Signature</div></div><div class="signature-box">${companyInfo.signature ? `<img src="${companyInfo.signature}" alt="Signature" style="max-width:120px;max-height:50px;object-fit:contain;display:block;margin:0 auto 5px;">` : ''}<div class="signature-line">Authorized Signatory</div></div></div>` : ''}</div></div></body></html>`;
  };

  const tabs = ['Format', 'Page Setup', 'Content', 'Company Info'];

  if (!isLoaded) {
    return <Box sx={{ p: 3 }}><Typography>Loading print preferences...</Typography></Box>;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        GST Invoice Print Customization
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Design and customize your professional invoices with multiple formats and full control over layout and content.
      </Alert>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={() => setOpenSettings(!openSettings)}
        >
          {openSettings ? 'Close' : 'Open'} Settings
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<VisibilityIcon />}
          onClick={() => setOpenPreview(!openPreview)}
        >
          Preview
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={printInvoice}
        >
          Print Invoice
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<DownloadIcon />}
          onClick={downloadPDF}
        >
          Download PDF
        </Button>
        <Button
          variant="contained"
          color="warning"
          startIcon={<MailIcon />}
          onClick={emailInvoice}
        >
          Email Invoice
        </Button>
        <Button
          variant="contained"
          color="info"
          startIcon={<SaveIcon />}
          onClick={saveSettings}
        >
          Save Settings
        </Button>
      </Box>

      {saveStatus && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSaveStatus('')}>
          {saveStatus}
        </Alert>
      )}

      {/* Settings Panel */}
      {openSettings && (
        <Paper sx={{ p: 3, mb: 3, border: 2, borderColor: 'primary.light' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">Customization Settings</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                component="label"
              >
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importSettings}
                  hidden
                />
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportSettings}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RotateLeftIcon />}
                onClick={resetAllSettings}
              >
                Reset All
              </Button>
            </Box>
          </Box>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
            {tabs.map((tab, idx) => (
              <Tab key={idx} label={tab} />
            ))}
          </Tabs>

          {/* Tab Content */}
          <Box>
            {/* Format Selection */}
            {activeTab === 0 && (
              <Grid container spacing={3}>
                {invoiceFormats.map((format) => (
                  <Grid item xs={12} sm={6} md={4} key={format.id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: selectedFormat === format.id ? 2 : 1,
                        borderColor: selectedFormat === format.id ? 'primary.main' : 'grey.300',
                        bgcolor: selectedFormat === format.id ? 'primary.light' : 'background.paper',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: 2,
                        },
                      }}
                      onClick={() => setSelectedFormat(format.id)}
                    >
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {format.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {format.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Page Setup */}
            {activeTab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Page Size</InputLabel>
                    <Select
                      value={settings.pageSize}
                      label="Page Size"
                      onChange={(e) => handleSettingChange('pageSize', e.target.value)}
                    >
                      <MenuItem value="A4">A4</MenuItem>
                      <MenuItem value="A5">A5</MenuItem>
                      <MenuItem value="THERMAL_80">Thermal 80mm</MenuItem>
                      <MenuItem value="THERMAL_58">Thermal 58mm</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={settings.orientation}
                      label="Orientation"
                      onChange={(e) => handleSettingChange('orientation', e.target.value)}
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Font Family</InputLabel>
                    <Select
                      value={settings.fontFamily}
                      label="Font Family"
                      onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
                    >
                      <MenuItem value="Arial">Arial</MenuItem>
                      <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                      <MenuItem value="Helvetica">Helvetica</MenuItem>
                      <MenuItem value="Georgia">Georgia</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Font Size: {settings.fontSize}px</Typography>
                  <Slider
                    value={parseInt(settings.fontSize)}
                    onChange={(_, v) => handleSettingChange('fontSize', v.toString())}
                    min={10}
                    max={16}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Primary Color</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                      style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <Typography variant="body2">{settings.primaryColor}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Secondary Color</Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                      style={{ width: '50px', height: '40px', border: 'none', cursor: 'pointer' }}
                    />
                    <Typography variant="body2">{settings.secondaryColor}</Typography>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* Content Settings */}
            {activeTab === 2 && (
              <Grid container spacing={3}>
                {[
                  { key: 'showHSN', label: 'Show HSN Code' },
                  { key: 'showCustomerGSTIN', label: 'Show Customer GSTIN' },
                  { key: 'showBankDetails', label: 'Show Bank Details' },
                  { key: 'showNotes', label: 'Show Notes' },
                  { key: 'showTerms', label: 'Show Terms & Conditions' },
                  { key: 'showSignature', label: 'Show Signature' },
                ].map((item) => (
                  <Grid item xs={12} sm={6} key={item.key}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onChange={(e) => handleSettingChange(item.key, e.target.checked)}
                        />
                      }
                      label={item.label}
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Company Information */}
            {activeTab === 3 && (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={companyInfo.name}
                    onChange={(e) => handleCompanyInfoChange('name', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="GSTIN"
                    value={companyInfo.gstin}
                    onChange={(e) => handleCompanyInfoChange('gstin', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={companyInfo.address}
                    onChange={(e) => handleCompanyInfoChange('address', e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={companyInfo.phone}
                    onChange={(e) => handleCompanyInfoChange('phone', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => handleCompanyInfoChange('email', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Bank Name"
                    value={companyInfo.bank}
                    onChange={(e) => handleCompanyInfoChange('bank', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Account Number"
                    value={companyInfo.accountNo}
                    onChange={(e) => handleCompanyInfoChange('accountNo', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="IFSC Code"
                    value={companyInfo.ifsc}
                    onChange={(e) => handleCompanyInfoChange('ifsc', e.target.value)}
                  />
                </Grid>

                {/* Logo Upload */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Company Logo</Typography>
                    {companyInfo.logo ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <img src={companyInfo.logo} alt="Company Logo" style={{ maxWidth: '150px', maxHeight: '80px', objectFit: 'contain' }} />
                        <Button size="small" color="error" onClick={removeLogo}>Remove Logo</Button>
                      </Box>
                    ) : (
                      <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth>
                        Upload Logo (PNG/JPG, max 500KB)
                        <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} hidden />
                      </Button>
                    )}
                  </Paper>
                </Grid>

                {/* Signature Upload */}
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Authorized Signature</Typography>
                    {companyInfo.signature ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <img src={companyInfo.signature} alt="Signature" style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain' }} />
                        <Button size="small" color="error" onClick={removeSignature}>Remove Signature</Button>
                      </Box>
                    ) : (
                      <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth>
                        Upload Signature (PNG/JPG, max 300KB)
                        <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleSignatureUpload} hidden />
                      </Button>
                    )}
                  </Paper>
                </Grid>

                {/* Terms & Conditions */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Terms & Conditions"
                    value={companyInfo.termsAndConditions || ''}
                    onChange={(e) => handleCompanyInfoChange('termsAndConditions', e.target.value)}
                    multiline
                    rows={4}
                    placeholder="Enter your invoice terms and conditions (one per line)"
                    helperText="These terms will appear at the bottom of printed invoices"
                  />
                </Grid>
              </Grid>
            )}
          </Box>
        </Paper>
      )}

      {/* Preview Dialog */}
      {openPreview && (
        <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon />
              <Typography variant="h6">Invoice Preview - {invoiceFormats.find(f => f.id === selectedFormat)?.name}</Typography>
              <IconButton
                onClick={() => setOpenPreview(false)}
                sx={{ ml: 'auto' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ border: '1px solid #ddd', p: 2, bgcolor: 'white', maxHeight: '70vh', overflow: 'auto' }}>
              <div dangerouslySetInnerHTML={{ __html: generateInvoiceHTML() }} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenPreview(false)}>Close</Button>
            <Button onClick={printInvoice} variant="contained" startIcon={<PrintIcon />}>
              Print
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Sample Invoice Display */}
      <Paper sx={{ p: 3, border: 2, borderColor: 'grey.300' }}>
        <Typography variant="h5" gutterBottom sx={{ textAlign: 'center' }}>
          Sample Invoice Preview
        </Typography>
        <Box sx={{ textAlign: 'center', mb: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
          <Typography variant="body1" component="span">
            Current Format:
          </Typography>
          <Chip label={invoiceFormats.find(f => f.id === selectedFormat)?.name} color="primary" />
        </Box>

        <Box sx={{
          border: '4px dashed',
          borderColor: 'primary.light',
          borderRadius: 2,
          p: 3,
          bgcolor: 'grey.50',
          maxHeight: '600px',
          overflow: 'auto'
        }}>
          <div dangerouslySetInnerHTML={{ __html: generateInvoiceHTML() }} />
        </Box>
      </Paper>

      {/* Features List */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'primary.light', border: 2, borderColor: 'primary.main' }}>
        <Typography variant="h5" gutterBottom color="primary.contrastText">
          ✨ Features
        </Typography>
        <Grid container spacing={2}>
          {[
            'Persistent storage with localStorage',
            'Export/Import settings as JSON',
            'Print & PDF export',
            'Email integration',
            'Live preview',
            '3 Professional formats (Classic, Modern, Minimal)',
            'Full customization control',
            'GST compliant layout'
          ].map((feature, idx) => (
            <Grid item xs={12} sm={6} key={idx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" color="success.main">✅</Typography>
                <Typography variant="body2" color="primary.contrastText">
                  {feature}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}