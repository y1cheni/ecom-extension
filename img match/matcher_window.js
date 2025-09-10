// 簡單圖片匹配器 - 獨立視窗版本
// 快速精確的圖片匹配，與popup完全同步

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
      if (data.mode) {
        switchMode(data.mode);
      }
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
  if (!url || !url.trim()) {
    return { valid: false, reason: 'Empty URL' };
  }
  if (url.includes('/search?') || url.includes('keyword=')) {
    return { valid: false, reason: 'This is a search page URL, not an image URL' };
  }
  // 放寬校驗：許多電商圖片為動態路徑無副檔名，直接允許載入由 onload/onerror 決定
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

// 影像與模板快取（降低重複載入/轉換成本）
const imageCache = new Map(); // url -> Promise<HTMLImageElement>
const bTemplateMatCache = new Map(); // url -> cv.Mat (灰階模板，用於 TM)
const bGray512Cache = new Map(); // url -> cv.Mat (512x512 灰階，用於 SSIM/ORB)
const bPHashCache = new Map(); // url -> string (64-bit 二進位字串)
const bColorHistCache = new Map(); // url -> Float32Array (HSV histogram)
const bPopularity = new Map(); // url -> count (for IDF-like suppression)

async function getImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const p = loadImage(url).catch(err => {
    imageCache.delete(url);
    throw err;
  });
  imageCache.set(url, p);
  return p;
}

function clearAllCaches() {
  imageCache.clear();
  for (const mat of bTemplateMatCache.values()) {
    try { mat.delete(); } catch (_) {}
  }
  bTemplateMatCache.clear();
  for (const mat of bGray512Cache.values()) {
    try { mat.delete(); } catch (_) {}
  }
  bGray512Cache.clear();
  bPHashCache.clear();
  bColorHistCache.clear();
  bPopularity.clear();
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
  let correlation = 0;
  let sum1 = 0, sum2 = 0;
  
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


// === OpenCV 模板匹配 (A 為 img，B 為 template，TM_CCOEFF_NORMED) ===
function imgToGrayMatForTM(img, maxSide = 1024) {
  try {
    if (typeof cv === 'undefined' || !cv.Mat) return null;
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    src.delete();
    return gray;
  } catch (e) {
    console.warn('imgToGrayMatForTM failed:', e);
    return null;
  }
}

async function opencvTemplateMatch(imgA, imgB) {
  try {
    if (typeof cv === 'undefined' || !cv.Mat) return null;
    const matImg = imgToGrayMatForTM(imgA);

    // 針對 B 做模板 Mat 快取，避免重複轉換與 GC 積累
    let matTmplOrig = bTemplateMatCache.get(imgB.src);
    if (!matTmplOrig) {
      matTmplOrig = imgToGrayMatForTM(imgB);
      if (matTmplOrig) bTemplateMatCache.set(imgB.src, matTmplOrig);
    }
    if (!matImg || !matTmplOrig) {
      if (matImg) matImg.delete();
      if (matTmplOrig) matTmplOrig.delete();
      return null;
    }

    // 若 template 大於 img，縮小 template
    let template = matTmplOrig;
    let resized = null;
    if (template.cols > matImg.cols || template.rows > matImg.rows) {
      resized = new cv.Mat();
      const scale = Math.min(matImg.cols / template.cols, matImg.rows / template.rows) * 0.95;
      const newW = Math.max(1, Math.floor(template.cols * scale));
      const newH = Math.max(1, Math.floor(template.rows * scale));
      cv.resize(template, resized, new cv.Size(newW, newH));
      template = resized;
    }

    let result = new cv.Mat();
    cv.matchTemplate(matImg, template, result, cv.TM_CCOEFF_NORMED);
    const minMax = cv.minMaxLoc(result);
    const score = minMax.maxVal;
    const topLeft = minMax.maxLoc;
    const bottomRight = { x: topLeft.x + template.cols, y: topLeft.y + template.rows };

    result.delete();
    if (resized) resized.delete();
    // matTmplOrig 快取保留，避免重建；在 clearAllCaches() 時釋放
    matImg.delete();

    return { score, topLeft, bottomRight, method: 'opencv_tm_ccoeff_normed' };
  } catch (e) {
    console.warn('OpenCV TM error:', e);
    return null;
  }
}

// 轉 512x512 灰階（等比縮放+邊緣填充）
function toGraySquare512(img) {
  if (typeof cv === 'undefined' || !cv.Mat) return null;
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = srcW; canvas.height = srcH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, srcW, srcH);
  const rgba = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  const target = 512;
  const scale = target / Math.max(gray.cols, gray.rows);
  const nw = Math.max(1, Math.round(gray.cols * scale));
  const nh = Math.max(1, Math.round(gray.rows * scale));
  const resized = new cv.Mat();
  cv.resize(gray, resized, new cv.Size(nw, nh), 0, 0, cv.INTER_AREA);
  const pad = new cv.Mat.zeros(target, target, gray.type());
  const x = Math.floor((target - nw) / 2), y = Math.floor((target - nh) / 2);
  resized.copyTo(pad.roi(new cv.Rect(x, y, nw, nh)));
  // CLAHE 對比增強，降低曝光/對比漂移
  try {
    const clahe = new cv.CLAHE(2.0, new cv.Size(8,8));
    const out = new cv.Mat();
    clahe.apply(pad, out);
    gray.delete(); resized.delete(); pad.delete();
    return out;
  } catch(_) {
    gray.delete(); resized.delete();
    return pad; // CV_8UC1 512x512
  }
}

