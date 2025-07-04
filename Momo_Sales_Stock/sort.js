// Global variable to store locked TID order
let lockedTids = [];
// Update interval timer, default auto-update every 5 seconds
let updateInterval = null;

// Global variables
let tidData = {};
let settings = {
  maxRetries: 10,
  defaultDelay: 500,
  autoClose: true,
  reloadDelay: 1000,
  blockingEnabled: true
};

// Batch processing variables
let batchTids = [];
let processedCount = 0;
let totalCount = 0;
let activeTabs = [];
let startTime = 0;
let batchRunning = false;

// Current batch task ID
let currentBatchId = null;

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM fully loaded, initializing...");
  
  const lockButton = document.getElementById('lockDataButton');
  const refreshButton = document.getElementById('refreshButton');
  const tidInput = document.getElementById('tidInput');
  const resultArea = document.getElementById('resultArea');
  const clearLogsButton = document.getElementById('clearLogs');
  const startProcessButton = document.getElementById('startProcessButton');
  const exportButton = document.getElementById('exportButton');
  
  // Get newly added button elements
  const pauseProcessButton = document.getElementById('pauseProcessButton');
  const resumeProcessButton = document.getElementById('resumeProcessButton');
  const retryEmptyDataButton = document.getElementById('retryEmptyDataButton');
  
  if (!lockButton || !refreshButton || !tidInput || !resultArea || !clearLogsButton) {
    console.error("Cannot find necessary DOM elements!");
    return;
  }
  
  console.log("All DOM elements found, binding events...");
  
  // Bind lock button event
  lockButton.addEventListener('click', function() {
    console.log("Lock button clicked");
    const tidValue = tidInput.value;
    console.log("Input content:", tidValue);
    
    // Split input content by newline and remove leading/trailing whitespace and empty lines
    lockedTids = tidValue.split('\n').map(s => s.trim()).filter(s => s !== '');
    console.log("Processed TIDs:", lockedTids);
    
    if (lockedTids.length === 0) {
      alert("Please enter at least one TID!");
      return;
    }
    
    // After locking, disable textarea and lock button, show refresh button and result area
    tidInput.disabled = true;
    lockButton.disabled = true;
    refreshButton.style.display = "inline-block";
    if (exportButton) exportButton.style.display = "inline-block";
    resultArea.style.display = "block";
    
    console.log("Interface updated, starting table update...");
    
    // Update table once first
    updateLockedTable();
    
    // Set auto-update every 5 seconds
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    updateInterval = setInterval(updateLockedTable, 5000);
    console.log("Auto-update interval set: 5 seconds");
  });

  // Refresh button, manually update table
  refreshButton.addEventListener('click', function() {
    console.log("Refresh button clicked");
    updateLockedTable();
  });
  
  // Bind export button event
  if (exportButton) {
    exportButton.addEventListener('click', exportData);
  }
  
  // Clear logs button
  clearLogsButton.addEventListener('click', function() {
    clearLogs();
  });
  
  // Clear cookies button
  const clearCookiesButton = document.getElementById('clearCookies');
  if (clearCookiesButton) {
    clearCookiesButton.addEventListener('click', function() {
      clearMomoCookies();
    });
  }
  
  // Start processing button
  if (startProcessButton) {
    startProcessButton.addEventListener('click', function() {
      startProcessFromSort();
    });
  }
  
  // Resume processing button
  if (resumeProcessButton) {
    resumeProcessButton.addEventListener('click', function() {
      resumeBatchProcessing();
    });
  }
  
  // Retry empty data button
  if (retryEmptyDataButton) {
    retryEmptyDataButton.addEventListener('click', function() {
      retryEmptyData();
    });
  }
  
  // Check if there is stored data
  chrome.storage.local.get({ refreshLog: [] }, function(result) {
    console.log("Initial check - log count in storage:", result.refreshLog.length);
  });

  // Load settings
  loadSettings();
  
  // Initialize tab switching
  initTabSwitching();
  
  // Initialize settings related functionality
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  
  // Add listeners for setting switch status changes
  const autoCloseEnabled = document.getElementById('autoCloseEnabled');
  const blockingEnabled = document.getElementById('blockingEnabled');
  
  if (autoCloseEnabled) {
    autoCloseEnabled.addEventListener('change', function() {
      const status = document.getElementById('autoCloseStatus');
      if (status) {
        status.textContent = this.checked ? 'Auto-close after completion' : 'Keep page open';
      }
    });
  }
  
  if (blockingEnabled) {
    blockingEnabled.addEventListener('change', function() {
      const status = document.getElementById('blockingStatus');
      if (status) {
        status.textContent = this.checked ? 'Enabled' : 'Disabled';
      }
    });
  }
  
  // Load log data
  updateLockedTable();
});

