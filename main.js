import 'dotenv/config';
import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startReader } from './reader/whatsappReader.js';
import { processLines } from './shared/messageParser.js';
import { initializeWhatsAppSender, sendWhatsAppMessage, closeWhatsAppSender, isWhatsAppSenderActive } from './sender/whatsappSender.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let reader;
let windowShown = false;

function showWindowOnce() {
  if (windowShown) return;
  windowShown = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
}

function loadPayload() {
  try {
    const pj = process.env.PAYLOAD_JSON;
    if (!pj) {
      console.log('[main] No PAYLOAD_JSON environment variable found');
      return null;
    }
    return JSON.parse(pj);
  } catch (error) {
    console.error('[main] Failed to parse PAYLOAD_JSON:', error.message);
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 520,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  console.log('[main] BrowserWindow created');
  
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[main] webContents did-start-loading');
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    console.log('[main] webContents dom-ready');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] webContents did-finish-load');
  });
  
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error('[main] webContents did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log('[renderer console]', { level, message, line, sourceId });
  });
  
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] render-process-gone', details);
  });
  
  mainWindow.on('unresponsive', () => {
    console.warn('[main] window unresponsive');
  });
  
  mainWindow.on('responsive', () => {
    console.log('[main] window responsive');
  });
  // Cross-platform path handling
  const currentDir = process.platform === 'win32' 
    ? path.dirname(fileURLToPath(import.meta.url))
    : path.dirname(new URL(import.meta.url).pathname);
  mainWindow.loadFile(path.join(currentDir, 'renderer', 'index.html'));
  mainWindow.maximize(); // Maximize window instead of fullscreen
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Register protocol before app is ready
app.whenReady().then(async () => {
  console.log('[main] app ready');
  
  // Register protocol to serve images
  protocol.registerFileProtocol('local-images', (request, callback) => {
    const url = request.url.replace('local-images://', '');
    // Cross-platform path handling
    const currentDir = process.platform === 'win32' 
      ? path.dirname(fileURLToPath(import.meta.url))
      : path.dirname(new URL(import.meta.url).pathname);
    const imagesDir = path.join(currentDir, 'images');
    let imagePath = path.join(imagesDir, url);
    
    console.log('[main] serving image:', imagePath);
    
    // If exact file doesn't exist and it's an order_image, try to find the most recent one
    if (url.startsWith('order_image_') && !fs.existsSync(imagePath)) {
      try {
        const files = fs.readdirSync(imagesDir);
        const orderImages = files.filter(f => f.startsWith('order_image_') && f.endsWith('.jpg'));
        if (orderImages.length > 0) {
          // Sort by filename (which includes timestamp) and get the most recent
          orderImages.sort().reverse();
          imagePath = path.join(imagesDir, orderImages[0]);
          console.log('[main] Using default application icon:', imagePath);
        }
      } catch (error) {
        console.error('[main] Failed to find default application icon:', error.message);
      }
    }
    
    callback({ path: imagePath });
  });
  
  const payload = loadPayload();
  app.setAppUserModelId('com.fambri.placeorder');
  createWindow();
  // Sync alias reader for preload (no fs in preload sandbox)
  ipcMain.on('read-aliases-sync', (event) => {
    try {
      const baseDir = __dirname;
      const fromEnv = process.env.COMPANY_ALIASES_FILE;
      const altEnv = process.env.ALIAS_FILE;
      
      if (!fromEnv && !altEnv) {
        throw new Error('COMPANY_ALIASES_FILE or ALIAS_FILE environment variable required');
      }
      
      const envValue = fromEnv ? fromEnv : altEnv;
      const filePath = path.isAbsolute(envValue) ? envValue : path.join(baseDir, envValue);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const obj = JSON.parse(raw);
      event.returnValue = (obj && typeof obj === 'object') ? obj : {};
    } catch (error) {
      console.error('[main] Failed to read company aliases:', error.message);
      event.returnValue = {};
    }
  });

  // Sync config readers for preload
  ipcMain.on('read-patterns-config-sync', (event) => {
    try {
      const filePath = path.join(__dirname, 'config', 'patterns.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const obj = JSON.parse(raw);
      event.returnValue = (obj && typeof obj === 'object') ? obj : {};
    } catch (error) {
      console.error('[main] Failed to read patterns config:', error.message);
      event.returnValue = {};
    }
  });

  ipcMain.on('read-validation-config-sync', (event) => {
    try {
      const filePath = path.join(__dirname, 'config', 'validation.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      const obj = JSON.parse(raw);
      event.returnValue = (obj && typeof obj === 'object') ? obj : {};
    } catch (error) {
      console.error('[main] Failed to read validation config:', error.message);
      event.returnValue = {};
    }
  });
  
  ipcMain.on('get-image-path', (event, filename) => {
    try {
      const imagePath = path.join(__dirname, 'images', filename);
      console.log('[main] get-image-path:', filename, '-> __dirname:', __dirname, '-> imagePath:', imagePath);
      event.returnValue = imagePath;
    } catch (error) {
      console.error('[main] Failed to get image path:', error.message);
      event.returnValue = '';
    }
  });

  // WhatsApp sender IPC handlers
  ipcMain.handle('whatsapp-sender-init', async () => {
    try {
      const sessionPath = process.env.WHATSAPP_SESSION_PATH;
      const headless = process.env.HEADLESS === '1';
      
      if (!sessionPath) {
        throw new Error('WHATSAPP_SESSION_PATH not configured');
      }
      
      await initializeWhatsAppSender(sessionPath, headless);
      console.log('[main] WhatsApp sender initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('[main] Failed to initialize WhatsApp sender:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp-send-message', async (event, { phoneNumber, message }) => {
    try {
      if (!isWhatsAppSenderActive()) {
        // Try to initialize if not active
        const sessionPath = process.env.WHATSAPP_SESSION_PATH;
        const headless = process.env.HEADLESS === '1';
        await initializeWhatsAppSender(sessionPath, headless);
      }
      
      await sendWhatsAppMessage(phoneNumber, message);
      console.log('[main] WhatsApp message sent successfully');
      return { success: true };
    } catch (error) {
      console.error('[main] Failed to send WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp-sender-status', async () => {
    return { active: isWhatsAppSenderActive() };
  });
  if (payload) {
    setTimeout(() => {
      console.log('[main] sending payload from env', { size: JSON.stringify(payload).length });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('payload', payload);
      }
      showWindowOnce();
    }, 150);
    
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('payload_debug', { stage: 'pre-send', source: 'env', payload });
      }
    }, 140);
  }

  // Re-enable WhatsApp reader with session conflict fix
  try {
    console.log('[main] starting reader');
    reader = await startReader(process.env, (batch) => {
      if (!batch) return;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('payload_debug', { stage: 'pre-send', source: 'reader', payload: batch });
      }
      
      // Process the raw WhatsApp messages using enhanced parsing
      let processedPayload = batch;
      try {
        if (Array.isArray(batch?.items_text) && batch.items_text.length > 0) {
          const parseResult = processLines(batch.items_text);
          if (parseResult && parseResult.orders && parseResult.orders.length > 0) {
            // Convert to format expected by renderer (add removed and verified fields)
            const enhancedOrders = parseResult.orders.map(order => ({
              ...order,
              removed: new Set(),
              verified: false
            }));
            processedPayload = {
              ...batch,
              orders: enhancedOrders
            };
            console.log('[main] enhanced parsing processed', { 
              rawLines: batch.items_text.length, 
              parsedOrders: enhancedOrders.length 
            });
          }
        }
      } catch (e) {
        console.error('[main] enhanced parsing failed, using original', e);
        // Fall back to original batch if parsing fails
      }
      
      const count = Array.isArray(processedPayload?.items_text) ? processedPayload.items_text.length : (Array.isArray(processedPayload?.orders) ? processedPayload.orders.length : 0);
      console.log('[main] sending payload from reader', { count });
      
      // send processed batch for debug panel
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('payload', processedPayload);
      }
      
      // additionally stream each line as its own event (for compatibility)
      const lines = Array.isArray(batch?.items_text) ? batch.items_text : [];
      for (const line of lines) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('payload_line', line);
        }
      }
      
      showWindowOnce();
    });
  } catch (e) {
    console.error('[main] reader_start_failed', e);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const errorMessage = e?.message ? e.message : String(e);
        mainWindow.webContents.send('payload', { error: 'reader_start_failed', message: errorMessage });
      }
    }, 300);
  }

  // Safety timeout: show the window even if no payload yet after 10s
  setTimeout(() => { showWindowOnce(); }, 10000);

  app.on('activate', () => { 
    console.log('[main] app activate'); 
    if (BrowserWindow.getAllWindows().length === 0) createWindow(); 
  });
});

async function stopReader() { 
  console.log('[main] stopping reader'); 
  if (reader && typeof reader.stop === 'function') {
    try {
      await reader.stop();
    } catch (error) {
      console.error('[main] Error stopping reader:', error.message);
    }
  }
}

app.on('before-quit', stopReader);
app.on('will-quit', () => { 
  console.log('[main] will-quit'); 
});
app.on('window-all-closed', async () => { 
  console.log('[main] window-all-closed'); 
  await stopReader(); 
  
  // Clean up WhatsApp sender
  try {
    await closeWhatsAppSender();
  } catch (error) {
    console.error('[main] Error closing WhatsApp sender:', error);
  }
  
  if (process.platform !== 'darwin') app.quit(); 
});
