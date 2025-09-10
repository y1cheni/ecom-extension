'use strict';

const STORAGE_KEYS = {
	input: 'inputUrls',
	results: 'results',
	state: 'runState',
	tabId: 'workerTabId',
	status: 'statusText',
	total: 'totalCount',
	progress: 'progressInfo'
};

const MAX_PAGE = 13;
const UI_RESULTS_LIMIT = 200;
let aborted = false;
const completedPages = new Set();
const seenProductKeys = new Set();

function normalizeSpaces(text){ return (text || '').replace(/\s+/g, ' ').trim(); }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function parseBrandFromUrl(url){ try{ const u = new URL(url); return decodeURIComponent(u.searchParams.get('q')||''); }catch(e){ return ''; } }
function setPage(url, page){ const u = new URL(url); u.searchParams.set('page', String(page)); return u.toString(); }

async function loadState(){ return new Promise(resolve => { chrome.storage.local.get(Object.values(STORAGE_KEYS), data => resolve(data||{})); }); }
async function saveState(partial){ return new Promise(resolve => { chrome.storage.local.set(partial, resolve); }); }

function openDb(){
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('coupang_sku_db', 1);
		req.onupgradeneeded = () => { const db = req.result; if(!db.objectStoreNames.contains('items')){ db.createObjectStore('items', { keyPath: 'id', autoIncrement: true }); } };
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function idbAddMany(items){ if(!items || !items.length) return 0; const db = await openDb(); return new Promise((resolve, reject) => { const tx = db.transaction('items', 'readwrite'); const store = tx.objectStore('items'); for(const it of items){ store.add(it); } tx.oncomplete = () => resolve(items.length); tx.onerror = () => reject(tx.error); }); }

async function ensureWorkerTab(){
	const { [STORAGE_KEYS.tabId]: workerTabId } = await loadState();
	if(workerTabId){ try{ const tab = await chrome.tabs.get(workerTabId); if(tab) return workerTabId; }catch(e){} }
	const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
	try{ await chrome.tabs.update(tab.id, { autoDiscardable: false, muted: true, active: false }); }catch(e){}
	await saveState({ [STORAGE_KEYS.tabId]: tab.id });
	return tab.id;
}

function urlsMatchTarget(currentUrl, targetUrl){
	try{
		const cur = new URL(currentUrl);
		const tar = new URL(targetUrl);
		if(cur.origin !== tar.origin || cur.pathname !== tar.pathname) return false;
		return cur.searchParams.get('page') === tar.searchParams.get('page');
	}catch(e){ return false; }
}

async function waitForDomInteractive(tabId, expectedUrl, timeoutMs = 15000){
	const start = Date.now();
	while(Date.now() - start < timeoutMs){
		try{
			const tab = await chrome.tabs.get(tabId);
			if(tab && typeof tab.url === 'string' && urlsMatchTarget(tab.url, expectedUrl)){
				try{
					const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({ rs: document.readyState }) });
					if(result && result.rs && result.rs !== 'loading') return true;
				}catch(e){}
			}
		}catch(e){}
		await sleep(120);
	}
	return false;
}

async function navigate(tabId, url){
	try{ await chrome.tabs.update(tabId, { autoDiscardable: false, active: false }); }catch(e){}
	await chrome.tabs.update(tabId, { url, active: false });
	await waitForDomInteractive(tabId, url, 15000);
}

function buildHumanizeAsyncFunction(){
	return () => {
		(function(){ function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min; } function fireMouseMove(x, y){ const ev = new MouseEvent('mousemove', { clientX:x, clientY:y, bubbles:true }); document.dispatchEvent(ev); } function fireWheel(){ const ev = new WheelEvent('wheel', { deltaY: Math.random()<0.7? rand(10,120): -rand(10,120), bubbles:true }); document.dispatchEvent(ev); } let steps = rand(1,2), i = 0; function step(){ if(i++ >= steps) return; const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); const y = rand(0, Math.max(0, h-1)); window.scrollTo({ top: y, behavior: 'smooth' }); let inner = 0, innerMax = rand(1,3); (function innerTick(){ if(inner++ >= innerMax) return; fireMouseMove(rand(0, window.innerWidth), rand(0, window.innerHeight)); fireWheel(); setTimeout(innerTick, rand(80,180)); })(); setTimeout(step, rand(120,320)); } step(); })(); return true; };
}

