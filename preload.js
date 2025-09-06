const { contextBridge, ipcRenderer } = require('electron');
console.log('[preload] loaded');

function getPayload() {
  try { 
    const payloadJson = process.env.PAYLOAD_JSON;
    if (!payloadJson) {
      return null;
    }
    return JSON.parse(payloadJson); 
  } catch (error) {
    console.error('[preload] Failed to parse PAYLOAD_JSON:', error.message);
    return null; 
  }
}

function getCompanyAliases() {
  try { 
    return ipcRenderer.sendSync('read-aliases-sync'); 
  } catch (error) {
    console.error('[preload] Failed to get company aliases:', error.message);
    return {}; 
  }
}

function getForwarderNames() {
  try {
    const raw = process.env.FORWARDER_NAMES;
    const altRaw = process.env.FORWARDERS;
    
    if (!raw && !altRaw) {
      console.warn('[preload] FORWARDER_NAMES or FORWARDERS environment variable not set');
      return [];
    }
    
    const envValue = raw ? raw : altRaw;
    let arr = [];
    if (envValue.trim().startsWith('[')) {
      arr = JSON.parse(envValue);
    } else {
      arr = envValue.split(',');
    }
    if (!Array.isArray(arr)) {
      console.warn('[preload] Forwarder names is not an array:', arr);
      throw new Error('FORWARDER_NAMES must be a valid array or comma-separated string');
    }
    return arr.map(s => {
      if (s === null) {
        return '';
      }
      if (s === undefined) {
        return '';
      }
      return String(s).trim().toLowerCase();
    }).filter(Boolean);
  } catch (error) {
    console.error('[preload] Failed to parse forwarder names:', error.message);
    throw error;
  }
}

function getPatternsConfig() {
  try { 
    return ipcRenderer.sendSync('read-patterns-config-sync'); 
  } catch (error) {
    console.error('[preload] Failed to get patterns config:', error.message);
    return {}; 
  }
}

function getValidationConfig() {
  try { 
    return ipcRenderer.sendSync('read-validation-config-sync'); 
  } catch (error) {
    console.error('[preload] Failed to get validation config:', error.message);
    return {}; 
  }
}

contextBridge.exposeInMainWorld('api', {
  onPayload: (cb) => ipcRenderer.on('payload', (_e, d) => cb(d)),
  onPayloadDebug: (cb) => ipcRenderer.on('payload_debug', (_e, d) => cb(d)),
  onPayloadLine: (cb) => ipcRenderer.on('payload_line', (_e, d) => cb(d)),
  getPayload,
  getBackendUrl: () => {
    const url = process.env.BACKEND_API_URL;
    if (!url) {
      throw new Error('BACKEND_API_URL environment variable is required');
    }
    return url;
  },
  getCompanyAliases,
  getForwarderNames,
  getPatternsConfig,
  getValidationConfig,
  getImagePath: (filename) => {
    // Send sync request to main process to get the image path
    return ipcRenderer.sendSync('get-image-path', filename);
  },
  // WhatsApp sender methods
  whatsappSenderInit: () => ipcRenderer.invoke('whatsapp-sender-init'),
  whatsappSendMessage: (data) => ipcRenderer.invoke('whatsapp-send-message', data),
  whatsappSenderStatus: () => ipcRenderer.invoke('whatsapp-sender-status')
});
