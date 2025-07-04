document.addEventListener('DOMContentLoaded', function() {
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusDiv = document.getElementById('status');
  const dataBody = document.getElementById('dataBody');

  function showStatus(message, type = 'success') {
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => { statusDiv.innerHTML = ''; }, 3000);
  }

  function loadAndDisplayData() {
    chrome.storage.local.get(['coupang_detail_data'], function(result) {
      const data = result.coupang_detail_data || [];
      renderTable(data);
    });
  }

  function renderTable(data) {
    dataBody.innerHTML = '';
    if (!data || data.length === 0) {
      dataBody.innerHTML = '<tr><td colspan="7" class="empty-state">No data available</td></tr>';
      return;
    }
    
    // 按時間倒序排列，最新的在前面
    const sortedData = data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    sortedData.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td title="${item.Brand || ''}">${item.Brand || '-'}</td>
        <td title="${item.VendorItemId || ''}">${item.VendorItemId || '-'}</td>
        <td title="${item.itemId || ''}">${item.itemId || '-'}</td>
        <td title="${item.Model_name || ''}" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.Model_name || '-'}</td>
        <td title="${item.price || ''}">${item.price || '-'}</td>
        <td title="${item.review_count || ''}">${item.review_count || '-'}</td>
        <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;">
          ${item.URL ? `<a href="${item.URL}" target="_blank" title="${item.URL}">View</a>` : '-'}
        </td>
      `;
      dataBody.appendChild(row);
    });
  }

  clearBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data? This operation cannot be undone.')) {
      chrome.storage.local.set({ coupang_detail_data: [] }, function() {
        loadAndDisplayData();
        showStatus('Data cleared', 'success');
      });
    }
  });

  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get(['coupang_detail_data'], function(result) {
      const data = result.coupang_detail_data || [];
      if (!data || data.length === 0) {
        showStatus('No data to export', 'error');
        return;
      }
      
      let csv = 'Brand,VendorItemId,itemId,Model_name,Price,Reviews,URL\n';
      data.forEach(item => {
        csv += `"${item.Brand || ''}","${item.VendorItemId || ''}","${item.itemId || ''}","${item.Model_name || ''}","${item.price || ''}","${item.review_count || ''}","${item.URL || ''}"\n`;
      });
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Coupang_Product_Data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus('CSV file exported', 'success');
    });
  });

  copyBtn.addEventListener('click', function() {
    chrome.storage.local.get(['coupang_detail_data'], function(result) {
      const data = result.coupang_detail_data || [];
      if (!data || data.length === 0) {
        showStatus('No data to copy', 'error');
        return;
      }
      
      let text = 'Brand\tVendorItemId\titemId\tModel_name\tPrice\tReviews\tURL\n';
      data.forEach(item => {
        text += `${item.Brand || ''}\t${item.VendorItemId || ''}\t${item.itemId || ''}\t${item.Model_name || ''}\t${item.price || ''}\t${item.review_count || ''}\t${item.URL || ''}\n`;
      });
      
      navigator.clipboard.writeText(text).then(function() {
        showStatus('Data copied to clipboard', 'success');
      }).catch(function(err) {
        showStatus('Copy failed', 'error');
      });
    });
  });

  // 監聽存儲變化，自動更新顯示
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.coupang_detail_data) {
      loadAndDisplayData();
    }
  });

  loadAndDisplayData();
}); 