function updateLockedTable() {
  console.log("Starting table update...");
  
  if (!lockedTids || lockedTids.length === 0) {
    console.warn("No locked TIDs or list is empty, cannot update table");
    return;
  }
  
  console.log("Updating table, locked TIDs:", lockedTids);
  
  try {
    // Get refreshLog data from chrome.storage
    chrome.storage.local.get(['refreshLog', 'logs'], function(result) {
      console.log("Data retrieved from storage:", result);
      const refreshLogs = result.refreshLog || [];
      const integratedLogs = result.logs || {};
      console.log("Retrieved refreshLog count:", refreshLogs.length);
      console.log("Retrieved logs count:", Object.keys(integratedLogs).length);
      
      if (refreshLogs.length === 0 && Object.keys(integratedLogs).length === 0) {
        console.warn("No log data found");
      }

      // Create mapping table with tid as key; if same TID has multiple records, only take the first one
      let logMap = {};

      // First try to get data from refreshLog
      refreshLogs.forEach(log => {
        if (log && log.tid) {
          // If record for this TID already exists, only replace when new record has valid values
          const hasValidData = log.KAM !== undefined || log.E !== undefined || log.F !== undefined;
          if (!logMap[log.tid] || hasValidData) {
            console.log(`Creating or updating log record for TID ${log.tid} from refreshLog`);
            logMap[log.tid] = {
              tid: log.tid,
              KAM: log.KAM || '',
              E: log.E || 'No Data',
              F: log.F || '1',
              timestamp: log.timestamp || Date.now()
            };
          }
        }
      });

      // Then supplement data from integrated logs
      Object.keys(integratedLogs).forEach(tid => {
        const integratedData = integratedLogs[tid];
        if (integratedData) {
          // If refreshLog doesn't have data for this TID, add from integratedLogs
          if (!logMap[tid]) {
            console.log(`Creating log record for TID ${tid} from integratedLogs`);
            logMap[tid] = {
              tid: tid,
              KAM: integratedData.kam || '',
              E: integratedData.momoSales || 'No Data',
              F: integratedData.momoStock || '1',
              timestamp: integratedData.timestamp || Date.now()
            };
          }
        }
      });

      console.log("Created TID mapping:", logMap);

      // Get tbody of both tables
      const lockedTableBody = document.querySelector('#lockedTable tbody');
      const allTableBody = document.querySelector('#allTable tbody');
      
      if (!lockedTableBody || !allTableBody) {
        console.error("Cannot find table elements!", {
          lockedTableBody: !!lockedTableBody,
          allTableBody: !!allTableBody
        });
        return;
      }
      
      // Clear both tables
      lockedTableBody.innerHTML = "";
      allTableBody.innerHTML = "";
      console.log("Tables cleared, starting to fill data...");
      
      // Create table rows in order of lockedTids
      lockedTids.forEach((tid, index) => {
        console.log(`Processing TID ${index+1}: ${tid}`);
        
        // Create TID table row and cells
        const trTid = document.createElement('tr');
        trTid.setAttribute('data-row-index', index);
        
        const tdTid = document.createElement('td');
        tdTid.textContent = tid;
        tdTid.style.whiteSpace = 'nowrap'; // Avoid TID wrapping
        trTid.appendChild(tdTid);
        
        // Create data table row and cells
        const trData = document.createElement('tr');
        trData.setAttribute('data-row-index', index);
        
        // Create KAM, sales, and stock cells
        const tdKam = document.createElement('td');
        const tdE = document.createElement('td');
        const tdF = document.createElement('td');
        
        if (logMap[tid]) {
          console.log(`Found data for TID ${tid}:`, logMap[tid]);
          const log = logMap[tid];
          
          // Fill data
          tdKam.textContent = log.KAM || '';
          tdE.textContent = log.E || 'No Data';
          tdF.textContent = (log.F !== undefined && log.F !== null) ? log.F : '1';
        } else {
          // No data found, display blank
          console.log(`TID ${tid} not processed, displaying blank`);
          tdKam.textContent = '';
          tdE.textContent = '';
          tdF.textContent = '';
        }
        
        // Add cells to row
        trData.appendChild(tdKam);
        trData.appendChild(tdE);
        trData.appendChild(tdF);
        
        // Add rows to respective tables
        lockedTableBody.appendChild(trTid);
        allTableBody.appendChild(trData);
      });
      
      // Add hover synchronization effect
      addHoverSyncEffect();
      
      console.log("Table update completed");
      
      // Save data to tidData for export functionality
      lockedTids.forEach(tid => {
        if (logMap[tid]) {
          tidData[tid] = {
            kam: logMap[tid].KAM || '',
            momoSales: logMap[tid].E || 'No Data',
            momoStock: logMap[tid].F || '1',
          };
        }
      });
    });
  } catch (error) {
    console.error("Error occurred during table update:", error);
  }
}

