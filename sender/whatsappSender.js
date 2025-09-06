import { By, until, Key } from 'selenium-webdriver';

// We'll receive the driver from the reader instead of creating our own
let readerDriver = null;

export function setReaderDriver(driver) {
  readerDriver = driver;
  console.log('[sender] Using shared WhatsApp reader driver for sending');
}

export async function initializeWhatsAppSender() {
  if (!readerDriver) {
    throw new Error('Reader driver not available. WhatsApp reader must be running first.');
  }
  
  console.log('[sender] WhatsApp sender using existing reader session');
  return readerDriver;
}

export async function sendWhatsAppMessage(phoneNumber, message) {
  if (!readerDriver) {
    throw new Error('WhatsApp reader driver not available. Reader must be running first.');
  }

  try {
    console.log('[sender] Sending WhatsApp message to:', phoneNumber);
    
    // If phone number is provided, search for the contact
    if (phoneNumber) {
      await searchAndSelectContact(phoneNumber);
    }
    
    // Find the message input box
    const messageBox = await readerDriver.wait(
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
    const searchBox = await readerDriver.wait(
      until.elementLocated(By.css('[data-testid="chat-list-search"]')),
      10000
    );
    
    await searchBox.clear();
    await searchBox.sendKeys(phoneNumber);
    
    // Wait a moment for search results
    await readerDriver.sleep(2000);
    
    // Try to find and click the contact
    try {
      const contactElement = await readerDriver.wait(
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
  // We don't close the driver since it's shared with the reader
  console.log('[sender] WhatsApp sender cleanup (shared driver remains active)');
  readerDriver = null;
}

export function isWhatsAppSenderActive() {
  return readerDriver !== null;
}
