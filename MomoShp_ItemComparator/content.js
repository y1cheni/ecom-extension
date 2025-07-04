(function() {
  // Extract page information
  function extractProductInfo() {
    console.log("Starting to extract product information...");
    
    // Get URL and product ID
    const url = window.location.href;
    let productId = "";
    const idMatch = url.match(/[?&]i_code=(\d+)/);
    
    if (idMatch && idMatch[1]) {
      productId = idMatch[1];
      console.log(`Found product ID: ${productId}`);
    } else {
      console.log("Product ID not found");
      return;
    }
    
    // Wait for page to load, then extract price and product name
    setTimeout(() => {
      let price = "";
      let productName = "";
      
      // Try to extract product name
      try {
        // Find elements with the largest font size that are NOT just numbers
        console.log("Attempting to find product name by font size (excluding numeric-only text)...");
        const textElements = document.querySelectorAll('h1, h2, h3, div, span, p');
        let maxFontSize = 0;
        let largestTextElement = null;
        
        // Check each element's computed font size
        textElements.forEach(element => {
          // Skip empty or very short texts
          const text = element.textContent.trim();
          if (!text || text.length < 5 || text.length > 200) return;
          
          // Skip elements that contain ONLY numbers, commas, or currency symbols
          const isNumericOnly = /^[$¥€£\d,.\s]+$/.test(text);
          if (isNumericOnly) {
            console.log(`Skipping numeric-only text: "${text}"`);
            return;
          }
          
          // Get computed style
          const style = window.getComputedStyle(element);
          const fontSize = parseFloat(style.fontSize);
          
          // Check if this is the largest font so far
          if (fontSize > maxFontSize) {
            // Make sure it's visible
            if (style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null) {
              maxFontSize = fontSize;
              largestTextElement = element;
            }
          }
        });
        
        // If we found an element with large font, use it
        if (largestTextElement && maxFontSize > 14) {  // Check if font is actually large (> 14px)
          productName = largestTextElement.textContent.trim();
          console.log(`Found product name by largest font size (${maxFontSize}px): ${productName}`);
        } else {
          console.log("Could not find suitable product name by font size");
          
          // Fallback: Common selectors for product names on MOMO but filter out numeric-only text
          const possibleNameSelectors = [
            'span.prdName', // Common product name selector
            'h1.prdName',   // Another common product name selector
            'h1.productDetail',  // Product detail page heading
            '.prdnoteArea h3',   // Some product pages have name in note area
            '.productNameArea h1', // Alternative name area
            '.productName'      // General product name class
          ];
          
          // Try each selector until we find the product name
          for (const selector of possibleNameSelectors) {
            const nameElement = document.querySelector(selector);
            if (nameElement && nameElement.textContent.trim()) {
              const text = nameElement.textContent.trim();
              // Skip elements that contain ONLY numbers, commas, or currency symbols
              const isNumericOnly = /^[$¥€£\d,.\s]+$/.test(text);
              if (!isNumericOnly) {
                productName = text;
                console.log(`Found product name using selector "${selector}": ${productName}`);
                break;
              } else {
                console.log(`Skipping numeric-only selector result: "${text}"`);
              }
            }
          }
          
          // If still not found, try to find the first h1 or h2 element that's not just numbers
          if (!productName) {
            const headings = document.querySelectorAll('h1, h2');
            for (const heading of headings) {
              const text = heading.textContent.trim();
              if (text && text.length > 5 && text.length < 200) {
                // Skip elements that contain ONLY numbers, commas, or currency symbols
                const isNumericOnly = /^[$¥€£\d,.\s]+$/.test(text);
                if (!isNumericOnly) {
                  productName = text;
                  console.log(`Found product name from heading: ${productName}`);
                  break;
                } else {
                  console.log(`Skipping numeric-only heading: "${text}"`);
                }
              }
            }
          }
          
          // If still not found, try meta tags
          if (!productName) {
            const metaTitle = document.querySelector('meta[property="og:title"]') || 
                             document.querySelector('meta[name="title"]');
            if (metaTitle && metaTitle.getAttribute("content")) {
              const text = metaTitle.getAttribute("content").trim();
              // Skip meta tags that contain ONLY numbers
              const isNumericOnly = /^[$¥€£\d,.\s]+$/.test(text);
              if (!isNumericOnly) {
                productName = text;
                console.log(`Found product name from meta tag: ${productName}`);
              } else {
                console.log(`Skipping numeric-only meta tag: "${text}"`);
              }
            }
          }
        }
        
        if (!productName) {
          console.log("Product name not found (or only numeric content found)");
        }
      } catch (e) {
        console.error("Error extracting product name:", e);
      }
      
      // First, try to find price using the text search near "元 賣貴通報"
      // This is the most accurate method as per requirements
      const fullText = document.body.innerText;
      const reportMatch = fullText.match(/([\d,]+)\s*元\s*賣貴通報/);
      if (reportMatch && reportMatch[1]) {
        price = reportMatch[1].replace(/,/g, '');
        console.log(`Found product price near "元 賣貴通報": ${price}`);
      } else {
        // If not found by specific marker, try common price elements
        // But avoid prices with $ sign
        const priceElements = document.querySelectorAll('span.price');
        if (priceElements.length > 0) {
          // Loop through price elements to find one without $ sign
          for (let i = 0; i < priceElements.length; i++) {
            let priceText = priceElements[i].textContent.trim();
            
            // Skip if it contains $ sign
            if (priceText.includes('$')) {
              continue;
            }
            
            // Extract price number (remove ",")
            const priceMatch = priceText.match(/[\d,]+/);
            if (priceMatch) {
              price = priceMatch[0].replace(/,/g, '');
              console.log(`Found product price from element: ${price}`);
              break;
            }
          }
        }
        
        // If still not found, try another common element
        if (!price) {
          const altPriceElement = document.querySelector('.special_price');
          if (altPriceElement) {
            let priceText = altPriceElement.textContent.trim();
            
            // Skip if it contains $ sign
            if (!priceText.includes('$')) {
              const priceMatch = priceText.match(/[\d,]+/);
              if (priceMatch) {
                price = priceMatch[0].replace(/,/g, '');
                console.log(`Found product price from alternative element: ${price}`);
              }
            }
          }
        }
        
        // Last resort: look for any price-like pattern
        if (!price) {
          // Using a general pattern to find prices (numbers followed by "元")
          // But excluding those with $ sign
          const pricePattern = /(?<!\$)([\d,]+)\s*元/g;
          let matches = [];
          let match;
          
          while ((match = pricePattern.exec(fullText)) !== null) {
            matches.push({
              price: match[1].replace(/,/g, ''),
              index: match.index
            });
          }
          
          if (matches.length > 0) {
            // Sort by index to find the earliest occurrence
            matches.sort((a, b) => a.index - b.index);
            price = matches[0].price;
            console.log(`Found product price using general pattern: ${price}`);
          } else {
            console.log("Product price not found");
          }
        }
      }
      
      // Save data
      saveProductData(productId, price, productName);
      
    }, 2000); // Wait 2 seconds to ensure page is fully loaded
  }
  
  // Save product data
  function saveProductData(productId, price, productName) {
    // Prepare data to save
    const productData = {
      id: productId,
      price: price,
      name: productName,
      timestamp: Date.now()
    };
    
    // Get existing data and add new data
    chrome.storage.local.get(['productData'], function(result) {
      let data = result.productData || {};
      
      // Update or add data - use productId as key
      data[productId] = productData;
      
      // Save to storage
      chrome.storage.local.set({ productData: data }, function() {
        console.log(`Product data saved successfully: ID=${productId}, Price=${price}, Name=${productName}`);
        
        // Send message to popup.js to update display
        chrome.runtime.sendMessage({ 
          action: "productDataUpdated", 
          data: productData 
        });
        
        // If price was found, close the tab automatically
        if (price) {
          console.log(`Price found (${price}), closing tab automatically...`);
          // Small delay to ensure data is saved properly
          setTimeout(() => {
            chrome.runtime.sendMessage({ 
              action: "closeCurrentTab"
            });
          }, 500);
        }
      });
    });
  }
  
  // Check if current page is an error page that should be closed
  function checkErrorPage() {
    const url = window.location.href;
    
    // Common MOMO error page patterns
    if (url.includes("Notice.jsp") || url.includes("EC404.html") || 
        document.title.includes("找不到") || document.title.includes("Not Found")) {
      console.log("Error page detected, closing tab...");
      chrome.runtime.sendMessage({ 
        action: "closeCurrentTab"
      });
      return true;
    }
    
    return false;
  }
  
  // Check if page is blank/empty and needs refresh
  function checkBlankPage() {
    // Check if page has minimal content
    const bodyContent = document.body.innerText.trim();
    const visibleElements = document.querySelectorAll('div, section, article, header, footer, p, h1, h2, h3, h4, h5, h6, span, img');
    
    if (bodyContent.length < 50 || visibleElements.length < 5) {
      console.log("Page appears to be blank or nearly empty, will refresh in 10 seconds...");
      setTimeout(() => {
        console.log("Refreshing blank page...");
        window.location.reload();
      }, 10000);
      return true;
    }
    
    return false;
  }
  
  // Main function
  function init() {
    console.log("MOMO price tracking script started");
    
    // First check if it's an error page that should be closed
    if (checkErrorPage()) {
      return; // Stop processing if it's an error page
    }
    
    // Then check if it's a blank page that needs refresh
    if (checkBlankPage()) {
      return; // Stop processing if it's a blank page (will refresh)
    }
    
    // Continue with normal processing
    if (window.location.href.includes("momoshop.com.tw/goods/GoodsDetail.jsp")) {
      console.log("MOMO product page detected");
      extractProductInfo();
    } else {
      console.log("Not a MOMO product page, script will not run");
    }
  }
  
  // Add event listener for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractProductInfo") {
      console.log("Received request to extract product info from popup");
      
      // Extract product info
      const url = window.location.href;
      if (url.includes("momoshop.com.tw/goods/GoodsDetail.jsp")) {
        console.log("MOMO product page detected, extracting info");
        // We don't need to re-run the entire extraction process
        // Just set a flag to indicate that this was manually requested
        // so we don't auto-close the tab
        sendResponse({success: true});
        
        // Wait for page to fully load then extract info
        setTimeout(() => {
          extractProductInfo();
        }, 500);
        
        return true; // Keep the message channel open for async response
      } else {
        console.log("Not a MOMO product page");
        sendResponse({success: false});
      }
    }
    return true; // Keep the message channel open for async response
  });
  
  // Start script
  init();
})(); 