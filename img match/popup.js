// AB 圖片子圖匹配器 - Popup版本

// 數據持久化
const STORAGE_KEY = 'imageMatcherData';

async function saveData() {
  const data = {
    colA: document.getElementById('colA').value,
    colB: document.getElementById('colB').value,
    tauHash: document.getElementById('tauHash').value,
    tauTM: document.getElementById('tauTM').value,
    scales: document.getElementById('scales').value,
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
      document.getElementById('tauHash').value = data.tauHash || '12';
      document.getElementById('tauTM').value = data.tauTM || '0.78';
      document.getElementById('scales').value = data.scales || '0.3,0.5,0.75,1,1.25,1.5,2.0';
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
  setTimeout(() => statusEl.classList.remove('show'), 2000);
}

function setupAutoSave() {
  const inputs = ['colA', 'colB', 'tauHash', 'tauTM', 'scales'];
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

// 圖片處理函數
async function loadImage(url) {
  return new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    setTimeout(() => reject(new Error(`Image load timeout: ${url}`)), 30000);
  img.src = url;
  });
}

function imgToMat(img, maxSide = 512) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  let eq = new cv.Mat();
  cv.equalizeHist(gray, eq);
  src.delete(); gray.delete();
  return eq;
}

function pHash64(mat) {
  let small = new cv.Mat();
  cv.resize(mat, small, new cv.Size(32, 32));
  small.convertTo(small, cv.CV_32F);
  let dct = new cv.Mat();
  cv.dct(small, dct);
  let roi = dct.roi(new cv.Rect(0,0,8,8));
  let arr = [];
  for (let r=0;r<8;r++){
    for (let c=0;c<8;c++){
      arr.push(roi.floatAt(r,c));
    }
  }
  const median = arr.slice().sort((a,b)=>a-b)[32];
  let bits = arr.map(v => v > median ? '1' : '0').join('');
  small.delete(); dct.delete(); roi.delete();
  return bits;
}

function hamming(a,b){
  let d=0; for (let i=0;i<a.length;i++) if (a[i]!==b[i]) d++; return d;
}

function detectAndMatchFeatures(img1Mat, img2Mat) {
  try {
    const orb = new cv.ORB(500);
    const kp1 = new cv.KeyPointVector();
    const kp2 = new cv.KeyPointVector();
    const desc1 = new cv.Mat();
    const desc2 = new cv.Mat();
    
    orb.detectAndCompute(img1Mat, new cv.Mat(), kp1, desc1);
    orb.detectAndCompute(img2Mat, new cv.Mat(), kp2, desc2);
    
    if (desc1.rows === 0 || desc2.rows === 0) {
      kp1.delete(); kp2.delete(); desc1.delete(); desc2.delete();
      return { matches: 0, confidence: 0 };
    }
    
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    matcher.match(desc1, desc2, matches);
    
    let goodMatches = 0;
    for (let i = 0; i < matches.size(); i++) {
      const match = matches.get(i);
      if (match.distance < 50) goodMatches++;
    }
    
    const confidence = goodMatches / Math.min(kp1.size(), kp2.size());
    kp1.delete(); kp2.delete(); desc1.delete(); desc2.delete(); 
    matches.delete(); matcher.delete(); orb.delete();
    
    return { matches: goodMatches, confidence };
  } catch (error) {
    console.warn('Feature detection failed:', error);
    return { matches: 0, confidence: 0 };
  }
}

