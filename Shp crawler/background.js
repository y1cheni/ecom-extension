class ShopeeBackgroundScript {
    constructor() {
        this.isRunning = false;
        this.currentSession = null;
        this.tabId = null;
        // Chunked storage to avoid oversized items and performance degradation
        this.CHUNK_SIZE = 1000; // records per chunk
        this.AUTO_EXPORT_THRESHOLD = 5000; // auto export when reaching this total
        this.isAutoExporting = false; // guard to avoid concurrent exports
        this.init();
    }

    init() {
        // Listen to messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep async response channel open
        });

        // Listen to tab update events
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Listen to tab removal events
        chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            if (tabId === this.tabId) {
                this.tabId = null;
                if (this.isRunning) {
                    this.sendStatusUpdate('Tab closed, stopping crawling', 'error');
                    this.stopCrawling();
                }
            }
        });

        console.log('Shopee Background Script initialized');
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'START_CRAWLING':
                    if (!this.isRunning) {
                        await this.startCrawling(message.urls, message.mode);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Already running' });
                    }
                    break;

                case 'STOP_CRAWLING':
                    await this.stopCrawling();
                    sendResponse({ success: true });
                    break;

                case 'GET_STATUS':
                    sendResponse({
                        isRunning: this.isRunning,
                        session: this.currentSession
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Failed to handle message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startCrawling(urls, mode = 'mall') {
        if (this.isRunning) {
            throw new Error('Crawling task already running');
        }

        this.isRunning = true;
        this.currentSession = {
            urls: urls,
            mode: mode,
            currentUrlIndex: 0,
            currentPage: 0,
            totalProducts: 0,
            processedUrls: 0,
            startTime: new Date().toISOString(),
            status: 'running'
        };

        this.sendStatusUpdate('Starting crawling task...', 'running');
        
        try {
            await this.processCrawlingSession();
        } catch (error) {
            console.error('Crawling task failed:', error);
            await this.handleCrawlingError(error);
        }
    }

    async processCrawlingSession() {
        const { urls } = this.currentSession;
        
        for (let urlIndex = 0; urlIndex < urls.length && this.isRunning; urlIndex++) {
            this.currentSession.currentUrlIndex = urlIndex;
            this.currentSession.currentPage = 0;
            
            const baseUrl = urls[urlIndex];
            this.sendStatusUpdate(`Processing URL ${urlIndex + 1}/${urls.length}...`, 'running');
            this.sendProgressUpdate(urlIndex + 1, urls.length);
            
            await this.processUrlPages(baseUrl);
            this.currentSession.processedUrls++;
        }

        if (this.isRunning) {
            await this.completeCrawling();
        }
    }

    async processUrlPages(baseUrl) {
        let page = 0;
        let hasProducts = true;

        console.log(`Starting to process URL: ${baseUrl}`);

        while (hasProducts && this.isRunning) {
            this.currentSession.currentPage = page;
            const currentUrl = this.buildPageUrl(baseUrl, page);
            
            console.log(`Processing page ${page + 1} with URL: ${currentUrl}`);
            
            this.sendStatusUpdate(
                `Crawling ${this.currentSession.currentUrlIndex + 1}/${this.currentSession.urls.length} - Page ${page + 1}`,
                'running'
            );

            try {
                const result = await this.crawlSinglePage(currentUrl);
                
                console.log(`Page ${page + 1} crawling result:`, {
                    hasProducts: result.hasProducts,
                    productCount: result.products ? result.products.length : 0,
                    message: result.message
                });
                
                if (!result.hasProducts) {
                    console.log(`Page ${page + 1} has no products, moving to next URL`);
                    hasProducts = false;
                } else {
                    console.log(`Page ${page + 1} found ${result.products.length} products`);
                    await this.saveProducts(result.products);
                    this.currentSession.totalProducts += result.products.length;
                    
                    // Notify popup of new product data
                    this.sendProductUpdate(result.products);
                    page++;
                    console.log(`Moving to page ${page + 1} for same URL`);
                }
                
                // Add delay between pages
                await this.sleep(1000);
                
            } catch (error) {
                console.error(`Failed to crawl page ${page + 1}:`, error);
                // If network error or page load failure, try next page
                if (error.message.includes('timeout') || error.message.includes('load')) {
                    console.log(`Network/load error on page ${page + 1}, trying next page`);
                    page++;
                    if (page > 10) { // Prevent infinite loop
                        console.log(`Reached maximum pages (10), moving to next URL`);
                        hasProducts = false;
                    }
                } else {
                    console.log(`Critical error on page ${page + 1}, moving to next URL`);
                    hasProducts = false;
                }
            }
        }
        
        console.log(`Finished processing URL: ${baseUrl}, processed ${page} pages`);
    }

    async crawlSinglePage(url) {
        try {
            // Create or update tab
            const tab = await this.getOrCreateTab(url);
            this.tabId = tab.id;
            
            // Wait for page to load completely
            await this.waitForPageReady(tab.id);
            
            // Check if no products
            const noProductsCheck = await this.checkNoProducts(tab.id);
            if (noProductsCheck.noProducts) {
                return {
                    hasProducts: false,
                    message: 'No products found in this store'
                };
            }
            
            // Extract product data
            const extractResult = await this.extractProducts(tab.id);
            if (!extractResult.success) {
                throw new Error(extractResult.error || 'Failed to extract products');
            }
            
            return extractResult.data;
            
        } catch (error) {
            console.error('Failed to crawl single page:', error);
            throw error;
        }
    }

    async getOrCreateTab(url) {
        if (this.tabId) {
            try {
                // Update existing tab
                const tab = await chrome.tabs.update(this.tabId, { url: url });
                
                // Wait 2 seconds after opening URL
                console.log('Waiting 2 seconds after opening URL...');
                await this.sleep(2000);
                
                return tab;
            } catch (error) {
                console.log('Failed to update tab, creating new tab:', error);
                this.tabId = null;
            }
        }
        
        // Create new tab
        const tab = await chrome.tabs.create({ 
            url: url, 
            active: false // Run in background
        });
        
        // Wait 2 seconds after opening URL
        console.log('Waiting 2 seconds after opening URL...');
        await this.sleep(2000);
        
        return tab;
    }

    async waitForPageReady(tabId, timeout = 60000) {
        let startTime = Date.now();
        console.log(`Waiting for page to be ready, timeout: ${timeout}ms`);

        while (Date.now() - startTime < timeout) {
            if (!this.isRunning) return false;

            try {
                // Check security verification first; if present, pause and reset timer
                try {
                    const verification = await chrome.tabs.sendMessage(tabId, { action: 'CHECK_SECURITY_VERIFICATION' });
                    if (verification && verification.verifying) {
                        this.sendStatusUpdate('偵測到「安全性驗證」，暫停中...', 'running');
                        await this.sleep(3000);
                        startTime = Date.now(); // do not count verification wait towards timeout
                        continue;
                    }
                } catch (e) {
                    // content script may not be ready yet; ignore
                }

                const response = await chrome.tabs.sendMessage(tabId, {
                    action: 'CHECK_PAGE_READY'
                });

                console.log('Page ready check response:', response);

                if (response && response.ready) {
                    console.log('Page is ready!');
                    return true;
                }

                console.log('Page not ready yet, waiting...');
                await this.sleep(2000);
            } catch (error) {
                // If content script not loaded yet, wait a bit
                console.log('Content script not ready, waiting...', error.message);
                await this.sleep(2000);
            }
        }

        console.log('Page load timeout reached');
        throw new Error('Page load timeout');
    }

    async checkNoProducts(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'CHECK_NO_PRODUCTS'
            });
            return response || { noProducts: false };
        } catch (error) {
            console.error('Failed to check no products status:', error);
            return { noProducts: false };
        }
    }

    async extractProducts(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'EXTRACT_PRODUCTS'
            });
            return response || { success: false, error: 'No response' };
        } catch (error) {
            console.error('Failed to extract products:', error);
            return { success: false, error: error.message };
        }
    }

    async saveProducts(products) {
        if (!products || products.length === 0) {
            return;
        }

        try {
            const mode = this.currentSession?.mode || 'mall';
            const baseKey = mode === 'flagship' ? 'flagshipProducts' : 'shopeeProducts';
            const metaKey = `${baseKey}_meta`;
            const chunkPrefix = `${baseKey}_chunk_`;

            // Load meta
            const metaResult = await chrome.storage.local.get([metaKey]);
            let meta = metaResult[metaKey] || { total: 0, chunkCount: 0 };

            // Ensure at least one chunk exists
            if (meta.chunkCount === 0) {
                meta.chunkCount = 1;
                await chrome.storage.local.set({ [chunkPrefix + '0']: [] });
            }

            let remaining = products.slice();
            let currentChunkIndex = meta.chunkCount - 1;
            let currentChunkKey = chunkPrefix + String(currentChunkIndex);
            const chunkResult = await chrome.storage.local.get([currentChunkKey]);
            let currentChunk = chunkResult[currentChunkKey] || [];

            // Fill current chunk
            const space = Math.max(0, this.CHUNK_SIZE - currentChunk.length);
            if (space > 0 && remaining.length > 0) {
                const toAppend = remaining.splice(0, space);
                currentChunk = currentChunk.concat(toAppend);
                await chrome.storage.local.set({ [currentChunkKey]: currentChunk });
            }

            // Create new chunks as needed
            while (remaining.length > 0) {
                currentChunkIndex += 1;
                const newChunk = remaining.splice(0, this.CHUNK_SIZE);
                const newKey = chunkPrefix + String(currentChunkIndex);
                await chrome.storage.local.set({ [newKey]: newChunk });
            }

            // Update meta
            meta.total += products.length;
            meta.chunkCount = currentChunkIndex + 1;
            await chrome.storage.local.set({ [metaKey]: meta });

            console.log(`Saved ${products.length} ${mode} products, total ${meta.total} products over ${meta.chunkCount} chunks`);

            // Auto export if threshold reached
            if (meta.total >= this.AUTO_EXPORT_THRESHOLD) {
                await this.maybeAutoExport(baseKey, mode);
            }
        } catch (error) {
            console.error('Failed to save product data:', error);
            throw error;
        }
    }

    async maybeAutoExport(baseKey, mode) {
        if (this.isAutoExporting) {
            return;
        }
        this.isAutoExporting = true;
        try {
            await this.exportAllAndClear(baseKey, mode);
            this.sendStatusUpdate(`Auto-exported ${mode} data and cleared storage (threshold ${this.AUTO_EXPORT_THRESHOLD})`, 'running');
        } catch (e) {
            console.error('Auto export failed:', e);
            this.sendErrorUpdate('Auto export failed: ' + (e?.message || String(e)));
        } finally {
            this.isAutoExporting = false;
        }
    }

    async exportAllAndClear(baseKey, mode) {
        const metaKey = `${baseKey}_meta`;
        const prefix = `${baseKey}_chunk_`;

        // Read meta
        const metaResult = await chrome.storage.local.get([metaKey]);
        const meta = metaResult[metaKey];

        // Collect all data (support legacy single-key as well)
        let allData = [];
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
            console.log('No data to export on auto-export');
            return;
        }

        // Generate CSV
        const csvContent = this.generateCSVFromData(allData, mode);
        const filename = `shopee_products_${mode}_${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.csv`;
        const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);

        // Trigger download (no user prompt)
        await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

        // Clear storage
        const toRemove = [baseKey, metaKey];
        if (meta && Number.isInteger(meta.chunkCount)) {
            for (let i = 0; i < meta.chunkCount; i++) {
                toRemove.push(prefix + String(i));
            }
        }
        await chrome.storage.local.remove(toRemove);
        console.log('Auto-export complete and storage cleared');
    }

    generateCSVFromData(data, mode) {
        if (!Array.isArray(data) || data.length === 0) return '';
        const isFlagship = mode === 'flagship' || data[0].hasOwnProperty('item_url') || data[0].hasOwnProperty('img');
        let headers, rows;
        if (isFlagship) {
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
            headers = ['Brand', 'Shop ID', 'Product Name', 'Product Link'];
            rows = data.map(item => [
                item.brand || '',
                item.shopId || '',
                item.productName || '',
                item.productLink || ''
            ]);
        }
        const BOM = '\uFEFF';
        const csvRows = [headers, ...rows];
        const csvContent = BOM + csvRows.map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',')).join('\n');
        return csvContent;
    }

    buildPageUrl(baseUrl, page) {
        try {
            const url = new URL(baseUrl);
            url.searchParams.set('page', page.toString());
            return url.toString();
        } catch (error) {
            console.error('Failed to build URL:', error);
            return baseUrl;
        }
    }

    async completeCrawling() {
        this.isRunning = false;
        const { totalProducts, processedUrls, urls, startTime } = this.currentSession;
        
        const message = `Crawling complete! Processed ${processedUrls}/${urls.length} URLs, obtained ${totalProducts} products`;
        
        this.sendStatusUpdate(message, 'idle');
        this.sendCompleteUpdate(message);
        
        // Close tab
        await this.closeCurrentTab();
        
        console.log('Crawling task completed:', {
            totalProducts,
            processedUrls,
            totalUrls: urls.length,
            duration: Date.now() - new Date(startTime).getTime()
        });
    }

    async stopCrawling() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.sendStatusUpdate('Stopping crawling...', 'idle');
        
        // Close tab
        await this.closeCurrentTab();
        
        this.sendCompleteUpdate('Crawling stopped');
    }

    async handleCrawlingError(error) {
        this.isRunning = false;
        const errorMessage = `Crawling failed: ${error.message}`;
        
        this.sendStatusUpdate(errorMessage, 'error');
        this.sendErrorUpdate(errorMessage);
        
        // Close tab
        await this.closeCurrentTab();
    }

    async closeCurrentTab() {
        if (this.tabId) {
            try {
                await chrome.tabs.remove(this.tabId);
            } catch (error) {
                console.log('Failed to close tab:', error);
            }
            this.tabId = null;
        }
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        if (tabId === this.tabId && changeInfo.status === 'complete') {
            console.log('Tab loaded successfully:', tab.url);
        }
    }

    sendStatusUpdate(status, type = 'running') {
        this.sendMessageToPopup({
            action: 'CRAWLING_STATUS',
            status: status,
            type: type,
            progress: this.currentSession ? {
                current: this.currentSession.currentUrlIndex + 1,
                total: this.currentSession.urls.length
            } : null
        });
    }

    sendProgressUpdate(current, total) {
        this.sendMessageToPopup({
            action: 'CRAWLING_STATUS',
            progress: { current, total }
        });
    }

    sendProductUpdate(products) {
        this.sendMessageToPopup({
            action: 'NEW_PRODUCT_DATA',
            data: products
        });
    }

    sendCompleteUpdate(message) {
        this.sendMessageToPopup({
            action: 'CRAWLING_COMPLETE',
            message: message
        });
    }

    sendErrorUpdate(error) {
        this.sendMessageToPopup({
            action: 'CRAWLING_ERROR',
            error: error
        });
    }

    async sendMessageToPopup(message) {
        try {
            // In MV3 service worker, just attempt to send; catch if no receiver
            await chrome.runtime.sendMessage(message);
        } catch (error) {
            // No active listeners (popup closed) is normal
            console.log('Failed to send message to popup (possibly closed):', error?.message || error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize background script
const shopeeBackground = new ShopeeBackgroundScript();