function buildScraperFunction(){
	return () => {
		function norm(s){ return (s||'').replace(/\s+/g,' ').trim(); }
		function xpAllFrom(root, xp){ const out=[]; const snap=document.evaluate(xp, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); for(let i=0;i<snap.snapshotLength;i++) out.push(snap.snapshotItem(i)); return out; }
		function xpOneFrom(root, xp){ return document.evaluate(xp, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }
		function hasNoResultBanner(){ const txt = (document.body && document.body.innerText) ? document.body.innerText : ''; return /沒有符合篩選條件的商品/.test(txt); }
		function http2Error(){ const txt = (document.body && document.body.innerText) ? document.body.innerText : ''; return /ERR_HTTP2_PROTOCOL_ERROR/i.test(txt); }
		function isNetworkError(){ try{ if(location.origin && location.origin.startsWith('chrome-error://')) return true; }catch(e){} const txt = (document.body && document.body.innerText) ? document.body.innerText : ''; return /無法連上這個網站|無法連線到此頁面|This site can’t be reached|This site can't be reached|ERR_/i.test(txt); }
		async function waitForList(){ const start=Date.now(); while(Date.now()-start<7000){ if(http2Error()) return 'http2'; if(isNetworkError()) return 'neterr'; if(hasNoResultBanner()) return 'noresult'; const nodesAbs = xpAllFrom(document, '/html/body/section/div[2]/div[1]/div[2]/div[2]/div[1]/ul/li'); const nodesCss = Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a=>a.closest('li')).filter(Boolean); if(nodesAbs.length>0 || nodesCss.length>0) return 'ok'; await new Promise(r=>setTimeout(r,150)); } return 'timeout'; }
		function pickImageUrl(img){ if(!img) return ''; let u = img.getAttribute('src') || img.getAttribute('data-src') || ''; if(!u){ const srcset = img.getAttribute('srcset'); if(srcset){ u = srcset.split(',')[0].trim().split(' ')[0]; } } return u || ''; }
		return (async () => {
			const ready = await waitForList();
			if(ready === 'http2') return { items: [], hasStock: false, isNetworkError: true, isHttp2Error: true, isNoResult: false };
			if(ready === 'neterr') return { items: [], hasStock: false, isNetworkError: true, isHttp2Error: false, isNoResult: false };
			if(ready === 'noresult') return { items: [], hasStock: false, isNetworkError: false, isHttp2Error: false, isNoResult: true };
			let lis = xpAllFrom(document, '/html/body/section/div[2]/div[1]/div[2]/div[2]/div[1]/ul/li');
			if(lis.length===0){ lis = Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a=>a.closest('li')).filter(Boolean); }
			const base = location.origin;
			const items = [];
			for(const li of lis){
				const a = xpOneFrom(li, './a') || li.querySelector('a[href*="/products/"]') || li.querySelector('a[href]');
				if(!a) continue;
				const soldNode = a.querySelector('[class^="ProductUnit_soldoutText__"], [class*="ProductUnit_soldoutText__"]');
				const isSoldOut = !!soldNode;
				const deliverySpan = a.querySelector('[class^="DeliveryInfo_delivery__"], [class*="DeliveryInfo_delivery__"] span:nth-of-type(2)') || (function(){ const block = a.querySelector('[class^="DeliveryInfo_delivery__"], [class*="DeliveryInfo_delivery__"]'); return block ? block.querySelector('span:nth-of-type(2)') : null; })();
				const hasDelivery = !!deliverySpan;
				if(!hasDelivery || isSoldOut) continue;
				let nameNode = a.querySelector('[class*="productName" i]') || a.querySelector('[class^="ProductUnit_productName__"], [class*="ProductUnit_productName__"]');
				let name = norm(nameNode? nameNode.textContent: a.textContent);
				let img = a.querySelector('figure img, img');
				let src = pickImageUrl(img);
				try{ src = new URL(src, base).toString(); }catch(e){}
				let href = a.getAttribute('href') || '';
				try{ href = new URL(href, base).toString(); }catch(e){}
				let delivery = deliverySpan ? norm(deliverySpan.textContent || '') : '';
				items.push({ name, imageUrl: src, productUrl: href, deliveryInfo: delivery, soldoutText: '' });
			}
			return { items, hasStock: items.length>0, isNetworkError: false, isHttp2Error: false, isNoResult: false };
		})();
	};
}

async function collectItemsInCurrentTab(tabId){
	try{
		const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: buildScraperFunction() });
		const { items, isNetworkError, isHttp2Error, isNoResult } = result || { items: [], isNetworkError: false, isHttp2Error: false, isNoResult: false };
		const now = Date.now();
		return { items: (items||[]).map(it => ({ name: it.name, imageUrl: it.imageUrl, productUrl: it.productUrl, deliveryInfo: it.deliveryInfo, soldoutText: it.soldoutText || '', timestamp: now })), isNetworkError: !!isNetworkError, isHttp2Error: !!isHttp2Error, isNoResult: !!isNoResult };
	}catch(err){ return { items: [], isNetworkError: true, isHttp2Error: false, isNoResult: false }; }
}

async function triggerHumanize(tabId){ try{ await chrome.scripting.executeScript({ target: { tabId }, func: buildHumanizeAsyncFunction() }); }catch(e){} }

async function updateStatus(text){ await saveState({ [STORAGE_KEYS.status]: text }); }

