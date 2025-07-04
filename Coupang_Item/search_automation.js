// == Coupang Search Page Automated Collection ==
(function() {
  console.log('[Coupang Search Automation] Starting execution, current URL:', location.href);
  
  // Only process search pages
  if (!location.href.includes('www.tw.coupang.com/search')) {
    console.log('[Coupang Search Automation] Not a search page, skipping');
    return;
  }

  let isProcessing = false;
  let processedProducts = new Set(); // Record processed products
  let currentProductIndex = 0;
  let productLinks = [];
  let currentPage = 1; // Current page
  let totalPagesProcessed = 0; // Number of pages processed
  let isAutoMode = false; // Whether in auto mode (auto continue after page jump)

  // Check if this is a page after automatic page jump
  function checkAutoResumeFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['coupang_auto_collecting'], function(result) {
        const autoCollecting = result.coupang_auto_collecting || false;
        console.log('[Coupang Search Automation] Checking auto collection status:', autoCollecting);
        resolve(autoCollecting);
      });
    });
  }

  // Set auto collection state
  function setAutoCollectingState(state) {
    chrome.storage.local.set({ 'coupang_auto_collecting': state }, function() {
      console.log('[Coupang Search Automation] Setting auto collection status:', state);
    });
  }

  // Display control panel
  function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'coupang-automation-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 320px;
    `;
    
    panel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #4CAF50;">
        🤖 Coupang Multi-Page Auto Collector
      </div>
      <div id="status" style="margin-bottom: 10px;">
        Ready
      </div>
      <div style="margin-bottom: 10px;">
        <button id="startBtn" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
          Start Multi-Page Collection
        </button>
        <button id="stopBtn" style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;" disabled>
          Stop Collection
        </button>
      </div>
      <div style="font-size: 12px; color: #666;">
        <div>Current Page: <span id="currentPage">1</span></div>
        <div>Pages Processed: <span id="totalPages">0</span></div>
        <div>This Page Processed: <span id="processedCount">0</span> products</div>
        <div>This Page Total: <span id="totalCount">0</span> products</div>
        <div id="autoModeIndicator" style="color: #ff9800; font-weight: bold; display: none;">
          🔄 Auto Mode Running
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // Bind button events
    document.getElementById('startBtn').addEventListener('click', startAutomation);
    document.getElementById('stopBtn').addEventListener('click', stopAutomation);
    
    return panel;
  }

  // Update status display
  function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      console.log('[Coupang Search Automation] Status:', message);
    }
  }

  // Update count display
  function updateCounts() {
    const processedElement = document.getElementById('processedCount');
    const totalElement = document.getElementById('totalCount');
    const currentPageElement = document.getElementById('currentPage');
    const totalPagesElement = document.getElementById('totalPages');
    const autoModeElement = document.getElementById('autoModeIndicator');
    
    if (processedElement) processedElement.textContent = processedProducts.size;
    if (totalElement) totalElement.textContent = productLinks.length;
    if (currentPageElement) currentPageElement.textContent = getCurrentPageFromUrl();
    if (totalPagesElement) totalPagesElement.textContent = totalPagesProcessed;
    if (autoModeElement) {
      autoModeElement.style.display = isAutoMode ? 'block' : 'none';
    }
  }

  // Get current page number from URL
  function getCurrentPageFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('page') || '1';
  }

  // Find all product links
  function findProductLinks() {
    const links = [];
    
    // Multiple possible product link selectors
    const selectors = [
      'a[href*="/products/"]',
      '[data-testid*="product"] a',
      '.search-product a',
      '.product-item a',
      '.item a'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const href = element.href;
        if (href && href.includes('/products/') && href.includes('itemId=')) {
          // Check if contains "預計送達" related elements (delivery info)
          const productContainer = element.closest('[class*="product"], [class*="item"], [data-testid*="product"]') || element.parentElement;
          if (productContainer) {
            const text = productContainer.textContent;
            if (text.includes('預計送達') || text.includes('배송') || text.includes('delivery')) {
              links.push({
                url: href,
                element: element,
                container: productContainer
              });
            }
          }
        }
      });
    }
    
    // Remove duplicates
    const uniqueLinks = [];
    const seenUrls = new Set();
    links.forEach(link => {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    });
    
    console.log(`[Coupang Search Automation] Found ${uniqueLinks.length} qualified products`);
    return uniqueLinks;
  }

  // Jump to next page
  function goToNextPage() {
    const currentPageNum = parseInt(getCurrentPageFromUrl());
    const nextPage = currentPageNum + 1;
    
    // Update page parameter in URL
    const url = new URL(window.location.href);
    url.searchParams.set('page', nextPage.toString());
    
    updateStatus(`Jumping to page ${nextPage}...`);
    console.log(`[Coupang Search Automation] Jumping to page ${nextPage}:`, url.toString());
    
    // Set auto collection state so next page knows to auto continue
    setAutoCollectingState(true);
    
    // Jump to next page
    window.location.href = url.toString();
  }

  // Start automated collection
  function startAutomation() {
    if (isProcessing) return;
    
    isProcessing = true;
    isAutoMode = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    // Set auto collection state
    setAutoCollectingState(true);
    
    updateStatus('Searching for products...');
    
    // Find product links
    productLinks = findProductLinks();
    updateCounts();
    
    if (productLinks.length === 0) {
      updateStatus('No qualified products found on this page, checking if page turn needed...');
      handleNoProductsFound();
      return;
    }
    
    updateStatus(`Page ${getCurrentPageFromUrl()} found ${productLinks.length} products, starting processing...`);
    currentProductIndex = 0;
    processedProducts.clear(); // Clear this page's processed records
    processNextProduct();
  }

  // Auto resume collection (for after page jump)
  function autoResumeCollection() {
    console.log('[Coupang Search Automation] Auto resuming collection...');
    
    isProcessing = true;
    isAutoMode = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    updateStatus('Auto resuming collection, searching for products...');
    
    // Find product links
    productLinks = findProductLinks();
    updateCounts();
    
    if (productLinks.length === 0) {
      updateStatus('No qualified products found on this page, collection complete!');
      handleNoProductsFound();
      return;
    }
    
    updateStatus(`Auto resume - Page ${getCurrentPageFromUrl()} found ${productLinks.length} products, continuing processing...`);
    currentProductIndex = 0;
    processedProducts.clear(); // Clear this page's processed records
    processNextProduct();
  }

  // Handle case when no products found
  function handleNoProductsFound() {
    const currentPageNum = parseInt(getCurrentPageFromUrl());
    
    if (currentPageNum === 1) {
      // If first page has no products, stop directly
      updateStatus('First page has no qualified products, stopping collection');
      stopAutomation();
      showNotification('No qualified products found', 'error');
    } else {
      // If not first page, means all pages processed
      updateStatus(`All pages processed! Total ${totalPagesProcessed} pages processed`);
      stopAutomation();
      showNotification(`Multi-page collection complete! Total ${totalPagesProcessed} pages processed`, 'success');
    }
  }

  // Stop automated collection
  function stopAutomation() {
    isProcessing = false;
    isAutoMode = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    
    // Clear auto collection state
    setAutoCollectingState(false);
    
    updateStatus('Collection stopped');
    updateCounts();
  }

  // Process next product
  function processNextProduct() {
    if (!isProcessing) return;
    
    if (currentProductIndex >= productLinks.length) {
      // Current page processing complete, jump to next page
      totalPagesProcessed++;
      updateStatus(`Page ${getCurrentPageFromUrl()} processing complete, preparing to jump to next page...`);
      
      setTimeout(() => {
        if (isProcessing) {
          goToNextPage();
        }
      }, 2000); // Wait 2 seconds before jumping
      return;
    }
    
    const product = productLinks[currentProductIndex];
    const productUrl = product.url;
    
    // Check if already processed
    if (processedProducts.has(productUrl)) {
      console.log('[Coupang Search Automation] Product already processed, skipping:', productUrl);
      currentProductIndex++;
      setTimeout(processNextProduct, 1000);
      return;
    }
    
    updateStatus(`Processing product ${currentProductIndex + 1}/${productLinks.length}...`);
    
    // Mark as processed
    processedProducts.add(productUrl);
    
    // Open product page in new tab
    const newTab = window.open(productUrl, '_blank');
    
    if (!newTab) {
      console.error('[Coupang Search Automation] Unable to open new tab');
      currentProductIndex++;
      setTimeout(processNextProduct, 2000);
      return;
    }
    
    // Monitor new tab data collection status
    monitorTabDataCollection(newTab, productUrl);
  }

  // Monitor tab data collection status
  function monitorTabDataCollection(tab, productUrl) {
    let checkCount = 0;
    const maxChecks = 20; // Check at most 20 times (about 40 seconds)
    let monitoringActive = true;
    let initialDataCount = 0;
    let hasFoundData = false;
    
    console.log(`[Coupang Search Automation] Starting to monitor ${productUrl}`);
    
    // Record initial data count first
    chrome.storage.local.get(['coupang_detail_data'], function(result) {
      if (monitoringActive) {
        const data = result.coupang_detail_data || [];
        initialDataCount = data.length;
        console.log(`[Coupang Search Automation] Initial data count: ${initialDataCount}`);
      }
    });
    
    // Cleanup function
    function cleanup(reason) {
      if (!monitoringActive) return;
      monitoringActive = false;
      
      console.log(`[Coupang Search Automation] ${reason}, closing tab`);
      if (!tab.closed) {
        try {
          tab.close();
        } catch (e) {
          console.log('[Coupang Search Automation] Error occurred when closing tab:', e);
        }
      }
      clearInterval(checkInterval);
      currentProductIndex++;
      updateCounts();
      
      // Quickly process next one
      setTimeout(processNextProduct, 1000);
    }
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Check if tab still exists
      if (tab.closed) {
        cleanup('Tab closed');
        return;
      }
      
      // Check if data collected
      chrome.storage.local.get(['coupang_detail_data'], function(result) {
        if (!monitoringActive) return;
        
        const data = result.coupang_detail_data || [];
        const currentDataCount = data.length;
        
        console.log(`[Coupang Search Automation] Check ${checkCount} - Initial:${initialDataCount}, Current:${currentDataCount}`);
        
        // Method 1: Check if data count increased (indicates new data)
        if (currentDataCount > initialDataCount && !hasFoundData) {
          hasFoundData = true;
          console.log('[Coupang Search Automation] Detected data count increase, closing immediately');
          cleanup('Detected new data');
          return;
        }
        
        // Method 2: Directly check if matching URL exists (for duplicate data detection)
        const matchingItem = data.find(item => item.URL === productUrl);
        if (matchingItem && !hasFoundData) {
          hasFoundData = true;
          console.log('[Coupang Search Automation] Detected duplicate data, closing immediately');
          cleanup('Detected duplicate data');
          return;
        }
        
        // Method 3: Listen for page notifications (blue/green lights)
        try {
          // Try to find notification elements in new tab
          if (tab.document) {
            const notifications = tab.document.querySelectorAll('[id*="notification"], [class*="notification"]');
            for (const notification of notifications) {
              const text = notification.textContent;
              if (text.includes('重複') || text.includes('duplicate') || text.includes('已存在')) {
                console.log('[Coupang Search Automation] Detected duplicate notification on page');
                cleanup('Page shows duplicate data');
                return;
              }
              if (text.includes('成功') || text.includes('收集') || text.includes('success')) {
                console.log('[Coupang Search Automation] Detected success notification on page');
                cleanup('Page shows collection success');
                return;
              }
            }
          }
        } catch (e) {
          // Cross-origin restrictions, unable to directly access tab content, this is normal
        }
        
        // Timeout handling
        if (checkCount >= maxChecks) {
          cleanup('Monitoring timeout');
          return;
        }
      });
    }, 2000); // Check every 2 seconds
    
    // Additional quick check - specifically for detecting duplicate data quick response
    const quickCheckInterval = setInterval(() => {
      if (!monitoringActive) {
        clearInterval(quickCheckInterval);
        return;
      }
      
      if (tab.closed) {
        clearInterval(quickCheckInterval);
        return;
      }
      
      chrome.storage.local.get(['coupang_detail_data'], function(result) {
        if (!monitoringActive) return;
        
        const data = result.coupang_detail_data || [];
        const currentDataCount = data.length;
        
        // Quick detection of data changes
        if (currentDataCount !== initialDataCount && !hasFoundData) {
          hasFoundData = true;
          clearInterval(quickCheckInterval);
          console.log('[Coupang Search Automation] Quick detection of data change');
          cleanup('Quick detection of data change');
        }
      });
    }, 500); // Quick check every 0.5 seconds
    
    // Safety mechanism: if tab closes very quickly
    setTimeout(() => {
      if (tab.closed && monitoringActive) {
        cleanup('Tab closed early');
      }
    }, 1000);
    
    // Final safety mechanism: forced cleanup
    setTimeout(() => {
      if (monitoringActive) {
        console.log('[Coupang Search Automation] Forced cleanup monitoring');
        cleanup('Forced cleanup');
      }
    }, 45000); // Forced cleanup after 45 seconds
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    let backgroundColor;
    switch(type) {
      case 'error':
        backgroundColor = '#f44336';
        break;
      case 'success':
        backgroundColor = '#4CAF50';
        break;
      default:
        backgroundColor = '#2196F3';
    }
    
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10001;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Initialize
  async function initialize() {
    console.log('[Coupang Search Automation] Initializing control panel...');
    createControlPanel();
    
    // Check if auto resume collection needed
    const shouldAutoResume = await checkAutoResumeFromStorage();
    
    if (shouldAutoResume) {
      console.log('[Coupang Search Automation] Detected auto collection status, auto resuming in 3 seconds...');
      updateStatus('Detected page jump, preparing to auto resume collection...');
      showNotification('Detected page jump, auto resuming collection in 3 seconds...', 'info');
      
      setTimeout(() => {
        autoResumeCollection();
      }, 3000);
    } else {
      showNotification('Multi-page auto collector ready! Click "Start Multi-Page Collection" to process all pages of products.');
    }
  }

  // Wait for page load completion
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    setTimeout(initialize, 1000);
  }

})(); 