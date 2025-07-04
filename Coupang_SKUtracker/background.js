// Background script for Coupang SKU Counter Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'closeCurrentTab') {
    // Close the current tab
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id, () => {
        if (chrome.runtime.lastError) {
          console.log('Error closing tab:', chrome.runtime.lastError.message);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          console.log('Tab closed successfully');
          sendResponse({success: true});
        }
      });
    } else {
      sendResponse({success: false, error: 'No tab ID available'});
    }
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'openNewTabAndCloseCurrent') {
    // Open new tab and close current one
    const newUrl = request.url;
    
    if (sender.tab && sender.tab.id) {
      // Create new tab first
      chrome.tabs.create({ url: newUrl, active: true }, (newTab) => {
        if (chrome.runtime.lastError) {
          console.log('Error creating new tab:', chrome.runtime.lastError.message);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
        } else {
          // Close current tab after new one is created
          chrome.tabs.remove(sender.tab.id, () => {
            if (chrome.runtime.lastError) {
              console.log('Error closing current tab:', chrome.runtime.lastError.message);
            } else {
              console.log('Successfully opened new tab and closed current tab');
            }
            sendResponse({success: true, newTabId: newTab.id});
          });
        }
      });
    } else {
      sendResponse({success: false, error: 'No current tab ID available'});
    }
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'brandProcessingComplete') {
    // Handle brand completion and move to next URL
    console.log('[Coupang Background] Brand processing complete:', request.brand, 'SKUs:', request.totalSkuCount);
    
    chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_batch_current_index'], function(result) {
      if (!result.coupang_batch_processing) {
        console.log('[Coupang Background] Batch processing not active, ignoring completion signal');
        return;
      }

      const batchUrls = result.coupang_batch_urls || [];
      const currentIndex = result.coupang_batch_current_index || 0;
      
      // Find next valid URL (not "0")
      let nextIndex = currentIndex + 1;
      let nextUrl = null;
      
      while (nextIndex < batchUrls.length) {
        if (batchUrls[nextIndex] !== '0') {
          nextUrl = batchUrls[nextIndex];
          break;
        }
        nextIndex++;
      }
      
      if (nextUrl) {
        console.log('[Coupang Background] Moving to next URL:', nextUrl, 'at index:', nextIndex);
        
        // Update current index
        chrome.storage.local.set({
          coupang_batch_current_index: nextIndex,
          coupang_batch_current_url: nextUrl
        }, function() {
          // Close current tab and open next URL
          if (sender.tab && sender.tab.id) {
            chrome.tabs.create({ url: nextUrl, active: true }, (newTab) => {
              chrome.tabs.remove(sender.tab.id);
              
              // Start processing on new tab after delay
              setTimeout(() => {
                chrome.tabs.sendMessage(newTab.id, { 
                  action: 'startProcessing',
                  urlPosition: nextIndex
                }, function(response) {
                  if (chrome.runtime.lastError) {
                    console.log('[Coupang Background] Failed to start processing on new tab:', chrome.runtime.lastError);
                  } else {
                    console.log('[Coupang Background] Processing started on new tab:', response);
                  }
                });
              }, 4000);
            });
          }
        });
      } else {
        console.log('[Coupang Background] All URLs processed, finishing batch processing');
        
        // Stop batch processing
        chrome.storage.local.remove([
          'coupang_batch_processing',
          'coupang_batch_urls', 
          'coupang_batch_current_index',
          'coupang_batch_current_url'
        ], function() {
          console.log('[Coupang Background] Batch processing completed');
          
          // Close current tab
          if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
          }
        });
      }
    });
    
    sendResponse({success: true});
    return true;
  }
}); 