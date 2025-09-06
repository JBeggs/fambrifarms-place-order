import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import https from 'https';
import http from 'http';

export async function startReader(env, onBatch) {
  const required = ['TARGET_GROUP_NAME', 'WHATSAPP_SESSION_PATH', 'SLEEP_DELAY', 'LOAD_TIMEOUT', 'LOGIN_TIMEOUT', 'MONITOR_INTERVAL'];
  for (const k of required) if (!env[k]) throw new Error(`${k} not set`);

  const targetGroupName = env.TARGET_GROUP_NAME;
  const sessionPath = env.WHATSAPP_SESSION_PATH;
  const sleepDelay = parseInt(env.SLEEP_DELAY);
  const loadTimeout = parseInt(env.LOAD_TIMEOUT);
  const loginTimeout = parseInt(env.LOGIN_TIMEOUT);
  const monitorInterval = parseInt(env.MONITOR_INTERVAL);
  const headless = env.HEADLESS === '1';

  const dataDir = path.resolve(process.cwd(), 'place-order', 'data');
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  const imagesDir = path.resolve(currentDir, '..', 'images');
  console.log('[reader] Images directory:', imagesDir);
  try { 
    fs.mkdirSync(dataDir, { recursive: true }); 
  } catch (error) {
    console.error('[reader] Failed to create data directory:', error.message);
  }
  
  try { 
    fs.mkdirSync(imagesDir, { recursive: true }); 
  } catch (error) {
    console.error('[reader] Failed to create images directory:', error.message);
  }
  
  const statePath = path.join(dataDir, 'processed-state.json');
  let lastProcessedMs = 0;
  const downloadedImages = new Set(); // Track downloaded image URLs
  
  try { 
    const raw = fs.readFileSync(statePath, 'utf-8'); 
    const parsed = JSON.parse(raw);
    lastProcessedMs = parsed.lastProcessedMs ? parsed.lastProcessedMs : 0;
  } catch (error) {
    console.warn('[reader] Failed to load processed state, starting fresh:', error.message);
  }

  const options = new chrome.Options();
  // Make session path unique to avoid conflicts with other instances
  const uniqueSessionPath = `${sessionPath}_${Date.now()}_${process.pid}`;
  options.addArguments(`--user-data-dir=${uniqueSessionPath}`);
  if (headless) options.addArguments('--headless=new', '--disable-gpu', '--window-size=1920,1080', '--disable-dev-shm-usage');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  console.log('[reader] driver started', { headless, sessionPath });

  async function downloadImage(imageUrl, filename) {
    return new Promise((resolve, reject) => {
      if (!imageUrl || !imageUrl.startsWith('http')) {
        reject(new Error('Invalid image URL'));
        return;
      }

      const filePath = path.join(imagesDir, filename);
      const file = fs.createWriteStream(filePath);
      const client = imageUrl.startsWith('https') ? https : http;

      client.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });

        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Delete partial file
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async function saveImageFromElement(imgElement, baseFilename) {
    try {
      // Get the image source URL
      const imgSrc = await imgElement.getAttribute('src');
      console.log(`[reader] Image src: ${imgSrc}`);
      
      if (imgSrc && imgSrc.startsWith('http')) {
        // Download from URL
        const filename = `${baseFilename}.jpg`;
        console.log(`[reader] Downloading HTTP image: ${imgSrc} -> ${filename}`);
        await downloadImage(imgSrc, filename);
        console.log(`[reader] HTTP download completed: ${filename}`);
        return `/images/${filename}`;
      } else if (imgSrc && (imgSrc.startsWith('data:') || imgSrc.startsWith('blob:'))) {
        // For data URLs or blob URLs, get image as base64
        const base64Data = await driver.executeScript(`
          const img = arguments[0];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 300;
          
          return new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            if (img.complete) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            }
          });
        `, imgElement);
        
        if (base64Data && base64Data.startsWith('data:image')) {
          // Remove data URL prefix and decode base64
          const base64 = base64Data.split(',')[1];
          const buffer = Buffer.from(base64, 'base64');
          const filename = `${baseFilename}.jpg`;
          const filePath = path.join(imagesDir, filename);
          console.log(`[reader] Converting blob/data image to JPEG: ${filename}`);
          fs.writeFileSync(filePath, buffer);
          console.log(`[reader] Blob/data download completed: ${filename}`);
          return `/images/${filename}`;
        } else {
          console.log(`[reader] Failed to convert blob/data image: ${base64Data ? 'invalid format' : 'no data'}`);
        }
      }
    } catch (error) {
      console.error('[reader] failed to save image:', error.message);
    }
    return null;
  }

  async function waitForMessages() {
    await driver.wait(until.elementLocated(By.css('.copyable-text[data-pre-plain-text], [data-testid="msg-container"]')), loadTimeout);
  }

  async function openGroup() {
    console.log('[reader] navigating to web.whatsapp.com');
    await driver.get('https://web.whatsapp.com');
    await driver.sleep(sleepDelay);
    await driver.wait(until.elementLocated(By.css('span[title], [data-testid="qr-code"]')), loadTimeout);
    const qr = await driver.findElements(By.css('[data-testid="qr-code"]'));
    if (qr.length) { 
      console.log('[reader] qr present, waiting for login'); 
      await driver.wait(until.elementLocated(By.css('span[title]')), loginTimeout); 
    }
    const want = targetGroupName.trim().toLowerCase();

    async function clickChatByTitle(title) {
      for (let i = 0; i < 3; i++) {
        try {
          const el = await driver.wait(
            until.elementLocated(By.xpath(`//span[@title="${title}"]`)),
            5000
          );
          await el.click();
          await driver.sleep(sleepDelay);
          await waitForMessages();
          return true;
        } catch (e) {
          const errorName = e && e.name ? e.name : String(e);
          console.warn('[reader] retry clickChatByTitle', { attempt: i + 1, title, error: errorName });
          await driver.sleep(500);
        }
      }
      return false;
    }

    // Try to match from visible list using fresh lookups (avoid stale references)
    const chats = await driver.findElements(By.css('span[title]'));
    const titles = [];
    for (const chat of chats) {
      try { 
        const titleAttr = await chat.getAttribute('title');
        const t = titleAttr ? titleAttr.trim() : '';
        if (t) titles.push(t); 
      } catch (error) {
        console.warn('[reader] Failed to get chat title:', error.message);
      }
    }
    for (const title of titles) {
      const t = title.toLowerCase();
      if (t === want || t.includes(want) || want.includes(t)) {
        console.log('[reader] opening matched chat', { title });
        const ok = await clickChatByTitle(title);
        if (ok) return;
      }
    }

    // Search fallback
    console.log('[reader] using search fallback');
    try {
      const search = await driver.findElement(By.css('[data-testid="chat-list-search"]'));
      await search.clear();
      await search.sendKeys(targetGroupName);
      await driver.sleep(800);
      const ok = await clickChatByTitle(targetGroupName);
      if (ok) return;
    } catch (error) {
      console.warn('[reader] Search fallback failed:', error.message);
    }

    // Final attempt: refresh titles and try partial matches again
    const chats2 = await driver.findElements(By.css('span[title]'));
    for (const chat of chats2) {
      let title = '';
      try { 
        const titleAttr = await chat.getAttribute('title');
        title = titleAttr ? titleAttr.trim() : ''; 
      } catch (error) {
        console.warn('[reader] Failed to get chat title in final attempt:', error.message);
      }
      if (!title) continue;
      const t = title.toLowerCase();
      if (t.includes(want) || want.includes(t)) {
        console.log('[reader] opening matched chat (final)', { title });
        const ok = await clickChatByTitle(title);
        if (ok) return;
      }
    }

    throw new Error('Failed to open target group');
  }

  async function getGroupMembers() {
    try {
      const headerSpans = await driver.findElements(By.css('header [title]'));
      for (const span of headerSpans) {
        const t = await span.getAttribute('title');
        if (t && (t.includes('+') || t.includes(','))) {
          const parts = t.split(', ').map(s => s.trim());
          const names = parts.filter(p => !p.startsWith('+') && p !== 'You');
          const numbers = parts.filter(p => p.startsWith('+'));
          return { names, numbers };
        }
      }
    } catch (error) {
      console.warn('[reader] Failed to get group members:', error.message);
    }
    return { names: [], numbers: [] };
  }

  async function collectVisible() {
    const items = [];
    
    // Collect text messages
    const textNodes = await driver.findElements(By.css('.copyable-text[data-pre-plain-text]'));
    for (const el of textNodes) {
      try {
        const pre = await el.getAttribute('data-pre-plain-text');
        const textContent = await el.getText();
        const text = textContent ? textContent.trim() : '';
        if (!pre || !text) continue;
        const m = pre.match(/\[([^\]]+)\]/);
        const ts = m ? m[1] : null;
        if (!ts) continue;
        const momentDate = moment(ts, ['HH:mm, DD/MM/YYYY','H:mm, DD/MM/YYYY','HH:mm, D/M/YYYY','H:mm, D/M/YYYY']).toDate();
        const tsMs = momentDate.getTime();
        if (isNaN(tsMs)) {
          console.warn('[reader] Invalid timestamp:', ts);
          continue;
        }
        items.push({ ts, tsMs, text, pre });
      } catch (error) {
        console.warn('[reader] Failed to process text message:', error.message);
      }
    }
    
    // Collect image messages with multiple selector strategies
    try {
      console.log('[reader] Looking for images...');
      // Strategy 1: Look for image containers
      const imageSelectors = [
        'div[data-testid="image-thumb"] img',
        'div[data-testid="media-content"] img', 
        '[data-testid="msg-container"] img[src*="blob:"]',
        '[data-testid="msg-container"] img[src*="mmid"]',
        'span[data-testid="image-thumb"] img',
        'div._3v3PK img',
        'div._1DZAH img',
        'img[src*="web.whatsapp.com"]',
        'img[src*="pps.whatsapp.net"]'
      ];
      
      for (const selector of imageSelectors) {
        try {
          const images = await driver.findElements(By.css(selector));
          console.log(`[reader] Found ${images.length} images with selector: ${selector}`);
          for (const img of images) {
            try {
              // Get image URL first to check if we've already downloaded it
              const imgSrc = await img.getAttribute('src');
              if (downloadedImages.has(imgSrc)) {
                console.log(`[reader] Skipping already downloaded image: ${imgSrc}`);
                continue;
              }
              
              // Use consistent naming that matches message parser format
              const imageId = `order_image_${Date.now()}`;
              console.log(`[reader] Processing new image: ${imageId}`);
              
              console.log(`[reader] Attempting to download image: ${imageId}`);
              const imagePath = await saveImageFromElement(img, imageId);
              
              if (imagePath) {
                // Mark this image URL as downloaded
                downloadedImages.add(imgSrc);
                
                const text = `<image:${imagePath}>`;
                const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                const pre = `[${currentTime}] Image:`;
                const tsMs = Date.now();
                items.push({ ts: currentTime, tsMs, text, pre, isImage: true });
                console.log('[reader] Successfully saved image:', imagePath);
              } else {
                console.log('[reader] Failed to save image - saveImageFromElement returned null');
              }
            } catch (error) {
              console.error(`[reader] Error processing image ${imageId}:`, error.message);
            }
          }
        } catch (error) {
          console.warn('[reader] Failed to process image selector:', selector, error.message);
        }
      }
    } catch (error) {
      console.error('[reader] Failed to collect images:', error.message);
    }
    
    items.sort((a, b) => a.tsMs - b.tsMs);
    return items;
  }

  function formatLines(unread, groupMembers) {
    return unread.map(m => {
      let sender = null; 
      
      if (m.isImage) {
        // For image messages, try to determine sender from context or use a default
        sender = 'Image'; // Default for now - could be enhanced to detect actual sender
      } else {
        const sm = m.pre.match(/\] ([^:]+):/); 
        if (sm) sender = (sm[1] || '').trim();
      }
      
      let company = sender || 'Unknown'; 
      let phone = '';
      
      if (sender && sender.startsWith('+')) { 
        phone = sender; 
        const idx = groupMembers.numbers.indexOf(sender); 
        if (idx >= 0 && idx < groupMembers.names.length) company = groupMembers.names[idx] || company; 
      } else if (sender && sender !== 'Image') { 
        const idx = groupMembers.names.indexOf(sender); 
        if (idx >= 0 && idx < groupMembers.numbers.length) phone = groupMembers.numbers[idx] || ''; 
      }
      
      const phonePart = phone ? ` · ${phone}` : '';
      return `[${m.ts}] ${company}${phonePart} → ${m.text}`;
    });
  }

  async function packageAndEmit(initial = false) {
    const items = await collectVisible();
    if (items.length === 0) return;
    let unread = items.filter(m => m.tsMs > (lastProcessedMs || 0));
    if (initial) unread = items; // send all on first load
    if (unread.length === 0) return;
    const gm = await getGroupMembers();
    const lines = formatLines(unread, gm);
    const payload = { handoff_version: '1.0', items_text: lines, source: 'whatsapp', group: targetGroupName };
    console.log('[reader] emitting batch', { count: lines.length });
    onBatch(payload);
    const newLastProcessedMs = lastProcessedMs ? lastProcessedMs : 0;
    lastProcessedMs = Math.max(newLastProcessedMs, ...unread.map(u => u.tsMs));
    try { 
      fs.writeFileSync(statePath, JSON.stringify({ lastProcessedMs }, null, 2)); 
    } catch (error) {
      console.error('[reader] Failed to save processed state:', error.message);
    }
  }

  await openGroup();
  await packageAndEmit(true);
  const timer = setInterval(() => { 
    packageAndEmit(false).catch((error) => {
      console.error('[reader] Error in packageAndEmit interval:', error.message);
    }); 
  }, monitorInterval);

  return { 
    stop: async () => { 
      try { 
        clearInterval(timer); 
        await driver.quit(); 
      } catch (error) {
        console.error('[reader] Error stopping reader:', error.message);
      }
    } 
  };
}
