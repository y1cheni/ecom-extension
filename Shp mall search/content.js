class ShopeeContentScript {
    constructor() {
        this.isActive = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.waitTime = 5000; // Wait time - increased for better page loading
        this.init();
    }

    init() {
        // Listen to messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });

        console.log('Shopee Content Script initialized');
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

            // Wait a bit for dynamic content
            await this.sleep(3000);

            // Check page content basics
            const hasBasicContent = document.body && document.body.innerHTML.length > 1000;
            console.log('Has basic content:', hasBasicContent, 'HTML length:', document.body.innerHTML.length);
            
            if (!hasBasicContent) {
                console.log('Page content too short, not ready');
                return false;
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

            // Check if product list container or no products message exists
            const productContainer = this.getProductContainer();
            const noProductsMsg = this.checkNoProductsMessage();
            
            console.log('Product container found:', !!productContainer);
            console.log('No products message found:', noProductsMsg);
            
            const isReady = hasBasicContent && hasShopeeElements;
            console.log('Page ready status:', isReady);
            
            return isReady;
        } catch (error) {
            console.error('Failed to check page ready status:', error);
            return false;
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
        console.log('Starting product data extraction...');
        
        // Wait for page to stabilize
        await this.scrollAndWait();
        
        const currentUrl = window.location.href;
        console.log('Current URL:', currentUrl);
        
        const urlInfo = this.parseUrlInfo(currentUrl);
        if (!urlInfo) {
            throw new Error('Unable to parse URL information');
        }
        console.log('URL info:', urlInfo);

        // First, try to extract products
        console.log('Attempting to extract products...');
        const products = await this.extractAllProducts(urlInfo);
        
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

    async getProductElements() {
        console.log('Searching for product elements...');
        
        // Wait a bit more for dynamic content to load
        await this.sleep(2000);
        
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
        } catch (error) {
            console.error('Failed to parse URL:', error);
            return null;
        }
    }

    async scrollAndWait() {
        // Slowly scroll page to ensure dynamic content loads
        const scrollHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollStep = Math.min(300, viewportHeight / 3);
        
        for (let y = 0; y < scrollHeight; y += scrollStep) {
            window.scrollTo(0, y);
            await this.sleep(100);
        }
        
        // Scroll back to top
        window.scrollTo(0, 0);
        
        // Wait for content to stabilize
        await this.sleep(this.waitTime);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize content script
if (typeof window !== 'undefined' && window.location.hostname === 'shopee.tw') {
    new ShopeeContentScript();
}