// Add table row hover synchronization effect
function addHoverSyncEffect() {
  const tidRows = document.querySelectorAll('#lockedTable tbody tr');
  const dataRows = document.querySelectorAll('#allTable tbody tr');
  
  // Remove all existing event listeners (by cloning and replacing elements)
  tidRows.forEach(row => {
    const newRow = row.cloneNode(true);
    row.parentNode.replaceChild(newRow, row);
  });
  
  dataRows.forEach(row => {
    const newRow = row.cloneNode(true);
    row.parentNode.replaceChild(newRow, row);
  });
  
  // Re-fetch new elements
  const newTidRows = document.querySelectorAll('#lockedTable tbody tr');
  const newDataRows = document.querySelectorAll('#allTable tbody tr');
  
  // Add mouse event listeners to each row of the tid table
  newTidRows.forEach(row => {
    row.addEventListener('mouseover', function() {
      const index = this.getAttribute('data-row-index');
      // Highlight corresponding data row
      const correspondingRow = document.querySelector(`#allTable tbody tr[data-row-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.add('highlight');
        this.classList.add('highlight');
      }
    });
    
    row.addEventListener('mouseout', function() {
      const index = this.getAttribute('data-row-index');
      // Remove highlight
      const correspondingRow = document.querySelector(`#allTable tbody tr[data-row-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.remove('highlight');
        this.classList.remove('highlight');
      }
    });
  });
  
  // Add same mouse event listeners to data table rows
  newDataRows.forEach(row => {
    row.addEventListener('mouseover', function() {
      const index = this.getAttribute('data-row-index');
      // Highlight corresponding tid row
      const correspondingRow = document.querySelector(`#lockedTable tbody tr[data-row-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.add('highlight');
        this.classList.add('highlight');
      }
    });
    
    row.addEventListener('mouseout', function() {
      const index = this.getAttribute('data-row-index');
      // Remove highlight
      const correspondingRow = document.querySelector(`#lockedTable tbody tr[data-row-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.remove('highlight');
        this.classList.remove('highlight');
      }
    });
  });
}

// Tab switching functionality
function initTabSwitching() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove all active classes
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to current tab
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// ------------------- Sorting functionality -------------------

// Lock data
function lockData() {
  const tidInput = document.getElementById('tidInput');
  const tidStrings = tidInput.value.trim().split('\n').filter(tid => tid.trim() !== '');
  
  if (tidStrings.length === 0) {
    alert('Please enter at least one TID');
    return;
  }
  
  // Lock input TIDs
  lockedTids = tidStrings;
  console.log('Locked TID list:', lockedTids);
  
  // Initialize data
  tidData = {};
  
  // Show result area and all buttons
  document.getElementById('resultArea').style.display = 'block';
  document.getElementById('refreshButton').style.display = 'inline-block';
  
  if (document.getElementById('exportButton')) {
    document.getElementById('exportButton').style.display = 'inline-block';
  }
  
  // Disable input and lock buttons
  tidInput.disabled = true;
  document.getElementById('lockDataButton').disabled = true;
  
  // Update tables
  updateTables();
  
  // Get data
  chrome.storage.local.get(['logs'], function(result) {
    const logs = result.logs || {};
    
    // Fill data
    lockedTids.forEach(tid => {
      if (logs[tid]) {
        tidData[tid] = logs[tid];
      }
    });
    
    // Update tables
    updateTables();
  });
}

