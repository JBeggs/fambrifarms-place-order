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
    
    // If phone number is provided, search for the contact and start conversation
    if (phoneNumber) {
      const contactFound = await searchAndSelectContact(phoneNumber);
      if (!contactFound) {
        // If contact not found, try to start a new conversation
        await startNewConversation(phoneNumber);
      }
    }
    
    // Wait for the conversation to be active and find the message input box
    let messageBox;
    try {
      // Try the main compose box first
      messageBox = await readerDriver.wait(
        until.elementLocated(By.css('[data-testid="conversation-compose-box-input"]')),
        5000
      );
    } catch (e) {
      console.log('[sender] Main compose box not found, trying alternative selectors...');
      
      // Try alternative selectors for the message input
      const selectors = [
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        '[data-testid="compose-box-input"]'
      ];
      
      for (const selector of selectors) {
        try {
          messageBox = await readerDriver.wait(
            until.elementLocated(By.css(selector)),
            3000
          );
          console.log(`[sender] Found message box with selector: ${selector}`);
          break;
        } catch (selectorError) {
          continue;
        }
      }
      
      if (!messageBox) {
        throw new Error('Could not find message input box. Make sure you are in a WhatsApp conversation.');
      }
    }
    
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
      
      // Wait for conversation to load
      await readerDriver.sleep(1000);
      return true;
      
    } catch (contactError) {
      console.warn('[sender] Could not find existing contact');
      // Clear search box if contact not found
      await searchBox.clear();
      return false;
    }
    
  } catch (error) {
    console.error('[sender] Error searching for contact:', error);
    return false;
  }
}

async function startNewConversation(phoneNumber) {
  try {
    console.log('[sender] Starting new conversation with:', phoneNumber);
    
    // Try to find the "New chat" button
    const newChatSelectors = [
      '[data-testid="new-chat-btn"]',
      '[title="New chat"]',
      'div[role="button"][title="New chat"]'
    ];
    
    let newChatBtn = null;
    for (const selector of newChatSelectors) {
      try {
        newChatBtn = await readerDriver.wait(
          until.elementLocated(By.css(selector)),
          3000
        );
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (newChatBtn) {
      await newChatBtn.click();
      console.log('[sender] Clicked new chat button');
      
      // Wait for new chat dialog and search for the phone number
      await readerDriver.sleep(1000);
      
      const searchInput = await readerDriver.wait(
        until.elementLocated(By.css('input[type="text"]')),
        5000
      );
      
      await searchInput.sendKeys(phoneNumber);
      await readerDriver.sleep(2000);
      
      // Try to click on the contact or create new contact
      try {
        const contactResult = await readerDriver.wait(
          until.elementLocated(By.css('[data-testid="cell-frame-container"]')),
          5000
        );
        await contactResult.click();
        console.log('[sender] New conversation started');
        
        // Wait for conversation to load
        await readerDriver.sleep(1000);
        return true;
        
      } catch (e) {
        console.warn('[sender] Could not start new conversation');
        return false;
      }
    } else {
      console.warn('[sender] Could not find new chat button');
      return false;
    }
    
  } catch (error) {
    console.error('[sender] Error starting new conversation:', error);
    return false;
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
