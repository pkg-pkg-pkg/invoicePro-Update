const fs = require('fs');
const path = require('path');

let activePreviewWindow = null;
let activePreviewPath = null;

function getToolbarLogoDataUri(app) {
  try {
    const candidates = [
      path.join(app.getAppPath(), 'dist', 'invoicepro-logo.png'),
      path.join(app.getAppPath(), 'public', 'icon.png'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        const ext = path.extname(p).toLowerCase() === '.png' ? 'png' : 'jpeg';
        return `data:image/${ext};base64,${buf.toString('base64')}`;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function pageStyleBlock(size) {
  const isA5 = String(size).toUpperCase() === 'A5';
  return isA5
    ? '@page { size: A5 portrait; margin: 8mm; } body { font-size: 7px !important; }'
    : '@page { size: A4 portrait; margin: 8mm; } body { font-size: 10px !important; }';
}

function buildPreviewShell(invoiceHtml, pageSize, logoUri) {
  const logoHtml = logoUri
    ? `<img src="${logoUri}" alt="" style="width:22px;height:22px;border-radius:4px;object-fit:contain;background:#fff;padding:1px;" />`
    : `<span style="display:inline-flex;width:22px;height:22px;border-radius:4px;background:#fff;color:#111;font-weight:800;font-size:9px;align-items:center;justify-content:center;">PVE</span>`;

  const size = String(pageSize || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PVE InvoicePro 360 — Print Preview</title>
  <style id="pve-page-style">${pageStyleBlock(size)}</style>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #525659; }
    #pve-print-toolbar {
      position: sticky; top: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; padding: 8px 12px;
      background: #1a1a1a; color: #fff;
      font-family: Segoe UI, Arial, sans-serif; font-size: 13px;
      border-bottom: 1px solid #333;
    }
    #pve-print-toolbar button {
      cursor: pointer; padding: 5px 12px; border-radius: 4px;
      border: 1px solid #666; background: #2d2d2d; color: #fff; font-size: 12px;
    }
    #pve-print-toolbar button.active { background: #fff; color: #111; border-color: #fff; font-weight: 700; }
    #pve-print-toolbar button.primary { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 600; }
    #pve-preview-frame {
      padding: 16px; display: flex; justify-content: center;
    }
    #pve-invoice-root {
      background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,.35);
      width: ${size === 'A5' ? '148mm' : '210mm'};
      min-height: ${size === 'A5' ? '210mm' : '297mm'};
    }
    @media print {
      html, body { background: #fff !important; }
      #pve-print-toolbar { display: none !important; }
      #pve-preview-frame { padding: 0 !important; }
      #pve-invoice-root { box-shadow: none !important; width: auto !important; min-height: auto !important; }
    }
  </style>
</head>
<body data-page-size="${size}">
  <div id="pve-print-toolbar">
    <div style="display:flex;align-items:center;gap:8px;">
      ${logoHtml}
      <div>
        <strong style="display:block;line-height:1.2;">PVE InvoicePro 360</strong>
        <span style="font-size:11px;opacity:.85;">Print Preview</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <button type="button" id="pve-btn-a4" class="${size === 'A4' ? 'active' : ''}" onclick="window.pvePrintPreview.setPageSize('A4')">A4</button>
      <button type="button" id="pve-btn-a5" class="${size === 'A5' ? 'active' : ''}" onclick="window.pvePrintPreview.setPageSize('A5')">A5</button>
      <button type="button" class="primary" onclick="window.pvePrintPreview.print()">Print</button>
      <button type="button" onclick="window.pvePrintPreview.close()">Close</button>
    </div>
  </div>
  <div id="pve-preview-frame">
    <div id="pve-invoice-root">${invoiceHtml}</div>
  </div>
</body>
</html>`;
}

function extractInvoiceBody(html) {
  const raw = String(html || '');
  if (raw.includes('pve-invoice-root')) return raw;

  let styles = '';
  const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const styleTags = headMatch[1].match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    if (styleTags) styles = styleTags.join('');
  }

  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    let inner = bodyMatch[1];
    inner = inner.replace(/<div id="pve-print-toolbar"[\s\S]*?<\/div>/i, '');
    return `${styles}${inner.trim()}`;
  }
  return raw;
}

function registerPrintPreviewIpc({ app, ipcMain, BrowserWindow, createAppChildWindowOptions, getPrintPreviewPreloadPath }) {
  ipcMain.handle('print:open-preview', async (_event, payload) => {
    const html = String(payload?.html ?? '');
    if (!html) return false;

    if (activePreviewWindow && !activePreviewWindow.isDestroyed()) {
      activePreviewWindow.close();
      activePreviewWindow = null;
    }

    let previewWindow = null;
    try {
      const pageSize = String(payload?.pageSize || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';
      const invoiceBody = extractInvoiceBody(html);
      const logoUri = getToolbarLogoDataUri(app);
      const doc = buildPreviewShell(invoiceBody, pageSize, logoUri);

      const tmpPath = path.join(
        app.getPath('temp'),
        `pve-print-preview-${Date.now()}.html`
      );
      fs.writeFileSync(tmpPath, doc, 'utf8');
      activePreviewPath = tmpPath;

      previewWindow = new BrowserWindow(
        createAppChildWindowOptions({
          show: true,
          width: 960,
          height: 900,
          title: 'PVE InvoicePro 360 — Print Preview',
          webPreferences: {
            preload: getPrintPreviewPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
          },
        })
      );

      activePreviewWindow = previewWindow;

      previewWindow.on('closed', () => {
        activePreviewWindow = null;
        try {
          if (activePreviewPath && fs.existsSync(activePreviewPath)) {
            fs.unlinkSync(activePreviewPath);
          }
        } catch {
          // ignore
        }
        activePreviewPath = null;
      });

      await previewWindow.loadFile(tmpPath);
      return true;
    } catch (error) {
      console.error('print:open-preview failed', error);
      if (previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.close();
      }
      activePreviewWindow = null;
      return false;
    }
  });

  ipcMain.handle('print:preview-print', async () => {
    const win = activePreviewWindow;
    if (!win || win.isDestroyed()) return false;
    return new Promise((resolve) => {
      win.webContents.print({ printBackground: true, silent: false }, (ok) => {
        resolve(Boolean(ok));
      });
    });
  });

  ipcMain.handle('print:preview-close', () => {
    if (activePreviewWindow && !activePreviewWindow.isDestroyed()) {
      activePreviewWindow.close();
    }
    return true;
  });

  ipcMain.handle('print:preview-set-size', async (_event, size) => {
    const win = activePreviewWindow;
    if (!win || win.isDestroyed()) return false;
    const normalized = String(size || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';
    await win.webContents.executeJavaScript(`
      (function() {
        var s = ${JSON.stringify(normalized)};
        document.body.setAttribute('data-page-size', s);
        var st = document.getElementById('pve-page-style');
        if (st) {
          st.textContent = s === 'A5'
            ? '@page { size: A5 portrait; margin: 8mm; } body { font-size: 7px !important; }'
            : '@page { size: A4 portrait; margin: 8mm; } body { font-size: 10px !important; }';
        }
        var root = document.getElementById('pve-invoice-root');
        if (root) {
          root.style.width = s === 'A5' ? '148mm' : '210mm';
          root.style.minHeight = s === 'A5' ? '210mm' : '297mm';
          var innerStyles = root.querySelectorAll('style');
          innerStyles.forEach(function(el) {
            var text = el.textContent || '';
            if (text.indexOf('@page') >= 0) {
              el.textContent = s === 'A5'
                ? text.replace(/@page\\s*\\{[^}]*\\}/, '@page { size: A5 portrait; margin: 8mm; }')
                      .replace(/font-size:\\s*10px/, 'font-size: 7px')
                : text.replace(/@page\\s*\\{[^}]*\\}/, '@page { size: A4 portrait; margin: 8mm; }')
                      .replace(/font-size:\\s*7px/, 'font-size: 10px');
            }
          });
        }
        var a4 = document.getElementById('pve-btn-a4');
        var a5 = document.getElementById('pve-btn-a5');
        if (a4) a4.classList.toggle('active', s === 'A4');
        if (a5) a5.classList.toggle('active', s === 'A5');
      })();
    `);
    return true;
  });
}

function writeHtmlToTempFile(app, html, prefix = 'pve-print') {
  const tmpPath = path.join(app.getPath('temp'), `${prefix}-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, String(html || ''), 'utf8');
  return tmpPath;
}

module.exports = { registerPrintPreviewIpc, writeHtmlToTempFile };
