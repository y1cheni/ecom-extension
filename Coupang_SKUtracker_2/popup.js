'use strict';

const STORAGE_KEYS = {
	input: 'inputUrls',
	results: 'results',
	state: 'runState',
	tabId: 'workerTabId',
	status: 'statusText',
	total: 'totalCount'
};

const MAX_PAGE = 13;
let aborted = false;

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function normalizeSpaces(text){
	return (text || '').replace(/\s+/g, ' ').trim();
}

function parseBrandFromUrl(url){
	try{
		const u = new URL(url);
		const q = u.searchParams.get('q') || '';
		return decodeURIComponent(q);
	}catch(e){
		return '';
	}
}

function setPage(url, page){
	const u = new URL(url);
	u.searchParams.set('page', String(page));
	return u.toString();
}

function escapeHtml(str){
	return String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function buildPlainText(items){
	const header = [
		'Brand',
		'ProductUnit_productName__gre7e',
		'ProductUnit_productImage__Mqcg1 src',
		'ProductUnit_productUnit__Qd6sv href',
		'DeliveryInfo_delivery__c7z4P',
		'ProductUnit_soldoutText__5UJzM'
	].join('\t');
	const lines = items.map(it => [
		it.brand || '',
		it.name || '',
		it.imageUrl || '',
		it.productUrl || '',
		it.deliveryInfo || '',
		it.soldoutText || ''
	].join('\t'));
	return [header, ...lines].join('\n');
}

async function loadState(){
	return new Promise(resolve => {
		chrome.storage.local.get([STORAGE_KEYS.input, STORAGE_KEYS.results, STORAGE_KEYS.state, STORAGE_KEYS.tabId, STORAGE_KEYS.status, STORAGE_KEYS.total], data => {
			resolve({
				input: data[STORAGE_KEYS.input] || '',
				results: Array.isArray(data[STORAGE_KEYS.results]) ? data[STORAGE_KEYS.results] : [],
				state: data[STORAGE_KEYS.state] || { running: false },
				workerTabId: data[STORAGE_KEYS.tabId] || null,
				status: data[STORAGE_KEYS.status] || '待命',
				total: data[STORAGE_KEYS.total] || 0
			});
		});
	});
}

async function saveState(partial){
	return new Promise(resolve => { chrome.storage.local.set(partial, resolve); });
}

function renderResults(items){
	const wrap = qs('#results');
	wrap.innerHTML = '';
	for(const it of items){
		const row = document.createElement('div');
		row.className = 'item';
		const img = document.createElement('img');
		img.src = it.imageUrl || '';
		img.alt = it.name || '';
		row.appendChild(img);
		const meta = document.createElement('div');
		meta.className = 'meta';
		meta.innerHTML = `
			<div class="brand">${escapeHtml(it.brand || '')}</div>
			<div><a href="${escapeHtml(it.productUrl)}" target="_blank" rel="noreferrer">${escapeHtml(it.name || '')}</a></div>
			<div class="small">Page ${it.page} | ${escapeHtml(it.deliveryInfo || '')}</div>
		`;
		row.appendChild(meta);
		wrap.appendChild(row);
	}
	qs('#resultCount').textContent = `${items.length} items`;
}

async function ensureWorkerTab(){
	const { workerTabId } = await loadState();
	if(workerTabId){
		try{ const tab = await chrome.tabs.get(workerTabId); if(tab) return workerTabId; }catch(e){}
	}
	const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
	await saveState({ [STORAGE_KEYS.tabId]: tab.id });
	return tab.id;
}

function waitForTabComplete(tabId, timeoutMs = 45000){
	return new Promise((resolve, reject) => {
		let done = false;
		const timer = setTimeout(() => { if(done) return; done = true; reject(new Error('tab load timeout')); }, timeoutMs);
		const listener = (id, info) => {
			if(id === tabId && info.status === 'complete'){
				if(done) return; done = true; clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve();
			}
		};
		chrome.tabs.onUpdated.addListener(listener);
	});
}

async function navigate(tabId, url){
	await chrome.tabs.update(tabId, { url });
	await waitForTabComplete(tabId);
}

function buildScraperFunction(){
	return () => {
		function norm(s){ return (s||'').replace(/\s+/g,' ').trim(); }
		function xpAllFrom(root, xp){ const out=[]; const snap=document.evaluate(xp, root, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); for(let i=0;i<snap.snapshotLength;i++) out.push(snap.snapshotItem(i)); return out; }
		function xpOneFrom(root, xp){ return document.evaluate(xp, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }

		async function waitForList(){
			const start=Date.now();
			while(Date.now()-start<15000){
				const nodesAbs = xpAllFrom(document, '/html/body/section/div[2]/div[1]/div[2]/div[2]/div[1]/ul/li');
				const nodesCss = Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a=>a.closest('li')).filter(Boolean);
				if(nodesAbs.length>0 || nodesCss.length>0) return true;
				await new Promise(r=>setTimeout(r,200));
			}
			return false;
		}

		function pickImageUrl(img){
			if(!img) return '';
			let u = img.getAttribute('src') || img.getAttribute('data-src') || '';
			if(!u){ const srcset = img.getAttribute('srcset'); if(srcset){ u = srcset.split(',')[0].trim().split(' ')[0]; } }
			return u || '';
		}

		return (async () => {
			await waitForList();
			let lis = xpAllFrom(document, '/html/body/section/div[2]/div[1]/div[2]/div[2]/div[1]/ul/li');
			if(lis.length===0){ lis = Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a=>a.closest('li')).filter(Boolean); }
			const base = location.origin;
			const items = [];
			for(const li of lis){
				const a = xpOneFrom(li, './a') || li.querySelector('a[href*="/products/"]') || li.querySelector('a[href]');
				if(!a) continue;
				// 售罄：只偵測特定類名，避免誤判
				const soldNode = a.querySelector('[class^="ProductUnit_soldoutText__"], [class*="ProductUnit_soldoutText__"]');
				const isSoldOut = !!soldNode;
				// 有庫存：必須有 Delivery 第二個 span
				const deliverySpan = a.querySelector('[class^="DeliveryInfo_delivery__"], [class*="DeliveryInfo_delivery__"] span:nth-of-type(2)') || (function(){
					const block = a.querySelector('[class^="DeliveryInfo_delivery__"], [class*="DeliveryInfo_delivery__"]');
					return block ? block.querySelector('span:nth-of-type(2)') : null;
				})();
				const hasDelivery = !!deliverySpan;
				if(!hasDelivery || isSoldOut) continue;
				// 名稱
				let nameNode = a.querySelector('[class*="productName" i]') || a.querySelector('[class^="ProductUnit_productName__"], [class*="ProductUnit_productName__"]');
				let name = norm(nameNode? nameNode.textContent: a.textContent);
				// 圖片
				let img = a.querySelector('figure img, img');
				let src = pickImageUrl(img);
				try{ src = new URL(src, base).toString(); }catch(e){}
				// 連結
				let href = a.getAttribute('href') || '';
				try{ href = new URL(href, base).toString(); }catch(e){}
				// Delivery 文本
				let delivery = deliverySpan ? norm(deliverySpan.textContent || '') : '';
				items.push({ name, imageUrl: src, productUrl: href, deliveryInfo: delivery, soldoutText: '' });
			}
			return { items, hasStock: items.length>0 };
		})();
	};
}