// Update tables
function updateTables() {
  const tidTableBody = document.querySelector('#lockedTable tbody');
  const dataTableBody = document.querySelector('#allTable tbody');
  
  // Clear tables
  tidTableBody.innerHTML = '';
  dataTableBody.innerHTML = '';
  
  // Fill tables
  lockedTids.forEach((tid, index) => {
    // Create TID row
    const tidRow = document.createElement('tr');
    tidRow.innerHTML = `<td>${tid}</td>`;
    tidTableBody.appendChild(tidRow);
    
    // Create data row
    const dataRow = document.createElement('tr');
    
    if (tidData[tid]) {
      const data = tidData[tid];
      dataRow.innerHTML = `
        <td>${data.kam || 'No Data'}</td>
        <td>${data.momoSales || 'No Data'}</td>
        <td>${data.momoStock || 'No Data'}</td>
      `;
    } else {
      dataRow.innerHTML = `
        <td>No Data</td>
        <td>No Data</td>
        <td>No Data</td>
      `;
    }
    
    dataTableBody.appendChild(dataRow);
    
    // Synchronize mouse hover effect
    tidRow.addEventListener('mouseover', () => {
      tidRow.classList.add('highlight');
      dataRow.classList.add('highlight');
    });
    
    tidRow.addEventListener('mouseout', () => {
      tidRow.classList.remove('highlight');
      dataRow.classList.remove('highlight');
    });
    
    dataRow.addEventListener('mouseover', () => {
      tidRow.classList.add('highlight');
      dataRow.classList.add('highlight');
    });
    
    dataRow.addEventListener('mouseout', () => {
      tidRow.classList.remove('highlight');
      dataRow.classList.remove('highlight');
    });
  });
}

// Refresh data
function refreshData() {
  // Get latest log
  chrome.storage.local.get(['logs'], function(result) {
    const logs = result.logs || {};
    
    // Update data
    lockedTids.forEach(tid => {
      if (logs[tid]) {
        tidData[tid] = logs[tid];
      }
    });
    
    // Update tables
    updateTables();
  });
}

