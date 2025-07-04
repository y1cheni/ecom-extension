// == Coupang Search Page Automation ==
(function() {
  console.log('[Coupang Automation] Starting execution, current URL:', location.href);
  
  // IMMEDIATE CHECK: If this is a zero URL, handle it right away before any other processing
  const currentUrl = location.href;
  const immediateZeroCheck = currentUrl.includes('www.tw.coupang.com/0') ||
                             currentUrl.includes('/0') ||
                             currentUrl.includes('q=0') ||
                             currentUrl === 'https://www.tw.coupang.com/0';
  
  if (immediateZeroCheck) {
    console.log('[Coupang Automation] IMMEDIATE ZERO URL DETECTION:', currentUrl);
    
    // Create immediate visual indicator
    const immediateAlert = document.createElement('div');
    immediateAlert.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 24px;
      font-weight: bold;
    `;
    immediateAlert.textContent = 'ZERO URL DETECTED - CLOSING...';
    document.body.appendChild(immediateAlert);
    
         // Handle immediately
    setTimeout(() => {
      // Check if we're in batch processing
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['coupang_batch_processing'], function(result) {
          const isBatchProcessing = result.coupang_batch_processing || false;
          
          if (isBatchProcessing) {
            console.log('[Coupang Automation] In batch mode, handling zero page and moving to next URL');
            handleZeroPageImmediately();
          } else {
            console.log('[Coupang Automation] Not in batch mode, closing immediately');
            setTimeout(() => {
              window.close();
            }, 500);
          }
        });
      } else {
        // Fallback if chrome API not available
        console.log('[Coupang Automation] Chrome API not available, closing window');
        setTimeout(() => {
          window.close();
        }, 500);
      }
    }, 500);
  }
  
  // Process search pages and "0" placeholder pages
  const isSearchPage = location.href.includes('www.tw.coupang.com/search') || location.href.includes('https://www.tw.coupang.com/categories/');
  const isZeroPage = location.href.includes('www.tw.coupang.com/0') || 
                     location.href.includes('/0') ||
                     location.href.includes('q=0') ||
                     location.href === 'https://www.tw.coupang.com/0';
  
  if (!isSearchPage && !isZeroPage) {
    console.log('[Coupang Automation] Not a search page or zero page, skipping. URL:', location.href);
    return;
  }
  
  // If this is a zero page, handle it immediately
  if (isZeroPage) {
    console.log('[Coupang Automation] Detected zero page immediately on load:', location.href);
    
    // Create a simple status display for zero pages
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #f44336;
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
    `;
    statusDiv.textContent = 'Detected placeholder URL (0), closing...';
    document.body.appendChild(statusDiv);
    
    // Handle the zero page immediately
    setTimeout(() => {
      handleZeroPageImmediately();
    }, 100);
    return;
  }

  // Handle zero page immediately when detected
  function handleZeroPageImmediately() {
    console.log('[Coupang Automation] Handling zero page immediately');
    
    // Record placeholder data
    const placeholderData = {
      brand: '0',
      skuCount: 0,
      timestamp: Date.now(),
      page: 1,
      isCompleted: true
    };
    
    // Check if we're in batch processing mode
    chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_batch_current_index'], function(result) {
      const isBatchProcessing = result.coupang_batch_processing || false;
      const batchUrls = result.coupang_batch_urls || [];
      const currentIndex = result.coupang_batch_current_index || 0;
      
      console.log('[Coupang Automation] Batch processing status:', isBatchProcessing);
      console.log('[Coupang Automation] Current index:', currentIndex);
      
      if (isBatchProcessing) {
        // Save placeholder data and move to next URL
        chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
          const existingData = dataResult.coupang_delivery_data || [];
          
          // Check if placeholder already exists
          const existingPlaceholder = existingData.find(item => 
            item.brand === '0' && Math.abs(item.timestamp - placeholderData.timestamp) < 5000
          );
          
          if (!existingPlaceholder) {
            existingData.push(placeholderData);
            chrome.storage.local.set({ 'coupang_delivery_data': existingData }, function() {
              console.log('[Coupang Automation] Saved placeholder data for zero page');
              moveToNextBatchUrlFromZeroPage(batchUrls, currentIndex);
            });
          } else {
            console.log('[Coupang Automation] Placeholder already exists, moving to next URL');
            moveToNextBatchUrlFromZeroPage(batchUrls, currentIndex);
          }
        });
      } else {
        // Not in batch mode, just close the page
        console.log('[Coupang Automation] Not in batch mode, closing zero page');
        setTimeout(() => {
          // Try to use background script to close tab
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              action: 'closeCurrentTab'
            }, function(response) {
              if (chrome.runtime.lastError || !response || !response.success) {
                console.log('[Coupang Automation] Background close failed, using window.close()');
                window.close();
              }
            });
          } else {
            window.close();
          }
        }, 1000);
      }
    });
  }
  
  // Move to next batch URL from zero page
  function moveToNextBatchUrlFromZeroPage(batchUrls, currentIndex) {
    console.log('[Coupang Automation] Moving to next URL from zero page');
    
    // Find next valid URL
    let nextValidUrl = null;
    let nextValidIndex = currentIndex + 1;
    
    while (nextValidIndex < batchUrls.length) {
      const url = batchUrls[nextValidIndex];
      
      if (url === '0') {
        // Skip placeholders
        console.log('[Coupang Automation] Skipping placeholder at index:', nextValidIndex);
        nextValidIndex++;
        continue;
      } else {
        // Found valid URL
        nextValidUrl = url;
        break;
      }
    }
    
    if (nextValidUrl && nextValidIndex < batchUrls.length) {
      // Update storage and navigate to next URL
      chrome.storage.local.set({
        'coupang_batch_current_index': nextValidIndex,
        'coupang_batch_current_url': nextValidUrl
      }, function() {
        console.log('[Coupang Automation] Moving to next batch URL:', nextValidUrl);
        setTimeout(() => {
          // Use background script to handle tab management
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              action: 'openNewTabAndCloseCurrent',
              url: nextValidUrl
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.log('[Coupang Automation] Error with background script:', chrome.runtime.lastError.message);
                // Fallback to location change
                window.location.href = nextValidUrl;
              } else if (response && response.success) {
                console.log('[Coupang Automation] Successfully transitioned to new tab');
              } else {
                console.log('[Coupang Automation] Background script failed, using fallback');
                window.location.href = nextValidUrl;
              }
            });
          } else {
            // Fallback to location change
            window.location.href = nextValidUrl;
          }
        }, 1000);
      });
    } else {
      // All URLs processed
      console.log('[Coupang Automation] All batch URLs processed, cleaning up');
      chrome.storage.local.remove([
        'coupang_batch_processing',
        'coupang_batch_urls',
        'coupang_batch_current_index',
        'coupang_batch_current_url',
        'coupang_auto_collecting'
      ], function() {
        console.log('[Coupang Automation] Batch processing completed from zero page');
        setTimeout(() => {
          window.close();
        }, 1000);
      });
    }
  }

  let isProcessing = false;
  let processedProducts = new Set(); // Record processed products
  let currentProductIndex = 0;
  let productLinks = [];
  let currentPage = 1; // Current page
  let totalPagesProcessed = 0; // Pages processed
  let isAutoMode = false; // Auto mode (continue automatically after page jump)
  let deliveryData = []; // Store delivery data for each brand

  // Check if this is a page after automatic page jump
  function checkAutoResumeFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['coupang_auto_collecting'], function(result) {
        const autoCollecting = result.coupang_auto_collecting || false;
        console.log('[Coupang Automation] Check auto collecting state:', autoCollecting);
        resolve(autoCollecting);
      });
    });
  }

  // Set auto collecting state
  function setAutoCollectingState(state) {
    chrome.storage.local.set({ 'coupang_auto_collecting': state }, function() {
      console.log('[Coupang Automation] Set auto collecting state:', state);
    });
  }

  // Get auto collecting state
  function getAutoCollectingState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['coupang_auto_collecting'], function(result) {
        const autoCollecting = result.coupang_auto_collecting || false;
        console.log('[Coupang Automation] Get auto collecting state:', autoCollecting);
        resolve(autoCollecting);
      });
    });
  }

  // Extract brand name from URL
  function getBrandFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
      try {
        return decodeURIComponent(query).replace(/\+/g, ' ');
      } catch (e) {
        return query;
      }
    }
    return '';
  }

  // Count delivery items on current page
  function countDeliveryItems() {
    // Simple text search for delivery text - like Ctrl+F
    const pageText = document.body.innerText || document.body.textContent || '';
    
    console.log(`[Coupang Automation] Page text length: ${pageText.length} characters`);
    console.log(`[Coupang Automation] First 200 chars: ${pageText.substring(0, 200)}`);
    
    // Count occurrences of delivery text
    const matches = pageText.match(/預計送達/g);
    const deliveryCount = matches ? matches.length : 0;
    
    console.log(`[Coupang Automation] Found ${deliveryCount} occurrences of delivery text on current page`);
    
    // Additional debugging: check if page seems to be loading or complete
    console.log(`[Coupang Automation] Page ready state: ${document.readyState}`);
    console.log(`[Coupang Automation] Current URL: ${window.location.href}`);
    
    return deliveryCount;
  }

  // Get first product identifier for duplicate page detection
  function getFirstProductIdentifier() {
    // Try multiple selectors to find the first product
    const productSelectors = [
      '[class*="product"] [class*="title"]',
      '[class*="item"] [class*="title"]', 
      '[class*="product"] [class*="name"]',
      '[class*="item"] [class*="name"]',
      '[class*="product-title"]',
      '[class*="item-title"]',
      'a[href*="/products/"]',
      '[class*="search-product"] [class*="title"]'
    ];
    
    for (const selector of productSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const firstElement = elements[0];
        let identifier = '';
        
        // Try to get product title text
        identifier = firstElement.textContent?.trim();
        
        // If no text, try to get href
        if (!identifier && firstElement.href) {
          identifier = firstElement.href;
        }
        
        // If still no identifier, try parent element
        if (!identifier && firstElement.parentElement) {
          identifier = firstElement.parentElement.textContent?.trim();
        }
        
        if (identifier && identifier.length > 10) {
          console.log(`[Coupang Automation] First product identifier found:`, identifier.substring(0, 100));
          return identifier;
        }
      }
    }
    
    // Fallback: use first link with "/products/" in href
    const productLinks = document.querySelectorAll('a[href*="/products/"]');
    if (productLinks.length > 0) {
      const firstLink = productLinks[0];
      const identifier = firstLink.href;
      console.log(`[Coupang Automation] First product identifier (fallback):`, identifier);
      return identifier;
    }
    
    console.log(`[Coupang Automation] No first product identifier found`);
    return null;
  }

  // Legacy function - now handled directly in processDeliveryCounting
  // Kept for backward compatibility but not used
  function saveDeliveryData(skuCount) {
    console.log('[Coupang Automation] saveDeliveryData called but processing is now handled in processDeliveryCounting');
  }

  // Display control panel (DISABLED - user doesn't want floating window)
  function createControlPanel() {
    console.log('[Coupang Automation] createControlPanel called but disabled per user preference');
    return null; // Don't create the panel
  }

  // Update status display
  function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      console.log('[Coupang Automation] Status:', message);
    }
  }

  // Update count display
  function updateCounts(deliveryCount = 0) {
    const deliveryCountElement = document.getElementById('deliveryCount');
    const currentPageElement = document.getElementById('currentPage');
    const totalPagesElement = document.getElementById('totalPages');
    const brandElement = document.getElementById('currentBrand');
    
    if (deliveryCountElement) deliveryCountElement.textContent = deliveryCount;
    if (currentPageElement) currentPageElement.textContent = getCurrentPageFromUrl();
    if (totalPagesElement) totalPagesElement.textContent = totalPagesProcessed;
    if (brandElement) brandElement.textContent = getBrandFromUrl();
  }

  // Get current page number from URL
  function getCurrentPageFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('page') || '1';
  }

  // Jump to next page
  function goToNextPage() {
    const currentPageNum = parseInt(getCurrentPageFromUrl());
    const nextPage = currentPageNum + 1;
    
    // Update page parameter in URL
    const url = new URL(window.location.href);
    url.searchParams.set('page', nextPage.toString());
    
    updateStatus(`Jumping to page ${nextPage}...`);
    console.log(`[Coupang Automation] Jumping to page ${nextPage}:`, url.toString());
    
    // Set auto collecting state so next page knows to continue automatically
    setAutoCollectingState(true);
    
    // Jump to next page
    window.location.href = url.toString();
  }

  // Start delivery counting
  function startDeliveryCounting() {
    if (isProcessing) return;
    
    isProcessing = true;
    isAutoMode = true;
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    
    const brand = getBrandFromUrl();
    
    // Check if we're in batch processing mode - if so, don't clear data for other brands
    chrome.storage.local.get(['coupang_batch_processing'], function(batchResult) {
      const isBatchProcessing = batchResult.coupang_batch_processing || false;
      
      if (!isBatchProcessing) {
        // Only clear data if we're NOT in batch processing mode
        chrome.storage.local.get(['coupang_delivery_data'], function(result) {
          const existingData = result.coupang_delivery_data || [];
          const filteredData = existingData.filter(item => item.brand !== brand);
          chrome.storage.local.set({ 'coupang_delivery_data': filteredData }, function() {
            console.log(`[Coupang Automation] Cleared previous data for brand: ${brand}`);
          });
        });
      } else {
        console.log(`[Coupang Automation] In batch processing mode, preserving existing data for other brands`);
      }
      
      // Reset local data
      deliveryData = [];
      totalPagesProcessed = 0;
      
      // Set auto collecting state
      setAutoCollectingState(true);
      
      // IMPORTANT: Ensure we start from page 1
      const currentPageNum = getCurrentPageFromUrl();
      if (currentPageNum !== '1') {
        console.log(`[Coupang Automation] Current page is ${currentPageNum}, redirecting to page 1 to start from beginning`);
        const url = new URL(window.location.href);
        url.searchParams.set('page', '1');
        updateStatus('Redirecting to page 1 to start from beginning...');
        window.location.href = url.toString();
        return;
      }
      
      updateStatus('Starting delivery counting from page 1...');
      console.log(`[Coupang Automation] Starting delivery counting for brand "${brand}" from page 1`);
      
      // Start counting process
      processDeliveryCounting();
    });
  }

  // Check if page contains "Not Found" or error indicators
  function checkForNotFoundPage() {
    const pageText = document.body.innerText || document.body.textContent || '';
    const pageHtml = document.body.innerHTML || '';
    
    // First check if page has normal search content - if yes, it's NOT a not found page
    const hasSearchContent = document.querySelectorAll('[class*="product"], [class*="item"], [class*="search"]').length > 0;
    const hasNormalContent = pageText.length > 5000; // Normal pages usually have lots of content
    const hasDeliveryText = pageText.includes('預計送達');
    
    console.log(`[Coupang Automation] checkForNotFoundPage - hasSearchContent: ${hasSearchContent}, hasNormalContent: ${hasNormalContent}, hasDeliveryText: ${hasDeliveryText}, pageLength: ${pageText.length}`);
    
    // If page has normal content OR delivery text, don't treat as Not Found
    if (hasSearchContent || hasNormalContent || hasDeliveryText) {
      console.log('[Coupang Automation] Page has normal content, not a Not Found page');
      return false;
    }
    
    // Only check for Not Found indicators if page seems sparse
    const notFoundIndicators = [
      'Not Found',
      'not found',
      'NOT FOUND',
      '404',
      'Page Not Found',
      'Page not found',
      '找不到頁面',
      '頁面不存在',
      '沒有找到',
      'Error 404',
      'HTTP 404'
    ];
    
    const hasNotFound = notFoundIndicators.some(indicator => 
      pageText.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Additional check: page has very little content AND not found indicators
    const hasVeryLittleContent = pageText.length < 2000;
    
    console.log(`[Coupang Automation] Error indicator check - hasNotFound: ${hasNotFound}, hasVeryLittleContent: ${hasVeryLittleContent}`);
    
    if (hasNotFound && hasVeryLittleContent) {
      console.log('[Coupang Automation] Not Found page detected - sparse content with error indicators');
      console.log(`[Coupang Automation] Page content preview: ${pageText.substring(0, 500)}`);
      return true;
    }
    
    console.log('[Coupang Automation] Not a Not Found page');
    return false;
  }

  // Handle "Not Found" page
  function handleNotFoundPage() {
    console.log('[Coupang Automation] Handling Not Found page');
    
    const brand = getBrandFromUrl();
    
    // Show visual notification
    const notFoundAlert = document.createElement('div');
    notFoundAlert.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff9800;
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
      font-weight: bold;
    `;
    notFoundAlert.textContent = 'Not Found page detected! Closing and moving to next...';
    document.body.appendChild(notFoundAlert);
    
    // Check if we're in batch processing mode
    chrome.storage.local.get(['coupang_batch_processing'], function(result) {
      const isBatchProcessing = result.coupang_batch_processing || false;
      
      if (isBatchProcessing) {
        // Save error data to maintain order
        const errorData = {
          brand: brand,
          skuCount: 0,
          timestamp: Date.now(),
          page: parseInt(getCurrentPageFromUrl()),
          isCompleted: true,
          isError: true,
          errorReason: 'Not Found page'
        };
        
        chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
          const existingData = dataResult.coupang_delivery_data || [];
          existingData.push(errorData);
          chrome.storage.local.set({ 'coupang_delivery_data': existingData }, function() {
            console.log(`[Coupang Automation] Saved Not Found error data for brand: ${brand}`, errorData);
            
            // Move to next brand by processing the completion
            setTimeout(() => {
              console.log('[Coupang Automation] Triggering brand completion for Not Found page');
              handleBrandCompletion(brand);
            }, 1000);
          });
        });
      } else {
        // Not in batch mode, just close the page
        console.log('[Coupang Automation] Not in batch mode, closing Not Found page');
        setTimeout(() => {
          // Try to use background script to close tab
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
              action: 'closeCurrentTab'
            }, function(response) {
              if (chrome.runtime.lastError || !response || !response.success) {
                console.log('[Coupang Automation] Background close failed, using window.close()');
                window.close();
              }
            });
          } else {
            window.close();
          }
        }, 1000);
      }
    });
  }

  // Check if page is ready for processing
  function isPageReady() {
    // Check if main content is loaded
    const hasProducts = document.querySelectorAll('[class*="product"], [class*="item"], [data-testid*="product"]').length > 0;
    const hasContent = document.body.textContent.length > 1000; // Basic content check
    const isLoaded = document.readyState === 'complete';
    
    // Additional check: make sure we can actually find delivery text if it exists
    const pageText = document.body.innerText || document.body.textContent || '';
    const hasDeliveryText = pageText.includes('預計送達');
    
    console.log(`[Coupang Automation] isPageReady checks - hasProducts: ${hasProducts}, hasContent: ${hasContent}, isLoaded: ${isLoaded}, hasDeliveryText: ${hasDeliveryText}`);
    console.log(`[Coupang Automation] Page text length: ${pageText.length}`);
    
    // If page has delivery text, make sure it's fully rendered
    if (hasDeliveryText) {
      const ready = hasProducts && hasContent && isLoaded;
      console.log(`[Coupang Automation] Page has delivery text, ready: ${ready}`);
      return ready;
    }
    
    // If no delivery text, still need basic loading completion
    const ready = hasContent && isLoaded;
    console.log(`[Coupang Automation] Page has no delivery text, ready: ${ready}`);
    return ready;
  }

  // Wait for page ready with timeout
  function waitForPageReady(callback, maxWait = 3000) {
    const startTime = Date.now();
    
    function checkReady() {
      const elapsed = Date.now() - startTime;
      const pageReady = isPageReady();
      
      console.log(`[Coupang Automation] Check ready - elapsed: ${elapsed}ms, page ready: ${pageReady}, document state: ${document.readyState}`);
      
      if (pageReady) {
        console.log('[Coupang Automation] Page is ready, proceeding with callback');
        callback();
        return;
      }
      
      // Only check for Not Found after sufficient wait time AND if page still not ready
      if (elapsed > 2500 && document.readyState === 'complete') {
        console.log('[Coupang Automation] Checking for Not Found page after timeout...');
        if (checkForNotFoundPage()) {
          console.log('[Coupang Automation] Not Found page detected after timeout, handling as error');
          handleNotFoundPage();
          return;
        } else {
          console.log('[Coupang Automation] Not a Not Found page, continuing to wait...');
        }
      }
    
      if (Date.now() - startTime > maxWait) {
        console.log(`[Coupang Automation] Page ready timeout after ${maxWait}ms, this may indicate a page load issue`);
        
        // Check if this is a batch processing scenario
        chrome.storage.local.get(['coupang_batch_processing'], function(result) {
          const isBatchProcessing = result.coupang_batch_processing || false;
          
          if (isBatchProcessing) {
            // In batch processing, timeout might mean page load failed
            // We should still create data to maintain order
            console.log('[Coupang Automation] Batch processing timeout detected, creating error placeholder');
            const brand = getBrandFromUrl();
            
            const errorData = {
              brand: brand,
              skuCount: 0,
              timestamp: Date.now(),
              page: parseInt(getCurrentPageFromUrl()),
              isCompleted: true,
              isError: true,
              errorReason: 'Page load timeout'
            };
            
            chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
              const existingData = dataResult.coupang_delivery_data || [];
              existingData.push(errorData);
              chrome.storage.local.set({ 'coupang_delivery_data': existingData }, function() {
                console.log(`[Coupang Automation] Saved timeout error data for brand: ${brand}`, errorData);
                handleBrandCompletion(brand);
              });
            });
            return;
          }
        });
        
        callback();
        return;
      }
      
      setTimeout(checkReady, 100); // Check every 100ms
    }
    
    checkReady();
  }

  // Process delivery counting
  function processDeliveryCounting() {
    const brand = getBrandFromUrl();
    const currentPageNum = getCurrentPageFromUrl();
    
    console.log(`[Coupang Automation] Processing brand "${brand}" page ${currentPageNum}`);
    
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const existingData = result.coupang_delivery_data || [];
      
      // Check if this specific brand and page combination already exists
      const existingEntry = existingData.find(item => 
        item.brand === brand && item.page === parseInt(currentPageNum)
      );
      
      if (existingEntry) {
        console.log(`[Coupang Automation] Data for brand "${brand}" page ${currentPageNum} already processed`);
        
        // If this brand is already completed (found a page with SKU=0), move to next brand
        const brandCompleted = existingData.some(item => 
          item.brand === brand && item.isCompleted === true
        );
        
        if (brandCompleted) {
          console.log(`[Coupang Automation] Brand "${brand}" already completed, moving to next brand`);
          handleBrandCompletion(brand);
        } else {
          // Brand not completed yet, continue to next page
          console.log(`[Coupang Automation] Brand "${brand}" not completed yet, moving to next page`);
          setTimeout(() => {
            goToNextPage();
          }, 1000);
        }
        return;
      }
      
              // Use smart page ready detection instead of fixed timeout
        waitForPageReady(() => {
          const deliveryCount = countDeliveryItems();
          const firstProductId = getFirstProductIdentifier();
          
          // Update page count
          totalPagesProcessed++;
          updateCounts(deliveryCount);
          
          console.log(`[Coupang Automation] Brand "${brand}" page ${currentPageNum}: found ${deliveryCount} SKU items`);
          console.log(`[Coupang Automation] First product identifier: ${firstProductId ? firstProductId.substring(0, 100) : 'None'}`);
          
          // Check for duplicate page by comparing with previous page's first product
          chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
            const currentData = dataResult.coupang_delivery_data || [];
            const brandData = currentData.filter(item => item.brand === brand);
            
            // Find the previous page's data
            const previousPageNum = parseInt(currentPageNum) - 1;
            const previousPageData = brandData.find(item => item.page === previousPageNum);
            
            let isDuplicatePage = false;
            if (previousPageData && firstProductId && previousPageData.firstProductId) {
              isDuplicatePage = firstProductId === previousPageData.firstProductId;
              console.log(`[Coupang Automation] Checking duplicate: current="${firstProductId ? firstProductId.substring(0, 50) : 'None'}" vs previous="${previousPageData.firstProductId ? previousPageData.firstProductId.substring(0, 50) : 'None'}"`);
            }
            
            if (isDuplicatePage) {
              // This is a duplicate page! Don't save current page data and mark brand as completed
              console.log(`[Coupang Automation] DUPLICATE PAGE DETECTED! Current page ${currentPageNum} has same first product as page ${previousPageNum}`);
              updateStatus(`Duplicate page detected! Preserving page ${previousPageNum} data and completing brand...`);
              
              // Keep existing data (don't save current duplicate page data)
              const filteredData = currentData;
              
              // Get URL position for proper ordering
              chrome.storage.local.get(['coupang_original_batch_urls'], function(batchResult) {
                const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
                let urlPosition = -1;
                
                // Find the URL position for this brand
                if (originalBatchUrls.length > 0) {
                  urlPosition = originalBatchUrls.findIndex(url => {
                    if (url === '0') return false;
                    try {
                      const urlObj = new URL(url);
                      const query = urlObj.searchParams.get('q');
                      return query ? decodeURIComponent(query) === brand : false;
                    } catch (e) {
                      return false;
                    }
                  });
                }
                
                // Add completion entry (current page is not saved, brand ends here)
                const completionEntry = {
                  brand: brand,
                  skuCount: 0,
                  timestamp: Date.now(),
                  page: parseInt(currentPageNum),
                  isCompleted: true,
                  isDuplicate: true, // Mark as ended due to duplicate detection
                  firstProductId: firstProductId,
                  urlPosition: urlPosition >= 0 ? urlPosition : 999 // Track original URL position for ordering
                };
                
                filteredData.push(completionEntry);
                chrome.storage.local.set({ 'coupang_delivery_data': filteredData }, function() {
                  console.log(`[Coupang Automation] Preserved page ${previousPageNum} data, skipped duplicate page ${currentPageNum}, and marked brand "${brand}" as completed (position ${urlPosition})`);
                  handleBrandCompletion(brand);
                });
              });
              
            } else if (deliveryCount > 0) {
              // Normal page with delivery items - save data and continue
              // Get URL position for proper ordering
              chrome.storage.local.get(['coupang_original_batch_urls'], function(batchResult) {
                const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
                let urlPosition = -1;
                
                // Find the URL position for this brand
                if (originalBatchUrls.length > 0) {
                  urlPosition = originalBatchUrls.findIndex(url => {
                    if (url === '0') return false;
                    try {
                      const urlObj = new URL(url);
                      const query = urlObj.searchParams.get('q');
                      return query ? decodeURIComponent(query) === brand : false;
                    } catch (e) {
                      return false;
                    }
                  });
                }
                
                const dataEntry = {
                  brand: brand,
                  skuCount: deliveryCount,
                  timestamp: Date.now(),
                  page: parseInt(currentPageNum),
                  isCompleted: false,
                  firstProductId: firstProductId, // Save first product identifier for duplicate detection
                  urlPosition: urlPosition >= 0 ? urlPosition : 999 // Track original URL position for ordering
                };
                
                currentData.push(dataEntry);
                chrome.storage.local.set({ 'coupang_delivery_data': currentData }, function() {
                  console.log(`[Coupang Automation] Saved data for page ${currentPageNum} (position ${urlPosition}):`, dataEntry);
                  
                  updateStatus(`Found ${deliveryCount} delivery items on page ${currentPageNum}. Moving to next page...`);
                  
                  // Move to next page after delay
                  setTimeout(() => {
                    goToNextPage();
                  }, 1000);
                });
              });
              
            } else {
              // No delivery items found - this means we reached the end, brand is completed
              updateStatus(`No delivery items found on page ${currentPageNum}. Brand completed!`);
              
              // Get URL position for proper ordering
              chrome.storage.local.get(['coupang_original_batch_urls'], function(batchResult) {
                const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
                let urlPosition = -1;
                
                // Find the URL position for this brand
                if (originalBatchUrls.length > 0) {
                  urlPosition = originalBatchUrls.findIndex(url => {
                    if (url === '0') return false;
                    try {
                      const urlObj = new URL(url);
                      const query = urlObj.searchParams.get('q');
                      return query ? decodeURIComponent(query) === brand : false;
                    } catch (e) {
                      return false;
                    }
                  });
                }
                
                // Save final data (SKU=0, marked as completed)
                const completionEntry = {
                  brand: brand,
                  skuCount: 0,
                  timestamp: Date.now(),
                  page: parseInt(currentPageNum),
                  isCompleted: true,
                  firstProductId: firstProductId,
                  urlPosition: urlPosition >= 0 ? urlPosition : 999 // Track original URL position for ordering
                };
                
                currentData.push(completionEntry);
                chrome.storage.local.set({ 'coupang_delivery_data': currentData }, function() {
                  console.log(`[Coupang Automation] Brand "${brand}" completed with final entry (position ${urlPosition}):`, completionEntry);
                  
                  // Handle brand completion
                  handleBrandCompletion(brand);
                });
              });
            }
          });
        }, 3000); // Increased wait time to 3 seconds for better reliability
    });
  }
  
  // Ensure brand data exists to maintain batch processing order
  function ensureBrandDataExists(brand) {
    chrome.storage.local.get(['coupang_delivery_data', 'coupang_original_batch_urls'], function(result) {
      const existingData = result.coupang_delivery_data || [];
      const originalBatchUrls = result.coupang_original_batch_urls || [];
      
      // Check if this brand has any data
      const brandData = existingData.filter(item => item.brand === brand);
      
      if (brandData.length === 0) {
        // No data for this brand - create a placeholder entry to maintain order
        console.log(`[Coupang Automation] No data found for brand "${brand}", creating placeholder entry`);
        
        // Find the URL position for this brand
        let urlPosition = -1;
        if (originalBatchUrls.length > 0) {
          urlPosition = originalBatchUrls.findIndex(url => {
            if (url === '0') return false;
            try {
              const urlObj = new URL(url);
              const query = urlObj.searchParams.get('q');
              return query ? decodeURIComponent(query) === brand : false;
            } catch (e) {
              return false;
            }
          });
        }
        
        const placeholderEntry = {
          brand: brand,
          skuCount: 0,
          timestamp: Date.now(),
          page: 1,
          isCompleted: true, // Mark as completed
          isPlaceholder: true, // Mark as placeholder for debugging
          urlPosition: urlPosition >= 0 ? urlPosition : 999 // Track original URL position for ordering
        };
        
        existingData.push(placeholderEntry);
        chrome.storage.local.set({ 'coupang_delivery_data': existingData }, function() {
          console.log(`[Coupang Automation] Created placeholder entry for brand: ${brand} (position ${urlPosition})`, placeholderEntry);
        });
      }
    });
  }

  // Handle brand completion logic
  function handleBrandCompletion(brand) {
    console.log(`[Coupang Automation] Handling completion for brand: ${brand}`);
    
    // Clear auto collecting state to prevent further processing
    setAutoCollectingState(false);
    
    // Reset processing state
    isProcessing = false;
    isAutoMode = false;
    
    // Ensure this brand has at least one entry to maintain order
    ensureBrandDataExists(brand);
    
    // Wait a moment for data to be saved before proceeding
    setTimeout(() => {
      // Check if this is part of batch processing
      chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_batch_current_index'], function(result) {
        const isBatchProcessing = result.coupang_batch_processing || false;
        const batchUrls = result.coupang_batch_urls || [];
        const currentIndex = result.coupang_batch_current_index || 0;
        
        if (isBatchProcessing && batchUrls.length > 0) {
          const nextIndex = currentIndex + 1;
          
          if (nextIndex < batchUrls.length) {
            // There are more URLs to process
            console.log(`[Coupang Automation] Moving to next batch URL: ${batchUrls[nextIndex]} (${nextIndex + 1}/${batchUrls.length})`);
            
            // Update batch index
            chrome.storage.local.set({
              'coupang_batch_current_index': nextIndex,
              'coupang_batch_current_url': batchUrls[nextIndex]
            }, function() {
              updateStatus(`Moving to next brand (${nextIndex + 1}/${batchUrls.length})...`);
              
              // Navigate to next URL after a short delay
              setTimeout(() => {
                console.log('[Coupang Automation] Opening next batch URL');
                window.location.href = batchUrls[nextIndex];
              }, 2000);
            });
          } else {
            // All batch URLs completed - check if this was reprocessing missing brands
            chrome.storage.local.get(['coupang_is_reprocessing_missing', 'coupang_original_batch_urls'], function(reprocessResult) {
              const isReprocessingMissing = reprocessResult.coupang_is_reprocessing_missing || false;
              const originalBatchUrls = reprocessResult.coupang_original_batch_urls || batchUrls;
              
              if (isReprocessingMissing) {
                // We just finished reprocessing missing brands, now check if all brands are complete
                console.log('[Coupang Automation] Finished reprocessing missing brands, checking if all brands are now complete');
                updateStatus('Finished reprocessing missing brands, verifying completion...');
                
                chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
                  const currentData = dataResult.coupang_delivery_data || [];
                  
                  // Use original batch URLs to check completion
                  const allExpectedBrands = originalBatchUrls.map(url => {
                    if (url === '0') return '0';
                    try {
                      const urlObj = new URL(url);
                      const query = urlObj.searchParams.get('q');
                      return query ? decodeURIComponent(query) : 'Unknown';
                    } catch (e) {
                      return 'Unknown';
                    }
                  });
                  
                  const existingBrands = new Set(currentData.map(item => item.brand));
                  const stillMissingBrands = allExpectedBrands.filter(brand => 
                    brand !== 'Unknown' && !existingBrands.has(brand)
                  );
                  
                  console.log(`[Coupang Automation] After reprocessing - still missing brands:`, stillMissingBrands);
                  
                  if (stillMissingBrands.length > 0) {
                    // Still have missing brands, create No Data entries for them with proper ordering
                    console.log(`[Coupang Automation] Creating No Data entries for persistently missing brands:`, stillMissingBrands);
                    
                    // Create No Data entries with timestamps that reflect original order
                    const baseTimestamp = Date.now();
                    const noDataEntries = stillMissingBrands.map((brand, index) => {
                      // Find original position in batch URLs to maintain order
                      const originalIndex = originalBatchUrls.findIndex(url => {
                        if (url === '0') return false;
                        try {
                          const urlObj = new URL(url);
                          const query = urlObj.searchParams.get('q');
                          return query ? decodeURIComponent(query) === brand : false;
                        } catch (e) {
                          return false;
                        }
                      });
                      
                      return {
                        brand: brand,
                        skuCount: 0,
                        timestamp: baseTimestamp + (originalIndex >= 0 ? originalIndex : index), // Use original index for ordering
                        page: 0,
                        isCompleted: true,
                        isNoData: true,
                        isSkipped: true
                      };
                    });
                    
                    const updatedData = currentData.concat(noDataEntries);
                    chrome.storage.local.set({ 'coupang_delivery_data': updatedData }, function() {
                      // Now clear all batch processing states and complete
                      chrome.storage.local.remove([
                        'coupang_batch_processing',
                        'coupang_batch_urls',
                        'coupang_batch_current_index',
                        'coupang_batch_current_url',
                        'coupang_is_reprocessing_missing',
                        'coupang_original_batch_urls'
                      ], function() {
                        console.log('[Coupang Automation] All batch processing truly completed');
                        updateStatus('All batch processing completed. Closing page...');
                        setTimeout(() => { window.close(); }, 3000);
                      });
                    });
                  } else {
                    // All brands are now complete
                    chrome.storage.local.remove([
                      'coupang_batch_processing',
                      'coupang_batch_urls',
                      'coupang_batch_current_index',
                      'coupang_batch_current_url',
                      'coupang_is_reprocessing_missing',
                      'coupang_original_batch_urls'
                    ], function() {
                      console.log('[Coupang Automation] All brands successfully processed');
                      updateStatus('All batch processing completed successfully. Closing page...');
                      setTimeout(() => { window.close(); }, 3000);
                    });
                  }
                });
              } else {
                // This is the first completion of original batch processing
                console.log('[Coupang Automation] First completion of original batch processing');
                updateStatus('All batch processing completed. Ensuring all brands are preserved...');
                
                // Store original batch URLs for reference and check for missing brands
                chrome.storage.local.set({ 'coupang_original_batch_urls': batchUrls }, function() {
                  chrome.storage.local.get(['coupang_delivery_data'], function(dataResult) {
                    const currentData = dataResult.coupang_delivery_data || [];
                    
                    // Extract all brands from batch URLs
                    const allExpectedBrands = batchUrls.map(url => {
                      if (url === '0') return '0';
                      try {
                        const urlObj = new URL(url);
                        const query = urlObj.searchParams.get('q');
                        return query ? decodeURIComponent(query) : 'Unknown';
                      } catch (e) {
                        return 'Unknown';
                      }
                    });
                    
                    // Find brands that have no data entries (were skipped during processing)
                    const existingBrands = new Set(currentData.map(item => item.brand));
                    const missingBrands = allExpectedBrands.filter(brand => 
                      brand !== 'Unknown' && !existingBrands.has(brand)
                    );
                    
                    console.log(`[Coupang Automation] All expected brands:`, allExpectedBrands);
                    console.log(`[Coupang Automation] Existing brands with data:`, Array.from(existingBrands));
                    console.log(`[Coupang Automation] Missing brands (skipped during processing):`, missingBrands);
                    
                    if (missingBrands.length > 0) {
                      // Instead of just creating No Data entries, restart batch processing for missing brands
                      console.log(`[Coupang Automation] Found ${missingBrands.length} missing brands, restarting batch processing for them`);
                      updateStatus(`Found ${missingBrands.length} missing brands, reprocessing them...`);
                      
                      // Find the original URLs for missing brands - don't create new URLs, use exact originals
                      const missingBrandUrls = [];
                      
                      missingBrands.forEach(brand => {
                        // Find the exact original URL for this brand
                        const originalUrl = batchUrls.find(url => {
                          if (url === '0') return false;
                          try {
                            const urlObj = new URL(url);
                            const query = urlObj.searchParams.get('q');
                            return query ? decodeURIComponent(query) === brand : false;
                          } catch (e) {
                            return false;
                          }
                        });
                        
                        if (originalUrl) {
                          console.log(`[Coupang Automation] Found exact original URL for missing brand ${brand}: ${originalUrl}`);
                          missingBrandUrls.push(originalUrl);
                        } else {
                          console.warn(`[Coupang Automation] Could not find original URL for brand ${brand}, skipping reprocessing`);
                        }
                      });
                      
                      if (missingBrandUrls.length > 0) {
                        // Update batch processing to continue with missing brands
                        chrome.storage.local.set({
                          'coupang_batch_processing': true,
                          'coupang_batch_urls': missingBrandUrls,
                          'coupang_batch_current_index': 0,
                          'coupang_batch_current_url': missingBrandUrls[0],
                          'coupang_is_reprocessing_missing': true
                        }, function() {
                          console.log(`[Coupang Automation] Restarting batch processing for ${missingBrandUrls.length} missing brand URLs:`, missingBrandUrls);
                          
                          // Navigate to first missing brand URL
                          setTimeout(() => {
                            console.log('[Coupang Automation] Opening first missing brand URL:', missingBrandUrls[0]);
                            window.location.href = missingBrandUrls[0];
                          }, 1000);
                        });
                      } else {
                        // No valid URLs found for missing brands, create No Data entries and complete
                        console.log('[Coupang Automation] No valid URLs found for missing brands, creating No Data entries');
                        
                        const baseTimestamp = Date.now();
                        const noDataEntries = missingBrands.map((brand, index) => {
                          // Find original position in batch URLs to maintain order
                          const originalIndex = batchUrls.findIndex(url => {
                            if (url === '0') return false;
                            try {
                              const urlObj = new URL(url);
                              const query = urlObj.searchParams.get('q');
                              return query ? decodeURIComponent(query) === brand : false;
                            } catch (e) {
                              return false;
                            }
                          });
                          
                          return {
                            brand: brand,
                            skuCount: 0,
                            timestamp: baseTimestamp + (originalIndex >= 0 ? originalIndex : index),
                            page: 0,
                            isCompleted: true,
                            isNoData: true,
                            isSkipped: true,
                            urlPosition: originalIndex >= 0 ? originalIndex : 999
                          };
                        });
                        
                        const updatedData = currentData.concat(noDataEntries);
                        chrome.storage.local.set({ 'coupang_delivery_data': updatedData }, function() {
                          // Clear all batch processing states and complete
                          chrome.storage.local.remove([
                            'coupang_batch_processing',
                            'coupang_batch_urls',
                            'coupang_batch_current_index',
                            'coupang_batch_current_url',
                            'coupang_is_reprocessing_missing',
                            'coupang_original_batch_urls'
                          ], function() {
                            console.log('[Coupang Automation] All batch processing completed with No Data entries');
                            updateStatus('All batch processing completed. Closing page...');
                            setTimeout(() => { window.close(); }, 3000);
                          });
                        });
                      }
                    } else {
                      // No missing brands, just clear batch processing state normally
                      console.log('[Coupang Automation] All expected brands already have data entries');
                      
                      chrome.storage.local.remove([
                        'coupang_batch_processing',
                        'coupang_batch_urls',
                        'coupang_batch_current_index',
                        'coupang_batch_current_url'
                      ], function() {
                        updateStatus('All batch processing completed. Closing page...');
                        setTimeout(() => { window.close(); }, 3000);
                      });
                    }
                  });
                });
              }
            });
          }
        } else {
          // Single processing mode - clear states and close the page
          // Reset button states
          if (document.getElementById('startBtn')) {
            document.getElementById('startBtn').disabled = false;
          }
          if (document.getElementById('stopBtn')) {
            document.getElementById('stopBtn').disabled = true;
          }
          
          updateStatus('Brand processing completed. Closing page...');
          
          setTimeout(() => {
            console.log('[Coupang Automation] Closing current page after completion');
            try {
              if (window.opener) {
                window.close();
              } else {
                chrome.runtime.sendMessage({action: 'closeCurrentTab'}, function(response) {
                  if (chrome.runtime.lastError) {
                    console.log('[Coupang Automation] Could not close tab via extension, trying window.close()');
                    window.close();
                  }
                });
              }
            } catch (e) {
              console.log('[Coupang Automation] Cannot close page automatically:', e.message);
              updateStatus('Counting completed. Please close page manually.');
            }
          }, 3000);
        }
      });
    }, 500); // Wait 500ms for data to be saved
  }

  // Stop delivery counting
  function stopDeliveryCounting() {
    console.log('[Coupang Automation] Stopping delivery counting - preserving all existing data');
    
    // Simply stop the processing without modifying any data
    isProcessing = false;
    isAutoMode = false;
    
    // Clear auto collecting state
    setAutoCollectingState(false);
    
    // Reset button states
    if (document.getElementById('startBtn')) {
      document.getElementById('startBtn').disabled = false;
    }
    if (document.getElementById('stopBtn')) {
      document.getElementById('stopBtn').disabled = true;
    }
    
    updateStatus('Stopped - All data preserved');
    console.log('[Coupang Automation] Delivery counting stopped - no data was modified');
  }

  // Auto resume from storage
  async function autoResumeFromStorage() {
    const autoCollecting = await getAutoCollectingState();
    
    if (autoCollecting) {
      console.log('[Coupang Automation] Auto resuming delivery counting...');
      
      // Set processing state to true for auto resume
      isProcessing = true;
      isAutoMode = true;
      
      // Set button states
      if (document.getElementById('startBtn')) {
        document.getElementById('startBtn').disabled = true;
      }
      if (document.getElementById('stopBtn')) {
        document.getElementById('stopBtn').disabled = false;
      }
      
      updateStatus('Auto resuming delivery counting...');
      
      // Use smart page ready detection instead of fixed timeout
      waitForPageReady(() => {
        processDeliveryCounting();
      }, 2000); // Max wait time 2 seconds
    }
  }

  // Check if this is a batch processing page
  async function checkBatchProcessing() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_current_url', 'coupang_batch_urls', 'coupang_batch_current_index'], function(result) {
        const isBatchProcessing = result.coupang_batch_processing || false;
        const currentUrl = result.coupang_batch_current_url || '';
        const batchUrls = result.coupang_batch_urls || [];
        const currentIndex = result.coupang_batch_current_index || 0;
        
        console.log('[Coupang Automation] Checking batch processing:', {
          isBatchProcessing,
          currentUrl,
          locationHref: location.href,
          batchUrls,
          currentIndex
        });
        
        if (isBatchProcessing) {
          // If batch processing is active, we should process any Coupang search page
          if (location.href.includes('www.tw.coupang.com/search') || location.href.includes('https://www.tw.coupang.com/categories/')) {
            console.log('[Coupang Automation] Detected batch processing mode - Coupang search page detected');
            resolve(true);
          return;
          }
        }
        
        console.log('[Coupang Automation] Not in batch processing mode');
        resolve(false);
      });
    });
  }

  // Legacy functions - now replaced by checkAndHandleZeroUrl
  function isPlaceholderUrl() {
    console.log('[Coupang Automation] isPlaceholderUrl is deprecated, use checkAndHandleZeroUrl instead');
    return false;
  }

  function handlePlaceholderUrl() {
    console.log('[Coupang Automation] handlePlaceholderUrl is deprecated, use checkAndHandleZeroUrl instead');
  }

  // Move to next batch URL
  function moveToNextBatchUrl() {
    chrome.storage.local.get([
      'coupang_batch_urls', 
      'coupang_batch_current_index'
    ], function(result) {
      const batchUrls = result.coupang_batch_urls || [];
      let currentIndex = result.coupang_batch_current_index || 0;
      
      console.log('[Coupang Extension] Current batch index:', currentIndex);
      console.log('[Coupang Extension] Total batch URLs:', batchUrls.length);
      
      // Move to next URL
      currentIndex++;
      
      // Find next valid URL (skip placeholders)
      let nextValidUrl = null;
      let nextValidIndex = currentIndex;
      
      while (nextValidIndex < batchUrls.length) {
        const url = batchUrls[nextValidIndex];
        
        if (url === '0') {
          // Skip placeholder - it was already processed in popup.js
          console.log('[Coupang Extension] Skipping placeholder at index:', nextValidIndex);
          nextValidIndex++;
          continue;
        } else {
          // Found valid URL
          nextValidUrl = url;
          break;
        }
      }
      
      if (nextValidUrl && nextValidIndex < batchUrls.length) {
        // Update storage with next valid URL
        chrome.storage.local.set({
          'coupang_batch_current_index': nextValidIndex,
          'coupang_batch_current_url': nextValidUrl
        }, function() {
          console.log('[Coupang Extension] Moving to next batch URL:', nextValidUrl);
          console.log('[Coupang Extension] Updated batch index to:', nextValidIndex);
          
          // Navigate to next URL
          window.location.href = nextValidUrl;
        });
      } else {
        // All URLs processed
        console.log('[Coupang Extension] All batch URLs processed');
        
        // Clear batch processing states
        chrome.storage.local.remove([
          'coupang_batch_processing',
          'coupang_batch_urls',
          'coupang_batch_current_index',
          'coupang_batch_current_url',
          'coupang_auto_collecting'
        ], function() {
          console.log('[Coupang Extension] Batch processing completed');
          updateStatus('All batch processing completed! Closing page...');
          
          // Close the page after a delay
          setTimeout(() => {
            window.close();
          }, 2000);
        });
      }
    });
  }

  // Start batch processing
  function startBatchProcessing() {
    if (isProcessing) return;
    
    console.log('[Coupang Automation] Starting batch processing mode');
    
    // Check if this is a "0" URL first - this should have been handled in initialize()
    // but double-check here as a safety measure
    if (checkAndHandleZeroUrl()) {
      console.log('[Coupang Automation] Detected "0" URL in startBatchProcessing, already handled');
      return;
    }
    
    isProcessing = true;
    isAutoMode = true;
    setAutoCollectingState(true);
    
    updateStatus('Starting batch processing...');
    
    // Use smart page ready detection instead of fixed timeout
    waitForPageReady(() => {
      processDeliveryCounting();
    }, 2000); // Max wait time 2 seconds
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      max-width: 400px;
      text-align: center;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  // Check if current page is a "0" URL and handle it
  function checkAndHandleZeroUrl() {
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    // Multiple ways to detect "0" URLs:
    // 1. URL contains "/0" or "/search/0"
    // 2. Query parameter q is "0"
    // 3. URL specifically matches the pattern
    const isZeroUrl = url.includes('/0') || 
                      url.includes('/search/0') ||
                      url.includes('q=0') ||
                      url.includes('q=%30') ||
                      query === '0' || 
                      query === '%30' || 
                      (query && decodeURIComponent(query) === '0') ||
                      url === 'https://www.tw.coupang.com/0';
    
    if (isZeroUrl) {
      console.log('[Coupang Automation] Detected "0" URL:', url);
      console.log('[Coupang Automation] Query parameter:', query);
      
      // Show status and immediately proceed
      if (document.getElementById('status')) {
        updateStatus('Detected placeholder URL, closing and moving to next...');
      }
      
      // Record placeholder data immediately without checking for duplicates to speed up
      const placeholderData = {
        brand: '0',
        skuCount: 0,
        timestamp: Date.now(),
        page: 1,
        isCompleted: true
      };
      
      // Check if we're in batch processing mode
      chrome.storage.local.get(['coupang_batch_processing'], function(batchResult) {
        const isBatchProcessing = batchResult.coupang_batch_processing || false;
        
        if (isBatchProcessing) {
          // In batch mode, save data and move to next URL
          chrome.storage.local.get(['coupang_delivery_data'], function(result) {
            const existingData = result.coupang_delivery_data || [];
            
            // Check if placeholder already exists to avoid duplicates
            const existingPlaceholder = existingData.find(item => 
              item.brand === '0' && item.timestamp === placeholderData.timestamp
            );
            
            if (!existingPlaceholder) {
              existingData.push(placeholderData);
              chrome.storage.local.set({ 'coupang_delivery_data': existingData }, function() {
                console.log('[Coupang Automation] Saved placeholder data, moving to next URL');
                
                // Move to next batch URL immediately
                setTimeout(() => {
                  moveToNextBatchUrl();
                }, 500);
              });
            } else {
              console.log('[Coupang Automation] Placeholder already exists, moving to next URL');
              setTimeout(() => {
                moveToNextBatchUrl();
              }, 500);
            }
          });
        } else {
          // Not in batch mode, just close the page
          console.log('[Coupang Automation] Not in batch mode, closing "0" page');
          setTimeout(() => {
            window.close();
          }, 1000);
        }
      });
      
      return true; // Indicates this was a "0" URL
    }
    
    return false; // Not a "0" URL
  }

  // Initialize
  async function initialize() {
    console.log('[Coupang Automation] Initializing...');
    
    // First check if this is a "0" URL that should be closed immediately
    if (checkAndHandleZeroUrl()) {
      console.log('[Coupang Automation] Handled "0" URL, skipping normal initialization');
      return;
    }
    
    // Check if this is batch processing
    const isBatchProcessing = await checkBatchProcessing();
    
    if (isBatchProcessing) {
      // Auto start batch processing
      await startBatchProcessing();
    } else {
      // Skip creating control panel - user doesn't want the floating window
      console.log('[Coupang Automation] Non-batch mode detected, but control panel disabled per user preference');
      
      // Check if should auto resume
      await autoResumeFromStorage();
    }
    
    console.log('[Coupang Automation] Initialization completed');
  }

  // Add additional checks for "0" URLs during page navigation
  function setupZeroUrlMonitoring() {
    // Check immediately if URL changes
    let lastUrl = window.location.href;
    
    // More frequent checking for zero URLs
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('[Coupang Automation] URL changed to:', lastUrl);
      }
      
      // Check for zero URL patterns more thoroughly
      const isZeroUrl = currentUrl.includes('www.tw.coupang.com/0') ||
                        currentUrl.includes('/0') ||
                        currentUrl.includes('q=0') ||
                        currentUrl === 'https://www.tw.coupang.com/0';
      
      if (isZeroUrl) {
        console.log('[Coupang Automation] Detected zero URL during monitoring:', currentUrl);
        clearInterval(urlCheckInterval);
        
        // Show immediate visual feedback
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #ff4444;
          color: white;
          padding: 15px;
          border-radius: 5px;
          z-index: 99999;
          font-family: Arial, sans-serif;
          font-weight: bold;
        `;
        alertDiv.textContent = 'Zero URL detected! Handling...';
        document.body.appendChild(alertDiv);
        
        // Handle the zero URL
        setTimeout(() => {
          handleZeroPageImmediately();
        }, 500);
        return;
      }
    }, 200); // Check every 200ms for more responsive detection
    
    // Clear interval after 20 seconds to avoid memory leak
    setTimeout(() => {
      clearInterval(urlCheckInterval);
      console.log('[Coupang Automation] Zero URL monitoring stopped after 20 seconds');
    }, 20000);
  }

  // Start initialization when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupZeroUrlMonitoring();
      initialize();
    });
  } else {
    setupZeroUrlMonitoring();
    initialize();
  }
})(); 