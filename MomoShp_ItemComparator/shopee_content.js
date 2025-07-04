(function() {
  // Listen for messages from popup.js
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractShopeeProductInfo") {
      console.log("Received request to extract Shopee product info");
      
      // Extract and save product info
      const productInfo = extractShopeeProductInfo();
      
      if (productInfo) {
        // Send product info to background.js for saving
        chrome.runtime.sendMessage({
          action: "saveShopeeProductInfo",
          data: productInfo
        }, function(response) {
          if (response && response.status === "success") {
            console.log("Successfully saved Shopee product data:", productInfo);
            sendResponse({success: true});
          } else {
            console.error("Error saving Shopee product data:", response);
            sendResponse({success: false});
          }
        });
        return true; // Keep the message channel open for async response
      } else {
        console.error("Failed to extract Shopee product info");
        sendResponse({success: false});
      }
    }
    return true; // Keep the message channel open for async response
  });

  // Extract product information automatically when visiting a Shopee product page
  function checkAndExtractProductInfo() {
    // Check if the current page is a Shopee product detail page (支持两种URL格式)
    const url = window.location.href;
    
    // 支持两种格式:
    // 1. https://shopee.tw/product-i.106973794.25810943488 (传统格式)
    // 2. https://shopee.tw/product/71029966/26175512428 (新格式)
    const isShopeeProduct = 
      (url.includes('shopee.tw/') && url.match(/\.\d+\.\d+$/)) || // 传统格式
      (url.includes('shopee.tw/product/') && url.match(/\/product\/\d+\/\d+/)); // 新格式
    
    if (isShopeeProduct) {
      console.log("Shopee product page detected. Extracting information...");
      
      // Wait for page to load completely
      setTimeout(function() {
        const productInfo = extractShopeeProductInfo();
        
        if (productInfo) {
          // Send product info to background.js for saving
          chrome.runtime.sendMessage({
            action: "saveShopeeProductInfo",
            data: productInfo
          }, function(response) {
            if (response && response.status === "success") {
              console.log("Successfully saved Shopee product data automatically:", productInfo);
              
              // If price was found, close the tab automatically after data is saved
              if (productInfo.price) {
                console.log(`Shopee price found (${productInfo.price}), closing tab automatically...`);
                // Small delay to ensure data is saved properly
                setTimeout(() => {
                  chrome.runtime.sendMessage({ 
                    action: "closeCurrentTab"
                  });
                }, 500);
              }
            } else {
              console.error("Error automatically saving Shopee product data:", response);
            }
          });
        } else {
          console.error("Failed to automatically extract Shopee product info");
        }
      }, 3000); // 3 second delay to ensure page is loaded (Shopee uses SPA with lazy loading)
    }
  }

  // Extract product information from the current Shopee page
  function extractShopeeProductInfo() {
    console.log("Extracting Shopee product information...");
    
    try {
      // Get product URL
      const url = window.location.href;
      
      // Extract the product TID from URL
      // 支持两种格式:
      // 1. https://shopee.tw/product-i.106973794.25810943488 (传统格式)
      // 2. https://shopee.tw/product/71029966/26175512428 (新格式)
      let tid = null;
      
      // 尝试匹配传统格式 i.xxx.yyy 中的yyy
      const formatOneMatch = url.match(/\.(\d+)\.(\d+)$/);
      if (formatOneMatch) {
        tid = formatOneMatch[2]; // 第二个捕获组是TID
        console.log("Found Shopee TID from format 1:", tid);
      } 
      // 尝试匹配新格式 product/xxx/yyy 中的yyy
      else {
        const formatTwoMatch = url.match(/\/product\/\d+\/(\d+)/);
        if (formatTwoMatch) {
          tid = formatTwoMatch[1]; // 第一个捕获组是TID
          console.log("Found Shopee TID from format 2:", tid);
        } else {
          console.error("Could not find Shopee TID in URL");
          return null;
        }
      }
      
      console.log("Using Shopee TID:", tid);
      
      // --------------- PRODUCT NAME EXTRACTION ---------------
      let name = null;
      
      // Method 1: Find product name above "匿名檢舉商品" text
      console.log("Trying to find product name above '匿名檢舉商品'...");
      
      // Get the entire page HTML
      const pageHtml = document.documentElement.innerHTML;
      
      // Find the position of "匿名檢舉商品"
      const reportIndex = pageHtml.indexOf("匿名檢舉商品");
      
      if (reportIndex !== -1) {
        console.log("Found '匿名檢舉商品' at position", reportIndex);
        
        // 1. Look for h1 elements above the "匿名檢舉商品" marker
        const h1Elements = document.querySelectorAll('h1');
        let productH1 = null;
        
        for (const h1 of h1Elements) {
          const h1Text = h1.textContent.trim();
          // Skip short h1 or those containing only numbers
          if (h1Text.length < 10 || /^[\d\s,.$]+$/.test(h1Text)) {
            continue;
          }
          
          // Check if this h1 appears before "匿名檢舉商品"
          const h1Position = pageHtml.indexOf(h1Text);
          if (h1Position !== -1 && h1Position < reportIndex) {
            productH1 = h1Text;
            console.log("Found h1 product name above 匿名檢舉商品:", productH1);
            break;
          }
        }
        
        if (productH1) {
          name = productH1;
        } else {
          // 2. Look for the largest text element above "匿名檢舉商品"
          console.log("No h1 found, looking for largest text element above 匿名檢舉商品");
          
          // Get all text nodes in the page that appear before "匿名檢舉商品"
          const allElements = document.querySelectorAll('div, span, p, h2, h3, h4, h5');
          let largestText = "";
          
          for (const el of allElements) {
            const text = el.textContent.trim();
            // Skip too short texts, those with URLs, or those with only numbers/symbols
            if (text.length < 15 || 
                text.includes("http") || 
                text.includes(".jpg") || 
                text.includes(".png") ||
                text.includes("<img") ||
                text.includes("蝦皮購物") ||
                text.includes("花得更少") ||
                /^[\d\s,.$]+$/.test(text)) {
              continue;
            }
            
            // Check if the element is above "匿名檢舉商品"
            const textPosition = pageHtml.indexOf(text);
            if (textPosition !== -1 && textPosition < reportIndex && text.length > largestText.length) {
              largestText = text;
            }
          }
          
          if (largestText) {
            name = largestText;
            console.log("Found largest text element above 匿名檢舉商品:", name);
          }
        }
      }
      
      // Method 2: Look for elements with specific class names that typically contain product name
      if (!name) {
        console.log("Looking for product name in specific class elements...");
        
        // Common Shopee class names for product titles (these change periodically)
        const productTitleClasses = [
          '.K1dDgL', // Common product title class
          '.VCNVHn', // Another product title class
          '.product-briefing .product-title',
          'h1.styles__ProductTitle',
          '.product-detail-page h1',
          '.product-detail-page h2',
          '.product-page h1',
          'div[class*="product-title"]',
          'div[class*="product-name"]',
          'div[class*="title"]'
        ];
        
        // Try each selector
        for (const selector of productTitleClasses) {
          try {
            const elements = document.querySelectorAll(selector);
            
            for (const el of elements) {
              const text = el.textContent.trim();
              // Skip if text is too short or contains specific patterns we want to exclude
              if (text.length < 15 || 
                  text.includes("http") || 
                  text.includes(".jpg") ||
                  text.includes("蝦皮購物") ||
                  text.includes("花得更少")) {
                continue;
              }
              
              name = text;
              console.log(`Found product name using selector "${selector}":`, name);
              break;
            }
            
            if (name) break;
          } catch (e) {
            console.log(`Error with selector ${selector}:`, e);
          }
        }
      }
      
      // Method 3: Extract from page title as last resort
      if (!name) {
        const pageTitle = document.title;
        if (pageTitle && pageTitle.length > 10 && 
            !pageTitle.includes("蝦皮購物") && 
            !pageTitle.includes("花得更少")) {
          // Remove site name from title if present
          name = pageTitle.split(' | ')[0].trim();
          console.log("Extracted product name from page title:", name);
        }
      }
      
      // --------------- PRICE EXTRACTION ---------------
      // Finding price near "匿名檢舉商品" text - 這是更可靠的方法
      let price = null;
      console.log("優先搜索靠近'匿名檢舉商品'文字的紅色大字體價格...");
      
      // 重用前面已定义的reportIndex变量
      if (reportIndex !== -1) {
        console.log("找到'匿名檢舉商品'位置:", reportIndex);
        
        // 獲取附近所有元素（向上查找10000個字符範圍内的元素）
        // 首先提取包含"匿名檢舉商品"位置前後的HTML片段
        const startPos = Math.max(0, reportIndex - 10000);
        const endPos = Math.min(pageHtml.length, reportIndex + 1000);
        const nearbyHtml = pageHtml.substring(startPos, endPos);
        
        // 創建臨時DIV來解析這段HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nearbyHtml;
        
        // 尋找包含$符號的元素
        const priceElements = [];
        const walkNodes = function(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.includes('$')) {
              priceElements.push(node);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (let i = 0; i < node.childNodes.length; i++) {
              walkNodes(node.childNodes[i]);
            }
          }
        };
        
        walkNodes(tempDiv);
        console.log(`在"匿名檢舉商品"附近找到 ${priceElements.length} 個包含$的文本節點`);
        
        // 從這些元素中找出紅色且字體大的價格
        const candidatePrices = [];
        
        for (const el of priceElements) {
          const parentNode = el.parentNode;
          if (!parentNode) continue;
          
          // 檢查文本內容是否符合價格格式: $數字
          const text = el.textContent.trim();
          const priceMatch = text.match(/\$\s*([\d,]+)/);
          
          if (priceMatch && priceMatch[1]) {
            const rawPrice = priceMatch[1];
            const numericPrice = rawPrice.replace(/,/g, '');
            
            // 找到價格元素在實際DOM中的對應元素
            let actualNode = null;
            
            // 用內容匹配查找實際元素
            const textNodes = [];
            const docWalker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              { acceptNode: (node) => node.textContent.includes(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT },
              false
            );
            
            while (docWalker.nextNode()) {
              textNodes.push(docWalker.currentNode);
            }
            
            if (textNodes.length > 0) {
              actualNode = textNodes[0].parentNode;
            }
            
            if (actualNode) {
              // 獲取樣式
              const style = window.getComputedStyle(actualNode);
              const fontSize = parseInt(style.fontSize, 10) || 0;
              const color = style.color.toLowerCase();
              
              // 檢查是否為紅色
              const isRed = color.includes('rgb(255') || // 包含紅色
                          color.includes('rgb(238, 77, 45)') || // shopee橙紅色
                          color.includes('rgb(255, 66, 79)') || // shopee紅色
                          color.includes('#f53d2d') || // shopee十六進制紅色
                          color.includes('#ee4d2d');  // shopee十六進制橙紅色
              
              // 計算距離"匿名檢舉商品"的距離
              const nodeRect = actualNode.getBoundingClientRect();
              // 尋找匿名檢舉商品的元素
              const reportElements = [];
              const reportWalker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                { acceptNode: (node) => node.textContent.includes("匿名檢舉商品") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT },
                false
              );
              
              while (reportWalker.nextNode()) {
                reportElements.push(reportWalker.currentNode);
              }
              
              let minDistance = Infinity;
              if (reportElements.length > 0) {
                const reportRect = reportElements[0].parentNode.getBoundingClientRect();
                // 計算元素中心點之間的距離
                const dx = (nodeRect.left + nodeRect.width/2) - (reportRect.left + reportRect.width/2);
                const dy = (nodeRect.top + nodeRect.height/2) - (reportRect.top + reportRect.height/2);
                minDistance = Math.sqrt(dx*dx + dy*dy);
              }
              
              candidatePrices.push({
                price: numericPrice,
                rawPrice: rawPrice,
                fontSize: fontSize,
                isRed: isRed,
                distance: minDistance,
                node: actualNode
              });
              
              console.log(`找到價格候選: $${rawPrice}, 字體大小: ${fontSize}px, ${isRed ? '是' : '不是'}紅色, 距離: ${minDistance.toFixed(0)}px`);
            }
          }
        }
        
        // 根據條件排序候選價格
        // 1. 紅色優先
        // 2. 字體大的優先
        // 3. 距離近的優先
        candidatePrices.sort((a, b) => {
          // 紅色優先
          if (a.isRed && !b.isRed) return -1;
          if (!a.isRed && b.isRed) return 1;
          
          // 字體大的優先
          if (a.fontSize > b.fontSize) return -1;
          if (a.fontSize < b.fontSize) return 1;
          
          // 距離近的優先
          return a.distance - b.distance;
        });
        
        // 選擇最佳候選
        if (candidatePrices.length > 0) {
          price = candidatePrices[0].price; // 純數字價格，無逗號
          console.log(`選擇最佳價格: $${candidatePrices[0].rawPrice} => ${price}`);
        }
      }
      
      // 如果沒找到價格，嘗試其他方法（保留原有的備用方法）
      if (!price) {
        console.log("未在'匿名檢舉商品'附近找到價格，嘗試其他方法...");
        
        // Finding price near "已售出" text
        console.log("Searching for price near '已售出' text...");
        
        // Find the element containing "已售出"
        const soldTextNodes = [];
        const soldRegex = /已售出/;
        
        // Get all text nodes with "已售出"
        const textWalker = document.createTreeWalker(
          document.body, 
          NodeFilter.SHOW_TEXT, 
          null, 
          false
        );
        
        while (textWalker.nextNode()) {
          const node = textWalker.currentNode;
          if (soldRegex.test(node.textContent)) {
            soldTextNodes.push(node);
          }
        }
        
        console.log(`Found ${soldTextNodes.length} nodes containing '已售出'`);
        
        // For each "已售出" text node, look for a nearby price
        for (const soldNode of soldTextNodes) {
          if (price) break; // Stop if we already found a price
          
          // Get parent and siblings of the sold node
          let parentNode = soldNode.parentNode;
          
          // Check parent and up to 3 levels up
          for (let i = 0; i < 3 && parentNode; i++) {
            // Look for price in this node and its siblings
            const priceNodes = findPriceNodesNear(parentNode);
            
            if (priceNodes.length > 0) {
              // Get the price value from the first price node
              const priceText = priceNodes[0].textContent.trim();
              const priceMatch = priceText.match(/\$\s*([\d,]+)/);
              
              if (priceMatch && priceMatch[1]) {
                price = priceMatch[1].replace(/,/g, '');
                console.log(`Found price near '已售出': $${price}`);
                break;
              }
            }
            
            // Move up to parent
            parentNode = parentNode.parentNode;
          }
        }
        
        // If no price found near "已售出", try to find red price
        if (!price) {
          console.log("No price found near '已售出', looking for red price...");
          
          // Find all elements with $ sign
          const priceElements = [];
          
          // Get all text nodes with $ sign
          const priceWalker = document.createTreeWalker(
            document.body, 
            NodeFilter.SHOW_TEXT, 
            null, 
            false
          );
          
          while (priceWalker.nextNode()) {
            const node = priceWalker.currentNode;
            if (node.textContent.includes('$')) {
              priceElements.push(node.parentNode);
            }
          }
          
          // Check each price element for red color
          for (const el of priceElements) {
            const style = window.getComputedStyle(el);
            const color = style.color.toLowerCase();
            
            // Check for red color
            const isRed = color.includes('rgb(255') || // includes red
                          color.includes('rgb(238, 77, 45)') || // shopee orange-red
                          color.includes('rgb(255, 66, 79)') || // shopee red
                          color.includes('#f53d2d') || // shopee hex red
                          color.includes('#ee4d2d');  // shopee hex orange-red
            
            if (isRed) {
              const text = el.textContent.trim();
              const priceMatch = text.match(/\$\s*([\d,]+)/);
              
              if (priceMatch && priceMatch[1]) {
                price = priceMatch[1].replace(/,/g, '');
                console.log(`Found red price: $${price}`);
                break;
              }
            }
          }
        }
        
        // Last resort - try common price selectors
        if (!price) {
          console.log("尝试使用常见价格选择器查找价格...");
          const priceSelectors = [
            '.product-briefing .product-price',
            '.product-briefing .price',
            '[data-testid="price"]',
            'div._44qnta',
            'span.YPqix5',
            // 添加新的选择器，适应最新的Shopee界面
            'div.eDeBhN',
            'div.Ybrg9j',
            'div.pqTWkA',
            'div.MITExd',
            // 更通用的价格选择器
            'div[class*="price"]',
            'span[class*="price"]'
          ];
          
          for (const selector of priceSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              
              for (const el of elements) {
                const text = el.textContent;
                
                if (text && text.includes('$')) {
                  const priceMatch = text.match(/\$\s*([\d,]+)/);
                  
                  if (priceMatch && priceMatch[1]) {
                    price = priceMatch[1].replace(/,/g, '');
                    console.log(`找到价格使用选择器 "${selector}": $${price}`);
                    break;
                  }
                }
              }
            } catch (e) {
              console.log(`尝试选择器 ${selector} 时出错:`, e);
            }
            
            if (price) break;
          }
        }
        
        // 新增方法：直接搜索页面中最大的价格数字
        if (!price) {
          console.log("尝试查找页面中最大的价格数字...");
          
          // 获取所有包含$符号的文本节点
          const dollarNodes = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function(node) {
                return node.textContent.includes('$') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
              }
            },
            false
          );
          
          while (walker.nextNode()) {
            dollarNodes.push(walker.currentNode);
          }
          
          console.log(`找到 ${dollarNodes.length} 个包含$符号的文本节点`);
          
          // 从所有包含$的节点中提取价格，并按价格值排序
          const priceMatches = [];
          for (const node of dollarNodes) {
            const text = node.textContent.trim();
            const matches = text.match(/\$\s*([\d,]+)/g);
            
            if (matches) {
              for (const match of matches) {
                const priceValue = match.replace(/\$|\s|,/g, '');
                if (priceValue && !isNaN(parseInt(priceValue, 10))) {
                  priceMatches.push({
                    value: parseInt(priceValue, 10),
                    text: priceValue,
                    node: node
                  });
                }
              }
            }
          }
          
          // 按可能性排序价格匹配项（价格通常是3位或更多数字，且通常是页面上较大的数字）
          priceMatches.sort((a, b) => {
            // 优先考虑3位及以上数字（典型价格范围）
            const aIsLikelyPrice = a.text.length >= 3;
            const bIsLikelyPrice = b.text.length >= 3;
            
            if (aIsLikelyPrice && !bIsLikelyPrice) return -1;
            if (!aIsLikelyPrice && bIsLikelyPrice) return 1;
            
            // 其次，价格通常是页面上较大的数字（但不是太大）
            // 筛选100-100000范围的价格
            const aInRange = a.value >= 100 && a.value <= 100000;
            const bInRange = b.value >= 100 && b.value <= 100000;
            
            if (aInRange && !bInRange) return -1;
            if (!aInRange && bInRange) return 1;
            
            // 最后，查看节点的样式，红色或较大字体的通常是价格
            const aStyle = window.getComputedStyle(a.node.parentNode);
            const bStyle = window.getComputedStyle(b.node.parentNode);
            
            const aFontSize = parseInt(aStyle.fontSize, 10) || 0;
            const bFontSize = parseInt(bStyle.fontSize, 10) || 0;
            
            // 字体较大的可能是价格
            if (aFontSize > bFontSize) return -1;
            if (aFontSize < bFontSize) return 1;
            
            // 否则按数值大小排序（合理的价格通常不会太高）
            return a.value - b.value;
          });
          
          if (priceMatches.length > 0) {
            // 选择排序后的第一个匹配项作为价格
            price = priceMatches[0].text;
            console.log(`从页面文本中找到可能的价格: $${price}`);
            
            // 记录找到的所有价格供参考
            console.log("所有可能的价格匹配:", priceMatches.map(p => `$${p.text}`).join(', '));
          }
        }
        
        // 最后一种方法：使用meta标签
        if (!price) {
          console.log("尝试从meta标签中提取价格...");
          const metaPrice = document.querySelector('meta[property="product:price:amount"]') || 
                            document.querySelector('meta[property="og:price:amount"]');
          
          if (metaPrice && metaPrice.getAttribute("content")) {
            const metaPriceValue = metaPrice.getAttribute("content").trim();
            if (metaPriceValue && !isNaN(parseInt(metaPriceValue, 10))) {
              price = metaPriceValue;
              console.log(`从meta标签中找到价格: $${price}`);
            }
          }
        }
      }
      
      // Build product info object
      const productInfo = {
        url: url,
        id: tid,
        name: name || "Unknown Product",
        price: price || ""
      };
      
      console.log("Extracted Shopee product info:", productInfo);
      return productInfo;
    } 
    catch (error) {
      console.error("Error extracting Shopee product info:", error);
      return null;
    }
  }
  
  // Helper function to find price nodes near a given node
  function findPriceNodesNear(node) {
    const priceNodes = [];
    
    // Check the node itself
    if (node.textContent.includes('$')) {
      priceNodes.push(node);
    }
    
    // Check siblings
    let sibling = node.previousSibling;
    while (sibling && priceNodes.length < 3) {
      if (sibling.textContent && sibling.textContent.includes('$')) {
        priceNodes.push(sibling);
      }
      sibling = sibling.previousSibling;
    }
    
    sibling = node.nextSibling;
    while (sibling && priceNodes.length < 3) {
      if (sibling.textContent && sibling.textContent.includes('$')) {
        priceNodes.push(sibling);
      }
      sibling = sibling.nextSibling;
    }
    
    // Check children
    const children = node.childNodes;
    for (let i = 0; i < children.length && priceNodes.length < 3; i++) {
      if (children[i].textContent && children[i].textContent.includes('$')) {
        priceNodes.push(children[i]);
      }
    }
    
    return priceNodes;
  }
  
  // Run when page loads
  checkAndExtractProductInfo();
})(); 