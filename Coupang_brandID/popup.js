(function(){
  const urlInput = document.getElementById('urlInput');
  const startBtn = document.getElementById('startBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusEl = document.getElementById('status');
  const resultBody = document.getElementById('resultBody');
  const stopRetryBtn = document.getElementById('stopRetryBtn');

  /** @type {Map<string,{id:string,name:string}>} */
  const brandIdToEntry = new Map();

  const STORAGE_KEYS = {
    urlsText: 'urlsText',
    entries: 'entries'
  };

  let globalRetryController = { cancelled: false };

  function setStatusLines(lines){
    const last3 = lines.slice(-3);
    statusEl.textContent = last3.join('\n');
  }

  function parseInputUrls(){
    return (urlInput.value || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function decodeEscapedString(str){
    try{ return JSON.parse('"' + str.replace(/"/g,'\\"') + '"'); }catch(e){ return str; }
  }

  function sliceBalancedArray(text, startBracketIndex){
    let i = startBracketIndex, depth = 0, inString = false, stringQuote = '', prevChar = '';
    for(; i < text.length; i++){
      const ch = text[i];
      if(inString){ if(ch === stringQuote && prevChar !== '\\'){ inString = false; stringQuote=''; } }
      else { if(ch === '"' || ch === '\''){ inString = true; stringQuote = ch; }
        else if(ch === '['){ depth++; }
        else if(ch === ']'){ depth--; if(depth === 0){ return text.slice(startBracketIndex, i+1); } } }
      prevChar = ch;
    }
    return '';
  }

  function extractBrandsRobust(text){
    const map = new Map(); if(!text) return map;
    const re = /"brands"\s*:\s*\[/g; let m;
    while((m = re.exec(text))){
      const bracketIndex = m.index + m[0].lastIndexOf('[');
      const arrayLiteral = sliceBalancedArray(text, bracketIndex); if(!arrayLiteral) continue;
      let parsed = null;
      for(const raw of [arrayLiteral, decodeEscapedString(arrayLiteral)]){
        try{ parsed = JSON.parse(raw); if(Array.isArray(parsed)) break; }catch(_){ }
      }
      if(Array.isArray(parsed)){
        for(const item of parsed){ if(!item || typeof item !== 'object') continue; const id = String(item.id ?? item.value ?? '').trim(); const name = String(item.name ?? '').trim(); if(id && !map.has(id)) map.set(id, name || '(未知)'); }
        if(map.size > 0) return map;
      }
    }
    return map;
  }

  function extractBrandsFromText(text){
    const map = new Map(); if(!text) return map;
    const brandsBlockRegex = /"brands"\s*:\s*\[([\s\S]*?)\]/g; let blockMatch;
    while((blockMatch = brandsBlockRegex.exec(text))){
      const block = blockMatch[1];
      const itemRegex = /\{[\s\S]*?"id"\s*:\s*"?(\d+)"?[\s\S]*?"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]*?\}/g; let m2;
      while((m2 = itemRegex.exec(block))){ const id = m2[1]; const rawName = m2[2]; const name = decodeEscapedString(rawName); if(!map.has(id)) map.set(id, name); }
    }
    return map;
  }

  function extractBrandsFromNextPush(html){
    const map = new Map(); if(!html) return map;
    const pushRe = /self\.__next_f\.push\(\[([\s\S]*?)\]\)/g; let m;
    while((m = pushRe.exec(html))){ const inside = m[1]; const strRe = /"(?:[^"\\]|\\.)*"/g; let sm; while((sm = strRe.exec(inside))){ const literal = sm[0]; try{ const decoded = JSON.parse(literal); if(typeof decoded === 'string' && decoded.includes('brands')){ const m1 = extractBrandsRobust(decoded); for(const [id, name] of m1){ if(!map.has(id)) map.set(id, name); } if(map.size === 0){ const m2 = extractBrandsFromText(decoded); for(const [id, name] of m2){ if(!map.has(id)) map.set(id, name); } } if(map.size > 0) return map; } }catch(_){ } } }
    return map;
  }

  function extractBrandIdNameFallback(text){
    const map = new Map(); if(!text) return map;
    const pairRegex = /\{[\s\S]*?"brandId"\s*:\s*(\d+)[\s\S]*?"brandName"\s*:\s*"([^"]+)"[\s\S]*?\}/g; let m;
    while((m = pairRegex.exec(text))){ const id = m[1]; const name = decodeEscapedString(m[2]); if(!map.has(id)) map.set(id, name); }
    if(map.size === 0){
      const adj1 = /"brandId"\s*:\s*(\d+)\s*,\s*"brandName"\s*:\s*"([^"]+)"/g; while((m = adj1.exec(text))){ const id = m[1]; const name = decodeEscapedString(m[2]); if(!map.has(id)) map.set(id, name); }
      const adj2 = /"brandName"\s*:\s*"([^"]+)"\s*,\s*"brandId"\s*:\s*(\d+)/g; while((m = adj2.exec(text))){ const name = decodeEscapedString(m[1]); const id = m[2]; if(!map.has(id)) map.set(id, name); }
    }
    return map;
  }

  function buildBrandMapFromHtml(html){
    let map = extractBrandsRobust(html); if(map.size > 0) return map;
    map = extractBrandsFromText(html); if(map.size > 0) return map;
    const unescaped = html.replace(/\\"/g,'"').replace(/\\n/g,'\n').replace(/\\r/g,'\r');
    map = extractBrandsRobust(unescaped); if(map.size === 0) map = extractBrandsFromText(unescaped); if(map.size > 0) return map;
    map = extractBrandsFromNextPush(html); if(map.size > 0) return map;
    try{ const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html'); const scripts = doc.querySelectorAll('script'); for(const node of scripts){ const text = node.textContent || ''; if(!text) continue; let innerMap = extractBrandsRobust(text); if(innerMap.size === 0) innerMap = extractBrandsFromText(text); if(innerMap.size === 0) innerMap = extractBrandsFromNextPush(text); if(innerMap.size > 0) return innerMap; } }catch(e){ }
    return extractBrandIdNameFallback(html);
  }

  async function fetchPageHtml(url){ const res = await fetch(url, { credentials: 'include' }); if(!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); }

  function renderTable(){
    const entries = Array.from(brandIdToEntry.values()).sort((a,b) => Number(a.id) - Number(b.id));
    resultBody.innerHTML = '';
    const frag = document.createDocumentFragment();
    for(const row of entries){ const tr = document.createElement('tr'); const tdId = document.createElement('td'); const tdName = document.createElement('td'); tdId.textContent = row.id; tdName.textContent = row.name; tr.appendChild(tdId); tr.appendChild(tdName); frag.appendChild(tr); }
    resultBody.appendChild(frag);
  }

  function copyTableAsTSV(){
    const entries = Array.from(brandIdToEntry.values()).sort((a,b) => Number(a.id) - Number(b.id));
    const lines = [['brandId','brandName']].concat(entries.map(e => [e.id, e.name]));
    const tsv = lines.map(cols => cols.map(v => String(v).replace(/\t/g,' ')).join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => { setStatusLines(['已複製表格純文字（TSV）到剪貼簿']); }).catch(err => { setStatusLines([`複製失敗：${err.message}`]); });
  }

  function debounce(fn, delay){ let t = 0; return function(){ clearTimeout(t); const args = arguments; t = setTimeout(() => fn.apply(null, args), delay); }; }

  function mapToObject(map){ const obj = {}; for(const [id, entry] of map){ obj[id] = entry.name; } return obj; }
  function objectToMap(obj){ const map = new Map(); if(obj && typeof obj === 'object'){ for(const id of Object.keys(obj)){ map.set(id, { id, name: obj[id] }); } } return map; }

  function getFromStorage(keys){ return new Promise((resolve) => { if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local){ chrome.storage.local.get(keys, resolve); } else { resolve({}); } }); }
  function setToStorage(obj){ return new Promise((resolve) => { if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local){ chrome.storage.local.set(obj, resolve); } else { resolve(); } }); }

  async function loadState(){ try{ const data = await getFromStorage([STORAGE_KEYS.urlsText, STORAGE_KEYS.entries]); const urlsText = data[STORAGE_KEYS.urlsText] || ''; const entriesObj = data[STORAGE_KEYS.entries] || {}; urlInput.value = urlsText; const restored = objectToMap(entriesObj); brandIdToEntry.clear(); for(const [id, entry] of restored){ brandIdToEntry.set(id, entry); } renderTable(); }catch(e){ } }
  async function saveState(){ try{ const urlsText = urlInput.value || ''; const entriesObj = mapToObject(brandIdToEntry); await setToStorage({ [STORAGE_KEYS.urlsText]: urlsText, [STORAGE_KEYS.entries]: entriesObj }); }catch(e){ } }
  const saveStateDebounced = debounce(saveState, 200);

  async function start(){
    const urls = parseInputUrls(); if(urls.length === 0){ setStatusLines(['請先貼上至少一個網址']); return; }
    globalRetryController.cancelled = false;
    startBtn.disabled = true; copyBtn.disabled = true; clearBtn.disabled = true; stopRetryBtn.disabled = false;
    await processUrlsWithRetry(urls);
    renderTable();
    await saveState();
    startBtn.disabled = false; copyBtn.disabled = false; clearBtn.disabled = false; stopRetryBtn.disabled = true;
  }

  async function processUrlsWithRetry(urls){
    const perUrlStats = new Map(); // url -> {attempts, found, added}
    const msgs = [];

    const attemptOnce = async (url) => {
      const html = await fetchPageHtml(url);
      const brandMap = buildBrandMapFromHtml(html);
      let added = 0;
      for(const [id, name] of brandMap){ if(!brandIdToEntry.has(id)){ brandIdToEntry.set(id, { id, name: name || '(未知)' }); added++; } }
      const hasHttp2Error = html.includes('ERR_HTTP2_PROTOCOL_ERROR');
      return { found: brandMap.size, added, hasHttp2Error };
    };

    const waitMs = 500; // 固定 500ms

    for(const url of urls){ perUrlStats.set(url, { attempts: 0, found: 0, added: 0 }); }

    for(const url of urls){
      while(true){
        if(globalRetryController.cancelled){ msgs.push(`⏹ 已停止：${url}`); setStatusLines(msgs); break; }
        const stats = perUrlStats.get(url); stats.attempts += 1;
        try{
          const { found, added, hasHttp2Error } = await attemptOnce(url);
          stats.found = found; stats.added += added;
          if(found > 0){
            msgs.push(`第${stats.attempts}次 ${url} -> 發現 ${found}，本次新增 ${added}，累計新增 ${stats.added}`);
            setStatusLines(msgs);
            renderTable(); await saveState();
            break;
          }
          // found == 0 的處理：僅當偵測到 ERR_HTTP2_PROTOCOL_ERROR 才繼續重試
          if(hasHttp2Error){
            msgs.push(`第${stats.attempts}次 ${url} -> 未取得資料（偵測到 ERR_HTTP2_PROTOCOL_ERROR），將於 500ms 後重試`);
            setStatusLines(msgs);
          } else {
            msgs.push(`第${stats.attempts}次 ${url} -> 無資料（未偵測到 ERR_HTTP2_PROTOCOL_ERROR），停止重試`);
            setStatusLines(msgs);
            break;
          }
        }catch(err){ msgs.push(`錯誤：${err.message}`); setStatusLines(msgs); }
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  async function clearAll(){ urlInput.value = ''; brandIdToEntry.clear(); resultBody.innerHTML = ''; setStatusLines(['已清空']); await saveState(); }
  function stopRetry(){ globalRetryController.cancelled = true; setStatusLines([(statusEl.textContent || ''), '⏹ 已請求停止抓取'].filter(Boolean)); }

  loadState();
  urlInput.addEventListener('input', saveStateDebounced);
  startBtn.addEventListener('click', start);
  clearBtn.addEventListener('click', clearAll);
  copyBtn.addEventListener('click', copyTableAsTSV);
  stopRetryBtn.addEventListener('click', stopRetry);
  window.addEventListener('beforeunload', saveState);
})();

