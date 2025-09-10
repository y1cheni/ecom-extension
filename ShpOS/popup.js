(function() {
  const input = document.getElementById('inputUrls');
  const parseBtn = document.getElementById('parseBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyCsvBtn = document.getElementById('copyCsvBtn');
  const copyTxtBtn = document.getElementById('copyTxtBtn');
  const copyTableBtn = document.getElementById('copyTableBtn');
  const statusEl = document.getElementById('status');
  const resultBody = document.getElementById('resultBody');

  let results = [];

  const STORAGE_KEY = 'shpos_state_v1';

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function splitLines(text) {
    return text
      .split(/\r?\n/) 
      .map(s => s.trim())
      .filter(Boolean);
  }

  function saveState() {
    try {
      const state = { input: input.value, results };
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: state });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (_) {}
  }

  function restoreState() {
    function apply(state) {
      if (!state) return;
      if (state.input) input.value = state.input;
      if (Array.isArray(state.results)) {
        results = state.results;
        renderTable(results);
        const has = results.length > 0;
        copyCsvBtn.disabled = !has;
        copyTxtBtn.disabled = !has;
        if (copyTableBtn) copyTableBtn.disabled = !has;
      }
    }

    if (chrome?.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], (obj) => {
        apply(obj?.[STORAGE_KEY]);
      });
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (_) {}
    }
  }

  function extractUsernameFromUrl(urlString) {
    try {
      const url = new URL(urlString);
      const firstSegment = url.pathname.split('/').filter(Boolean)[0] || '';
      return firstSegment;
    } catch (e) {
      return '';
    }
  }

  async function fetchShopViaApi(username) {
    const apiUrl = `https://shopee.tw/api/v4/shop/get_shop_detail?username=${encodeURIComponent(username)}`;
    const resp = await fetch(apiUrl, { credentials: 'omit' });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (!data || !data.data) return null;
    const shopId = data.data.shopid || data.data.shop_id || data.data.shopId;
    const shopName = data.data.name || data.data.shop_name || data.data.shopName;
    if (!shopId && !shopName) return null;
    return { shop_id: shopId?.toString() || '', shop_name: shopName || '' };
  }

  async function fetchHtmlText(url) {
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) return '';
    return await resp.text();
  }

  function parseShopNameFromHtml(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const h1 = doc.querySelector('h1.section-seller-overview-horizontal__portrait-name');
      if (h1 && h1.textContent) return h1.textContent.trim();
    } catch (_) {}
    const m = html.match(/<h1[^>]*class=\"[^\"]*section-seller-overview-horizontal__portrait-name[^\"]*\"[^>]*>([\s\S]*?)<\/h1>/i);
    if (m) return m[1].replace(/<[^>]+>/g, '').trim();
    return '';
  }

  function parseShopIdFromHtml(html) {
    const m = html.match(/[\/-]i\.(\d+)\.(\d+)/);
    if (m) return m[1];
    return '';
  }

  async function resolveShopInfo(urlString) {
    const username = extractUsernameFromUrl(urlString);
    let shopId = '';
    let shopName = '';

    if (username) {
      try {
        const byApi = await fetchShopViaApi(username);
        if (byApi) {
          shopId = byApi.shop_id || '';
          shopName = byApi.shop_name || '';
        }
      } catch (_) {}
    }

    if (!shopId || !shopName) {
      try {
        const html = await fetchHtmlText(urlString);
        if (html) {
          if (!shopName) shopName = parseShopNameFromHtml(html) || '';
          if (!shopId) shopId = parseShopIdFromHtml(html) || '';
        }
      } catch (_) {}
    }

    return { shop_id: shopId, shop_name: shopName, link: urlString };
  }

  function renderTable(rows) {
    resultBody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      const tdId = document.createElement('td');
      const tdName = document.createElement('td');
      const tdLink = document.createElement('td');

      tdId.textContent = r.shop_id || '';
      tdName.textContent = r.shop_name || '';
      const a = document.createElement('a');
      a.href = r.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = r.link;
      tdLink.appendChild(a);

      tr.appendChild(tdId);
      tr.appendChild(tdName);
      tr.appendChild(tdLink);
      resultBody.appendChild(tr);
    }
    saveState();
  }

  function toCsv(rows) {
    const header = ['shop_id','shop_name','蝦皮連結'];
    const escape = (v) => {
      const s = (v ?? '').toString();
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([escape(r.shop_id), escape(r.shop_name), escape(r.link)].join(','));
    }
    return lines.join('\n');
  }

  function toTsv(rows) {
    const header = ['shop_id','shop_name','蝦皮連結'];
    const escapeTab = (v) => (v ?? '').toString().replace(/\t/g, ' ');
    const lines = [header.join('\t')];
    for (const r of rows) {
      lines.push([escapeTab(r.shop_id), escapeTab(r.shop_name), escapeTab(r.link)].join('\t'));
    }
    return lines.join('\n');
  }

  function toHtmlTable(rows) {
    const esc = (s) => (s ?? '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const head = '<tr><th>shop_id</th><th>shop_name</th><th>蝦皮連結</th></tr>';
    const body = rows.map(r => `<tr><td>${esc(r.shop_id)}</td><td>${esc(r.shop_name)}</td><td>${esc(r.link)}</td></tr>`).join('');
    return `<table>${head}${body}</table>`;
  }

  async function handleCopyCsv() {
    try {
      const csv = toCsv(results);
      await navigator.clipboard.writeText(csv);
      setStatus('已複製 CSV 到剪貼簿');
    } catch (e) {
      setStatus('複製失敗，請再試一次');
    }
  }

  async function handleCopyTxt() {
    try {
      const tsv = toTsv(results);
      await navigator.clipboard.writeText(tsv);
      setStatus('已複製純文字（TSV）到剪貼簿');
    } catch (e) {
      setStatus('複製失敗，請再試一次');
    }
  }

  async function handleCopyTable() {
    try {
      const html = toHtmlTable(results);
      const tsv = toTsv(results);
      const blob = new Blob([html], { type: 'text/html' });
      const data = [
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([tsv], { type: 'text/plain' })
        })
      ];
      await navigator.clipboard.write(data);
      setStatus('已複製表格到剪貼簿');
    } catch (e) {
      // 若系統不支援 ClipboardItem，退回純文字 TSV
      try {
        await navigator.clipboard.writeText(toTsv(results));
        setStatus('已複製表格（以純文字備援）到剪貼簿');
      } catch (_) {
        setStatus('複製失敗，請再試一次');
      }
    }
  }

  async function handleParse() {
    const urls = splitLines(input.value);
    if (!urls.length) {
      setStatus('請先貼上至少一個連結');
      return;
    }
    results = [];
    copyCsvBtn.disabled = true;
    copyTxtBtn.disabled = true;
    if (copyTableBtn) copyTableBtn.disabled = true;
    renderTable(results);
    setStatus(`解析中，共 ${urls.length} 筆...`);

    let done = 0;
    for (const u of urls) {
      const info = await resolveShopInfo(u);
      results.push(info);
      done += 1;
      setStatus(`解析中 ${done}/${urls.length}`);
      renderTable(results);
    }

    setStatus(`完成：${results.length} 筆`);
    const has = results.length > 0;
    copyCsvBtn.disabled = !has;
    copyTxtBtn.disabled = !has;
    if (copyTableBtn) copyTableBtn.disabled = !has;
    saveState();
  }

  function handleClear() {
    input.value = '';
    results = [];
    renderTable(results);
    setStatus('');
    copyCsvBtn.disabled = true;
    copyTxtBtn.disabled = true;
    if (copyTableBtn) copyTableBtn.disabled = true;
    saveState();
  }

  input.addEventListener('input', () => saveState());
  parseBtn.addEventListener('click', handleParse);
  clearBtn.addEventListener('click', handleClear);
  copyCsvBtn.addEventListener('click', handleCopyCsv);
  copyTxtBtn.addEventListener('click', handleCopyTxt);
  if (copyTableBtn) copyTableBtn.addEventListener('click', handleCopyTable);

  restoreState();
})();
