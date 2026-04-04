# Auto-Update Setup Guide

This document explains how to set up automatic updates for the GST Billing Software using GitHub Releases and electron-updater.

## 🚀 Quick Setup

### 1. Create GitHub Repository
1. Create a new GitHub repository (e.g., `gst-billing-software`)
2. Push your code to the repository

### 2. Configure Repository Settings
In `desktop/package.json`, update the publish configuration:

```json
{
  "publish": {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",
    "repo": "gst-billing-software",
    "private": false
  }
}
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 3. Create Release
1. Build the application: `npm run build`
2. Create a GitHub release with the version tag (e.g., `v1.0.1`)
3. Upload the installer files:
   - `GST-Billing-Setup-1.0.1.exe` (Windows)
   - `GST-Billing-1.0.1.dmg` (macOS)
   - `GST-Billing-1.0.1.AppImage` (Linux)

### 4. Release Assets
electron-builder will automatically create the release assets. The key files are:
- `latest.yml` - Contains version info and download URLs
- Installer executables for each platform

## 📋 Detailed Setup Steps

### GitHub Repository Setup
1. Go to GitHub.com and create a new repository
2. Clone the repository locally
3. Copy your project files to the repository
4. Push to GitHub:

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Release Creation Process
1. **Build the application:**
   ```bash
   cd desktop
   npm run build
   ```

2. **Create GitHub release:**
   - Go to your GitHub repository
   - Click "Releases" → "Create a new release"
   - Tag version: `v1.0.1`
   - Release title: "Version 1.0.1"
   - Description: List of changes
   - Upload the built installer files

3. **Publish release:**
   - Click "Publish release"
   - electron-updater will now be able to find updates

### Testing Updates
1. Install version 1.0.0 on a test machine
2. Create a new release with version 1.0.1
3. Open the app and go to Settings → About & Updates
4. Click "Check for Updates"
5. The app should detect the new version and offer to download it

## 🔧 Configuration Files

### package.json Configuration
```json
{
  "name": "@gst-billing/desktop",
  "version": "1.0.0",
  "publish": {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "gst-billing-software",
    "private": false
  }
}
```

### electron-builder Configuration
The build configuration in `package.json` should include:

```json
{
  "build": {
    "appId": "com.gstbilling.desktop",
    "productName": "GST Billing Software",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "gst-billing-software",
      "private": false
    }
  }
}
```

## 📁 File Structure After Build

```
dist/
├── latest.yml          # Version info (auto-generated)
├── GST-Billing-Setup-1.0.0.exe
├── GST-Billing-Setup-1.0.1.exe
└── GST-Billing-Setup-1.0.2.exe
```

## 🔍 Troubleshooting

### Update Not Detected
- Check that `latest.yml` exists in the GitHub release
- Verify the repository owner and name in `package.json`
- Ensure the version number is higher than current version

### Download Fails
- Check that release assets are uploaded
- Verify file permissions on GitHub
- Check network connectivity

### Installation Fails
- Ensure user has admin privileges
- Check antivirus software isn't blocking installation
- Verify the installer file isn't corrupted

## 🚀 Alternative: Generic Provider

If you prefer not to use GitHub, you can use a generic provider with any web server:

```json
{
  "publish": {
    "provider": "generic",
    "url": "https://your-update-server.com/updates"
  }
}
```

You'll need to manually host the `latest.yml` file and installer files on your server.

## 📝 Version Numbering

Follow semantic versioning:
- `1.0.0` - Major release
- `1.0.1` - Bug fixes
- `1.1.0` - New features
- `2.0.0` - Breaking changes

## 🔐 Security Considerations

1. **Code Signing**: Sign your releases for security
2. **Checksum Verification**: electron-updater verifies file integrity
3. **HTTPS**: Always use HTTPS for update servers
4. **Access Control**: Consider making repository private if needed

## 🎯 User Experience

The update flow in the app:
1. User goes to Settings → About & Updates
2. Clicks "Check for Updates"
3. If update available, sees changelog and download button
4. Downloads in background with progress bar
5. Prompts to install and restart
6. App closes and installer runs automatically

This provides a smooth, professional update experience for your users.
