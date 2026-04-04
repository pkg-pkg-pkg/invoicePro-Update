const { app, BrowserWindow } = require('electron');

console.log('Test Electron app starting...');

function createWindow() {
  console.log('Creating test window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadURL('http://localhost:5173');
  console.log('Window created and URL loaded');
}

app.whenReady().then(() => {
  console.log('App ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
