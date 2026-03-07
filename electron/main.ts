import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load Vite dev server; in prod, load built files
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-app/index.html'));
  }

  // Forward renderer console to terminal so we can read logs
  mainWindow.webContents.on('console-message', (ev) => {
    const tag = ['LOG', 'WARN', 'ERROR'][ev.level] ?? 'LOG';
    const source = ev.sourceId ? ev.sourceId.split('/').pop() : '';
    console.log(`[renderer:${tag}] ${ev.message}${source ? ` (${source}:${ev.line})` : ''}`);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
