document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const batchBtn = document.getElementById('batchBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyBtn = document.getElementById('copyBtn');
  const openProgressBtn = document.getElementById('openProgressBtn');
  const statusDiv = document.getElementById('status');
  const statsDiv = document.getElementById('stats');
  const dataBody = document.getElementById('dataBody');
  
  // Batch processing related elements
  const batchSection = document.getElementById('batchSection');
  const urlList = document.getElementById('urlList');
  const startBatchBtn = document.getElementById('startBatchBtn');
  const cancelBatchBtn = document.getElementById('cancelBatchBtn');
  const batchProgress = document.getElementById('batchProgress');
  
  let batchUrls = [];
  let batchIndex = 0;
  let batchProcessing = false;
  
  // Load and display data
  function loadAndDisplayData() {
    chrome.storage.local.get(['brandData'], function(result) {
      const data = result.brandData || [];
      displayData(data);
      updateStats(data);
    });
  }
  
  // Display data
  function displayData(data) {
    dataBody.innerHTML = '';
    
    if (data.length === 0) {
      dataBody.innerHTML = '<tr><td colspan="4" class="empty-state">No data available</td></tr>';
      return;
    }
    
    // Sort: batch processing items in order, others by time descending
    const sortedData = data.sort((a, b) => {
      // If both have batch order, sort by batch order
      if (a.batchOrder !== undefined && b.batchOrder !== undefined) {
        return a.batchOrder - b.batchOrder;
      }
      // Batch processing items have priority
      if (a.batchOrder !== undefined) return -1;
      if (b.batchOrder !== undefined) return 1;
      // Others by time descending
      return b.timestamp - a.timestamp;
    });
    
    sortedData.forEach(item => {
      const row = document.createElement('tr');
      const time = new Date(item.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Set row style based on status
      const statusColor = item.brandCount ? '#d4edda' : (item.status === 'Pending' ? '#fff3cd' : '#f8d7da');
      const displayStatus = item.status || (item.brandCount ? 'Completed' : 'Manual');
      
      row.innerHTML = `
        <td title="${item.brandName}">${item.brandName}</td>
        <td style="text-align: right; font-weight: bold;">${item.brandCount || 'Not found'}</td>
        <td style="font-size: 11px;" title="${item.searchKeyword || item.brandName}">${(item.searchKeyword || item.brandName).length > 8 ? (item.searchKeyword || item.brandName).substring(0, 8) + '...' : (item.searchKeyword || item.brandName)}</td>
        <td style="font-size: 11px;">${time}</td>
      `;
      
      // Set row background color
      row.style.backgroundColor = statusColor;
      
      dataBody.appendChild(row);
    });
  }
  
  // Update statistics
  function updateStats(data) {
    const totalBrands = data.length;
    const successfulExtractions = data.filter(item => item.brandCount).length;
    const failedExtractions = totalBrands - successfulExtractions;
    
    if (totalBrands > 0) {
      statsDiv.innerHTML = `
        <strong>Statistics:</strong> 
        Total ${totalBrands} brands,
        Success ${successfulExtractions},
        Failed ${failedExtractions}
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
      const tab = tabs[0];
      
      if (!tab.url.includes('momoshop.com.tw/search/searchShop.jsp')) {
        showStatus('Please use this feature on MOMO search pages', 'error');
        extractBtn.disabled = false;
        extractBtn.textContent = 'Extract Current Page Data';
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: 'extractBrandInfo'}, function(response) {
        extractBtn.disabled = false;
        extractBtn.textContent = 'Extract Current Page Data';
        
        if (chrome.runtime.lastError) {
          showStatus('Cannot connect to page, please refresh and try again', 'error');
          console.error(chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          showStatus('Starting data extraction, please wait a few seconds...', 'success');
          // Delay data refresh to ensure data is saved
          setTimeout(() => {
            loadAndDisplayData();
          }, 4000);
        } else {
          showStatus('Extraction failed, please ensure page is fully loaded', 'error');
        }
      });
    });
  });
  
  // Batch processing button
  batchBtn.addEventListener('click', function() {
    batchSection.style.display = batchSection.style.display === 'none' ? 'block' : 'none';
    if (batchSection.style.display === 'block') {
      batchBtn.textContent = 'Hide Batch Processing';
    } else {
      batchBtn.textContent = 'Batch Processing';
    }
  });
  
  // Cancel batch processing
  cancelBatchBtn.addEventListener('click', function() {
    batchSection.style.display = 'none';
    batchBtn.textContent = 'Batch Processing';
    batchProcessing = false;
    batchProgress.innerHTML = '';
  });
  
  // Start batch processing
  startBatchBtn.addEventListener('click', function() {
    const urlText = urlList.value.trim();
    if (!urlText) {
      showStatus('Please enter URL list', 'error');
      return;
    }
    
    // Parse URL list
    batchUrls = urlText.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('momoshop.com.tw/search/searchShop.jsp'));
    
    if (batchUrls.length === 0) {
      showStatus('No valid MOMO search URLs found', 'error');
      return;
    }
    
    // Pre-create fixed order data items
    initializeBatchData(batchUrls);
    
    // Start batch processing
    batchProcessing = true;
    batchIndex = 0;
    startBatchBtn.disabled = true;
    startBatchBtn.textContent = 'Processing...';
    
    showBatchProgress();
    processBatchUrls();
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
          brandName: searchKeyword,  // Temporarily use search keyword
          brandCount: '',  // To be filled
          searchKeyword: searchKeyword,
          timestamp: Date.now(),
          url: url,
          batchOrder: index,  // Fixed order
          status: 'Pending'
        };
        
        if (existingIndex !== -1) {
          // Update existing item, maintain fixed order
          data[existingIndex] = {...data[existingIndex], ...brandData};
        } else {
          // Add new item
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
  
  // Show batch processing progress
  function showBatchProgress() {
    const progress = Math.round((batchIndex / batchUrls.length) * 100);
    batchProgress.innerHTML = `
      <div class="batch-progress">
        <div>Processing progress: ${batchIndex}/${batchUrls.length} (${progress}%)</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div>Current: ${batchIndex < batchUrls.length ? batchUrls[batchIndex] : 'Completed'}</div>
      </div>
    `;
  }
  
  // Process batch URLs
  function processBatchUrls() {
    if (!batchProcessing || batchIndex >= batchUrls.length) {
      // Complete processing
      batchProcessing = false;
      startBatchBtn.disabled = false;
      startBatchBtn.textContent = 'Start Batch Processing';
      showStatus(`Batch processing completed! Processed ${batchUrls.length} URLs`, 'success');
      showBatchProgress();
      return;
    }
    
    const currentUrl = batchUrls[batchIndex];
    showBatchProgress();
    
    // Open new tab
    chrome.tabs.create({ url: currentUrl, active: false }, function(tab) {
      // Wait for some time before processing next
      setTimeout(() => {
        batchIndex++;
        processBatchUrls();
      }, 5000); // 5 second interval between URLs
    });
  }
  
  // Clear data
  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      chrome.storage.local.set({ brandData: [] }, function() {
        loadAndDisplayData();
        showStatus('Data cleared', 'success');
      });
    }
  });
  
  // Export CSV
  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get(['brandData'], function(result) {
      const data = result.brandData || [];
      
      if (data.length === 0) {
        showStatus('No data to export', 'error');
        return;
      }
      
                   // Create CSV content
      let csvContent = 'Brand Name,Product Count,Search Keyword,Collection Time\n';
      data.forEach(item => {
        const time = new Date(item.timestamp).toLocaleString('en-US');
        csvContent += `"${item.brandName}","${item.brandCount || 'Not found'}","${item.searchKeyword || item.brandName}","${time}"\n`;
      });
      
      // Download CSV file
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `MOMO_Brand_Data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showStatus('CSV file exported', 'success');
    });
  });
  
  // Copy data
  copyBtn.addEventListener('click', function() {
    chrome.storage.local.get(['brandData'], function(result) {
      const data = result.brandData || [];
      
      if (data.length === 0) {
        showStatus('No data to copy', 'error');
        return;
      }
      
      // Create table format text
      let textContent = 'Brand Name\tProduct Count\tSearch Keyword\tCollection Time\n';
      data.forEach(item => {
        const time = new Date(item.timestamp).toLocaleString('en-US');
        textContent += `${item.brandName}\t${item.brandCount || 'Not found'}\t${item.searchKeyword || item.brandName}\t${time}\n`;
      });
      
      // Copy to clipboard
      navigator.clipboard.writeText(textContent).then(function() {
        showStatus('Data copied to clipboard', 'success');
      }).catch(function(err) {
        console.error('Copy failed:', err);
        showStatus('Copy failed', 'error');
      });
    });
  });
  
  // Open progress management page
  openProgressBtn.addEventListener('click', function() {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('progress.html'),
      active: true 
    });
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.brandData) {
      loadAndDisplayData();
    }
  });
  
  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'brandDataUpdated') {
      // Delay refresh to ensure data is saved
      setTimeout(() => {
        loadAndDisplayData();
      }, 500);
    }
  });
  
  // Initial data load
  loadAndDisplayData();
}); 