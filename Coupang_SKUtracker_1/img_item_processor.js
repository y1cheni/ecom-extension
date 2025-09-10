// == IMG Item Processor - Extract Product Images and Names ==
(function() {
  console.log('[IMG Item Processor] Starting execution, current URL:', location.href);
  
  // Check if this is a search page
  const isSearchPage = location.href.includes('www.tw.coupang.com/search') || 
                      location.href.includes('www.tw.coupang.com/np/search') ||
                      location.href.includes('https://www.tw.coupang.com/categories/');
  
  if (!isSearchPage) {
    console.log('[IMG Item Processor] Not a search page, skipping');
    return;
  }

  // Global variables
  let isProcessing = false;
  let currentPage = 1;
  let urlPosition = 0;
  let processedImages = [];
  let lastFirstProduct = null;
  let duplicatePageDetected = false;
  let currentBrand = '';

  // Extract page number from URL
  function extractPageFromUrl() {
    try {
      const url = new URL(location.href);
      const page = url.searchParams.get('page');
      return page ? parseInt(page) : 1;
    } catch (e) {
      console.error('[IMG Item Processor] Error extracting page from URL:', e);
      return 1;
    }
  }

  // Extract brand from URL - Get string from q parameter
  function extractBrandFromUrl() {
    try {
      const url = new URL(location.href);
      const query = url.searchParams.get('q');
      if (query) {
        // Decode and clean the brand name
        const brand = decodeURIComponent(query).replace(/\+/g, ' ').trim();
        console.log('[IMG Item Processor] Brand extracted from URL:', brand);
        return brand;
      }
    } catch (e) {
      console.error('[IMG Item Processor] Error extracting brand from URL:', e);
    }
    return 'Unknown';
  }

  // Get first product identifier for duplicate detection
  function getFirstProductIdentifier() {
    try {
      const imgSelectors = [
        'ul li a figure img',
        '.product-item img',
        '.search-product img',
        '[class*="product"] img',
        'ul li img'
      ];

      for (const selector of imgSelectors) {
        const element = document.querySelector(selector);
        if (element && element.src) {
          const identifier = element.src + '|' + (element.alt || '');
          console.log('[IMG Item Processor] First product identifier:', identifier);
          return identifier;
        }
      }
      
      return 'no-product-found';
    } catch (e) {
      console.error('[IMG Item Processor] Error getting first product identifier:', e);
      return 'error-getting-identifier';
    }
  }

  // Check if product has stock using the same logic as original SKU counter
  function hasStock(productElement) {
    try {
      // Use the same delivery text logic as original system
      const deliveryTexts = ['預計送達', '예상 배송', '배송 예정', '預計配送', '預計到貨'];
      const elementText = productElement.textContent || productElement.innerText || '';
      
      // Check if this product has delivery text (indicates it's in stock and available)
      for (const deliveryText of deliveryTexts) {
        if (elementText.includes(deliveryText)) {
          console.log(`[IMG Item Processor] Product has stock (found: ${deliveryText})`);
          return true;
        }
      }
      
      // If no delivery text found, consider it as out of stock
      return false;
    } catch (e) {
      console.error('[IMG Item Processor] Error checking stock:', e);
      return false; // Default to no stock if error for safety
    }
  }

  // Extract product images from current page
  function extractProductImages() {
    console.log('[IMG Item Processor] Extracting product images from page:', currentPage);
    
    const productItems = [];
    
    // Look for product containers - try multiple selectors
    const containerSelectors = [
      'ul li a', // Main product links
      '[class*="product"] a',
      '.search-product a'
    ];

    let foundContainers = [];
    for (const selector of containerSelectors) {
      const containers = document.querySelectorAll(selector);
      if (containers.length > 0) {
        foundContainers = Array.from(containers);
        console.log(`[IMG Item Processor] Found ${foundContainers.length} product containers with selector:`, selector);
        break;
      }
    }

    if (foundContainers.length === 0) {
      console.log('[IMG Item Processor] No product containers found on this page');
      return [];
    }

    foundContainers.forEach((productLink, index) => {
      try {
        // Check if this product has stock
        if (hasStock(productLink)) {
          // Find the img element within this product link
          const img = productLink.querySelector('img');
          if (img && img.src && !img.src.includes('data:image')) {
            const productName = img.alt || `Product ${index + 1}`;
            const imageUrl = img.src;
            
            // Get the product URL from href
            let itemUrl = '';
            if (productLink.href) {
              // Convert relative URL to absolute URL
              try {
                const url = new URL(productLink.href, window.location.origin);
                itemUrl = url.toString();
              } catch (e) {
                console.warn('[IMG Item Processor] Error processing product URL:', e);
                itemUrl = productLink.href; // fallback to original href
              }
            }
            
            productItems.push({
              brand: currentBrand,
              name: productName.trim(),
              imageUrl: imageUrl,
              itemUrl: itemUrl,
              page: currentPage
            });
            
            console.log(`[IMG Item Processor] Added product: ${productName} - ${imageUrl} - ${itemUrl}`);
          }
        } else {
          console.log(`[IMG Item Processor] Skipped out-of-stock product`);
        }
      } catch (e) {
        console.error('[IMG Item Processor] Error processing product:', e);
      }
    });

    console.log(`[IMG Item Processor] Extracted ${productItems.length} in-stock products from page ${currentPage}`);
    return productItems;
  }



  // Go to next page using URL manipulation (same as original SKU counter)
  function goToNextPage() {
    try {
      const currentUrl = new URL(location.href);
      let nextPage = currentPage + 1;
      
      // Update page parameter
      currentUrl.searchParams.set('page', nextPage.toString());
      const nextPageUrl = currentUrl.toString();
      
      console.log('[IMG Item Processor] Going to next page:', nextPageUrl);
      
      // Navigate to next page
      isProcessing = false; // Reset processing flag before navigation
      window.location.href = nextPageUrl;
      
      return true;
    } catch (e) {
      console.error('[IMG Item Processor] Error going to next page:', e);
      completeProcessing();
      return false;
    }
  }

  // Save processed images to storage
  function saveProcessedImages(items) {
    chrome.storage.local.get(['coupang_img_item_data'], function(result) {
      const existingData = result.coupang_img_item_data || [];
      
      // Add new items with metadata
      const newItems = items.map(item => ({
        brand: item.brand,
        name: item.name,
        imageUrl: item.imageUrl,
        itemUrl: item.itemUrl,
        page: item.page,
        timestamp: Date.now(),
        urlPosition: urlPosition,
        url: location.href
      }));
      
      const updatedData = existingData.concat(newItems);
      
      chrome.storage.local.set({ 'coupang_img_item_data': updatedData }, function() {
        console.log(`[IMG Item Processor] Saved ${newItems.length} items to storage. Total: ${updatedData.length}`);
      });
    });
  }

  // Process current page
  function processCurrentPage() {
    if (isProcessing) {
      console.log('[IMG Item Processor] Already processing, skipping');
      return;
    }

    isProcessing = true;
    currentPage = extractPageFromUrl();
    currentBrand = extractBrandFromUrl();
    
    console.log(`[IMG Item Processor] Processing page ${currentPage} for brand: ${currentBrand}`);

    // Wait for page to load completely
    setTimeout(() => {
      // Check for duplicate page
      const currentFirstProduct = getFirstProductIdentifier();
      if (lastFirstProduct && currentFirstProduct === lastFirstProduct) {
        duplicatePageDetected = true;
        console.log('[IMG Item Processor] Duplicate page detected, stopping processing');
        completeProcessing();
        return;
      }
      lastFirstProduct = currentFirstProduct;

      // Extract images from current page
      const pageImages = extractProductImages();
      
      if (pageImages.length > 0) {
        // Found in-stock products, save them and go to next page
        console.log(`[IMG Item Processor] Found ${pageImages.length} in-stock products`);
        processedImages = processedImages.concat(pageImages);
        saveProcessedImages(pageImages);
        
        // Check if we've reached the maximum page limit (page 13)
        if (currentPage >= 13) {
          console.log('[IMG Item Processor] Reached maximum page limit (13), completing processing');
          completeProcessing();
        } else {
          // Continue to next page
          setTimeout(() => {
            goToNextPage();
            // After navigation, processCurrentPage will be called automatically by initialization
          }, 1000);
        }
      } else {
        // No in-stock products found - use same logic as original SKU counter
        console.log('[IMG Item Processor] No in-stock products found on this page, completing processing');
        completeProcessing();
      }
    }, 2000);
  }

  // Complete processing and move to next URL if in batch mode
  function completeProcessing() {
    isProcessing = false;
    console.log(`[IMG Item Processor] Completed processing. Total images collected: ${processedImages.length}`);

    // Mark this URL as completed
    chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_batch_current_index'], 
      function(result) {
        const isBatchProcessing = result.coupang_batch_processing || false;
        const batchUrls = result.coupang_batch_urls || [];
        const currentIndex = result.coupang_batch_current_index || 0;

        if (isBatchProcessing && batchUrls.length > 0) {
          const nextIndex = currentIndex + 1;
          
          if (nextIndex < batchUrls.length) {
            // Move to next URL
            const nextUrl = batchUrls[nextIndex];
            console.log(`[IMG Item Processor] Moving to next URL: ${nextUrl}`);
            
            chrome.storage.local.set({
              'coupang_batch_current_index': nextIndex,
              'coupang_batch_current_url': nextUrl
            }, function() {
              // Navigate to next URL
              if (nextUrl !== '0') {
                location.href = nextUrl;
              } else {
                // Skip "0" placeholder and move to next
                setTimeout(() => completeProcessing(), 100);
              }
            });
          } else {
            // All URLs processed
            console.log('[IMG Item Processor] All URLs processed, stopping batch processing');
            chrome.storage.local.remove([
              'coupang_batch_processing',
              'coupang_batch_urls',
              'coupang_batch_current_index',
              'coupang_batch_current_url'
            ], function() {
              window.close();
            });
          }
        } else {
          // Single URL processing completed
          console.log('[IMG Item Processor] Single URL processing completed');
          window.close();
        }
      });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startImgItemProcessing') {
      // Check if we're in IMG Item mode
      chrome.storage.local.get(['coupang_img_item_mode'], function(result) {
        const isImgItemMode = result.coupang_img_item_mode || false;
        
        if (!isImgItemMode) {
          console.log('[IMG Item Processor] Not in IMG Item mode, ignoring processing request');
          sendResponse({success: false, reason: 'Not in IMG Item mode'});
          return;
        }
        
        urlPosition = request.urlPosition || 0;
        console.log('[IMG Item Processor] Starting IMG item processing for position:', urlPosition);
        processCurrentPage();
        sendResponse({success: true});
      });
      return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'getImgItemPageInfo') {
      sendResponse({
        page: currentPage,
        url: location.href,
        isSearchPage: isSearchPage,
        processedCount: processedImages.length
      });
    }
  });

  // Check if we're in IMG Item mode and should start automatically
  chrome.storage.local.get(['coupang_img_item_mode', 'coupang_batch_processing'], function(result) {
    const isImgItemMode = result.coupang_img_item_mode || false;
    const isBatchProcessing = result.coupang_batch_processing || false;
    
    if (!isImgItemMode) {
      console.log('[IMG Item Processor] Not in IMG Item mode, processor will remain inactive');
      return;
    }
    
    if (isImgItemMode && isBatchProcessing) {
      console.log('[IMG Item Processor] Auto-starting IMG item processing');
      setTimeout(() => {
        processCurrentPage();
      }, 1000);
    } else {
      console.log('[IMG Item Processor] IMG Item mode active but no batch processing detected');
    }
  });

})();