// 正規 SSIM（簡化實作：使用 OpenCV mean 計整體平均）
function ssimScore(aGray512, bGray512) {
  try {
    const L = 255, K1 = 0.01, K2 = 0.03;
    const C1 = (K1 * L) * (K1 * L), C2 = (K2 * L) * (K2 * L);
    const mu1 = new cv.Mat(), mu2 = new cv.Mat();
    cv.GaussianBlur(aGray512, mu1, new cv.Size(11, 11), 1.5, 1.5);
    cv.GaussianBlur(bGray512, mu2, new cv.Size(11, 11), 1.5, 1.5);

    const mu1_2 = new cv.Mat(), mu2_2 = new cv.Mat(), mu1_mu2 = new cv.Mat();
    cv.multiply(mu1, mu1, mu1_2);
    cv.multiply(mu2, mu2, mu2_2);
    cv.multiply(mu1, mu2, mu1_mu2);

    const sigma1_2 = new cv.Mat(), sigma2_2 = new cv.Mat(), sigma12 = new cv.Mat();
    const a32 = new cv.Mat(), b32 = new cv.Mat(), ab = new cv.Mat();
    aGray512.convertTo(a32, cv.CV_32F); bGray512.convertTo(b32, cv.CV_32F);
    cv.multiply(a32, a32, sigma1_2); cv.GaussianBlur(sigma1_2, sigma1_2, new cv.Size(11, 11), 1.5, 1.5);
    cv.multiply(b32, b32, sigma2_2); cv.GaussianBlur(sigma2_2, sigma2_2, new cv.Size(11, 11), 1.5, 1.5);
    cv.multiply(a32, b32, ab); cv.GaussianBlur(ab, sigma12, new cv.Size(11, 11), 1.5, 1.5);

    const t1 = new cv.Mat(), t2 = new cv.Mat(), t3 = new cv.Mat();
    cv.addWeighted(mu1_mu2, 2, new cv.Mat(mu1_mu2.rows, mu1_mu2.cols, mu1_mu2.type(), new cv.Scalar(C1)), 1, 0, t1);
    cv.addWeighted(sigma12, 2, new cv.Mat(sigma12.rows, sigma12.cols, sigma12.type(), new cv.Scalar(C2)), 1, 0, t2);
    cv.multiply(t1, t2, t3);

    const t4 = new cv.Mat(), t5 = new cv.Mat();
    cv.add(mu1_2, mu2_2, t4); cv.add(t4, new cv.Mat(t4.rows, t4.cols, t4.type(), new cv.Scalar(C1)), t4);
    cv.add(sigma1_2, sigma2_2, t5); cv.add(t5, new cv.Mat(t5.rows, t5.cols, t5.type(), new cv.Scalar(C2)), t5);
    cv.multiply(t4, t5, t4);

    const ssimMap = new cv.Mat();
    cv.divide(t3, t4, ssimMap);
    const meanVal = cv.mean(ssimMap)[0];
    // 釋放
    mu1.delete(); mu2.delete(); mu1_2.delete(); mu2_2.delete(); mu1_mu2.delete();
    sigma1_2.delete(); sigma2_2.delete(); sigma12.delete(); a32.delete(); b32.delete(); ab.delete();
    t1.delete(); t2.delete(); t3.delete(); t4.delete(); t5.delete(); ssimMap.delete();
    // 映射到 0~1（OpenCV 計算過程已是浮點）
    return Math.max(0, Math.min(1, meanVal));
  } catch (e) {
    return 0;
  }
}

// 邊緣密度（Sobel 平均梯度）
function edgeDensity(gray512) {
  try {
    const gradX = new cv.Mat(), gradY = new cv.Mat(), absX = new cv.Mat(), absY = new cv.Mat(), mag = new cv.Mat();
    cv.Sobel(gray512, gradX, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.Sobel(gray512, gradY, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
    cv.convertScaleAbs(gradX, absX);
    cv.convertScaleAbs(gradY, absY);
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, mag);
    const meanVal = cv.mean(mag)[0];
    gradX.delete(); gradY.delete(); absX.delete(); absY.delete(); mag.delete();
    return meanVal; // 0~255
  } catch (e) { return 0; }
}

// 平均顏色差異（小尺寸）
function averageColorDifference(imgA, imgB) {
  try {
    const size = 32;
    const c1 = document.createElement('canvas'); c1.width = size; c1.height = size;
    const c2 = document.createElement('canvas'); c2.width = size; c2.height = size;
    const x1 = c1.getContext('2d'); const x2 = c2.getContext('2d');
    x1.drawImage(imgA, 0, 0, size, size);
    x2.drawImage(imgB, 0, 0, size, size);
    const d1 = x1.getImageData(0, 0, size, size).data;
    const d2 = x2.getImageData(0, 0, size, size).data;
    let r1=0,g1=0,b1=0,r2=0,g2=0,b2=0, n=size*size;
    for (let i=0;i<d1.length;i+=4){ r1+=d1[i]; g1+=d1[i+1]; b1+=d1[i+2]; r2+=d2[i]; g2+=d2[i+1]; b2+=d2[i+2]; }
    r1/=n; g1/=n; b1/=n; r2/=n; g2/=n; b2/=n;
    const dr=r1-r2, dg=g1-g2, db=b1-b2;
    const dist = Math.sqrt(dr*dr+dg*dg+db*db); // 0~441
    return dist;
  } catch(e) { return 0; }
}

// 多倍率 TM（固定尺度集）
function tmMultiScale(aGray, bGray, scales = [1.0,0.95,0.9,0.85,0.8,0.75,0.7,0.65,0.6]) {
  let best = -1, bestScale = 1.0;
  for (const s of scales) {
    const bw = Math.max(1, Math.round(bGray.cols * s));
    const bh = Math.max(1, Math.round(bGray.rows * s));
    if (bw >= aGray.cols || bh >= aGray.rows) continue;
    const bResized = new cv.Mat();
    cv.resize(bGray, bResized, new cv.Size(bw, bh), 0, 0, cv.INTER_AREA);
    const result = new cv.Mat();
    cv.matchTemplate(aGray, bResized, result, cv.TM_CCOEFF_NORMED);
    const minMax = cv.minMaxLoc(result);
    if (minMax.maxVal > best) { best = minMax.maxVal; bestScale = s; }
    result.delete(); bResized.delete();
  }
  return { s_tm: Math.max(0, Math.min(1, best)), tmBestScale: bestScale };
}

// 生成前景遮罩：Sobel 梯度 + OTSU 自動閾值
function buildForegroundMask(gray) {
  const gx = new cv.Mat(), gy = new cv.Mat(), ax = new cv.Mat(), ay = new cv.Mat(), mag = new cv.Mat();
  cv.Sobel(gray, gx, cv.CV_16S, 1, 0, 3, 1, 0, cv.BORDER_DEFAULT);
  cv.Sobel(gray, gy, cv.CV_16S, 0, 1, 3, 1, 0, cv.BORDER_DEFAULT);
  cv.convertScaleAbs(gx, ax); cv.convertScaleAbs(gy, ay);
  cv.addWeighted(ax, 0.5, ay, 0.5, 0, mag);
  const mask = new cv.Mat();
  cv.threshold(mag, mask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3,3));
  cv.dilate(mask, mask, kernel);
  gx.delete(); gy.delete(); ax.delete(); ay.delete(); mag.delete(); kernel.delete();
  return mask;
}

// 對灰階圖套用遮罩
function applyMask(gray, mask) {
  const out = new cv.Mat();
  cv.bitwise_and(gray, gray, out, mask);
  return out;
}

