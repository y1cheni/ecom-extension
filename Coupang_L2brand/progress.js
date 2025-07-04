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
  let skuEnabled = false; // SKU function status
  
  // Initialize SKU function status
  function initSKUStatus() {
    chrome.storage.local.get(['skuEnabled'], function(result) {
      skuEnabled = result.skuEnabled || false;
      updateTableHeader();
    });
  }
  
  // Update table header
  function updateTableHeader() {
    const tableHeader = document.getElementById('tableHeader');
    if (skuEnabled) {
      // Show full columns when SKU function is enabled
      tableHeader.innerHTML = `
        <th style="width: 30px;">#</th>
        <th style="width: 16%;">L2 Category</th>
        <th style="width: 16%;">Brand Name</th>
        <th style="width: 10%;">In Stock</th>
        <th style="width: 10%;">Out of Stock</th>
        <th style="width: 16%;">Category Code</th>
        <th style="width: 16%;">Brand Code</th>
        <th style="width: 60px;">Status</th>
      `;
    } else {
      // Show only basic columns when SKU function is disabled
      tableHeader.innerHTML = `
        <th style="width: 30px;">#</th>
        <th style="width: 25%;">L2 Category</th>
        <th style="width: 25%;">Brand Name</th>
        <th style="width: 20%;">Category Code</th>
        <th style="width: 20%;">Brand Code</th>
        <th style="width: 60px;">Status</th>
      `;
    }
  }
  
  // Show message
  function showMessage(message, type = 'success') {
    messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => {
      messageArea.innerHTML = '';
    }, 5000);
  }
  
  // Truncate text
  function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  // Start batch processing
  startBatchFullBtn.addEventListener('click', function() {
    const inputText = urlListFull.value.trim();
    if (!inputText) {
      showMessage('Please enter category brand list', 'error');
      return;
    }
    
    // Parse category brand list
    const categoryBrandPairs = inputText.split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          return {
            category: parts[0].trim(),
            brand: parts[1].trim()
          };
        }
        return null;
      })
      .filter(pair => pair !== null);
    
    if (categoryBrandPairs.length === 0) {
      showMessage('No valid category brand pairs found, please ensure using tab separator', 'error');
      return;
    }
    
    // Pre-create fixed order data items
    initializeBatchDataFromPairs(categoryBrandPairs);
    
    progressDisplay.style.display = 'block';
    showMessage(`Created ${categoryBrandPairs.length} data items, please manually visit corresponding Coupang pages for data collection`, 'success');
    
    // Start auto refresh to monitor data updates
    startAutoRefresh();
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
    if (confirm('Are you sure you want to clear all data? This operation cannot be undone.')) {
      chrome.storage.local.set({ coupangData: [] }, function() {
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
  
  // Pre-create fixed order data items (from category brand pairs)
  function initializeBatchDataFromPairs(categoryBrandPairs) {
    chrome.storage.local.get(['coupangData'], function(result) {
      let data = result.coupangData || [];
      
      categoryBrandPairs.forEach((pair, index) => {
        // Check if same category brand combination already exists
        const existingIndex = data.findIndex(item => 
          item.l2Name === pair.category && item.brandName === pair.brand
        );
        
        const coupangData = {
          l2Type: '', // To be filled
          l2Name: pair.category,
          brandCode: '', // To be filled
          brandName: pair.brand,
          timestamp: Date.now(),
          url: '', // To be filled
          batchOrder: index, // Fixed order
          status: 'Pending Collection'
        };
        
        // Only add SKU related fields when SKU function is enabled
        if (skuEnabled) {
          coupangData.skuAmount = ''; // To be filled
        }
        
        if (existingIndex !== -1) {
          // Update existing item, maintain fixed order and existing data
          const originalItem = data[existingIndex];
          
          // Check if original data is completed, if so protect data from being overwritten
          const isOriginalCompleted = originalItem.status === 'Completed';
          
          const updatedItem = {
            ...originalItem,
            l2Name: pair.category,
            brandName: pair.brand,
            batchOrder: index,
          };
          
          // Only re-judge status when original data is not completed
          if (!isOriginalCompleted) {
            // Judge completion status based on SKU function state
            if (skuEnabled) {
              updatedItem.status = originalItem.l2Type && originalItem.brandCode && originalItem.skuAmount ? 'Completed' : 'Pending Collection';
            } else {
              updatedItem.status = originalItem.l2Type && originalItem.brandCode ? 'Completed' : 'Pending Collection';
            }
          }
          // If original data is completed, maintain original status
          
          data[existingIndex] = updatedItem;
          console.log(`Updated batch data item: ${pair.category} - ${pair.brand}${isOriginalCompleted ? ' [Data Protected]' : ''}`);
        } else {
          // Add new item
          data.push(coupangData);
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
      
      chrome.storage.local.set({ coupangData: data }, function() {
        loadAndDisplayData();
      });
    });
  }
  
  // Update current processing
  function updateCurrentProcessing(message) {
    if (currentProcessing) {
      currentProcessing.textContent = message;
    }
  }
  
  // Start auto refresh
  function startAutoRefresh() {
    if (!refreshInterval) {
      refreshInterval = setInterval(() => {
        loadAndDisplayData();
        updateProgressStats();
      }, 2000);
    }
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
    chrome.storage.local.get(['coupangData'], function(result) {
      const data = result.coupangData || [];
      
      const total = data.length;
      const completed = data.filter(item => item.status === 'Completed').length;
      const pending = data.filter(item => item.status === 'Pending Collection').length;
      const error = data.filter(item => item.status === 'Incomplete Data').length;
      
      totalCount.textContent = total;
      completedCount.textContent = completed;
      pendingCount.textContent = pending;
      errorCount.textContent = error;
      
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      progressFill.style.width = percentage + '%';
      progressText.textContent = percentage + '%';
      
      if (completed === total && total > 0) {
        updateCurrentProcessing('All processing completed!');
      } else if (total > 0) {
        updateCurrentProcessing(`Processing... ${completed}/${total} completed`);
      }
    });
  }
  
  // Load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get(['coupangData'], function(result) {
      const data = result.coupangData || [];
      displayData(data);
    });
  }
  
  // Display data
  function displayData(data) {
    dataTableBody.innerHTML = '';
    
    if (data.length === 0) {
      const colspan = skuEnabled ? 8 : 6;
      dataTableBody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">No data available</td></tr>`;
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
    
    sortedData.forEach((item, index) => {
      const row = document.createElement('tr');
      
      // Set row class based on status
      let statusClass = '';
      let statusText = '';
      
      switch(item.status) {
        case 'Completed':
          statusClass = 'status-completed';
          statusText = 'Done';
          break;
        case 'Pending Collection':
          statusClass = 'status-pending';
          statusText = 'Pending';
          break;
        case 'Incomplete Data':
          statusClass = 'status-error';
          statusText = 'Error';
          break;
        default:
          statusClass = 'status-pending';
          statusText = 'Unknown';
      }
      
      row.className = statusClass;
      
      if (skuEnabled) {
        // Show full columns when SKU function is enabled
        row.innerHTML = `
          <td>${index + 1}</td>
          <td title="${item.l2Name || ''}">${truncateText(item.l2Name || '-', 12)}</td>
          <td title="${item.brandName || ''}">${truncateText(item.brandName || '-', 12)}</td>
          <td style="text-align: right; font-weight: bold; color: #28a745;">${item.inStockCount || '-'}</td>
          <td style="text-align: right; font-weight: bold; color: #dc3545;">${item.outOfStockCount || '-'}</td>
          <td style="font-size: 11px;" title="${item.l2Type || ''}">${truncateText(item.l2Type || '-', 15)}</td>
          <td style="font-size: 11px;" title="${item.brandCode || ''}">${truncateText(item.brandCode || '-', 15)}</td>
          <td><span class="status-badge">${statusText}</span></td>
        `;
      } else {
        // Show only basic columns when SKU function is disabled
        row.innerHTML = `
          <td>${index + 1}</td>
          <td title="${item.l2Name || ''}">${truncateText(item.l2Name || '-', 20)}</td>
          <td title="${item.brandName || ''}">${truncateText(item.brandName || '-', 20)}</td>
          <td style="font-size: 11px;" title="${item.l2Type || ''}">${truncateText(item.l2Type || '-', 20)}</td>
          <td style="font-size: 11px;" title="${item.brandCode || ''}">${truncateText(item.brandCode || '-', 20)}</td>
          <td><span class="status-badge">${statusText}</span></td>
        `;
      }
      
      dataTableBody.appendChild(row);
    });
  }
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && (changes.coupangData || changes.skuEnabled)) {
      if (changes.skuEnabled) {
        skuEnabled = changes.skuEnabled.newValue || false;
        updateTableHeader();
      }
      loadAndDisplayData();
      updateProgressStats();
    }
  });
  
  // Initialize page
  initSKUStatus();
  loadAndDisplayData();
  updateProgressStats();
}); 