// Export data
function exportData() {
  // Add UTF-8 BOM marker to solve Chinese and number display issues
  let csvContent = '\ufeff' + '"TID","KAM","Momo Sales","Momo Stock"\n';
  
  lockedTids.forEach(tid => {
    let dataRow = `"${tid}"`;
    
    if (tidData[tid]) {
      const data = tidData[tid];
      dataRow += `,"${data.kam || 'N/A'}","${data.momoSales || 'N/A'}","${data.momoStock || 'N/A'}"`;
    } else {
      dataRow += ',"N/A","N/A","N/A"';
    }
    
    csvContent += dataRow + "\n";
  });
  
  // Create Blob object
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `momo_data_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  
  // Add to document and trigger click
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
}

// ------------------- Batch processing functionality -------------------

// Start batch processing from data management page
function startProcessFromSort() {
  if (batchRunning) {
    alert('Batch processing is already in progress');
    return;
  }
  
  if (!lockedTids || lockedTids.length === 0) {
    alert('Please lock data first');
    return;
  }
  
  // Get selected concurrent processing quantity
  const maxConcurrentSelect = document.getElementById('concurrentTabs');
  const maxConcurrent = maxConcurrentSelect ? parseInt(maxConcurrentSelect.value, 10) : 5;
  
  console.log(`Starting to process ${lockedTids.length} items, concurrently processing: ${maxConcurrent} items`);
  
  // Send batch processing request
  chrome.runtime.sendMessage({
    action: 'startBatch',
    tidList: lockedTids,
    maxConcurrent: maxConcurrent
  }, function(response) {
    if (response && response.success) {
      // Save batch ID and start time
      currentBatchId = response.batchId;
      startTime = Date.now();
      batchRunning = true;
      batchTids = lockedTids;
      totalCount = lockedTids.length;
      
      // Update button status
      document.getElementById('startProcessButton').style.display = "none";
      document.getElementById('retryEmptyDataButton').style.display = "none";
      
      // Show progress information
      document.getElementById('batchStatus').style.display = 'block';
      document.getElementById('batchProgress').textContent = `0/${totalCount}`;
      document.getElementById('progressBarFill').style.width = '0%';
      document.getElementById('progressBarFill').textContent = '0%';
      document.getElementById('remainingTime').textContent = 'Calculating...';
      
      // Start timer to update progress
      const timer = setInterval(() => {
        checkBatchStatus(timer);
      }, 1000);
    } else {
      alert('Batch processing start failed: ' + (response.error || 'Unknown error'));
    }
  });
}

// Check batch processing status
function checkBatchStatus(timer) {
  if (!currentBatchId) {
    clearInterval(timer);
    console.log("No current batch ID, stopping status check");
    return;
  }
  
  console.log(`Checking batch processing status: batchId=${currentBatchId}, processing status=${batchRunning?"Processing":"Paused"}`);
  
  // Set request timeout
  let requestTimeout = setTimeout(() => {
    console.warn("Get batch processing status request timeout, possibly backend processing busy or already finished");
    // Don't immediately clear timer, give another chance to try
  }, 5000); // 5 seconds timeout
  
  chrome.runtime.sendMessage({
    action: 'getBatchStatus',
    batchId: currentBatchId
  }, function(response) {
    // Clear timeout timer
    clearTimeout(requestTimeout);
    
    if (response && response.success) {
      const status = response.status;
      
      // Update progress information
      const progress = status.completed / status.total;
      const percentage = Math.round(progress * 100);
      processedCount = status.completed;
      
      // Get active tab page count
      const activeTabCount = status.activeTabs ? Object.keys(status.activeTabs).length : 0;
      
      console.log(`Batch status: completed=${status.completed}/${status.total}, processing=${activeTabCount}, failed=${status.failed || 0}`);
      
      // Update progress
      document.getElementById('batchProgress').textContent = `${status.completed}/${status.total}`;
      document.getElementById('progressBarFill').style.width = `${percentage}%`;
      document.getElementById('progressBarFill').textContent = `${percentage}%`;
      
      // Calculate remaining time
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      
      if (status.completed > 0) {
        const timePerItem = elapsedSeconds / status.completed;
        const remainingItems = status.total - status.completed;
        const estimatedRemainingTime = timePerItem * remainingItems;
        
        let remainingText = '';
        if (estimatedRemainingTime < 60) {
          remainingText = `About ${Math.floor(estimatedRemainingTime)} seconds`;
        } else {
          const mins = Math.floor(estimatedRemainingTime / 60);
          const secs = Math.floor(estimatedRemainingTime % 60);
          remainingText = `About ${mins} minutes ${secs} seconds`;
        }
        
        document.getElementById('remainingTime').textContent = remainingText;
      }
      
      // Check if all tasks are completed
      if (status.completed >= status.total) {
        console.log("All tasks completed, clear timer and update UI");
        clearInterval(timer);
        batchRunning = false;
        
        // Refresh table to display latest data
        updateLockedTable();
        
        // Restore button status
        document.getElementById('resumeProcessButton').style.display = "none";
        document.getElementById('startProcessButton').style.display = "inline-block";
        document.getElementById('retryEmptyDataButton').style.display = "inline-block";
        
        // Maintain completed status display for a while
        setTimeout(() => {
          document.getElementById('batchStatus').style.display = 'none';
          alert('Batch processing completed!');
        }, 2000);
      } 
      // If tasks are still in progress but no active tab pages, may need to check status
      else if (activeTabCount === 0 && batchRunning) {
        console.log("Detected no active tab pages but tasks not completed, check if need to push tasks continue");
        
        // Wait for a while before rechecking
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'getBatchStatus',
            batchId: currentBatchId
          }, function(recheckResponse) {
            if (recheckResponse && recheckResponse.success) {
              const recheckStatus = recheckResponse.status;
              const recheckActiveTabCount = recheckStatus.activeTabs ? Object.keys(recheckStatus.activeTabs).length : 0;
              
              // If rechecking still no active tab pages, and not completed, try to recover processing
              if (recheckActiveTabCount === 0 && recheckStatus.completed < recheckStatus.total && !recheckStatus.paused) {
                console.log("Detected processing stuck, try to recover process");
                // Try to send recovery message to backend
                chrome.runtime.sendMessage({
                  action: 'resumeBatch',
                  batchId: currentBatchId
                });
              }
            }
          });
        }, 5000); // 5 seconds later recheck
      }
    } else {
      // If status retrieval failed, count failed attempts
      console.warn("Get batch processing status failed:", response ? response.error : "Unknown error");
      failureCount = (failureCount || 0) + 1;
      
      // If continuous failed attempts exceed 5 times, consider batch processing finished
      if (failureCount > 5) {
        console.error("Multiple status retrieval failures, consider batch processing finished");
        clearInterval(timer);
        batchRunning = false;
        document.getElementById('batchStatus').style.display = 'none';
        document.getElementById('resumeProcessButton').style.display = "none";
        document.getElementById('retryEmptyDataButton').style.display = "none";
        
        alert('Batch processing seems finished, but unable to get final status, please check results');
      }
    }
  });
}

// Clear log functionality
function clearLogs() {
  console.log("Trying to clear all logs...");
  if (confirm('Are you sure to clear all logs? This operation cannot be restored!')) {
    chrome.storage.local.set({ 
      logs: {},
      refreshLog: [] 
    }, function() {
      console.log('All logs cleared');
      
      // Clear local storage data
      lockedTids = [];
      tidData = {};
      batchTids = [];
      
      // Reset UI
      const tidInput = document.getElementById('tidInput');
      const lockButton = document.getElementById('lockDataButton');
      
      if (tidInput) tidInput.disabled = false;
      if (lockButton) lockButton.disabled = false;
      
      document.getElementById('refreshButton').style.display = 'none';
      
      if (document.getElementById('exportButton')) {
        document.getElementById('exportButton').style.display = 'none';
      }
      
      document.getElementById('resultArea').style.display = 'none';
      
      // Clear tables
      const tidTableBody = document.querySelector('#lockedTable tbody');
      const dataTableBody = document.querySelector('#allTable tbody');
      
      if (tidTableBody) tidTableBody.innerHTML = '';
      if (dataTableBody) dataTableBody.innerHTML = '';
      
      // Stop auto-update
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
      
      // Clear input field
      if (tidInput) tidInput.value = '';
      
      alert('All logs cleared completed');
    });
  }
}

// ------------------- Settings functionality -------------------

// Load settings
function loadSettings() {
  chrome.storage.local.get({
    defaultDelay: 500,
    maxRetries: 10,
    blockingEnabled: true,
    autoClose: true,
    reloadDelay: 1000
  }, function(items) {
    settings = items;
    
    // Update settings UI
    document.getElementById('maxRetries').value = settings.maxRetries;
    document.getElementById('defaultDelay').value = settings.defaultDelay;
    document.getElementById('reloadDelay').value = settings.reloadDelay;
    document.getElementById('autoCloseEnabled').checked = settings.autoClose;
    document.getElementById('blockingEnabled').checked = settings.blockingEnabled;
    
    // Update status text
    updateSettingStatusText();
  });
}

// Update settings status text
function updateSettingStatusText() {
  const autoCloseStatus = document.getElementById('autoCloseStatus');
  if (autoCloseStatus) {
    autoCloseStatus.textContent = document.getElementById('autoCloseEnabled').checked ? 
      'Auto-close after completion' : 'Keep page open';
  }
  
  const blockingStatus = document.getElementById('blockingStatus');
  if (blockingStatus) {
    blockingStatus.textContent = document.getElementById('blockingEnabled').checked ? 
      'Enabled' : 'Disabled';
  }
}

// Save settings
function saveSettings() {
  // Get settings values
  settings.maxRetries = parseInt(document.getElementById('maxRetries').value);
  settings.defaultDelay = parseInt(document.getElementById('defaultDelay').value);
  settings.reloadDelay = parseInt(document.getElementById('reloadDelay').value);
  settings.autoClose = document.getElementById('autoCloseEnabled').checked;
  settings.blockingEnabled = document.getElementById('blockingEnabled').checked;
  
  // Update status text
  updateSettingStatusText();
  
  // Save settings
  chrome.storage.local.set({
    settings: settings,
    maxRetries: settings.maxRetries,
    defaultDelay: settings.defaultDelay,
    reloadDelay: settings.reloadDelay,
    autoClose: settings.autoClose,
    blockingEnabled: settings.blockingEnabled
  }, function() {
    console.log('Settings saved:', settings);
    
    // Show save success information
    const savedMsg = document.getElementById('settingsSaved');
    savedMsg.style.display = 'block';
    
    // Hide information after 2 seconds
    setTimeout(() => {
      savedMsg.style.display = 'none';
    }, 2000);
    
    // Notify all tabs to update settings
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, {
          type: "updateSettings",
          settings: settings
        });
      });
    });
    
    // Notify background.js to update settings
    chrome.runtime.sendMessage({
      type: "updateSettings",
      settings: settings
    });
  });
}

// ------------------- Cookie cleaning functionality -------------------

// Clear momo.com.tw site cookies
function clearMomoCookies() {
  // Show cleaning status area
  const cookieStatus = document.getElementById('cookieStatus');
  const cookieStatusText = document.getElementById('cookieStatusText');
  const cookieDetails = document.getElementById('cookieDetails');
  
  cookieStatus.style.display = 'block';
  cookieStatusText.textContent = 'Cleaning...';
  cookieDetails.innerHTML = 'Cleaning momoshop.com.tw cookies, please wait...';
  
  // Send cleaning cookie request to background
  chrome.runtime.sendMessage({
    action: 'clearCookies',
    domain: 'momoshop.com.tw'
  }, function(response) {
    if (response && response.success) {
      cookieStatusText.textContent = 'Cleaning completed';
      
      // Show detailed results
      let details = `Cleaning time: ${new Date().toLocaleString()}<br>`;
      details += `Cleaned domain: momoshop.com.tw<br>`;
      details += `Cleaning result: ${response.count} cookies have been deleted`;
      
      if (response.failedCount > 0) {
        details += `<br>Failed: ${response.failedCount} cookies cannot be deleted`;
      }
      
      cookieDetails.innerHTML = details;
    } else {
      cookieStatusText.textContent = 'Cleaning failed';
      cookieDetails.innerHTML = 'Cannot clean cookies, possibly browser permission insufficient or API unavailable';
    }
  });
}

// Continue batch processing
function resumeBatchProcessing() {
  if (!currentBatchId) {
    alert('No batch processing to continue');
    return;
  }
  
  console.log('Continue batch processing, batch ID: ' + currentBatchId);
  
  // First update UI status, avoid user repeated clicks
  document.getElementById('resumeProcessButton').style.display = "none";
  document.getElementById('retryEmptyDataButton').style.display = "none";
  
  // Update progress bar display area
  const progressBar = document.getElementById('progressBarFill');
  if (progressBar) {
    progressBar.style.backgroundColor = "#4CAF50";
    progressBar.textContent = progressBar.textContent.replace("Paused - ", "");
  }
  
  // Add additional debugging information
  console.log("Sending recovery processing request...");
  
  // Show loading indicator
  const progressArea = document.getElementById('batchStatus');
  if (progressArea) {
    progressArea.classList.add('loading');
  }
  
  // Set timeout processing to prevent request without response
  let requestTimeout = setTimeout(() => {
    console.warn("Recovery processing request timeout, possibly backend processing busy...");
    // Show retry button on UI
    document.getElementById('resumeProcessButton').style.display = "inline-block";
    document.getElementById('retryEmptyDataButton').style.display = "inline-block";
    if (progressArea) {
      progressArea.classList.remove('loading');
    }
  }, 10000); // 10 seconds timeout
  
  chrome.runtime.sendMessage({
    action: 'resumeBatch',
    batchId: currentBatchId
  }, function(response) {
    // Clear timeout timer
    clearTimeout(requestTimeout);
    
    // Remove loading indicator
    if (progressArea) {
      progressArea.classList.remove('loading');
    }
    
    if (response && response.success) {
      console.log('Batch processing continued, backend returned status:', response.status);
      
      // Update status
      batchRunning = true;
      
      // Immediately update status display
      updateBatchStatusDisplay(response.status);
      
      // Start timer to update progress
      const timer = setInterval(() => {
        checkBatchStatus(timer);
      }, 1000);
      
      // Record log
      console.log("Started batch processing status check timer");
    } else {
      console.error('Batch processing failed:', response ? response.error : 'Unknown error');
      alert('Batch processing failed: ' + (response ? response.error : 'Unknown error, please check console logs'));
      
      // If failed, restore UI status
      document.getElementById('resumeProcessButton').style.display = "inline-block";
      document.getElementById('retryEmptyDataButton').style.display = "inline-block";
      
      if (progressBar) {
        progressBar.style.backgroundColor = "#f39c12";
        if (!progressBar.textContent.includes("Paused")) {
          progressBar.textContent = "Paused - " + progressBar.textContent;
        }
      }
    }
  });
}

// Helper function: Update batch processing status display
function updateBatchStatusDisplay(status) {
  if (!status) return;
  
  const completed = status.completed || 0;
  const total = status.total || 0;
  const activeTabsCount = status.activeTabs ? Object.keys(status.activeTabs).length : 0;
  
  console.log(`Updating status display: completed=${completed}/${total}, active tab pages=${activeTabsCount}`);
  
  // Update progress display
  if (total > 0) {
    const percentage = Math.round((completed / total) * 100);
    document.getElementById('batchProgress').textContent = `${completed}/${total}`;
    document.getElementById('progressBarFill').style.width = `${percentage}%`;
    document.getElementById('progressBarFill').textContent = `${percentage}%`;
    
    // Calculate remaining time
    if (completed > 0 && startTime) {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const timePerItem = elapsedSeconds / completed;
      const remainingItems = total - completed;
      const estimatedRemainingTime = timePerItem * remainingItems;
      
      let remainingText = '';
      if (estimatedRemainingTime < 60) {
        remainingText = `About ${Math.floor(estimatedRemainingTime)} seconds`;
      } else {
        const mins = Math.floor(estimatedRemainingTime / 60);
        const secs = Math.floor(estimatedRemainingTime % 60);
        remainingText = `About ${mins} minutes ${secs} seconds`;
      }
      
      document.getElementById('remainingTime').textContent = remainingText;
    }
  }
}

// Re-process blank data
function retryEmptyData() {
  if (batchRunning) {
    alert('Batch processing is already in progress');
    return;
  }
  
  console.log('Starting to re-process blank data');
  
  // Get current data
  chrome.storage.local.get(['logs'], function(result) {
    const logs = result.logs || {};
    
    // Filter out blank data TID list
    const emptyTids = [];
    let totalItems = 0;
    
    for (const tid in logs) {
      totalItems++;
      const logData = logs[tid];
      
      // Check if sales data is true empty
      const noSalesData = !logData.momoSales || 
                          logData.momoSales === "" || 
                          logData.momoSales === "0" || 
                          logData.momoSales === "Sales unknown";
      
      // Check if stock data is true empty
      const noStockData = !logData.momoStock || 
                         logData.momoStock === "" || 
                         logData.momoStock === "Stock unknown";
      
      // If sales or stock is true empty, add to re-process list
      if (noSalesData || noStockData) {
        console.log(`Adding to re-process list TID: ${tid}, sales: "${logData.momoSales}", stock: "${logData.momoStock}"`);
        emptyTids.push(tid);
      }
    }
    
    console.log(`Total checked ${totalItems} items, found ${emptyTids.length} items need to re-process`);
    
    if (emptyTids.length === 0) {
      alert('No items found need to re-process blank data');
      return;
    }
    
    // Remove confirmation dialog, start processing directly
    console.log(`Preparing to re-process ${emptyTids.length} data: `, emptyTids);
    
    // Get selected concurrent processing quantity
    const maxConcurrentSelect = document.getElementById('concurrentTabs');
    const maxConcurrent = maxConcurrentSelect ? parseInt(maxConcurrentSelect.value, 10) : 5;
    
    // Send batch processing request
    chrome.runtime.sendMessage({
      action: 'startBatch',
      tidList: emptyTids,
      maxConcurrent: maxConcurrent
    }, function(response) {
      if (response && response.success) {
        // Save batch ID and start time
        currentBatchId = response.batchId;
        startTime = Date.now();
        batchRunning = true;
        batchTids = emptyTids;
        totalCount = emptyTids.length;
        
        // Update button status
        document.getElementById('resumeProcessButton').style.display = "none";
        document.getElementById('startProcessButton').style.display = "none";
        document.getElementById('retryEmptyDataButton').style.display = "none";
        
        // Show progress information
        document.getElementById('batchStatus').style.display = 'block';
        document.getElementById('batchProgress').textContent = `0/${totalCount}`;
        document.getElementById('progressBarFill').style.width = '0%';
        document.getElementById('progressBarFill').textContent = '0%';
        document.getElementById('progressBarFill').style.backgroundColor = "#4CAF50";
        document.getElementById('remainingTime').textContent = 'Calculating...';
        
        // Start timer to update progress
        const timer = setInterval(() => {
          checkBatchStatus(timer);
        }, 1000);
        
        // No pop-up prompt, just record log
        console.log(`Starting to re-process ${emptyTids.length} data`);
      } else {
        alert('Batch processing start failed: ' + (response ? response.error : 'Unknown error'));
      }
    });
  });
}