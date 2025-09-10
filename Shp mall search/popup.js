class ShopeePopup {
    constructor() {
        this.isRunning = false;
        this.currentData = [];
        this.autoRefreshInterval = null;
        window.shopeePopup = this; // Store instance for cleanup
        this.init();
    }

    init() {
        // Bind event listeners
        document.getElementById('startBtn').addEventListener('click', () => this.startCrawling());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopCrawling());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());

        // Load saved data
        this.refreshData();
        this.updateUI();

        // Start auto refresh every second
        this.startAutoRefresh();

        // Listen to background script messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message);
        });
    }

    startAutoRefresh() {
        // Clear existing interval if any
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Start auto refresh every 1 second
        this.autoRefreshInterval = setInterval(() => {
            this.refreshData();
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
                urls: urls
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

    async clearData() {
        if (confirm('Are you sure you want to clear all crawled data?')) {
            try {
                await chrome.storage.local.clear();
                this.currentData = [];
                this.updateDataDisplay();
                this.updateProductCount();
                this.updateStatus('Data cleared', 'idle');
                    } catch (error) {
            console.error('Failed to clear data:', error);
        }
        }
    }

    async refreshData() {
        try {
            const result = await chrome.storage.local.get(['shopeeProducts']);
            this.currentData = result.shopeeProducts || [];
            this.updateDataDisplay();
            this.updateProductCount();
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }

    exportCSV() {
        if (this.currentData.length === 0) {
            alert('No data available to export!');
            return;
        }

        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shopee_products_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.updateStatus(`Exported ${this.currentData.length} product records`, 'idle');
    }

    generateCSV() {
        const headers = ['Brand', 'Shop ID', 'Product Name', 'Product Link'];
        const rows = this.currentData.map(item => [
            item.brand || '',
            item.shopId || '',
            item.productName || '',
            item.productLink || ''
        ]);

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
            return urlObj.hostname === 'shopee.tw' && 
                   urlObj.pathname === '/mall/search' &&
                   urlObj.searchParams.has('keyword') &&
                   urlObj.searchParams.has('shop');
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
        } else {
            this.currentData.push(data);
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
        document.getElementById('productCount').textContent = this.currentData.length;
    }

    updateDataDisplay() {
        const preview = document.getElementById('dataPreview');
        
        if (this.currentData.length === 0) {
            preview.innerHTML = '<p>No data available</p>';
            return;
        }

        // 顯示最新的5筆資料
        const recentData = this.currentData.slice(-5).reverse();
        const html = recentData.map(item => `
            <div class="product-item fade-in">
                <div class="product-brand">${this.escapeHtml(item.brand || 'Unknown Brand')}</div>
                <div class="product-name">${this.escapeHtml(item.productName || 'Unknown Product')}</div>
                <div class="product-shop">Shop ID: ${this.escapeHtml(item.shopId || 'N/A')}</div>
                <a href="${this.escapeHtml(item.productLink || '#')}" class="product-link" target="_blank" title="Click to view product">
                    ${this.truncateText(item.productLink || '', 60)}
                </a>
            </div>
        `).join('');

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
