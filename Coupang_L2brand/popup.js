document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const toggleSKUBtn = document.getElementById('toggleSKUBtn');
  const countSKUBtn = document.getElementById('countSKUBtn');
  const resetSKUBtn = document.getElementById('resetSKUBtn');
  const batchBtn = document.getElementById('batchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyBtn = document.getElementById('copyBtn');
  const openProgressBtn = document.getElementById('openProgressBtn');
  const statusDiv = document.getElementById('status');
  const statsDiv = document.getElementById('stats');
  const dataBody = document.getElementById('dataBody');
  
  // Statistics elements
  const totalCountEl = document.getElementById('totalCount');
  const completedCountEl = document.getElementById('completedCount');
  const pendingCountEl = document.getElementById('pendingCount');
  const failedCountEl = document.getElementById('failedCount');
  
  // SKU statistics elements
  const skuStatusEl = document.getElementById('skuStatus');
  const skuCurrentPageEl = document.getElementById('skuCurrentPage');
  const skuInStockEl = document.getElementById('skuInStock');
  const skuOutStockEl = document.getElementById('skuOutStock');
  const skuTotalEl = document.getElementById('skuTotal');
  const skuPageInfoEl = document.getElementById('skuPageInfo');
  
  // Batch processing related elements
  const batchSection = document.getElementById('batchSection');
  const urlList = document.getElementById('urlList');
  const startBatchBtn = document.getElementById('startBatchBtn');
  const cancelBatchBtn = document.getElementById('cancelBatchBtn');
  const batchProgress = document.getElementById('batchProgress');
  
  // SKU function status
  let skuEnabled = false;
  
  // Initialize SKU function status
  function initSKUStatus() {
    chrome.storage.local.get(['skuEnabled'], function(result) {
      skuEnabled = result.skuEnabled || false;
      updateSKUButtonState();
      updateTableHeader(); // Update table header on initialization
    });
  }
  
  // Update table header
  function updateTableHeader() {
    const tableHead = document.querySelector('#dataTable thead tr');
    if (skuEnabled) {
      // Show full columns when SKU function is enabled
      tableHead.innerHTML = `
        <th style="width: 18%;">L2 Category</th>
        <th style="width: 18%;">Brand Name</th>
        <th style="width: 12%;">In Stock</th>
        <th style="width: 12%;">Out of Stock</th>
        <th style="width: 20%;">Category Code</th>
        <th style="width: 20%;">Brand Code</th>
      `;
    } else {
      // Show only basic columns when SKU function is disabled
      tableHead.innerHTML = `
        <th style="width: 25%;">L2 Category</th>
        <th style="width: 25%;">Brand Name</th>
        <th style="width: 25%;">Category Code</th>
        <th style="width: 25%;">Brand Code</th>
      `;
    }
  }
  
  // Update SKU button state
  function updateSKUButtonState() {
    if (skuEnabled) {
      toggleSKUBtn.textContent = 'Disable SKU Statistics';
      toggleSKUBtn.style.backgroundColor = '#dc3545';
      countSKUBtn.style.display = 'inline-block';
    } else {
      toggleSKUBtn.textContent = 'Enable SKU Statistics';
      toggleSKUBtn.style.backgroundColor = '#2196F3';
      countSKUBtn.style.display = 'none';
      skuStatusEl.style.display = 'none';
      resetSKUBtn.style.display = 'none';
    }
    
    // Update table header and data
    updateTableHeader();
    loadAndDisplayData();
  }
  
  // SKU function toggle button
  toggleSKUBtn.addEventListener('click', function() {
    skuEnabled = !skuEnabled;
    chrome.storage.local.set({skuEnabled: skuEnabled}, function() {
      updateSKUButtonState();
      showStatus(skuEnabled ? 'SKU Statistics function enabled' : 'SKU Statistics function disabled', 'success');
    });
  });
  
  // Load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get(['coupangData'], function(result) {
      const data = result.coupangData || [];
      displayData(data);
      updateStats(data);
    });
  }
  
  // Display data
  function displayData(data) {
    dataBody.innerHTML = '';
    
    if (data.length === 0) {
      const colspan = skuEnabled ? 6 : 4;
      dataBody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">No data available</td></tr>`;
      return;
    }
    
    // Sort: batch processing items by order, others by time descending
    const sortedData = data.sort((a, b) => {
      // If both have batch order, sort by batch order
      if (a.batchOrder !== undefined && b.batchOrder !== undefined) {
        return a.batchOrder - b.batchOrder;
      }
      // Batch processing items take priority
      if (a.batchOrder !== undefined) return -1;
      if (b.batchOrder !== undefined) return 1;
      // Others by time descending
      return b.timestamp - a.timestamp;
    });
    
    sortedData.forEach(item => {
      const row = document.createElement('tr');
      
      // Set row style based on status
      const statusColor = item.status === 'Completed' ? '#d4edda' : 
                         item.status === 'Incomplete Data' ? '#fff3cd' : 
                         item.status === 'Pending Collection' ? '#fff3cd' : '#f8d7da';
      
      if (skuEnabled) {
        // Show full columns when SKU function is enabled
        row.innerHTML = `
          <td title="${item.l2Name || ''}">${truncateText(item.l2Name || '-', 10)}</td>
          <td title="${item.brandName || ''}">${truncateText(item.brandName || '-', 10)}</td>
          <td style="text-align: right; font-weight: bold; color: #28a745;">${item.inStockCount || '-'}</td>
          <td style="text-align: right; font-weight: bold; color: #dc3545;">${item.outOfStockCount || '-'}</td>
          <td style="font-size: 10px;" title="${item.l2Type || ''}">${truncateText(item.l2Type || '-', 15)}</td>
          <td style="font-size: 10px;" title="${item.brandCode || ''}">${truncateText(item.brandCode || '-', 15)}</td>
        `;
      } else {
        // Show only basic columns when SKU function is disabled
        row.innerHTML = `
          <td title="${item.l2Name || ''}">${truncateText(item.l2Name || '-', 15)}</td>
          <td title="${item.brandName || ''}">${truncateText(item.brandName || '-', 15)}</td>
          <td style="font-size: 10px;" title="${item.l2Type || ''}">${truncateText(item.l2Type || '-', 20)}</td>
          <td style="font-size: 10px;" title="${item.brandCode || ''}">${truncateText(item.brandCode || '-', 20)}</td>
        `;
      }
      
      // Set row background color
      row.style.backgroundColor = statusColor;
      
      dataBody.appendChild(row);
    });
  }
  
  // Truncate text
  function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  // Update statistics
  function updateStats(data) {
    const totalCount = data.length;
    const completedCount = data.filter(item => item.status === 'Completed').length;
    const pendingCount = data.filter(item => item.status === 'Pending Collection').length;
    const failedCount = data.filter(item => item.status === 'Incomplete Data').length;
    
    // Update statistics cards
    totalCountEl.textContent = totalCount;
    completedCountEl.textContent = completedCount;
    pendingCountEl.textContent = pendingCount;
    failedCountEl.textContent = failedCount;
    
    // Keep original text statistics display
    if (totalCount > 0) {
      statsDiv.innerHTML = `
        <strong>Statistics:</strong> 
        Total ${totalCount} items,
        Success ${completedCount} items,
        Failed ${failedCount} items
      `;
    } else {
      statsDiv.innerHTML = '';
    }
  }
  
  // Show status message
  function showStatus(message, type = 'success') {
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => {
      statusDiv.innerHTML = '';
    }, 3000);
  }
  
  // Extract current page data
  extractBtn.addEventListener('click', function() {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: () => window.location.href.includes('tw.coupang.com/categories/')
      }, function(results) {
        if (!results || !results[0] || !results[0].result) {
          showStatus('Please use this function on Coupang category pages', 'error');
          extractBtn.disabled = false;
          extractBtn.textContent = 'Extract Current Page Data';
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'extractData'}, function(response) {
          extractBtn.disabled = false;
          extractBtn.textContent = 'Extract Current Page Data';
          
          if (chrome.runtime.lastError || !response) {
            showStatus('Unable to connect to page, please refresh and try again', 'error');
            return;
          }
          
          if (response.success) {
            console.log('Data extraction successful:', response);
            showStatus('Data extraction started, please wait a few seconds...', 'success');
            // Delay refresh data to ensure data is saved
            setTimeout(() => {
              loadAndDisplayData();
            }, 2000);
          } else {
            showStatus('Extraction failed, please ensure page is fully loaded', 'error');
          }
        });
      });
    });
  });
  
  // SKU statistics button
  countSKUBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: () => window.location.href.includes('tw.coupang.com/categories/')
      }, function(results) {
        if (!results || !results[0] || !results[0].result) {
          showStatus('Please use this function on Coupang category pages', 'error');
          return;
        }
        
        // Show SKU statistics status
        skuStatusEl.style.display = 'block';
        resetSKUBtn.style.display = 'inline-block';
        countSKUBtn.textContent = 'Counting...';
        countSKUBtn.disabled = true;
        
        skuCurrentPageEl.textContent = 'Starting statistics...';
        skuInStockEl.textContent = '0';
        skuOutStockEl.textContent = '0';
        skuTotalEl.textContent = '0';
        skuPageInfoEl.textContent = 'Please check detailed progress on the page';
        
        console.log('Sending SKU statistics request to content script...');
        chrome.tabs.sendMessage(tabs[0].id, {action: 'startSKUCount'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Message sending failed:', chrome.runtime.lastError);
            showStatus('Unable to connect to page, please refresh and try again', 'error');
            resetSKUInterface();
            return;
          }
          
          console.log('Received content script response:', response);
          if (response && response.success) {
            showStatus('SKU statistics started, system will automatically count all pages continuously', 'success');
          } else {
            showStatus('Statistics failed, please ensure page is fully loaded', 'error');
            resetSKUInterface();
          }
        });
      });
    });
  });
  
  // Reset SKU statistics button
  resetSKUBtn.addEventListener('click', function() {
    // Clear statistics data in localStorage
    localStorage.removeItem('skuInStock');
    localStorage.removeItem('skuOutStock');
    localStorage.removeItem('skuTotal');
    localStorage.removeItem('currentPageNum');
    localStorage.removeItem('totalPages');
    
    resetSKUInterface();
    
    showStatus('SKU statistics has been reset', 'success');
  });
  
  // Reset SKU statistics interface
  function resetSKUInterface() {
    countSKUBtn.textContent = 'Start SKU Statistics';
    countSKUBtn.disabled = false;
    skuStatusEl.style.display = 'none';
    resetSKUBtn.style.display = 'none';
  }
  
  // Start SKU monitoring
  function startSKUMonitoring() {
    const interval = setInterval(() => {
      const inStock = localStorage.getItem('skuInStock') || '0';
      const outStock = localStorage.getItem('skuOutStock') || '0';
      const total = localStorage.getItem('skuTotal') || '0';
      const currentPage = localStorage.getItem('currentPageNum') || '1';
      const totalPages = localStorage.getItem('totalPages') || '?';
      
      if (skuInStockEl) {
        skuInStockEl.textContent = inStock;
        skuOutStockEl.textContent = outStock;
        skuTotalEl.textContent = total;
        skuPageInfoEl.textContent = `Current Page: ${currentPage}/${totalPages}`;
      }
      
      // If statistics are complete (no more operations), stop monitoring
      if (currentPage !== '1' && currentPage === totalPages && totalPages !== '?') {
        clearInterval(interval);
        countSKUBtn.textContent = 'Start SKU Statistics';
        countSKUBtn.disabled = false;
        skuCurrentPageEl.textContent = 'Statistics completed';
        showStatus('SKU statistics completed', 'success');
      }
    }, 1000);
  }
  
  // Update SKU progress
  function updateSKUProgress(stats) {
    if (stats) {
      skuInStockEl.textContent = stats.inStock || '0';
      skuOutStockEl.textContent = stats.outStock || '0';
      skuTotalEl.textContent = stats.total || '0';
      
      if (stats.currentPage && stats.totalPages) {
        skuPageInfoEl.textContent = `Current Page: ${stats.currentPage}/${stats.totalPages}`;
      }
      
      if (stats.status) {
        skuCurrentPageEl.textContent = stats.status;
      }
    }
  }
  
  // Clear data
  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data?')) {
      chrome.storage.local.remove('coupangData', function() {
        loadAndDisplayData();
        showStatus('Data cleared successfully', 'success');
      });
    }
  });
  
  // Export CSV
  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get(['coupangData'], function(result) {
      const data = result.coupangData || [];
      if (data.length === 0) {
        showStatus('No data to export', 'error');
        return;
      }
      
      // Create CSV content
      const headers = skuEnabled 
        ? ['L2_Category', 'Brand_Name', 'In_Stock', 'Out_of_Stock', 'Category_Code', 'Brand_Code']
        : ['L2_Category', 'Brand_Name', 'Category_Code', 'Brand_Code'];
      
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(item => {
        const csvRow = skuEnabled 
          ? [
              `"${(item.l2Name || '').replace(/"/g, '""')}"`,
              `"${(item.brandName || '').replace(/"/g, '""')}"`,
              item.inStockCount || '0',
              item.outOfStockCount || '0',
              `"${(item.l2Type || '').replace(/"/g, '""')}"`,
              `"${(item.brandCode || '').replace(/"/g, '""')}"`
            ]
          : [
              `"${(item.l2Name || '').replace(/"/g, '""')}"`,
              `"${(item.brandName || '').replace(/"/g, '""')}"`,
              `"${(item.l2Type || '').replace(/"/g, '""')}"`,
              `"${(item.brandCode || '').replace(/"/g, '""')}"`
            ];
        csvContent += csvRow.join(',') + '\n';
      });
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Coupang_L2brand_Data_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      showStatus('CSV file exported successfully', 'success');
    });
  });
  
  // Copy data
  copyBtn.addEventListener('click', function() {
    chrome.storage.local.get(['coupangData'], function(result) {
      const data = result.coupangData || [];
      if (data.length === 0) {
        showStatus('No data to copy', 'error');
        return;
      }
      
      // Create tab-separated format data
      const headers = skuEnabled 
        ? ['L2 Category', 'Brand Name', 'In Stock', 'Out of Stock', 'Category Code', 'Brand Code']
        : ['L2 Category', 'Brand Name', 'Category Code', 'Brand Code'];
      
      let textContent = headers.join('\t') + '\n';
      
      data.forEach(item => {
        const textRow = skuEnabled 
          ? [
              item.l2Name || '',
              item.brandName || '',
              item.inStockCount || '0',
              item.outOfStockCount || '0',
              item.l2Type || '',
              item.brandCode || ''
            ]
          : [
              item.l2Name || '',
              item.brandName || '',
              item.l2Type || '',
              item.brandCode || ''
            ];
        textContent += textRow.join('\t') + '\n';
      });
      
      // Copy to clipboard
      navigator.clipboard.writeText(textContent).then(() => {
        showStatus('Data copied to clipboard successfully', 'success');
      }).catch(() => {
        showStatus('Copy failed, please copy manually', 'error');
      });
    });
  });
  
  // Batch processing
  function initializeBatchDataFromPairs(categoryBrandPairs) {
    const batchData = [];
    categoryBrandPairs.forEach((pair, index) => {
      batchData.push({
        l2Name: pair.category,
        brandName: pair.brand,
        l2Type: '',
        brandCode: '',
        status: 'Pending Collection',
        timestamp: Date.now(),
        batchOrder: index,
        inStockCount: 0,
        outOfStockCount: 0
      });
    });
    
    return batchData;
  }
  
  batchBtn.addEventListener('click', function() {
    batchSection.style.display = batchSection.style.display === 'none' ? 'block' : 'none';
  });
  
  cancelBatchBtn.addEventListener('click', function() {
    batchSection.style.display = 'none';
  });
  
  startBatchBtn.addEventListener('click', function() {
    const urlText = urlList.value.trim();
    if (!urlText) {
      showStatus('Please enter category brand list', 'error');
      return;
    }
    
    // Parse input data
    const lines = urlText.split('\n').filter(line => line.trim());
    const categoryBrandPairs = [];
    
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        categoryBrandPairs.push({
          category: parts[0].trim(),
          brand: parts[1].trim()
        });
      }
    }
    
    if (categoryBrandPairs.length === 0) {
      showStatus('No valid category brand pairs found, please check format', 'error');
      return;
    }
    
    // Initialize batch data
    const batchData = initializeBatchDataFromPairs(categoryBrandPairs);
    
    // Save to storage
    chrome.storage.local.set({coupangData: batchData}, function() {
      loadAndDisplayData();
      showStatus(`Batch processing initialized, ${categoryBrandPairs.length} tasks added`, 'success');
      batchSection.style.display = 'none';
      
      // Show batch progress
      updateBatchProgress(0, categoryBrandPairs.length, 'Ready to start batch processing');
    });
  });
  
  function updateBatchProgress(completed, total, status) {
    batchProgress.innerHTML = `
      <div class="batch-progress">
        <div style="margin-bottom: 10px;">
          <strong>Batch Progress:</strong> ${completed}/${total} (${Math.round(completed/total*100)}%)
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${completed/total*100}%"></div>
        </div>
        <div style="margin-top: 8px; color: #666; font-size: 11px;">
          ${status}
        </div>
      </div>
    `;
  }
  
  // Open progress management window
  openProgressBtn.addEventListener('click', function() {
    chrome.windows.create({
      url: chrome.runtime.getURL('progress.html'),
      type: 'popup',
      width: 1000,
      height: 700
    });
  });
  
  // Initialize page
  initSKUStatus();
  loadAndDisplayData();
  
  // Start SKU monitoring (if needed)
  if (skuEnabled) {
    startSKUMonitoring();
  }
}); 