function matchTemplateMultiScale(tmplMat, sceneMat, scales=[0.3,0.5,0.75,1,1.25,1.5,2.0]) {
  let best = {score: -1, scale: 1, loc: null, rect: null};
  
  for (const s of scales) {
    let tmplScaled = new cv.Mat();
    let newW = Math.max(1, Math.round(tmplMat.cols * s));
    let newH = Math.max(1, Math.round(tmplMat.rows * s));
    
    if (newW >= sceneMat.cols || newH >= sceneMat.rows || newW < 10 || newH < 10) { 
      continue; 
    }
    
    cv.resize(tmplMat, tmplScaled, new cv.Size(newW, newH));
    const methods = [cv.TM_CCOEFF_NORMED, cv.TM_CCORR_NORMED];

    for (const method of methods) {
    let result = new cv.Mat();
      cv.matchTemplate(sceneMat, tmplScaled, result, method);
    let minMax = cv.minMaxLoc(result);
      
      let score = method === cv.TM_SQDIFF_NORMED ? (1 - minMax.minVal) : minMax.maxVal;
      
      if (score > best.score) {
        best.score = score;
      best.scale = s;
        best.loc = method === cv.TM_SQDIFF_NORMED ? minMax.minLoc : minMax.maxLoc;
        best.rect = {x: best.loc.x, y: best.loc.y, w: tmplScaled.cols, h: tmplScaled.rows};
        best.method = method;
      }
      result.delete();
    }
    
    tmplScaled.delete();
  }
  return best;
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

function updateOpenCVStatus(status, message) {
  const statusEl = document.getElementById('opencv-status');
  statusEl.className = `status-indicator status-${status}`;
  statusEl.textContent = message;
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
      details = `Method: ${result.matched.method}\nScore: ${result.matched.score.toFixed(3)}\nConfidence: ${result.matched.confidence.toFixed(3)}`;
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

// OpenCV 初始化
let cvReady = false;
let cvLoadTimeout;

function loadOpenCV() {
  return new Promise((resolve, reject) => {
    // 檢查是否已經載入
    if (typeof cv !== 'undefined' && cv.Mat) {
      cvReady = true;
      updateOpenCVStatus('ready', 'OpenCV.js ready - you can start matching');
      document.getElementById('run').disabled = false;
      resolve();
      return;
    }

    // 多個OpenCV.js載入源，按順序嘗試
    const sources = [
      'https://docs.opencv.org/4.8.0/opencv.js',
      'https://cdn.jsdelivr.net/npm/opencv.js@4.8.0/opencv.js',
      'https://unpkg.com/opencv.js@4.8.0/opencv.js',
      'https://cdnjs.cloudflare.com/ajax/libs/opencv.js/4.8.0/opencv.js'
    ];

    let currentSourceIndex = 0;

    const tryLoadSource = () => {
      if (currentSourceIndex >= sources.length) {
        updateOpenCVStatus('error', 'All OpenCV.js sources failed - please check network connection');
        reject(new Error('All OpenCV.js sources failed'));
        return;
      }

      const currentSource = sources[currentSourceIndex];
      updateOpenCVStatus('loading', `Loading OpenCV.js from source ${currentSourceIndex + 1}/${sources.length}...`);
      console.log(`Trying to load OpenCV.js from: ${currentSource}`);

      cvLoadTimeout = setTimeout(() => {
        console.warn(`Source ${currentSourceIndex + 1} timed out, trying next source...`);
        currentSourceIndex++;
        tryLoadSource();
      }, 15000); // 每個源15秒超時

      const script = document.createElement('script');
      script.src = currentSource;
      script.async = true;
      
      script.onload = () => {
        console.log(`OpenCV.js script loaded from source ${currentSourceIndex + 1}`);
        clearTimeout(cvLoadTimeout);
        
        // 設置初始化回調
        const checkOpenCV = () => {
          if (typeof cv !== 'undefined' && cv.Mat) {
            cvReady = true;
            updateOpenCVStatus('ready', 'OpenCV.js ready - you can start matching');
            document.getElementById('run').disabled = false;
            console.log('OpenCV.js initialized successfully');
            resolve();
            return true;
          }
          return false;
        };

        // 立即檢查
        if (checkOpenCV()) return;

        // 設置運行時初始化回調
        if (typeof cv !== 'undefined') {
          cv['onRuntimeInitialized'] = () => {
            checkOpenCV();
          };
        } else {
          // 如果cv對象還沒準備好，定期檢查
          const checkInterval = setInterval(() => {
            if (checkOpenCV()) {
              clearInterval(checkInterval);
            }
          }, 100);
          
          // 10秒後停止檢查
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!cvReady) {
              updateOpenCVStatus('error', 'OpenCV.js initialization failed after loading');
              reject(new Error('OpenCV.js initialization failed'));
            }
          }, 10000);
        }
      };
      
      script.onerror = () => {
        console.warn(`Failed to load from source ${currentSourceIndex + 1}, trying next...`);
        clearTimeout(cvLoadTimeout);
        document.head.removeChild(script);
        currentSourceIndex++;
        tryLoadSource();
      };
      
      document.head.appendChild(script);
    };

    // 開始嘗試載入
    tryLoadSource();
  });
}

