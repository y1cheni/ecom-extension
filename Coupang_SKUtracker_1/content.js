// == Coupang Search Page SKU Counter ==
(function() {
  console.log('[Coupang SKU Counter] Starting execution, current URL:', location.href);
  
  // Check if this is a search page
  const isSearchPage = location.href.includes('www.tw.coupang.com/search') || 
                      location.href.includes('www.tw.coupang.com/np/search') ||
                      location.href.includes('https://www.tw.coupang.com/categories/')
  
  if (!isSearchPage) {
    console.log('[Coupang SKU Counter] Not a search page, skipping');
    return;
  }

  // Global variables
  let isProcessing = false;
  let currentBrand = '';
  let currentL2Category = '';
  let currentPage = 1;
  let totalSkuCount = 0;
  let urlPosition = 0;
  let lastFirstProduct = null;
  let duplicatePageDetected = false;

  // Check if URL is categories type
  function isCategoriesUrl() {
    return location.href.includes('https://www.tw.coupang.com/categories/');
  }

  // Extract L2 category from categories URL
  function extractL2CategoryFromUrl() {
    try {
      if (!isCategoriesUrl()) {
        return '';
      }
      
      const url = location.href;
      const categoriesIndex = url.indexOf('categories/');
      const listSizeIndex = url.indexOf('listSize=');
      
      if (categoriesIndex !== -1 && listSizeIndex !== -1) {
        const startIndex = categoriesIndex + 'categories/'.length;
        const l2Category = url.substring(startIndex, listSizeIndex);
        console.log('[Coupang SKU Counter] L2 category extracted from URL:', l2Category);
        return l2Category;
      }
    } catch (e) {
      console.error('[Coupang SKU Counter] Error extracting L2 category from URL:', e);
    }
    return '';
  }

  // Extract brand from URL - Get string between "&q=" and "&page="
  function extractBrandFromUrl() {
    try {
      const url = new URL(location.href);
      const query = url.searchParams.get('q');
      if (query) {
        // Decode and clean the brand name
        const brand = decodeURIComponent(query).replace(/\+/g, ' ').trim();
        console.log('[Coupang SKU Counter] Brand extracted from URL:', brand);
        return brand;
      }
    } catch (e) {
      console.error('[Coupang SKU Counter] Error extracting brand from URL:', e);
    }
    return 'Unknown';
  }

  // Extract page number from URL
  function extractPageFromUrl() {
    try {
      const url = new URL(location.href);
      const page = url.searchParams.get('page');
      return page ? parseInt(page) : 1;
    } catch (e) {
      console.error('[Coupang SKU Counter] Error extracting page from URL:', e);
      return 1;
    }
  }

  // Get first product identifier for duplicate detection
  function getFirstProductIdentifier() {
    try {
      // Look for various product identifier patterns
      const selectors = [
        '[data-product-id]',
        '[data-item-id]', 
        '[data-vendor-item-id]',
        'a[href*="vendorItemId"]',
        'a[href*="itemId"]',
        '.product-item',
        '.search-product',
        '[class*="product"]'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Try to get product ID from data attributes
          const productId = element.getAttribute('data-product-id') ||
                           element.getAttribute('data-item-id') ||
                           element.getAttribute('data-vendor-item-id');
          
          if (productId) {
            console.log('[Coupang SKU Counter] First product ID found:', productId);
            return productId;
          }

          // Try to extract from href
          if (element.href) {
            const match = element.href.match(/(?:vendorItemId|itemId)=(\d+)/);
            if (match) {
              console.log('[Coupang SKU Counter] First product ID from href:', match[1]);
              return match[1];
            }
          }

          // Use element text content as fallback
          const text = element.textContent?.trim().substring(0, 100);
          if (text) {
            console.log('[Coupang SKU Counter] First product text identifier:', text);
            return text;
          }
        }
      }

      // Fallback: get first link href
      const firstLink = document.querySelector('a[href*="products"]');
      if (firstLink && firstLink.href) {
        console.log('[Coupang SKU Counter] First product link:', firstLink.href);
        return firstLink.href;
      }

      console.log('[Coupang SKU Counter] No product identifier found');
      return null;
    } catch (e) {
      console.error('[Coupang SKU Counter] Error getting first product identifier:', e);
      return null;
    }
  }

  // Count delivery text occurrences on current page - Similar to ctrl+F search function
  function countDeliveryItems() {
    try {
      const deliveryTexts = ['預計送達', '예상 배송', '배송 예정', '預計配送', '預計到貨'];
      let count = 0;

      // Search for delivery text in all elements using XPath (similar to ctrl+F)
      for (const deliveryText of deliveryTexts) {
        const elements = document.evaluate(
          `//*[contains(text(), '${deliveryText}')]`,
          document,
          null,
          XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
          null
        );

        count += elements.snapshotLength;
        
        if (elements.snapshotLength > 0) {
          console.log(`[Coupang SKU Counter] Found ${elements.snapshotLength} items with "${deliveryText}"`);
        }
      }

      // Also try CSS-based search as backup
      if (count === 0) {
        const selectors = [
          '[class*="delivery"]',
          '[class*="shipping"]',
          '[class*="배송"]'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent;
            for (const deliveryText of deliveryTexts) {
              if (text.includes(deliveryText)) {
                count++;
                break;
              }
            }
          }
        }
      }

      console.log(`[Coupang SKU Counter] Total delivery items found on page ${currentPage}: ${count}`);
      return count;
    } catch (e) {
      console.error('[Coupang SKU Counter] Error counting delivery items:', e);
      return 0;
    }
  }

  // Check if this is a duplicate page
  function checkDuplicatePage() {
    const currentFirstProduct = getFirstProductIdentifier();
    
    if (lastFirstProduct && currentFirstProduct && 
        lastFirstProduct === currentFirstProduct && currentPage > 1) {
      console.log('[Coupang SKU Counter] Duplicate page detected! Same first product:', currentFirstProduct);
      duplicatePageDetected = true;
      return true;
    }

    lastFirstProduct = currentFirstProduct;
    return false;
  }

  // Save current progress to storage
  function saveProgress(skuCount, isCompleted = false, isNoData = false) {
    const data = {
      brand: currentBrand,
      l2Category: currentL2Category,
      page: currentPage,
      skuCount: skuCount,
      urlPosition: urlPosition,
      timestamp: Date.now(),
      isCompleted: isCompleted,
      isNoData: isNoData,
      url: location.href
    };

    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      let allData = result.coupang_delivery_data || [];
      allData.push(data);
      
      chrome.storage.local.set({ coupang_delivery_data: allData }, function() {
        console.log('[Coupang SKU Counter] Progress saved:', data);
      });
    });
  }

  // Get next page URL
  function getNextPageUrl() {
    try {
      const url = new URL(location.href);
      const nextPage = currentPage + 1;
      url.searchParams.set('page', nextPage.toString());
      return url.toString();
    } catch (e) {
      console.error('[Coupang SKU Counter] Error generating next page URL:', e);
      return null;
    }
  }

  // Main processing function
  async function processCurrentPage() {
    if (isProcessing) return;
    
    isProcessing = true;
    currentBrand = extractBrandFromUrl();
    currentL2Category = extractL2CategoryFromUrl();
    currentPage = extractPageFromUrl();
    
    console.log(`[Coupang SKU Counter] Processing page ${currentPage} for brand: ${currentBrand}, L2 category: ${currentL2Category}`);
    
    // Check for duplicate pages
    if (checkDuplicatePage()) {
      console.log('[Coupang SKU Counter] Duplicate page detected, finishing processing');
      finishBrandProcessing();
      return;
    }
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Count delivery items
    const deliveryCount = countDeliveryItems();
    totalSkuCount += deliveryCount;
    
    if (deliveryCount === 0) {
      console.log('[Coupang SKU Counter] No delivery items found, marking as completed');
      saveProgress(0, true, false);
      finishBrandProcessing();
    } else {
      console.log(`[Coupang SKU Counter] Found ${deliveryCount} delivery items`);
      saveProgress(deliveryCount, false, false);
      
      // Go to next page
      setTimeout(() => {
        goToNextPage();
      }, 1000);
    }
  }

  // Go to next page
  function goToNextPage() {
    const nextPageUrl = getNextPageUrl();
    if (nextPageUrl) {
      currentPage++;
      console.log('[Coupang SKU Counter] Going to next page:', nextPageUrl);
      window.location.href = nextPageUrl;
    } else {
      console.log('[Coupang SKU Counter] Cannot generate next page URL, finishing');
      finishBrandProcessing();
    }
  }

  // Finish processing current brand
  function finishBrandProcessing() {
    console.log(`[Coupang SKU Counter] Finished processing brand: ${currentBrand}, Total SKUs: ${totalSkuCount}`);
    
    // Notify background script that this brand is complete
    chrome.runtime.sendMessage({
      action: 'brandProcessingComplete',
      brand: currentBrand,
      totalSkuCount: totalSkuCount,
      urlPosition: urlPosition
    });
  }

  // Show notification
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    let backgroundColor;
    switch(type) {
      case 'error':
        backgroundColor = '#f44336';
        break;
      case 'info':
        backgroundColor = '#2196F3';
        break;
      default:
        backgroundColor = '#4CAF50';
    }
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startProcessing') {
      // Check if we're in IMG Item mode
      chrome.storage.local.get(['coupang_img_item_mode'], function(result) {
        const isImgItemMode = result.coupang_img_item_mode || false;
        
        if (isImgItemMode) {
          console.log('[Coupang SKU Counter] IMG Item mode detected, ignoring SKU processing request');
          sendResponse({success: false, reason: 'IMG Item mode active'});
          return;
        }
        
        urlPosition = request.urlPosition || 0;
        console.log('[Coupang SKU Counter] Starting processing for position:', urlPosition);
        processCurrentPage();
        sendResponse({success: true});
      });
      return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'getPageInfo') {
      sendResponse({
        brand: currentBrand,
        page: currentPage,
        url: location.href,
        isSearchPage: isSearchPage
      });
    }
  });

  // Initialize processing
  function initialize() {
    console.log('[Coupang SKU Counter] Initializing...');
    
    // Check if we're in IMG Item mode first
    chrome.storage.local.get(['coupang_img_item_mode', 'coupang_batch_current_index'], function(result) {
      const isImgItemMode = result.coupang_img_item_mode || false;
      
      if (isImgItemMode) {
        console.log('[Coupang SKU Counter] IMG Item mode detected, SKU counter will not start automatically');
        return;
      }
      
      urlPosition = result.coupang_batch_current_index || 0;
      console.log(`[Coupang SKU Counter] URL position: ${urlPosition}`);
      
      // Start processing after a short delay
      setTimeout(() => {
        processCurrentPage();
      }, 1000);
    });
  }

  // Start initialization
  initialize();
})(); 