// 多方法 + 多尺度 TM 並做峰值可信度檢查
function tmMultiMethodWithPeak(aGray, bGray, scales = [1.0,0.95,0.9,0.85,0.8,0.75,0.7,0.65,0.6]) {
  const methods = [cv.TM_CCOEFF_NORMED, cv.TM_CCORR_NORMED, cv.TM_SQDIFF_NORMED];
  const maskA = buildForegroundMask(aGray);
  const maskB = buildForegroundMask(bGray);
  const aMasked = applyMask(aGray, maskA);
  const bMaskedFull = applyMask(bGray, maskB);
  maskA.delete(); maskB.delete();

  let best = { score: -1, scale: 1.0, method: cv.TM_CCOEFF_NORMED, peak: 0, pce: 0 };
  for (const s of scales) {
    const bw = Math.max(1, Math.round(bMaskedFull.cols * s));
    const bh = Math.max(1, Math.round(bMaskedFull.rows * s));
    if (bw >= aMasked.cols || bh >= aMasked.rows) continue;
    const bMasked = new cv.Mat();
    cv.resize(bMaskedFull, bMasked, new cv.Size(bw, bh), 0, 0, cv.INTER_AREA);
    for (const method of methods) {
      const res = new cv.Mat();
      cv.matchTemplate(aMasked, bMasked, res, method);
      const mm = cv.minMaxLoc(res);
      let score = (method === cv.TM_SQDIFF_NORMED) ? (1 - mm.minVal) : mm.maxVal;
      // 峰值檢查：抑制最佳點周圍再取次峰
      const res2 = res.clone();
      const peakLoc = (method === cv.TM_SQDIFF_NORMED) ? mm.minLoc : mm.maxLoc;
      const rect = new cv.Rect(Math.max(0, peakLoc.x-8), Math.max(0, peakLoc.y-8), Math.min(16, res2.cols-peakLoc.x+8), Math.min(16, res2.rows-peakLoc.y+8));
      cv.rectangle(res2, rect, new cv.Scalar(method===cv.TM_SQDIFF_NORMED?1.0:0.0), cv.FILLED);
      const mm2 = cv.minMaxLoc(res2);
      const second = (method === cv.TM_SQDIFF_NORMED) ? (1 - mm2.minVal) : mm2.maxVal;
      const peak = Math.max(0, score - second);

      // PCE 計算：peak^2 / mean(others^2)
      let pce = 0;
      try {
        const resSq = new cv.Mat();
        cv.multiply(res, res, resSq);
        // 將峰值鄰域清零以避免汙染均值
        const resSqMasked = resSq.clone();
        cv.rectangle(resSqMasked, rect, new cv.Scalar(0.0), cv.FILLED);
        const meanVal = cv.mean(resSqMasked)[0];
        pce = meanVal > 1e-9 ? (score*score) / meanVal : 0;
        resSq.delete(); resSqMasked.delete();
      } catch(_) { pce = 0; }
      if (score > best.score) {
        best = { score, scale: s, method, peak, pce };
      }
      res.delete(); res2.delete();
    }
    bMasked.delete();
  }
  aMasked.delete(); bMaskedFull.delete();
  return { s_tm: Math.max(0, Math.min(1, best.score)), peak: best.peak, tmBestScale: best.scale, pce: best.pce };
}

// pHash 相似度（使用現有 64bit 字串）
function phashSimilarityFromBits(aBits, bBits, tau = 10) {
  if (!aBits || !bBits) return 0;
  let d = 0; for (let i = 0; i < aBits.length; i++) if (aBits[i] !== bBits[i]) d++;
  return Math.exp(-d / tau);
}

// 幾何特徵匹配（簡化）：ORB + BFMatcher(HAMMING, crossCheck=true)
function detectAndMatchFeaturesMat(img1Mat, img2Mat) {
  try {
    const orb = new cv.ORB(500);
    const kp1 = new cv.KeyPointVector();
    const kp2 = new cv.KeyPointVector();
    const desc1 = new cv.Mat();
    const desc2 = new cv.Mat();
    orb.detectAndCompute(img1Mat, new cv.Mat(), kp1, desc1);
    orb.detectAndCompute(img2Mat, new cv.Mat(), kp2, desc2);
    if (desc1.rows === 0 || desc2.rows === 0) {
      kp1.delete(); kp2.delete(); desc1.delete(); desc2.delete(); orb.delete();
      return { matches: 0, confidence: 0 };
    }
    const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = new cv.DMatchVector();
    matcher.match(desc1, desc2, matches);
    let goodMatches = 0;
    for (let i = 0; i < matches.size(); i++) {
      const m = matches.get(i);
      if (m.distance < 50) goodMatches++;
    }
    const confidence = goodMatches / Math.max(1, Math.min(kp1.size(), kp2.size()));
    kp1.delete(); kp2.delete(); desc1.delete(); desc2.delete(); matches.delete(); matcher.delete(); orb.delete();
    return { matches: goodMatches, confidence };
  } catch (e) {
    return { matches: 0, confidence: 0 };
  }
}

// === OpenCV匹配模式 ===
function imgToMat(img, maxSide = 512) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  let eq = new cv.Mat();
  cv.equalizeHist(gray, eq);
  src.delete();
  gray.delete();
  return eq;
}

function pHash64(mat) {
  let small = new cv.Mat();
  cv.resize(mat, small, new cv.Size(32, 32));
  small.convertTo(small, cv.CV_32F);

  let dct = new cv.Mat();
  cv.dct(small, dct);
  let roi = dct.roi(new cv.Rect(0, 0, 8, 8));
  
  let arr = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      arr.push(roi.floatAt(r, c));
    }
  }
  const median = arr.slice().sort((a, b) => a - b)[32];
  let bits = arr.map(v => v > median ? '1' : '0').join('');
  
  small.delete();
  dct.delete();
  roi.delete();
  return bits;
}

function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

async function opencvMatchImages(imgA, imgB) {
  try {
    const matA = imgToMat(imgA);
    const matB = imgToMat(imgB);
    
    const hashA = pHash64(matA);
    const hashB = pHash64(matB);
    const hashDistance = hamming(hashA, hashB);
    const hashSimilarity = Math.max(0, 1 - (hashDistance / 64));
    
    // 模板匹配
    let templateScore = 0;
    try {
      let result = new cv.Mat();
      cv.matchTemplate(matB, matA, result, cv.TM_CCOEFF_NORMED);
      let minMax = cv.minMaxLoc(result);
      templateScore = minMax.maxVal;
      result.delete();
    } catch (e) {
      console.warn('Template matching failed:', e);
    }
    
    // 綜合評分
    const finalScore = hashSimilarity * 0.6 + templateScore * 0.4;
    
    matA.delete();
    matB.delete();
    
    return {
      score: finalScore,
      hashSimilarity: hashSimilarity,
      templateScore: templateScore,
      method: 'opencv'
    };
  } catch (error) {
    console.error('OpenCV matching error:', error);
    return { score: 0, error: error.message };
  }
}

