// Use declarativeNetRequest as replacement in Manifest V3
// Configuration for managing user agents and request headers has been moved to rules.json

// User agent list - Extended desktop browser user agents
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.71 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/92.0.902.78 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/93.0.961.52 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:90.0) Gecko/20100101 Firefox/90.0"
];

// Global configuration variables
const configSettings = {
  blockingEnabled: true // Enable resource blocking by default
};

// Common Referer list for reference websites
const referers = [
  "https://www.google.com/",
  "https://www.google.com.tw/",
  "https://www.bing.com/",
  "https://search.yahoo.com/",
  "https://tw.search.yahoo.com/",
  "https://www.facebook.com/",
  "https://www.instagram.com/",
  "https://www.momoshop.com.tw/",
  "https://www.momoshop.com.tw/category/LgrpCategory.jsp",
  "https://www.momoshop.com.tw/category/DgrpCategory.jsp",
  "https://www.momoshop.com.tw/Search/SearchShop.jsp"
];

// Store visit count and last request time
const visitData = {
  // Visit count counter
  counter: {},
  // Last request time
  lastRequestTime: {},
  // Batch jobs in progress
  batchJobs: [],
  // Batch job status
  batchStatus: {},
  // Log records
  logs: []
};

// Load configuration settings
function loadSettings() {
  chrome.storage.local.get({
    blockingEnabled: true // Enable by default
  }, function(items) {
    configSettings.blockingEnabled = items.blockingEnabled;
    console.log("Resource blocking settings loaded:", configSettings.blockingEnabled ? "Enabled" : "Disabled");
  });
}

// Save configuration settings
function saveSettings() {
  chrome.storage.local.set({
    blockingEnabled: configSettings.blockingEnabled
  }, function() {
    console.log("Resource blocking settings saved:", configSettings.blockingEnabled ? "Enabled" : "Disabled");
  });
}

// Implement delayed request mechanism
async function manageTiming() {
  // Generate random delay time (2-5 seconds)
  const getRandomDelay = () => Math.floor(Math.random() * 3000) + 2000;
  
  // Periodically clean expired request records (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    // Clean request records older than 5 minutes
    for (const url in visitData.lastRequestTime) {
      if (visitData.lastRequestTime[url] < fiveMinutesAgo) {
        delete visitData.lastRequestTime[url];
        delete visitData.counter[url];
      }
    }
    console.log("Expired request records cleaned");
  }, 5 * 60 * 1000);
  
  // Reload settings every 10 minutes to ensure settings are always correct
  setInterval(() => {
    loadSettings();
    console.log("Periodically reload resource blocking settings");
  }, 10 * 60 * 1000);
}

// Load settings when background script starts
loadSettings();

// Start managing timing when background script starts
manageTiming();

// Create session-scoped rules
function createSessionRules() {
  // Don't create rules if blocking function is disabled
  if (!configSettings.blockingEnabled) {
    console.log("Resource blocking function disabled, not creating session rules");
    return;
  }

  // Session-scoped rules can use tabIds
  const sessionRules = [
    {
      id: 2,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "User-Agent", operation: "set", value: userAgents[1] }
        ]
      },
      condition: {
        urlFilter: "momoshop.com.tw",
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        tabIds: [1]
      }
    },
    {
      id: 3,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "User-Agent", operation: "set", value: userAgents[2] }
        ]
      },
      condition: {
        urlFilter: "momoshop.com.tw",
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        tabIds: [2]
      }
    },
    {
      id: 4,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "User-Agent", operation: "set", value: userAgents[3] }
        ]
      },
      condition: {
        urlFilter: "momoshop.com.tw",
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        tabIds: [3]
      }
    }
  ];

  // Update session-scoped rules
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateSessionRules) {
    chrome.declarativeNetRequest.updateSessionRules({
      addRules: sessionRules,
      removeRuleIds: [2, 3, 4]  // Remove rules with same ID first if they exist
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to update session rules:", chrome.runtime.lastError);
      } else {
        console.log("Session rules updated");
      }
    });
  }
}

