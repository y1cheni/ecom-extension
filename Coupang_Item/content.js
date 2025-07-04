// == Coupang Product Details Data Collection ==
(function() {
  console.log('[Coupang Collector] Starting execution, current URL:', location.href);
  
  // Only process correct product page URLs
  if (!location.href.startsWith('https://www.tw.coupang.com/products/')) {
    console.log('[Coupang Collector] Not a product page, skipping');
    return;
  }

  // Wait for page load completion
  function waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }

  // 1. Get brand - Extract from search page URL
  function getBrand() {
    let brand = '';
    
    // Method 1: Extract brand from referrer (search page) URL
    if (document.referrer && document.referrer.includes('search') && document.referrer.includes('q=')) {
      const referrerMatch = document.referrer.match(/q=([^&]+)/);
      if (referrerMatch) {
        try {
          brand = decodeURIComponent(referrerMatch[1]).replace(/\+/g, ' ');
          console.log('[Coupang Collector] Brand extracted from search page URL:', brand);
        } catch (e) {
          console.log('[Coupang Collector] Search URL decoding failed:', e);
        }
      }
    }
    
    // Method 2: Find brand information in product title (backup)
    if (!brand) {
      const titleSelectors = [
        'h1',
        '[class*="title"]',
        '[class*="Title"]',
        '[class*="name"]',
        '[class*="Name"]'
      ];
      
      for (const selector of titleSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent.trim();
          if (text && text.length > 10) {
            // Try to extract first word as brand
            const words = text.split(/[\s\-\[\]【】]/);
            if (words.length > 0 && words[0].length > 1) {
              brand = words[0];
              break;
            }
          }
        }
        if (brand) break;
      }
    }
    
    // Method 3: Find elements containing "품牌", "브랜드", "Brand"
    if (!brand) {
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        const text = element.textContent;
        if (text.includes('품牌') || text.includes('브랜드') || text.includes('Brand') || text.includes('brand')) {
          // Check adjacent elements
          const siblings = [element.nextElementSibling, element.previousElementSibling];
          for (const sibling of siblings) {
            if (sibling && sibling.textContent.trim() && !sibling.textContent.includes('품牌') && !sibling.textContent.includes('브랜드')) {
              brand = sibling.textContent.trim();
              break;
            }
          }
          if (brand) break;
          
          // Check other child elements of parent element
          if (element.parentElement) {
            const children = Array.from(element.parentElement.children);
            const currentIndex = children.indexOf(element);
            if (currentIndex >= 0 && currentIndex < children.length - 1) {
              const nextChild = children[currentIndex + 1];
              if (nextChild && nextChild.textContent.trim()) {
                brand = nextChild.textContent.trim();
                break;
              }
            }
          }
        }
      }
    }
    
    // Method 4: Extract brand from product name in current page URL (last resort)
    if (!brand) {
      const urlMatch = location.href.match(/products\/([^/?]+)/);
      if (urlMatch) {
        try {
          const decodedName = decodeURIComponent(urlMatch[1]);
          const words = decodedName.split(/[\s\-\[\]【】%]/);
          if (words.length > 0 && words[0].length > 1) {
            brand = words[0];
          }
        } catch (e) {
          console.log('[Coupang Collector] URL decoding failed:', e);
        }
      }
    }
    
    console.log('[Coupang Collector] Brand:', brand);
    return brand;
  }

  // 2. Get VendorItemId
  function getVendorItemId() {
    const m = location.href.match(/vendorItemId=(\d+)/);
    const result = m ? m[1] : '';
    console.log('[Coupang Collector] VendorItemId:', result);
    return result;
  }

  // 3. Get itemId
  function getItemId() {
    const m = location.href.match(/itemId=(\d+)/);
    const result = m ? m[1] : '';
    console.log('[Coupang Collector] itemId:', result);
    return result;
  }

  // 4. Get Model_name (extract actual product name from webpage title)
  function getModelName() {
    let result = '';
    
    // Method 1: Extract from webpage title
    const titleSelectors = [
      'h1',
      '[class*="title"]',
      '[class*="Title"]',
      '[class*="name"]',
      '[class*="Name"]',
      '[class*="product"]',
      '[class*="Product"]'
    ];
    
    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        // Ensure it's a product title (reasonable length and contains product-related info)
        if (text && text.length > 10 && text.length < 500) {
          // Exclude text that obviously isn't a product title
          if (!text.includes('로그인') && !text.includes('회원가입') && 
              !text.includes('장바구니') && !text.includes('검색') &&
              !text.includes('Login') && !text.includes('Search')) {
            result = text;
            break;
          }
        }
      }
      if (result) break;
    }
    
    // Method 2: Extract from page title tag (backup plan)
    if (!result) {
      const pageTitle = document.title;
      if (pageTitle && pageTitle.length > 10) {
        // Remove common website suffixes
        result = pageTitle.replace(/\s*-\s*쿠팡.*$/, '').replace(/\s*-\s*Coupang.*$/, '').trim();
      }
    }
    
    // Method 3: Extract from URL (last resort)
    if (!result) {
      const m = location.href.match(/products\/([^/?]+)/);
      if (m) {
        try {
          result = decodeURIComponent(m[1]);
          // Remove trailing -number part (e.g.: -489674451697664)
          result = result.replace(/-\d+$/, '');
        } catch {
          result = m[1];
          // Remove trailing -number part (e.g.: -489674451697664)
          result = result.replace(/-\d+$/, '');
        }
      }
    }
    
    console.log('[Coupang Collector] Model_name:', result);
    return result;
  }

  // 5. Get price (discounted price) - simplified version
  function getPrice() {
    let price = '';
    
    // Ensure price search only on product detail pages
    if (!location.href.includes('/products/')) {
      console.log('[Coupang Collector] Not a product page, skipping price search');
      return price;
    }
    
    console.log('[Coupang Collector] Starting price search...');
    
    // Strategy 1: Global search for all dollar prices, then filter
    const allPriceElements = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      // Find dollar format prices
      const dollarMatches = text.match(/\$(\d{1,3}(?:,\d{3})*)/g);
      if (dollarMatches) {
        for (const match of dollarMatches) {
          const priceValue = match.replace('$', '').replace(/,/g, '');
          const numPrice = parseInt(priceValue);
          
          // Filter conditions:
          // 1. Reasonable price (between $10-50000)
          // 2. Not in unit price (like $306.5/10ml)
          // 3. Not in reviews or other irrelevant text
          if (numPrice >= 10 && numPrice <= 50000 && 
              !text.includes('/') && 
              !text.match(/\([^)]*\/[^)]*\)/) &&
              !text.includes('평점') && 
              !text.includes('리뷰') && 
              !text.includes('review') &&
              !text.includes('評價')) {
            
            allPriceElements.push({
              element: node.parentElement,
              price: priceValue,
              context: text,
              numPrice: numPrice
            });
          }
        }
      }
    }
    
    console.log('[Coupang Collector] All price candidates found:', allPriceElements);
    
    // Strategy 2: Prioritize price closest to "discounted price"
    let bestPrice = null;
    let minDistance = Infinity;
    
    for (const priceInfo of allPriceElements) {
      // Check if near "discounted price"
      const element = priceInfo.element;
      let distance = Infinity;
      
      // Method 1: Check if element itself and its siblings contain "discounted price"
      const checkNearbyElements = (el) => {
        if (!el) return false;
        
        // Check element itself
        if (el.textContent.includes('折扣後價格')) return true;
        
        // Check previous and next sibling elements
        const siblings = [el.previousElementSibling, el.nextElementSibling];
        for (const sibling of siblings) {
          if (sibling && sibling.textContent.includes('折扣後價格')) return true;
        }
        
        // Check all child elements of parent element
        if (el.parentElement) {
          for (const child of el.parentElement.children) {
            if (child.textContent.includes('折扣後價格')) return true;
          }
        }
        
        return false;
      };
      
      // Check current element and its ancestor elements (up to 3 levels)
      let currentEl = element;
      for (let level = 0; level < 3 && currentEl; level++) {
        if (checkNearbyElements(currentEl)) {
          distance = level;
          break;
        }
        currentEl = currentEl.parentElement;
      }
      
      console.log(`[Coupang Collector] Price ${priceInfo.price} distance from "discounted price":`, distance);
      
      if (distance < minDistance) {
        minDistance = distance;
        bestPrice = priceInfo;
      }
    }
    
    // Strategy 3: If found price close to "discounted price", use it
    if (bestPrice && minDistance < Infinity) {
      price = bestPrice.price;
      console.log('[Coupang Collector] Selected price closest to "discounted price":', price, 'context:', bestPrice.context);
    } 
    // Strategy 4: If no "discounted price" found, select largest reasonable price (usually the main price)
    else if (allPriceElements.length > 0) {
      // Sort by price size, select largest (usually main product price)
      allPriceElements.sort((a, b) => b.numPrice - a.numPrice);
      price = allPriceElements[0].price;
      console.log('[Coupang Collector] "Discounted price" not found, selected maximum price:', price, 'context:', allPriceElements[0].context);
    }
    
    // Strategy 5: Last resort - Use common price selectors
    if (!price) {
      console.log('[Coupang Collector] Using backup price search solution...');
      const priceSelectors = [
        '[class*="price"]:not([class*="unit"])',
        '[class*="Price"]:not([class*="Unit"])',
        '[data-testid*="price"]',
        'strong',
        'b'
      ];
      
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent.trim();
          const dollarMatch = text.match(/^\$(\d{1,3}(?:,\d{3})*)$/);
          if (dollarMatch) {
            const potentialPrice = dollarMatch[1].replace(/,/g, '');
            const numPrice = parseInt(potentialPrice);
            if (numPrice >= 10 && numPrice <= 50000) {
              price = potentialPrice;
              console.log('[Coupang Collector] Backup solution found price:', price);
              break;
            }
          }
        }
        if (price) break;
      }
    }
    
    console.log('[Coupang Collector] Final price:', price);
    return price;
  }

  // 6. Get # of review - Find "Product Reviews ("
  function getReviewCount() {
    let review = '';
    
    // Method 1: Find elements containing "Product Reviews ("
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const text = element.textContent;
      
      // Check if contains "商品評價 ("
      if (text.includes('商品評價 (')) {
        
        // Method 1a: Find "商品評價 (number)" pattern in same element
        const sameElementMatch = text.match(/商品評價\s*\(\s*(\d{1,3}(?:,\d{3})*)/);
        if (sameElementMatch) {
          review = sameElementMatch[1].replace(/,/g, '');
          break;
        }
        
        // Method 1b: Find number in previous sibling element
        if (element.previousElementSibling) {
          const prevText = element.previousElementSibling.textContent;
          const prevMatch = prevText.match(/(\d{1,3}(?:,\d{3})*)/);
          if (prevMatch) {
            review = prevMatch[1].replace(/,/g, '');
            break;
          }
        }
        
        // Method 1c: Find number in next sibling element
        if (element.nextElementSibling) {
          const nextText = element.nextElementSibling.textContent;
          const nextMatch = nextText.match(/(\d{1,3}(?:,\d{3})*)/);
          if (nextMatch) {
            review = nextMatch[1].replace(/,/g, '');
            break;
          }
        }
        
        // Method 1d: Find in other child elements of parent element
        if (element.parentElement) {
          const siblings = Array.from(element.parentElement.children);
          for (const sibling of siblings) {
            if (sibling !== element) {
              const siblingMatch = sibling.textContent.match(/(\d{1,3}(?:,\d{3})*)/);
              if (siblingMatch) {
                review = siblingMatch[1].replace(/,/g, '');
                break;
              }
            }
          }
          if (review) break;
        }
      }
    }
    
    // Method 2: Find combination patterns of "商品評價" and numbers
    if (!review) {
      for (const element of allElements) {
        const text = element.textContent;
        // Find various "商品評價" related patterns
        const patterns = [
          /商品評價\s*\(\s*(\d{1,3}(?:,\d{3})*)/,  // 商品評價 (number
          /(\d{1,3}(?:,\d{3})*)\s*\)\s*商品評價/,  // number) 商品評價
          /(\d{1,3}(?:,\d{3})*)\s*商品評價/,       // number 商品評價
          /商品評價\s*(\d{1,3}(?:,\d{3})*)/        // 商品評價 number
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            review = match[1].replace(/,/g, '');
            break;
          }
        }
        if (review) break;
      }
    }
    
    console.log('[Coupang Collector] Review count:', review);
    return review;
  }

  // 7. Get URL
  function getUrl() {
    return location.href;
  }

  // Check if data is duplicate
  function isDuplicateData(newData, existingDataArray) {
    return existingDataArray.some(item => 
      item.VendorItemId === newData.VendorItemId && 
      item.itemId === newData.itemId &&
      item.Model_name === newData.Model_name
    );
  }

  // Main execution function
  async function collectData() {
    try {
      console.log('[Coupang Collector] Starting data collection...');
      
      // Combine data
      const data = {
        Brand: getBrand(),
        VendorItemId: getVendorItemId(),
        itemId: getItemId(),
        Model_name: getModelName(),
        price: getPrice(),
        review_count: getReviewCount(),
        URL: getUrl(),
        timestamp: Date.now()
      };

      console.log('[Coupang Collector] Collected data:', data);
      
      // Check data completeness
      const requiredFields = ['VendorItemId', 'itemId', 'Model_name'];
      const hasRequiredData = requiredFields.every(field => data[field] && data[field].trim() !== '');
      
      if (!hasRequiredData) {
        console.log('[Coupang Collector] Data incomplete, skipping save');
        return false;
      }

      // Use chrome.storage.local to save
      chrome.storage.local.get(['coupang_detail_data'], function(result) {
        let all = result.coupang_detail_data || [];
        
        // Check for duplicates
        if (isDuplicateData(data, all)) {
          console.log('[Coupang Collector] Duplicate data, skipping save');
          showNotification('Data already exists, skipping duplicate item', 'info');
          return;
        }
        
        all.push(data);
        chrome.storage.local.set({ coupang_detail_data: all }, function() {
          console.log('[Coupang Collector] Data saved');
          
          // Show notification on page
          showNotification('New data collection completed!');
        });
      });
      
      return true;

    } catch (error) {
      console.error('[Coupang Collector] Error:', error);
      showNotification('Data collection failed: ' + error.message, 'error');
      return false;
    }
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
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  // Continuous monitoring variables
  let isMonitoring = false;
  let monitoringInterval = null;
  let retryCount = 0;
  const maxRetries = 8;

  // Continuous monitoring function
  function startContinuousMonitoring() {
    if (isMonitoring) return;
    
    isMonitoring = true;
    console.log('[Coupang Collector] Starting continuous monitoring...');
    
    monitoringInterval = setInterval(async () => {
      try {
        const success = await collectData();
        
        if (success) {
          retryCount = 0; // Reset retry count after success
        } else {
          retryCount++;
          console.log(`[Coupang Collector] Attempt ${retryCount}, data may not be fully loaded yet`);
        }
        
        // If too many retries, pause monitoring for a while
        if (retryCount >= maxRetries) {
          console.log('[Coupang Collector] Reached maximum retry count, pausing monitoring for 30 seconds');
          clearInterval(monitoringInterval);
          isMonitoring = false;
          
          // Restart monitoring after 30 seconds
          setTimeout(() => {
            retryCount = 0;
            startContinuousMonitoring();
          }, 30000);
        }
      } catch (error) {
        console.error('[Coupang Collector] Error during monitoring:', error);
      }
    }, 4000); // Check every 4 seconds
  }

  // Monitor page content changes
  function setupPageObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (let node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || '';
              // If new elements might contain product info, mark for recheck
              if (text.includes('원') || text.includes('₩') ||
                  text.includes('평점') || text.includes('리뷰') ||
                  text.includes('브랜드') || text.includes('商品評價') ||
                  text.includes('%') || text.includes('할인')) {
                shouldRecheck = true;
                break;
              }
            }
          }
        }
      });
      
      if (shouldRecheck) {
        console.log('[Coupang Collector] Page content updated, recollecting data in 2 seconds');
        setTimeout(() => {
          collectData();
        }, 2000);
      }
    });
    
    // Start observing page changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Coupang Collector] Page change monitoring activated');
  }

  // Initialize function
  async function initialize() {
    console.log('[Coupang Collector] Initializing monitoring system...');
    
    // Wait for page load
    await waitForPageLoad();
    
    // Immediately try to collect data once
    setTimeout(() => {
      collectData();
    }, 2000);
    
    // Start continuous monitoring
    setTimeout(() => {
      startContinuousMonitoring();
    }, 5000);
    
    // Set up page change monitoring
    setupPageObserver();
  }

  // Execute initialization
  initialize();
})(); 