// 取得 HSV 直方圖（scale-invariant）+ 空間金字塔（1x1 + 2x2）
function computeHSVSPHist(img, binsH = 24, binsS = 16, binsV = 8) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const rgba = cv.imread(canvas);
  const hsv = new cv.Mat(); cv.cvtColor(rgba, hsv, cv.COLOR_RGBA2RGB); cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  const levels = [ { x:0, y:0, w:size, h:size },
                   { x:0, y:0, w:size/2, h:size/2 }, { x:size/2, y:0, w:size/2, h:size/2 },
                   { x:0, y:size/2, w:size/2, h:size/2 }, { x:size/2, y:size/2, w:size/2, h:size/2 } ];
  const histParts = [];
  for (const r of levels) {
    const roi = hsv.roi(new cv.Rect(r.x, r.y, r.w, r.h));
    const channels = new cv.MatVector();
    cv.split(roi, channels);
    const h = channels.get(0), s = channels.get(1), v = channels.get(2);
    const histH = new cv.Mat(), histS = new cv.Mat(), histV = new cv.Mat();
    cv.calcHist(h, new cv.Mat(), histH, [binsH], [0,180]);
    cv.calcHist(s, new cv.Mat(), histS, [binsS], [0,256]);
    cv.calcHist(v, new cv.Mat(), histV, [binsV], [0,256]);
    // 正規化
    cv.normalize(histH, histH, 1, 0, cv.NORM_L1);
    cv.normalize(histS, histS, 1, 0, cv.NORM_L1);
    cv.normalize(histV, histV, 1, 0, cv.NORM_L1);
    const arr = new Float32Array(binsH + binsS + binsV);
    for (let i=0;i<binsH;i++) arr[i] = histH.floatAt(i,0);
    for (let i=0;i<binsS;i++) arr[binsH+i] = histS.floatAt(i,0);
    for (let i=0;i<binsV;i++) arr[binsH+binsS+i] = histV.floatAt(i,0);
    histParts.push(arr);
    h.delete(); s.delete(); v.delete(); histH.delete(); histS.delete(); histV.delete(); channels.delete(); roi.delete();
  }
  hsv.delete(); rgba.delete();
  // 拼接成一個向量
  const totalLen = histParts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(totalLen);
  let offset = 0; for (const p of histParts) { out.set(p, offset); offset += p.length; }
  return out;
}

function bhattacharyyaSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0; for (let i=0;i<a.length;i++) sum += Math.sqrt(a[i] * b[i]);
  return Math.max(0, Math.min(1, sum));
}

// 估計主色比例（快速版）：回傳綠色比例（0~1）
function estimateGreenRatio(img) {
  try {
    const size = 64;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, size, size);
    const d = x.getImageData(0, 0, size, size).data;
    let green = 0, valid = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const v = max; const s = max === 0 ? 0 : (max - min) / max * 255;
      let h = 0;
      if (max !== min) {
        if (max === r) h = (60 * (g - b) / (max - min) + 360) % 360;
        else if (max === g) h = 60 * (b - r) / (max - min) + 120;
        else h = 60 * (r - g) / (max - min) + 240;
      }
      // 排除低飽和/低亮度區（近白或近黑）
      if (s > 50 && v > 50) {
        valid++;
        if (h >= 70 && h <= 170) green++; // 粗略綠色
      }
    }
    return valid > 0 ? green / valid : 0;
  } catch (e) { return 0; }
}

// 估計主色 Hue 與占比（0~360, 0~1）
function estimateDominantHue(img, hueBins = 36) {
  try {
    const size = 96;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, size, size);
    const d = x.getImageData(0, 0, size, size).data;
    const bins = new Float32Array(hueBins);
    let valid = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const v = max; const s = max === 0 ? 0 : (max - min) / max * 255;
      if (s <= 40 || v <= 40) continue; // 略過低飽和/低亮度
      let h = 0;
      if (max !== min) {
        if (max === r) h = (60 * (g - b) / (max - min) + 360) % 360;
        else if (max === g) h = 60 * (b - r) / (max - min) + 120;
        else h = 60 * (r - g) / (max - min) + 240;
      }
      const idx = Math.min(hueBins - 1, Math.floor(h / (360 / hueBins)));
      bins[idx] += 1; valid++;
    }
    if (valid === 0) return { hue: 0, ratio: 0 };
    let best = 0, bestIdx = 0; for (let i=0;i<hueBins;i++) if (bins[i] > best) { best = bins[i]; bestIdx = i; }
    return { hue: (bestIdx + 0.5) * (360 / hueBins), ratio: best / valid };
  } catch (e) { return { hue: 0, ratio: 0 }; }
}

// 前景 HSV Hue 直方圖＋空間金字塔（JS實作，尺度不變）
function computeHSVSPHistFG(img, hueBins = 32) {
  const size = 128;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, size, size);
  const d = x.getImageData(0, 0, size, size).data;
  const levels = [ {x:0,y:0,w:size,h:size}, {x:0,y:0,w:size/2,h:size/2}, {x:size/2,y:0,w:size/2,h:size/2}, {x:0,y:size/2,w:size/2,h:size/2}, {x:size/2,y:size/2,w:size/2,h:size/2} ];
  const hists = levels.map(()=> new Float32Array(hueBins));
  let idxPix = 0;
  for (let y=0; y<size; y++) {
    for (let x0=0; x0<size; x0++) {
      const r = d[idxPix], g = d[idxPix+1], b = d[idxPix+2]; idxPix += 4;
      const max = Math.max(r,g,b), min = Math.min(r,g,b);
      const v = max; const s = max === 0 ? 0 : (max - min) / max * 255;
      if (s <= 40 || v <= 40) continue;
      let h = 0;
      if (max !== min) {
        if (max === r) h = (60 * (g - b) / (max - min) + 360) % 360;
        else if (max === g) h = 60 * (b - r) / (max - min) + 120;
        else h = 60 * (r - g) / (max - min) + 240;
      }
      const bin = Math.min(hueBins - 1, Math.floor(h / (360 / hueBins)));
      // global
      hists[0][bin] += 1;
      // 2x2
      const half = size/2;
      const li = (x0 < half ? (y < half ? 1 : 3) : (y < half ? 2 : 4));
      hists[li][bin] += 1;
    }
  }
  // normalize and concatenate
  let totalLen = hueBins * hists.length;
  const out = new Float32Array(totalLen);
  let off = 0;
  for (const hist of hists) {
    let sum = 0; for (let i=0;i<hueBins;i++) sum += hist[i];
    if (sum > 0) { for (let i=0;i<hueBins;i++) out[off+i] = hist[i] / sum; }
    off += hueBins;
  }
  return out;
}