// Listen for tab creation and updates, set user agent for new tabs
chrome.tabs.onCreated.addListener((tab) => {
  console.log("New tab created:", tab.id);
  createSessionRules();
});

// Support dynamic User-Agent changes
chrome.runtime.onInstalled.addListener(() => {
  // Set initial declarativeNetRequest rules
  console.log("Extension installed, initializing rules...");
  
  // Initialize image blocking rules
  if (configSettings.blockingEnabled) {
    updateImageBlockingRules(true);
  }
  
  // Initialize session-scoped rules
  createSessionRules();
  
  // Load blocking settings from chrome.storage
  chrome.storage.local.get({
    blockingEnabled: true  // Enable blocking by default
  }, function(items) {
    configSettings.blockingEnabled = items.blockingEnabled;
    console.log(`Loaded blocking settings from storage: ${configSettings.blockingEnabled ? "Enabled" : "Disabled"}`);
    
    // Update image blocking rules based on settings
    updateImageBlockingRules(configSettings.blockingEnabled);
  });
});

// Create a function to set random user agent and random Referer for specific tabs
function setRandomHeadersForTab(tabId) {
  // If blocking function is disabled, don't set random request headers
  if (!configSettings.blockingEnabled) {
    console.log(`Resource blocking function disabled, skipping setting random headers for tab ${tabId}`);
    return;
  }
  
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateSessionRules) {
    console.error("declarativeNetRequest API not available");
    return;
  }
  
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const randomReferer = referers[Math.floor(Math.random() * referers.length)];
  
  // Create session-scoped rules for specific tabs
  const tabRule = {
    id: 1000 + tabId,  // Use 1000 + tabId as unique rule ID
    priority: 2,  // Higher priority than basic rules
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "User-Agent", operation: "set", value: randomUserAgent },
        { header: "Referer", operation: "set", value: randomReferer },
        { header: "Accept-Language", operation: "set", value: "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7" },
        { header: "Cache-Control", operation: "set", value: "no-cache" },
        { header: "Pragma", operation: "set", value: "no-cache" }
      ]
    },
    condition: {
      urlFilter: "momoshop.com.tw",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
      tabIds: [tabId]
    }
  };
  
  // Update session-scoped rules
  chrome.declarativeNetRequest.updateSessionRules({
    addRules: [tabRule],
    removeRuleIds: [1000 + tabId]  // Remove rules with same ID first if they exist
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to set headers for tab ${tabId}:`, chrome.runtime.lastError);
    } else {
      console.log(`Set random headers for tab ${tabId}: UserAgent=${randomUserAgent.substring(0, 30)}..., Referer=${randomReferer}`);
    }
  });
}

// Listen for new browsing requests, set random request headers for tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url && tab.url.includes("momoshop.com.tw")) {
    // Set random request headers for tabs accessing momoshop.com.tw
    setRandomHeadersForTab(tabId);
  }
});

// New: Batch processing functionality for product IDs
async function processBatch(tidList, maxConcurrent = 3) {
  if (!tidList || tidList.length === 0) {
    console.log("No TID list provided, cannot execute batch processing");
    return;
  }
  
  // Generate batch ID
  const batchId = Date.now().toString();
  console.log(`Starting batch processing ${batchId}, total ${tidList.length} products`);
  
  // Initialize batch status
  visitData.batchStatus[batchId] = {
    total: tidList.length,
    completed: 0,
    results: {},
    startTime: Date.now(),
    activeTabs: {},
    paused: false // Initialize pause status as false
  };
  
  // Add batch task to queue
  visitData.batchJobs.push({
    batchId: batchId,
    tidList: [...tidList],
    maxConcurrent: maxConcurrent
  });
  
  // Start batch processing
  await startBatchProcessing(batchId);
  
  return batchId;
}

// New: Clear cookies for specific domain
async function clearCookiesForDomain(domain) {
  if (!chrome.cookies || !chrome.cookies.getAll || !chrome.cookies.remove) {
    console.error("Cookie API not available");
    return { success: false, error: "Cookie API not available" };
  }
  
  try {
    console.log(`Starting to clear cookies for ${domain}`);
    const cookies = await new Promise((resolve, reject) => {
      chrome.cookies.getAll({ domain: domain }, (cookies) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(cookies || []);
        }
      });
    });
    
    console.log(`Preparing to clear ${cookies.length} cookies for ${domain}`);
    
    // If no cookies, return directly
    if (cookies.length === 0) {
      console.log(`${domain} has no cookies to clear`);
      return { success: true, count: 0, failedCount: 0 };
    }
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const cookie of cookies) {
      try {
        await new Promise((resolve) => {
          const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
          console.log(`Clearing cookie: ${cookie.name} from ${cookieUrl}`);
          
          chrome.cookies.remove({
            url: cookieUrl,
            name: cookie.name
          }, (result) => {
            if (chrome.runtime.lastError) {
              console.warn(`Error clearing cookie ${cookie.name}:`, chrome.runtime.lastError);
              failedCount++;
            } else if (!result) {
              console.warn(`Unable to clear cookie ${cookie.name}`);
              failedCount++;
            } else {
              console.log(`Successfully cleared cookie ${cookie.name}`);
              successCount++;
            }
            resolve();
          });
        });
      } catch (e) {
        console.error(`Error processing cookie ${cookie.name}:`, e);
        failedCount++;
      }
    }
    
    console.log(`Cleared ${successCount} cookies for ${domain}, failed ${failedCount}`);
    return { 
      success: true, 
      count: successCount, 
      failedCount: failedCount,
      total: cookies.length
    };
  } catch (error) {
    console.error("Error clearing cookies:", error);
    return { 
      success: false, 
      error: error.message || "Unknown error" 
    };
  }
}

// Start batch processing
async function startBatchProcessing(batchId) {
  const batchJob = visitData.batchJobs.find(job => job.batchId === batchId);
  if (!batchJob) {
    console.log(`Cannot find batch task ${batchId}`);
    return;
  }
  
  const status = visitData.batchStatus[batchId];
  
  // Check if task is paused
  if (status.paused) {
    console.log(`Batch task ${batchId} is paused, not continuing processing`);
    return;
  }
  
  // Output current status
  const activeTabCount = Object.keys(status.activeTabs).length;
  console.log(`Batch task ${batchId} current status: Total=${status.total}, Completed=${status.completed}, Active tabs=${activeTabCount}, Remaining TIDs=${batchJob.tidList.length}`);
  
  // 檢查是否有正在進行的標籤頁，但沒有進度更新
  const now = Date.now();
  let hasStuckTabs = false;
  
  for (const tabId in status.activeTabs) {
    const tab = status.activeTabs[tabId];
    // 檢查標籤頁是否超過5分鐘沒有更新，可能是卡住了
    if ((now - tab.startTime) > 300000) { // 5分鐘 = 300000毫秒
      console.warn(`標籤頁 ${tabId} 可能卡住了, 處理時間超過5分鐘`);
      hasStuckTabs = true;
      
      // 嘗試關閉卡住的標籤頁
      try {
        chrome.tabs.remove(parseInt(tabId), () => {
          if (chrome.runtime.lastError) {
            console.error(`關閉標籤頁 ${tabId} 失敗:`, chrome.runtime.lastError);
          } else {
            console.log(`已關閉卡住的標籤頁 ${tabId}`);
            delete status.activeTabs[tabId];
          }
        });
      } catch (e) {
        console.error(`關閉標籤頁 ${tabId} 時出錯:`, e);
      }
    }
  }
  
  // 計算可以同時開啟的標籤數
  const canOpenCount = Math.min(
    batchJob.maxConcurrent - activeTabCount, 
    batchJob.tidList.length
  );
  
  console.log(`批次任務 ${batchId}: 可開啟標籤數=${canOpenCount}, 最大同時標籤數=${batchJob.maxConcurrent}`);
  
  // 如果沒有可開啟的標籤，檢查是否所有任務已完成
  if (canOpenCount <= 0) {
    // 檢查是否還有活動的標籤頁
    if (activeTabCount > 0) {
      console.log(`批次任務 ${batchId}: 目前有 ${activeTabCount} 個標籤頁正在處理中，等待它們完成`);
      
      // 設置一個延遲檢查，確保不會卡在這個狀態
      setTimeout(() => {
        console.log(`檢查批次任務 ${batchId} 的處理進度...`);
        startBatchProcessing(batchId);
      }, 10000); // 10秒後再次檢查
      
      return;
    }
    
    // 如果沒有活動的標籤頁，且沒有剩餘的TID，檢查是否所有任務已完成
    if (batchJob.tidList.length === 0) {
      // 檢查是否所有TID都已處理
      if (status.completed >= status.total) {
        console.log(`批次任務 ${batchId} 已全部完成！ 完成數=${status.completed}, 總數=${status.total}`);
        
        // 計算總耗時
        const totalTime = (Date.now() - status.startTime) / 1000;
        console.log(`總耗時: ${totalTime.toFixed(2)} 秒，平均每個商品 ${(totalTime / status.total).toFixed(2)} 秒`);
        
        // 從隊列中移除此批次任務
        const index = visitData.batchJobs.findIndex(job => job.batchId === batchId);
        if (index !== -1) {
          visitData.batchJobs.splice(index, 1);
        }
        
        // 發送批次完成的消息
        chrome.runtime.sendMessage({ 
          action: "batchCompleted", 
          batchId: batchId,
          status: status
        });
      } else {
        // 如果還有未處理完的TID（可能是狀態不一致），記錄日誌
        console.warn(`批次任務 ${batchId} 狀態不一致: 完成數=${status.completed}, 總數=${status.total}, 但TID列表為空且無活動標籤頁`);
        
        // 嘗試重新檢查是否有標籤頁仍在處理
        chrome.tabs.query({}, function(tabs) {
          let foundRelatedTabs = 0;
          tabs.forEach(tab => {
            // 檢查URL是否包含特定的處理標記
            if (tab.url && tab.url.includes('auto_mapping=true')) {
              foundRelatedTabs++;
              console.log(`發現相關的標籤頁: ${tab.id}, URL: ${tab.url}`);
            }
          });
          
          if (foundRelatedTabs > 0) {
            console.log(`發現 ${foundRelatedTabs} 個可能相關的標籤頁，等待它們完成`);
          } else {
            console.log(`未發現相關標籤頁，嘗試標記批次任務為完成`);
            // 強制更新狀態並發送完成消息
            status.completed = status.total;
            chrome.runtime.sendMessage({ 
              action: "batchCompleted", 
              batchId: batchId,
              status: status
            });
          }
        });
      }
    }
    return;
  }
  
  // 創建標籤頁並加載 URL
  for (let i = 0; i < canOpenCount; i++) {
    if (batchJob.tidList.length === 0) break;
    
    // 從列表中取出一個 TID
    const tid = batchJob.tidList.shift();
    
    // 始終使用電腦版URL格式，避免手機版(m.momoshop.com.tw/goods.momo)
    const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`;
    console.log(`為TID ${tid} 構建電腦版URL: ${url}`);
    
    // 判斷最近是否訪問過該 URL，如果是，則延遲一段時間
    const now = Date.now();
    if (visitData.lastRequestTime[url] && (now - visitData.lastRequestTime[url] < 10000)) {
      // 如果 10 秒內訪問過，等待一段時間再訪問
      const waitTime = 10000 - (now - visitData.lastRequestTime[url]);
      console.log(`URL ${url} 最近已訪問過，等待 ${waitTime}ms 後再次訪問`);
      
      // 將 TID 放回列表，稍後再處理
      batchJob.tidList.push(tid);
      
      // 延遲一段時間後再次嘗試處理批次
      setTimeout(() => {
        startBatchProcessing(batchId);
      }, waitTime + 1000);
      
      continue;
    }
    
    // 更新最後請求時間
    visitData.lastRequestTime[url] = now;
    
    // 在創建新標籤頁之前清除cookie
    await clearCookiesForDomain("momoshop.com.tw");
    
    // 創建新標籤
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      console.log(`為 TID ${tid} 創建標籤頁 ${tab.id}`);
      
      // 記錄標籤頁與 TID 的對應關係
      status.activeTabs[tab.id] = {
        tid: tid,
        url: url,
        startTime: Date.now()
      };
    });
    
    // 稍微間隔一下，避免同時打開多個標籤
    // 增加更長的間隔時間，以確保每個新標籤頁有足夠的時間初始化
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000)); // 3-5秒的隨機間隔
  }
}

