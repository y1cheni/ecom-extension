// Listen for command shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_price_tracker") {
    openPriceTracker();
  }
});

// Add page load completion event listener, detect MOMO error pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check when page is fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    // Detect if it's a specified error page
    if (tab.url.startsWith('https://www.momoshop.com.tw/com/Notice.jsp?msg1=FA0064') ||
        tab.url.startsWith('https://www.momoshop.com.tw/ecm/js/err404/EC404.html')) {
      console.log(`Detected MOMO error page, auto-closing: ${tab.url}`);
      // Close the page
      chrome.tabs.remove(tabId);
      return;
    }
    
    // Detect if it's a Shopee product page
    const isShopeeProduct = 
      (tab.url && tab.url.match(/shopee\.tw\/.+\.\d+\.\d+/i)) || // Traditional format product-i.xxx.yyy
      (tab.url && tab.url.match(/shopee\.tw\/product\/\d+\/\d+/i)); // New format product/xxx/yyy
    
    if (isShopeeProduct) {
      // Check if the Shopee product is in database and data is incomplete
      chrome.storage.local.get(['shopeeData'], function(result) {
        const shopeeData = result.shopeeData || {};
        const productData = shopeeData[tab.url];
        
        // If data doesn't exist or price/name is missing, auto-execute track function
        if (!productData || 
            !productData.price || 
            productData.price === 'Price not found' || 
            !productData.name || 
            productData.name === 'Unknown Product') {
          
          console.log(`Shopee product data incomplete, auto-executing track function: ${tab.url}`);
          
          // Wait for page to fully load
          setTimeout(() => {
            // Send message to extract product info
            chrome.tabs.sendMessage(
              tabId,
              { action: "extractShopeeProductInfo" },
              function(response) {
                console.log(`Auto-track Shopee product response:`, response);
              }
            );
          }, 3000); // Give page 3 seconds to load
        }
      });
    }
  }
});

// Open price tracker page
function openPriceTracker() {
  // Check if price tracker window is already open
  chrome.tabs.query({url: chrome.runtime.getURL("tracker.html")}, (tabs) => {
    if (tabs.length > 0) {
      // If already open, activate that tab
      chrome.tabs.update(tabs[0].id, {active: true});
    } else {
      // If not open, create a new tab
      chrome.tabs.create({url: chrome.runtime.getURL("tracker.html")});
    }
  });
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle request to open price tracker
  if (request.action === "openPriceTracker") {
    openPriceTracker();
    sendResponse({success: true});
  }
  
  // Handle product data updates from MOMO content script
  else if (request.action === "productDataUpdated") {
    // Get product data
    const productData = request.data;
    
    // Send notification to all open price tracker pages
    chrome.tabs.query({url: chrome.runtime.getURL("tracker.html")}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateProductData",
          data: productData
        });
      });
    });
    
    // Return response
    sendResponse({success: true});
  }
  
  // Handle request to close current tab
  else if (request.action === "closeCurrentTab") {
    if (sender.tab) {
      console.log(`Closing tab ${sender.tab.id} after price was found or error page detected`);
      chrome.tabs.remove(sender.tab.id);
    }
    sendResponse({success: true});
  }
  
  // Handle Shopee product info saving
  else if (request.action === "saveShopeeProductInfo") {
    saveShopeeProductInfo(request.data, sender);
    sendResponse({status: "success"});
  }
  
  // Return true for async response
  return true;
});

// Save Shopee product info to storage
function saveShopeeProductInfo(productData, sender) {
  console.log("Saving Shopee product information:", productData);
  
  // Get existing data and update it
  chrome.storage.local.get(['shopeeData'], function(result) {
    const data = result.shopeeData || {};
    
    // Add the new product data, using URL as key
    data[productData.url] = {
      id: productData.id,
      name: productData.name,
      price: productData.price,
      timestamp: Date.now()
    };
    
    // Save back to storage
    chrome.storage.local.set({ shopeeData: data }, function() {
      if (chrome.runtime.lastError) {
        console.error("Error saving Shopee product data:", chrome.runtime.lastError);
      } else {
        console.log("Shopee product data saved successfully:", data);
        
        // Notify the tracker page to update data
        chrome.tabs.query({url: chrome.runtime.getURL("tracker.html")}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: "shopeeDataUpdated"
            });
          });
        });
        
        // If data is complete (has price and product name), auto-close tab
        if (sender && sender.tab && 
            productData.price && productData.price !== 'Price not found' && 
            productData.name && productData.name !== 'Unknown Product') {
          console.log(`Shopee data complete, auto-closing tab: ${productData.url}`);
          setTimeout(() => {
            chrome.tabs.remove(sender.tab.id);
          }, 500);
        }
      }
    });
  });
}

// Code to execute on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Price Tracker installed");
  
  // Initialize storage
  chrome.storage.local.get(['productData', 'shopeeData'], function(result) {
    if (!result.productData) {
      chrome.storage.local.set({ productData: {} });
    }
    if (!result.shopeeData) {
      chrome.storage.local.set({ shopeeData: {} });
    }
  });
}); 