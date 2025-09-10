// 簡單圖片匹配器 - 不使用OpenCV
// 基於像素比較和直方圖的簡單匹配算法

// 數據持久化
const STORAGE_KEY = 'imageMatcherData';

async function saveData() {
  const data = {
    colA: document.getElementById('colA').value,
    colB: document.getElementById('colB').value,
    threshold: document.getElementById('threshold').value,
    timestamp: Date.now()
  };
  
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    showSaveStatus('Data saved successfully');
    console.log('Data saved to storage');
  } catch (error) {
    console.error('Failed to save data:', error);
    showSaveStatus('Failed to save data', true);
  }
}

async function loadData() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const data = result[STORAGE_KEY];
    
    if (data) {
      document.getElementById('colA').value = data.colA || '';
      document.getElementById('colB').value = data.colB || '';
      document.getElementById('threshold').value = data.threshold || '0.8';
      showSaveStatus('Data loaded successfully');
      console.log('Data loaded from storage, saved at:', new Date(data.timestamp));
    } else {
      showSaveStatus('No saved data found');
    }
  } catch (error) {
    console.error('Failed to load data:', error);
    showSaveStatus('Failed to load data', true);
  }
}

function showSaveStatus(message, isError = false) {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = message;
  statusEl.style.background = isError ? '#dc3545' : '#28a745';
  statusEl.classList.add('show');
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 2000);
}

