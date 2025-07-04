var chrome = {}; chrome.runtime = {}; chrome.runtime.sendMessage = function() {}; chrome.tabs = {}; chrome.tabs.create = function() {}; chrome.tabs.remove = function() {}; var visitData = {batchStatus: {}, batchJobs: []};
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
  // Don't set random request headers if blocking function is disabled
  if (!configSettings.blockingEnabled) {
    console.log(`Resource blocking function disabled, skipping setting random request headers for tab ${tabId}`);
    return;
  }
  
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateSessionRules) {
    console.error("declarativeNetRequest API unavailable");
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
      console.error(`Failed to set request headers for tab ${tabId}:`, chrome.runtime.lastError);
    } else {
      console.log(`Set random request headers for tab ${tabId}: UserAgent=${randomUserAgent.substring(0, 30)}..., Referer=${randomReferer}`);
    }
  });
}

// Listen for new browse requests, set random request headers for tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && tab.url && tab.url.includes("momoshop.com.tw")) {
    // Set random request headers for tabs accessing momoshop.com.tw
    setRandomHeadersForTab(tabId);
  }
});

// New: Batch processing product ID functionality
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
    console.error("Cookie API unavailable");
    return { success: false, error: "Cookie API unavailable" };
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
      console.log(`No cookies to clear for ${domain}`);
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
  console.log(`Batch task ${batchId} current status: Total=${status.total}, Completed=${status.completed}, Active tabs=${activeTabCount}, RemainingTID=${batchJob.tidList.length}`);
  
  // Check for active tabs that haven't been updated for a while, possibly stuck
  const now = Date.now();
  let hasStuckTabs = false;
  
  for (const tabId in status.activeTabs) {
    const tab = status.activeTabs[tabId];
    // Check if tab page hasn't been updated for over 5 minutes, possibly stuck
    if ((now - tab.startTime) > 300000) { // 5 minutes = 300000 milliseconds
      console.warn(`Tab page ${tabId} may be stuck, processing time exceeds 5 minutes`);
      hasStuckTabs = true;
      
      // Try to close stuck tab page
      try {
        chrome.tabs.remove(parseInt(tabId), () => {
          if (chrome.runtime.lastError) {
            console.error(`Failed to close tab page ${tabId}:`, chrome.runtime.lastError);
          } else {
            console.log(`Closed stuck tab page ${tabId}`);
            delete status.activeTabs[tabId];
          }
        });
      } catch (e) {
        console.error(`Error closing tab page ${tabId}:`, e);
      }
    }
  }
  
  // Calculate the number of tabs that can be opened simultaneously
  const canOpenCount = Math.min(
    batchJob.maxConcurrent - activeTabCount, 
    batchJob.tidList.length
  );
  
  console.log(`Batch task ${batchId}: Number of tabs to open=${canOpenCount}, Maximum simultaneous tabs=${batchJob.maxConcurrent}`);
  
  // If no tabs can be opened, check if all tasks are completed
  if (canOpenCount <= 0) {
    // Check if there are active tab pages
    if (activeTabCount > 0) {
      console.log(`Batch task ${batchId}: Currently ${activeTabCount} tab pages are being processed, waiting for them to complete`);
      
      // Set a delay check, to ensure not stuck in this state
      setTimeout(() => {
        console.log(`Checking batch task ${batchId} processing progress...`);
        startBatchProcessing(batchId);
      }, 10000); // Check again after 10 seconds
      
      return;
    }
    
    // If no active tab pages and no remaining TIDs, check if all tasks are completed
    if (batchJob.tidList.length === 0) {
      // Check if all TIDs are processed
      if (status.completed >= status.total) {
        console.log(`Batch task ${batchId} completed! Completed count=${status.completed}, Total=${status.total}`);
        
        // Calculate total time
        const totalTime = (Date.now() - status.startTime) / 1000;
        console.log(`Total time: ${totalTime.toFixed(2)} seconds, Average time per product ${(totalTime / status.total).toFixed(2)} seconds`);
        
        // Remove this batch task from queue
        const index = visitData.batchJobs.findIndex(job => job.batchId === batchId);
        if (index !== -1) {
          visitData.batchJobs.splice(index, 1);
        }
        
        // Send batch completion message
        chrome.runtime.sendMessage({ 
          action: "batchCompleted", 
          batchId: batchId,
          status: status
        });
      } else {
        // If there are still unprocessed TIDs (possibly due to inconsistent state), log
        console.warn(`Batch task ${batchId} inconsistent state: Completed count=${status.completed}, Total=${status.total}, but TID list is empty and no active tab pages`);
        
        // Try to recheck if there are tab pages still being processed
        chrome.tabs.query({}, function(tabs) {
          let foundRelatedTabs = 0;
          tabs.forEach(tab => {
            // Check if URL contains specific processing marker
            if (tab.url && tab.url.includes('auto_mapping=true')) {
              foundRelatedTabs++;
              console.log(`Found related tab page: ${tab.id}, URL: ${tab.url}`);
            }
          });
          
          if (foundRelatedTabs > 0) {
            console.log(`Found ${foundRelatedTabs} possible related tab pages, waiting for them to complete`);
          } else {
            console.log(`No related tab pages found, trying to mark batch task as completed`);
            // Force update status and send completion message
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
  
  // Create new tab and load URL
  for (let i = 0; i < canOpenCount; i++) {
    if (batchJob.tidList.length === 0) break;
    
    // Get one TID from list
    const tid = batchJob.tidList.shift();
    
    // Always use desktop URL format, avoid mobile version (m.momoshop.com.tw/goods.momo)
    const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`;
    console.log(`Building desktop URL for TID ${tid}: ${url}`);
    
    // Check if recently accessed this URL, if so, wait a while
    const now = Date.now();
    if (visitData.lastRequestTime[url] && (now - visitData.lastRequestTime[url] < 10000)) {
      // If accessed within 10 seconds, wait a while before accessing
      const waitTime = 10000 - (now - visitData.lastRequestTime[url]);
      console.log(`URL ${url} recently accessed, waiting ${waitTime}ms before accessing again`);
      
      // Put TID back into list, to be processed later
      batchJob.tidList.push(tid);
      
      // Wait a while before trying to process batch again
      setTimeout(() => {
        startBatchProcessing(batchId);
      }, waitTime + 1000);
      
      continue;
    }
    
    // Update last request time
    visitData.lastRequestTime[url] = now;
    
    // Clear cookies before creating new tab
    await clearCookiesForDomain("momoshop.com.tw");
    
    // Create new tab
    chrome.tabs.create({ url: url, active: false }, (tab) => {
      console.log(`Created tab page ${tab.id} for TID ${tid}`);
      
      // Record tab ID and TID mapping
      status.activeTabs[tab.id] = {
        tid: tid,
        url: url,
        startTime: Date.now()
      };
    });
    
    // Wait a little between opening new tab pages to avoid opening multiple tabs at once
    // Increase longer wait time to ensure each new tab page has enough time to initialize
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000)); // Random wait time between 3-5 seconds
  }
}

// Listen for message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Process clear cookie request
  if (request.action === "clearCookies") {
    const domain = request.domain || "momoshop.com.tw";
    console.log(`Received clear cookie request for ${domain}`);
    
    // Clear cookies and return result
    clearCookiesForDomain(domain).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ 
        success: false, 
        error: error.message || "Unknown error" 
      });
    });
    
    // Return true to use asynchronous callback
    return true;
  }
  
  // Process page log
  if (request.action === "logPage") {
    // Save to memory
    visitData.logs.unshift(request.data);
    if (visitData.logs.length > 1000) {
      visitData.logs = visitData.logs.slice(0, 1000);
    }
    
    // Also update to chrome.storage
    chrome.storage.local.get(['refreshLog'], function(result) {
      let refreshLog = result.refreshLog || [];
      
      // Add current log record
      refreshLog.push(request.data);
      
      // If more than 1000 records, keep only the latest 1000
      if (refreshLog.length > 1000) {
        refreshLog = refreshLog.slice(-1000);
      }
      
      // Save updated log
      chrome.storage.local.set({ refreshLog: refreshLog }, function() {
        console.log("Log updated, current count: " + refreshLog.length);
      });
    });
    
    // Respond success
    sendResponse({ success: true });
    return true;
  }

  // Process pause batch request
  if (request.action === "pauseBatch") {
    const batchId = request.batchId;
    console.log(`Received pause batch processing request: batchId=${batchId}`);
    
    if (!visitData.batchStatus[batchId]) {
      sendResponse({ success: false, error: "Cannot find specified batch processing task" });
      return true;
    }
    
    // Set batch processing status to paused
    visitData.batchStatus[batchId].paused = true;
    console.log(`Batch processing ${batchId} paused`);
    
    // Respond success
    sendResponse({ 
      success: true, 
      status: visitData.batchStatus[batchId] 
    });
    
    return true;
  }
  
  // Process continue batch processing request
  if (request.action === "resumeBatch") {
    const batchId = request.batchId;
    console.log(`Received continue batch processing request: batchId=${batchId}`);
    
    if (!visitData.batchStatus[batchId]) {
      sendResponse({ success: false, error: "Cannot find specified batch processing task" });
      return true;
    }
    
    // Set batch processing status to continue
    visitData.batchStatus[batchId].paused = false;
    console.log(`Batch processing ${batchId} continued`);
    
    // Check if there are unfinished TIDs or opened tab pages
    const batchJob = visitData.batchJobs.find(job => job.batchId === batchId);
    const status = visitData.batchStatus[batchId];
    const activeTabCount = Object.keys(status.activeTabs).length;
    
    // Check progress
    console.log(`Batch processing ${batchId} status: Total=${status.total}, Completed=${status.completed}, In progress=${activeTabCount}, RemainingTID count=${batchJob ? batchJob.tidList.length : 0}`);
    
    // Directly start processing - ensure correct startup even if no new TIDs but active tab pages
    if (batchJob) {
      // Try to start processing regardless of tidList length
      console.log(`Force continue batch processing ${batchId}, active tab pages: ${activeTabCount}, RemainingTID: ${batchJob.tidList.length}`);
      
      // Delay start processing to ensure status has been updated
      setTimeout(() => {
        // Use correct function name startProcessingBatch
        startProcessingBatch(batchId);
        
        // If no TIDs to process and tab pages are also 0, check if need to mark as completed
        if (batchJob.tidList.length === 0 && activeTabCount === 0) {
          if (status.completed >= status.total) {
            console.log(`Batch processing ${batchId} all tasks completed, sending completion message`);
            chrome.runtime.sendMessage({
              action: 'batchCompleted',
              batchId: batchId,
              status: status
            });
          }
        }
      }, 500);
    } else {
      console.error(`Cannot find batch task ${batchId}, cannot continue processing`);
    }
    
    // Respond success
    sendResponse({ 
      success: true, 
      status: visitData.batchStatus[batchId] 
    });
    
    return true;
  }
  
  // Process force close tab request
  if (request.action === "forceCloseTab") {
    const url = request.url;
    const tid = request.tid;
    const reason = request.reason || "Unknown reason";
    
    console.log(`Received force close tab request: TID=${tid}, URL=${url}, Reason=${reason}`);
    
    // For specific reasons, log but do not process data
    if (reason === "Page does not exist" || reason === "Sold out") {
      console.log(`Due to ${reason}, will skip processing TID=${tid} data`);
      
      // Check if this is a batch processing task
      for (const batchId in visitData.batchStatus) {
        const status = visitData.batchStatus[batchId];
        
        // Find if there is a tab page using this TID
        for (const tabId in status.activeTabs) {
          if (status.activeTabs[tabId] === tid) {
            console.log(`Batch processing ${batchId}: TID ${tid} due to ${reason} skipped processing`);
            
            // Update status
            delete status.activeTabs[tabId];
            status.completed++;  // Still count as completed, but not failed
            status.inProgress--;
            break;
          }
        }
      }
    }
    
    // Find corresponding tab page
    chrome.tabs.query({}, function(tabs) {
      let found = false;
      
      for (const tab of tabs) {
        // Check if URL contains TID
        if (tab.url && (tab.url.includes(tid) || tab.url === url)) {
          console.log(`Found matching tab page ID=${tab.id}, preparing to close, Reason: ${reason}`);
          chrome.tabs.remove(tab.id);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log(`No matching tab page found: TID=${tid}, URL=${url}, Reason: ${reason}`);
      }
    });
    
    return true;
  }
  
  // Process reopen TID page request
  if (request.action === "reopenTid") {
    const tid = request.tid;
    const reason = request.reason || "Data is empty, need to try again";
    
    console.log(`Received reopen TID request: TID=${tid}, Reason=${reason}`);
    
    // Close current tab page
    if (sender.tab && sender.tab.id) {
      console.log(`Closing tab page that sent request: ${sender.tab.id}`);
      chrome.tabs.remove(sender.tab.id);
    }
    
    // Wait a little before opening new page
    setTimeout(() => {
      // Build MOMO product page URL
      const url = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`;
      console.log(`Preparing to reopen TID=${tid} page: ${url}`);
      
      // Create new tab page
      chrome.tabs.create({ 
        url: url, 
        active: false 
      }, (tab) => {
        console.log(`Created new tab page for TID=${tid}: ${tab.id}`);
        
        // Set random header
        setRandomHeadersForTab(tab.id);
        
        // Record in log
        const timeNow = new Date().toLocaleString();
        console.log(`[${timeNow}] Reopened TID page ${tid}: ${url} (Tab page ${tab.id})`);
      });
    }, 2000); // Wait 2 seconds before opening new page
    
    sendResponse({ success: true });
    return true;
  }
  
  // Process batch processing request
  if (request.action === "startBatch") {
    const batchId = Date.now().toString();
    const tidList = request.tidList;
    const maxConcurrent = request.maxConcurrent || 5;
    
    // Initialize batch task status
    visitData.batchStatus[batchId] = {
      total: tidList.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      tids: tidList,
      maxConcurrent: maxConcurrent,
      tidIndex: 0,
      activeTabs: {},
      paused: false // Initialize pause status as false
    };
    
    console.log(`Batch processing started, ID: ${batchId}, Total: ${tidList.length}, Maximum simultaneous processing: ${maxConcurrent}`);
    
    // Start processing
    startProcessingBatch(batchId);
    
    sendResponse({ success: true, batchId: batchId });
    return true;
  }
  
  // Get batch processing status
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
          inProgress: status.inProgress,
          paused: status.paused,
          activeTabs: status.activeTabs
        }
      });
    } else {
      sendResponse({ success: false, error: "Cannot find specified batch task" });
    }
    return true;
  }
  
  // Process setting update
  if (request.type === "updateSettings" && request.settings) {
    // Update blocking settings
    if (request.settings.hasOwnProperty('blockingEnabled')) {
      configSettings.blockingEnabled = request.settings.blockingEnabled;
      console.log(`Updated resource blocking settings: ${configSettings.blockingEnabled ? "Enabled" : "Disabled"}`);
      
      // Update dynamic rules, based on blocking settings enable or disable image blocking rules
      updateImageBlockingRules(configSettings.blockingEnabled);
      
      // Save settings
      saveSettings();
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  return true;
});

