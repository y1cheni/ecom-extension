class ShopeePopup {
    constructor() {
        this.isRunning = false;
        this.currentData = [];
        this.autoRefreshInterval = null;
        this.currentMode = 'mall'; // 'mall' or 'flagship'
        this.currentTotal = 0; // total count from meta（新增）
        this.CHUNK_BATCH_LIMIT = 5; // 預覽時最多讀取的分片數（新增）
        window.shopeePopup = this; // Store instance for cleanup
        this.init();
    }

    async init() {
        // Bind event listeners
        document.getElementById('startBtn').addEventListener('click', () => this.startCrawling());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopCrawling());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());

        // Mode switch event listeners
        document.getElementById('mallModeBtn').addEventListener('click', () => this.switchMode('mall'));
        document.getElementById('flagshipModeBtn').addEventListener('click', () => this.switchMode('flagship'));

        // Restore saved mode
        await this.restoreSavedMode();

        // Load saved data
        this.refreshData();
        this.updateUI();
        this.updateModeUI();

        // Start auto refresh every second
        this.startAutoRefresh();

        // Listen to background script messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }

    async restoreSavedMode() {
        try {
            const result = await chrome.storage.local.get(['savedMode']);
            if (result.savedMode && (result.savedMode === 'mall' || result.savedMode === 'flagship')) {
                this.currentMode = result.savedMode;
                console.log('Restored saved mode:', this.currentMode);
            } else {
                // Default to mall mode if no saved mode
                this.currentMode = 'mall';
            }
        } catch (error) {
            console.error('Failed to restore saved mode:', error);
            this.currentMode = 'mall';
        }
    }

    async saveMode(mode) {
        try {
            await chrome.storage.local.set({ savedMode: mode });
            console.log('Saved mode:', mode);
        } catch (error) {
            console.error('Failed to save mode:', error);
        }
    }

    startAutoRefresh() {
        // Clear existing interval if any
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Start auto refresh every 1 second
        this.autoRefreshInterval = setInterval(() => {
            this.refreshData();
            this.pollStatus();
        }, 1000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    async startCrawling() {
        const urlInput = document.getElementById('urlInput').value.trim();
        if (!urlInput) {
            alert('Please enter Shopee mall search URLs!');
            return;
        }

        // 解析URL列表
        const urls = urlInput.split('\n').filter(url => url.trim()).map(url => url.trim());
        if (urls.length === 0) {
            alert('Please enter valid URLs!');
            return;
        }

        // 驗證URL格式
        const invalidUrls = urls.filter(url => !this.isValidShopeeUrl(url));
        if (invalidUrls.length > 0) {
            alert(`Invalid URLs found:\n${invalidUrls.join('\n')}`);
            return;
        }

        this.isRunning = true;
        this.updateUI();
        this.updateStatus('Preparing to start crawling...', 'running');

        // 發送給background script開始抓取
        try {
            await chrome.runtime.sendMessage({
                action: 'START_CRAWLING',
                urls: urls,
                mode: this.currentMode
            });
        } catch (error) {
            console.error('Failed to send message:', error);
            this.updateStatus('Failed to start', 'error');
            this.isRunning = false;
            this.updateUI();
        }
    }

    async stopCrawling() {
        this.isRunning = false;
        this.updateUI();
        this.updateStatus('Stopping...', 'idle');

        try {
            await chrome.runtime.sendMessage({
                action: 'STOP_CRAWLING'
            });
        } catch (error) {
            console.error('Failed to stop crawling:', error);
        }

        this.updateStatus('Stopped', 'idle');
    }

    async pollStatus() {
        try {
            const res = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
            if (res && typeof res.isRunning === 'boolean') {
                this.isRunning = res.isRunning;
                if (res.session) {
                    const cur = (res.session.currentUrlIndex || 0) + 1;
                    const total = (res.session.urls || []).length || 0;
                    this.updateProgress(cur, total);
                    const statusMsg = res.isRunning ? 'Running' : 'Idle';
                    this.updateStatus(statusMsg, res.isRunning ? 'running' : 'idle');
                }
                this.updateUI();
            }
        } catch (e) {
            // background may be inactive; ignore
        }
    }

    switchMode(mode) {
        if (this.isRunning) {
            alert('Cannot switch mode while crawling is running!');
            return;
        }

        this.currentMode = mode;
        this.saveMode(mode); // Save the selected mode
        this.updateModeUI();
        this.refreshData(); // Refresh data for new mode
    }

    updateModeUI() {
        // Update mode buttons
        document.getElementById('mallModeBtn').classList.toggle('active', this.currentMode === 'mall');
        document.getElementById('flagshipModeBtn').classList.toggle('active', this.currentMode === 'flagship');

        // Update input placeholder and label
        const urlInput = document.getElementById('urlInput');
        const urlInputLabel = document.getElementById('urlInputLabel');
        
        if (this.currentMode === 'mall') {
            urlInput.placeholder = 'Paste Shopee mall search URLs, one per line...\nExample: https://shopee.tw/mall/search?keyword=品牌&shop=店鋪ID';
            urlInputLabel.textContent = 'Batch Mall URL Input:';
        } else {
            urlInput.placeholder = 'Paste Shopee search URLs, one per line...\nExample: https://shopee.tw/search?keyword=產品關鍵字&page=0';
            urlInputLabel.textContent = 'Batch Flagship Store URL Input:';
        }

        // Update help section
        document.getElementById('mallModeHelp').style.display = this.currentMode === 'mall' ? 'block' : 'none';
        document.getElementById('flagshipModeHelp').style.display = this.currentMode === 'flagship' ? 'block' : 'none';
    }

    async clearData() {
        const mode = this.currentMode === 'flagship' ? '旗艦店' : '商城';
        if (confirm(`Are you sure you want to clear all ${mode} crawled data?`)) {
            try {
                // 分片清理 + 相容舊版單鍵值
                const baseKey = this.currentMode === 'flagship' ? 'flagshipProducts' : 'shopeeProducts';
                const metaKey = `${baseKey}_meta`;
                const prefix = `${baseKey}_chunk_`;

                const metaResult = await chrome.storage.local.get([metaKey]);
                const meta = metaResult[metaKey];

                const keysToRemove = [baseKey, metaKey];
                if (meta && Number.isInteger(meta.chunkCount)) {
                    for (let i = 0; i < meta.chunkCount; i++) {
                        keysToRemove.push(prefix + String(i));
                    }
                }
                await chrome.storage.local.remove(keysToRemove);
                this.currentData = [];
                this.currentTotal = 0;
                this.updateDataDisplay();
                this.updateProductCount();
                this.updateStatus(`${mode} data cleared`, 'idle');
            } catch (error) {
                console.error('Failed to clear data:', error);
            }
        }
    }

    async refreshData() {
        try {
            // 分片讀取（預覽只讀取最後數個分片），相容舊版
            const baseKey = this.currentMode === 'flagship' ? 'flagshipProducts' : 'shopeeProducts';
            const metaKey = `${baseKey}_meta`;
            const prefix = `${baseKey}_chunk_`;

            const metaResult = await chrome.storage.local.get([metaKey]);
            const meta = metaResult[metaKey];

            if (!meta || !Number.isInteger(meta.chunkCount) || meta.chunkCount === 0) {
                const legacy = await chrome.storage.local.get([baseKey]);
                this.currentData = legacy[baseKey] || [];
                this.currentTotal = this.currentData.length;
            } else {
                this.currentTotal = Number(meta.total) || 0;
                const start = Math.max(0, meta.chunkCount - this.CHUNK_BATCH_LIMIT);
                const keys = [];
                for (let i = start; i < meta.chunkCount; i++) keys.push(prefix + String(i));
                const chunks = await chrome.storage.local.get(keys);
                let data = [];
                for (let i = start; i < meta.chunkCount; i++) {
                    const key = prefix + String(i);
                    const arr = chunks[key] || [];
                    data = data.concat(arr);
                }
                this.currentData = data;
            }
            this.updateDataDisplay();
            this.updateProductCount();
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    async exportCSV() {
        // 匯出全量：讀取所有分片（相容舊版）
        const baseKey = this.currentMode === 'flagship' ? 'flagshipProducts' : 'shopeeProducts';
        const metaKey = `${baseKey}_meta`;
        const prefix = `${baseKey}_chunk_`;

        let allData = [];
        const metaResult = await chrome.storage.local.get([metaKey]);
        const meta = metaResult[metaKey];
        if (!meta || !Number.isInteger(meta.chunkCount) || meta.chunkCount === 0) {
            const legacy = await chrome.storage.local.get([baseKey]);
            allData = legacy[baseKey] || [];
        } else {
            const keys = [];
            for (let i = 0; i < meta.chunkCount; i++) keys.push(prefix + String(i));
            const chunks = await chrome.storage.local.get(keys);
            for (let i = 0; i < meta.chunkCount; i++) {
                const key = prefix + String(i);
                const arr = chunks[key] || [];
                allData = allData.concat(arr);
            }
        }

        if (allData.length === 0) {
            alert('No data available to export!');
            return;
        }

        const csvContent = this.generateCSV(allData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shopee_products_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.updateStatus(`Exported ${allData.length} product records`, 'idle');
    }

    generateCSV(dataOverride) {
        const data = Array.isArray(dataOverride) ? dataOverride : this.currentData;
        if (data.length === 0) {
            return '';
        }

        // Check if we have mall mode or flagship mode data
        const firstItem = data[0];
        const isFlagshipMode = firstItem.hasOwnProperty('item_url') || firstItem.hasOwnProperty('img');

        let headers, rows;

        if (isFlagshipMode) {
            // Flagship mode columns
            headers = ['Item_url', 'Img', 'Item', 'Tag', 'Shop_id', 'Keyword', 'Page'];
            rows = data.map(item => [
                item.item_url || '',
                item.img || '',
                item.item || '',
                item.tag || '',
                item.shop_id || '',
                item.keyword || '',
                item.page || ''
            ]);
        } else {
            // Mall mode columns
            headers = ['Brand', 'Shop ID', 'Product Name', 'Product Link'];
            rows = data.map(item => [
                item.brand || '',
                item.shopId || '',
                item.productName || '',
                item.productLink || ''
            ]);
        }

        // 使用UTF-8 BOM確保中文正確顯示
        const BOM = '\uFEFF';
        const csvRows = [headers, ...rows];
        const csvContent = BOM + csvRows.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        return csvContent;
    }

    isValidShopeeUrl(url) {
        try {
            const urlObj = new URL(url);
            
            if (urlObj.hostname !== 'shopee.tw') {
                return false;
            }

            if (this.currentMode === 'mall') {
                // Mall mode validation
                return urlObj.pathname === '/mall/search' &&
                       urlObj.searchParams.has('keyword') &&
                       urlObj.searchParams.has('shop');
            } else {
                // Flagship mode validation
                return urlObj.pathname === '/search' &&
                       urlObj.searchParams.has('keyword');
            }
        } catch {
            return false;
        }
    }

    handleMessage(message) {
        switch (message.action) {
            case 'CRAWLING_STATUS':
                this.updateStatus(message.status, message.type || 'running');
                if (message.progress) {
                    this.updateProgress(message.progress.current, message.progress.total);
                }
                break;
            
            case 'NEW_PRODUCT_DATA':
                this.addProductData(message.data);
                break;
            
            case 'CRAWLING_COMPLETE':
                this.isRunning = false;
                this.updateUI();
                this.updateStatus(message.message || 'Crawling complete', 'idle');
                this.refreshData();
                break;
            
            case 'CRAWLING_ERROR':
                this.isRunning = false;
                this.updateUI();
                this.updateStatus(message.error || 'An error occurred', 'error');
                break;
        }
    }

    addProductData(data) {
        if (Array.isArray(data)) {
            this.currentData.push(...data);
            this.currentTotal = (Number(this.currentTotal) || 0) + data.length; // 新增：即時累加總數
        } else {
            this.currentData.push(data);
            this.currentTotal = (Number(this.currentTotal) || 0) + 1; // 新增：即時累加總數
        }
        this.updateDataDisplay();
        this.updateProductCount();
    }

    updateStatus(status, type = 'idle') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = status;
        
        // 添加狀態指示器
        statusElement.className = `status-${type}`;
    }

    updateProgress(current, total) {
        document.getElementById('progress').textContent = `${current}/${total}`;
    }

    updateProductCount() {
        const total = Number(this.currentTotal) || this.currentData.length; // 新增：總數優先
        document.getElementById('productCount').textContent = total;
    }

    updateDataDisplay() {
        const preview = document.getElementById('dataPreview');
        
        if (this.currentData.length === 0) {
            preview.innerHTML = '<p>No data available</p>';
            return;
        }

        // 顯示最新的5筆資料
        const recentData = this.currentData.slice(-5).reverse();
        
        // Check if we have flagship mode data
        const firstItem = this.currentData[0];
        const isFlagshipMode = firstItem.hasOwnProperty('item_url') || firstItem.hasOwnProperty('img');

        let html;
        if (isFlagshipMode) {
            // Flagship mode display
            html = recentData.map(item => `
                <div class="product-item fade-in">
                    <div class="product-brand">${this.escapeHtml(item.keyword || 'Unknown Keyword')}</div>
                    <div class="product-name">${this.escapeHtml(item.item || 'Unknown Item')}</div>
                    <div class="product-shop">Shop ID: ${this.escapeHtml(item.shop_id || 'N/A')}</div>
                    <div class="product-img">IMG: ${this.truncateText(item.img || '', 50)}</div>
                    <div class="product-tag">TAG: ${this.truncateText(item.tag || '', 50)}</div>
                    <a href="${this.escapeHtml(item.item_url || '#')}" class="product-link" target="_blank" title="Click to view product">
                        ${this.truncateText(item.item_url || '', 60)}
                    </a>
                </div>
            `).join('');
        } else {
            // Mall mode display
            html = recentData.map(item => `
                <div class="product-item fade-in">
                    <div class="product-brand">${this.escapeHtml(item.brand || 'Unknown Brand')}</div>
                    <div class="product-name">${this.escapeHtml(item.productName || 'Unknown Product')}</div>
                    <div class="product-shop">Shop ID: ${this.escapeHtml(item.shopId || 'N/A')}</div>
                    <a href="${this.escapeHtml(item.productLink || '#')}" class="product-link" target="_blank" title="Click to view product">
                        ${this.truncateText(item.productLink || '', 60)}
                    </a>
                </div>
            `).join('');
        }

        preview.innerHTML = html;
    }

    updateUI() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const urlInput = document.getElementById('urlInput');

        if (this.isRunning) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            urlInput.disabled = true;
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            urlInput.disabled = false;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new ShopeePopup();
});

// Clean up when popup is closed
window.addEventListener('beforeunload', () => {
    if (window.shopeePopup) {
        window.shopeePopup.stopAutoRefresh();
    }
});
