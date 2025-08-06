class MomoSearcher {
    constructor() {
        this.products = new Set();
        this.productsWithSPU = []; // 包含 SPU 資訊的商品陣列
        this.totalSPU = 0; // 總 SPU 數量
        this.isSearching = false;
        this.currentTab = null;
        
        this.initializeElements();
        this.loadStoredResults();
        this.bindEvents();
        this.checkCurrentPage();
    }
    
    initializeElements() {
        this.elements = {
            startSearch: document.getElementById('startSearch'),
            stopSearch: document.getElementById('stopSearch'),
            analyzeSPU: document.getElementById('analyzeSPU'),
            copyResults: document.getElementById('copyResults'),
            clearResults: document.getElementById('clearResults'),
            status: document.getElementById('status'),
            resultText: document.getElementById('resultText'),
            count: document.getElementById('count')
        };
    }
    
    bindEvents() {
        this.elements.startSearch.addEventListener('click', () => this.startSearch());
        this.elements.stopSearch.addEventListener('click', () => this.stopSearch());
        this.elements.analyzeSPU.addEventListener('click', () => this.analyzeSPU());
        this.elements.copyResults.addEventListener('click', () => this.copyResults());
        this.elements.clearResults.addEventListener('click', () => this.clearResults());
        
        // Listen to messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📥 Received message:', message);
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });
    }
    
    async loadStoredResults() {
        try {
            const result = await chrome.storage.local.get(['products', 'isSearching']);
            if (result.products) {
                this.products = new Set(result.products);
                this.updateResults();
            }
            if (result.isSearching) {
                this.isSearching = true;
                this.updateUI();
            }
        } catch (error) {
            console.error('Error loading stored results:', error);
        }
    }
    
    async saveResults() {
        try {
            await chrome.storage.local.set({
                products: Array.from(this.products),
                isSearching: this.isSearching
            });
        } catch (error) {
            console.error('Error saving results:', error);
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        console.log(`🔄 Processing message type: ${message.type}`);
        
        switch (message.type) {
            case 'PRODUCTS_FOUND':
                console.log(`📦 Received ${message.products.length} products (no SPU analysis yet)`);
                
                // Update product set - products are just strings at this stage
                message.products.forEach(product => {
                    if (product && product.trim()) {
                        this.products.add(product.trim());
                    }
                });
                this.updateResults();
                this.saveResults();
                
                // Clear page change monitoring timer as we have new data
                if (this.pageChangeTimeout) {
                    clearTimeout(this.pageChangeTimeout);
                    this.pageChangeTimeout = null;
                    console.log('✅ Received product data, cleared page monitoring timer');
                }
                break;
                
            case 'FINAL_RESULTS':
                console.log(`🎯 Received final results with SPU analysis: ${message.products.length} products, ${message.totalSPU} SPUs`);
                this.productsWithSPU = message.products || [];
                this.totalSPU = message.totalSPU || 0;
                
                // Update product set from final results
                message.products.forEach(product => {
                    const productName = typeof product === 'string' ? product : product.name;
                    if (productName && productName.trim()) {
                        this.products.add(productName.trim());
                    }
                });
                this.updateResults();
                this.saveResults();
                this.updateStatus(`SPU analysis completed! Found ${this.products.size} products (${this.totalSPU} SPUs)`);
                break;
                
            case 'PAGE_COMPLETED':
                console.log(`✅ Page ${message.page} completed, products: ${message.count}, has next page: ${message.hasNextPage}`);
                this.updateStatus(`Page ${message.page} completed, found ${message.count} products`);
                if (message.hasNextPage && this.isSearching && message.page < 100) { // Max 100 pages
                    this.updateStatus(`Preparing to go to page ${message.page + 1}...`);
                    console.log(`⏰ Set to turn page to ${message.page + 1} after 3 seconds`);
                    
                    // Set page monitoring, refresh if no new data after 5 seconds
                    this.pageChangeTimeout = setTimeout(() => {
                        console.log('🔄 Page monitoring: No new data for 5 seconds, may need to refresh page');
                        this.sendRefreshCommand();
                    }, 8000); // 3 seconds page turn + 5 seconds monitoring
                    
                    setTimeout(() => {
                        this.goToNextPage(message.page + 1);
                    }, 3000);  // Turn page after 3 seconds
                } else {
                    if (message.page >= 100) {
                        this.completeSearch('Reached maximum search pages (100 pages)!');
                    } else {
                        this.completeSearch('Search completed!');
                    }
                }
                break;
                
            case 'NO_RESULTS_FOUND':
                console.log('🚫 Found search end marker');
                this.completeSearch('Found search end marker, search completed!');
                break;
                
            case 'ERROR':
                console.log(`❌ Received error message: ${message.error}`);
                this.updateStatus(`Error: ${message.error}`);
                this.completeSearch();
                break;
                
            default:
                console.log(`❓ Unknown message type: ${message.type}`);
                break;
        }
    }
    
    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            this.currentTab = tab;
            
            if (tab.url && tab.url.includes('momoshop.com.tw/search/searchShop.jsp')) {
                this.updateStatus('On Momo search page, ready to start search');
                this.elements.startSearch.disabled = false;
            } else {
                this.updateStatus('Please go to Momo search page first');
                this.elements.startSearch.disabled = true;
            }
        } catch (error) {
            this.updateStatus('Unable to check page');
        }
    }
    
    async startSearch() {
        if (!this.currentTab || !this.currentTab.url.includes('momoshop.com.tw/search/searchShop.jsp')) {
            alert('Please go to Momo search page first!');
            return;
        }
        
        this.isSearching = true;
        // Don't clear existing data when starting search
        // this.products.clear();
        // this.productsWithSPU = []; 
        // this.totalSPU = 0;
        this.updateUI();
        this.updateStatus('Starting search on current page...');
        
        // Execute search directly on current tab
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'START_SEARCH'
            });
        } catch (error) {
            this.updateStatus('Failed to send search command: ' + error.message);
            this.completeSearch();
        }
        
        this.saveResults();
    }
    

    
    async goToNextPage(page) {
        if (!this.isSearching || !this.currentTab) return;
        
        // Get parameters from current URL and modify page number
        const currentUrl = new URL(this.currentTab.url);
        currentUrl.searchParams.set('curPage', page.toString());
        const nextUrl = currentUrl.toString();
        
        console.log(`🔄 Going to page ${page}: ${nextUrl}`);
        
        try {
            await chrome.tabs.update(this.currentTab.id, { url: nextUrl });
            this.updateStatus(`🔍 Searching page ${page}...`);
        } catch (error) {
            console.error('Page turning error:', error);
            this.updateStatus(`❌ Error loading page ${page}: ${error.message}`);
            this.completeSearch();
        }
    }
    
    stopSearch() {
        this.isSearching = false;
        this.updateUI();
        this.updateStatus('Search stopped');
        this.saveResults();
    }
    
    completeSearch(message = 'Search completed') {
        this.isSearching = false;
        this.updateUI();
        
        if (this.totalSPU > 0) {
            this.updateStatus(`${message} Found ${this.products.size} products (${this.totalSPU} SPUs)`);
        } else {
            this.updateStatus(`${message} Found ${this.products.size} products`);
        }
        
        this.saveResults();
    }
    
    async copyResults() {
        const text = this.elements.resultText.value;
        if (!text.trim()) {
            alert('No results to copy!');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(text);
            if (this.totalSPU > 0) {
                alert(`Table format data copied to clipboard!\n${this.products.size} products (${this.totalSPU} SPUs)\nCan paste directly to Google Sheets`);
            } else {
                alert(`${this.products.size} products copied to clipboard!\nTable format, can paste directly to Google Sheets`);
            }
        } catch (error) {
            // If modern API fails, use old method
            this.elements.resultText.select();
            document.execCommand('copy');
            if (this.totalSPU > 0) {
                alert(`Table format data copied to clipboard!\n${this.products.size} products (${this.totalSPU} SPUs)\nCan paste directly to Google Sheets`);
            } else {
                alert(`${this.products.size} products copied to clipboard!\nTable format, can paste directly to Google Sheets`);
            }
        }
    }
    
    async clearResults() {
        this.products.clear();
        this.productsWithSPU = []; // Clear SPU data
        this.totalSPU = 0;
        this.updateResults();
        this.updateStatus('Results cleared');
        chrome.storage.local.clear();
        
        // Send clear command to content script if on Momo page
        if (this.currentTab && this.currentTab.url && this.currentTab.url.includes('momoshop.com.tw')) {
            try {
                await chrome.tabs.sendMessage(this.currentTab.id, {
                    type: 'CLEAR_DATA'
                });
                console.log('✅ Clear command sent to content script');
            } catch (error) {
                console.log('Content script not available, data cleared in popup only');
            }
        }
    }
    
    updateUI() {
        this.elements.startSearch.disabled = this.isSearching;
        this.elements.stopSearch.disabled = !this.isSearching;
        this.elements.analyzeSPU.disabled = this.isSearching || this.products.size === 0;
        
        if (this.isSearching) {
            this.elements.status.classList.add('loading');
        } else {
            this.elements.status.classList.remove('loading');
        }
    }
    
    updateStatus(message) {
        this.elements.status.textContent = message;
    }
    
    updateResults() {
        // If has SPU info, use table format display
        if (this.productsWithSPU && this.productsWithSPU.length > 0) {
            // Create table header
            const header = '#\tProduct Name\tSPU';
            
            // Create table content
            const rows = this.productsWithSPU.map((product, index) => {
                return `${index + 1}\t${product.name}\t${product.spuCount}`;
            });
            
            const text = [header, ...rows].join('\n');
            
            this.elements.resultText.value = text;
            this.elements.count.textContent = `${this.products.size} products (${this.totalSPU} SPUs)`;
        } else {
            // Backward compatible old format
            const resultsArray = Array.from(this.products);
            const header = '#\tProduct Name\tSPU';
            const rows = resultsArray.map((product, index) => `${index + 1}\t${product}\t-`);
            const text = [header, ...rows].join('\n');
            
            this.elements.resultText.value = text;
            this.elements.count.textContent = this.products.size;
        }
        
        this.elements.resultText.scrollTop = this.elements.resultText.scrollHeight;
        
        // Update UI state
        this.updateUI();
    }
    
    sendRefreshCommand() {
        if (!this.currentTab) return;
        
        console.log('📤 Sending refresh command to content script');
        chrome.tabs.sendMessage(this.currentTab.id, {
            type: 'REFRESH_PAGE'
        }).catch(error => {
            console.log('Failed to send refresh command, refreshing page directly:', error);
            chrome.tabs.reload(this.currentTab.id);
        });
    }
    
    async analyzeSPU() {
        if (this.products.size === 0) {
            alert('No products found! Please search for products first.');
            return;
        }
        
        this.updateStatus('Starting SPU analysis...');
        
        if (!this.currentTab) {
            alert('No active tab found!');
            return;
        }
        
        console.log('📤 Requesting SPU analysis from content script');
        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'REQUEST_SPU_ANALYSIS'
            });
            this.updateStatus('SPU analysis requested, waiting for results...');
        } catch (error) {
            console.log('Failed to request SPU analysis:', error);
            this.updateStatus('Failed to request SPU analysis - content script not available');
        }
    }
    
    requestFinalSPUAnalysis() {
        if (!this.currentTab) return;
        
        console.log('📤 Requesting final SPU analysis from content script');
        chrome.tabs.sendMessage(this.currentTab.id, {
            type: 'REQUEST_SPU_ANALYSIS'
        }).catch(error => {
            console.log('Failed to request SPU analysis:', error);
        });
    }

}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new MomoSearcher();
}); 