// 全圖灰階餘弦/皮爾森相似度（中心化後），回傳[0,1]
function cosineSimilarityGray(aGray, bGray) {
  try {
    const a32 = new cv.Mat(), b32 = new cv.Mat();
    aGray.convertTo(a32, cv.CV_32F); bGray.convertTo(b32, cv.CV_32F);
    const meanA = new cv.Mat(), stdA = new cv.Mat();
    const meanB = new cv.Mat(), stdB = new cv.Mat();
    cv.meanStdDev(a32, meanA, stdA); cv.meanStdDev(b32, meanB, stdB);
    const aC = new cv.Mat(), bC = new cv.Mat();
    const aMean = new cv.Mat(a32.rows, a32.cols, a32.type(), new cv.Scalar(meanA.doubleAt(0,0)));
    const bMean = new cv.Mat(b32.rows, b32.cols, b32.type(), new cv.Scalar(meanB.doubleAt(0,0)));
    cv.subtract(a32, aMean, aC); cv.subtract(b32, bMean, bC);
    const prod = new cv.Mat(); cv.multiply(aC, bC, prod);
    const num = cv.sum(prod)[0];
    const a2 = new cv.Mat(), b2 = new cv.Mat();
    cv.multiply(aC, aC, a2); cv.multiply(bC, bC, b2);
    const den = Math.sqrt(Math.max(1e-9, cv.sum(a2)[0] * cv.sum(b2)[0]));
    const corr = den > 0 ? (num / den) : 0; // -1..1
    // 釋放
    a32.delete(); b32.delete(); meanA.delete(); stdA.delete(); meanB.delete(); stdB.delete(); aC.delete(); bC.delete(); aMean.delete(); bMean.delete(); prod.delete(); a2.delete(); b2.delete();
    return Math.max(0, Math.min(1, (corr + 1) / 2));
  } catch (e) { return 0; }
}

