(function() {
  console.log("Coupang data collector started");
  
  // 安全的chrome.storage.local.get包装函数
  function safeStorageGet(keys, callback) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get(keys, function(result) {
          if (chrome.runtime.lastError) {
            console.warn("Extension context invalidated:", chrome.runtime.lastError.message);
            callback(null);
          } else {
            callback(result);
          }
        });
      } else {
        console.warn("Extension context invalidated, chrome.runtime not available");
        callback(null);
      }
    } catch (error) {
      console.error("Error accessing chrome.storage.local:", error);
      callback(null);
    }
  }
  
  // 安全的chrome.storage.local.set包装函数
  function safeStorageSet(data, callback) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set(data, function() {
          if (chrome.runtime.lastError) {
            console.warn("Extension context invalidated:", chrome.runtime.lastError.message);
            if (callback) callback(false);
          } else {
            if (callback) callback(true);
          }
        });
      } else {
        console.warn("Extension context invalidated, chrome.runtime not available");
        if (callback) callback(false);
      }
    } catch (error) {
      console.error("Error accessing chrome.storage.local:", error);
      if (callback) callback(false);
    }
  }
  
  // Extract Coupang data
  function extractCoupangData() {
    console.log("Starting to extract Coupang data...");
    
    return new Promise((resolve) => {
      const url = window.location.href;
      
      // Check if it's a Coupang category page
      if (!url.includes('tw.coupang.com/categories/')) {
        console.log("Not a Coupang category page");
        resolve(false);
        return;
      }
      
      // Check if it contains filterType=rocket parameter
      if (!url.includes('filterType=rocket')) {
        console.log("URL does not contain filterType=rocket parameter, skipping data extraction");
        resolve(false);
        return;
      }
      
      // Wait for page to load before extracting data
      setTimeout(() => {
      let l2Type = "";
      let l2Name = "";
      let brandCode = "";
      let brandName = "";
      let skuAmount = "";
      
      try {
        // 1. Extract L2 type - Extract category code from URL (save complete format)
        console.log(`Complete URL: ${url}`);
        
        // More precise regex to match category code
        const categoryMatch = url.match(/\/categories\/([^?&]+)/);
        if (categoryMatch && categoryMatch[1]) {
          l2Type = categoryMatch[1] + '?'; // Add ? mark, save complete format
          console.log(`L2 Type extraction successful: ${l2Type}`);
        } else {
          console.log('L2 Type extraction failed, trying other methods...');
          // Backup method: Extract directly from URL path
          const pathParts = url.split('/categories/');
          if (pathParts.length > 1) {
            const categoryPart = pathParts[1].split('?')[0];
            if (categoryPart) {
              l2Type = categoryPart + '?';
              console.log(`L2 Type backup method extraction: ${l2Type}`);
            }
          }
        }
        
        // 2. Extract L2 name - Extract from breadcrumb navigation
        const breadcrumbSelectors = [
          '.breadcrumb a:last-child',
          '.breadcrumb span:last-child',
          '.breadcrumb-item:last-child',
          '[data-testid="breadcrumb"] a:last-child',
          '.navigation-breadcrumb a:last-child'
        ];
        
        for (const selector of breadcrumbSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && element.textContent.trim() !== '酷澎首頁') {
            l2Name = element.textContent.trim();
            console.log(`L2 Name (breadcrumb): ${l2Name}`);
            break;
          }
        }
        
        // If breadcrumb not found, try extracting from page title
        if (!l2Name) {
          const titleSelectors = [
            'h1',
            '.category-title',
            '.page-title',
            '[data-testid="category-title"]'
          ];
          
          for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              l2Name = element.textContent.trim();
              console.log(`L2 Name (title): ${l2Name}`);
              break;
            }
          }
        }
        
        // 3. Extract Brand_code - Extract brand code from URL (save complete format)
        const brandMatch = url.match(/brand=(\d+)/);
        if (brandMatch && brandMatch[1]) {
          brandCode = `brand=${brandMatch[1]}&`; // Save complete format, e.g.: brand=42308&
          console.log(`Brand Code extraction successful: ${brandCode}`);
        } else {
          console.log('Brand Code extraction failed, URL may not contain brand parameter');
        }
        
        // 4. Extract Brand_name - Extract from filter options
        // Method 1: Find brand name after "篩選選項" text
        const pageText = document.body.innerText;
        console.log("Page text fragment:", pageText.substring(0, 1500)); // For debugging
        
        // Try multiple "篩選選項" matching patterns
        const filterPatterns = [
          /篩選選項[：:\s]*([^\n\r,]+)/,
          /篩選選項[：:\s]*(.+?)(?:\n|\r|清除|$)/,
          /篩選選項.*?([A-Za-z0-9\u4e00-\u9fff\s\-\.]+?)(?:\n|\r|清除|$)/,
          /篩選選項.*?品牌[：:\s]*([^\n\r,]+)/,
          /篩選選項.*?：\s*([^\n\r]+)/,
          /篩選選項\s*([^\n\r]+?)(?:\s*清除|\n|\r|$)/
        ];
        
        for (const pattern of filterPatterns) {
          const filterMatch = pageText.match(pattern);
          if (filterMatch && filterMatch[1]) {
            let extractedBrand = filterMatch[1].trim();
            
            // Clean up extracted brand name
            extractedBrand = extractedBrand.replace(/清除.*$/, '').trim();
            extractedBrand = extractedBrand.replace(/刪除/g, '').trim(); // Remove "刪除" text
            extractedBrand = extractedBrand.replace(/火箭速配/g, '').trim(); // Remove "火箭速配" text
            extractedBrand = extractedBrand.replace(/\s*\([^)]*\)$/, '').trim(); // Remove parentheses content
            
            // Filter out content that is obviously not a brand name
            if (extractedBrand.length > 0 && extractedBrand.length < 50 && 
                !extractedBrand.includes('清除') && 
                !extractedBrand.includes('篩選') &&
                !extractedBrand.includes('選項')) {
              brandName = extractedBrand;
              console.log(`Brand Name (from 篩選選項 pattern): "${brandName}"`);
              break;
            }
          }
        }
        
        // Method 2: If not found, try DOM selector method
        if (!brandName) {
          const brandSelectors = [
            '.filter-brand .selected',
            '.brand-filter .active',
            '.filter-option.selected[data-filter-type="brand"]',
            '.brand-checkbox:checked + label',
            '.filter-item.active .brand-name',
            '[data-testid="brand-filter"] .selected',
            '.sidebar-filter .brand .selected',
            '.selected-filter .brand-name',
            '.active-filter[data-type="brand"]',
            '.filter-tag .brand-name',
            '.applied-filter[data-type="brand"]'
          ];
          
          for (const selector of brandSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              brandName = element.textContent.trim().replace(/刪除/g, '').replace(/火箭速配/g, '').trim();
              console.log(`Brand Name (selector): ${brandName}`);
              break;
            }
          }
        }
        
        // Method 3: Find elements containing brand code from the page
        if (!brandName && brandCode) {
          // Extract numeric part from brandCode for search
          const brandNumberMatch = brandCode.match(/brand=(\d+)/);
          const brandNumber = brandNumberMatch ? brandNumberMatch[1] : '';
          
          if (brandNumber) {
            // Find links or elements containing brand parameter
            const allElements = document.querySelectorAll('*');
            for (const element of allElements) {
              const href = element.getAttribute('href') || '';
              const onclick = element.getAttribute('onclick') || '';
              const dataValue = element.getAttribute('data-value') || '';
              
              if (href.includes(`brand=${brandNumber}`) || onclick.includes(`brand=${brandNumber}`) || dataValue.includes(brandNumber)) {
                const text = element.textContent.trim().replace(/刪除/g, '').replace(/火箭速配/g, '').trim();
                if (text && text.length > 0 && text.length < 50 && !text.includes('http') && !text.includes('javascript')) {
                  brandName = text;
                  console.log(`Brand Name (from element with brand code): ${brandName}`);
                  break;
                }
              }
            }
          }
        }
        
        // Method 4: Last attempt to extract from brand-related elements on the page
        if (!brandName) {
          const brandElements = document.querySelectorAll('[data-brand], .brand-item, .filter-brand-item, .brand-label, .brand-name');
          for (const element of brandElements) {
            const text = element.textContent.trim().replace(/刪除/g, '').replace(/火箭速配/g, '').trim();
            if (text && (element.classList.contains('selected') || element.classList.contains('active') || element.classList.contains('current'))) {
              brandName = text;
              console.log(`Brand Name (from brand element): ${brandName}`);
              break;
            }
          }
        }
        
        // 5. Extract SKU quantity - Only extract when SKU function is enabled
        // Check if SKU function is enabled
        try {
          safeStorageGet(['skuEnabled'], function(result) {
            if (result !== null && result.skuEnabled) {
              // Method 1: Calculate from pagination information
              const paginationElements = document.querySelectorAll(
                '.pagination, .paging, .page-info, .total-count, .result-count, ' +
                '[class*="page"], [class*="Page"], [class*="total"], [class*="Total"], ' +
                '[class*="count"], [class*="Count"], [class*="result"], [class*="Result"]'
              );
              
              for (const element of paginationElements) {
                const text = element.textContent.trim();
                
                // Find text like "Page 1, 123 products in total"
                const totalMatch = text.match(/共\s*(\d+)\s*个|總共\s*(\d+)\s*個|total\s*(\d+)/i);
                if (totalMatch) {
                  skuAmount = totalMatch[1] || totalMatch[2] || totalMatch[3];
                  console.log(`SKU Amount (from pagination): ${skuAmount}`);
                  break;
                }
              }
              
              // Method 2: Calculate product count and pages on the page
              if (!skuAmount) {
                const currentPageProducts = document.querySelectorAll('.search-product, .product-item, [class*="product"]').length;
                
                // Find the last page number
                const paginationLinks = document.querySelectorAll('.pagination a, .paging a, [class*="page"] a');
                let maxPage = 1;
                
                for (const link of paginationLinks) {
                  const pageText = link.textContent.trim();
                  const pageNumber = parseInt(pageText);
                  if (!isNaN(pageNumber) && pageNumber > maxPage) {
                    maxPage = pageNumber;
                  }
                }
                
                if (currentPageProducts > 0 && maxPage > 1) {
                  skuAmount = (currentPageProducts * maxPage).toString();
                  console.log(`SKU Amount (estimated): ${skuAmount} (${currentPageProducts} products × ${maxPage} pages)`);
                }
              }
              
              // Method 3: Get listSize from URL parameters and estimate
              if (!skuAmount) {
                const urlParams = new URLSearchParams(window.location.search);
                const listSize = parseInt(urlParams.get('listSize')) || 20;
                const currentPageProducts = document.querySelectorAll('.search-product, .product-item, [class*="product"]').length;
                
                // If current page has fewer products than listSize, this is the last page
                if (currentPageProducts > 0 && currentPageProducts < listSize) {
                  skuAmount = currentPageProducts.toString();
                  // Estimate total (this method is not accurate enough, but can be used as alternative)
                  console.log(`SKU Amount (last page estimate): ${skuAmount}`);
                } else if (currentPageProducts >= listSize) {
                  // If it's a full page, at least equal to listSize
                  skuAmount = (listSize * 2).toString(); // Conservative estimate
                  console.log(`SKU Amount (conservative estimate): ${skuAmount}`);
                }
              }
            }
          });
        } catch (error) {
          console.error("Error accessing chrome.storage.local:", error);
        }
        
        console.log("Final extraction results:");
        console.log("L2 Type:", l2Type);
        console.log("L2 Name:", l2Name);
        console.log("Brand Code:", brandCode);
        console.log("Brand Name:", brandName);
        console.log("SKU Amount:", skuAmount);
        
        // Save data only if required fields are available
        if (l2Type && brandCode) {
          console.log("📝 準備保存數據，調用saveCoupangData...");
          console.log("參數:", { l2Type, l2Name, brandCode, brandName, skuAmount });
          saveCoupangData(l2Type, l2Name, brandCode, brandName, skuAmount);
          resolve(true);
        } else {
          console.log("Data extraction incomplete, missing required fields");
          resolve(false);
        }
        
      } catch (error) {
        console.error("Error during data extraction:", error);
        resolve(false);
      }
      }, 3000); // Wait 3 seconds for page to load
    });
  }
  
  // Check existing data status
  function checkExistingDataStatus(brandCode) {
    return new Promise((resolve) => {
      try {
        safeStorageGet(['coupangData'], function(result) {
          if (result !== null) {
            const data = result.coupangData || [];
            const existingItem = data.find(item => item.brandCode === brandCode);
            resolve(existingItem);
          } else {
            console.warn("Extension context invalidated, unable to check existing data");
            resolve(null);
          }
        });
      } catch (error) {
        console.error("Error accessing chrome.storage.local:", error);
        resolve(null);
      }
    });
  }
  
  // SKU statistics function - Automatic continuous counting across multiple pages
  async function countSKUCurrentPage() {
    console.log('=== Starting automatic SKU statistics ===');
    
    // Check if SKU function is enabled
    const skuEnabled = await new Promise(resolve => {
      safeStorageGet(['skuEnabled'], function(result) {
        if (result !== null) {
          resolve(result.skuEnabled || false);
        } else {
          console.warn("Extension context invalidated, unable to check SKU enabled status");
          resolve(false);
        }
      });
    });
    
    if (!skuEnabled) {
      console.log('SKU statistics function not enabled, skipping statistics');
      return {
        message: 'SKU statistics function not enabled, please enable this function in the popup',
        error: true
      };
    }
    
    const currentUrl = window.location.href;
    console.log('Current URL:', currentUrl);
    
    // Check if contains filterType=rocket parameter
    if (!currentUrl.includes('filterType=rocket')) {
      console.log('URL does not contain filterType=rocket parameter, skipping SKU statistics');
      return {
        message: 'URL does not contain filterType=rocket parameter, unable to perform SKU statistics',
        error: true
      };
    }
    
    // Use the same logic as basic data extraction
    const brandMatch = currentUrl.match(/brand=(\d+)/);
    const currentBrandCode = brandMatch ? `brand=${brandMatch[1]}&` : '';
    console.log('Extracted brand code:', currentBrandCode);
    
    if (!currentBrandCode) {
      console.warn('Warning: Unable to extract brand code from URL, URL format may be incorrect');
      return {
        message: 'Unable to extract brand code from URL',
        error: true
      };
    }
    
    // Check SKU statistics status of current data item
    console.log('Checking data item status...');
    const existingData = await checkExistingDataStatus(currentBrandCode);
    console.log('Existing data status:', existingData);
    
    // Only skip when SKU statistics is already completed (check if inStockCount and outOfStockCount exist)
    if (existingData && existingData.inStockCount !== undefined && existingData.outOfStockCount !== undefined) {
      console.log('SKU statistics for current data item already completed, skipping statistics');
      console.log(`Existing SKU data: In stock ${existingData.inStockCount}, Out of stock ${existingData.outOfStockCount}`);
      return { 
        message: `SKU statistics completed: ${existingData.inStockCount} in stock, ${existingData.outOfStockCount} out of stock`,
        isComplete: true 
      };
    } else {
      console.log('SKU statistics not yet completed, can start statistics');
    }
    
    // Get or initialize statistics data
    console.log('Getting statistics data...');
    let skuStats = JSON.parse(localStorage.getItem('skuCountingStats') || '{"totalInStock": 0, "totalOutOfStock": 0, "currentPage": 1, "brandCode": ""}');
    console.log('Current statistics data:', skuStats);
    
    // Clear any completed flags
    if (skuStats.isCompleted) {
      console.log("Clearing previous completed SKU statistics flag");
      localStorage.removeItem('skuCountingStats');
      skuStats = {"totalInStock": 0, "totalOutOfStock": 0, "currentPage": 1, "brandCode": ""};
    }
    
    // If it's a new brand or first time statistics, reset data and start from first page
    if (skuStats.brandCode !== currentBrandCode) {
      console.log('New brand or first time statistics, resetting data');
      skuStats = {
        totalInStock: 0,
        totalOutOfStock: 0,
        currentPage: 1,
        brandCode: currentBrandCode,
        isRunning: true,
        isCompleted: false
      };
      
      // Save initial state
      localStorage.setItem('skuCountingStats', JSON.stringify(skuStats));
      console.log('Saved initial statistics state');
      
      // If current page is not first page, jump to first page to start statistics
      const currentPageMatch = currentUrl.match(/page=(\d+)/);
      const currentPageNum = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
      console.log('Current page number:', currentPageNum);
      
      if (currentPageNum !== 1) {
        const cleanBaseUrl = currentUrl.replace(/page=\d+/, '').replace(/&$/, '');
        const separator = cleanBaseUrl.includes('?') ? '&' : '?';
        const firstPageUrl = `${cleanBaseUrl}${separator}page=1`;
        
        console.log(`Currently on page ${currentPageNum}, jumping to first page to start statistics: ${firstPageUrl}`);
        window.location.href = firstPageUrl;
        return {
          message: 'Jumping to first page to start statistics',
          isRunning: true
        };
      }
    } else {
      console.log('Continuing statistics for existing brand');
    }
    
    // Start counting current page
    console.log('Starting to process current page...');
    try {
      await processCurrentPageAndContinue(skuStats, currentUrl);
      console.log('Page processing completed');
    } catch (error) {
      console.error('Page processing error:', error);
    }
    
    return {
      message: 'Automatic statistics started',
      isRunning: true
    };
  }
  
  // Process current page and continue statistics
  async function processCurrentPageAndContinue(skuStats, baseUrl) {
    console.log(`Counting page ${skuStats.currentPage}...`);
    
    // Wait for page to load completely
    await waitForPageLoad();
    
    // Count current page
    const pageStats = countCurrentPage();
    
    // Check if reached the last page
    if (pageStats.isLastPage) {
      console.log('Detected "沒有此類產品", statistics completed');
      
      // Save final results
      await saveSkuResults(skuStats.totalInStock, skuStats.totalOutOfStock, skuStats.brandCode);
      
      // Set completion flag and clear statistics data
      skuStats.isCompleted = true;
      localStorage.setItem('skuCountingStats', JSON.stringify(skuStats));
      
      // Delayed clear to ensure monitoring system can detect completion flag
      setTimeout(() => {
        localStorage.removeItem('skuCountingStats');
        console.log("SKU statistics data cleared");
      }, 5000);
      
      console.log(`Statistics completed! Total in stock: ${skuStats.totalInStock}, out of stock: ${skuStats.totalOutOfStock}`);
      console.log("Monitoring system will stop automatically, you can now freely browse other pages");
      return;
    }
    
    // Accumulate data
    skuStats.totalInStock += pageStats.inStock;
    skuStats.totalOutOfStock += pageStats.outOfStock;
    
    console.log(`Page ${skuStats.currentPage} statistics completed - This page in stock: ${pageStats.inStock}, out of stock: ${pageStats.outOfStock}`);
    console.log(`Cumulative - In stock: ${skuStats.totalInStock}, out of stock: ${skuStats.totalOutOfStock}`);
    
    // Prepare next page
    skuStats.currentPage++;
    
    // Save progress
    localStorage.setItem('skuCountingStats', JSON.stringify(skuStats));
    
    // Build next page URL
    const cleanBaseUrl = baseUrl.replace(/page=\d+/, '').replace(/&$/, '');
    const separator = cleanBaseUrl.includes('?') ? '&' : '?';
    const nextPageUrl = `${cleanBaseUrl}${separator}page=${skuStats.currentPage}`;
    
    console.log(`Preparing to jump to page ${skuStats.currentPage}: ${nextPageUrl}`);
    
    // Delayed jump to ensure data is saved
    setTimeout(() => {
      window.location.href = nextPageUrl;
    }, 1000);
  }
  
  // 等待页面加载完成
  function waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 2000); // 额外等待2秒确保内容加载
      } else {
        const checkLoaded = () => {
          if (document.readyState === 'complete') {
            setTimeout(resolve, 2000);
          } else {
            setTimeout(checkLoaded, 500);
          }
        };
        checkLoaded();
      }
    });
  }
  
  // 统计当前页面
  function countCurrentPage() {
    console.log('开始统计当前页面...');
    const pageText = document.body.innerText;
    
    // 检查是否到达最后一页（没有产品）
    const noProductsFound = pageText.includes('沒有此類產品') || pageText.includes('没有此类产品');
    if (noProductsFound) {
      console.log('检测到"沒有此類產品"，已到达最后一页');
      return { inStock: 0, outOfStock: 0, isLastPage: true };
    }
    
    // 统计"信用卡"出现次数（有库存商品）
    const creditCardMatches = pageText.match(/信用卡/g);
    const inStockCount = creditCardMatches ? creditCardMatches.length : 0;
    
    // 统计"暂时缺货"出现次数（无库存商品）
    const outOfStockMatches = pageText.match(/暫時缺貨|暂时缺货/g);
    const outOfStockCount = outOfStockMatches ? outOfStockMatches.length : 0;
    
    console.log(`当前页面统计结果 - 有库存: ${inStockCount}, 无库存: ${outOfStockCount}`);
    
    // 如果两个都是0，可能页面还没加载完成或者格式有变化
    if (inStockCount === 0 && outOfStockCount === 0) {
      console.warn('警告：当前页面没有检测到任何商品，可能页面还在加载或格式有变化');
      console.log('页面文本片段:', pageText.substring(0, 500));
    }
    
    return { inStock: inStockCount, outOfStock: outOfStockCount, isLastPage: false };
  }
  
  // 保存SKU统计结果
  function saveSkuResults(inStockCount, outOfStockCount, brandCode) {
    return new Promise((resolve) => {
      try {
        safeStorageGet(['coupangData'], function(result) {
          if (result !== null) {
            let data = result.coupangData || [];
            
            // 查找匹配的数据项
            const existingIndex = data.findIndex(item => 
              item.brandCode === brandCode || item.url === window.location.href
            );
            
            if (existingIndex !== -1) {
              const originalItem = data[existingIndex];
              
              // 检查原始数据是否已完成，如果是则保护数据不被空值覆盖
              const isOriginalCompleted = originalItem.status === '已完成';
              const hasExistingSkuData = originalItem.inStockCount !== undefined && originalItem.outOfStockCount !== undefined;
              
              // 只有在原始数据未完成或新数据不为空时才更新SKU字段
              if (!isOriginalCompleted || !hasExistingSkuData || (inStockCount > 0 || outOfStockCount > 0)) {
                data[existingIndex].inStockCount = inStockCount;
                data[existingIndex].outOfStockCount = outOfStockCount;
                data[existingIndex].skuAmount = (inStockCount + outOfStockCount).toString();
                data[existingIndex].timestamp = Date.now();
                
                // 保持原有状态，如果基本数据已完成就保持"已完成"，否则根据数据完整性设置状态
                if (!data[existingIndex].status || data[existingIndex].status === '等待收集') {
                  // 检查基本数据是否完整
                  const hasBasicData = data[existingIndex].l2Type && data[existingIndex].brandCode && data[existingIndex].l2Name && data[existingIndex].brandName;
                  data[existingIndex].status = hasBasicData ? '已完成' : '数据不完整';
                }
                // 如果状态已经是"已完成"，保持不变
                
                safeStorageSet({ coupangData: data }, function() {
                  console.log(`SKU统计结果已保存: 有库存${inStockCount}个, 无库存${outOfStockCount}个${isOriginalCompleted && hasExistingSkuData ? ' [数据保护]' : ''}`);
                  console.log(`数据项状态: ${data[existingIndex].status}`);
                  resolve();
                });
              } else {
                console.log('SKU数据已完成，跳过更新 [数据保护]');
                resolve();
              }
            } else {
              console.log('未找到匹配的数据项，无法保存SKU统计结果');
              resolve();
            }
          } else {
            console.warn("Extension context invalidated, unable to save SKU results");
            resolve();
          }
        });
      } catch (error) {
        console.error("Error accessing chrome.storage.local:", error);
        resolve();
      }
    });
  }
  


  // 保存酷澎数据 - 簡化版本
  function saveCoupangData(l2Type, l2Name, brandCode, brandName, skuAmount) {
    console.log("🚀 開始保存數據到Progress Management...");
    console.log("📋 數據:", { l2Type, l2Name, brandCode, brandName, skuAmount });
    
    // 創建數據對象
    const newData = {
      l2Type: l2Type,
      l2Name: l2Name,
      brandCode: brandCode,
      brandName: brandName,
      timestamp: Date.now(),
      url: window.location.href,
      status: 'Completed'  // popup.js期望的英文狀態
    };
    
    // 如果有SKU數據就添加
    if (skuAmount) {
      newData.skuAmount = skuAmount;
    }
    
    // 簡單直接的保存方式
    try {
      chrome.storage.local.get(['coupangData'], function(result) {
        if (chrome.runtime.lastError) {
          console.error("⚠️ Chrome storage error:", chrome.runtime.lastError);
          // 使用localStorage作為備用
          saveToLocalStorageBackup();
          return;
        }
        
                 let data = result.coupangData || [];
         console.log("📊 當前已有數據:", data.length, "項");
         
         // 檢查是否已存在相同的Brand Name
         const existingItem = data.find(item => 
           item.brandName === brandName && item.l2Name === l2Name
         );
         
         if (existingItem) {
           console.warn("⚠️ 重複數據警告!");
           console.log(`❌ 已存在相同的品牌: "${brandName}" 在分類 "${l2Name}"`);
           console.log("🔍 現有數據:", existingItem);
           console.log("📝 跳過新增，避免重複數據");
           return; // 跳過添加
         }
         
         // 添加新數據
         data.push(newData);
         console.log("✅ 新增數據:", newData);
        
        // 保存回storage
        chrome.storage.local.set({ coupangData: data }, function() {
          if (chrome.runtime.lastError) {
            console.error("⚠️ 保存失敗:", chrome.runtime.lastError);
            saveToLocalStorageBackup();
                     } else {
             console.log("🎉 數據成功保存到Progress Management！");
             console.log("📈 現在總共有", data.length, "項數據");
             console.log(`✨ 新增品牌: "${brandName}" 在分類 "${l2Name}"`);
           }
        });
      });
    } catch (error) {
      console.error("💥 保存過程中出錯:", error);
      saveToLocalStorageBackup();
    }
    
    // 備用保存方案
    function saveToLocalStorageBackup() {
      console.log("🔄 使用localStorage備用方案");
      const backupData = JSON.parse(localStorage.getItem('coupangDataBackup') || '[]');
      backupData.push(newData);
      localStorage.setItem('coupangDataBackup', JSON.stringify(backupData));
      console.log("💾 數據已保存到備用存儲，請重新載入擴展");
    }
  }
  
  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractCoupangData") {
      console.log("收到popup请求提取酷澎数据");
      
      const url = window.location.href;
      if (url.includes("tw.coupang.com/categories/")) {
        console.log("检测到酷澎分类页面，提取数据");
        sendResponse({success: true});
        
        setTimeout(() => {
          extractCoupangData();
        }, 500);
        
        return true;
      } else {
        console.log("不是酷澎分类页面");
        sendResponse({success: false});
      }
    } else if (request.action === "countSKU") {
      console.log("收到popup请求统计SKU");
      
      const url = window.location.href;
      console.log("当前页面URL:", url);
      
      if (url.includes("tw.coupang.com/categories/")) {
        console.log("检测到酷澎分类页面，开始SKU统计");
        sendResponse({success: true});
        
        setTimeout(async () => {
          try {
            console.log("开始执行countSKUCurrentPage函数...");
            const result = await countSKUCurrentPage();
            console.log("countSKUCurrentPage执行结果:", result);
          } catch (error) {
            console.error("countSKUCurrentPage执行出错:", error);
          }
        }, 500);
        
        return true;
      } else {
        console.log("不是酷澎分类页面");
        sendResponse({success: false});
      }
    }
    return true;
  });
  
  // 检查是否有正在进行的SKU统计
  function checkAndContinueSKUCounting() {
    const skuStats = JSON.parse(localStorage.getItem('skuCountingStats') || '{}');
    if (skuStats.isRunning && skuStats.brandCode) {
      const currentUrl = window.location.href;
      const brandMatch = currentUrl.match(/brand=(\d+)/);
      const currentBrandCode = brandMatch ? `brand=${brandMatch[1]}&` : '';
      
      // 如果品牌代码匹配，继续统计
      if (currentBrandCode === skuStats.brandCode) {
        console.log('检测到正在进行的SKU统计，继续统计...');
        setTimeout(() => {
          processCurrentPageAndContinue(skuStats, currentUrl);
        }, 3000); // 等待页面完全加载
        return true;
      }
    }
    return false;
  }
  
  // 自动检测和处理函数
  async function autoDetectAndProcess() {
    console.log("=== 自动检测和处理开始 ===");
    
    // 检查URL是否包含filterType=rocket参数
    const currentUrl = window.location.href;
    if (!currentUrl.includes('filterType=rocket')) {
      console.log("URL不包含filterType=rocket参数，跳过自动处理");
      return;
    }
    
    // 首先检查是否有正在进行的SKU统计
    const isContinuingSKU = checkAndContinueSKUCounting();
    if (isContinuingSKU) {
      console.log("检测到正在进行的SKU统计，继续统计流程");
      return;
    }
    
    // 提取当前页面的基本数据
    console.log("开始提取当前页面数据...");
    await extractCoupangData();
    
    // 等待数据提取完成后，检查是否需要自动开始SKU统计
    setTimeout(async () => {
      await checkAndAutoStartSKU();
    }, 2000);
  }
  
  // 检查并自动开始SKU统计
  async function checkAndAutoStartSKU() {
    console.log("检查是否需要自动开始SKU统计...");
    
    // 检查SKU功能是否启用
    const skuEnabled = await new Promise(resolve => {
      safeStorageGet(['skuEnabled'], function(result) {
        if (result !== null) {
          resolve(result.skuEnabled || false);
        } else {
          console.warn("Extension context invalidated, skipping SKU check");
          resolve(false);
        }
      });
    });
    
    if (!skuEnabled) {
      console.log("SKU统计功能未启用，跳过自动SKU统计");
      return;
    }
    
    const currentUrl = window.location.href;
    const brandMatch = currentUrl.match(/brand=(\d+)/);
    const currentBrandCode = brandMatch ? `brand=${brandMatch[1]}&` : '';
    
    if (!currentBrandCode) {
      console.log("没有品牌代码，跳过自动SKU统计");
      return;
    }
    
    // 检查当前数据项状态
    const existingData = await checkExistingDataStatus(currentBrandCode);
    console.log("当前数据项状态:", existingData);
    
    if (existingData && existingData.status === '已完成') {
      // 检查是否已有SKU统计数据
      if (existingData.inStockCount !== undefined && existingData.outOfStockCount !== undefined) {
        console.log("SKU统计已完成，无需重复统计");
        console.log(`已有SKU数据: 有库存${existingData.inStockCount}, 无库存${existingData.outOfStockCount}`);
      } else {
        console.log("基本数据已完成，立即开始SKU统计...");
        
        // 立即开始统计，无需等待和提示
        try {
          await countSKUCurrentPage();
          console.log("自动SKU统计已启动");
        } catch (error) {
          console.error("自动SKU统计启动失败:", error);
        }
      }
    } else {
      console.log("基本数据未完成，等待数据提取完成");
    }
  }
  

  
  // 持续监控页面变化
  function startContinuousMonitoring() {
    console.log("开始持续监控页面变化...");
    
    let lastUrl = window.location.href;
    let lastBrandCode = '';
    let monitoringInterval = null;
    
    // 提取当前品牌代码
    const extractCurrentBrandCode = () => {
      const brandMatch = window.location.href.match(/brand=(\d+)/);
      return brandMatch ? `brand=${brandMatch[1]}&` : '';
    };
    
    lastBrandCode = extractCurrentBrandCode();
    
    // 停止监控的函数
    window.stopCoupangMonitoring = () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log("酷澎监控已停止");
      }
    };
    
    // 每2秒检查一次URL和页面变化
    monitoringInterval = setInterval(async () => {
      const currentUrl = window.location.href;
      const currentBrandCode = extractCurrentBrandCode();
      
      // 检查是否已经不在酷澎网站或分类页面
      if (!currentUrl.includes('tw.coupang.com/categories/')) {
        console.log("已离开酷澎分类页面，停止监控");
        window.stopCoupangMonitoring();
        return;
      }
      
      // 检查是否有已完成的SKU统计状态
      const skuStats = JSON.parse(localStorage.getItem('skuCountingStats') || '{}');
      if (skuStats.isCompleted) {
        console.log("检测到SKU统计已完成标记，停止监控");
        localStorage.removeItem('skuCountingStats');
        window.stopCoupangMonitoring();
        return;
      }
      
      // 检查URL是否发生变化
      if (currentUrl !== lastUrl) {
        console.log("检测到URL变化:", currentUrl);
        lastUrl = currentUrl;
        
        // 只有包含filterType=rocket的URL才进行处理
        if (currentUrl.includes('filterType=rocket')) {
          // URL变化后延迟处理，等待页面加载
          setTimeout(() => {
            autoDetectAndProcess();
          }, 2000);
        } else {
          console.log("URL不包含filterType=rocket参数，跳过处理");
        }
      }
      
      // 检查品牌代码是否发生变化
      else if (currentBrandCode !== lastBrandCode && currentBrandCode) {
        console.log("检测到品牌代码变化:", currentBrandCode);
        lastBrandCode = currentBrandCode;
        
        // 只有包含filterType=rocket的URL才进行处理
        if (currentUrl.includes('filterType=rocket')) {
          // 品牌变化后延迟处理
          setTimeout(() => {
            autoDetectAndProcess();
          }, 1500);
        } else {
          console.log("URL不包含filterType=rocket参数，跳过品牌变化处理");
        }
      }
      
      // 即使URL没变化，也定期检查页面内容是否已加载完成
      else if (currentBrandCode && document.readyState === 'complete' && currentUrl.includes('filterType=rocket')) {
        // 检查页面是否有新的品牌筛选内容
        const pageText = document.body.innerText;
        if (pageText.includes('篩選選項') || pageText.includes('品牌')) {
          // 页面内容已加载，可以进行数据提取
          const hasRecentExtraction = localStorage.getItem('lastExtractionTime');
          const now = Date.now();
          
          // 如果距离上次提取超过10秒，重新提取
          if (!hasRecentExtraction || (now - parseInt(hasRecentExtraction)) > 10000) {
            console.log("页面内容已加载完成，重新提取数据");
            localStorage.setItem('lastExtractionTime', now.toString());
            autoDetectAndProcess();
          }
        }
      }
    }, 2000);
  }
  
  // 添加手動停止函數供用戶使用
  window.forceStopCoupangMonitoring = () => {
    // 清除所有相關的localStorage數據
    localStorage.removeItem('skuCountingStats');
    localStorage.removeItem('lastExtractionTime');
    
    // 停止監控
    if (window.stopCoupangMonitoring) {
      window.stopCoupangMonitoring();
    }
    
    console.log("已強制停止酷澎監控系統");
    alert("酷澎監控系統已停止，您現在可以自由瀏覽其他頁面");
  };

  // 从localStorage恢复备用数据
  function restoreBackupData() {
    console.log("检查是否有备用数据需要恢复...");
    
    try {
      const backupData = localStorage.getItem('coupangDataBackup');
      if (backupData) {
        const data = JSON.parse(backupData);
        if (data.length > 0) {
          console.log(`发现 ${data.length} 条备用数据，开始恢复...`);
          
          // 获取现有数据
          safeStorageGet(['coupangData'], function(result) {
            if (result !== null) {
              const existingData = result.coupangData || [];
              
              // 合并备用数据
              data.forEach(backupItem => {
                const existingIndex = existingData.findIndex(item => 
                  (item.l2Name === backupItem.l2Name && item.brandName === backupItem.brandName) ||
                  item.url === backupItem.url ||
                  (item.l2Type === backupItem.l2Type && item.brandCode === backupItem.brandCode)
                );
                
                if (existingIndex !== -1) {
                  // 更新现有数据
                  existingData[existingIndex] = { ...existingData[existingIndex], ...backupItem };
                  console.log(`恢复并更新数据: ${backupItem.l2Name} - ${backupItem.brandName}`);
                } else {
                  // 添加新数据
                  existingData.push(backupItem);
                  console.log(`恢复新数据: ${backupItem.l2Name} - ${backupItem.brandName}`);
                }
              });
              
              // 保存合并后的数据
              safeStorageSet({ coupangData: existingData }, function(success) {
                if (success) {
                  console.log("备用数据恢复成功");
                  // 清除备用数据
                  localStorage.removeItem('coupangDataBackup');
                  console.log("已清除localStorage备用数据");
                } else {
                  console.warn("备用数据恢复失败，保留localStorage数据");
                }
              });
            } else {
              console.warn("无法访问chrome.storage.local，备用数据保留");
            }
          });
        }
      }
    } catch (error) {
      console.error("恢复备用数据时出错:", error);
    }
  }
  
  // 初始化函数
  function init() {
    console.log("酷澎数据收集脚本已启动");
    console.log("如需手動停止監控，請在控制台輸入: forceStopCoupangMonitoring()");
    
    // 首先尝试恢复备用数据
    restoreBackupData();
    
    // 检查是否为酷澎分类页面
    if (window.location.href.includes("tw.coupang.com/categories/")) {
      console.log("检测到酷澎分类页面");
      
      // 检查是否包含filterType=rocket参数
      if (window.location.href.includes('filterType=rocket')) {
        console.log("检测到filterType=rocket参数，启动自动化功能");
        
        // 开始自动检测和处理
        autoDetectAndProcess();
        
        // 启动持续监控
        startContinuousMonitoring();
      } else {
        console.log("URL不包含filterType=rocket参数，脚本将保持待机状态");
        // 仍然启动监控，以便在URL变化时能够检测到filterType=rocket
        startContinuousMonitoring();
      }
    } else {
      console.log("不是酷澎分类页面，脚本不会运行");
    }
  }
  
  // 启动脚本
  init();
})(); 