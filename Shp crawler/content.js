class ShopeeContentScript {
    constructor() {
        this.isActive = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.waitTime = 5000; // Wait time - increased for better page loading
        this.mode = this.detectMode(); // 'mall' or 'flagship'
        this.init();
    }

    init() {
        // Listen to messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });

        console.log('Shopee Content Script initialized, mode:', this.mode);
    }

    detectMode() {
        const url = window.location.href;
        if (url.includes('/mall/search')) {
            return 'mall';
        } else if (url.includes('/search')) {
            return 'flagship';
        } else {
            return 'mall'; // default fallback
        }
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'CHECK_PAGE_READY':
                const isReady = await this.checkPageReady();
                sendResponse({ ready: isReady });
                break;
            
            case 'EXTRACT_PRODUCTS':
                try {
                    const result = await this.extractProductsData();
                    sendResponse({ success: true, data: result });
                } catch (error) {
                    console.error('Failed to extract products:', error);
                    sendResponse({ success: false, error: error.message });
                }
                break;
            
            case 'CHECK_NO_PRODUCTS':
                const noProducts = this.checkNoProductsMessage();
                sendResponse({ noProducts: noProducts });
                break;
            
            case 'SCROLL_AND_WAIT':
                await this.scrollAndWait();
                sendResponse({ success: true });
                break;

            case 'CHECK_SECURITY_VERIFICATION':
                const verifying = this.detectSecurityVerification();
                sendResponse({ verifying });
                break;
        }
    }

    async checkPageReady() {
        try {
            console.log('Checking if page is ready...');
            console.log('Document ready state:', document.readyState);
            
            // Check if page is fully loaded
            if (document.readyState !== 'complete') {
                console.log('Document not complete yet');
                return false;
            }

            // Force wait 2 seconds after document complete for page loading
            console.log('Document ready state: complete - waiting 2 seconds for page loading...');
            await this.sleep(2000);

            // Check page content basics
            let hasBasicContent = document.body && document.body.innerHTML.length > 1000;
            console.log('Has basic content:', hasBasicContent, 'HTML length:', document.body.innerHTML.length);
            
            if (!hasBasicContent) {
                console.log('Page content too short, performing scroll to trigger loading...');
                
                // Perform optimized scroll to trigger dynamic loading
                await this.performOptimizedScroll();
                
                // Re-check after scrolling
                hasBasicContent = document.body && document.body.innerHTML.length > 1000;
                console.log('After scroll - Has basic content:', hasBasicContent, 'HTML length:', document.body.innerHTML.length);
                
                if (!hasBasicContent) {
                    console.log('Page content still too short after scroll, not ready');
                    return false;
                }
            }

            // Check if we can find some key Shopee elements
            const hasShopeeElements = !!(
                document.querySelector('section') ||
                document.querySelector('[class*="shopee"]') ||
                document.querySelector('[class*="mall"]') ||
                document.querySelector('ul') ||
                document.querySelector('div[data-sqe]')
            );
            
            console.log('Has Shopee elements:', hasShopeeElements);

            // If no Shopee elements found, try scrolling to trigger loading
            if (!hasShopeeElements) {
                console.log('No Shopee elements found, performing scroll...');
                await this.performOptimizedScroll();
                
                // Re-check after scrolling
                const hasShopeeElementsAfterScroll = !!(
                    document.querySelector('section') ||
                    document.querySelector('[class*="shopee"]') ||
                    document.querySelector('[class*="mall"]') ||
                    document.querySelector('ul') ||
                    document.querySelector('div[data-sqe]')
                );
                
                console.log('After scroll - Has Shopee elements:', hasShopeeElementsAfterScroll);
                
                if (!hasShopeeElementsAfterScroll) {
                    return false;
                }
            }

            // Check if product list container or no products message exists
            const productContainer = this.getProductContainer();
            const noProductsMsg = this.checkNoProductsMessage();
            
            console.log('Product container found:', !!productContainer);
            console.log('No products message found:', noProductsMsg);
            
            const isReady = hasBasicContent && (hasShopeeElements || !!productContainer || noProductsMsg);
            console.log('Page ready status:', isReady);
            
            return isReady;
        } catch (error) {
            console.error('Failed to check page ready status:', error);
            return false;
        }
    }

    async performOptimizedScroll() {
        console.log('Performing optimized scroll to trigger content loading...');
        
        try {
            const scrollHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight * 3);
            const scrollStep = Math.min(500, window.innerHeight);
            
            // Quick scroll down
            for (let y = 0; y < scrollHeight; y += scrollStep) {
                window.scrollTo(0, y);
                await this.sleep(50); // Faster scroll
            }
            
            // Scroll back to top
            window.scrollTo(0, 0);
            
            // Short wait for content to stabilize
            await this.sleep(1000);
            
            console.log('Optimized scroll completed');
        } catch (error) {
            console.error('Error during optimized scroll:', error);
        }
    }

    checkNoProductsMessage() {
        console.log('Checking for no products message...');
        
        // Multiple possible no products message selectors
        const noProductsSelectors = [
            'div:contains("此賣場未找到任何商品")',
            'div:contains("沒有找到商品")',
            'div:contains("未找到任何商品")',
            'div:contains("此商店暫無商品")',
            'div:contains("商品不存在")',
            'div:contains("No products found")',
            '.shopee-search-empty-result-section',
            '[data-testid="empty-state"]'
        ];

        // Also check for general patterns
        const bodyText = document.body.textContent || document.body.innerText || '';
        const noProductPatterns = [
            '此賣場未找到任何商品',
            '沒有找到商品',
            '未找到任何商品',
            '此商店暫無商品',
            '商品不存在'
        ];
        
        // Check if page contains no products text
        for (const pattern of noProductPatterns) {
            if (bodyText.includes(pattern)) {
                console.log('Found no products pattern in page text:', pattern);
                return true;
            }
        }

        for (const selector of noProductsSelectors) {
            try {
                if (selector.includes(':contains')) {
                    // Use xpath to find elements containing text
                    const searchText = selector.split('contains("')[1].split('")')[0];
                    const xpath = `//div[contains(text(), "${searchText}")]`;
                    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (element && element.offsetParent !== null) {
                        console.log('Found no products message via XPath:', element.textContent);
                        return true;
                    }
                } else {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) {
                        console.log('Found no products message via selector:', element.textContent || element.innerHTML);
                        return true;
                    }
                }
            } catch (error) {
                console.log('Error checking selector:', selector, error);
                continue;
            }
        }

        console.log('No "no products" message found');
        return false;
    }

    detectSecurityVerification() {
        // 檢測頁面是否出現「安全性驗證」相關提示或模態
        try {
            const bodyText = (document.body.textContent || document.body.innerText || '').trim();

            // 文字關鍵字偵測
            const keywords = [
                '安全性驗證',
                '安全驗證',
                '請完成驗證',
                'Security Verification',
                'Please verify you are a human',
                'reCAPTCHA'
            ];
            for (const kw of keywords) {
                if (bodyText.includes(kw)) {
                    return true;
                }
            }

            // 常見 DOM 結構/選擇器偵測
            const selectors = [
                '[id*="captcha" i]',
                '[class*="captcha" i]',
                'iframe[src*="captcha" i]',
                '[data-testid*="captcha" i]',
                '[role="dialog"]:has([class*="captcha"])'
            ];
            for (const sel of selectors) {
                try {
                    if (document.querySelector(sel)) return true;
                } catch {}
            }

            return false;
        } catch (e) {
            return false;
        }
    }

    getProductContainer() {
        // Multiple possible product container selectors
        const selectors = [
            'section ul', // General product list
            '.shopee-search-item-result__item',
            '[data-testid="product-list"]',
            '.shop-search-result-view__item'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }

        return null;
    }

    async extractProductsData() {
        console.log('Starting product data extraction... Mode:', this.mode);
        
        const currentUrl = window.location.href;
        console.log('Current URL:', currentUrl);
        
        const urlInfo = this.parseUrlInfo(currentUrl);
        if (!urlInfo) {
            throw new Error('Unable to parse URL information');
        }
        console.log('URL info:', urlInfo);

        // Choose extraction method based on mode
        let products;
        if (this.mode === 'flagship') {
            console.log('Using flagship mode extraction...');
            products = await this.extractAllFlagshipProducts(urlInfo);
        } else {
            console.log('Using mall mode extraction...');
            products = await this.extractAllProducts(urlInfo);
        }
        
        console.log(`Product extraction completed: found ${products.length} products`);
        
        // If we found products, return them
        if (products.length > 0) {
            console.log(`Success: Found ${products.length} products, returning hasProducts: true`);
            return {
                hasProducts: true,
                products: products,
                urlInfo: urlInfo,
                totalCount: products.length
            };
        }
        
        // If no products found, check if there's a "no products" message
        console.log('No products extracted, checking for no-products message...');
        if (this.checkNoProductsMessage()) {
            console.log('No products message detected, returning hasProducts: false');
            return {
                hasProducts: false,
                message: 'No products found in this store',
                urlInfo: urlInfo,
                products: []
            };
        }
        
        // If no products and no "no products" message, might be a loading issue
        console.log('No products found and no "no products" message - might be loading issue');
        console.log('Page HTML length:', document.body.innerHTML.length);
        console.log('Page text content length:', document.body.textContent.length);
        
        return {
            hasProducts: false,
            message: 'No products detected (possible loading issue)',
            urlInfo: urlInfo,
            products: [],
            debug: {
                htmlLength: document.body.innerHTML.length,
                textLength: document.body.textContent.length,
                url: currentUrl
            }
        };
    }

    async extractAllProducts(urlInfo) {
        const products = [];
        
        console.log('Starting product extraction for URL:', urlInfo);
        
        // Try multiple ways to get product list
        const productElements = await this.getProductElements();
        
        console.log(`Found ${productElements.length} product elements`);
        
        if (productElements.length === 0) {
            console.log('No product elements found, this might be a no-products page');
            return products; // Return empty array
        }

        for (let i = 0; i < productElements.length; i++) {
            try {
                const productData = await this.extractSingleProduct(productElements[i], urlInfo, i + 1);
                if (productData) {
                    products.push(productData);
                    console.log(`Successfully extracted product ${i + 1}/${productElements.length}`);
                } else {
                    console.log(`Failed to extract valid data for product ${i + 1}/${productElements.length}`);
                }
            } catch (error) {
                console.error(`Failed to extract product ${i + 1}:`, error);
                continue;
            }
        }

        console.log(`Total products extracted: ${products.length} out of ${productElements.length} elements`);
        return products;
    }

    async extractAllFlagshipProducts(urlInfo) {
        console.log('Starting flagship product extraction for URL:', urlInfo);
        
        // Perform simple scroll to trigger lazy loading for all products
        await this.performComprehensiveScroll();
        
        // Try multiple strategies to find ALL product elements
        const productElements = await this.getAllProductElementsComprehensive();
        
        console.log(`Found ${productElements.length} flagship product elements`);
        
        if (productElements.length === 0) {
            console.log('No flagship product elements found, this might be a no-products page');
            return []; // Return empty array
        }

        // Batch extract all data at once for maximum efficiency
        console.log(`Batch extracting data for all ${productElements.length} products...`);
        
        const products = await this.batchExtractAllProductData(productElements, urlInfo);
        
        const completeProducts = products.filter(p => this.isProductDataComplete(p));
        console.log(`Total flagship products extracted: ${products.length} (${completeProducts.length} complete) out of ${productElements.length} elements`);
        
        // If not 100% complete, try one more comprehensive extraction
        if (completeProducts.length < productElements.length) {
            console.log(`Attempting comprehensive re-extraction for incomplete products...`);
            const reExtractedProducts = await this.comprehensiveReExtraction(products, productElements, urlInfo);
            
            const finalCompleteProducts = reExtractedProducts.filter(p => this.isProductDataComplete(p));
            console.log(`After re-extraction: ${finalCompleteProducts.length}/${reExtractedProducts.length} complete`);
            
            if (finalCompleteProducts.length === reExtractedProducts.length) {
                console.log(`🎉 Achieved 100% complete data rate!`);
            } else {
                console.warn(`⚠️ Final completion rate: ${finalCompleteProducts.length}/${reExtractedProducts.length} (${Math.round(finalCompleteProducts.length/reExtractedProducts.length*100)}%)`);
            }
            
            return reExtractedProducts;
        }
        
        console.log(`🎉 Achieved 100% complete data rate on first attempt!`);
        return products;
    }

    isProductDataComplete(productData) {
        if (!productData) return false;
        
        // Check all 7 required fields
        return !!(
            productData.item_url && 
            productData.img && 
            productData.item && 
            productData.tag && 
            productData.shop_id && 
            productData.keyword && 
            productData.page
        );
    }

    getMissingFields(productData) {
        if (!productData) return ['all fields'];
        
        const missing = [];
        if (!productData.item_url) missing.push('item_url');
        if (!productData.img) missing.push('img');
        if (!productData.item) missing.push('item');
        if (!productData.tag) missing.push('tag');
        if (!productData.shop_id) missing.push('shop_id');
        if (!productData.keyword) missing.push('keyword');
        if (!productData.page) missing.push('page');
        
        return missing;
    }

    async batchExtractAllProductData(productElements, urlInfo) {
        console.log(`Starting batch extraction for ${productElements.length} products...`);
        
        const products = [];
        const startTime = Date.now();
        
        // Extract all data simultaneously without waiting between products
        for (let i = 0; i < productElements.length; i++) {
            try {
                const element = productElements[i];
                
                // Quick visibility check without scrolling
                const rect = element.getBoundingClientRect();
                const isVisible = rect.top >= -200 && rect.top <= window.innerHeight + 200;
                
                if (!isVisible) {
                    // Quick scroll without waiting
                    element.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                }
                
                // Extract all fields immediately
                const productData = {
                    item_url: this.getFlagshipItemUrl(element, i + 1) || '',
                    img: this.getFlagshipImg(element, i + 1) || '',
                    item: this.getFlagshipItemFromElement(element, i + 1) || '',
                    tag: this.getFlagshipTag(element, i + 1) || '',
                    shop_id: this.getFlagshipShopId(element, i + 1) || '',
                    keyword: urlInfo.keyword || '',
                    page: urlInfo.page || '0',
                    extractedAt: new Date().toISOString(),
                    pageUrl: window.location.href,
                    index: i + 1
                };
                
                products.push(productData);
                
                // Log progress every 10 products
                if ((i + 1) % 10 === 0) {
                    console.log(`Batch progress: ${i + 1}/${productElements.length}`);
                }
                
            } catch (error) {
                console.error(`Batch extraction error for product ${i + 1}:`, error);
                // Add empty product data to maintain indexing
                products.push({
                    item_url: '',
                    img: '',
                    item: '',
                    tag: '',
                    shop_id: '',
                    keyword: urlInfo.keyword || '',
                    page: urlInfo.page || '0',
                    extractedAt: new Date().toISOString(),
                    pageUrl: window.location.href,
                    index: i + 1
                });
            }
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`Batch extraction completed in ${elapsed}ms for ${products.length} products`);
        
        return products;
    }

    async comprehensiveReExtraction(products, productElements, urlInfo) {
        console.log('Starting comprehensive re-extraction for incomplete products...');
        
        const reExtractedProducts = [];
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            
            if (this.isProductDataComplete(product)) {
                // Product is already complete, keep as is
                reExtractedProducts.push(product);
                continue;
            }
            
            // Product needs re-extraction
            const missing = this.getMissingFields(product);
            console.log(`Re-extracting product ${i + 1}: missing ${missing.join(', ')}`);
            
            try {
                const element = productElements[i];
                
                // Ensure element is visible
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
                await this.sleep(300); // Short wait for visibility
                
                // Re-extract only missing fields
                const updatedProduct = { ...product };
                
                if (!updatedProduct.item_url) {
                    updatedProduct.item_url = this.getFlagshipItemUrl(element, i + 1) || '';
                }
                if (!updatedProduct.img) {
                    updatedProduct.img = this.getFlagshipImg(element, i + 1) || '';
                }
                if (!updatedProduct.item) {
                    updatedProduct.item = this.getFlagshipItemFromElement(element, i + 1) || '';
                }
                if (!updatedProduct.tag) {
                    updatedProduct.tag = this.getFlagshipTag(element, i + 1) || '';
                }
                if (!updatedProduct.shop_id) {
                    updatedProduct.shop_id = this.getFlagshipShopId(element, i + 1) || '';
                }
                
                reExtractedProducts.push(updatedProduct);
                
                if (this.isProductDataComplete(updatedProduct)) {
                    console.log(`✅ Product ${i + 1}: Re-extraction successful`);
                } else {
                    const stillMissing = this.getMissingFields(updatedProduct);
                    console.log(`⚠️ Product ${i + 1}: Still missing ${stillMissing.join(', ')}`);
                }
                
            } catch (error) {
                console.error(`Re-extraction failed for product ${i + 1}:`, error);
                reExtractedProducts.push(product); // Keep original data
            }
        }
        
        return reExtractedProducts;
    }

    async getProductElements() {
        console.log('Searching for product elements...');
        
        // Page is already ready and scrolled, proceed with element search
        
        // Try multiple selectors to get product elements
        const selectors = [
            'section ul li', // CSS selector corresponding to user-provided xpath
            'section ul li > div', // Product containers
            'section ul li a', // Product links
            '.shopee-search-item-result__item',
            '.shop-search-result-view__item',
            '[data-testid="product-item"]',
            'div[data-sqe="item"]', // Shopee item container
            '.col-xs-2-4', // Shopee grid item
            'a[href*="/product/"]', // Any product links
            'a[href*="-i."]' // Shopee product format
        ];

        for (const selector of selectors) {
            console.log(`Trying selector: ${selector}`);
            const elements = document.querySelectorAll(selector);
            console.log(`Selector ${selector} found ${elements.length} elements`);
            
            if (elements.length > 0) {
                // Filter out elements that don't contain product links
                const validElements = Array.from(elements).filter(el => {
                    const hasProductLink = el.querySelector('a[href*="/product/"]') || 
                                          el.querySelector('a[href*="-i."]') ||
                                          (el.tagName === 'A' && (el.href.includes('/product/') || el.href.includes('-i.')));
                    return hasProductLink;
                });
                
                if (validElements.length > 0) {
                    console.log(`Using selector ${selector} found ${validElements.length} valid products`);
                    return validElements;
                }
            }
        }

        // If CSS selectors fail, try using xpath (corresponding to user-provided path)
        console.log('Trying XPath selector...');
        try {
            const xpath = '/html/body/div[1]/div[1]/div[2]/div/div/div/div/div/div[2]/section/ul/li';
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                elements.push(result.snapshotItem(i));
            }
            if (elements.length > 0) {
                console.log(`Using XPath found ${elements.length} products`);
                return elements;
            }
        } catch (error) {
            console.error('XPath search failed:', error);
        }

        // Try broader searches
        console.log('Trying broader searches...');
        const broadSelectors = [
            'section ul > li',
            'ul li',
            'div[class*="item"]',
            'a[href]'
        ];
        
        for (const selector of broadSelectors) {
            const elements = document.querySelectorAll(selector);
            const filtered = Array.from(elements).filter(el => {
                const text = el.textContent || '';
                const hasLink = el.querySelector('a[href]') || (el.tagName === 'A' && el.href);
                // Check if element seems to contain product info
                return hasLink && text.length > 10 && !text.includes('賣場未找到');
            });
            
            if (filtered.length > 0) {
                console.log(`Using broad selector ${selector} found ${filtered.length} potential products`);
                return filtered.slice(0, 50); // Limit to reasonable number
            }
        }

        console.log('No product elements found with any selector');
        return [];
    }

    async getAllProductElementsComprehensive() {
        console.log('Precise search for product elements...');
        
        // Start with the most precise selector first
        let productElements = [];
        
        // Strategy 1: Use the exact XPath you originally provided
        try {
            const xpath = '/html/body/div[1]/div[1]/div[2]/div/div/div/div/div/div[2]/section/ul/li';
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            
            for (let i = 0; i < result.snapshotLength; i++) {
                productElements.push(result.snapshotItem(i));
            }
            
            if (productElements.length > 0) {
                console.log(`XPath found: ${productElements.length} product elements`);
                return this.validateProductElements(productElements);
            }
        } catch (error) {
            console.error('XPath search failed:', error);
        }
        
        // Strategy 2: Try the most specific CSS selector
        try {
            const elements = document.querySelectorAll('section ul li');
            const validElements = Array.from(elements).filter(el => {
                // Validate this is actually a product element by checking for required components
                const hasItemUrl = el.querySelector('a[href*="/product/"]') || el.querySelector('a[href*="-i."]');
                const hasImg = el.querySelector('img[src]');
                const hasTextContent = el.textContent && el.textContent.trim().length > 20;
                
                return hasItemUrl && hasImg && hasTextContent;
            });
            
            if (validElements.length > 0) {
                console.log(`CSS selector found: ${validElements.length} valid product elements`);
                return this.validateProductElements(validElements);
            }
        } catch (error) {
            console.error('CSS selector search failed:', error);
        }
        
        // Strategy 3: Fallback to broader search but with strict validation
        console.log('Using fallback search with strict validation...');
        const fallbackSelectors = [
            'div[data-sqe="item"]',
            '.col-xs-2-4',
            'li[class*="item"]'
        ];
        
        for (const selector of fallbackSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                const validElements = Array.from(elements).filter(el => this.isValidProductElement(el));
                
                if (validElements.length > 0) {
                    console.log(`Fallback selector "${selector}" found: ${validElements.length} valid elements`);
                    return this.validateProductElements(validElements);
                }
            } catch (error) {
                console.log(`Fallback selector "${selector}" failed:`, error.message);
            }
        }
        
        console.warn('No valid product elements found with any selector');
        return [];
    }

    validateProductElements(elements) {
        // Remove any duplicate elements and ensure they are actual product containers
        const uniqueElements = [];
        const seenElements = new Set();
        
        for (const el of elements) {
            // Use element's position and content as unique identifier
            const identifier = el.getBoundingClientRect().top + '_' + (el.textContent || '').substring(0, 50);
            
            if (!seenElements.has(identifier) && this.isValidProductElement(el)) {
                seenElements.add(identifier);
                uniqueElements.push(el);
            }
        }
        
        console.log(`Validated ${uniqueElements.length} unique product elements`);
        return uniqueElements;
    }

    isValidProductElement(element) {
        try {
            // Check for the specific field indicators you mentioned
            const hasItemUrl = element.querySelector('a[href*="/product/"]') || element.querySelector('a[href*="-i."]');
            const hasImg = element.querySelector('img[src]');
            const hasItemText = element.querySelector('[class*="line-clamp-2"]') || element.querySelector('div[class*="line-clamp"]');
            
            // Additional validation: ensure it's not a duplicate or nested element
            const hasReasonableSize = element.offsetHeight > 100 && element.offsetWidth > 100;
            const hasProductContent = element.textContent && element.textContent.trim().length > 30;
            
            return hasItemUrl && hasImg && hasItemText && hasReasonableSize && hasProductContent;
        } catch (error) {
            return false;
        }
    }

    async extractSingleProduct(element, urlInfo, index) {
        try {
            // Product name - try multiple ways
            const productName = this.getProductName(element, index);
            
            // Product link - try multiple ways
            const productLink = this.getProductLink(element, index);

            if (!productName && !productLink) {
                console.warn(`Product ${index}: Cannot find product name or link`);
                return null;
            }

            const productData = {
                brand: urlInfo.brand,
                shopId: urlInfo.shopId,
                productName: productName || 'Unknown Product',
                productLink: productLink || '',
                extractedAt: new Date().toISOString(),
                pageUrl: window.location.href,
                index: index
            };

            console.log(`Successfully extracted product ${index}:`, productData);
            return productData;

        } catch (error) {
            console.error(`Error extracting product ${index}:`, error);
            return null;
        }
    }

    async extractSingleFlagshipProduct(element, urlInfo, index, attempt = 1) {
        try {
            // Smart visibility check - only wait if element is not visible
            const rect = element.getBoundingClientRect();
            const isVisible = rect.top >= -100 && rect.top <= window.innerHeight + 100; // Extended visibility range
            
            if (!isVisible) {
                // Element not visible, scroll it into view
                element.scrollIntoView({ behavior: 'auto', block: 'center' });
                await this.sleep(300 + (attempt * 100)); // Longer wait on retry attempts
            } else if (attempt > 1) {
                // Even if visible, wait longer on retry attempts for network stability
                await this.sleep(200 + (attempt * 100));
            }
            
            // Extract all required fields for flagship mode (all 7 fields are now required)
            const item_url = this.getFlagshipItemUrl(element, index);
            const img = this.getFlagshipImg(element, index);
            const item = this.getFlagshipItemFromElement(element, index);
            const tag = this.getFlagshipTag(element, index);
            const shop_id = this.getFlagshipShopId(element, index);

            const productData = {
                item_url: item_url || '',
                img: img || '',
                item: item || '',
                tag: tag || '', // Now required instead of optional
                shop_id: shop_id || '',
                keyword: urlInfo.keyword || '',
                page: urlInfo.page || '0',
                extractedAt: new Date().toISOString(),
                pageUrl: window.location.href,
                index: index
            };

            // For retry attempts, try harder to get missing data
            if (attempt > 1) {
                console.log(`Attempt ${attempt} - performing intensive extraction...`);
                
                // Retry all missing fields with longer waits
                if (!item_url) {
                    await this.sleep(200);
                    const retryItemUrl = this.getFlagshipItemUrl(element, index);
                    if (retryItemUrl) productData.item_url = retryItemUrl;
                }
                
                if (!img) {
                    await this.sleep(200);
                    const retryImg = this.getFlagshipImg(element, index);
                    if (retryImg) productData.img = retryImg;
                }
                
                if (!item) {
                    await this.sleep(200);
                    const retryItem = this.getFlagshipItemFromElement(element, index);
                    if (retryItem) productData.item = retryItem;
                }
                
                if (!tag) {
                    await this.sleep(200);
                    const retryTag = this.getFlagshipTag(element, index);
                    if (retryTag) productData.tag = retryTag;
                }
                
                if (!shop_id) {
                    await this.sleep(200);
                    const retryShopId = this.getFlagshipShopId(element, index);
                    if (retryShopId) productData.shop_id = retryShopId;
                }
            }

            return productData;

        } catch (error) {
            console.error(`Error extracting flagship product ${index} (attempt ${attempt}):`, error);
            return null;
        }
    }

    async ensureElementVisible(element, index) {
        try {
            const rect = element.getBoundingClientRect();
            const isVisible = rect.top >= 0 && rect.top <= window.innerHeight;
            
            if (!isVisible) {
                console.log(`Element ${index} not visible, scrolling to make it visible...`);
                
                // Scroll element into view
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Wait for scroll and lazy loading
                await this.sleep(400);
                
                // Additional wait if element was far from viewport
                if (Math.abs(rect.top) > window.innerHeight) {
                    await this.sleep(700);
                }
            } else {
                // Even if visible, give a small wait for any pending lazy loading
                await this.sleep(100);
            }
        } catch (error) {
            console.error(`Error ensuring element ${index} visibility:`, error);
        }
    }

    getProductName(element, index) {
        // Try multiple selectors to get product name
        const selectors = [
            'a div div:nth-child(2) div:first-child div:first-child', // Corresponding to user xpath
            '.shopee-search-item-result__item-name',
            '[data-testid="product-name"]',
            '.shop-search-result-view__item__name',
            'a[href*="/product/"] div:last-child',
            'a div:last-child div:first-child',
            'span[title]'
        ];

        for (const selector of selectors) {
            try {
                const nameElement = element.querySelector(selector);
                if (nameElement) {
                    const name = (nameElement.textContent || nameElement.title || nameElement.getAttribute('title') || '').trim();
                    if (name) {
                        console.log(`Product ${index} name (using ${selector}):`, name);
                        return name;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // If CSS selectors fail, try xpath
        try {
            const xpath = './/a/div/div[2]/div[1]/div[1]/text()';
            const result = document.evaluate(xpath, element, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                const name = result.singleNodeValue.textContent.trim();
                if (name) {
                    console.log(`Product ${index} name (using XPath):`, name);
                    return name;
                }
            }
        } catch (error) {
            console.error(`XPath extract product name failed:`, error);
        }

        console.warn(`Product ${index}: Cannot find product name`);
        return null;
    }

    getProductLink(element, index) {
        // Multiple ways to get product links
        const selectors = [
            'a[href*="/product/"]',
            'a[href*="shopee.tw"]',
            'a',
            '[href]'
        ];

        for (const selector of selectors) {
            try {
                const linkElement = element.querySelector(selector);
                if (linkElement && linkElement.href) {
                    let link = linkElement.href;
                    
                    // Ensure it's a complete URL
                    if (link.startsWith('/')) {
                        link = 'https://shopee.tw' + link;
                    }
                    
                    if (link.includes('shopee.tw')) {
                        console.log(`Product ${index} link (using ${selector}):`, link);
                        return link;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // Find first a tag with href directly in element
        try {
            const firstLink = element.querySelector('a[href]');
            if (firstLink && firstLink.href) {
                let link = firstLink.href;
                if (link.startsWith('/')) {
                    link = 'https://shopee.tw' + link;
                }
                console.log(`Product ${index} link (fallback):`, link);
                return link;
            }
        } catch (error) {
            console.error('Failed to get product link:', error);
        }

        console.warn(`Product ${index}: Cannot find product link`);
        return null;
    }

    parseUrlInfo(url) {
        try {
            const urlObj = new URL(url);
            const params = urlObj.searchParams;
            
            if (this.mode === 'flagship') {
                // Flagship mode URL parsing
                const keyword = params.get('keyword');
                if (!keyword) {
                    return null;
                }

                return {
                    keyword: decodeURIComponent(keyword),
                    page: params.get('page') || '0'
                };
            } else {
                // Mall mode URL parsing
                const keyword = params.get('keyword');
                const shopId = params.get('shop');
                
                if (!keyword || !shopId) {
                    return null;
                }

                // Decode brand name
                const brand = decodeURIComponent(keyword);
                
                return {
                    brand: brand,
                    shopId: shopId,
                    page: params.get('page') || '0'
                };
            }
        } catch (error) {
            console.error('Failed to parse URL:', error);
            return null;
        }
    }

    async performComprehensiveScroll() {
        console.log('Performing simple scroll to trigger lazy loading...');
        
        try {
            // Simple approach: scroll to bottom then back to top
            console.log('Scrolling to bottom...');
            window.scrollTo(0, document.documentElement.scrollHeight);
            await this.sleep(1500); // Wait for lazy loading
            
            console.log('Scrolling back to top...');
            window.scrollTo(0, 0);
            await this.sleep(500); // Brief stabilization wait
            
            console.log('Simple scroll completed');
        } catch (error) {
            console.error('Error during simple scroll:', error);
        }
    }

    // Removed scrollToBatch - no longer needed with unified processing

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Flagship mode extraction methods
    getFlagshipItemUrl(element, index) {
        // Based on your field mapping: contents href -> item_url
        try {
            // Look for href in contents area
            const selectors = [
                'a[href*="/product/"]',
                'a[href*="-i."]',
                'div div a:first-child',
                'a:first-child'
            ];
            
            for (const selector of selectors) {
                const linkElement = element.querySelector(selector);
                if (linkElement && linkElement.href) {
                    let link = linkElement.href;
                    
                    // Ensure it's a complete URL
                    if (link.startsWith('/')) {
                        link = 'https://shopee.tw' + link;
                    }
                    
                    // Validate it's a product URL
                    if (link.includes('/product/') || link.includes('-i.')) {
                        return link;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to get flagship item_url for product ${index}:`, error);
        }

        return null;
    }

    getFlagshipImg(element, index) {
        // Based on your field mapping: inset-y-0 src -> img
        try {
            const selectors = [
                'img[class*="inset-y-0"]',
                'img[src]',
                'div div a div div img',
                'a img'
            ];
            
            for (const selector of selectors) {
                const imgElement = element.querySelector(selector);
                if (imgElement) {
                    const src = imgElement.src || imgElement.getAttribute('src') || imgElement.getAttribute('data-src');
                    if (src && src.startsWith('http')) {
                        return src;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to get flagship img for product ${index}:`, error);
        }

        return null;
    }

    getFlagshipItemFromElement(element, index) {
        // Based on your field mapping: line-clamp-2 -> item
        try {
            // Focus on the specific class you mentioned
            const nameSelectors = [
                '[class*="line-clamp-2"]',
                '.line-clamp-2',
                'div[class*="line-clamp-2"]',
                // Fallback selectors
                'div[class*="break-words"]',
                'div[title]',
                'span[title]'
            ];

            for (const selector of nameSelectors) {
                try {
                    const nameElement = element.querySelector(selector);
                    if (nameElement) {
                        // Try different ways to get the text
                        let itemName = nameElement.textContent?.trim() || 
                                      nameElement.innerText?.trim() || 
                                      nameElement.getAttribute('title')?.trim() || 
                                      nameElement.getAttribute('alt')?.trim();
                        
                        if (itemName && itemName.length >= 10 && !itemName.includes('http')) {
                            // Clean up the name
                            itemName = itemName.replace(/\s+/g, ' ').trim();
                            
                            console.log(`Flagship product ${index} item from selector "${selector}":`, itemName);
                            return itemName;
                        }
                    }
                } catch (error) {
                    console.log(`Error with selector "${selector}":`, error.message);
                    continue;
                }
            }
            
            // If specific selectors fail, try to find any text content in the element
            console.log(`Trying to extract any text content from element ${index}...`);
            
            // Get all text-containing elements within this product element
            const textElements = element.querySelectorAll('div, span, a, p');
            for (const textEl of textElements) {
                const text = textEl.textContent?.trim();
                if (text && 
                    text.length >= 15 && 
                    text.length <= 200 && // Reasonable product name length
                    !text.includes('http') &&
                    !text.includes('NT$') &&
                    !text.includes('已售出') &&
                    !text.includes('評價') &&
                    !text.includes('免運') &&
                    !text.match(/^\d+$/) && // Not just numbers
                    text.split(' ').length >= 2) { // At least 2 words
                    
                    console.log(`Flagship product ${index} item from text content:`, text);
                    return text.replace(/\s+/g, ' ').trim();
                }
            }
            
            // Last resort: try to get from link href or any attribute
            const linkElement = element.querySelector('a[href]');
            if (linkElement) {
                const href = linkElement.href;
                // Try to extract product name from URL
                const urlMatch = href.match(/\/([^\/\?]+)(?:\?|$)/);
                if (urlMatch && urlMatch[1] && urlMatch[1].length > 10) {
                    const nameFromUrl = decodeURIComponent(urlMatch[1]).replace(/[-_]/g, ' ');
                    if (nameFromUrl.length >= 10) {
                        console.log(`Flagship product ${index} item from URL:`, nameFromUrl);
                        return nameFromUrl;
                    }
                }
            }
            
        } catch (error) {
            console.error(`Failed to get flagship item from element ${index}:`, error);
        }

        console.warn(`Flagship product ${index}: Cannot find item name from element`);
        return null;
    }

    getFlagshipTag(element, index) {
        // Based on your field mapping: mr-0 src -> tag
        try {
            const tagSelectors = [
                'img[class*="mr-0"]',
                'img[src*="shopee"]',
                'img[src*="badge"]',
                'img[src*="tag"]',
                'img[src*="label"]',
                'div div img[src*="modules"]'
            ];

            for (const selector of tagSelectors) {
                const tagImg = element.querySelector(selector);
                if (tagImg) {
                    const src = tagImg.src || tagImg.getAttribute('src') || tagImg.getAttribute('data-src');
                    if (src && src.startsWith('http') && (src.includes('shopee') || src.includes('badge') || src.includes('tag') || src.includes('modules'))) {
                        return src;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to get flagship tag for product ${index}:`, error);
        }

        return null;
    }

    getFlagshipShopId(element, index) {
        // Based on your field mapping: 875rem] href -> shop_id
        try {
            // Look for links with specific patterns that contain shop IDs
            const selectors = [
                'a[href*="shopid"]',
                'a[href*="find_similar_products"]',
                'a[class*="875rem"]',
                'a[href*="shop"]'
            ];
            
            for (const selector of selectors) {
                const links = element.querySelectorAll(selector);
                for (const link of links) {
                    const href = link.href;
                    const shopidMatch = href.match(/shopid=(\d+)/);
                    if (shopidMatch) {
                        return shopidMatch[1];
                    }
                }
            }
            
            // Fallback: check all links in element
            const allLinks = element.querySelectorAll('a[href]');
            for (const link of allLinks) {
                const href = link.href;
                if (href.includes('shopee.tw') && href.includes('shopid=')) {
                    const shopidMatch = href.match(/shopid=(\d+)/);
                    if (shopidMatch) {
                        return shopidMatch[1];
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to get flagship shop_id for product ${index}:`, error);
        }

        return null;
    }
}

// Initialize content script
if (typeof window !== 'undefined' && window.location.hostname === 'shopee.tw') {
    new ShopeeContentScript();
}

