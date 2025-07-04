// Coupang SKU Counter Extension - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Coupang Extension] Popup loaded');
  
  let autoRefreshInterval;
  
  // Initialize the popup
  initialize();
  
  // Button event listeners
  document.getElementById('clearDataBtn').addEventListener('click', clearDeliveryData);
  document.getElementById('exportCsvBtn').addEventListener('click', exportDeliveryData);
  document.getElementById('copyDataBtn').addEventListener('click', copyDeliveryData);
  
  document.getElementById('startBatchBtn').addEventListener('click', startBatchProcessing);
  document.getElementById('stopBatchBtn').addEventListener('click', stopBatchProcessing);
  
  // Initialize function
  function initialize() {
    // Load data immediately
    loadDeliveryData();
    
    // Start auto-refresh every 2 seconds
    startAutoRefresh();
  }
  
  // Start auto-refresh
  function startAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
      loadDeliveryData();
    }, 2000); // Refresh every 2 seconds
  }
  
  // Stop auto-refresh
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
  }
  

  
  // Load delivery data
  function loadDeliveryData() {
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      console.log('[Coupang Extension] Loaded delivery data:', data);
      console.log('[Coupang Extension] Total data entries:', data.length);
      
      // Debug: Show data breakdown by status
      const statusBreakdown = {};
      data.forEach(item => {
        const status = item.isCompleted ? 'Completed' : 'Processing';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      console.log('[Coupang Extension] Data breakdown by status:', statusBreakdown);
      
      displayDeliveryData(data);
    });
  }
  
  // Display delivery data
  function displayDeliveryData(data) {
    const container = document.getElementById('dataContainer');
    
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">No SKU data available</div>';
      return;
    }
    
    console.log('[Coupang Extension] Processing data for display - maintaining original order...');
    
    // Create table without Last Updated column
    let tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>SKU Count</th>
            <th>Pages Processed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Check if we have batch processing data to maintain original URL order
    chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_original_batch_urls'], function(result) {
      const isBatchProcessing = result.coupang_batch_processing || false;
      const batchUrls = result.coupang_batch_urls || [];
      const originalBatchUrls = result.coupang_original_batch_urls || [];
      
      // Use original batch URLs if available, otherwise current batch URLs
      const referenceBatchUrls = originalBatchUrls.length > 0 ? originalBatchUrls : batchUrls;
      
      console.log('[Coupang Extension] Display mode - reference URLs:', referenceBatchUrls);
      
      let displayRows = [];
      
      if (referenceBatchUrls.length > 0) {
        // SIMPLE GOOGLE SHEETS STYLE: 1st row URL → 1st row result, 2nd row URL → 2nd row result
        console.log('[Coupang Extension] SIMPLE DISPLAY: Like Google Sheets - URL order = Display order');
        console.log('[Coupang Extension] Original URLs:', referenceBatchUrls);
        
        // Create position-based data map for fast lookup
        const positionData = {};
        
        // First, organize all data by urlPosition
        data.forEach(item => {
          if (item.urlPosition !== undefined) {
            if (!positionData[item.urlPosition]) {
              positionData[item.urlPosition] = {
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                brandName: item.brand
              };
            }
            
            positionData[item.urlPosition].totalSku += item.skuCount;
            if (item.page > 0) {
              positionData[item.urlPosition].pagesProcessed++;
            }
            
            if (item.isCompleted) {
              if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                positionData[item.urlPosition].status = 'No Data';
              } else {
                positionData[item.urlPosition].status = 'Completed';
              }
            }
          }
        });
        
        console.log('[Coupang Extension] Position data map:', positionData);
        
        // Now create display rows in exact URL order
        referenceBatchUrls.forEach((url, index) => {
          if (url === '0') {
            // "0" placeholder
            displayRows.push({
              brand: '0',
              totalSku: 0,
              pagesProcessed: 0,
              status: 'Completed',
              position: index
            });
          } else {
            // Extract brand name from URL
            let brandName = 'Unknown';
            try {
              const urlObj = new URL(url);
              const query = urlObj.searchParams.get('q');
              brandName = query ? decodeURIComponent(query) : 'Unknown';
            } catch (e) {
              console.warn(`[Coupang Extension] Failed to parse URL: ${url}`);
            }
            
            // Check if we have data for this exact position
            if (positionData[index]) {
              displayRows.push({
                brand: brandName,
                totalSku: positionData[index].totalSku,
                pagesProcessed: positionData[index].pagesProcessed,
                status: positionData[index].status,
                position: index
              });
              console.log(`[Coupang Extension] Position ${index}: Found data - ${brandName} (${positionData[index].totalSku} SKUs)`);
            } else {
              // No data for this position
              displayRows.push({
                brand: brandName,
                totalSku: 0,
                pagesProcessed: 0,
                status: 'No Data',
                position: index
              });
              console.log(`[Coupang Extension] Position ${index}: No data - ${brandName}`);
            }
          }
        });
        
        console.log('[Coupang Extension] Final display (Google Sheets style):', displayRows.map(row => `${row.position}: ${row.brand} - ${row.totalSku} SKUs`));
      } else {
        // Fallback: show data in position order
        console.log('[Coupang Extension] No reference URLs - using position order');
        
        const positionData = {};
        data.forEach(item => {
          const pos = item.urlPosition !== undefined ? item.urlPosition : 999;
          if (!positionData[pos]) {
            positionData[pos] = {
              brand: item.brand,
              totalSku: 0,
              pagesProcessed: 0,
              status: 'Processing',
              position: pos
            };
          }
          
          positionData[pos].totalSku += item.skuCount;
          if (item.page > 0) {
            positionData[pos].pagesProcessed++;
          }
          
          if (item.isCompleted) {
            if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
              positionData[pos].status = 'No Data';
            } else {
              positionData[pos].status = 'Completed';
            }
          }
        });
        
        displayRows = Object.values(positionData).sort((a, b) => a.position - b.position);
      }
      
      displayRows.forEach(row => {
        const statusClass = row.status === 'Completed' ? 'status-completed' : 
                           row.status === 'Processing' ? 'status-processing' : 
                           row.status === 'No Data' ? 'status-no-data' : 'status-failed';
        
        const statusText = row.status === 'Completed' ? 'Completed' : 
                          row.status === 'Processing' ? 'Processing' : 
                          row.status === 'No Data' ? 'No Data' : 'Failed';
        
        tableHtml += `
          <tr>
            <td>${row.brand}</td>
            <td>${row.totalSku}</td>
            <td>${row.pagesProcessed}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          </tr>
        `;
      });
      
      tableHtml += `
          </tbody>
        </table>
      `;
      
      container.innerHTML = tableHtml;
    });
  }
  
  // Clear delivery data
  function clearDeliveryData() {
    if (confirm('Are you sure you want to clear all SKU data?')) {
      chrome.storage.local.remove(['coupang_delivery_data'], function() {
        console.log('[Coupang Extension] Delivery data cleared');
        loadDeliveryData();
        showStatus('Data cleared successfully', 'success');
      });
    }
  }
  
  // Export delivery data as CSV
  function exportDeliveryData() {
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      
      if (data.length === 0) {
        showStatus('No data to export', 'error');
        return;
      }
      
      console.log('[Coupang Extension] Export function - maintaining original order...');
      
      // Check if we have batch processing data to maintain original URL order
      chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_original_batch_urls'], function(batchResult) {
        const isBatchProcessing = batchResult.coupang_batch_processing || false;
        const batchUrls = batchResult.coupang_batch_urls || [];
        const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
        
        // Use original batch URLs if available, otherwise current batch URLs
        const referenceBatchUrls = originalBatchUrls.length > 0 ? originalBatchUrls : batchUrls;
        
        let exportRows = [];
        
        if (referenceBatchUrls.length > 0) {
          // GOOGLE SHEETS STYLE EXPORT: URL position = Result position
          console.log('[Coupang Extension] EXPORT - Google Sheets style: URL order = Result order');
          
          // Create position-based data map for fast lookup
          const positionData = {};
          data.forEach(item => {
            if (item.urlPosition !== undefined) {
              if (!positionData[item.urlPosition]) {
                positionData[item.urlPosition] = {
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing',
                  brandName: item.brand
                };
              }
              
              positionData[item.urlPosition].totalSku += item.skuCount;
              if (item.page > 0) {
                positionData[item.urlPosition].pagesProcessed++;
              }
              
              if (item.isCompleted) {
                if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                  positionData[item.urlPosition].status = 'No Data';
                } else {
                  positionData[item.urlPosition].status = 'Completed';
                }
              }
            }
          });
          
          // Create export rows in exact URL order
          referenceBatchUrls.forEach((url, index) => {
            if (url === '0') {
              exportRows.push({
                brand: '0',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Completed',
                position: index
              });
            } else {
              let brandName = 'Unknown';
              try {
                const urlObj = new URL(url);
                const query = urlObj.searchParams.get('q');
                brandName = query ? decodeURIComponent(query) : 'Unknown';
              } catch (e) {
                console.warn(`[Coupang Extension] Export - Failed to parse URL: ${url}`);
              }
              
              if (positionData[index]) {
                exportRows.push({
                  brand: brandName,
                  totalSku: positionData[index].totalSku,
                  pagesProcessed: positionData[index].pagesProcessed,
                  status: positionData[index].status,
                  position: index
                });
              } else {
                exportRows.push({
                  brand: brandName,
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'No Data',
                  position: index
                });
              }
            }
          });
        } else {
          // Fallback: position order
          const positionData = {};
          data.forEach(item => {
            const pos = item.urlPosition !== undefined ? item.urlPosition : 999;
            if (!positionData[pos]) {
              positionData[pos] = {
                brand: item.brand,
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                position: pos
              };
            }
            
            positionData[pos].totalSku += item.skuCount;
            if (item.page > 0) {
              positionData[pos].pagesProcessed++;
            }
            
            if (item.isCompleted) {
              if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                positionData[pos].status = 'No Data';
              } else {
                positionData[pos].status = 'Completed';
              }
            }
          });
          
          exportRows = Object.values(positionData).sort((a, b) => a.position - b.position);
        }
        
        // Create CSV content
        let csvContent = 'Brand,SKU Count,Pages Processed,Status\n';
        exportRows.forEach(row => {
          const status = row.status === 'Completed' ? 'Completed' : 
                        row.status === 'Processing' ? 'Processing' : 
                        row.status === 'No Data' ? 'No Data' : 'Failed';
          csvContent += `"${row.brand}",${row.totalSku},${row.pagesProcessed},"${status}"\n`;
        });
        
        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `coupang_sku_data_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showStatus('CSV exported successfully', 'success');
      });
    });
  }
  


  // Copy delivery data to clipboard
  function copyDeliveryData() {
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      
      if (data.length === 0) {
        showStatus('No data to copy', 'error');
        return;
      }
      
      console.log('[Coupang Extension] Copy function - raw data entries:', data.length);
      console.log('[Coupang Extension] Copy function - maintaining original order...');
      
      // Check if we have batch processing data (current or original) to preserve order
      chrome.storage.local.get(['coupang_batch_processing', 'coupang_batch_urls', 'coupang_original_batch_urls'], function(batchResult) {
        const isBatchProcessing = batchResult.coupang_batch_processing || false;
        const batchUrls = batchResult.coupang_batch_urls || [];
        const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
        
        // Use original batch URLs if available, otherwise current batch URLs
        const referenceBatchUrls = originalBatchUrls.length > 0 ? originalBatchUrls : batchUrls;
        
        let copyRows = [];
        
        if (referenceBatchUrls.length > 0) {
          // GOOGLE SHEETS STYLE COPY: URL position = Result position
          console.log('[Coupang Extension] COPY - Google Sheets style: URL order = Result order');
          
          // Create position-based data map for fast lookup
          const positionData = {};
          data.forEach(item => {
            if (item.urlPosition !== undefined) {
              if (!positionData[item.urlPosition]) {
                positionData[item.urlPosition] = {
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing',
                  brandName: item.brand
                };
              }
              
              positionData[item.urlPosition].totalSku += item.skuCount;
              if (item.page > 0) {
                positionData[item.urlPosition].pagesProcessed++;
              }
              
              if (item.isCompleted) {
                if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                  positionData[item.urlPosition].status = 'No Data';
                } else {
                  positionData[item.urlPosition].status = 'Completed';
                }
              }
            }
          });
          
          // Create copy rows in exact URL order
          referenceBatchUrls.forEach((url, index) => {
            if (url === '0') {
              copyRows.push({
                brand: '0',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Completed',
                position: index
              });
            } else {
              let brandName = 'Unknown';
              try {
                const urlObj = new URL(url);
                const query = urlObj.searchParams.get('q');
                brandName = query ? decodeURIComponent(query) : 'Unknown';
              } catch (e) {
                console.warn(`[Coupang Extension] Copy - Failed to parse URL: ${url}`);
              }
              
              if (positionData[index]) {
                copyRows.push({
                  brand: brandName,
                  totalSku: positionData[index].totalSku,
                  pagesProcessed: positionData[index].pagesProcessed,
                  status: positionData[index].status,
                  position: index
                });
              } else {
                copyRows.push({
                  brand: brandName,
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'No Data',
                  position: index
                });
              }
            }
          });
        } else {
          // Fallback: position order
          const positionData = {};
          data.forEach(item => {
            const pos = item.urlPosition !== undefined ? item.urlPosition : 999;
            if (!positionData[pos]) {
              positionData[pos] = {
                brand: item.brand,
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                position: pos
              };
            }
            
            positionData[pos].totalSku += item.skuCount;
            if (item.page > 0) {
              positionData[pos].pagesProcessed++;
            }
            
            if (item.isCompleted) {
              if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                positionData[pos].status = 'No Data';
              } else {
                positionData[pos].status = 'Completed';
              }
            }
          });
          
          copyRows = Object.values(positionData).sort((a, b) => a.position - b.position);
        }
        
        // Create text content - ALWAYS include all brands including those with 0 SKU
        console.log('[Coupang Extension] Copy data - total brands to copy:', copyRows.length);
        
        let textContent = 'Brand\tSKU Count\tPages Processed\tStatus\n';
        copyRows.forEach((row, index) => {
          const status = row.status === 'Completed' ? 'Completed' : 
                         row.status === 'Processing' ? 'Processing' : 
                         row.status === 'No Data' ? 'No Data' : 'Failed';
          
          console.log(`[Coupang Extension] Copy brand ${index + 1}: ${row.brand}, SKU: ${row.totalSku}, Pages: ${row.pagesProcessed}, Status: ${status}`);
          textContent += `${row.brand}\t${row.totalSku}\t${row.pagesProcessed}\t${status}\n`;
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(textContent).then(() => {
          showStatus('Data copied to clipboard', 'success');
        }).catch(err => {
          console.error('[Coupang Extension] Copy failed:', err);
          showStatus('Copy failed', 'error');
        });
      });
    });
  }
  
  // Continue processing existing "No Data" entries
  function continueProcessingNoData() {
    console.log('[Coupang Extension] Checking for existing "No Data" entries to continue processing...');
    
    chrome.storage.local.get(['coupang_delivery_data', 'coupang_original_batch_urls'], function(result) {
      const currentData = result.coupang_delivery_data || [];
      const originalUrls = result.coupang_original_batch_urls || [];
      
      // Find entries with "No Data" status (excluding "0" placeholders)
      // Only consider items explicitly marked as No Data
      const noDataEntries = currentData.filter(item => {
        return item.isNoData && item.brand !== '0';
      });
      
      console.log('[Coupang Extension] Found No Data entries:', noDataEntries);
      
      if (noDataEntries.length === 0) {
        showStatus('No "No Data" entries found to continue processing', 'info');
        return;
      }
      
      // Extract brand names from No Data entries
      const noDataBrands = noDataEntries.map(item => item.brand);
      console.log('[Coupang Extension] No Data brands to reprocess:', noDataBrands);
      
      // Generate URLs only for No Data brands that need reprocessing
      const urlsToProcess = [];
      
      if (originalUrls.length > 0) {
        // Find original URLs for the No Data brands
        noDataBrands.forEach(brand => {
          const originalUrl = originalUrls.find(url => {
            if (url === '0') return false;
            try {
              const urlObj = new URL(url);
              const query = urlObj.searchParams.get('q');
              const brandFromUrl = query ? decodeURIComponent(query) : 'Unknown';
              return brandFromUrl === brand;
            } catch (e) {
              return false;
            }
          });
          
          if (originalUrl) {
            urlsToProcess.push(originalUrl);
          } else {
            // Generate new URL if original not found
            const encodedBrand = encodeURIComponent(brand);
            urlsToProcess.push(`https://www.tw.coupang.com/search?q=${encodedBrand}`);
          }
        });
      } else {
        // Generate new URLs for No Data brands
        noDataBrands.forEach(brand => {
          const encodedBrand = encodeURIComponent(brand);
          urlsToProcess.push(`https://www.tw.coupang.com/search?q=${encodedBrand}`);
        });
      }
      
      console.log('[Coupang Extension] URLs to process for No Data brands:', urlsToProcess);
      
      // Remove existing No Data entries from storage to avoid duplicates
      // Only remove items that are explicitly marked as No Data or are the specific brands we want to reprocess
      const filteredData = currentData.filter(item => {
        // Don't remove if it's explicitly marked as No Data
        if (item.isNoData) {
          return false;
        }
        
        // Don't remove if it's one of the brands we want to reprocess
        if (noDataBrands.includes(item.brand)) {
          return false;
        }
        
        // Keep all other data
        return true;
      });
      
      console.log('[Coupang Extension] Removed No Data entries, remaining data:', filteredData.length);
      
      if (urlsToProcess.length === 0) {
        showStatus('No valid URLs found in No Data entries', 'error');
        return;
      }
      
      // Get first URL to start processing (all URLs should be valid since we only added valid ones)
      const firstValidUrl = urlsToProcess[0];
      const firstValidIndex = 0;
      
      // Update storage with filtered data and start processing
      chrome.storage.local.set({ 'coupang_delivery_data': filteredData }, function() {
        console.log('[Coupang Extension] Starting to reprocess No Data entries...');
        
        // Set up minimal batch processing state for No Data reprocessing
        chrome.storage.local.set({
          'coupang_batch_processing': true,
          'coupang_batch_urls': urlsToProcess,
          'coupang_batch_current_index': 0,
          'coupang_batch_current_url': firstValidUrl
          // Deliberately NOT updating coupang_original_batch_urls to preserve original order
        }, function() {
          // Open first URL for reprocessing
          chrome.tabs.create({ url: firstValidUrl }, function(tab) {
            // Send message to start processing after page loads
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { 
                action: 'startProcessing',
                urlPosition: 0 // Use 0 for reprocessing to avoid conflicts
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.log('[Coupang Extension] Failed to start No Data reprocessing:', chrome.runtime.lastError);
                } else {
                  console.log('[Coupang Extension] No Data reprocessing started successfully:', response);
                }
              });
            }, 4000);
            
            // Close popup after starting
            setTimeout(() => {
              window.close();
            }, 1000);
          });
        });
        
        showStatus(`Continue processing ${noDataEntries.length} "No Data" items`, 'success');
      });
    });
  }
  
  // Start batch processing
  function startBatchProcessing() {
    const urlsText = document.getElementById('batchUrls').value.trim();
    
    if (!urlsText) {
      // No new URLs provided, check if we can continue processing existing "No Data" entries
      continueProcessingNoData();
      return;
    }
    
    const urls = urlsText.split('\n').filter(url => url.trim()).map(url => url.trim());
    
    if (urls.length === 0) {
      // No new URLs, check if we can continue processing existing "No Data" entries
      continueProcessingNoData();
      return;
    }
    
    // Validate URLs - allow "0" as placeholder or valid Coupang URLs
    const invalidUrls = urls.filter(url => {
      // Allow "0" as placeholder
      if (url === '0') {
        return false;
      }
      // Check if it's a valid Coupang search URL
      return !url.includes('www.tw.coupang.com/search') && !url.includes('https://www.tw.coupang.com/categories/');
    });
    
    if (invalidUrls.length > 0) {
      showStatus(`Invalid URLs found: ${invalidUrls.join(', ')}`, 'error');
      return;
    }
    
    // Process all URLs and save placeholder data for "0" entries immediately
    const placeholderData = [];
    let firstValidUrl = null;
    let firstValidIndex = -1;
    
    // Create placeholder data for all "0" entries with proper ordering
    const baseTimestamp = 1000000000000; // Use a fixed old timestamp to ensure proper ordering
    urls.forEach((url, index) => {
      if (url === '0') {
        placeholderData.push({
          brand: '0',
          skuCount: 0,
          timestamp: baseTimestamp + index, // Use fixed base + index for reliable ordering
          page: 1,
          isCompleted: true,
          urlPosition: index // Track original URL position
        });
      } else if (firstValidUrl === null) {
        // Found first valid URL
        firstValidUrl = url;
        firstValidIndex = index;
      }
    });
    
    if (!firstValidUrl) {
      showStatus('No valid URLs found - all entries are placeholders', 'error');
      return;
    }
    
    // For new URL input, always clear old data and start fresh
    // Save placeholder data for "0" entries if any
    if (placeholderData.length > 0) {
      // Clear old data and save only the new placeholder data
      chrome.storage.local.set({ 'coupang_delivery_data': placeholderData }, function() {
        console.log('[Coupang Extension] Cleared old data and saved new placeholder data:', placeholderData);
        
        // Start batch processing with the first valid URL, don't clear data since we just set the placeholders
        startBatchProcessingWithFirstUrl(urls, firstValidUrl, firstValidIndex, false);
      });
    } else {
      // No placeholders, start directly and clear old data
      startBatchProcessingWithFirstUrl(urls, firstValidUrl, firstValidIndex, true);
    }
  }
  
  // Helper function to start batch processing with first valid URL
  function startBatchProcessingWithFirstUrl(urls, firstValidUrl, firstValidIndex, clearExistingData = true) {
    // Prepare batch processing settings
    const batchSettings = {
      'coupang_batch_processing': true,
      'coupang_batch_urls': urls,
      'coupang_original_batch_urls': urls, // Save original order immediately
      'coupang_batch_current_index': firstValidIndex,
      'coupang_batch_current_url': firstValidUrl
    };
    
    // Only clear data if explicitly requested (for new batch processing)
    if (clearExistingData) {
      batchSettings['coupang_delivery_data'] = []; // Clear old SKU count data only for new batches
    }
    
    chrome.storage.local.set(batchSettings, function() {
      console.log('[Coupang Extension] SKU batch processing started with URLs:', urls);
      console.log('[Coupang Extension] Starting SKU counting with first valid URL:', firstValidUrl, 'at index:', firstValidIndex);
      console.log('[Coupang Extension] Original batch URLs saved for order preservation:', urls);
      
      // Open first valid URL for SKU counting
      chrome.tabs.create({ url: firstValidUrl }, function(tab) {
        showStatus(`Starting SKU batch processing: ${urls.length} URLs`, 'success');
        
        // Send message to start SKU counting after page loads
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'startProcessing',
            urlPosition: firstValidIndex
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log('[Coupang Extension] Failed to start SKU counting:', chrome.runtime.lastError);
            } else {
              console.log('[Coupang Extension] SKU counting started successfully:', response);
            }
          });
        }, 4000); // Wait for page to fully load
        
        // Close popup after starting
        setTimeout(() => {
          window.close();
        }, 1000);
      });
    });
  }
  
  // Stop batch processing
  function stopBatchProcessing() {
    console.log('[Coupang Extension] Stopping batch processing - preserving all data');
    
    // Get current batch processing data to ensure all brands are preserved
    chrome.storage.local.get(['coupang_delivery_data', 'coupang_batch_urls'], function(result) {
      const currentData = result.coupang_delivery_data || [];
      const batchUrls = result.coupang_batch_urls || [];
      
      console.log(`[Coupang Extension] Before stopping: ${currentData.length} data entries`);
      console.log(`[Coupang Extension] Batch URLs: ${batchUrls.length} URLs`);
      
      // Extract all brands from batch URLs
      const allBrands = batchUrls.map(url => {
        if (url === '0') return '0';
        try {
          const urlObj = new URL(url);
          const query = urlObj.searchParams.get('q');
          return query ? decodeURIComponent(query) : 'Unknown';
        } catch (e) {
          return 'Unknown';
        }
      });
      
      // Find brands that have no data entries (never processed)
      const existingBrands = new Set(currentData.map(item => item.brand));
      const missingBrands = allBrands.filter(brand => !existingBrands.has(brand));
      
      console.log(`[Coupang Extension] All brands from URLs:`, allBrands);
      console.log(`[Coupang Extension] Existing brands with data:`, Array.from(existingBrands));
      console.log(`[Coupang Extension] Missing brands (need No Data entries):`, missingBrands);
      
      // Create "No Data" entries for brands that were never processed with proper ordering
      const baseTimestamp = Date.now();
      const noDataEntries = missingBrands.map((brand, index) => {
        // Find original position in batch URLs to maintain order
        const originalIndex = batchUrls.findIndex(url => {
          if (url === '0') return false;
          try {
            const urlObj = new URL(url);
            const query = urlObj.searchParams.get('q');
            return query ? decodeURIComponent(query) === brand : false;
          } catch (e) {
            return false;
          }
        });
        
        return {
          brand: brand,
          skuCount: 0,
          timestamp: baseTimestamp + (originalIndex >= 0 ? originalIndex : index), // Use original index for ordering
          page: 0,
          isCompleted: true,
          isNoData: true // Mark as No Data brand
        };
      });
      
      if (noDataEntries.length > 0) {
        // Add No Data entries to preserve all brands
        const updatedData = currentData.concat(noDataEntries);
        chrome.storage.local.set({ 'coupang_delivery_data': updatedData }, function() {
          console.log(`[Coupang Extension] Added ${noDataEntries.length} No Data entries:`, noDataEntries);
          
          // Now remove batch processing states
          chrome.storage.local.remove([
            'coupang_batch_processing',
            'coupang_batch_urls',
            'coupang_batch_current_index',
            'coupang_batch_current_url',
            'coupang_auto_collecting'
          ], function() {
            console.log('[Coupang Extension] Batch processing stopped - all brands preserved including No Data');
            showStatus('Batch processing stopped - all brands preserved', 'success');
            
            // Refresh the display to show all data including No Data brands
            setTimeout(() => {
              loadDeliveryData();
            }, 500);
          });
        });
      } else {
        // No missing brands, just remove batch processing states
        chrome.storage.local.remove([
          'coupang_batch_processing',
          'coupang_batch_urls',
          'coupang_batch_current_index',
          'coupang_batch_current_url',
          'coupang_auto_collecting'
        ], function() {
          console.log('[Coupang Extension] Batch processing stopped - data preserved');
          showStatus('Batch processing stopped - all data preserved', 'success');
          
          // Refresh the display to show current data
          setTimeout(() => {
            loadDeliveryData();
          }, 500);
        });
      }
    });
  }
  
  // Show status message
  function showStatus(message, type = 'info') {
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
    `;
    statusDiv.textContent = message;
    
    document.body.appendChild(statusDiv);
    
    setTimeout(() => {
      if (statusDiv.parentNode) {
        statusDiv.parentNode.removeChild(statusDiv);
      }
    }, 3000);
  }
  
  // Clean up when popup is closed
  window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
      });
  }); 