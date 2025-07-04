document.addEventListener('DOMContentLoaded', function() {
  // Get page elements
  const urlListFull = document.getElementById('urlListFull');
  const startBatchFullBtn = document.getElementById('startBatchFullBtn');
  const stopBatchBtn = document.getElementById('stopBatchBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const messageArea = document.getElementById('messageArea');
  const progressDisplay = document.getElementById('progressDisplay');
  const dataTableBody = document.getElementById('dataTableBody');
  
  // Progress display elements
  const totalCount = document.getElementById('totalCount');
  const completedCount = document.getElementById('completedCount');
  const pendingCount = document.getElementById('pendingCount');
  const errorCount = document.getElementById('errorCount');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const currentProcessing = document.getElementById('currentProcessing');
  
  let refreshInterval;
  let batchUrls = [];
  let batchIndex = 0;
  let batchProcessing = false;
  
  // Show message
  function showMessage(message, type = 'success') {
    messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => {
      messageArea.innerHTML = '';
    }, 5000);
  }
  
  // Start batch processing
  startBatchFullBtn.addEventListener('click', function() {
    const urlText = urlListFull.value.trim();
    if (!urlText) {
      showMessage('Please enter URL list', 'error');
      return;
    }
    
    // Parse URL list
    batchUrls = urlText.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('momoshop.com.tw/search/searchShop.jsp'));
    
    if (batchUrls.length === 0) {
      showMessage('No valid MOMO search URLs found', 'error');
      return;
    }
    
    // Pre-create fixed order data items
    initializeBatchData(batchUrls);
    
    // Start batch processing
    batchProcessing = true;
    batchIndex = 0;
    startBatchFullBtn.disabled = true;
    startBatchFullBtn.textContent = 'Processing...';
    stopBatchBtn.disabled = false;
    
    progressDisplay.style.display = 'block';
    showMessage(`Started batch processing ${batchUrls.length} URLs`, 'success');
    
    // Start auto refresh
    startAutoRefresh();
    
    // Start processing
    processBatchUrls();
  });
  
  // Stop batch processing
  stopBatchBtn.addEventListener('click', function() {
    batchProcessing = false;
    startBatchFullBtn.disabled = false;
    startBatchFullBtn.textContent = 'Start Batch Processing';
    stopBatchBtn.disabled = true;
    
    showMessage('Batch processing stopped', 'error');
    updateCurrentProcessing('Processing stopped');
    
    stopAutoRefresh();
  });
  
  // Clear all data
  clearAllBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      chrome.storage.local.set({ brandData: [] }, function() {
        showMessage('All data cleared', 'success');
        loadAndDisplayData();
        progressDisplay.style.display = 'none';
        batchProcessing = false;
        startBatchFullBtn.disabled = false;
        startBatchFullBtn.textContent = 'Start Batch Processing';
        stopBatchBtn.disabled = true;
        stopAutoRefresh();
      });
    }
  });
  
  // Pre-create fixed order data items
  function initializeBatchData(urls) {
    chrome.storage.local.get(['brandData'], function(result) {
      let data = result.brandData || [];
      
      urls.forEach((url, index) => {
        const urlParams = new URLSearchParams(new URL(url).search);
        const searchKeyword = urlParams.get('keyword') || `Brand${index + 1}`;
        
        // Check if already exists
        const existingIndex = data.findIndex(item => 
          item.url === url || item.searchKeyword === searchKeyword
        );
        
        const brandData = {
          brandName: searchKeyword,
          brandCount: '',
          searchKeyword: searchKeyword,
          timestamp: Date.now(),
          url: url,
          batchOrder: index,
          status: 'Waiting to process'
        };
        
        if (existingIndex !== -1) {
          data[existingIndex] = {...data[existingIndex], ...brandData};
        } else {
          data.push(brandData);
        }
      });
      
      // Sort by batch order
      data.sort((a, b) => {
        if (a.batchOrder !== undefined && b.batchOrder !== undefined) {
          return a.batchOrder - b.batchOrder;
        }
        if (a.batchOrder !== undefined) return -1;
        if (b.batchOrder !== undefined) return 1;
        return b.timestamp - a.timestamp;
      });
      
      chrome.storage.local.set({ brandData: data }, function() {
        loadAndDisplayData();
      });
    });
  }
  
  // Batch process URLs
  function processBatchUrls() {
    if (!batchProcessing || batchIndex >= batchUrls.length) {
      // Processing complete
      batchProcessing = false;
      startBatchFullBtn.disabled = false;
      startBatchFullBtn.textContent = 'Start Batch Processing';
      stopBatchBtn.disabled = true;
      showMessage(`Batch processing complete! Processed ${batchUrls.length} URLs`, 'success');
      updateCurrentProcessing('Batch processing completed');
      stopAutoRefresh();
      return;
    }
    
    const currentUrl = batchUrls[batchIndex];
    updateCurrentProcessing(`Processing ${batchIndex + 1} of ${batchUrls.length}: ${currentUrl}`);
    
    // Open new tab
    chrome.tabs.create({ url: currentUrl, active: false }, function(tab) {
      // Wait before processing next URL
      setTimeout(() => {
        batchIndex++;
        processBatchUrls();
      }, 5000); // 5 second interval between URLs
    });
  }
  
  // Update current processing status
  function updateCurrentProcessing(message) {
    if (currentProcessing) {
      currentProcessing.textContent = message;
    }
  }
  
  // Start auto refresh
  function startAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
      loadAndDisplayData();
      updateProgressStats();
    }, 2000); // Refresh every 2 seconds
  }
  
  // Stop auto refresh
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  // Update progress statistics
  function updateProgressStats() {
    chrome.storage.local.get(['brandData'], function(result) {
      const data = result.brandData || [];
      const batchItems = data.filter(item => item.batchOrder !== undefined);
      
      const total = batchItems.length;
      const completed = batchItems.filter(item => item.brandCount && item.brandCount !== '').length;
      const errors = batchItems.filter(item => item.status === 'No data found').length;
      const pending = total - completed - errors;
      
      // Update statistics numbers
      totalCount.textContent = total;
      completedCount.textContent = completed;
      pendingCount.textContent = pending;
      errorCount.textContent = errors;
      
      // Update progress bar
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
    });
  }
  
  // Load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get(['brandData'], function(result) {
      const data = result.brandData || [];
      displayData(data);
    });
  }
  
  // Display data
  function displayData(data) {
    dataTableBody.innerHTML = '';
    
    if (data.length === 0) {
      dataTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #666; font-style: italic; padding: 30px;">
            No data available
          </td>
        </tr>
      `;
      return;
    }
    
    // Sort: batch processing items in order, others by time descending
    const sortedData = data.sort((a, b) => {
      if (a.batchOrder !== undefined && b.batchOrder !== undefined) {
        return a.batchOrder - b.batchOrder;
      }
      if (a.batchOrder !== undefined) return -1;
      if (b.batchOrder !== undefined) return 1;
      return b.timestamp - a.timestamp;
    });
    
    sortedData.forEach((item, index) => {
      const row = document.createElement('tr');
      const time = new Date(item.timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Determine status
      let status = 'Manual';
      let statusClass = 'status-success';
      
      if (item.batchOrder !== undefined) {
        if (item.brandCount && item.brandCount !== '') {
          status = 'Completed';
          statusClass = 'status-success';
        } else if (item.status === 'No data found') {
          status = 'Failed';
          statusClass = 'status-error';
        } else if (batchProcessing && batchIndex === item.batchOrder) {
          status = 'Processing';
          statusClass = 'status-processing';
        } else {
          status = 'Pending';
          statusClass = 'status-pending';
        }
      }
      
      row.innerHTML = `
        <td style="font-weight: bold; color: #666;">${item.batchOrder !== undefined ? item.batchOrder + 1 : '-'}</td>
        <td title="${item.brandName}">${item.brandName}</td>
        <td style="text-align: right; font-weight: bold; color: ${item.brandCount ? '#155724' : '#721c24'};">
          ${item.brandCount || '-'}
        </td>
        <td>
          <span class="status-badge ${statusClass}">${status}</span>
        </td>
        <td style="font-size: 11px; color: #666;">${time}</td>
      `;
      
      dataTableBody.appendChild(row);
    });
  }
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.brandData) {
      loadAndDisplayData();
      if (batchProcessing) {
        updateProgressStats();
      }
    }
  });
  
  // Initialize when page loads
  loadAndDisplayData();
  
  // Stop auto refresh when page unloads
  window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
  });
}); 