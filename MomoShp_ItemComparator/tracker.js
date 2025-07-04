document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const productTableBody = document.getElementById('productTableBody');
  const exportTextarea = document.getElementById('exportTextarea');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const copyToClipboardBtn = document.getElementById('copyToClipboardBtn');
  const statusMessage = document.getElementById('statusMessage');
  const tidListInput = document.getElementById('tidListInput');
  const processTidListBtn = document.getElementById('processTidListBtn');
  const shopeeUrlListInput = document.getElementById('shopeeUrlListInput');
  const processShopeeUrlListBtn = document.getElementById('processShopeeUrlListBtn');
  
  // Auto-open MOMO links elements
  const startAutoOpenBtn = document.getElementById('startAutoOpenBtn');
  const stopAutoOpenBtn = document.getElementById('stopAutoOpenBtn');
  const delayInput = document.getElementById('delay');
  const progressInfo = document.getElementById('progressInfo');
  const currentUrl = document.getElementById('currentUrl');
  
  // Auto-open Shopee links elements
  const startShopeeAutoOpenBtn = document.getElementById('startShopeeAutoOpenBtn');
  const stopShopeeAutoOpenBtn = document.getElementById('stopShopeeAutoOpenBtn');
  const shopeeDelayInput = document.getElementById('shopeeDelay');
  const shopeeProgressInfo = document.getElementById('shopeeProgressInfo');
  const shopeeCurrentUrl = document.getElementById('shopeeCurrentUrl');
  
  // Auto-open links variables for MOMO
  let isOpeningLinks = false;
  let openLinksTimeout = null;
  let currentIndex = 0;
  let linksToOpen = [];
  
  // Auto-open links variables for Shopee
  let isOpeningShopeeLinks = false;
  let openShopeeLinksTimeout = null;
  let currentShopeeIndex = 0;
  let shopeeLinksToOpen = [];
  
  // Store TID list and Shopee URL list
  let orderedTidList = [];
  let orderedShopeeUrlList = [];
  
  // Load product data and display
  loadProductData();
  
  // Bind button events
  clearDataBtn.addEventListener('click', clearAllData);
  exportDataBtn.addEventListener('click', exportDataToText);
  copyToClipboardBtn.addEventListener('click', copyDataToClipboard);
  processTidListBtn.addEventListener('click', processTidList);
  processShopeeUrlListBtn.addEventListener('click', processShopeeUrlList);
  startAutoOpenBtn.addEventListener('click', startAutoOpen);
  stopAutoOpenBtn.addEventListener('click', stopAutoOpen);
  startShopeeAutoOpenBtn.addEventListener('click', startShopeeAutoOpen);
  stopShopeeAutoOpenBtn.addEventListener('click', stopShopeeAutoOpen);
  
  // Listen for messages from background.js for real-time updates
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateProductData") {
      // Reload data for MOMO updates
      loadProductData();
      
      // Show status message
      showStatusMessage("MOMO data updated successfully");
    }
    
    if (request.action === "shopeeDataUpdated") {
      // Reload data for Shopee updates
      loadProductData();
      
      // Show status message
      showStatusMessage("Shopee data updated successfully");
    }
  });
  
  // Auto-open MOMO links functions
  function startAutoOpen() {
    if (orderedTidList.length === 0) {
      showStatusMessage("Please process MOMO TID list first", "error");
      return;
    }
    
    if (isOpeningLinks) {
      showStatusMessage("Already opening MOMO links", "error");
      return;
    }
    
    // Get delay from input (seconds to milliseconds)
    const delay = parseInt(delayInput.value, 10) * 1000 || 5000;
    
    // Setup links to open
    linksToOpen = orderedTidList.slice(); // Make a copy
    currentIndex = 0;
    isOpeningLinks = true;
    
    // Update UI
    startAutoOpenBtn.style.display = 'none';
    stopAutoOpenBtn.style.display = 'inline-block';
    progressInfo.style.display = 'block';
    progressInfo.textContent = `Opening MOMO link 1 of ${linksToOpen.length}...`;
    
    // Start opening links
    openNextLink(delay);
    
    showStatusMessage("Started opening MOMO links");
  }
  
  function stopAutoOpen() {
    if (!isOpeningLinks) {
      return;
    }
    
    // Clear timeout if any
    if (openLinksTimeout) {
      clearTimeout(openLinksTimeout);
      openLinksTimeout = null;
    }
    
    // Reset state
    isOpeningLinks = false;
    
    // Update UI
    startAutoOpenBtn.style.display = 'inline-block';
    stopAutoOpenBtn.style.display = 'none';
    progressInfo.style.display = 'none';
    currentUrl.style.display = 'none';
    
    showStatusMessage("Stopped opening MOMO links");
  }
  
  function openNextLink(delay) {
    if (!isOpeningLinks || currentIndex >= linksToOpen.length) {
      // All links opened or stopped
      stopAutoOpen();
      
      if (currentIndex >= linksToOpen.length) {
        showStatusMessage("Finished opening all MOMO links");
      }
      
      return;
    }
    
    // Get current TID
    const tid = linksToOpen[currentIndex];
    
    // Create URL
    const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`;
    
    // Update UI
    progressInfo.textContent = `Opening MOMO link ${currentIndex + 1} of ${linksToOpen.length}...`;
    currentUrl.textContent = url;
    currentUrl.style.display = 'block';
    
    // Open URL
    chrome.tabs.create({ url: url }, function(tab) {
      console.log(`Opened tab for MOMO: ${url}`);
      
      // Move to next link
      currentIndex++;
      
      // Schedule next link
      openLinksTimeout = setTimeout(function() {
        openNextLink(delay);
      }, delay);
    });
  }
  
  // Auto-open Shopee links functions
  function startShopeeAutoOpen() {
    if (orderedShopeeUrlList.length === 0) {
      showStatusMessage("Please process Shopee URL list first", "error");
      return;
    }
    
    if (isOpeningShopeeLinks) {
      showStatusMessage("Already opening Shopee links", "error");
      return;
    }
    
    // Get delay from input (seconds to milliseconds)
    const delay = parseInt(shopeeDelayInput.value, 10) * 1000 || 5000;
    
    // Setup links to open
    shopeeLinksToOpen = orderedShopeeUrlList.slice(); // Make a copy
    currentShopeeIndex = 0;
    isOpeningShopeeLinks = true;
    
    // Update UI
    startShopeeAutoOpenBtn.style.display = 'none';
    stopShopeeAutoOpenBtn.style.display = 'inline-block';
    shopeeProgressInfo.style.display = 'block';
    shopeeProgressInfo.textContent = `Opening Shopee link 1 of ${shopeeLinksToOpen.length}...`;
    
    // Start opening links
    openNextShopeeLink(delay);
    
    showStatusMessage("Started opening Shopee links");
  }
  
  function stopShopeeAutoOpen() {
    if (!isOpeningShopeeLinks) {
      return;
    }
    
    // Clear timeout if any
    if (openShopeeLinksTimeout) {
      clearTimeout(openShopeeLinksTimeout);
      openShopeeLinksTimeout = null;
    }
    
    // Reset state
    isOpeningShopeeLinks = false;
    
    // Update UI
    startShopeeAutoOpenBtn.style.display = 'inline-block';
    stopShopeeAutoOpenBtn.style.display = 'none';
    shopeeProgressInfo.style.display = 'none';
    shopeeCurrentUrl.style.display = 'none';
    
    showStatusMessage("Stopped opening Shopee links");
  }
  
  function openNextShopeeLink(delay) {
    if (!isOpeningShopeeLinks || currentShopeeIndex >= shopeeLinksToOpen.length) {
      // All links opened or stopped
      stopShopeeAutoOpen();
      
      if (currentShopeeIndex >= shopeeLinksToOpen.length) {
        showStatusMessage("Finished opening all Shopee links");
      }
      
      return;
    }
    
    // Get current URL
    const url = shopeeLinksToOpen[currentShopeeIndex];
    
    // Update UI
    shopeeProgressInfo.textContent = `Opening Shopee link ${currentShopeeIndex + 1} of ${shopeeLinksToOpen.length}...`;
    shopeeCurrentUrl.textContent = url;
    shopeeCurrentUrl.style.display = 'block';
    
    // Check if this URL already has complete data
    chrome.storage.local.get(['shopeeData'], function(result) {
      const shopeeData = result.shopeeData || {};
      const existingData = shopeeData[url];
      
      // Only open page when data doesn't exist or is incomplete
      const needsRefresh = !existingData || 
                         !existingData.price || 
                         !existingData.name || 
                         existingData.name === "Unknown Product";
      
      if (needsRefresh) {
        console.log(`Opening Shopee URL for data extraction: ${url}`);
        
        // Open URL
        chrome.tabs.create({ url: url }, function(tab) {
          console.log(`Opened tab for Shopee: ${url}`);
          
          // Create a timer to check if data has been updated
          let checkCount = 0;
          const maxChecks = 10; // Check at most 10 times
          
          const checkDataInterval = setInterval(function() {
            chrome.storage.local.get(['shopeeData'], function(newResult) {
              const newShopeeData = newResult.shopeeData || {};
              const newData = newShopeeData[url];
              
              // Check if data has been retrieved and is complete
              const dataComplete = newData && 
                               newData.price && 
                               newData.name && 
                               newData.name !== "Unknown Product";
              
              checkCount++;
              
              if (dataComplete || checkCount >= maxChecks) {
                clearInterval(checkDataInterval);
                
                // 如果数据还是不完整但已达到最大检查次数，手动触发数据提取
                if (!dataComplete && checkCount >= maxChecks) {
                  console.log(`Data extraction timeout for ${url}, forcing extraction...`);
                  
                  // 向内容脚本发送提取请求
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "extractShopeeProductInfo" },
                    function(response) {
                      console.log("Forced data extraction response:", response);
                      
                      // 无论结果如何，1秒后关闭标签页并继续
                      setTimeout(() => {
                        chrome.tabs.remove(tab.id);
                        
                        // 移动到下一个链接
                        currentShopeeIndex++;
                        
                        // 调度下一个链接
                        openShopeeLinksTimeout = setTimeout(function() {
                          openNextShopeeLink(delay);
                        }, delay);
                      }, 1000);
                    }
                  );
                } else {
                  // 数据已完整，关闭标签页并继续
                  console.log(`Data complete for ${url}, closing tab and continuing...`);
                  chrome.tabs.remove(tab.id);
                  
                  // 移动到下一个链接
                  currentShopeeIndex++;
                  
                  // 调度下一个链接
                  openShopeeLinksTimeout = setTimeout(function() {
                    openNextShopeeLink(delay);
                  }, delay);
                }
              }
            });
          }, 1000); // 每秒检查一次
        });
      } else {
        // 数据已存在且完整，不需要打开页面，直接进入下一个
        console.log(`Complete data already exists for ${url}, skipping...`);
        
        // 移动到下一个链接
        currentShopeeIndex++;
        
        // 直接处理下一个链接
        openNextShopeeLink(0); // 不延迟，立即处理下一个
      }
    });
  }
  
  // Process MOMO TID list
  function processTidList() {
    // Get the input TID list
    const inputText = tidListInput.value.trim();
    if (!inputText) {
      showStatusMessage("Please enter MOMO TID list", "error");
      return;
    }
    
    // Split input by line and filter empty lines
    orderedTidList = inputText.split('\n')
      .map(tid => tid.trim())
      .filter(tid => tid.length > 0);
    
    if (orderedTidList.length === 0) {
      showStatusMessage("No valid MOMO TIDs found", "error");
      return;
    }
    
    console.log("Processing MOMO TID list:", orderedTidList);
    
    // Save TID list to storage
    chrome.storage.local.set({ orderedTidList: orderedTidList }, function() {
      // Check for storage.local error
      if (chrome.runtime.lastError) {
        console.error("Error saving MOMO TID list:", chrome.runtime.lastError);
        showStatusMessage("Error saving MOMO TID list: " + chrome.runtime.lastError.message, "error");
        return;
      }
      
      console.log("MOMO TID list saved to storage");
      // Reload data after saving
      loadProductData();
      showStatusMessage(`Processed ${orderedTidList.length} MOMO TIDs`);
    });
  }
  
  // Process Shopee URL list
  function processShopeeUrlList() {
    // Get the input Shopee URL list
    const inputText = shopeeUrlListInput.value.trim();
    if (!inputText) {
      showStatusMessage("Please enter Shopee URL list", "error");
      return;
    }
    
    // Split input by line and filter empty lines
    // 支持两种URL格式:
    // 1. https://shopee.tw/product-i.106973794.25810943488 (传统格式)
    // 2. https://shopee.tw/product/71029966/26175512428 (新格式)
    orderedShopeeUrlList = inputText.split('\n')
      .map(url => url.trim())
      .filter(url => {
        // Check if it's a valid Shopee URL (either format)
        return url.length > 0 && 
              (url.includes("shopee.tw/") && 
               (url.match(/\.\d+\.\d+/) || url.match(/\/product\/\d+\/\d+/)));
      });
    
    if (orderedShopeeUrlList.length === 0) {
      showStatusMessage("No valid Shopee URLs found", "error");
      return;
    }
    
    console.log("Processing Shopee URL list:", orderedShopeeUrlList);
    
    // Convert URLs to standard format if needed
    orderedShopeeUrlList = orderedShopeeUrlList.map(url => {
      // Check if it's already a full URL
      if (url.startsWith('http')) {
        return url;
      } 
      // If it's just a TID (number), convert to URL
      else if (/^\d+$/.test(url)) {
        // We don't know which format to use, so default to traditional format
        // This assumes the seller ID is not critical
        return `https://shopee.tw/product-i.000000000.${url}`;
      }
      // Otherwise, assume it's a partial URL and add https:// prefix
      return `https://${url}`;
    });
    
    // Save Shopee URL list to storage
    chrome.storage.local.set({ orderedShopeeUrlList: orderedShopeeUrlList }, function() {
      // Check for storage.local error
      if (chrome.runtime.lastError) {
        console.error("Error saving Shopee URL list:", chrome.runtime.lastError);
        showStatusMessage("Error saving Shopee URL list: " + chrome.runtime.lastError.message, "error");
        return;
      }
      
      console.log("Shopee URL list saved to storage");
      // Reload data after saving
      loadProductData();
      showStatusMessage(`Processed ${orderedShopeeUrlList.length} Shopee URLs`);
    });
  }
  
  // 添加相似度计算函数
  function calculateSimilarity(str1, str2) {
    // 如果任一字符串为空，返回0
    if (!str1 || !str2) return 0;
    
    // 通用文本预处理
    const preprocessText = (text) => {
      if (!text) return '';
      
      // 移除各种括号及其内容
      text = text.replace(/【([^】]+)】/g, "$1"); // 保留【】中的内容
      text = text.replace(/\([^)]*\)/g, " ");    // 移除()及其内容
      text = text.replace(/（[^）]*）/g, " ");    // 移除（）及其内容
      
      // 移除促销文案和前缀
      text = text.replace(/買就送[^】]+/g, "");
      text = text.replace(/預購\s+/g, "");
      
      // 规范化空格、转小写
      return text.replace(/\s+/g, " ").trim().toLowerCase();
    };
    
    // 分词函数 - 针对中英文混合文本
    const tokenize = (text) => {
      // 提取所有中文字符、英文单词和数字
      const tokens = [];
      
      // 提取中文词汇(2-4个字符)
      const chinesePattern = /[\u4e00-\u9fa5]{2,4}/g;
      const chineseMatches = text.match(chinesePattern) || [];
      tokens.push(...chineseMatches);
      
      // 提取英文单词(2个以上字符)
      const englishPattern = /[a-zA-Z]{2,}/g;
      const englishMatches = text.match(englishPattern) || [];
      tokens.push(...englishMatches.map(w => w.toLowerCase()));
      
      // 提取数字和字母混合的产品型号(通常很重要)
      const modelPattern = /[a-zA-Z0-9]{2,}[-]?[a-zA-Z0-9]{2,}/g;
      const modelMatches = text.match(modelPattern) || [];
      tokens.push(...modelMatches);
      
      // 移除重复元素
      return [...new Set(tokens)];
    };
    
    // 计算词频(TF)
    const calculateTF = (tokens) => {
      const tf = {};
      tokens.forEach(token => {
        tf[token] = (tf[token] || 0) + 1;
      });
      return tf;
    };
    
    // 计算Jaccard相似度(集合相似度)
    const calculateJaccard = (tokens1, tokens2) => {
      const set1 = new Set(tokens1);
      const set2 = new Set(tokens2);
      
      // 交集大小
      let intersection = 0;
      for (const token of set1) {
        if (set2.has(token)) {
          intersection++;
        }
      }
      
      // 并集大小
      const union = set1.size + set2.size - intersection;
      
      return union === 0 ? 0 : intersection / union;
    };
    
    // 计算余弦相似度(考虑词频)
    const calculateCosineSimilarity = (tf1, tf2) => {
      // 创建所有词汇的合集
      const allTokens = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
      
      // 计算点积
      let dotProduct = 0;
      let magnitude1 = 0;
      let magnitude2 = 0;
      
      for (const token of allTokens) {
        const value1 = tf1[token] || 0;
        const value2 = tf2[token] || 0;
        
        dotProduct += value1 * value2;
        magnitude1 += value1 * value1;
        magnitude2 += value2 * value2;
      }
      
      magnitude1 = Math.sqrt(magnitude1);
      magnitude2 = Math.sqrt(magnitude2);
      
      if (magnitude1 === 0 || magnitude2 === 0) return 0;
      
      return dotProduct / (magnitude1 * magnitude2);
    };
    
    // 检测是否含有相同的产品型号
    const containsCommonModel = (tokens1, tokens2) => {
      // 产品型号通常包含数字和字母的组合
      const modelPattern = /^[a-zA-Z0-9]{2,}[-]?[a-zA-Z0-9]{2,}$/;
      
      // 筛选可能的产品型号
      const models1 = tokens1.filter(t => modelPattern.test(t));
      const models2 = tokens2.filter(t => modelPattern.test(t));
      
      // 如果两组中都存在相同的型号，则认为是同一产品
      for (const model1 of models1) {
        for (const model2 of models2) {
          // 完全相同
          if (model1.toLowerCase() === model2.toLowerCase()) {
            return true;
          }
          
          // 提取数字部分进行比较
          const digits1 = model1.replace(/[^0-9]/g, '');
          const digits2 = model2.replace(/[^0-9]/g, '');
          
          // 如果数字部分足够长且相同，认为是同一产品
          if (digits1.length >= 5 && digits1 === digits2) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    // 加权混合多种相似度指标
    const combineSimilarityScores = (jaccard, cosine, hasCommonModel) => {
      // 基础分数是Jaccard和余弦相似度的加权平均
      const baseScore = (jaccard * 0.4) + (cosine * 0.6);
      
      // 如果有共同的产品型号，显著提高相似度
      if (hasCommonModel) {
        return Math.min(1.0, baseScore + 0.4);
      }
      
      return baseScore;
    };
    
    // 主处理流程
    const normalizedStr1 = preprocessText(str1);
    const normalizedStr2 = preprocessText(str2);
    
    // 分词
    const tokens1 = tokenize(normalizedStr1);
    const tokens2 = tokenize(normalizedStr2);
    
    // 如果没有有效的词，则返回0
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    // 计算词频
    const tf1 = calculateTF(tokens1);
    const tf2 = calculateTF(tokens2);
    
    // 计算各种相似度
    const jaccardSimilarity = calculateJaccard(tokens1, tokens2);
    const cosineSimilarity = calculateCosineSimilarity(tf1, tf2);
    const hasCommonModel = containsCommonModel(tokens1, tokens2);
    
    // 结合所有相似度指标
    return combineSimilarityScores(jaccardSimilarity, cosineSimilarity, hasCommonModel);
  }
  
  // Load all product data and display in table
  function loadProductData() {
    chrome.storage.local.get(['productData', 'orderedTidList', 'shopeeData', 'orderedShopeeUrlList'], function(result) {
      const momoData = result.productData || {};
      const shopeeData = result.shopeeData || {};
      
      console.log("Loaded MOMO product data:", momoData);
      console.log("Loaded Shopee product data:", shopeeData);
      
      // If stored TID list exists, use it
      if (result.orderedTidList && result.orderedTidList.length > 0) {
        orderedTidList = result.orderedTidList;
        console.log("Loaded MOMO TID list from storage:", orderedTidList);
        // Show saved TID list in input
        tidListInput.value = orderedTidList.join('\n');
      }
      
      // If stored Shopee URL list exists, use it
      if (result.orderedShopeeUrlList && result.orderedShopeeUrlList.length > 0) {
        orderedShopeeUrlList = result.orderedShopeeUrlList;
        console.log("Loaded Shopee URL list from storage:", orderedShopeeUrlList);
        // Show saved Shopee URL list in input
        shopeeUrlListInput.value = orderedShopeeUrlList.join('\n');
      }
      
      // Clear table
      productTableBody.innerHTML = '';
      
      // Determine which list is longer to establish row count
      const maxRows = Math.max(
        orderedTidList.length > 0 ? orderedTidList.length : Object.keys(momoData).length,
        orderedShopeeUrlList.length > 0 ? orderedShopeeUrlList.length : Object.keys(shopeeData).length
      );
      
      // If no data, show message
      if (maxRows === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 9; // Update colspan to 9 for all columns (including new Match column)
        cell.textContent = 'No data. Please browse product pages to collect data or enter TID/URL lists.';
        cell.style.textAlign = 'center';
        cell.classList.add('no-data');
        row.appendChild(cell);
        productTableBody.appendChild(row);
        
        // Clear export text area
        exportTextarea.value = '';
        return;
      }
      
      // Sort MOMO data based on TID list
      let momoDisplayOrder = [];
      
      if (orderedTidList.length > 0) {
        // Use user-specified TID order
        momoDisplayOrder = orderedTidList;
        console.log("Using ordered MOMO TID list for display:", momoDisplayOrder);
      } else {
        // If no TID list, use all data sorted by timestamp
        momoDisplayOrder = Object.keys(momoData).sort((a, b) => {
          return momoData[b].timestamp - momoData[a].timestamp;
        });
        console.log("Using timestamp-sorted MOMO data for display:", momoDisplayOrder);
      }
      
      // Sort Shopee data based on URL list
      let shopeeDisplayOrder = [];
      
      if (orderedShopeeUrlList.length > 0) {
        // Use user-specified URL order
        shopeeDisplayOrder = orderedShopeeUrlList;
        console.log("Using ordered Shopee URL list for display:", shopeeDisplayOrder);
      } else {
        // If no URL list, use all data sorted by timestamp
        shopeeDisplayOrder = Object.keys(shopeeData).sort((a, b) => {
          return shopeeData[b].timestamp - shopeeData[a].timestamp;
        });
        console.log("Using timestamp-sorted Shopee data for display:", shopeeDisplayOrder);
      }
      
      // Create a merged view with both MOMO and Shopee data
      const combinedRows = Math.max(momoDisplayOrder.length, shopeeDisplayOrder.length);
      
      for (let i = 0; i < combinedRows; i++) {
        const row = document.createElement('tr');
        
        // 存储MOMO和Shopee的产品名称，用于后续比较
        let momoProductName = null;
        let shopeeProductName = null;
        
        // MOMO data (A-D columns)
        if (i < momoDisplayOrder.length) {
          const tid = momoDisplayOrder[i];
          const product = momoData[tid];
          
          // A column - TID/Position
          const tidCell = document.createElement('td');
          tidCell.textContent = tid;
          tidCell.classList.add('momo-column');
          row.appendChild(tidCell);
          
          // If data doesn't have this TID product, show empty row
          if (!product) {
            // B column - Product ID (empty until visited)
            const idCell = document.createElement('td');
            idCell.textContent = ''; // Leave empty, not visited yet
            idCell.classList.add('momo-column');
            row.appendChild(idCell);
            
            // C column - Price (not fetched)
            const priceCell = document.createElement('td');
            priceCell.textContent = 'Not fetched';
            priceCell.style.color = '#999';
            priceCell.classList.add('momo-column');
            row.appendChild(priceCell);
            
            // D column - Product Name (not fetched)
            const nameCell = document.createElement('td');
            nameCell.textContent = 'Not fetched';
            nameCell.style.color = '#999';
            nameCell.classList.add('momo-column');
            row.appendChild(nameCell);
          } else {
            // B column - Product ID (from visited page)
            const idCell = document.createElement('td');
            idCell.textContent = product.id;
            idCell.classList.add('momo-column');
            row.appendChild(idCell);
            
            // C column - Price (as number)
            const priceCell = document.createElement('td');
            priceCell.textContent = product.price || 'Price not found';
            priceCell.classList.add('momo-column');
            row.appendChild(priceCell);
            
            // D column - Product Name
            const nameCell = document.createElement('td');
            nameCell.textContent = product.name || 'Name not found';
            nameCell.style.maxWidth = '200px';
            nameCell.style.overflow = 'hidden';
            nameCell.style.textOverflow = 'ellipsis';
            nameCell.title = product.name || ''; // Add tooltip for full name on hover
            nameCell.classList.add('momo-column');
            row.appendChild(nameCell);
            
            // 保存MOMO产品名称
            momoProductName = product.name;
          }
        } else {
          // Empty MOMO columns
          for (let j = 0; j < 4; j++) {
            const emptyCell = document.createElement('td');
            emptyCell.classList.add('momo-column');
            row.appendChild(emptyCell);
          }
        }
        
        // Shopee data (E-H columns)
        if (i < shopeeDisplayOrder.length) {
          const url = shopeeDisplayOrder[i];
          const product = shopeeData[url];
          
          // E column - Shopee URL
          const urlCell = document.createElement('td');
          urlCell.textContent = url;
          urlCell.style.maxWidth = '150px';
          urlCell.style.overflow = 'hidden';
          urlCell.style.textOverflow = 'ellipsis';
          urlCell.title = url; // Add tooltip for full URL on hover
          urlCell.classList.add('shopee-column');
          row.appendChild(urlCell);
          
          // If data doesn't have this URL product, show empty row
          if (!product) {
            // F column - Shopee ID (empty until visited)
            const idCell = document.createElement('td');
            idCell.textContent = ''; // Leave empty, not visited yet
            idCell.classList.add('shopee-column');
            row.appendChild(idCell);
            
            // G column - Shopee Price (not fetched)
            const priceCell = document.createElement('td');
            priceCell.textContent = 'Not fetched';
            priceCell.style.color = '#999';
            priceCell.classList.add('shopee-column');
            row.appendChild(priceCell);
            
            // H column - Shopee Product Name (not fetched)
            const nameCell = document.createElement('td');
            nameCell.textContent = 'Not fetched';
            nameCell.style.color = '#999';
            nameCell.classList.add('shopee-column');
            row.appendChild(nameCell);
          } else {
            // F column - Shopee ID (from visited page)
            const idCell = document.createElement('td');
            idCell.textContent = product.id;
            idCell.classList.add('shopee-column');
            row.appendChild(idCell);
            
            // G column - Shopee Price (as number)
            const priceCell = document.createElement('td');
            priceCell.textContent = product.price || 'Price not found';
            priceCell.classList.add('shopee-column');
            row.appendChild(priceCell);
            
            // H column - Shopee Product Name
            const nameCell = document.createElement('td');
            nameCell.textContent = product.name || 'Name not found';
            nameCell.style.maxWidth = '200px';
            nameCell.style.overflow = 'hidden';
            nameCell.style.textOverflow = 'ellipsis';
            nameCell.title = product.name || ''; // Add tooltip for full name on hover
            nameCell.classList.add('shopee-column');
            row.appendChild(nameCell);
            
            // 保存Shopee产品名称
            shopeeProductName = product.name;
          }
        } else {
          // Empty Shopee columns
          for (let j = 0; j < 4; j++) {
            const emptyCell = document.createElement('td');
            emptyCell.classList.add('shopee-column');
            row.appendChild(emptyCell);
          }
        }
        
        // I column - Match (验证D、H列是否为同一商品)
        const matchCell = document.createElement('td');
        matchCell.classList.add('match-column');
        
        // 如果两个商品名都存在，比较它们
        if (momoProductName && shopeeProductName) {
          // 计算商品名称的相似度
          const similarity = calculateSimilarity(momoProductName, shopeeProductName);
          console.log(`Comparing: "${momoProductName}" vs "${shopeeProductName}" - Similarity: ${similarity.toFixed(2)}`);
          
          // 相似度阈值为0.35，即至少有35%相似才认为是同一商品
          if (similarity >= 0.35) {
            matchCell.textContent = '1';
            matchCell.classList.add('match-yes');
            matchCell.title = `相似度: ${(similarity * 100).toFixed(0)}%`;
          } else {
            matchCell.textContent = '0';
            matchCell.classList.add('match-no');
            matchCell.title = `相似度: ${(similarity * 100).toFixed(0)}%`;
          }
        } else {
          // 如果至少一个商品名缺失，则无法比较
          matchCell.textContent = '-';
          matchCell.classList.add('match-na');
          matchCell.title = '无法比较：缺少商品名称';
        }
        
        row.appendChild(matchCell);
        
        productTableBody.appendChild(row);
      }
      
      // Update export text area
      updateExportText(momoData, momoDisplayOrder, shopeeData, shopeeDisplayOrder);
    });
  }
  
  // Update export text area
  function updateExportText(momoData, momoSortedIds, shopeeData, shopeeSortedUrls) {
    let exportText = '';
    
    // Determine maximum number of rows
    const maxRows = Math.max(momoSortedIds.length, shopeeSortedUrls.length);
    
    for (let i = 0; i < maxRows; i++) {
      let rowText = '';
      
      // 存储MOMO和Shopee的产品名称，用于计算匹配度
      let momoProductName = null;
      let shopeeProductName = null;
      
      // MOMO data
      if (i < momoSortedIds.length) {
        const id = momoSortedIds[i];
        const product = momoData[id];
        if (product) {
          rowText += `${id}\t${product.id}\t${product.price || ''}\t${product.name || ''}`;
          momoProductName = product.name;
        } else {
          // If product with TID not found, output only TID in column A, leave B, C and D empty
          rowText += `${id}\t\t\t`;
        }
      } else {
        rowText += '\t\t\t';
      }
      
      // Add separator
      rowText += '\t';
      
      // Shopee data
      if (i < shopeeSortedUrls.length) {
        const url = shopeeSortedUrls[i];
        const product = shopeeData[url];
        if (product) {
          rowText += `${url}\t${product.id}\t${product.price || ''}\t${product.name || ''}`;
          shopeeProductName = product.name;
        } else {
          // If product with URL not found, output only URL in column E, leave F, G and H empty
          rowText += `${url}\t\t\t`;
        }
      } else {
        rowText += '\t\t\t';
      }
      
      // 添加I列：匹配情况
      if (momoProductName && shopeeProductName) {
        // 计算商品名称的相似度
        const similarity = calculateSimilarity(momoProductName, shopeeProductName);
        // 相似度阈值为0.35，即至少有35%相似才认为是同一商品
        rowText += `\t${similarity >= 0.35 ? '1' : '0'}`;
      } else {
        rowText += '\t-'; // 无法比较时使用"-"表示
      }
      
      exportText += rowText + '\n';
    }
    
    exportTextarea.value = exportText;
  }
  
  // Clear all data
  function clearAllData() {
    if (confirm('Are you sure you want to clear all product data?')) {
      chrome.storage.local.set({ 
        productData: {}, 
        orderedTidList: [],
        shopeeData: {},
        orderedShopeeUrlList: []
      }, function() {
        orderedTidList = [];
        tidListInput.value = '';
        orderedShopeeUrlList = [];
        shopeeUrlListInput.value = '';
        loadProductData();
        showStatusMessage("All data cleared");
      });
    }
  }
  
  // Export data to text area
  function exportDataToText() {
    chrome.storage.local.get(['productData', 'orderedTidList', 'shopeeData', 'orderedShopeeUrlList'], function(result) {
      const momoData = result.productData || {};
      const shopeeData = result.shopeeData || {};
      
      let momoDisplayOrder = [];
      if (result.orderedTidList && result.orderedTidList.length > 0) {
        momoDisplayOrder = result.orderedTidList;
      } else {
        momoDisplayOrder = Object.keys(momoData).sort((a, b) => {
          return momoData[b].timestamp - momoData[a].timestamp;
        });
      }
      
      let shopeeDisplayOrder = [];
      if (result.orderedShopeeUrlList && result.orderedShopeeUrlList.length > 0) {
        shopeeDisplayOrder = result.orderedShopeeUrlList;
      } else {
        shopeeDisplayOrder = Object.keys(shopeeData).sort((a, b) => {
          return shopeeData[b].timestamp - shopeeData[a].timestamp;
        });
      }
      
      if (momoDisplayOrder.length === 0 && shopeeDisplayOrder.length === 0) {
        showStatusMessage("No data to export", "error");
        return;
      }
      
      updateExportText(momoData, momoDisplayOrder, shopeeData, shopeeDisplayOrder);
      
      // Show export text area
      exportTextarea.style.display = 'block';
      exportTextarea.focus();
      exportTextarea.select();
      
      showStatusMessage("Data exported to text box");
    });
  }
  
  // Copy data to clipboard
  function copyDataToClipboard() {
    exportTextarea.select();
    
    try {
      // Execute copy command
      const successful = document.execCommand('copy');
      if (successful) {
        showStatusMessage("Data copied to clipboard");
      } else {
        showStatusMessage("Copy failed, please copy manually", "error");
      }
    } catch (err) {
      showStatusMessage("Copy failed: " + err, "error");
    }
  }
  
  // Show status message
  function showStatusMessage(message, type = "success") {
    statusMessage.textContent = message;
    
    // Set style based on type
    if (type === "error") {
      statusMessage.style.backgroundColor = "#ffebee";
      statusMessage.style.color = "#c62828";
    } else {
      statusMessage.style.backgroundColor = "#e8f5e9";
      statusMessage.style.color = "#2e7d32";
    }
    
    // Show message
    statusMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(function() {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}); 