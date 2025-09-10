// Coupang SKU Counter Extension - Data Viewer Script
document.addEventListener('DOMContentLoaded', function() {
  console.log('[Coupang Extension] Data Viewer loaded');
  
  let autoRefreshInterval;
  let isImgItemMode = false; // Global flag for IMG Item mode
  
  // Initialize the data viewer
  initialize();
  
  // Button event listeners
  document.getElementById('imgItemBtn').addEventListener('click', toggleImgItemMode);
  document.getElementById('clearDataBtn').addEventListener('click', clearDeliveryData);
  document.getElementById('exportCsvBtn').addEventListener('click', exportDeliveryData);
  document.getElementById('copyDataBtn').addEventListener('click', copyDeliveryData);
  
  document.getElementById('startBatchBtn').addEventListener('click', startBatchProcessing);
  document.getElementById('stopBatchBtn').addEventListener('click', stopBatchProcessing);
  
  // Initialize function
  function initialize() {
    // Load IMG Item mode state
    chrome.storage.local.get(['coupang_img_item_mode'], function(result) {
      isImgItemMode = result.coupang_img_item_mode || false;
      updateImgItemButton();
      updateUIForImgItemMode(isImgItemMode);
    });
    
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
  
  // Helper function to extract L2 category from URL
  function extractL2CategoryFromUrl(url) {
    if (!url || !url.includes('categories/')) {
      return '';
    }
    
    const categoriesIndex = url.indexOf('categories/');
    const listSizeIndex = url.indexOf('listSize=');
    
    if (categoriesIndex !== -1 && listSizeIndex !== -1) {
      const startIndex = categoriesIndex + 'categories/'.length;
      return url.substring(startIndex, listSizeIndex);
    }
    
    return '';
  }
  
  // Load delivery data
  function loadDeliveryData() {
    if (isImgItemMode) {
      // Load IMG item data
      chrome.storage.local.get(['coupang_img_item_data'], function(result) {
        const data = result.coupang_img_item_data || [];
        console.log('[Coupang Extension] Data Viewer loaded IMG item data:', data);
        console.log('[Coupang Extension] Data Viewer total IMG item entries:', data.length);
        
        displayImgItemData(data);
      });
    } else {
      // Load normal delivery data
      chrome.storage.local.get(['coupang_delivery_data'], function(result) {
        const data = result.coupang_delivery_data || [];
        console.log('[Coupang Extension] Data Viewer loaded delivery data:', data);
        console.log('[Coupang Extension] Data Viewer total data entries:', data.length);
        
        // Debug: Show data breakdown by status
        const statusBreakdown = {};
        data.forEach(item => {
          const status = item.isCompleted ? 'Completed' : 'Processing';
          statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        });
        console.log('[Coupang Extension] Data Viewer breakdown by status:', statusBreakdown);
        
        displayDeliveryData(data);
      });
    }
  }
  
  // Display delivery data
  function displayDeliveryData(data) {
    const container = document.getElementById('dataContainer');
    
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">No SKU data available</div>';
      return;
    }
    
    console.log('[Coupang Extension] Data Viewer processing data for display - maintaining original order...');
    
    // Create table with L2 category column
    let tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>L2 Category</th>
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
      
      console.log('[Coupang Extension] Data Viewer display mode - reference URLs:', referenceBatchUrls);
      
      let displayRows = [];
      
      if (referenceBatchUrls.length > 0) {
        // SIMPLE GOOGLE SHEETS STYLE: 1st row URL → 1st row result, 2nd row URL → 2nd row result
        console.log('[Coupang Extension] Data Viewer SIMPLE DISPLAY: Like Google Sheets - URL order = Display order');
        console.log('[Coupang Extension] Data Viewer original URLs:', referenceBatchUrls);
        
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
                brandName: item.brand,
                l2Category: item.l2Category || ''
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
        
        console.log('[Coupang Extension] Data Viewer position data map:', positionData);
        
        // Now create display rows in exact URL order
        referenceBatchUrls.forEach((url, index) => {
          if (url === '0') {
            // "0" placeholder
            displayRows.push({
              brand: '0',
              l2Category: '',
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
              console.warn(`[Coupang Extension] Data Viewer failed to parse URL: ${url}`);
            }
            
            // Always extract L2 category from URL (not from stored data)
            let l2Category = extractL2CategoryFromUrl(url);
            
            // Check if we have data for this exact position
            if (positionData[index]) {
              displayRows.push({
                brand: brandName,
                l2Category: l2Category, // Always use L2 category from URL
                totalSku: positionData[index].totalSku,
                pagesProcessed: positionData[index].pagesProcessed,
                status: positionData[index].status,
                position: index
              });
              console.log(`[Coupang Extension] Data Viewer position ${index}: Found data - ${brandName}, L2: ${l2Category} (${positionData[index].totalSku} SKUs)`);
            } else {
              // No data for this position
              displayRows.push({
                brand: brandName,
                l2Category: l2Category, // Use L2 category from URL
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                position: index
              });
              console.log(`[Coupang Extension] Data Viewer position ${index}: No data yet - ${brandName}, L2: ${l2Category}`);
            }
          }
        });
        
        console.log('[Coupang Extension] Data Viewer final display rows:', displayRows);
      } else {
        // No batch URLs available, display data in timestamp order
        console.log('[Coupang Extension] Data Viewer no batch URLs available, displaying in timestamp order');
        
        // Group data by brand+l2Category for aggregation
        const brandGroups = {};
        data.forEach(item => {
          const key = `${item.brand}|${item.l2Category || ''}`;
          if (!brandGroups[key]) {
            brandGroups[key] = {
              brand: item.brand,
              l2Category: item.l2Category || '',
              totalSku: 0,
              pagesProcessed: 0,
              status: 'Processing',
              timestamp: item.timestamp
            };
          }
          
          brandGroups[key].totalSku += item.skuCount;
          if (item.page > 0) {
            brandGroups[key].pagesProcessed++;
          }
          
          if (item.isCompleted) {
            if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
              brandGroups[key].status = 'No Data';
            } else {
              brandGroups[key].status = 'Completed';
            }
          }
        });
        
        displayRows = Object.values(brandGroups).sort((a, b) => a.timestamp - b.timestamp);
      }
      
      // Generate table rows
      displayRows.forEach(row => {
        const statusClass = row.status === 'Completed' ? 'status-completed' : 
                           row.status === 'No Data' ? 'status-no-data' : 
                           'status-processing';
        
        tableHtml += `
          <tr>
            <td title="${row.brand}">${row.brand}</td>
            <td title="${row.l2Category || '-'}">${row.l2Category || '-'}</td>
            <td>${row.totalSku}</td>
            <td>${row.pagesProcessed}</td>
            <td><span class="status-badge ${statusClass}">${row.status}</span></td>
          </tr>
        `;
      });
      
      tableHtml += `
        </tbody>
      </table>
      `;
      
      container.innerHTML = tableHtml;
      
      // Add column resizing functionality
      makeTableColumnsResizable();
      
      // Update document title with current data count
      document.title = `Coupang SKU Counter - Data Viewer (${displayRows.length} items)`;
    });
  }

  // Display IMG Item data
  function displayImgItemData(data) {
    const container = document.getElementById('dataContainer');
    
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">No IMG item data available</div>';
      return;
    }

    console.log('[Coupang Extension] Data Viewer processing IMG item data for display...');
    
    // Create table for IMG item data with 4 columns
    let tableHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>Product Name</th>
            <th>Image URL</th>
            <th>Item URL</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Sort data by URL position and page
    const sortedData = data.sort((a, b) => {
      if (a.urlPosition !== b.urlPosition) {
        return a.urlPosition - b.urlPosition;
      }
      return a.page - b.page;
    });

    sortedData.forEach(item => {
      const brand = item.brand || 'Unknown Brand';
      const productName = item.name || 'Unknown Product';
      const imageUrl = item.imageUrl || '';
      const itemUrl = item.itemUrl || '';
      
      // Truncate long URLs for display
      const displayImageUrl = imageUrl.length > 60 ? imageUrl.substring(0, 60) + '...' : imageUrl;
      const displayItemUrl = itemUrl.length > 60 ? itemUrl.substring(0, 60) + '...' : itemUrl;
      
      tableHtml += `
        <tr>
          <td title="${brand}">${brand}</td>
          <td title="${productName}">${productName}</td>
          <td title="${imageUrl}">
            <a href="${imageUrl}" target="_blank">${displayImageUrl}</a>
          </td>
          <td title="${itemUrl}">
            <a href="${itemUrl}" target="_blank">${displayItemUrl}</a>
          </td>
        </tr>
      `;
    });
    
    tableHtml += `
        </tbody>
      </table>
    `;
    
    container.innerHTML = tableHtml;
    
    // Add column resizing functionality
    makeTableColumnsResizable();
    
    // Update document title with current data count
    document.title = `Coupang SKU Counter - IMG Item Viewer (${sortedData.length} items)`;
  }
  
  // Clear delivery data
  function clearDeliveryData() {
    const dataType = isImgItemMode ? 'IMG item data' : 'delivery data';
    const storageKey = isImgItemMode ? 'coupang_img_item_data' : 'coupang_delivery_data';
    
    if (confirm(`Are you sure you want to clear all ${dataType}?`)) {
      chrome.storage.local.remove([storageKey], function() {
        console.log(`[Coupang Extension] Data Viewer cleared all ${dataType}`);
        showStatus(`All ${dataType} cleared`, 'success');
        loadDeliveryData();
      });
    }
  }
  
  // Export delivery data to CSV
  function exportDeliveryData() {
    if (isImgItemMode) {
      exportImgItemData();
      return;
    }
    
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      
      if (data.length === 0) {
        showStatus('No data to export', 'error');
        return;
      }
      
      // Get batch URLs for proper ordering
      chrome.storage.local.get(['coupang_batch_urls', 'coupang_original_batch_urls'], function(batchResult) {
        const batchUrls = batchResult.coupang_batch_urls || [];
        const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
        const referenceBatchUrls = originalBatchUrls.length > 0 ? originalBatchUrls : batchUrls;
        
        let exportData = [];
        
        if (referenceBatchUrls.length > 0) {
          // Export in URL order (like Google Sheets)
          console.log('[Coupang Extension] Data Viewer exporting in URL order');
          
          // Create position-based data map
          const positionData = {};
          data.forEach(item => {
            if (item.urlPosition !== undefined) {
              if (!positionData[item.urlPosition]) {
                positionData[item.urlPosition] = {
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing',
                  brandName: item.brand,
                  l2Category: item.l2Category || ''
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
          
          // Create export data in URL order
          referenceBatchUrls.forEach((url, index) => {
            if (url === '0') {
              exportData.push({
                brand: '0',
                l2Category: '',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Completed',
                url: url
              });
            } else {
              let brandName = 'Unknown';
              try {
                const urlObj = new URL(url);
                const query = urlObj.searchParams.get('q');
                brandName = query ? decodeURIComponent(query) : 'Unknown';
              } catch (e) {
                console.warn(`[Coupang Extension] Data Viewer failed to parse URL: ${url}`);
              }
              
              let l2Category = extractL2CategoryFromUrl(url);
              
              if (positionData[index]) {
                exportData.push({
                  brand: brandName,
                  l2Category: l2Category,
                  totalSku: positionData[index].totalSku,
                  pagesProcessed: positionData[index].pagesProcessed,
                  status: positionData[index].status,
                  url: url
                });
              } else {
                exportData.push({
                  brand: brandName,
                  l2Category: l2Category,
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing',
                  url: url
                });
              }
            }
          });
        } else {
          // No batch URLs, export in timestamp order
          console.log('[Coupang Extension] Data Viewer exporting in timestamp order');
          
          const brandGroups = {};
          data.forEach(item => {
            const key = `${item.brand}|${item.l2Category || ''}`;
            if (!brandGroups[key]) {
              brandGroups[key] = {
                brand: item.brand,
                l2Category: item.l2Category || '',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                timestamp: item.timestamp
              };
            }
            
            brandGroups[key].totalSku += item.skuCount;
            if (item.page > 0) {
              brandGroups[key].pagesProcessed++;
            }
            
            if (item.isCompleted) {
              if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                brandGroups[key].status = 'No Data';
              } else {
                brandGroups[key].status = 'Completed';
              }
            }
          });
          
          exportData = Object.values(brandGroups).sort((a, b) => a.timestamp - b.timestamp);
        }
        
        // Create CSV content
        const csvHeaders = ['Brand', 'L2 Category', 'SKU Count', 'Pages Processed', 'Status'];
        let csvContent = csvHeaders.join(',') + '\n';
        
        exportData.forEach(row => {
          const csvRow = [
            `"${row.brand}"`,
            `"${row.l2Category || ''}"`,
            row.totalSku,
            row.pagesProcessed,
            `"${row.status}"`
          ];
          csvContent += csvRow.join(',') + '\n';
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
        
        showStatus(`CSV exported successfully (${exportData.length} items)`, 'success');
      });
    });
  }
  
  // Copy delivery data to clipboard
  function copyDeliveryData() {
    if (isImgItemMode) {
      copyImgItemData();
      return;
    }
    
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      
      if (data.length === 0) {
        showStatus('No data to copy', 'error');
        return;
      }
      
      // Get batch URLs for proper ordering
      chrome.storage.local.get(['coupang_batch_urls', 'coupang_original_batch_urls'], function(batchResult) {
        const batchUrls = batchResult.coupang_batch_urls || [];
        const originalBatchUrls = batchResult.coupang_original_batch_urls || [];
        const referenceBatchUrls = originalBatchUrls.length > 0 ? originalBatchUrls : batchUrls;
        
        let copyData = [];
        
        if (referenceBatchUrls.length > 0) {
          // Copy in URL order (like Google Sheets)
          console.log('[Coupang Extension] Data Viewer copying in URL order');
          
          // Create position-based data map
          const positionData = {};
          data.forEach(item => {
            if (item.urlPosition !== undefined) {
              if (!positionData[item.urlPosition]) {
                positionData[item.urlPosition] = {
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing',
                  brandName: item.brand,
                  l2Category: item.l2Category || ''
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
          
          // Create copy data in URL order
          referenceBatchUrls.forEach((url, index) => {
            if (url === '0') {
              copyData.push({
                brand: '0',
                l2Category: '',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Completed'
              });
            } else {
              let brandName = 'Unknown';
              try {
                const urlObj = new URL(url);
                const query = urlObj.searchParams.get('q');
                brandName = query ? decodeURIComponent(query) : 'Unknown';
              } catch (e) {
                console.warn(`[Coupang Extension] Data Viewer failed to parse URL: ${url}`);
              }
              
              let l2Category = extractL2CategoryFromUrl(url);
              
              if (positionData[index]) {
                copyData.push({
                  brand: brandName,
                  l2Category: l2Category,
                  totalSku: positionData[index].totalSku,
                  pagesProcessed: positionData[index].pagesProcessed,
                  status: positionData[index].status
                });
              } else {
                copyData.push({
                  brand: brandName,
                  l2Category: l2Category,
                  totalSku: 0,
                  pagesProcessed: 0,
                  status: 'Processing'
                });
              }
            }
          });
        } else {
          // No batch URLs, copy in timestamp order
          console.log('[Coupang Extension] Data Viewer copying in timestamp order');
          
          const brandGroups = {};
          data.forEach(item => {
            const key = `${item.brand}|${item.l2Category || ''}`;
            if (!brandGroups[key]) {
              brandGroups[key] = {
                brand: item.brand,
                l2Category: item.l2Category || '',
                totalSku: 0,
                pagesProcessed: 0,
                status: 'Processing',
                timestamp: item.timestamp
              };
            }
            
            brandGroups[key].totalSku += item.skuCount;
            if (item.page > 0) {
              brandGroups[key].pagesProcessed++;
            }
            
            if (item.isCompleted) {
              if (item.isNoData || item.isSkipped || (item.skuCount === 0 && item.page === 0)) {
                brandGroups[key].status = 'No Data';
              } else {
                brandGroups[key].status = 'Completed';
              }
            }
          });
          
          copyData = Object.values(brandGroups).sort((a, b) => a.timestamp - b.timestamp);
        }
        
        // Create tab-separated content for easy pasting into spreadsheets
        const headers = ['Brand', 'L2 Category', 'SKU Count', 'Pages Processed', 'Status'];
        let content = headers.join('\t') + '\n';
        
        copyData.forEach(row => {
          const dataRow = [
            row.brand,
            row.l2Category || '',
            row.totalSku,
            row.pagesProcessed,
            row.status
          ];
          content += dataRow.join('\t') + '\n';
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(content).then(() => {
          showStatus(`Data copied to clipboard (${copyData.length} items)`, 'success');
        }).catch(err => {
          console.error('[Coupang Extension] Data Viewer failed to copy to clipboard:', err);
          showStatus('Failed to copy to clipboard', 'error');
        });
      });
    });
  }
  
  // Continue processing No Data entries
  function continueProcessingNoData() {
    chrome.storage.local.get(['coupang_delivery_data'], function(result) {
      const data = result.coupang_delivery_data || [];
      
      // Find entries marked as "No Data" that could be reprocessed
      const noDataEntries = data.filter(item => item.isNoData && !item.isSkipped);
      
      if (noDataEntries.length === 0) {
        showStatus('No reprocessable entries found', 'error');
        return;
      }
      
      // Extract brands from No Data entries
      const brandsToReprocess = [...new Set(noDataEntries.map(item => item.brand))];
      
      console.log('[Coupang Extension] Data Viewer found brands to reprocess:', brandsToReprocess);
      
      // Create URLs for reprocessing
      const reprocessUrls = brandsToReprocess.map(brand => {
        if (brand === '0') return '0';
        return `https://www.tw.coupang.com/search?q=${encodeURIComponent(brand)}`;
      });
      
      // Start batch processing with these URLs
      const batchSettings = {
        'coupang_batch_processing': true,
        'coupang_batch_urls': reprocessUrls,
        'coupang_original_batch_urls': reprocessUrls,
        'coupang_batch_current_index': 0,
        'coupang_batch_current_url': reprocessUrls[0]
      };
      
      chrome.storage.local.set(batchSettings, function() {
        // Open first URL for reprocessing
        chrome.tabs.create({ url: reprocessUrls[0] }, function(tab) {
          showStatus(`Reprocessing ${brandsToReprocess.length} brands`, 'success');
          
          // Send message to start processing
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'startProcessing',
              urlPosition: 0
            });
          }, 4000);
        });
      });
    });
  }
  
  // Fix brand encoding in URL - decode Chinese characters properly
  function fixBrandEncodingInUrl(url) {
    if (url === '0' || !url.includes('q=')) {
      return url;
    }
    
    try {
      const urlObj = new URL(url);
      const query = urlObj.searchParams.get('q');
      
      if (query) {
        // Decode the query to get Chinese characters
        const decodedQuery = decodeURIComponent(query);
        console.log(`[Coupang Extension] Data Viewer decoded query: "${query}" -> "${decodedQuery}"`);
        
        // Set the decoded query directly (browser will handle encoding when needed)
        urlObj.searchParams.set('q', decodedQuery);
        const fixedUrl = urlObj.toString();
        
        if (fixedUrl !== url) {
          console.log(`[Coupang Extension] Data Viewer fixed URL encoding: ${url} -> ${fixedUrl}`);
        }
        
        return fixedUrl;
      }
    } catch (e) {
      console.warn(`[Coupang Extension] Data Viewer failed to fix URL encoding: ${url}`, e);
    }
    
    return url;
  }
  
  // Start batch processing
  function startBatchProcessing() {
    const urlsText = document.getElementById('batchUrls').value.trim();
    
    if (!urlsText) {
      // No new URLs provided, check if we can continue processing existing "No Data" entries
      continueProcessingNoData();
      return;
    }
    
    let urls = urlsText.split('\n').filter(url => url.trim()).map(url => url.trim());
    
    if (urls.length === 0) {
      // No new URLs, check if we can continue processing existing "No Data" entries
      continueProcessingNoData();
      return;
    }
    
    // Fix brand encoding in URLs
    urls = urls.map(url => fixBrandEncodingInUrl(url));
    
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
        console.log('[Coupang Extension] Data Viewer cleared old data and saved new placeholder data:', placeholderData);
        
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
        if (isImgItemMode) {
          batchSettings['coupang_img_item_data'] = []; // Clear old IMG item data
        } else {
          batchSettings['coupang_delivery_data'] = []; // Clear old SKU count data only for new batches
        }
      }
      
      // Always set the current mode
      batchSettings['coupang_img_item_mode'] = isImgItemMode;
    
    chrome.storage.local.set(batchSettings, function() {
      const processingType = isImgItemMode ? 'IMG item' : 'SKU';
      console.log(`[Coupang Extension] Data Viewer ${processingType} batch processing started with URLs:`, urls);
      console.log(`[Coupang Extension] Data Viewer starting ${processingType} processing with first valid URL:`, firstValidUrl, 'at index:', firstValidIndex);
      console.log('[Coupang Extension] Data Viewer original batch URLs saved for order preservation:', urls);
      
      // Open first valid URL for processing
      chrome.tabs.create({ url: firstValidUrl }, function(tab) {
        const processingType = isImgItemMode ? 'IMG item' : 'SKU';
        showStatus(`Starting ${processingType} batch processing: ${urls.length} URLs`, 'success');
        
        // Send message to start processing after page loads
        setTimeout(() => {
          const messageAction = isImgItemMode ? 'startImgItemProcessing' : 'startProcessing';
          chrome.tabs.sendMessage(tab.id, { 
            action: messageAction,
            urlPosition: firstValidIndex
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.log(`[Coupang Extension] Data Viewer failed to start ${isImgItemMode ? 'IMG item' : 'SKU'} processing:`, chrome.runtime.lastError);
            } else {
              console.log(`[Coupang Extension] Data Viewer ${isImgItemMode ? 'IMG item' : 'SKU'} processing started successfully:`, response);
            }
          });
        }, 4000); // Wait for page to fully load
      });
    });
  }
  
  // Stop batch processing
  function stopBatchProcessing() {
    console.log('[Coupang Extension] Data Viewer stopping batch processing - preserving all data');
    
    // Get current batch processing data to ensure all brands are preserved
    chrome.storage.local.get(['coupang_delivery_data', 'coupang_batch_urls'], function(result) {
      const currentData = result.coupang_delivery_data || [];
      const batchUrls = result.coupang_batch_urls || [];
      
      console.log(`[Coupang Extension] Data Viewer before stopping: ${currentData.length} data entries`);
      console.log(`[Coupang Extension] Data Viewer batch URLs: ${batchUrls.length} URLs`);
      
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
      
      console.log(`[Coupang Extension] Data Viewer all brands from URLs:`, allBrands);
      console.log(`[Coupang Extension] Data Viewer existing brands with data:`, Array.from(existingBrands));
      console.log(`[Coupang Extension] Data Viewer missing brands (need No Data entries):`, missingBrands);
      
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
          console.log(`[Coupang Extension] Data Viewer added ${noDataEntries.length} No Data entries:`, noDataEntries);
          
          // Now remove batch processing states
          chrome.storage.local.remove([
            'coupang_batch_processing',
            'coupang_batch_urls',
            'coupang_batch_current_index',
            'coupang_batch_current_url',
            'coupang_auto_collecting'
          ], function() {
            console.log('[Coupang Extension] Data Viewer batch processing stopped - all brands preserved including No Data');
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
          console.log('[Coupang Extension] Data Viewer batch processing stopped - all brands already preserved');
          showStatus('Batch processing stopped', 'success');
          
          // Refresh the display
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
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    statusDiv.textContent = message;
    
    document.body.appendChild(statusDiv);
    
    setTimeout(() => {
      if (statusDiv.parentNode) {
        statusDiv.parentNode.removeChild(statusDiv);
      }
    }, 5000);
  }
  
  // Make table columns resizable
  function makeTableColumnsResizable() {
    const table = document.querySelector('.data-table');
    if (!table) return;
    
    const ths = table.querySelectorAll('th');
    ths.forEach((th, index) => {
      // Don't add resizer to the last column
      if (index < ths.length - 1) {
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);
        
        let startX, startWidth, nextStartWidth;
        
        resizer.addEventListener('mousedown', function(e) {
          startX = e.clientX;
          startWidth = parseInt(document.defaultView.getComputedStyle(th).width, 10);
          
          const nextTh = th.nextElementSibling;
          if (nextTh) {
            nextStartWidth = parseInt(document.defaultView.getComputedStyle(nextTh).width, 10);
          }
          
          document.addEventListener('mousemove', doResize);
          document.addEventListener('mouseup', stopResize);
          e.preventDefault();
        });
        
        function doResize(e) {
          const diff = e.clientX - startX;
          const newWidth = startWidth + diff;
          const nextTh = th.nextElementSibling;
          
          if (newWidth > 80 && (!nextTh || nextStartWidth - diff > 80)) {
            th.style.width = newWidth + 'px';
            if (nextTh) {
              nextTh.style.width = (nextStartWidth - diff) + 'px';
            }
          }
        }
        
        function stopResize() {
          document.removeEventListener('mousemove', doResize);
          document.removeEventListener('mouseup', stopResize);
        }
      }
    });
  }
  
  // Toggle IMG Item mode
  function toggleImgItemMode() {
    // Temporarily stop auto refresh during mode switch
    stopAutoRefresh();
    
    chrome.storage.local.get(['coupang_img_item_mode'], function(result) {
      const currentMode = result.coupang_img_item_mode || false;
      const newMode = !currentMode;
      
      chrome.storage.local.set({ 'coupang_img_item_mode': newMode }, function() {
        isImgItemMode = newMode;
        updateImgItemButton();
        
        if (newMode) {
          showStatus('IMG Item 模式已開啟', 'success');
          updateUIForImgItemMode(true);
        } else {
          showStatus('IMG Item 模式已關閉', 'success');
          updateUIForImgItemMode(false);
        }
        
        // Immediately load data for the new mode
        loadDeliveryData();
        
        // Restart auto refresh after a short delay
        setTimeout(() => {
          startAutoRefresh();
        }, 500);
      });
    });
  }

  // Update IMG Item button appearance
  function updateImgItemButton() {
    const imgItemBtn = document.getElementById('imgItemBtn');
    if (isImgItemMode) {
      imgItemBtn.classList.remove('btn-secondary');
      imgItemBtn.classList.add('btn-primary');
      imgItemBtn.textContent = 'IMG Item (ON)';
    } else {
      imgItemBtn.classList.remove('btn-primary');
      imgItemBtn.classList.add('btn-secondary');
      imgItemBtn.textContent = 'IMG Item';
    }
  }

  // Update UI for IMG Item mode
  function updateUIForImgItemMode(enabled) {
    const batchSection = document.querySelector('.batch-section h3');
    const batchInfo = document.querySelector('.batch-info');
    
    if (enabled) {
      batchSection.textContent = 'IMG Item Processing';
      batchInfo.textContent = 'Enter search URLs to extract product images and names.';
    } else {
      batchSection.textContent = 'Batch Processing';
      batchInfo.textContent = 'Enter brand search URLs (one per line).';
    }
  }

  // Export IMG Item data as CSV
  function exportImgItemData() {
    chrome.storage.local.get(['coupang_img_item_data'], function(result) {
      const data = result.coupang_img_item_data || [];
      
      if (data.length === 0) {
        showStatus('No IMG item data to export', 'error');
        return;
      }
      
      console.log('[Coupang Extension] Data Viewer exporting IMG item data:', data.length, 'items');
      
      // Sort data by URL position and page
      const sortedData = data.sort((a, b) => {
        if (a.urlPosition !== b.urlPosition) {
          return a.urlPosition - b.urlPosition;
        }
        return a.page - b.page;
      });
      
      // Create CSV content with 4 columns
      let csvContent = 'Brand,Product Name,Image URL,Item URL\n';
      sortedData.forEach(item => {
        const brand = (item.brand || 'Unknown Brand').replace(/"/g, '""');
        const productName = (item.name || 'Unknown Product').replace(/"/g, '""');
        const imageUrl = (item.imageUrl || '').replace(/"/g, '""');
        const itemUrl = (item.itemUrl || '').replace(/"/g, '""');
        
        csvContent += `"${brand}","${productName}","${imageUrl}","${itemUrl}"\n`;
      });
      
      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `coupang_img_item_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showStatus(`IMG item CSV exported successfully (${sortedData.length} items)`, 'success');
    });
  }

  // Copy IMG Item data to clipboard
  function copyImgItemData() {
    chrome.storage.local.get(['coupang_img_item_data'], function(result) {
      const data = result.coupang_img_item_data || [];
      
      if (data.length === 0) {
        showStatus('No IMG item data to copy', 'error');
        return;
      }
      
      console.log('[Coupang Extension] Data Viewer copying IMG item data:', data.length, 'items');
      
      // Sort data by URL position and page
      const sortedData = data.sort((a, b) => {
        if (a.urlPosition !== b.urlPosition) {
          return a.urlPosition - b.urlPosition;
        }
        return a.page - b.page;
      });
      
      // Create text content with 4 columns
      let textContent = 'Brand\tProduct Name\tImage URL\tItem URL\n';
      sortedData.forEach(item => {
        const brand = item.brand || 'Unknown Brand';
        const productName = item.name || 'Unknown Product';
        const imageUrl = item.imageUrl || '';
        const itemUrl = item.itemUrl || '';
        
        textContent += `${brand}\t${productName}\t${imageUrl}\t${itemUrl}\n`;
      });
      
      // Copy to clipboard
      navigator.clipboard.writeText(textContent).then(() => {
        showStatus(`IMG item data copied to clipboard (${sortedData.length} items)`, 'success');
      }).catch(err => {
        console.error('[Coupang Extension] Data Viewer copy failed:', err);
        showStatus('Copy failed', 'error');
      });
    });
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
  });
}); 