async function scrapePageInTab(tabId, brand, pageUrl, page){
	await navigate(tabId, pageUrl);
	const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: buildScraperFunction() });
	const { items } = result || { items: [] };
	const now = Date.now();
	return (items || []).map(it => ({ brand, name: it.name, imageUrl: it.imageUrl, productUrl: it.productUrl, deliveryInfo: it.deliveryInfo, soldoutText: it.soldoutText || '', sourceUrl: pageUrl, page, timestamp: now }));
}

function setRunning(running){ qs('#startBtn').disabled = running; qs('#stopBtn').disabled = !running; }

function getInputUrls(){ const raw = qs('#inputUrls').value || ''; return raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }
function setInputUrls(text){ qs('#inputUrls').value = text || ''; }

function openDb(){
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('coupang_sku_db', 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if(!db.objectStoreNames.contains('items')){
				db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function idbGetAll(){
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('items', 'readonly');
		const store = tx.objectStore('items');
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result || []);
		req.onerror = () => reject(req.error);
	});
}

async function idbClear(){
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('items', 'readwrite');
		const store = tx.objectStore('items');
		const req = store.clear();
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

function csvEscape(value){
	const s = String(value ?? '');
	if(/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
	return s;
}

function buildCsvAll(items){
	const header = ['Brand','ProductUnit_productName__gre7e','ProductUnit_productImage__Mqcg1 src','ProductUnit_productUnit__Qd6sv href','DeliveryInfo_delivery__c7z4P','ProductUnit_soldoutText__5UJzM'];
	const lines = [header.join(',')];
	for(const it of items){
		lines.push([
			csvEscape(it.brand),
			csvEscape(it.name),
			csvEscape(it.imageUrl),
			csvEscape(it.productUrl),
			csvEscape(it.deliveryInfo),
			csvEscape(it.soldoutText)
		].join(','));
	}
	return lines.join('\n');
}

async function exportAll(){
	const items = await idbGetAll();
	const csv = buildCsvAll(items);
	await navigator.clipboard.writeText(csv);
	const el = document.createElement('a');
	el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
	el.download = `coupang_all_${Date.now()}.csv`;
	document.body.appendChild(el); el.click(); el.remove();
	// 清空 IndexedDB 與 UI/計數
	await idbClear();
	await chrome.storage.local.set({ [STORAGE_KEYS.results]: [], [STORAGE_KEYS.total]: 0 });
}

function bindEvents(){
	qs('#startBtn').addEventListener('click', async () => {
		await saveState({ [STORAGE_KEYS.input]: qs('#inputUrls').value });
		const urls = getInputUrls(); if(!urls.length){ qs('#status').textContent='Please paste at least one URL'; return; }
		setRunning(true);
		chrome.runtime.sendMessage({ type: 'START_JOB', urls }, (resp) => {
			qs('#status').textContent = resp && resp.ok ? 'Background job started' : 'Failed to start';
		});
	});
	qs('#stopBtn').addEventListener('click', async () => {
		chrome.runtime.sendMessage({ type: 'STOP_JOB' }, (resp) => {
			qs('#status').textContent = 'Stopping...';
		});
	});
	qs('#clearBtn').addEventListener('click', async () => { await saveState({ [STORAGE_KEYS.results]: [] }); renderResults([]); qs('#status').textContent='Cleared'; });
	qs('#copyBtn').addEventListener('click', async () => { const { results } = await loadState(); const text = buildPlainText(results || []); await navigator.clipboard.writeText(text); qs('#status').textContent='Copied to clipboard'; });
	qs('#exportAllBtn').addEventListener('click', async () => {
		qs('#status').textContent = 'Exporting all...';
		await exportAll();
		renderResults([]);
		qs('#resultCount').textContent = '0 items';
		qs('#status').textContent = 'Exported CSV and cleared data';
	});
	const openBtn = qs('#openWinBtn');
	if(openBtn){
		openBtn.addEventListener('click', async () => {
			await chrome.windows.create({ url: 'dashboard.html', type: 'popup', state: 'normal', focused: true, width: 760, height: 800 });
		});
	}
}

function subscribeStorage(){
	chrome.storage.onChanged.addListener((changes, area) => {
		if(area !== 'local') return;
		if(changes[STORAGE_KEYS.results]){
			renderResults(changes[STORAGE_KEYS.results].newValue || []);
		}
		if(changes[STORAGE_KEYS.status]){
			qs('#status').textContent = changes[STORAGE_KEYS.status].newValue || '';
		}
		if(changes[STORAGE_KEYS.state]){
			const s = changes[STORAGE_KEYS.state].newValue || { running: false };
			setRunning(!!s.running);
		}
	});
}

(async function init(){
	const { input, results, state, status } = await loadState();
	setInputUrls(input);
	renderResults(results || []);
	qs('#status').textContent = status || 'Idle';
	setRunning(state && state.running);
	bindEvents();
	subscribeStorage();
})();