function setupAutoSave() {
  const inputs = ['colA', 'colB', 'threshold'];
  inputs.forEach(id => {
    const element = document.getElementById(id);
    element.addEventListener('input', debounce(saveData, 1000));
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 檢查URL是否為有效的圖片URL
function isValidImageUrl(url) {
  // 檢查是否為搜索頁面URL
  if (url.includes('/search?') || url.includes('keyword=')) {
    return { valid: false, reason: 'This is a search page URL, not an image URL' };
  }
  
  // 檢查是否包含圖片副檔名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const hasImageExtension = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
  // 檢查是否為已知的圖片CDN域名
  const imageDomains = [
    'coupangcdn.com',
    'shopeemobile.com', 
    'shopee.tw/api',
    'cf.shopee.tw',
    'deo.shopee',
    'thumbnail'
  ];
  
  const isImageDomain = imageDomains.some(domain => 
    url.toLowerCase().includes(domain)
  );
  
  if (!hasImageExtension && !isImageDomain) {
    return { 
      valid: false, 
      reason: 'URL does not appear to be an image. Please use direct image URLs (ending with .jpg, .png, etc.)' 
    };
  }
  
  return { valid: true };
}

// 圖片載入函數
async function loadImage(url) {
  return new Promise((resolve, reject) => {
    // 先檢查URL有效性
    const urlCheck = isValidImageUrl(url);
    if (!urlCheck.valid) {
      reject(new Error(`Invalid URL: ${urlCheck.reason}\nURL: ${url}`));
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image (possibly not a valid image URL): ${url}`));
    
    setTimeout(() => reject(new Error(`Image load timeout: ${url}`)), 15000);
    
    img.src = url;
  });
}

// 將圖片轉換為Canvas並獲取像素數據
function getImageData(img, maxSize = 100) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // 計算縮放比例
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const width = Math.floor(img.width * scale);
  const height = Math.floor(img.height * scale);
  
  canvas.width = width;
  canvas.height = height;
  
  // 繪製圖片
  ctx.drawImage(img, 0, 0, width, height);
  
  // 獲取像素數據
  return ctx.getImageData(0, 0, width, height);
}

// 計算圖片的顏色直方圖
function getColorHistogram(imageData) {
  const data = imageData.data;
  const histogram = {
    r: new Array(256).fill(0),
    g: new Array(256).fill(0),
    b: new Array(256).fill(0)
  };
  
  for (let i = 0; i < data.length; i += 4) {
    histogram.r[data[i]]++;     // Red
    histogram.g[data[i + 1]]++; // Green  
    histogram.b[data[i + 2]]++; // Blue
  }
  
  return histogram;
}

// 計算兩個直方圖的相似度
function compareHistograms(hist1, hist2) {
  let correlation = 0;
  let sum1 = 0, sum2 = 0;
  
  // 計算相關係數
  for (let i = 0; i < 256; i++) {
    correlation += hist1.r[i] * hist2.r[i];
    correlation += hist1.g[i] * hist2.g[i];
    correlation += hist1.b[i] * hist2.b[i];
    
    sum1 += hist1.r[i] * hist1.r[i] + hist1.g[i] * hist1.g[i] + hist1.b[i] * hist1.b[i];
    sum2 += hist2.r[i] * hist2.r[i] + hist2.g[i] * hist2.g[i] + hist2.b[i] * hist2.b[i];
  }
  
  const denominator = Math.sqrt(sum1 * sum2);
  return denominator > 0 ? correlation / denominator : 0;
}

// 簡單的像素差異比較
function comparePixels(imageData1, imageData2) {
  const data1 = imageData1.data;
  const data2 = imageData2.data;
  
  if (data1.length !== data2.length) {
    return 0; // 不同尺寸
  }
  
  let totalDiff = 0;
  let pixelCount = 0;
  
  for (let i = 0; i < data1.length; i += 4) {
    const rDiff = Math.abs(data1[i] - data2[i]);
    const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
    const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
    
    totalDiff += (rDiff + gDiff + bDiff) / 3;
    pixelCount++;
  }
  
  const avgDiff = totalDiff / pixelCount;
  return Math.max(0, 1 - (avgDiff / 255)); // 轉換為相似度分數
}

// 綜合圖片匹配函數
async function matchImages(imgA, imgB) {
  try {
    const imageDataA = getImageData(imgA);
    const imageDataB = getImageData(imgB);
    
    // 方法1: 直方圖比較
    const histA = getColorHistogram(imageDataA);
    const histB = getColorHistogram(imageDataB);
    const histogramScore = compareHistograms(histA, histB);
    
    // 方法2: 像素比較
    const pixelScore = comparePixels(imageDataA, imageDataB);
    
    // 綜合分數 (直方圖佔70%，像素比較佔30%)
    const finalScore = histogramScore * 0.7 + pixelScore * 0.3;
    
    return {
      score: finalScore,
      histogramScore: histogramScore,
      pixelScore: pixelScore,
      method: 'histogram+pixel'
    };
  } catch (error) {
    console.error('Image matching error:', error);
    return { score: 0, error: error.message };
  }
}

// UI 控制函數
function updateProgress(current, total, text) {
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  progressContainer.style.display = 'block';
  const percentage = (current / total) * 100;
  progressFill.style.width = `${percentage}%`;
  progressText.textContent = text || `Processing ${current}/${total} (${percentage.toFixed(1)}%)`;
}

function hideProgress() {
  document.getElementById('progress-container').style.display = 'none';
}

function showResults(results) {
  const resultsSection = document.getElementById('results-section');
  const matchedCount = document.getElementById('matched-count');
  const unmatchedCount = document.getElementById('unmatched-count');
  const errorCount = document.getElementById('error-count');
  const resultsGrid = document.getElementById('results-grid');
  
  const matched = results.filter(r => r.matched && !r.error).length;
  const total = results.length;
  const errors = results.filter(r => r.error).length;
  
  matchedCount.textContent = matched;
  unmatchedCount.textContent = total - matched - errors;
  errorCount.textContent = errors;
  
  resultsGrid.innerHTML = '';
  results.forEach((result, index) => {
    const card = document.createElement('div');
    const status = result.error ? 'error' : (result.matched ? 'matched' : 'unmatched');
    card.className = `result-card ${status}`;
    
    let title, details;
    if (result.error) {
      title = `A${index + 1} - Error`;
      details = result.error;
    } else if (result.matched) {
      title = `A${index + 1} - Matched`;
      details = `Score: ${result.matched.score.toFixed(3)}\nMethod: ${result.matched.method}\nMatched to: ${result.matched.b_url.substring(result.matched.b_url.lastIndexOf('/') + 1)}`;
    } else {
      title = `A${index + 1} - No Match`;
      details = 'No similar image found in Group B';
    }
    
    card.innerHTML = `
      <div class="result-title ${status}">${title}</div>
      <div class="result-details">${details}</div>
    `;
    
    resultsGrid.appendChild(card);
  });
  
  resultsSection.style.display = 'block';
}

// 主要匹配邏輯
async function startMatching() {
  const log = (m) => {
    document.getElementById('log').textContent += m + "\n";
    document.getElementById('log').scrollTop = document.getElementById('log').scrollHeight;
  };
  
  document.getElementById('log').textContent = "";
  document.getElementById('run').disabled = true;
  
  try {
    const Aurls = document.getElementById('colA').value.split('\n').map(s => s.trim()).filter(Boolean);
    const Burls = document.getElementById('colB').value.split('\n').map(s => s.trim()).filter(Boolean);
    const threshold = parseFloat(document.getElementById('threshold').value);

    if (Aurls.length === 0) {
      alert('Please enter Group A image URLs');
      return;
    }
    if (Burls.length === 0) {
      alert('Please enter Group B image URLs');
      return;
    }

    log(`Starting simple image matching...`);
    log(`Group A: ${Aurls.length} images, Group B: ${Burls.length} images`);
    log(`Similarity threshold: ${threshold}`);
    
    const results = [];
    document.getElementById('results-section').style.display = 'none';

    for (let i = 0; i < Aurls.length; i++) {
      const Au = Aurls[i];
      try {
        updateProgress(i, Aurls.length, `Processing Group A image ${i + 1}/${Aurls.length}`);
        log(`[${i + 1}/${Aurls.length}] Processing: ${Au.substring(Au.lastIndexOf('/') + 1)}`);
        
        const imgA = await loadImage(Au);
        let bestMatch = null;
        let bestScore = 0;

        // 與B組中的每張圖片比較
        for (let j = 0; j < Burls.length; j++) {
          const Bu = Burls[j];
          try {
            const imgB = await loadImage(Bu);
            const matchResult = await matchImages(imgA, imgB);
            
            if (matchResult.score > bestScore) {
              bestScore = matchResult.score;
              bestMatch = {
                b_url: Bu,
                score: matchResult.score,
                histogramScore: matchResult.histogramScore,
                pixelScore: matchResult.pixelScore,
                method: matchResult.method
              };
            }
          } catch (error) {
            console.warn(`Failed to process B image ${Bu}:`, error);
          }
        }

        // 判斷是否匹配成功
        if (bestMatch && bestScore >= threshold) {
          results.push({ a_url: Au, matched: bestMatch });
          log(`  Match found! Score: ${bestScore.toFixed(3)}`);
        } else {
          results.push({ a_url: Au, matched: null });
          log(`  No match found (best score: ${bestScore.toFixed(3)})`);
        }
        
      } catch (err) {
        results.push({ a_url: Au, error: String(err) });
        log(`  Error: ${String(err)}`);
      }
    }

    updateProgress(Aurls.length, Aurls.length, 'Processing complete');
    hideProgress();
    showResults(results);
    
    log("\nDetailed Results:");
    log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    log(`System error: ${error.message}`);
    hideProgress();
  } finally {
    document.getElementById('run').disabled = false;
  }
}

// 事件監聽器
document.addEventListener('DOMContentLoaded', async () => {
  // 不需要載入OpenCV，直接啟用功能
  document.getElementById('opencv-status').textContent = 'Simple image matching ready';
  document.getElementById('opencv-status').className = 'status-indicator status-ready';
  document.getElementById('run').disabled = false;
  
  await loadData();
  setupAutoSave();
  
  document.getElementById('run').addEventListener('click', startMatching);
  
  document.getElementById('clear').addEventListener('click', () => {
    document.getElementById('colA').value = '';
    document.getElementById('colB').value = '';
    document.getElementById('log').textContent = '';
    document.getElementById('results-section').style.display = 'none';
    saveData();
  });
  
  document.getElementById('save').addEventListener('click', saveData);
  document.getElementById('load').addEventListener('click', loadData);
  
  document.getElementById('openWindow').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'openWindow' });
    } catch (error) {
      console.error('Failed to open window:', error);
      try {
        await chrome.windows.create({
          url: 'simple_matcher_window.html',
          type: 'popup',
          width: 1200,
          height: 800,
          left: 100,
          top: 100
        });
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        alert('Failed to open standalone window. Please try again.');
      }
    }
  });
});
