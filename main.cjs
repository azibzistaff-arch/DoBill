const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let serverProcess = null;
let mainWindow = null;

function startServer() {
  // Path to our compiled Express server
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  
  // Fork the Express server process
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env, 
      NODE_ENV: 'production', 
      PORT: '3000' 
    }
  });

  serverProcess.on('message', (msg) => {
    console.log('Server message:', msg);
  });

  serverProcess.on('error', (err) => {
    console.error('Server error:', err);
  });
}

// IPC Handlers for silent printing
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error('Failed to get printers:', err);
    return [];
  }
});

ipcMain.handle('print-silent', async (event, htmlContent, printOptions = {}) => {
  return new Promise((resolve, reject) => {
    let workerWindow = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    // Use a high-fidelity data URL to load the HTML content
    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    const isLandscape = printOptions.landscape || (typeof htmlContent === 'string' && htmlContent.toLowerCase().includes('landscape'));

    const options = {
      silent: true,
      printBackground: true,
      margins: { marginType: 'none' },
      landscape: isLandscape,
      ...printOptions
    };

    workerWindow.webContents.on('did-finish-load', () => {
      // Allow Chromium layout and SVG rendering engine to settle before executing print
      setTimeout(() => {
        workerWindow.webContents.print(options, (success, failureReason) => {
          workerWindow.close();
          if (success) {
            resolve(true);
          } else {
            reject(new Error(failureReason || 'Printing failed'));
          }
        });
      }, 300);
    });
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DoBill POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, 'src', 'assets', 'logo.png')
  });

  // Give the Express server a moment to start, then load the live web URL (for real-time sync)
  // falling back to local offline mode if there is no internet connection.
  setTimeout(() => {
    const hostedUrl = 'https://dobill2-pl2w.onrender.com/';
    mainWindow.loadURL(hostedUrl).catch((err) => {
      console.log('Failed to load live cloud URL, falling back to local offline mode:', err.message);
      mainWindow.loadURL('http://localhost:3000').catch((localErr) => {
        console.error('Failed to load local offline server:', localErr.message);
      });
    });
  }, 1500);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
