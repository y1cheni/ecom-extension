(function() {
  // Basic configuration
  let attempts = 0;
  const maxAttempts = 30; // Increase max attempts from 20 to 30
  let reloadDelay = 1500; // Default reload delay
  let processDelay = 1500; // Increase default process delay from 1000 to 1500
  
  // Global retry counter to avoid infinite loops
  let globalRetryCount = 0;
  const maxGlobalRetries = 3; // Increase max overall process retries from 2 to 3
  
  // Auto close setting
  let autoCloseEnabled = true; // Enable by default
  
  // Store original URL to solve TID loss after page redirection
  const originalUrl = window.location.href;
  
  // Step 0: Clear momo shopping platform cookies
  console.log("Step 0: Clear momo shopping platform cookies");
  chrome.runtime.sendMessage({ 
    action: "clearCookies", 
    domain: "momoshop.com.tw" 
  }, function(response) {
    console.log(`Cookie cleanup result: ${response && response.success ? 'Success' : 'Failed'}, deleted ${response ? response.count : 0} cookies`);
    // Continue with subsequent steps after cookie cleanup
    continueProcessing();
  });
  
  // Function to continue with subsequent steps
  function continueProcessing() {
    // Try to get retry count from URL parameters or localStorage
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('retryCount')) {
        globalRetryCount = parseInt(urlParams.get('retryCount'), 10);
        console.log(`Retry count obtained from URL parameters: ${globalRetryCount}`);
      } else if (localStorage.getItem(`retryCount_${originalUrl}`)) {
        globalRetryCount = parseInt(localStorage.getItem(`retryCount_${originalUrl}`), 10);
        console.log(`Retry count obtained from localStorage: ${globalRetryCount}`);
      }
    } catch (e) {
      console.log('Error getting retry count', e);
    }
    
    console.log(`Initial global retry count: ${globalRetryCount}/${maxGlobalRetries}`);
    
    // Load settings from storage
    chrome.storage.local.get({
      reloadDelay: 1500, // Default reload delay
      autoClose: true // Default auto-close enabled
    }, function(items) {
      reloadDelay = items.reloadDelay;
      autoCloseEnabled = items.autoClose;
      console.log(`Settings loaded: reload delay=${reloadDelay}ms, auto-close=${autoCloseEnabled}`);
    });
    
    // Listen for settings update messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if ((request.type === "updateSettings" || request.action === "updateSettings") && 
          request.settings) {
        // Update reload delay setting
        if (request.settings.hasOwnProperty('reloadDelay')) {
        reloadDelay = request.settings.reloadDelay;
        console.log(`Reload delay updated: ${reloadDelay}ms`);
        }
        
        // Update auto-close setting
        if (request.settings.hasOwnProperty('autoClose')) {
          autoCloseEnabled = request.settings.autoClose;
          console.log(`Auto-close setting updated: ${autoCloseEnabled}`);
        }
        
        sendResponse({success: true});
      }
      return true;
    });
    
    // Try to get TID from URL
    const originalTid = (() => {
      // Product detail page
      const match = originalUrl.match(/[?&]i_code=(\d+)/);
      if (match && match[1]) return match[1];
      
      // Notice page, try to get from referrer or previous URL
      if (originalUrl.includes('Notice.jsp') || originalUrl.includes('msg1=FA0064')) {
        // If coming from product page, try to extract from referrer
        if (document.referrer && document.referrer.includes('i_code=')) {
          const referrerMatch = document.referrer.match(/[?&]i_code=(\d+)/);
          if (referrerMatch && referrerMatch[1]) return referrerMatch[1];
        }
        
        // TID possibly contained in URL parameters
        const msgMatch = originalUrl.match(/[?&]msg1=([A-Z0-9]+)/);
        if (msgMatch && msgMatch[1]) return msgMatch[1]; 
      }
      
      // If it's a product page without i_code parameter
      if (originalUrl.includes('GoodsDetail.jsp')) {
        return "No TID";
      }
      
      return null;
    })();
  
    // Check if it's an invalid page - strictly following user-specified logic
    const isInvalidPage = () => {
      if (!document.body) return false;
      const content = document.body.innerText || '';
      
      // 1. Check if it's a specific notice page (FA0064) - special case that no longer needs retry
      const isSpecialNoticePage = originalUrl.includes('Notice.jsp?msg1=FA0064') || 
                                (content.includes('這個網頁不存在') && originalUrl.includes('Notice.jsp'));
      
      // 2. Check "這個網頁不存在" and URL is specific error page
      const isNotExistPage = /這個網頁不存在/i.test(content) && 
                           originalUrl.includes('EC404.html');
      
      // 3. Check "熱銷一空" and URL is specific notice page
      const isSoldOutPage = /熱銷一空/i.test(content) && 
                          originalUrl.includes('Notice.jsp');
      
      return isSpecialNoticePage || isNotExistPage || isSoldOutPage;
    };
  
    // Check if it's a special notice page, this type of page should be directly marked as "No Data" without retry
    const isSpecialNoticePage = () => {
      // First case: URL becomes "https://www.momoshop.com.tw/com/Notice.jsp?msg1=FA0064"
      // This case should be directly marked as no need to retry, blank data is fine
      return originalUrl.includes('Notice.jsp?msg1=FA0064') || 
             (document.body && document.body.innerText.includes('這個網頁不存在') && originalUrl.includes('Notice.jsp'));
    };
  
    // Function to reload page
    function reloadPage() {
      console.log(`Preparing to reload page, current attempt count: ${attempts}`);
      setTimeout(() => {
        window.location.reload();
      }, reloadDelay);
      return true;
    }
    
    // Function to close page, ensure data is saved
    function closePage(reason) {
      console.log(`Closing page, reason: ${reason}`);
      
      // Check if it's truly empty data and not a special page
      // Note: "No Data" is not a blank value, but a valid filled value
      if (!isSpecialNoticePage()) {
        // Check if current data is truly blank (not "No Data", but completely no value)
        chrome.storage.local.get(['logs'], function(result) {
          let logs = result.logs || {};
          const currentData = logs[originalTid];
          
          // Check if it's truly blank data, not "No Data"
          if (currentData && 
              (currentData.momoSales === "" || currentData.momoSales === undefined || currentData.momoSales === null)) {
            console.log(`Detected truly blank data before closing and not special page, will trigger reopening TID=${originalTid} page`);
            
            // Notify background script to reopen the same TID page
            chrome.runtime.sendMessage({ 
              action: "reopenTid", 
              tid: originalTid,
              reason: "Data is truly blank, need to try again"
            });
            
            // Don't execute subsequent page closing operations, let background script control
            return;
          }
          
          // If data is not empty or has "No Data" value, close normally
          executeClose();
        });
      } else {
        // Special page, close directly
        executeClose();
      }
      
      // Execute actual page closing operation
      function executeClose() {
        // Try to close directly
        window.close();
        
        // If window.close() doesn't work, try other ways to close
        setTimeout(() => {
          if (document.visibilityState !== 'hidden') {
            console.log('Trying to send force close signal');
            chrome.runtime.sendMessage({ 
              action: "forceCloseTab", 
              tid: originalTid || "unknown",
              url: window.location.href,
              reason: reason
            });
          }
        }, 500);
      }
    }
    
    // First check if it's an invalid page to avoid wasting time
    if (isInvalidPage()) {
      console.log('Detected invalid page, processing directly');
      processInvalidPage();
      return; // No need for subsequent processing
    }
  
    // Function to process invalid pages
    function processInvalidPage() {
      console.log('Processing invalid page');
      
      // Mark if it's a special notice page
      const isSpecialNotice = isSpecialNoticePage();
      
      // Save basic data
      const logData = {
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        tid: originalTid || "unknown",
        state: isSpecialNotice ? "Special Notice Page" : 
               (/這個網頁不存在/i.test(document.body.innerText) ? "Page Not Found" : "Sold Out"),
        E: "No Data",
        F: "1",
        content: document.body ? document.body.innerText.substring(0, 500) : "",
        url: originalUrl
      };
      
      console.log(`Detected special page type: ${logData.state}, will directly mark as no data and close`);
      
      // Send log
      chrome.runtime.sendMessage({ action: "logPage", data: logData });
      
      // Save and close page
      saveLog({
        kam: "",
        momoSales: logData.state === "Page Not Found" ? "網頁不存在" : 
                   logData.state === "Sold Out" ? "熱銷一空" : "無資料",
        momoStock: "1"
      });
      
      // Close page after 3 seconds
      setTimeout(() => {
        closePage(logData.state);
      }, 3000);
    }
  
    console.log("Page loaded, preparing to check product information...");
    console.log(`Current URL: ${originalUrl}, TID: ${originalTid || "Unknown"}`);
    
    // Use polling to continuously check if page elements are loaded
    let intervalId = setInterval(() => {
      attempts++;
      
      // Print attempt status every 10 attempts
      if (attempts % 10 === 0) {
        console.log(`Attempted to check ${attempts} times, continuing to wait for page loading`);
      }
      
      // Ensure document.body already exists
      if (!document.body) {
        console.log(`Attempt count: ${attempts}/${maxAttempts}, document.body not yet loaded...`);
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          console.log("Reached maximum attempt count, but document.body still not loaded, will reload page");
          reloadPage();
        }
        return;
      }
      
      const content = document.body.innerText || '';
      
      // Step 0: Check "正在檢查連線"
      if (/正在檢查連線/i.test(content)) {
        clearInterval(intervalId);
        console.log(`Detected "正在檢查連線", will reload page`);
        reloadPage();
        return;
      }
      
      // Step 1: Check "這個網頁不存在" string or URL is specific error page
      if (/這個網頁不存在/i.test(content) || originalUrl.includes('EC404.html')) {
        clearInterval(intervalId);
        console.log('Detected "這個網頁不存在" string or URL is error page, closing page directly');
        
        // Save as "網頁不存在"
        saveLog({
          kam: "",
          momoSales: "網頁不存在",
          momoStock: "1"
        });
        
        // Delay closing page to ensure data is saved
        setTimeout(() => {
          closePage("網頁不存在");
        }, 3000);
        return;
      }
      
      // Step 2: Check "熱銷一空" string or URL is specific notice page
      if (/熱銷一空/i.test(content) || originalUrl.includes('Notice.jsp?msg1=FA0064')) {
        clearInterval(intervalId);
        console.log('Detected "熱銷一空" string or URL is specific notice page, closing page directly');
        
        // Save as "熱銷一空"
        saveLog({
          kam: "",
          momoSales: "熱銷一空",
          momoStock: "1"
        });
        
        // Delay closing page to ensure data is saved
        setTimeout(() => {
          closePage("熱銷一空");
        }, 3000);
        return;
      }
      
      // Step 3: Check if "會員中心" exists
      if (!/會員中心/i.test(content)) {
        console.log('Did not detect "會員中心", page may not be fully loaded or is blank, continuing to wait...');
        
        // Regardless of attempt count, continue waiting or reload until member center is found
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          console.log(`Attempt count has reached ${maxAttempts} times, but still no "會員中心" found, will reload page`);
          // Add debugging log
          console.log(`Current page content fragment: ${document.body ? document.body.innerText.substring(0, 300) : "Unable to get page content"}`);
          
          // Reset attempt count so it can continue checking after new page load
          attempts = 0;
          reloadPage();
        }
        return; // Continue waiting or reload has been triggered, no subsequent processing
      }
      
      // Step 4: Ensure it's product detail page and member center detected, then process
      if (originalUrl.includes('GoodsDetail.jsp?i_code=') && /會員中心/i.test(content) && document.readyState === "complete") {
        clearInterval(intervalId);
        console.log("Page loading completed and confirmed to contain \"會員中心\", starting data processing");
        processData();
      }
    }, processDelay);
  
    // Function to restart entire process
    function restartEntireProcess() {
      // If it's a special page, no need to retry
      if (isSpecialNoticePage()) {
        console.log('Detected special notice page (Case 1: URL becomes Notice.jsp?msg1=FA0064), no need to retry, directly set as no data and close');
        
        // Save no data state
        saveLog({
          kam: "",
          momoSales: "無資料",
          momoStock: "1"
        });
        
        // Close page after 3 seconds
        setTimeout(() => {
          closePage("Special notice page - No data (Case 1)");
        }, 3000);
        
        return;
      }
  
      // Increase retry count
      globalRetryCount++;
      console.log(`Increasing global retry count: ${globalRetryCount}/${maxGlobalRetries}`);
      
      // Save retry count to localStorage
      try {
        localStorage.setItem(`retryCount_${originalUrl}`, globalRetryCount.toString());
      } catch (e) {
        console.log('Error saving retry count', e);
      }
      
      // Check if maximum retry count has been reached
      if (globalRetryCount >= maxGlobalRetries) {
        console.log(`Maximum retry count (${maxGlobalRetries}) reached, stopping retry`);
        
        // Record failure log
        saveLog({
          kam: "",
          momoSales: "重試失敗",
          momoStock: "1"
        });
        
        // Close page after 3 seconds
        setTimeout(() => {
          closePage("Maximum retry count reached, still unable to get data");
        }, 3000);
        
        return;
      }
  
      // 構建新的URL，包含重試計數參數
      let newUrl = originalUrl;
      if (originalUrl.includes('?')) {
        // 移除可能已存在的retryCount參數
        newUrl = newUrl.replace(/(\?|&)retryCount=\d+/, '');
        newUrl += `&retryCount=${globalRetryCount}`;
      } else {
        newUrl += `?retryCount=${globalRetryCount}`;
      }
      
      console.log(`準備重新啟動整個流程（情況2：資料為空白但非特殊頁面），重試次數: ${globalRetryCount}，URL: ${newUrl}`);
      
      // 重新加載頁面，帶上重試計數
      setTimeout(() => {
        window.location.href = newUrl;
      }, reloadDelay);
    }
  
    // Main data processing function, strictly following specified logic flow
    function processData() {
      console.log("Starting to process data according to flow");
      
      const content = document.body.innerText || '';
      
      // Initialize logData object
      let logData = {
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        tid: originalTid,
        state: "Processing",
        E: "",
        F: "",
        content: content.substring(0, 500),
        url: originalUrl
      };
      
      // Step 4: Wait 2 seconds before checking sales info to ensure page is fully loaded
      console.log('Waiting 2 seconds before checking sales info to ensure page is fully loaded...');
      setTimeout(() => {
        // Ensure it's a product detail page
        if (!originalUrl.includes('GoodsDetail.jsp?i_code=')) {
          console.log('Not a product detail page, will reload page');
          reloadPage();
          return;
        }
        
        // Recheck if "會員中心" exists
        const updatedContent = document.body.innerText || '';
        if (!/會員中心/i.test(updatedContent)) {
          console.log('Still no "會員中心" detected after waiting 2 seconds, will reload page');
          reloadPage();
          return;
        }
        
        // Reget page content to ensure latest data is obtained
        console.log('Checking "總銷量>" data');
        const salesRegex = /總銷量\s*(>100萬|>50萬|>40萬|>30萬|>20萬|>15萬|>10萬|>5萬|>3萬|>1\.5萬|>1萬|>8,000|>5,000|>3,000|>1,000|>500|>100|>50)/;
        const salesMatch = updatedContent.match(salesRegex);
        
        if (salesMatch && salesMatch[1]) {
          logData.E = salesMatch[1];
          console.log(`Found sales data: ${logData.E}`);
        } else {
          logData.E = "無資料";
          console.log('No sales data found, set to "無資料"');
        }
        
        // Step 5: Check "庫存低於"
        console.log('Checking "庫存低於"');
        if (/庫存低於/i.test(updatedContent)) {
          logData.F = "1";
          logData.state = "Low Stock";
          console.log('Detected "庫存低於", set stock to 1');
        } 
        // Step 6: Try to find "直接購買" image
        else {
          console.log('Trying to find "直接購買" image');
          const directPurchase = document.querySelector('img[alt="直接購買"]');
          if (directPurchase) {
            logData.F = "0";
            logData.state = "Success";
            console.log('Found "直接購買" button, set stock to 0');
          } 
          // Step 7: Try to find "售完補貨中" or "可訂購時通知" image
          else {
            console.log('Trying to find "售完補貨中" or "可訂購時通知" image');
            const noStock = document.querySelector('img[alt="售完補貨中"], img[alt="可訂購時通知"]');
            if (noStock) {
              logData.F = "1";
              logData.state = "No Stock";
              console.log('Found no stock image, set stock to 1');
            } 
            // Step 8: If none found, stock = 0
            else {
              logData.F = "0";
              logData.state = "Success";
              console.log('No specific image found, default stock to 0');
            }
          }
        }
        
        // Store currently found data to prevent subsequent operations from overwriting
        const finalSalesData = logData.E;
        const finalStockData = logData.F;
        const finalState = logData.state;
        
        console.log(`Confirming final data: Sales=${finalSalesData}, Stock=${finalStockData}, State=${finalState}`);
        
        // Step 9: Confirm data integrity and ensure it's product detail page, reload if incomplete
        // Check if data is completely filled - "No Data" is also valid information
        const isDataComplete = finalSalesData !== undefined && finalSalesData !== "" && 
                               finalStockData !== undefined && finalStockData !== "";
        
        // Ensure it's product detail page and data is complete
        if (!originalUrl.includes('GoodsDetail.jsp?i_code=') || !isDataComplete) {
          console.log('Data incomplete or not product detail page, will reload page');
          reloadPage();
          return;
        }
        
        // Step 10: Only save and close page when data is complete and it's product detail page
        // Ensure final data is used to avoid being overwritten
        logData.E = finalSalesData;
        logData.F = finalStockData;
        logData.state = finalState;
        
        // Data complete, send log
        console.log(`Data filled completely (Sales=${logData.E}, Stock=${logData.F}), sending and saving log`);
        chrome.runtime.sendMessage({ action: "logPage", data: logData });
        
        // Save to integrated log
        const integratedData = {
          kam: "",
          momoSales: finalSalesData,
          momoStock: finalStockData
        };
        
        // Ensure data is saved before closing page
        new Promise((resolve) => {
          saveLog(integratedData);
          // Ensure data is saved
          setTimeout(resolve, 3000);
        }).then(() => {
          console.log(`Data saving completed: Sales=${finalSalesData}, Stock=${finalStockData}`);
          
          if (autoCloseEnabled) {
            console.log('Auto-close enabled, confirmed product detail page and data complete, closing page');
            closePage("Data filling completed");
          } else {
            console.log('Auto-close disabled, keeping page open');
          }
        });
      }, 2000); // Wait 2 seconds before processing
    }
  
    // Save log records
    function saveLog(data) {
      // Use original TID directly
      if (!originalTid) {
        console.error('Invalid TID');
        return;
      }
      
      console.log(`Preparing to save data for TID=${originalTid}:`, data);
      
      // Ensure data won't be overwritten
      const finalData = {
        kam: data.kam || "",
        momoSales: data.momoSales || "無資料",
        momoStock: data.momoStock || "1",
        state: data.state || "Success"
      };
      
      // Output data about to be saved
      console.log(`Data to be saved: Sales=${finalData.momoSales}, Stock=${finalData.momoStock}`);
      
      // Save to refreshLog
      chrome.storage.local.get(['refreshLog'], function(result) {
        let log = result.refreshLog || [];
        
        // Check if record for this TID already exists
        const existingIndex = log.findIndex(item => item && item.tid === originalTid);
        
        // Create new log entry
        const logEntry = { 
          tid: originalTid,
          timestamp: Date.now(),
          state: finalData.state,
          KAM: finalData.kam,
          E: finalData.momoSales,
          F: finalData.momoStock
        };
        
        console.log(`Preparing to save log entry: ${JSON.stringify(logEntry)}`);
        
        // Update or add record
        if (existingIndex !== -1) {
          log[existingIndex] = logEntry;
          console.log(`Updated existing record for TID=${originalTid}`);
        } else {
          log.push(logEntry);
          console.log(`Added new record for TID=${originalTid}`);
        }
        
        // Limit log size
        if (log.length > 1000) {
          log = log.slice(-1000);
        }
        
        chrome.storage.local.set({ refreshLog: log }, function() {
          console.log(`Successfully saved refreshLog, TID: ${originalTid}, Sales: ${finalData.momoSales}, Stock: ${finalData.momoStock}`);
        });
      });
      
      // Save to integrated log
      chrome.storage.local.get(['logs'], function(result) {
        let logs = result.logs || {};
        
        // Update or create TID record
        logs[originalTid] = {
          kam: finalData.kam,
          momoSales: finalData.momoSales,
          momoStock: finalData.momoStock,
          timestamp: Date.now(),
          // Only need to reopen page when sales data is truly empty
          needReopen: finalData.momoSales === "" || finalData.momoSales === undefined || finalData.momoSales === null
        };
        
        chrome.storage.local.set({ logs: logs }, function() {
          console.log(`Successfully saved integrated log, TID: ${originalTid}, Sales: ${finalData.momoSales}, Stock: ${finalData.momoStock}, Need reopen: ${logs[originalTid].needReopen}`);
        });
      });
    }
  
    // Ensure processData can execute immediately (if page is already fully loaded)
    if (document.readyState === "complete") {
      processData();
    } else {
      window.addEventListener("load", processData);
    }
  }
})();
    
    
