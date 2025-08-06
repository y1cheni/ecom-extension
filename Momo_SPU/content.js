class MomoContentScript {
    constructor() {
        this.products = [];
        this.isAutoSearching = false;
        this.allProductsSet = new Set(); // Used to avoid duplicate data
        this.productSPUs = new Map(); // Store product SPU info {product name: {spu: string, count: number}}
        this.spuSet = new Set(); // Store identified SPUs
        this.lastPageProducts = 0;
        this.stuckCheckTimer = null;
        this.pageLoadTime = Date.now();
        this.init();
    }
    
    init() {
        // Listen to commands from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'START_SEARCH') {
                this.startAutoSearch();
            } else if (message.type === 'REFRESH_PAGE') {
                console.log('🔄 Received refresh command, executing page refresh');
                this.refreshPage();
            } else if (message.type === 'CLEAR_DATA') {
                console.log('🗑️ Received clear data command, clearing all data');
                this.clearAllData();
            } else if (message.type === 'REQUEST_SPU_ANALYSIS') {
                console.log('🧮 Received SPU analysis request');
                this.performFinalSPUAnalysis();
            }
            sendResponse({ success: true });
        });
        
        // Auto detect page load completion and start search immediately
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.autoExtractOnPageLoad(), 3000);
            });
        } else {
            setTimeout(() => this.autoExtractOnPageLoad(), 3000);
        }
    }
    
    startAutoSearch() {
        console.log('Received search command, starting search...');
        this.isAutoSearching = true;
        // Don't reset products when starting new search - only clear on explicit clear command
        // Keep existing: this.products, this.allProductsSet, this.productSPUs, this.spuSet
        this.startStuckCheck();
        this.extractProducts();
    }
    
    autoExtractOnPageLoad() {
        // Auto extract once after page load
        this.pageLoadTime = Date.now();
        this.startStuckCheck();
        this.extractProducts();
    }
    
    startStuckCheck() {
        // Clear previous timer
        if (this.stuckCheckTimer) {
            clearTimeout(this.stuckCheckTimer);
        }
        
        // Check if stuck after 5 seconds
        this.stuckCheckTimer = setTimeout(() => {
            this.checkIfStuck();
        }, 5000);
    }
    
    checkIfStuck() {
        const currentProducts = this.products.length;
        const timeSinceLoad = Date.now() - this.pageLoadTime;
        
        console.log(`⏰ Checking if stuck: current products=${currentProducts}, last products=${this.lastPageProducts}, load time=${timeSinceLoad}ms`);
        
        // If no new product data within 5 seconds, or product count hasn't changed
        if (timeSinceLoad > 5000 && (currentProducts === 0 || currentProducts === this.lastPageProducts)) {
            console.log('🔄 Detected page might be stuck, auto refreshing page...');
            this.refreshPage();
        } else {
            this.lastPageProducts = currentProducts;
        }
    }
    
    refreshPage() {
        console.log('🔄 Executing page refresh...');
        window.location.reload();
    }
    
    clearAllData() {
        console.log('🗑️ Clearing all collected data...');
        this.products = [];
        this.allProductsSet = new Set();
        this.productSPUs = new Map();
        this.spuSet = new Set();
        this.lastPageProducts = 0;
        console.log('✅ All data cleared');
    }
    
    performFinalSPUAnalysis() {
        console.log('🧮 Performing final SPU analysis on all products...');
        
        // Reset SPU data
        this.productSPUs = new Map();
        this.spuSet = new Set();
        
        // Analyze all products for SPU
        const allProducts = Array.from(this.allProductsSet);
        allProducts.forEach(productName => {
            this.analyzeSPU(productName);
        });
        
        // Prepare product data with SPU info
        const productsWithSPU = allProducts.map(productName => {
            const spuInfo = this.productSPUs.get(productName) || { spu: '', count: 0 };
            return {
                name: productName,
                spu: spuInfo.spu,
                spuCount: spuInfo.count
            };
        });
        
        console.log(`✅ SPU analysis completed: ${allProducts.length} products, ${this.spuSet.size} unique SPUs`);
        
        // Send final results with SPU analysis
        this.sendMessage({
            type: 'FINAL_RESULTS',
            products: productsWithSPU,
            totalSPU: this.spuSet.size
        });
    }
    
    extractProducts() {
        console.log('Starting to extract product information...');
        
        // Get current page number
        const currentPage = this.getCurrentPage();
        console.log(`Current page: Page ${currentPage}`);
        
        // Reset current page products only (not all products)
        this.products = [];
        
        // First check if there are "no results" messages
        if (this.checkNoResults()) {
            console.log('❌ Found search end marker, stopping search');
            this.sendMessage({
                type: 'NO_RESULTS_FOUND'
            });
            return;
        }
        
        // Try multiple selectors to extract product names
        const selectors = [
            // Selectors based on actual Momo website structure
            'h3 a[title]',                           // Main product title links
            '.prdName a',                            // Product name links
            '.goodsUrl',                             // Product links
            'a[href*="goods.momo.com.tw"]',          // Links containing product pages
            '.listArea h3 a',                        // Title links in list area
            '.searchPrdListArea h3 a',               // Title links in search result area
            'a[onclick*="clickProduct"]',            // Product links with click events
            'a[onclick*="prdNo"]',                   // Links containing product numbers
            '.area_text h3 a',                       // Title links in text area
            '.goods_name a',                         // Goods name
            '.product_name a',                       // Product name
            'a[title*="Logitech"]',                  // Titles containing Logitech
            'dt a',                                  // Links inside dt tags
            '.prdInfoWrap h3 a'                      // Title links inside product info wrapper
        ];
        
        let foundProducts = false;
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Selector "${selector}" found ${elements.length} elements`);
            
                         if (elements.length > 0) {
                 console.log(`Processing ${elements.length} "${selector}" elements`);
                 elements.forEach((element, index) => {
                     let productName = element.getAttribute('title') || 
                                     element.textContent.trim() ||
                                     element.getAttribute('alt');
                     
                     console.log(`Element ${index + 1}: title="${element.getAttribute('title')}", text="${element.textContent.trim()}", alt="${element.getAttribute('alt')}"`);
                     
                     // If current element has no name, try to find from parent or sibling elements
                     if (!productName || productName.length < 5) {
                         const parent = element.closest('li, .prdInfoWrap, .goods_item, .product_item');
                         if (parent) {
                             const nameElements = parent.querySelectorAll('h3, dt, .prdName, [title]');
                             nameElements.forEach(nameEl => {
                                 const name = nameEl.getAttribute('title') || nameEl.textContent.trim();
                                 if (name && name.length > productName.length) {
                                     productName = name;
                                 }
                             });
                         }
                     }
                     
                     if (productName && productName.length > 5) {
                         // Clean product name
                         productName = this.cleanProductName(productName);
                         if (productName && !this.allProductsSet.has(productName)) {
                             this.allProductsSet.add(productName);
                             this.products.push(productName);
                             console.log(`✅ Successfully extracted product: ${productName}`);
                         } else if (productName && this.allProductsSet.has(productName)) {
                             console.log(`⚠️ Skipping duplicate product: ${productName}`);
                         }
                     }
                 });
                 
                 if (this.products.length > 0) {
                     foundProducts = true;
                     break;
                 }
             }
        }
        
        // If none of the above selectors found products, try more generic method
        if (!foundProducts) {
            console.log('Trying generic method to extract products...');
            this.extractWithGenericMethod();
        }
        
        console.log(`Page ${currentPage} found ${this.products.length} products, total ${this.allProductsSet.size} unique products`);
        
        // Clear previous stuck detection timer
        if (this.stuckCheckTimer) {
            clearTimeout(this.stuckCheckTimer);
        }
        
        // Record current page product count
        this.lastPageProducts = this.products.length;
        
        // If products found, prepare for next page
        if (this.products.length > 0) {
            console.log(`🚀 Preparing to send PAGE_COMPLETED message: page=${currentPage}, count=${this.products.length}`);
            
            // Send only product names (no SPU analysis yet)
            this.sendMessage({
                type: 'PRODUCTS_FOUND',
                products: Array.from(this.allProductsSet) // Just product names
            });
            
            this.sendMessage({
                type: 'PAGE_COMPLETED',
                page: currentPage,
                count: this.products.length,
                hasNextPage: true
            });
        } else {
            // If no products found, might have reached last page
            console.log('❌ No products found, might have reached last page');
            
            this.sendMessage({
                type: 'NO_RESULTS_FOUND'
            });
        }
    }
    
    extractWithGenericMethod() {
        console.log('使用通用方法提取商品...');
        
        // 方法1: 尋找所有包含商品資訊的連結
        const productLinks = document.querySelectorAll([
            '.goodsUrl',                           // 專門針對 Momo 的商品連結
            'a[href*="goods.momo"]',
            'a[href*="prdNo="]',
            'a[title]',
            'h3 a',
            'dt a'
        ].join(', '));
        
        console.log(`找到 ${productLinks.length} 個可能的商品連結`);
        
        productLinks.forEach(link => {
            let productName = link.getAttribute('title') || 
                            link.textContent.trim() ||
                            link.getAttribute('alt');
            
            // 嘗試從連結的父元素中尋找商品名稱
            if (!productName || productName.length < 5) {
                const parent = link.closest('.prdInfoWrap, .goods_item, .product_item, .listArea, li, div');
                if (parent) {
                    const nameElement = parent.querySelector('h3, .prdName, .goods_name, .product_name, .title, dt');
                    if (nameElement) {
                        productName = nameElement.textContent.trim() || nameElement.getAttribute('title');
                    }
                }
            }
            
            if (productName && productName.length > 5) {
                productName = this.cleanProductName(productName);
                if (productName && !this.allProductsSet.has(productName)) {
                    this.allProductsSet.add(productName);
                    this.products.push(productName);
                    console.log(`提取到商品: ${productName}`);
                }
            }
        });
        
        // 方法2: 專門處理 Momo 商品列表結構
        const momoProducts = document.querySelectorAll('li');
        console.log(`找到 ${momoProducts.length} 個列表項目`);
        
        momoProducts.forEach((li, index) => {
            // 在每個 li 中尋找商品名稱
            const titleElements = li.querySelectorAll('h3, dt, [title], .prdName, .goodsUrl');
            
            titleElements.forEach(element => {
                let productName = element.getAttribute('title') || element.textContent.trim();
                
                if (productName && productName.length > 10) {
                    productName = this.cleanProductName(productName);
                    if (productName && !this.allProductsSet.has(productName)) {
                        this.allProductsSet.add(productName);
                        this.products.push(productName);
                        console.log(`✅ 從列表項目 ${index + 1} 提取到商品: ${productName}`);
                    }
                }
            });
        });
        
        // 方法3: 直接尋找包含特定關鍵字的文字
        const allElements = document.querySelectorAll('h3, dt, .prdName, [title*="Logitech"], [title*="羅技"]');
        console.log(`找到 ${allElements.length} 個可能包含商品名稱的元素`);
        
        allElements.forEach(element => {
            let productName = element.getAttribute('title') || element.textContent.trim();
            
            if (productName && productName.length > 5 && 
                (productName.includes('Logitech') || productName.includes('羅技') || 
                 productName.includes('滑鼠') || productName.includes('鍵盤') || 
                 productName.includes('耳機') || productName.includes('SPEED'))) {
                
                productName = this.cleanProductName(productName);
                if (productName && !this.allProductsSet.has(productName)) {
                    this.allProductsSet.add(productName);
                    this.products.push(productName);
                    console.log(`通過關鍵字提取到商品: ${productName}`);
                }
            }
        });
    }
    
    cleanProductName(name) {
        if (!name) return '';
        
        // Clean product name, remove extra spaces
        return name
            .replace(/\s+/g, ' ')  // Merge multiple spaces into one
            .replace(/^\s+|\s+$/g, '')  // Remove leading/trailing spaces
            .substring(0, 200);  // Limit length
    }
    
    analyzeSPU(productName) {
        // Generate SPU identifier
        const spu = this.generateSPU(productName);
        
        if (this.spuSet.has(spu)) {
            // Duplicate SPU, record as 0
            this.productSPUs.set(productName, { spu: spu, count: 0 });
            console.log(`🔄 Duplicate SPU: ${productName} -> ${spu}`);
        } else {
            // New SPU, record as 1
            this.spuSet.add(spu);
            this.productSPUs.set(productName, { spu: spu, count: 1 });
            console.log(`🆕 New SPU: ${productName} -> ${spu}`);
        }
    }
    
    generateSPU(productName) {
        if (!productName) return '';
        
        // Convert product name to lowercase for comparison
        let spu = productName.toLowerCase();
        
        // Remove common variant identifiers
        const variantPatterns = [
            // Color related
            /[（(]?[白黑紅藍綠黃紫粉橙灰棕銀金][色]?[）)]?/g,
            /[（(]?white|black|red|blue|green|yellow|purple|pink|orange|gray|grey|brown|silver|gold[）)]?/gi,
            
            // Size related
            /[（(]?[smlxl]{1,3}[）)]?/gi,
            /[（(]?small|medium|large|extra[）)]?/gi,
            /[（(]?\d+[吋寸英]?[）)]?/g,
            /[（(]?\d+cm|mm|inch[）)]?/gi,
            
            // Capacity/specification related
            /[（(]?\d+[gkm]?b[）)]?/gi,
            /[（(]?\d+ml|l|oz[）)]?/gi,
            /[（(]?\d+[個入裝包組][）)]?/g,
            
            // Version related
            /[（(]?第?\d+代?[）)]?/g,
            /[（(]?v\d+(\.\d+)?[）)]?/gi,
            /[（(]?ver\d+[）)]?/gi,
            /[（(]?generation\s?\d+[）)]?/gi,
            
            // Special markers
            /[（(]?限量|限定|特別|專業|進階|標準|基本|豪華|精裝|簡裝[版型款式]?[）)]?/g,
            /[（(]?limited|special|professional|advanced|standard|basic|deluxe[）)]?/gi,
            
            // Number codes
            /[（(]?\d{2,}[）)]?/g,
            
            // Parentheses content (conservative removal)
            /[（(][^（()）]*[）)]/g,
            
            // Extra spaces and symbols
            /[-_+\/\\|]+/g,
            /\s+/g
        ];
        
        // Apply all patterns in sequence
        for (const pattern of variantPatterns) {
            spu = spu.replace(pattern, ' ');
        }
        
        // Clean up result
        spu = spu
            .replace(/\s+/g, ' ')  // Merge multiple spaces
            .trim()                // Remove leading/trailing spaces
            .replace(/^[\s\-_]+|[\s\-_]+$/g, ''); // Remove leading/trailing spaces and connectors
        
        // Further standardization: extract keywords
        const keywords = this.extractKeywords(spu);
        const finalSPU = keywords.join(' ');
        
        return finalSPU || productName.toLowerCase().substring(0, 20);
    }
    
    extractKeywords(text) {
        if (!text) return [];
        
        // Split text and filter keywords
        const words = text.split(/\s+/).filter(word => {
            // Keep meaningful keywords
            return word.length > 1 && 
                   !this.isStopWord(word) &&
                   !this.isVariantWord(word);
        });
        
        // Sort by length and importance, take top 5 keywords
        return words
            .sort((a, b) => b.length - a.length)
            .slice(0, 5)
            .sort(); // Alphabetical sort for consistency
    }
    
    isStopWord(word) {
        const stopWords = [
            // Chinese stop words
            '的', '了', '和', '與', '或', '及', '等', '為', '是', '有', '在', '到', '從', '對', '於',
            '個', '件', '組', '套', '款', '型', '版', '系列', '產品', '商品',
            
            // English stop words
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
            'product', 'item', 'piece', 'set', 'kit', 'pack', 'bundle', 'series'
        ];
        
        return stopWords.includes(word.toLowerCase());
    }
    
    isVariantWord(word) {
        const variantWords = [
            // Color words
            'color', 'colour', 'colored', 'coloured',
            
            // Size words
            'size', 'sized', 'large', 'small', 'medium', 'big', 'mini',
            
            // Quantity words
            'single', 'double', 'triple', 'quad', 'multi',
            
            // Version words
            'version', 'edition', 'model', 'type', 'style', 'design'
        ];
        
        return variantWords.includes(word.toLowerCase());
    }
    
    checkNoResults() {
        const noResultTexts = [
            '沒有篩選到',
            '找不到商品',
            '沒有找到',
            '查無商品',
            '無商品資料',
            '沒有相關商品',
            '搜尋不到商品',
            '很抱歉，找不到',
            '無符合條件',
            '沒有符合',
            '搜尋結果為空'
        ];
        
        const pageText = document.body.textContent || document.body.innerText || '';
        console.log('檢查是否有"沒有篩選到"等結束標記...');
        
        for (const text of noResultTexts) {
            if (pageText.includes(text)) {
                console.log(`✅ 找到結束標記: "${text}"`);
                return true;
            }
        }
        
        console.log('❌ 沒有找到結束標記，繼續搜尋');
        return false;
    }
    
    checkHasNextPage() {
        // 檢查是否有下一頁的各種方法
        const nextSelectors = [
            'a.bt_page_next:not(.disabled)',
            'a[title="下一頁"]:not(.disabled)',
            '.pagination a.next:not(.disabled)',
            '.page_num a.next:not(.disabled)'
        ];
        
        for (const selector of nextSelectors) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        
        // 檢查頁碼，如果當前不是最後一頁
        const pageNumbers = document.querySelectorAll('.pagination a, .page_num a');
        const currentPageNum = this.getCurrentPage();
        let maxPage = currentPageNum;
        
        pageNumbers.forEach(link => {
            const pageNum = parseInt(link.textContent.trim());
            if (!isNaN(pageNum) && pageNum > maxPage) {
                maxPage = pageNum;
            }
        });
        
        return currentPageNum < maxPage;
    }
    
    getCurrentPage() {
        // Get current page number from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const curPage = urlParams.get('curPage');
        return curPage ? parseInt(curPage) : 1;
    }
    
    sendMessage(message) {
        try {
            console.log(`📤 發送訊息:`, message);
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ 訊息發送錯誤:', chrome.runtime.lastError);
                } else {
                    console.log('✅ 訊息發送成功');
                }
            });
        } catch (error) {
            console.error('❌ 發送消息時發生錯誤:', error);
        }
    }
}

// 初始化內容腳本
new MomoContentScript(); 