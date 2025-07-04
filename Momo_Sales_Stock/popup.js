document.addEventListener('DOMContentLoaded', function() {
  // Initialize tab switching
  initTabs();
  
  // Table related
  updateTable();
  
  // Button: Open sort.html (new tab)
  document.getElementById('openSortPage').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('sort.html') });
  });

  // Button: Clear logs
  document.getElementById('clearLogs').addEventListener('click', function() {
    chrome.storage.local.set({ refreshLog: [] }, function() {
      updateTable();
    });
  });
  
  // Settings related
  const defaultDelay = document.getElementById('defaultDelay');
  const maxRetries = document.getElementById('maxRetries');
  const reloadDelay = document.getElementById('reloadDelay');
  const autoCloseEnabled = document.getElementById('autoCloseEnabled');
  const blockingEnabled = document.getElementById('blockingEnabled');
  const saveSettingsButton = document.getElementById('saveSettings');
  const settingsSaved = document.getElementById('settingsSaved');
  
  // Load settings
  loadSettings();
  
  // Button: Save settings
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', function() {
      saveSettings();
    });
  }
  
  // Add listeners for setting switch status changes
  if (autoCloseEnabled) {
    autoCloseEnabled.addEventListener('change', function() {
      const status = document.getElementById('autoCloseStatus');
      if (status) {
        status.textContent = this.checked ? 'Auto close after processing' : 'Keep page open';
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

  // Price tracking function
  const openPriceTrackerButton = document.getElementById('openPriceTracker');
  if (openPriceTrackerButton) {
    openPriceTrackerButton.addEventListener('click', function() {
      // Send message to background.js to open price tracker
      chrome.runtime.sendMessage({ action: "open_price_tracker" });
      // Close popup
      window.close();
    });
  }
});

// Initialize tab switching function
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to currently clicked tab
      this.classList.add('active');
      
      // Get corresponding content area and display
      const tabId = this.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Update table data
function updateTable() {
  const tidTableBody = document.querySelector('#tidTable tbody');
  const dataTableBody = document.querySelector('#dataTable tbody');
  
  if (!tidTableBody || !dataTableBody) {
    console.error('Table elements not found');
    return;
  }
  
  // Clear table
  tidTableBody.innerHTML = '';
  dataTableBody.innerHTML = '';
  
  // Get data from chrome.storage.local
  chrome.storage.local.get({ refreshLog: [] }, function(result) {
    const logs = result.refreshLog || [];
    
    // Build processed TID mapping table
    const processedTids = {};
    logs.forEach(log => {
      if (log && log.tid) {
        if (!processedTids[log.tid] || (log.KAM !== undefined && log.KAM !== null && log.KAM !== '')) {
          processedTids[log.tid] = log;
        }
      }
    });
    
    const tids = Object.keys(processedTids);
    
    // Fill table
    tids.forEach((tid, index) => {
      const log = processedTids[tid];
      
      // Create TID row
      const tidRow = document.createElement('tr');
      tidRow.setAttribute('data-index', index);
      const tidCell = document.createElement('td');
      tidCell.textContent = tid;
      tidRow.appendChild(tidCell);
      tidTableBody.appendChild(tidRow);
      
      // Create data row
      const dataRow = document.createElement('tr');
      dataRow.setAttribute('data-index', index);
      
      const kamCell = document.createElement('td');
      kamCell.textContent = log.KAM || '';
      dataRow.appendChild(kamCell);
      
      const salesCell = document.createElement('td');
      salesCell.textContent = log.E || '';
      dataRow.appendChild(salesCell);
      
      const stockCell = document.createElement('td');
      stockCell.textContent = log.F !== undefined ? log.F : '';
      dataRow.appendChild(stockCell);
      
      dataTableBody.appendChild(dataRow);
    });
    
    // Add row hover synchronization highlighting effect
    addHoverEffect();
  });
}

// Add table row hover effect
function addHoverEffect() {
  const tidRows = document.querySelectorAll('#tidTable tbody tr');
  const dataRows = document.querySelectorAll('#dataTable tbody tr');
  
  // Remove previous event listeners (by clone replacement)
  tidRows.forEach(row => {
    const newRow = row.cloneNode(true);
    row.parentNode.replaceChild(newRow, row);
  });
  
  dataRows.forEach(row => {
    const newRow = row.cloneNode(true);
    row.parentNode.replaceChild(newRow, row);
  });
  
  // Re-get new rows
  const newTidRows = document.querySelectorAll('#tidTable tbody tr');
  const newDataRows = document.querySelectorAll('#dataTable tbody tr');
  
  // Add new event listeners
  newTidRows.forEach(row => {
    row.addEventListener('mouseover', function() {
      const index = this.getAttribute('data-index');
      this.classList.add('highlight');
      
      const correspondingRow = document.querySelector(`#dataTable tbody tr[data-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.add('highlight');
      }
    });
    
    row.addEventListener('mouseout', function() {
      const index = this.getAttribute('data-index');
      this.classList.remove('highlight');
      
      const correspondingRow = document.querySelector(`#dataTable tbody tr[data-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.remove('highlight');
      }
    });
  });
  
  newDataRows.forEach(row => {
    row.addEventListener('mouseover', function() {
      const index = this.getAttribute('data-index');
      this.classList.add('highlight');
      
      const correspondingRow = document.querySelector(`#tidTable tbody tr[data-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.add('highlight');
      }
    });
    
    row.addEventListener('mouseout', function() {
      const index = this.getAttribute('data-index');
      this.classList.remove('highlight');
      
      const correspondingRow = document.querySelector(`#tidTable tbody tr[data-index="${index}"]`);
      if (correspondingRow) {
        correspondingRow.classList.remove('highlight');
      }
    });
  });
}

// Load settings
function loadSettings() {
  // Read top-level key settings, consistent with sort.js
  chrome.storage.local.get({
    defaultDelay: 500,
    maxRetries: 10,
    reloadDelay: 1000,
    autoClose: true,
    blockingEnabled: true
  }, function(items) {
    // Save settings to global variables if needed
    const settings = {
      defaultDelay: items.defaultDelay,
      maxRetries: items.maxRetries,
      reloadDelay: items.reloadDelay,
      autoClose: items.autoClose,
      blockingEnabled: items.blockingEnabled
    };
    
    // Update UI
    document.getElementById('defaultDelay').value = items.defaultDelay;
    document.getElementById('maxRetries').value = items.maxRetries;
    document.getElementById('reloadDelay').value = items.reloadDelay;
    document.getElementById('autoCloseEnabled').checked = items.autoClose;
    document.getElementById('blockingEnabled').checked = items.blockingEnabled;
    
    // Update switch status text
    updateSettingStatusText();
  });
}

// Add function to update setting status text
function updateSettingStatusText() {
  const autoCloseStatus = document.getElementById('autoCloseStatus');
  if (autoCloseStatus) {
    autoCloseStatus.textContent = document.getElementById('autoCloseEnabled').checked ? 
      'Auto close after processing' : 'Keep page open';
  }
  
  const blockingStatus = document.getElementById('blockingStatus');
  if (blockingStatus) {
    blockingStatus.textContent = document.getElementById('blockingEnabled').checked ? 
      'Enabled' : 'Disabled';
  }
}

// Save settings
function saveSettings() {
  const settings = {
    defaultDelay: parseInt(document.getElementById('defaultDelay').value),
    maxRetries: parseInt(document.getElementById('maxRetries').value),
    reloadDelay: parseInt(document.getElementById('reloadDelay').value),
    autoClose: document.getElementById('autoCloseEnabled').checked,
    blockingEnabled: document.getElementById('blockingEnabled').checked
  };
  
  // Save to both settings object and top-level keys
  chrome.storage.local.set({
    settings: settings,
    defaultDelay: settings.defaultDelay,
    maxRetries: settings.maxRetries,
    reloadDelay: settings.reloadDelay,
    autoClose: settings.autoClose,
    blockingEnabled: settings.blockingEnabled
  }, function() {
    // Show save success
    const settingsSaved = document.getElementById('settingsSaved');
    if (settingsSaved) {
      settingsSaved.style.display = 'block';
      
      // Hide after 2 seconds
      setTimeout(() => {
        settingsSaved.style.display = 'none';
      }, 2000);
    }
    
    // Notify all active tabs
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
      