// 方法一致性核對與局部顏色核對
function tmConsensusAndLocalColor(aGray, bGray, imgA, imgB, peakWindow=8) {
  const methods = [cv.TM_CCOEFF_NORMED, cv.TM_SQDIFF_NORMED];
  let best = null;
  for (const method of methods) {
    const res = new cv.Mat();
    cv.matchTemplate(aGray, bGray, res, method);
    const mm = cv.minMaxLoc(res);
    let val = (method === cv.TM_SQDIFF_NORMED) ? (1 - mm.minVal) : mm.maxVal;
    const loc = (method === cv.TM_SQDIFF_NORMED) ? mm.minLoc : mm.maxLoc;
    if (!best || val > best.val) best = { val, loc, method };
    res.delete();
  }
  // 另一方法也要在鄰域內找到峰值
  const other = methods[0] === best.method ? methods[1] : methods[0];
  const res2 = new cv.Mat();
  cv.matchTemplate(aGray, bGray, res2, other);
  const mm2 = cv.minMaxLoc(res2);
  const loc2 = (other === cv.TM_SQDIFF_NORMED) ? mm2.minLoc : mm2.maxLoc;
  const ok = Math.abs(loc2.x - best.loc.x) <= peakWindow && Math.abs(loc2.y - best.loc.y) <= peakWindow;
  res2.delete();
  if (!ok) return { ok: false };

  // 局部顏色核對：截取 A 的最佳框與 B 模板，同尺寸 HSV 直方圖比對
  const w = bGray.cols, h = bGray.rows;
  const aRect = new cv.Rect(best.loc.x, best.loc.y, w, h);
  if (aRect.x < 0 || aRect.y < 0 || aRect.x + aRect.width > aGray.cols || aRect.y + aRect.height > aGray.rows) return { ok: false };
  const cA = document.createElement('canvas'); cA.width = w; cA.height = h;
  const cB = document.createElement('canvas'); cB.width = w; cB.height = h;
  // 取原圖塊
  const fullA = document.createElement('canvas'); fullA.width = imgA.naturalWidth||imgA.width; fullA.height = imgA.naturalHeight||imgA.height; fullA.getContext('2d').drawImage(imgA,0,0,fullA.width,fullA.height);
  const ctxA = cA.getContext('2d'); ctxA.drawImage(fullA, aRect.x, aRect.y, w, h, 0, 0, w, h);
  const ctxB = cB.getContext('2d'); ctxB.drawImage(imgB, 0, 0, w, h);
  const hA = computeHSVSPHistFG(cA, 24);
  const hB = computeHSVSPHistFG(cB, 24);
  const s_local = bhattacharyyaSim(hA, hB);
  return { ok: true, s_local, loc: best.loc };
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
    ['A_URL', 'B1_URL', 'B2_URL', 'B3_URL', 'Match_count', 'Best_Score'].join(','),
    // CSV數據
    ...results.map(result => {
      if (result.error) {
        return [
          `"${result.a_url}"`,
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
    
    const results = new Array(Aurls.length);
    document.getElementById('results-section').style.display = 'none';

    // 讀取並限制併發度的工作池
    const parallelism = Math.max(1, Math.min(16, parseInt(document.getElementById('parallelism').value || '4', 10)));
    let nextIndex = 0;
    let completed = 0;

    const worker = async (workerId) => {
      while (true) {
        const i = nextIndex++;
        if (i >= Aurls.length) break;
      const Au = Aurls[i];
      try {
          updateProgress(completed, Aurls.length, `Processing A${i + 1}/${Aurls.length} (worker ${workerId})`);
          log(`[${i + 1}/${Aurls.length}] Processing: ${Au.substring(Au.lastIndexOf('/') + 1)} (worker ${workerId})`);

          const imgA = await getImage(Au);
          const candidates = [];
          const cvReady = (typeof cv !== 'undefined' && !!cv.Mat);
          let aGray512 = null;
          let aBits = null;
          // AI 向量（一次）
          let aEmb = null;
          try { aEmb = await getEmbedding(Au); } catch (_) { aEmb = null; }
          if (cvReady) {
            try { aGray512 = toGraySquare512(imgA); } catch (_) { aGray512 = null; }
            try { const aMatTmp = imgToMat(imgA); aBits = pHash64(aMatTmp); aMatTmp.delete(); } catch (_) { aBits = null; }
          }

        for (let j = 0; j < Burls.length; j++) {
          const Bu = Burls[j];
          try {
              const imgB = await getImage(Bu);
              // 護欄1：長寬比過濾
              const arA = (imgA.naturalWidth || imgA.width) / (imgA.naturalHeight || imgA.height);
              const arB = (imgB.naturalWidth || imgB.width) / (imgB.naturalHeight || imgB.height);
              const arDiff = Math.abs(arA - arB) / Math.max(arA, arB);
              if (arDiff > 0.25) {
                continue;
              }

              let S = 0;
              let method = 'simple';
              if (!cvReady || !aGray512) {
                const simple = await simpleMatchImages(imgA, imgB);
                S = simple.score;
                method = 'simple';
              } else {
                // pHash 預篩（護欄2）
                let bBits = bPHashCache.get(Bu);
                if (!bBits) {
                  try { const bMatQuick = imgToMat(imgB); bBits = pHash64(bMatQuick); bPHashCache.set(Bu, bBits); bMatQuick.delete(); } catch (_) { bBits = null; }
                }
                const s_phash = (aBits && bBits) ? phashSimilarityFromBits(aBits, bBits, 10) : undefined;
                if (s_phash !== undefined && s_phash < 0.25) {
                  continue;
                }

                // 取得 B 灰階512
                let bGray512 = bGray512Cache.get(Bu);
                if (!bGray512) { bGray512 = toGraySquare512(imgB); if (bGray512) bGray512Cache.set(Bu, bGray512); }

                // 多方法 TM + SSIM + 邊緣密度過濾
                let s_tm = 0, ssim = 0;
                if (bGray512) {
                  // pyramid + 多方法 TM 並檢查峰值可信度
                  const aDown = new cv.Mat();
                  cv.pyrDown(aGray512, aDown);
                  const tmA = tmMultiMethodWithPeak(aGray512, bGray512);
                  const tmB = tmMultiMethodWithPeak(aDown, bGray512);
                  s_tm = Math.max(tmA.s_tm, tmB.s_tm);
                  const tmPeak = Math.max(tmA.peak, tmB.peak);
                  const tmPCE = Math.max(tmA.pce || 0, tmB.pce || 0);
                  aDown.delete();
                  ssim = ssimScore(aGray512, bGray512);
                  // 峰值過低表示模板在整個圖上到處都相似，屬於背景/紋理誤擊
                  if ((tmPeak < 0.05 && s_tm < 0.90) || tmPCE < 15) {
                    continue;
                  }
                }

                // 顏色/邊緣護欄：排除大量純色背景/單色色塊誤擊（如綠色長方形）
                const eA = aGray512 ? edgeDensity(aGray512) : 0;
                const eB = bGray512 ? edgeDensity(bGray512) : 0;
                const edgeMin = Math.min(eA, eB);
                const colorDist = averageColorDifference(imgA, imgB);
                const gA = estimateGreenRatio(imgA);
                const gB = estimateGreenRatio(imgB);
                if (edgeMin < 8 && colorDist > 60) {
                  continue;
                }
                // 若 B 為強綠色塊而 A 非綠色塊，直接否決
                if (gB > 0.35 && gA < 0.15) {
                  continue;
                }

                // 顏色組成（尺度不變）相似度：HSV 空間金字塔直方圖（容錯：跨網域圖片可能造成 tainted canvas）
                let bHist = bColorHistCache.get(Bu);
                if (!bHist) {
                  try { bHist = computeHSVSPHistFG(imgB); bColorHistCache.set(Bu, bHist); } catch(_) { bHist = null; }
                }
                let aHist = null; try { aHist = computeHSVSPHistFG(imgA); } catch(_) { aHist = null; }
                const s_hist = (aHist && bHist) ? bhattacharyyaSim(aHist, bHist) : 0;

                // 主色族群差距過大直接否決
                const dhA = estimateDominantHue(imgA);
                const dhB = estimateDominantHue(imgB);
                const hueDiff = Math.min(Math.abs(dhA.hue - dhB.hue), 360 - Math.abs(dhA.hue - dhB.hue));
                if (dhB.ratio > 0.40 && dhA.ratio < 0.15 && hueDiff > 30) {
                  continue;
                }

                // 全圖餘弦相似度（中心化），當作整體風格一致性的補充訊號
                const cosSim = (aGray512 && bGray512) ? cosineSimilarityGray(aGray512, bGray512) : 0;
                // 若顏色高度不一致但 cosSim 偏高，視為文字/紋理型假相似 → 否決
                if (s_hist < 0.45 && cosSim > 0.80 && s_tm < 0.85) {
                  continue;
                }

                // 方法一致性核對 + 局部顏色核對
                let consensusOK = true; let s_local = 1.0;
                try {
                  // 取到與 bGray512 尺寸相近的模板（這裡用 bGray512 作模板）
                  const cons = tmConsensusAndLocalColor(aGray512, bGray512, imgA, imgB);
                  if (!cons.ok) consensusOK = false; else s_local = cons.s_local;
                } catch (_) { /* 忽略錯誤，按未通過處理 */ }
                if (!consensusOK || s_local < 0.55) {
                  continue;
                }

                // 幾何驗證（護欄3基本線後再做）
                let s_geom;
                if ((s_tm > 0.4) || (ssim > 0.5)) {
                  try { if (bGray512) { const feat = detectAndMatchFeaturesMat(aGray512, bGray512); s_geom = Math.min(1, Math.max(0, feat.confidence)); } } catch (_) { s_geom = undefined; }
                }

                // 硬否決：全部低就跳過
                if (s_tm < 0.55 && ssim < 0.60 && s_hist < 0.50 && cosSim < 0.70 && (!s_geom || s_geom < 0.12)) {
                  continue;
                }

                // AI 相似度
                let s_ai = 0;
                try {
                  const bEmb = await getEmbedding(Bu);
                  if (aEmb && bEmb) s_ai = (cosineSimVec(aEmb, bEmb) + 1) / 2; // 0..1
                } catch (_) { s_ai = 0; }

                const hasGeom = typeof s_geom === 'number' && s_geom > 0;
                // 基礎融合 S
                if (hasGeom) {
                  const weights = { s_ai: 0.30, s_geom: 0.22, s_hist: 0.18, s_tm: 0.15, s_ssim: 0.10, s_phash: 0.05 }; // 有幾何
                  const comps = [ ['s_ai', s_ai], ['s_geom', s_geom], ['s_hist', s_hist], ['s_tm', s_tm], ['s_ssim', ssim], ['s_phash', s_phash] ].filter(([, v]) => typeof v === 'number');
                  const sumW = comps.reduce((acc, [k]) => acc + weights[k], 0);
                  S = (comps.length && sumW > 0) ? comps.reduce((acc, [k, v]) => acc + (weights[k] / sumW) * v, 0) : 0;
                  method = 'fusion+geom';
            } else {
                  const weights = { s_ai: 0.35, s_hist: 0.25, s_tm: 0.20, s_ssim: 0.15, s_phash: 0.05 }; // 無幾何
                  const comps = [ ['s_ai', s_ai], ['s_hist', s_hist], ['s_tm', s_tm], ['s_ssim', ssim], ['s_phash', s_phash] ].filter(([, v]) => typeof v === 'number');
                  const sumW = comps.reduce((acc, [k]) => acc + weights[k], 0);
                  S = (comps.length && sumW > 0) ? comps.reduce((acc, [k, v]) => acc + (weights[k] / sumW) * v, 0) : 0;
                  method = 'fusion';
                }

                // 兩個增益：S' = S + α*log(1+PCE) + β*(ai_margin)
                const alpha = 0.05;
                const beta = 0.20;
                const aiTop2 = [s_ai, 0].sort((a,b)=>b-a); // 目前只有一個 s_ai，保留架構
                const aiMargin = (aiTop2[0] - (aiTop2[1]||0));
                const S_prime = S + alpha * Math.log(1 + (typeof tmPCE==='number'?tmPCE:0)) + beta * aiMargin;
                S = Math.max(0, Math.min(1, S_prime));

                // IDF 壓制：熱門 B 下降分
                const used = (bPopularity.get(Bu) || 0) + 1; bPopularity.set(Bu, used);
                const idf = 1 / (1 + Math.log(1 + used));
                S *= idf;
              }

              candidates.push({ b_url: Bu, b_index: j + 1, score: S, method });
          } catch (error) {
              // 單個 B 失敗不影響整體
            }
          }

          let sorted = candidates.sort((a, b) => b.score - a.score);
          const { apiKey, useLLM, topK } = await getLLMConfig();
          // 三態決策與僅邊界樣本才啟用 LLM
          // 先取本地分數的 top2 margin
          const top2 = sorted.slice(0,2);
          const margin = (top2.length===2) ? (top2[0].score - top2[1].score) : 1;
          const S1 = top2.length ? top2[0].score : 0;
          const accept = (S1 >= Math.max(0.90, threshold)) && (margin >= 0.02);
          const arbit = (S1 >= Math.max(0.85, threshold - 0.05));
          const needLLM = !accept && arbit; // 僅仲裁區才用 LLM

          if (useLLM && apiKey && sorted.length > 0 && needLLM) {
            llmLog(`A: 開始 LLM 重排，候選 ${Math.min(topK, sorted.length)} 個（${Au.substring(0,80)}...)`);
            const t0 = performance.now();
            const llmRes = await rerankWithLLM(apiKey, Au, sorted, topK);
            const t1 = performance.now();
            if (!llmRes) {
              llmLog(`A: LLM 重排失敗，回退本地結果（耗時 ${(t1-t0).toFixed(0)}ms）`);
            } else {
              llmLog(`A: LLM 回傳 JSON（耗時 ${(t1-t0).toFixed(0)}ms），套用排序/裁決`);
            }
            if (llmRes && Array.isArray(llmRes.ordered_b_urls)) {
              const orderMap = new Map();
              llmRes.ordered_b_urls.forEach((u, idx) => orderMap.set(u, idx));
              sorted = sorted.slice().sort((x, y) => (orderMap.get(x.b_url) ?? 999) - (orderMap.get(y.b_url) ?? 999));
            }
            if (llmRes && Array.isArray(llmRes.accepted_b_urls)) {
              const set = new Set(llmRes.accepted_b_urls);
              sorted = sorted.filter(c => set.has(c.b_url));
              llmLog(`A: LLM 最終接受 ${sorted.length} 個：${sorted.map(s=>`B${s.b_index}`).join(', ')}`);
            }
          }
          const top = sorted.filter(x => x.score >= threshold).slice(0, 3);
          let record;
          if (top.length > 0) {
            record = {
            a_url: Au, 
            a_index: i + 1,
            matched: 1,
              matched_count: top.length,
              matched_b_list: top.map(m => `B${m.b_index}`).join(', '),
              matched_b_urls: top.map(m => m.b_url),
              matched_b_filenames: top.map(m => m.b_filename).join(', '),
              best_score: top[0].score,
              method: top[0].method,
              all_scores: top.map(m => m.score.toFixed(3)).join(', ')
            };
        } else {
            record = {
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
            };
        }
        
          results[i] = record; // 以原始 A 的索引保序寫入
      } catch (err) {
          results[i] = { a_url: Au, error: String(err) };
        } finally {
          completed++;
          updateProgress(completed, Aurls.length, `Processing ${completed}/${Aurls.length}`);
        }
      }
    };

    // 啟動工作池
    const workers = Array.from({ length: parallelism }, (_, k) => worker(k + 1));
    await Promise.all(workers);

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
  
  document.getElementById('clear').addEventListener('click', async () => {
    document.getElementById('colA').value = '';
    document.getElementById('colB').value = '';
    document.getElementById('log').textContent = '';
    document.getElementById('results-section').style.display = 'none';
    clearAllCaches();
    // 清除 LLM 設定與輸入
    try {
      const keyInput = document.getElementById('llmApiKey');
      const useLLMInput = document.getElementById('useLLM');
      const topKInput = document.getElementById('llmTopK');
      if (keyInput) keyInput.value = '';
      if (useLLMInput) useLLMInput.checked = false;
      if (topKInput) topKInput.value = '10';
      await chrome.storage.local.remove(['llmApiKey','useLLM','llmTopK']);
    } catch(_) {}
    saveData();
  });
  
  
  
  document.getElementById('export').addEventListener('click', () => {
    if (window.currentResults) {
      exportToCSV(window.currentResults);
    } else {
      alert('No results to export. Please run matching first.');
    }
  });
  
  // LLM UI -> storage 同步（加上 null 防護）
  const keyInput = document.getElementById('llmApiKey');
  const useLLMInput = document.getElementById('useLLM');
  const topKInput = document.getElementById('llmTopK');
  const proxyInput = document.getElementById('llmProxyUrl');
  try {
    const { llmApiKey, useLLM, llmTopK, llmProxyUrl } = await chrome.storage.local.get(['llmApiKey','useLLM','llmTopK','llmProxyUrl']);
    if (keyInput && llmApiKey) keyInput.value = llmApiKey;
    if (useLLMInput && typeof useLLM === 'boolean') useLLMInput.checked = useLLM;
    if (topKInput && llmTopK) topKInput.value = llmTopK;
    if (proxyInput && llmProxyUrl) proxyInput.value = llmProxyUrl;
  } catch(_) {}
  if (keyInput && useLLMInput && topKInput) {
    const saveLLM = debounce(async () => {
      try {
        await chrome.storage.local.set({ llmApiKey: keyInput.value.trim(), useLLM: useLLMInput.checked, llmTopK: parseInt(topKInput.value || '10', 10), llmProxyUrl: (proxyInput?.value || '').trim() });
      } catch(_) {}
    }, 500);
    keyInput.addEventListener('input', saveLLM);
    useLLMInput.addEventListener('change', saveLLM);
    topKInput.addEventListener('input', saveLLM);
    proxyInput && proxyInput.addEventListener('input', saveLLM);
  }
});

// ======== AI 嵌入（onnxruntime-web） ========
let ortSession = null;
const embeddingCache = new Map(); // url -> Float32Array (L2 normalized)

async function initOrt() {
  if (ortSession) return;
  try {
    if (typeof ort === 'undefined') {
      console.warn('ORT not loaded; embeddings disabled');
      return;
    }
    // 需要在 HTML 引入 onnxruntime-web 或使用 web_accessible_resources 路徑
    // 這裡假定已在 HTML 以 <script src="lib/ort.min.js"></script> 載入
    ortSession = await ort.InferenceSession.create(chrome.runtime.getURL('models/clip-vit32.onnx'), {
      executionProviders: ['wasm']
    });
  } catch (e) {
    console.warn('ORT init failed:', e);
  }
}

function preprocessForClip(img, size=224) {
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 中心裁切到正方形再縮放
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const s = Math.min(w, h);
  const sx = Math.floor((w - s) / 2), sy = Math.floor((h - s) / 2);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  // CLIP 正規化：RGB 0..1，減 mean [0.48145466, 0.4578275, 0.40821073]，除 std [0.26862954,0.26130258,0.27577711]
  const mean = [0.48145466, 0.4578275, 0.40821073];
  const std = [0.26862954, 0.26130258, 0.27577711];
  const out = new Float32Array(1 * 3 * size * size);
  let p = 0;
  for (let y=0;y<size;y++){
    for (let x=0;x<size;x++){
      const i = (y*size + x) * 4;
      const r = data[i] / 255, g = data[i+1] / 255, b = data[i+2] / 255;
      out[p] = (r - mean[0]) / std[0];
      out[p + size*size] = (g - mean[1]) / std[1];
      out[p + 2*size*size] = (b - mean[2]) / std[2];
      p++;
    }
  }
  return out;
}

async function getEmbedding(url) {
  if (embeddingCache.has(url)) return embeddingCache.get(url);
  if (!ortSession) await initOrt();
  if (!ortSession) return null;
  try {
    const img = await getImage(url);
    const input = preprocessForClip(img);
    const tensor = new ort.Tensor('float32', input, [1,3,224,224]);
    const feeds = { 'input': tensor };
    const out = await ortSession.run(feeds);
    // 假設輸出名為 'output' 或取第一個
    const firstKey = Object.keys(out)[0];
    let vec = out[firstKey].data;
    // L2 normalize
    let sum=0; for (let i=0;i<vec.length;i++) sum += vec[i]*vec[i];
    const norm = Math.sqrt(Math.max(sum, 1e-12));
    const emb = new Float32Array(vec.length); for (let i=0;i<vec.length;i++) emb[i] = vec[i]/norm;
    embeddingCache.set(url, emb);
    return emb;
  } catch (e) {
    console.warn('Embedding failed for', url, e);
    return null;
  }
}

function cosineSimVec(a, b) { if (!a || !b || a.length!==b.length) return 0; let s=0; for (let i=0;i<a.length;i++) s += a[i]*b[i]; return Math.max(-1, Math.min(1, s)); }

// ======== LLM re-rank (ChatGPT 5) ========
async function getLLMConfig() {
  const { llmApiKey, useLLM, llmTopK, llmProxyUrl } = await chrome.storage.local.get(['llmApiKey','useLLM','llmTopK','llmProxyUrl']);
  return { apiKey: llmApiKey || '', useLLM: useLLM !== false, topK: Math.max(3, Math.min(20, llmTopK || 10)), proxyUrl: (llmProxyUrl || '').trim() };
}

// LLM 日誌輸出
function llmLog(msg) {
  try {
    const box = document.getElementById('llm-log');
    if (!box) return;
    const time = new Date().toLocaleTimeString();
    box.textContent += `[${time}] ${msg}\n`;
    box.scrollTop = box.scrollHeight;
  } catch(_) {}
}

function buildThumbnailDataURL(img, size=224, quality=0.7) {
  try {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(w, h);
    const sx = Math.floor((w - s)/2), sy = Math.floor((h - s)/2);
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (e) {
    // canvas 可能被 CORS 汙染；退回原始 URL 讓 LLM 直接拉圖
    return img.src || '';
  }
}

async function callLLMReRankDirect(apiKey, payload) {
  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = await resp.text(); } catch(_) {}
    throw new Error(`LLM HTTP ${resp.status}: ${detail.slice(0,300)}`);
  }
  const data = await resp.json();
  // 取第一個候選文本
  const text = data?.output?.[0]?.content?.[0]?.text || data?.choices?.[0]?.message?.content || '';
  return text;
}

async function callLLMReRankChatDirect(apiKey, messages, model='gpt-4o-mini') {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 512 })
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = await resp.text(); } catch(_) {}
    throw new Error(`LLM(chat) HTTP ${resp.status}: ${detail.slice(0,300)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return text;
}

async function callLLMViaProxy(proxyUrl, payload) {
  const resp = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = await resp.text(); } catch(_) {}
    throw new Error(`Proxy HTTP ${resp.status}: ${detail.slice(0,300)}`);
  }
  const data = await resp.json();
  const text = data?.output?.[0]?.content?.[0]?.text || data?.choices?.[0]?.message?.content || JSON.stringify(data);
  return text;
}

async function rerankWithLLM(apiKey, Aurl, Bcands, topK) {
  try {
    const imgA = await getImage(Aurl);
    const aThumb = buildThumbnailDataURL(imgA, 224, 0.6);
    const items = [];
    for (let i=0;i<Math.min(topK, Bcands.length);i++) {
      const c = Bcands[i];
      const imgB = await getImage(c.b_url);
      const bThumb = buildThumbnailDataURL(imgB, 224, 0.6);
      items.push({
        b_url: c.b_url,
        b_index: c.b_index,
        score: Number(c.score.toFixed(6)),
        method: c.method,
        thumb: bThumb
      });
    }

    const sys = {
      role: 'system', content: '你是產品圖片匹配專家。根據 A 與候選 B 的縮圖與結構化特徵，挑出最像同一商品的 B（允許比例/亮度差，小幅裁切），排除僅背景/顏色相似或為成分表/說明卡。只輸出 JSON：{"ordered_b_urls":[],"accepted_b_urls":[],"reasons":[]}'
    };
    const usr = {
      role: 'user',
      content: [
        { type: 'text', text: '這是 A 的縮圖：' },
        { type: 'input_image', image_url: { url: aThumb } },
        { type: 'text', text: '以下是候選 B（附分數與方法），請重新排序並挑出最多 3 個最像的：' },
        { type: 'text', text: JSON.stringify(items) }
      ]
    };
    const { proxyUrl } = await getLLMConfig();
    const payload = { model: 'gpt-4o-mini', input: [sys, usr], max_output_tokens: 512, temperature: 0.2 };
    let text = '';
    try {
      if (proxyUrl) {
        text = await callLLMViaProxy(proxyUrl, payload);
      } else {
        text = await callLLMReRankDirect(apiKey, payload);
      }
    } catch (e1) {
      llmLog(`LLM Responses API 失敗：${String(e1).slice(0,180)}`);
      // Chat Completions 後備方案（更高可用性）
      const ccMessages = [
        { role: 'system', content: [{ type: 'text', text: sys.content }] },
        { role: 'user', content: [
          { type: 'text', text: '這是 A 的縮圖：' },
          { type: 'image_url', image_url: { url: aThumb } },
          { type: 'text', text: '以下是候選 B（附分數與方法），請重新排序並挑出最多 3 個最像的：' },
          { type: 'text', text: JSON.stringify(items) }
        ] }
      ];
      if (proxyUrl) {
        text = await callLLMViaProxy(proxyUrl, { model: 'gpt-4o-mini', messages: ccMessages, temperature: 0.2, max_output_tokens: 512 });
      } else {
        text = await callLLMReRankChatDirect(apiKey, ccMessages);
      }
    }
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('LLM no JSON');
    const obj = JSON.parse(text.slice(jsonStart, jsonEnd+1));
    return obj;
  } catch (e) {
    console.warn('LLM rerank failed:', e);
    llmLog(`LLM 重排失敗：${String(e).slice(0,180)}`);
    return null;
  }
}

 