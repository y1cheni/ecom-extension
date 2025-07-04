// Execute after DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const openTrackerBtn = document.getElementById('openTrackerBtn');
  const trackPriceBtn = document.getElementById('trackPriceBtn');
  const trackShopeeBtn = document.getElementById('trackShopeeBtn');
  const pageInfoElement = document.getElementById('pageInfo');
  const shopeePageInfoElement = document.getElementById('shopeePageInfo');
  const statusMessage = document.getElementById('statusMessage');
  
  // Add event listeners
  openTrackerBtn.addEventListener('click', function() {
    // Send message to background.js to open tracker
    chrome.runtime.sendMessage({
      action: "openPriceTracker"
    }, function(response) {
      if (response && response.success) {
        console.log("Tracker opened successfully");
        // Close popup
        window.close();
      } else {
        console.error("Failed to open tracker");
        showStatus("Failed to open tracker", "error");
      }
    });
  });
  
  trackPriceBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Send message to content script to extract product info
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "extractProductInfo" },
        function(response) {
          if (response && response.success) {
            showStatus("MOMO product information saved successfully!", "success");
          } else {
            showStatus("Failed to extract MOMO product information", "error");
          }
        }
      );
    });
  });
  
  trackShopeeBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // Send message to content script to extract Shopee product info
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "extractShopeeProductInfo" },
        function(response) {
          if (response && response.success) {
            showStatus("Shopee product information saved successfully!", "success");
            
            // 单独检查当前URL是否需要更新（price not found）
            chrome.storage.local.get(['shopeeData'], function(result) {
              const shopeeData = result.shopeeData || {};
              const currentUrl = tabs[0].url;
              const currentData = shopeeData[currentUrl];
              
              // 如果数据不完整，显示提示并自动重新加载页面尝试获取
              if (currentData && 
                  (!currentData.price || currentData.price === 'Price not found' || 
                   !currentData.name || currentData.name === 'Unknown Product')) {
                console.log("当前Shopee商品数据不完整，自动重新加载页面尝试获取...");
                showStatus("数据不完整，正在重新尝试...", "info");
                
                // 重新加载页面以尝试再次获取数据
                chrome.tabs.reload(tabs[0].id);
              }
            });
          } else {
            showStatus("Failed to extract Shopee product information", "error");
          }
        }
      );
    });
  });
  
  // 查找缺失数据的Shopee商品并自动打开
  function findShopeeProductsToUpdate() {
    chrome.storage.local.get(['shopeeData', 'orderedShopeeUrlList'], function(result) {
      const shopeeData = result.shopeeData || {};
      let shopeeUrls = result.orderedShopeeUrlList || [];
      
      // 如果没有有序列表，则使用所有保存的URL
      if (shopeeUrls.length === 0) {
        shopeeUrls = Object.keys(shopeeData);
      }
      
      // 查找数据不完整的URL
      const incompleteUrls = shopeeUrls.filter(url => {
        const data = shopeeData[url];
        return !data || 
              !data.price || 
              data.price === 'Price not found' || 
              !data.name || 
              data.name === 'Unknown Product';
      });
      
      console.log(`Found ${incompleteUrls.length} Shopee products with incomplete data.`);
      
      // 不再自动弹出确认框，而是仅在用户明确点击时处理
      /* 注释掉原有的自动弹出确认框代码
      if (incompleteUrls.length > 0) {
        if (confirm(`Found ${incompleteUrls.length} Shopee products with incomplete data. Do you want to open and update them?`)) {
          // 打开第一个URL
          openShopeeUrl(incompleteUrls, 0);
        }
      }
      */
      
      // 保存不完整URL列表，供稍后使用
      window.incompleteShopeeUrls = incompleteUrls;
    });
  }
  
  // 依次打开Shopee URL
  function openShopeeUrl(urls, index) {
    if (index >= urls.length) {
      alert('All Shopee products have been updated!');
      return;
    }
    
    const url = urls[index];
    console.log(`Opening Shopee URL (${index + 1}/${urls.length}): ${url}`);
    
    chrome.tabs.create({ url: url }, function(tab) {
      // 添加一个一次性事件监听器，在标签页更新时检查产品数据
      const tabUpdateListener = function(tabId, changeInfo, tabInfo) {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          // 给页面加载时间
          setTimeout(() => {
            // 发送提取数据的消息
            chrome.tabs.sendMessage(
              tab.id,
              { action: "extractShopeeProductInfo" },
              function(response) {
                console.log(`Data extraction for ${url} response:`, response);
                
                // 检查数据是否现在已完整
                checkDataAndContinue(tab.id, url, urls, index);
              }
            );
          }, 3000);
          
          // 移除事件监听器
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        }
      };
      
      chrome.tabs.onUpdated.addListener(tabUpdateListener);
    });
  }
  
  // 检查数据是否完整，然后继续下一个URL
  function checkDataAndContinue(tabId, url, urls, index) {
    chrome.storage.local.get(['shopeeData'], function(result) {
      const shopeeData = result.shopeeData || {};
      const data = shopeeData[url];
      
      // 检查数据是否现在完整
      const isComplete = data && 
                       data.price && 
                       data.price !== 'Price not found' && 
                       data.name && 
                       data.name !== 'Unknown Product';
      
      console.log(`Data for ${url} is ${isComplete ? 'complete' : 'still incomplete'}.`);
      
      // 关闭当前标签页并打开下一个
      chrome.tabs.remove(tabId, function() {
        // 1秒后打开下一个URL
        setTimeout(() => {
          openShopeeUrl(urls, index + 1);
        }, 1000);
      });
    });
  }
  
  // Check if the current page is a product page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    // Check if it's a MOMO product page
    if (url && url.match(/momoshop\.com\.tw\/goods\/GoodsDetail\.jsp/i)) {
      pageInfoElement.textContent = "MOMO Product Page";
      trackPriceBtn.disabled = false;
    } else {
      pageInfoElement.textContent = "Not a MOMO product page";
      trackPriceBtn.disabled = true;
    }
    
    // Check if it's a Shopee product page - support both URL formats
    const isShopeeProduct = 
      (url && url.match(/shopee\.tw\/.+\.\d+\.\d+/i)) || // 传统格式 product-i.xxx.yyy
      (url && url.match(/shopee\.tw\/product\/\d+\/\d+/i)); // 新格式 product/xxx/yyy
    
    if (isShopeeProduct) {
      shopeePageInfoElement.textContent = "Shopee Product Page";
      trackShopeeBtn.disabled = false;
      
      // Auto-track Shopee product information
      console.log("Auto-tracking Shopee product information");
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "extractShopeeProductInfo" },
        function(response) {
          if (response && response.success) {
            console.log("Auto-tracked Shopee product successfully");
            
            // 不再自动检查缺失数据的商品
            /* 注释掉自动调用findShopeeProductsToUpdate()的代码
            setTimeout(() => {
              // 稍微延迟以确保数据已保存
              findShopeeProductsToUpdate();
            }, 500);
            */
          } else {
            console.error("Failed to auto-track Shopee product");
          }
        }
      );
    } else {
      shopeePageInfoElement.textContent = "Not a Shopee product page";
      trackShopeeBtn.disabled = true;
    }
  });
  
  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(function() {
      statusMessage.style.display = 'none';
    }, 3000);
  }
});

// Check if there's new data since last popup open
chrome.storage.local.get(['productData'], function(result) {
  const data = result.productData || {};
  const productCount = Object.keys(data).length;
  
  if (productCount > 0) {
    console.log(`Found ${productCount} saved products`);
  } else {
    console.log("No product data found");
  }
}); 