// Start processing batch task
function startProcessingBatch(batchId) {
  const status = visitData.batchStatus[batchId];
  if (!status) {
    console.error(`Cannot start batch processing: Cannot find batch status ${batchId}`);
    return;
  }
  
  // Check if task is paused
  if (status.paused) {
    console.log(`Batch task ${batchId} is paused, not continuing processing`);
    return;
  }
  
  console.log(`Starting batch processing ${batchId}, status:`, {
    total: status.total,
    completed: status.completed,
    tidIndex: status.tidIndex,
    tidsLength: status.tids.length,
    maxConcurrent: status.maxConcurrent,
    activeTabsCount: Object.keys(status.activeTabs).length
  });
  
  // Calculate the number of pages to open
  const needToOpen = Math.min(
    status.maxConcurrent - Object.keys(status.activeTabs).length,
    status.tids.length - status.tidIndex
  );
  
  console.log(`Batch task ${batchId}: Number of pages to open = ${needToOpen}`);
  
  if (needToOpen <= 0) {
    console.log(`Batch task ${batchId}: No need to open new pages, Current active tab count: ${Object.keys(status.activeTabs).length}, Remaining index position: ${status.tids.length - status.tidIndex}`);
    return;
  }
  
  // Open pages
  for (let i = 0; i < needToOpen; i++) {
    const tid = status.tids[status.tidIndex++];
    if (!tid) break;
    
    chrome.tabs.create({
      url: `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${tid}`
    }, (tab) => {
      // Record tab ID
      status.activeTabs[tab.id] = tid;
      status.inProgress++;
      
      // Set random request headers for tab
      setRandomHeadersForTab(tab.id);
      
      console.log(`Batch processing ${batchId}: Opening tab page ${tab.id} processing TID ${tid}`);
    });
  }
}