// 主要匹配邏輯
async function startMatching() {
  const log = (m) => {
    document.getElementById('log').textContent += m + "\n";
    document.getElementById('log').scrollTop = document.getElementById('log').scrollHeight;
  };
  
  document.getElementById('log').textContent = "";
  
  if (!cvReady) {
    updateOpenCVStatus('error', 'OpenCV.js not ready');
    return;
  }
  
  document.getElementById('run').disabled = true;
  
  try {
    const Aurls = document.getElementById('colA').value.split('\n').map(s => s.trim()).filter(Boolean);
    const Burls = document.getElementById('colB').value.split('\n').map(s => s.trim()).filter(Boolean);
    const tauHash = parseInt(document.getElementById('tauHash').value, 10);
  const tauTM = parseFloat(document.getElementById('tauTM').value);
  const scales = document.getElementById('scales').value.split(',').map(parseFloat);

    if (Aurls.length === 0) {
      alert('Please enter Group A image URLs');
      return;
    }
    if (Burls.length === 0) {
      alert('Please enter Group B image URLs');
      return;
    }

    log(`Starting processing - Group A: ${Aurls.length} images, Group B: ${Burls.length} images`);
    log(`Parameters: Hash threshold=${tauHash}, Template score=${tauTM}, Scales=[${scales.join(',')}]`);
    
  const cache = new Map();
    document.getElementById('results-section').style.display = 'none';

    async function getMatAndHash(url) {
    if (cache.has(url)) return cache.get(url);
    const img = await loadImage(url);
    const mat = imgToMat(img);
    const hash = pHash64(mat);
      const rec = { mat, hash };
      cache.set(url, rec);
      return rec;
  }

  const results = [];

    for (let i = 0; i < Aurls.length; i++) {
    const Au = Aurls[i];
      try {
        updateProgress(i, Aurls.length, `Processing Group A image ${i + 1}/${Aurls.length}`);
        log(`[${i + 1}/${Aurls.length}] Processing Group A image...`);
        const { mat: Amat, hash: Ah } = await getMatAndHash(Au);
      let matched = null;

        // 階段1：粗篩
      const candidates = [];
        for (const Bu of Burls) {
          const { mat: Bmat, hash: Bh } = await getMatAndHash(Bu);
          const dist = hamming(Ah, Bh);
          if (dist <= tauHash) {
            candidates.push({ Bu, Bmat, dist, hash: Bh });
          }
        }
                log(`  Hash filtering found ${candidates.length} candidates`);

        if (candidates.length === 0) {
          log(`  Relaxing hash threshold for retry...`);
          for (const Bu of Burls) {
            const { mat: Bmat, hash: Bh } = await getMatAndHash(Bu);
        const dist = hamming(Ah, Bh);
            if (dist <= tauHash * 1.5) {
              candidates.push({ Bu, Bmat, dist, hash: Bh });
            }
          }
          log(`  Relaxed filtering found ${candidates.length} candidates`);
        }

        // 階段2：精確匹配
        let best = { score: -1, confidence: 0, method: 'none' };
        for (const c of candidates) {
          const templateMatch = matchTemplateMultiScale(Amat, c.Bmat, scales);
          const featureMatch = detectAndMatchFeatures(Amat, c.Bmat);
          
          let combinedScore = 0;
          let confidence = 0;
          let method = '';
          
          if (templateMatch.score > 0.3 && featureMatch.confidence > 0.1) {
            combinedScore = (templateMatch.score * 0.6) + (featureMatch.confidence * 0.4);
            confidence = Math.max(templateMatch.score, featureMatch.confidence);
            method = 'hybrid';
          } else if (templateMatch.score > tauTM) {
            combinedScore = templateMatch.score;
            confidence = templateMatch.score;
            method = 'template';
          } else if (featureMatch.confidence > 0.15) {
            combinedScore = featureMatch.confidence;
            confidence = featureMatch.confidence;
            method = 'feature';
          }
          
          if (combinedScore > best.score) {
            best = {
              ...templateMatch,
              url: c.Bu,
              score: combinedScore,
              confidence: confidence,
              method: method,
              featureMatches: featureMatch.matches,
              hashDistance: c.dist
            };
          }
        }

        // 階段3：決定匹配
        const finalThreshold = 0.4;
        if (best.score >= finalThreshold || best.confidence >= 0.2) {
          matched = {
            b_url: best.url,
            score: best.score,
            confidence: best.confidence,
            scale: best.scale,
            rect: best.rect,
            method: best.method,
            featureMatches: best.featureMatches,
            hashDistance: best.hashDistance
          };
        }

        results.push({ a_url: Au, matched });
        
        if (matched) {
          log(`  Match found! Method: ${matched.method}, Score: ${matched.score.toFixed(3)}, Confidence: ${matched.confidence.toFixed(3)}`);
          log(`    Matched to: ${matched.b_url.substring(0, 50)}...`);
        } else {
          log(`  No match found`);
        }
        
      } catch (err) {
        results.push({ a_url: Au, error: String(err) });
        log(`[${i + 1}/${Aurls.length}] Error: ${String(err)}`);
      }
    }

    updateProgress(Aurls.length, Aurls.length, 'Processing complete');
    hideProgress();
    showResults(results);
    
    log("\nDetailed Results JSON:");
    log(JSON.stringify(results, null, 2));
    
  } catch (error) {
    log(`System error: ${error.message}`);
    hideProgress();
  } finally {
    document.getElementById('run').disabled = false;
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  updateOpenCVStatus('loading', 'Loading OpenCV.js...');
  
  loadOpenCV().catch(error => {
    console.error('Failed to load OpenCV:', error);
  });
  
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

// Initial state
document.getElementById('run').disabled = true;
