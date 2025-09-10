// 簡單圖片匹配器 - 快速精確的圖片匹配
// 使用顏色分析和結構相似性

// 數據持久化
const STORAGE_KEY = 'advancedImageMatcherData';

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
      document.getElementById('threshold').value = data.threshold || '0.85';
      showSaveStatus('Data loaded successfully');
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
  if (url.includes('/search?') || url.includes('keyword=')) {
    return { valid: false, reason: 'This is a search page URL, not an image URL' };
  }
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const hasImageExtension = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );
  
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
    const urlCheck = isValidImageUrl(url);
    if (!urlCheck.valid) {
      reject(new Error(`Invalid URL: ${urlCheck.reason}\nURL: ${url}`));
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    
    setTimeout(() => reject(new Error(`Image load timeout: ${url}`)), 15000);
    
    img.src = url;
  });
}

// === 簡單匹配模式 ===
function getImageData(img, maxSize = 100) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const width = Math.floor(img.width * scale);
  const height = Math.floor(img.height * scale);
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  
  return ctx.getImageData(0, 0, width, height);
}

function getColorHistogram(imageData) {
  const data = imageData.data;
  const histogram = {
    r: new Array(256).fill(0),
    g: new Array(256).fill(0),
    b: new Array(256).fill(0)
  };
  
  for (let i = 0; i < data.length; i += 4) {
    histogram.r[data[i]]++;
    histogram.g[data[i + 1]]++;
    histogram.b[data[i + 2]]++;
  }
  
  return histogram;
}

function compareHistograms(hist1, hist2) {
  // 使用巴氏距離 (Bhattacharyya distance) 進行更精確的直方圖比較
  let bhattacharyya = 0;
  let sum1 = 0, sum2 = 0;
  
  // 計算直方圖總和
  for (let i = 0; i < 256; i++) {
    sum1 += hist1.r[i] + hist1.g[i] + hist1.b[i];
    sum2 += hist2.r[i] + hist2.g[i] + hist2.b[i];
  }
  
  // 正規化直方圖
  for (let i = 0; i < 256; i++) {
    const p1r = hist1.r[i] / sum1;
    const p1g = hist1.g[i] / sum1;
    const p1b = hist1.b[i] / sum1;
    
    const p2r = hist2.r[i] / sum2;
    const p2g = hist2.g[i] / sum2;
    const p2b = hist2.b[i] / sum2;
    
    bhattacharyya += Math.sqrt(p1r * p2r) + Math.sqrt(p1g * p2g) + Math.sqrt(p1b * p2b);
  }
  
  // 轉換為相似度分數 (0-1)
  return Math.max(0, bhattacharyya / 3); // 除以3因為有RGB三個通道
}

// 計算結構相似性指數 (SSIM的簡化版本)
function calculateSSIM(imageData1, imageData2) {
  const data1 = imageData1.data;
  const data2 = imageData2.data;
  
  if (data1.length !== data2.length) return 0;
  
  let mean1 = 0, mean2 = 0;
  let variance1 = 0, variance2 = 0, covariance = 0;
  const pixelCount = data1.length / 4;
  
  // 計算平均值
  for (let i = 0; i < data1.length; i += 4) {
    const gray1 = (data1[i] + data1[i + 1] + data1[i + 2]) / 3;
    const gray2 = (data2[i] + data2[i + 1] + data2[i + 2]) / 3;
    mean1 += gray1;
    mean2 += gray2;
  }
  mean1 /= pixelCount;
  mean2 /= pixelCount;
  
  // 計算變異數和共變異數
  for (let i = 0; i < data1.length; i += 4) {
    const gray1 = (data1[i] + data1[i + 1] + data1[i + 2]) / 3;
    const gray2 = (data2[i] + data2[i + 1] + data2[i + 2]) / 3;
    
    const diff1 = gray1 - mean1;
    const diff2 = gray2 - mean2;
    
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
    covariance += diff1 * diff2;
  }
  
  variance1 /= (pixelCount - 1);
  variance2 /= (pixelCount - 1);
  covariance /= (pixelCount - 1);
  
  // 簡化的SSIM公式
  const c1 = 6.5025, c2 = 58.5225;
  const numerator = (2 * mean1 * mean2 + c1) * (2 * covariance + c2);
  const denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (variance1 + variance2 + c2);
  
  return denominator > 0 ? numerator / denominator : 0;
}

