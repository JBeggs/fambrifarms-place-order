import { Builder, By, until, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

let senderDriver = null;

export async function initializeWhatsAppSender(sessionPath, headless = false) {
  if (senderDriver) {
    console.log('[sender] WhatsApp sender already initialized');
    return senderDriver;
  }

  const options = new chrome.Options();
  options.addArguments(`--user-data-dir=${sessionPath}`);
  if (headless) {
    options.addArguments('--headless=new', '--disable-gpu', '--window-size=1920,1080', '--disable-dev-shm-usage');
  }

  try {
    senderDriver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    console.log('[sender] WhatsApp sender driver initialized');
    
    // Navigate to WhatsApp Web
    await senderDriver.get('https://web.whatsapp.com');
    
    // Wait for WhatsApp to load (either QR code or chat interface)
    await senderDriver.wait(until.elementLocated(By.css('[data-testid="chat-list"]')), 30000);
    console.log('[sender] WhatsApp Web loaded successfully');
    
    return senderDriver;
  } catch (error) {
    console.error('[sender] Failed to initialize WhatsApp sender:', error);
    if (senderDriver) {
      try {
        await senderDriver.quit();
      } catch (quitError) {
        console.error('[sender] Error quitting driver after initialization failure:', quitError);
      }
      senderDriver = null;
    }
    throw error;
  }
}

export async function sendWhatsAppMessage(phoneNumber, message) {
  if (!senderDriver) {
    throw new Error('WhatsApp sender not initialized. Call initializeWhatsAppSender first.');
  }

  try {
    console.log('[sender] Sending WhatsApp message to:', phoneNumber);
    
    // If phone number is provided, search for the contact
    if (phoneNumber) {
      await searchAndSelectContact(phoneNumber);
    }
    
    // Find the message input box
    const messageBox = await senderDriver.wait(
      until.elementLocated(By.css('[data-testid="conversation-compose-box-input"]')),
      10000
    );
    
    // Clear any existing text
    await messageBox.clear();
    
    // Split message by lines and send each line
    const lines = message.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        // Add line break by pressing Shift+Enter
        await messageBox.sendKeys(Key.SHIFT, Key.ENTER);
      }
      await messageBox.sendKeys(lines[i]);
    }
    
    // Send the message by pressing Enter
    await messageBox.sendKeys(Key.ENTER);
    
    console.log('[sender] Message sent successfully');
    return true;
    
  } catch (error) {
    console.error('[sender] Failed to send WhatsApp message:', error);
    throw error;
  }
}

async function searchAndSelectContact(phoneNumber) {
  try {
    // Click on the search box
    const searchBox = await senderDriver.wait(
      until.elementLocated(By.css('[data-testid="chat-list-search"]')),
      10000
    );
    
    await searchBox.clear();
    await searchBox.sendKeys(phoneNumber);
    
    // Wait a moment for search results
    await senderDriver.sleep(2000);
    
    // Try to find and click the contact
    try {
      const contactElement = await senderDriver.wait(
        until.elementLocated(By.css('[data-testid="cell-frame-container"]')),
        5000
      );
      await contactElement.click();
      console.log('[sender] Contact selected successfully');
    } catch (contactError) {
      console.warn('[sender] Could not find contact, will send to current chat');
      // Clear search box if contact not found
      await searchBox.clear();
    }
    
  } catch (error) {
    console.error('[sender] Error searching for contact:', error);
    // Continue anyway - might be able to send to current chat
  }
}

export async function closeWhatsAppSender() {
  if (senderDriver) {
    try {
      await senderDriver.quit();
      console.log('[sender] WhatsApp sender closed');
    } catch (error) {
      console.error('[sender] Error closing WhatsApp sender:', error);
    } finally {
      senderDriver = null;
    }
  }
}

export function isWhatsAppSenderActive() {
  return senderDriver !== null;
}