// Listen for tab page close event
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Check all batch processing tasks
  for (const batchId in visitData.batchStatus) {
    const status = visitData.batchStatus[batchId];
    
    // Check if this tab belongs to current batch processing
    if (status.activeTabs[tabId]) {
      // Update status
      const tid = status.activeTabs[tabId];
      delete status.activeTabs[tabId];
      status.completed++;
      status.inProgress--;
      
      console.log(`Batch processing ${batchId}: Tab page ${tabId} closed, TID ${tid} processing completed`);
      
      // Check if all TIDs are processed
      if (status.completed >= status.total) {
        console.log(`Batch processing ${batchId}: All TIDs processed`);
        
        // Notify frontend
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
        
        // Clear status after 1 minute
        setTimeout(() => {
          delete visitData.batchStatus[batchId];
          console.log(`Batch processing ${batchId}: Status cleared`);
        }, 60000);
      } else {
        // Continue processing next batch
        startProcessingBatch(batchId);
      }
    }
  }
});

// Update image blocking rules function
function updateImageBlockingRules(enabled) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
    console.error("declarativeNetRequest.updateDynamicRules API unavailable");
    return;
  }
  
  console.log(`${enabled ? "Enabled" : "Disabled"} image blocking rules`);
  
  if (enabled) {
    // Set 2_loading_skip_img style image blocking rules
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
    
    // Update dynamic rules
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001, 1002, 1003, 1004], // Remove previous rules first
      addRules: imageBlockingRules
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to update image blocking rules:", chrome.runtime.lastError);
      } else {
        console.log("Image blocking rules enabled");
      }
    });
  } else {
    // Disable rules, just remove previous rules
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001, 1002, 1003, 1004]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to remove image blocking rules:", chrome.runtime.lastError);
      } else {
        console.log("Image blocking rules disabled");
      }
    });
  }
}
      