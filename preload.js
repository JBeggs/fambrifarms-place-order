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
    const raw = process.env.FORWARDER_NAMES || process.env.FORWARDERS || '';
    if (!raw) return ['karl'];
    let arr = [];
    if (raw.trim().startsWith('[')) {
      arr = JSON.parse(raw);
    } else {
      arr = raw.split(',');
    }
    if (!Array.isArray(arr)) {
      console.warn('[preload] Forwarder names is not an array:', arr);
      return ['karl'];
    }
    return arr.map(s => {
      if (s === null || s === undefined) {
        return '';
      }
      return String(s).trim().toLowerCase();
    }).filter(Boolean);
  } catch (error) {
    console.error('[preload] Failed to parse forwarder names:', error.message);
    return ['karl'];
  }
}

contextBridge.exposeInMainWorld('api', {
  onPayload: (cb) => ipcRenderer.on('payload', (_e, d) => cb(d)),
  onPayloadDebug: (cb) => ipcRenderer.on('payload_debug', (_e, d) => cb(d)),
  onPayloadLine: (cb) => ipcRenderer.on('payload_line', (_e, d) => cb(d)),
  getPayload,
  getBackendUrl: () => process.env.BACKEND_API_URL || '',
  getCompanyAliases,
  getForwarderNames,
  getImagePath: (filename) => {
    // Send sync request to main process to get the image path
    return ipcRenderer.sendSync('get-image-path', filename);
  }
});