async function simpleMatchImages(imgA, imgB) {
  try {
    const imageDataA = getImageData(imgA, 64); // 使用較小尺寸提高精度
    const imageDataB = getImageData(imgB, 64);
    
    // 方法1: 直方圖比較
    const histA = getColorHistogram(imageDataA);
    const histB = getColorHistogram(imageDataB);
    const histogramScore = compareHistograms(histA, histB);
    
    // 方法2: 結構相似性
    const ssimScore = calculateSSIM(imageDataA, imageDataB);
    
    // 方法3: 尺寸比例檢查 (避免完全不同尺寸的圖片匹配)
    const aspectRatioA = imgA.width / imgA.height;
    const aspectRatioB = imgB.width / imgB.height;
    const aspectRatioDiff = Math.abs(aspectRatioA - aspectRatioB);
    const aspectRatioScore = Math.max(0, 1 - aspectRatioDiff); // 尺寸比例相似度
    
    // 綜合評分：直方圖50% + SSIM30% + 尺寸比例20%
    const finalScore = histogramScore * 0.5 + ssimScore * 0.3 + aspectRatioScore * 0.2;
    
    return {
      score: finalScore,
      histogramScore: histogramScore,
      ssimScore: ssimScore,
      aspectRatioScore: aspectRatioScore,
      method: 'enhanced_simple'
    };
  } catch (error) {
    console.error('Simple matching error:', error);
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
  
  const matched = results.filter(r => r.matched === 1).length;
  const unmatched = results.filter(r => r.matched === 0).length;
  const errors = results.filter(r => r.error).length;
  
  matchedCount.textContent = matched;
  unmatchedCount.textContent = unmatched;
  errorCount.textContent = errors;
  
  // 創建表格
  resultsGrid.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #f8f9fa;">
          <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left; width: 25%;">A URL</th>
          <th style="padding: 10px; border: 1px solid #dee2e6; text-align: center; width: 8%;">Match</th>
          <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left; width: 22%;">B1</th>
          <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left; width: 22%;">B2</th>
          <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left; width: 22%;">B3</th>
        </tr>
      </thead>
      <tbody>
        ${results.map((result, index) => {
          if (result.error) {
            return `
              <tr style="background: #fff5f5;">
                <td style="padding: 6px; border: 1px solid #dee2e6; font-family: monospace; font-size: 10px; word-break: break-all;">${result.a_url}</td>
                <td style="padding: 6px; border: 1px solid #dee2e6; text-align: center; color: #ffc107; font-weight: bold;">ERROR</td>
                <td style="padding: 6px; border: 1px solid #dee2e6;">-</td>
                <td style="padding: 6px; border: 1px solid #dee2e6;">-</td>
                <td style="padding: 6px; border: 1px solid #dee2e6;">-</td>
              </tr>
            `;
          } else {
            const matchStatus = result.matched === 1 ? '1' : '0';
            const matchColor = result.matched === 1 ? '#28a745' : '#dc3545';
            const bgColor = result.matched === 1 ? '#f8fff9' : '#fff5f5';
            
            // 獲取前3個匹配的B連結
            const b1 = result.matched_b_urls && result.matched_b_urls[0] ? result.matched_b_urls[0] : '-';
            const b2 = result.matched_b_urls && result.matched_b_urls[1] ? result.matched_b_urls[1] : '-';
            const b3 = result.matched_b_urls && result.matched_b_urls[2] ? result.matched_b_urls[2] : '-';
            
            return `
              <tr style="background: ${bgColor};">
                <td style="padding: 6px; border: 1px solid #dee2e6; font-family: monospace; font-size: 10px; word-break: break-all;">${result.a_url}</td>
                <td style="padding: 6px; border: 1px solid #dee2e6; text-align: center; color: ${matchColor}; font-weight: bold; font-size: 14px;">${matchStatus}</td>
                <td style="padding: 6px; border: 1px solid #dee2e6; font-family: monospace; font-size: 9px; word-break: break-all;">${b1}</td>
                <td style="padding: 6px; border: 1px solid #dee2e6; font-family: monospace; font-size: 9px; word-break: break-all;">${b2}</td>
                <td style="padding: 6px; border: 1px solid #dee2e6; font-family: monospace; font-size: 9px; word-break: break-all;">${b3}</td>
              </tr>
            `;
          }
        }).join('')}
      </tbody>
    </table>
  `;
  
      resultsSection.style.display = 'block';
  
  // 顯示導出按鈕
  document.getElementById('export').style.display = 'inline-flex';
}

// CSV導出功能
function exportToCSV(results) {
  const csvContent = [
    // CSV標題
    ['A_URL', 'Match', 'B1_URL', 'B2_URL', 'B3_URL', 'Match_Count', 'Best_Score'].join(','),
    // CSV數據
    ...results.map(result => {
      if (result.error) {
        return [
          `"${result.a_url}"`,
          'ERROR',
          '-',
          '-',
          '-',
          '0',
          '-'
        ].join(',');
      } else {
        const b1 = result.matched_b_urls && result.matched_b_urls[0] ? `"${result.matched_b_urls[0]}"` : '-';
        const b2 = result.matched_b_urls && result.matched_b_urls[1] ? `"${result.matched_b_urls[1]}"` : '-';
        const b3 = result.matched_b_urls && result.matched_b_urls[2] ? `"${result.matched_b_urls[2]}"` : '-';
        
        return [
          `"${result.a_url}"`,
          result.matched,
          b1,
          b2,
          b3,
          result.matched_count,
          result.best_score.toFixed(3)
        ].join(',');
      }
    })
  ].join('\n');
  
  // 創建下載
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `image_matching_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showSaveStatus('CSV exported successfully');
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

        // 逐一比較B組圖片，找到3個匹配才換下一個A
        const matches = [];
        for (let j = 0; j < Burls.length; j++) {
          const Bu = Burls[j];
          try {
            log(`    Comparing with B${j + 1}... (${Bu.substring(Bu.lastIndexOf('/') + 1)})`);
            const imgB = await loadImage(Bu);
            
            const matchResult = await simpleMatchImages(imgA, imgB);
            
            log(`      Score: ${matchResult.score.toFixed(3)} (threshold: ${threshold})`);
            
            // 如果分數超過閾值，記錄匹配
            if (matchResult.score >= threshold) {
              matches.push({
                b_url: Bu,
                b_index: j + 1,
                b_filename: Bu.substring(Bu.lastIndexOf('/') + 1),
                score: matchResult.score,
                method: matchResult.method
              });
              log(`    ✓ Match ${matches.length} found! B${j + 1} (${Bu.substring(Bu.lastIndexOf('/') + 1)}), Score: ${matchResult.score.toFixed(3)}`);
              
              // 找到3個匹配就停止
              if (matches.length >= 3) {
                log(`    Found 3 matches for A${i + 1} - Moving to next A`);
                break;
              }
            } else {
              log(`    ✗ No match (score: ${matchResult.score.toFixed(3)} < threshold: ${threshold})`);
            }
          } catch (error) {
            console.warn(`Failed to process B image ${Bu}:`, error);
            log(`    Error processing B${j + 1}: ${error.message}`);
          }
        }

        if (matches.length > 0) {
          // 按分數排序，顯示最好的匹配
          matches.sort((a, b) => b.score - a.score);
          
          results.push({ 
            a_url: Au, 
            a_index: i + 1,
            matched: 1,
            matched_count: matches.length,
            matched_b_list: matches.map(m => `B${m.b_index}`).join(', '),
            matched_b_urls: matches.map(m => m.b_url),
            matched_b_filenames: matches.map(m => m.b_filename).join(', '),
            best_score: matches[0].score, // 最高分數
            method: matches[0].method,
            all_scores: matches.map(m => m.score.toFixed(3)).join(', ')
          });
          log(`  Final result: Found ${matches.length} matches for A${i + 1}`);
        } else {
          results.push({ 
            a_url: Au, 
            a_index: i + 1,
            matched: 0,
            matched_count: 0,
            matched_b_list: '-',
            matched_b_urls: [],
            matched_b_filenames: '-',
            best_score: 0,
            method: null,
            all_scores: '-'
          });
          log(`  Final result: No matches found for A${i + 1}`);
        }
        
      } catch (err) {
        results.push({ a_url: Au, error: String(err) });
        log(`  Error: ${String(err)}`);
      }
    }

    updateProgress(Aurls.length, Aurls.length, 'Processing complete');
    hideProgress();
    showResults(results);
    
    // 保存結果供導出使用
    window.currentResults = results;
    
    log("\nMatching Summary:");
    log(`Total: ${results.length}, Matched: ${results.filter(r => r.matched === 1).length}, Unmatched: ${results.filter(r => r.matched === 0).length}, Errors: ${results.filter(r => r.error).length}`);
    
  } catch (error) {
    log(`System error: ${error.message}`);
    hideProgress();
  } finally {
    document.getElementById('run').disabled = false;
  }
}

// 事件監聽器
document.addEventListener('DOMContentLoaded', async () => {
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
  
  document.getElementById('export').addEventListener('click', () => {
    if (window.currentResults) {
      exportToCSV(window.currentResults);
    } else {
      alert('No results to export. Please run matching first.');
    }
  });
  
  document.getElementById('openWindow').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'openWindow' });
    } catch (error) {
      console.error('Failed to open window:', error);
      try {
        await chrome.windows.create({
          url: 'matcher_window.html',
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