function calcPercent(brandIdx, totalBrands, currentPage, maxPage){
	if(totalBrands <= 0) return 0;
	const within = Math.min(Math.max(currentPage, 0), maxPage) / maxPage;
	const frac = ((brandIdx - 1) + within) / totalBrands;
	return Math.max(0, Math.min(100, Math.round(frac * 100)));
}

async function updateProgress(info){ await saveState({ [STORAGE_KEYS.progress]: info }); }

async function processUrls(urls){
	aborted = false;
	let { [STORAGE_KEYS.results]: uiResults, [STORAGE_KEYS.total]: totalCount } = await loadState();
	uiResults = Array.isArray(uiResults) ? uiResults : [];
	totalCount = typeof totalCount === 'number' ? totalCount : 0;
	const tabId = await ensureWorkerTab();
	const totalBrands = urls.length;
	for(let i=0;i<urls.length;i++){
		if(aborted) break;
		const baseUrl = urls[i];
		const brand = parseBrandFromUrl(baseUrl);
		await updateStatus(`Processing ${i+1}/${urls.length}: ${brand || baseUrl}`);
		for(let page=1; page<=MAX_PAGE; page++){
			if(aborted) break;
			const pageUrl = setPage(baseUrl, page);
			await updateProgress({ brandIdx: i+1, totalBrands, currentPage: page, maxPage: MAX_PAGE, percent: calcPercent(i+1, totalBrands, page, MAX_PAGE), brand: brand || baseUrl });
			await updateStatus(`Fetching: ${brand} (page ${page}/${MAX_PAGE})`);
			try{
				await navigate(tabId, pageUrl);
				triggerHumanize(tabId);
				let pageItems = [];
				let noResult = false;
				while(!aborted){
					if(completedPages.has(pageUrl)) break;
					const { items, isNetworkError, isHttp2Error, isNoResult } = await collectItemsInCurrentTab(tabId);
					if(isNetworkError){
						await updateStatus(`${brand} page ${page}: ${isHttp2Error ? 'HTTP2 error' : 'network error'}, reloading every 1s...`);
						await sleep(1000);
						await navigate(tabId, pageUrl);
						triggerHumanize(tabId);
						continue;
					}
					if(items.length > 0){ pageItems = items; break; }
					if(isNoResult){ noResult = true; break; }
					break;
				}
				if(pageItems.length===0){
					completedPages.add(pageUrl);
					await updateStatus(noResult ? `${brand} page ${page}: no matching products (next URL)` : `${brand} page ${page}: 0 items (next URL)`);
					break;
				}
				const now = Date.now();
				const unique = [];
				for(const it of pageItems){ const key = it.productUrl || `${it.name}@@${it.imageUrl}`; if(seenProductKeys.has(key)) continue; seenProductKeys.add(key); unique.push(it); }
				const enriched = unique.map(it => ({ brand, name: it.name, imageUrl: it.imageUrl, productUrl: it.productUrl, deliveryInfo: it.deliveryInfo, soldoutText: it.soldoutText, sourceUrl: pageUrl, page, timestamp: now }));
				if(enriched.length > 0){
					await idbAddMany(enriched);
					uiResults = uiResults.concat(enriched);
					if(uiResults.length > UI_RESULTS_LIMIT){ uiResults = uiResults.slice(uiResults.length - UI_RESULTS_LIMIT); }
					totalCount += enriched.length;
					await saveState({ [STORAGE_KEYS.results]: uiResults, [STORAGE_KEYS.total]: totalCount });
					await updateStatus(`${brand} page ${page}: ${enriched.length} items (total ${totalCount})`);
				}else{
					await updateStatus(`${brand} page ${page}: 0 new items (deduped)`);
				}
				completedPages.add(pageUrl);
				await sleep(150);
			}catch(err){ await updateStatus(`${brand} page ${page}: error (next URL)`); break; }
		}
	}
	await saveState({ [STORAGE_KEYS.state]: { running: false } });
	await updateProgress({ brandIdx: urls.length, totalBrands, currentPage: MAX_PAGE, maxPage: MAX_PAGE, percent: 100, brand: 'Done' });
	await updateStatus('Done');
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => { (async () => { if(msg && msg.type === 'START_JOB'){ aborted = false; completedPages.clear(); seenProductKeys.clear(); await saveState({ [STORAGE_KEYS.results]: [], [STORAGE_KEYS.input]: (msg.urls||[]).join('\n'), [STORAGE_KEYS.state]: { running: true }, [STORAGE_KEYS.total]: 0 }); processUrls(msg.urls||[]); sendResponse({ ok: true }); return; } if(msg && msg.type === 'STOP_JOB'){ aborted = true; sendResponse({ ok: true }); return; } sendResponse({ ok: false }); })().catch(()=>sendResponse({ ok: false })); return true; });