// 監聽消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 處理清除Cookie的請求
  if (request.action === "clearCookies") {
    const domain = request.domain || "momoshop.com.tw";
    console.log(`收到清除 ${domain} Cookie 的請求`);
    
    // 清除cookie並返回結果
    clearCookiesForDomain(domain).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ 
        success: false, 
        error: error.message || "未知錯誤" 
      });
    });
    
    // 返回true表示將使用異步回調
    return true;
  }
  
  // 處理頁面日誌
  if (request.action === "logPage") {
    // 保存到內存中
    visitData.logs.unshift(request.data);
    if (visitData.logs.length > 1000) {
      visitData.logs = visitData.logs.slice(0, 1000);
    }
    
    // 同時更新到chrome.storage
    chrome.storage.local.get(['refreshLog'], function(result) {
      let refreshLog = result.refreshLog || [];
      
      // 添加當前日誌記錄
      refreshLog.push(request.data);
      
      // 如果超過1000條記錄，則保留最新的1000條
      if (refreshLog.length > 1000) {
        refreshLog = refreshLog.slice(-1000);
      }
      
      // 保存更新後的日誌
      chrome.storage.local.set({ refreshLog: refreshLog }, function() {
        console.log("日誌已更新，當前數量：" + refreshLog.length);
      });
    });
    
    // 回應成功
    sendResponse({ success: true });
    return true;
  }

  // 處理暫停批量處理的請求
  if (request.action === "pauseBatch") {
    const batchId = request.batchId;
    console.log(`收到暫停批量處理請求: batchId=${batchId}`);
    
    if (!visitData.batchStatus[batchId]) {
      sendResponse({ success: false, error: "找不到指定的批量處理任務" });
      return true;
    }
    
    // 設置批量處理狀態為暫停
    visitData.batchStatus[batchId].paused = true;
    console.log(`批量處理 ${batchId} 已暫停`);
    
    // 返回成功響應
    sendResponse({ 
      success: true, 
      status: visitData.batchStatus[batchId] 
    });
    
    return true;
  }
  
  // 處理繼續批量處理的請求
  if (request.action === "resumeBatch") {
    const batchId = request.batchId;
    console.log(`收到繼續批量處理請求: batchId=${batchId}`);
    
    if (!visitData.batchStatus[batchId]) {
      sendResponse({ success: false, error: "找不到指定的批量處理任務" });
      return true;
    }
    
    // 設置批量處理狀態為繼續
    visitData.batchStatus[batchId].paused = false;
    console.log(`批量處理 ${batchId} 已繼續`);
    
    // 檢查是否有未處理完的 TID 或已開啟的標籤頁
    const batchJob = visitData.batchJobs.find(job => job.batchId === batchId);
    const status = visitData.batchStatus[batchId];
    const activeTabCount = Object.keys(status.activeTabs).length;
    
    // 檢查進度
    console.log(`批量處理 ${batchId} 狀態: 總計=${status.total}, 已完成=${status.completed}, 進行中=${activeTabCount}, 剩餘TID數量=${batchJob ? batchJob.tidList.length : 0}`);
    
    // 直接啟動處理流程 - 確保即使沒有新的TID但有活動標籤頁的情況也能正確啟動
    if (batchJob) {
      // 無論tidList長度如何，都嘗試啟動處理流程
      console.log(`強制繼續處理批量任務 ${batchId}，活動標籤頁: ${activeTabCount}，剩餘TID: ${batchJob.tidList.length}`);
      
      // 延遲啟動處理，確保狀態已經更新
      setTimeout(() => {
        startBatchProcessing(batchId);
        
        // 如果沒有待處理的TID且標籤頁也為0，則檢查是否需要標記為完成
        if (batchJob.tidList.length === 0 && activeTabCount === 0) {
          if (status.completed >= status.total) {
            console.log(`批量處理 ${batchId} 所有任務已完成，發送完成消息`);
            chrome.runtime.sendMessage({
              action: 'batchCompleted',
              batchId: batchId,
              status: status
            });
          }
        }
      }, 500);
    } else {
      console.error(`找不到批量任務 ${batchId}，無法繼續處理`);
    }
    
    // 返回成功響應
    sendResponse({ 
      success: true, 
      status: visitData.batchStatus[batchId] 
    });
    
    return true;
  }
  
  // 處理強制關閉標籤頁的請求
  if (request.action === "forceCloseTab") {
    const url = request.url;
    const tid = request.tid;
    const reason = request.reason || "未知原因";
    
    console.log(`收到強制關閉標籤頁請求: TID=${tid}, URL=${url}, 原因=${reason}`);
    
    // 對於特定原因，記錄但不處理數據
    if (reason === "網頁不存在" || reason === "熱銷一空") {
      console.log(`由於${reason}，將跳過處理TID=${tid}的數據`);
      
      // 檢查是否為批量處理中的任務
      for (const batchId in visitData.batchStatus) {
        const status = visitData.batchStatus[batchId];
        
        // 尋找是否有使用此TID的標籤頁
        for (const tabId in status.activeTabs) {
          if (status.activeTabs[tabId] === tid) {
            console.log(`批量處理 ${batchId}: TID ${tid} 由於${reason}而跳過處理`);
            
            // 更新狀態
            delete status.activeTabs[tabId];
            status.completed++;  // 仍然計入完成數，但不計入失敗數
            status.inProgress--;
            break;
          }
        }
      }
    }
    
    // 查找對應的標籤頁
    chrome.tabs.query({}, function(tabs) {
      let found = false;
      
      for (const tab of tabs) {
        // 檢查URL是否包含TID
        if (tab.url && (tab.url.includes(tid) || tab.url === url)) {
          console.log(`找到匹配的標籤頁 ID=${tab.id}，準備關閉，原因: ${reason}`);
          chrome.tabs.remove(tab.id);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`未找到匹配的標籤頁: TID=${tid}, URL=${url}, 原因: ${reason}`);
      }
    });
    
    return true;
  }
  
  // 處理重新打開TID頁面的請求
  if (request.action === "reopenTid") {
    const tid = request.tid;
    const reason = request.reason || "資料為空，需要再次嘗試";
    
    console.log(`收到重新打開TID請求: TID=${tid}, 原因=${reason}`);
    
    // 關閉當前標籤頁
    if (sender.tab && sender.tab.id) {
      console.log(`關閉發送請求的標籤頁: ${sender.tab.id}`);
      chrome.tabs.remove(sender.tab.id);
    }
    
    // 延遲一下再打開新頁面
    setTimeout(() => {
      // 構建MOMO商品頁面URL
      const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`;
      console.log(`準備重新打開TID=${tid}的頁面: ${url}`);
      
      // 創建新標籤頁
      chrome.tabs.create({ 
        url: url, 
        active: false 
      }, (tab) => {
        console.log(`已為TID=${tid}創建新標籤頁: ${tab.id}`);
        
        // 設置頭部隨機化
        setRandomHeadersForTab(tab.id);
        
        // 記錄在日誌中
        const timeNow = new Date().toLocaleString();
        console.log(`[${timeNow}] 重新打開TID頁面 ${tid}: ${url} (標籤頁 ${tab.id})`);
      });
    }, 2000); // 2秒後再打開新頁面
    
    sendResponse({ success: true });
    return true;
  }
  
  // 處理批量處理請求
  if (request.action === "startBatch") {
    const batchId = Date.now().toString();
    const tidList = request.tidList;
    const maxConcurrent = request.maxConcurrent || 5;
    
    // 初始化批量任務狀態
    visitData.batchStatus[batchId] = {
      total: tidList.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      tids: tidList,
      maxConcurrent: maxConcurrent,
      tidIndex: 0,
      activeTabs: {},
      paused: false // 初始化暫停狀態為 false
    };
    
    console.log(`批量處理啟動，ID: ${batchId}, 總計: ${tidList.length}, 最大同時處理: ${maxConcurrent}`);
    
    // 開始處理
    startProcessingBatch(batchId);
    
    sendResponse({ success: true, batchId: batchId });
    return true;
  }
  
  // 獲取批量處理狀態
  if (request.action === "getBatchStatus") {
    const batchId = request.batchId;
    
    if (visitData.batchStatus[batchId]) {
      const status = visitData.batchStatus[batchId];
      sendResponse({
        success: true,
        status: {
          total: status.total,
          completed: status.completed,
          failed: status.failed,
          inProgress: status.inProgress
        }
      });
    } else {
      sendResponse({ success: false, error: "找不到指定的批次任務" });
    }
    return true;
  }
  
  // 處理設置更新
  if (request.type === "updateSettings" && request.settings) {
    // 更新阻擋設置
    if (request.settings.hasOwnProperty('blockingEnabled')) {
      configSettings.blockingEnabled = request.settings.blockingEnabled;
      console.log(`更新資源封鎖設置: ${configSettings.blockingEnabled ? "開啟" : "關閉"}`);
      
      // 更新動態規則，根據封鎖設置啟用或禁用圖片阻擋規則
      updateImageBlockingRules(configSettings.blockingEnabled);
      
      // 保存設置
      saveSettings();
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // 處理命令快捷键
  if (request.action === "open_price_tracker") {
    openPriceTracker();
  }
  
  return true;
});

// 開始處理批量任務
function startProcessingBatch(batchId) {
  const status = visitData.batchStatus[batchId];
  if (!status) return;
  
  // 檢查任務是否已暫停
  if (status.paused) {
    console.log(`批次任務 ${batchId} 已暫停，不繼續處理`);
    return;
  }
  
  // 計算需要開啟的頁面數量
  const needToOpen = Math.min(
    status.maxConcurrent - Object.keys(status.activeTabs).length,
    status.tids.length - status.tidIndex
  );
  
  if (needToOpen <= 0) return;
  
  // 開啟頁面
  for (let i = 0; i < needToOpen; i++) {
    const tid = status.tids[status.tidIndex++];
    if (!tid) break;
    
    chrome.tabs.create({
      url: `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`
    }, (tab) => {
      // 記錄標籤ID
      status.activeTabs[tab.id] = tid;
      status.inProgress++;
      
      // 為標籤設置隨機請求頭
      setRandomHeadersForTab(tab.id);
      
      console.log(`批量處理 ${batchId}: 開啟標籤頁 ${tab.id} 處理 TID ${tid}`);
    });
  }
}

// 監聽標籤頁關閉事件
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // 檢查所有批量處理任務
  for (const batchId in visitData.batchStatus) {
    const status = visitData.batchStatus[batchId];
    
    // 檢查此標籤是否屬於當前批量處理
    if (status.activeTabs[tabId]) {
      // 更新狀態
      const tid = status.activeTabs[tabId];
      delete status.activeTabs[tabId];
      status.completed++;
      status.inProgress--;
      
      console.log(`批量處理 ${batchId}: 標籤頁 ${tabId} 已關閉，TID ${tid} 處理完成`);
      
      // 檢查是否所有TID都已處理
      if (status.completed >= status.total) {
        console.log(`批量處理 ${batchId}: 所有TID都已處理完成`);
        
        // 通知前端
        chrome.runtime.sendMessage({
          action: 'batchCompleted',
          batchId: batchId,
          status: {
            total: status.total,
            completed: status.completed,
            failed: status.failed,
            inProgress: status.inProgress
          }
        });
        
        // 一分鐘後清理狀態
        setTimeout(() => {
          delete visitData.batchStatus[batchId];
          console.log(`批量處理 ${batchId}: 狀態已清理`);
        }, 60000);
      } else {
        // 繼續處理下一批
        startProcessingBatch(batchId);
      }
    }
  }
});

// 更新圖片封鎖規則的函數
function updateImageBlockingRules(enabled) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
    console.error("declarativeNetRequest.updateDynamicRules API 不可用");
    return;
  }
  
  console.log(`${enabled ? "啟用" : "禁用"}圖片封鎖規則`);
  
  if (enabled) {
    // 設置 2_loading_skip_img 風格的圖片阻擋規則
    const imageBlockingRules = [
      {
        id: 1001,
        priority: 1,
        action: { type: "block" },
        condition: {
          resourceTypes: ["image"],
          regexFilter: "^https://img[1-4]\\.momoshop\\.com\\.tw/expertimg/.*"
        }
      },
      {
        id: 1002,
        priority: 1,
        action: { type: "block" },
        condition: {
          resourceTypes: ["main_frame"],
          regexFilter: "^https://www\\.youtube\\.com/watch.*"
        }
      },
      {
        id: 1003,
        priority: 1,
        action: { type: "block" },
        condition: {
          resourceTypes: ["main_frame"],
          regexFilter: "^https://www\\.momoshop\\.com\\.tw/edm/cmmedm\\.jsp\\?.*"
        }
      },
      {
        id: 1004,
        priority: 1,
        action: { type: "block" },
        condition: {
          resourceTypes: ["image"],
          regexFilter: "^https://i[1-4]\\.momoshop\\.com\\.tw/.*goodsimg/.*"
        }
      }
    ];
    
    // 更新動態規則
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001, 1002, 1003, 1004], // 先移除之前的規則
      addRules: imageBlockingRules
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("更新圖片封鎖規則失敗：", chrome.runtime.lastError);
      } else {
        console.log("圖片封鎖規則已啟用");
      }
    });
  } else {
    // 禁用規則，僅移除之前的規則
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001, 1002, 1003, 1004]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("移除圖片封鎖規則失敗：", chrome.runtime.lastError);
      } else {
        console.log("圖片封鎖規則已禁用");
      }
    });
  }
}

// 打开价格追踪器页面
function openPriceTracker() {
  // 检查是否已经打开了价格追踪器窗口
  chrome.tabs.query({url: chrome.runtime.getURL("momo_price_popup.html")}, (tabs) => {
    if (tabs.length > 0) {
      // 如果已经打开，则激活该标签页
      chrome.tabs.update(tabs[0].id, {active: true});
    } else {
      // 如果没有打开，则创建新标签页
      chrome.tabs.create({url: chrome.runtime.getURL("momo_price_popup.html")});
    }
  });
}

// 监听momo_price_tracker.js发送的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "productDataUpdated") {
    // 通知所有已打开的价格追踪器页面更新数据
    chrome.tabs.query({url: chrome.runtime.getURL("momo_price_popup.html")}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {action: "updateProductData"});
      });
    });
    
    // 返回响应
    sendResponse({success: true});
  }
  
  // 返回true保持消息通道开放，允许异步响应
  return true;
});
      