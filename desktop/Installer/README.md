# InvoicePro Installer

## Professional Branded Installer with Real Progress Tracking

### 📁 Folder Structure
```
Installer/
 ├─ InvoiceProSetup.iss          # Main installer script
 ├─ logo.bmp                     # InvoicePro logo (164×314, 24-bit BMP)
 ├─ app/
 │   ├─ InvoicePro.exe           # Main application
 │   ├─ config.dll               # Configuration files
 │   └─ resources/
 │       ├─ styles.css          # Application styles
 │       └─ activate.js          # Activation scripts
 └─ output/                      # Compiled installer output
```

### 🚀 Building the Installer

#### Prerequisites
1. Download Inno Setup 6.3 Unicode from: https://jrsoftware.org/download.php/is.php
2. Install with Unicode support
3. Ensure you have admin privileges for compilation

#### Build Steps
1. Open `InvoiceProSetup.iss` in Inno Setup
2. Press `Ctrl+F9` or `Build > Compile`
3. Output will be in `output/InvoiceProInstaller.exe`

#### Command Line Build
```bash
ISCC.exe InvoiceProSetup.iss
```

### 🎨 Features

#### Custom UI Elements
- ✅ InvoicePro branding throughout
- ✅ Centered logo display
- ✅ Real progress bar (0-100%)
- ✅ Dynamic status messages
- ✅ Professional color scheme

#### Progress Tracking
- **0-20%**: Preparing installation files
- **20-40%**: Installing InvoicePro components
- **40-60%**: Configuring database settings
- **60-80%**: Registering system components
- **80-95%**: Creating program shortcuts
- **95-100%**: Finalizing installation

#### Installation Options
- Desktop shortcut creation
- Quick launch shortcut (Windows 10)
- Auto-launch after installation
- Custom installation path

### 🔧 Technical Requirements

#### System Requirements
- Windows 10 (version 1903+) or Windows 11
- Administrator privileges
- 100MB free disk space
- 4GB RAM minimum

#### Logo Specifications
- Format: BMP (24-bit)
- Size: 164×314 pixels
- Location: Root of installer folder
- Background: Transparent or solid color

### 🧪 Testing Checklist

#### Required Tests
- [ ] Windows 10 installation
- [ ] Windows 11 installation
- [ ] Admin privilege handling
- [ ] Non-admin error handling
- [ ] Silent installation (`/SILENT`)
- [ ] Custom path installation
- [ ] Shortcut creation
- [ ] Uninstallation cleanup
- [ ] Progress bar accuracy
- [ ] Logo display

#### Performance Tests
- [ ] Installation time < 2 minutes
- [ ] Progress updates smoothly
- [ ] Memory usage < 100MB
- [ ] Accurate disk space calculation

### 📱 Installation Experience

#### Welcome Screen
```
[InvoicePro Logo]

Welcome to the InvoicePro Setup Wizard

This will install InvoicePro on your computer.

InvoicePro is a professional GST billing software designed for modern businesses.

InvoicePro - Professional GST Billing Software
Modern, efficient, and easy to use billing solution for your business.
```

#### Installation Screen
```
[InvoicePro Logo]

InvoicePro Installation

Installing InvoicePro components...

[██████████░░░░░░░░░░] 52%

Please wait while setup installs InvoicePro...
```

#### Finish Screen
```
[InvoicePro Logo]

InvoicePro has been successfully installed!

Thank you for choosing InvoicePro for your business needs.

[✓] Launch InvoicePro after installation
[Launch InvoicePro] [Finish]
```

### 🎯 Customization

#### Branding Colors
- Primary: #27ae60 (Green)
- Accent: #2ecc71 (Light Green)
- Background: Dark gradient

#### Messages
All installer messages are customizable in the `[CustomMessages]` section of the script.

#### Registry Entries
Installer creates registry entries for:
- Installation path
- Version information
- Installation date
- User preferences

### 🚀 Deployment

#### Distribution
- Single executable file: `InvoiceProInstaller.exe`
- Size: ~3-5MB (depending on app size)
- Compatible with Windows 10/11
- Digitally sign for distribution (optional)

#### Silent Installation
```bash
InvoiceProInstaller.exe /SILENT /DIR="C:\CustomPath\InvoicePro"
```

#### Uninstallation
```bash
InvoiceProInstaller.exe /SILENT /SUPPRESSMSGBOXES
```

### 📞 Support

For installer issues:
- Check system requirements
- Verify admin privileges
- Test on clean Windows installation
- Review Windows Event Viewer for errors

---

**InvoicePro Installer** - Professional installation experience for modern businesses
