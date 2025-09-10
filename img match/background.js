// Background service worker for Image Matcher Pro

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openWindow') {
    openMatcherWindow();
    sendResponse({ success: true });
  }
});

chrome.action.onClicked.addListener((tab) => {
  // Open the standalone window when extension icon is clicked
  openMatcherWindow();
});

async function openMatcherWindow() {
  try {
    // Check if window already exists
    const existingWindows = await chrome.windows.getAll({ 
      populate: true, 
      windowTypes: ['popup'] 
    });
    
    const existingWindow = existingWindows.find(window => 
      window.tabs && window.tabs.some(tab => 
        tab.url && tab.url.includes('matcher_window.html')
      )
    );
    
    if (existingWindow) {
      // Focus existing window
      await chrome.windows.update(existingWindow.id, { focused: true });
      return;
    }
    
    // Create new window
    const window = await chrome.windows.create({
      url: 'matcher_window.html',
      type: 'popup',
      width: 1200,
      height: 800,
      left: 100,
      top: 100
    });
    
    console.log('Image Matcher window created:', window.id);
  } catch (error) {
    console.error('Failed to open Image Matcher window:', error);
  }
}

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Image Matcher Pro installed:', details.reason);
});
