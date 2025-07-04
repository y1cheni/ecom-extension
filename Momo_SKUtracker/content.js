(function() {
  console.log("MOMO brand data collector started");
  
  // Extract brand information
  function extractBrandInfo() {
    console.log("Starting to extract brand information...");
    
    // Extract brand name from URL as search keyword
    const url = window.location.href;
    const urlParams = new URLSearchParams(window.location.search);
    const searchKeyword = urlParams.get('keyword');
    
    if (!searchKeyword) {
      console.log("Search keyword not found");
      return;
    }
    
    console.log(`Search keyword: ${searchKeyword}`);
    
    // Wait for page to load before extracting brand count
    setTimeout(() => {
      let actualBrandName = "";  // Actual brand name extracted from page
      let brandCount = "";
      
      try {
        // Search for "brand" related information on page
        const pageText = document.body.innerText;
        console.log("Searching for brand information...");
        
        // Fuzzy matching function - Check if two brand names are similar
        function isSimilarBrand(keyword, foundBrand) {
          // Remove spaces and special characters for comparison
          const cleanKeyword = keyword.replace(/[\s+\-_]/g, '').toLowerCase();
          const cleanFoundBrand = foundBrand.replace(/[\s+\-_]/g, '').toLowerCase();
          
          // Exact match
          if (cleanKeyword === cleanFoundBrand) return true;
          
          // Contains relationship
          if (cleanKeyword.includes(cleanFoundBrand) || cleanFoundBrand.includes(cleanKeyword)) return true;
          
          // Handle mixed English and Chinese cases
          // Extract and compare English and Chinese parts separately
          const keywordEn = keyword.match(/[a-zA-Z]+/g)?.join('').toLowerCase() || '';
          const keywordCn = keyword.match(/[\u4e00-\u9fff]+/g)?.join('') || '';
          const foundEn = foundBrand.match(/[a-zA-Z]+/g)?.join('').toLowerCase() || '';
          const foundCn = foundBrand.match(/[\u4e00-\u9fff]+/g)?.join('') || '';
          
          // English part matching
          if (keywordEn && foundEn && (keywordEn === foundEn || keywordEn.includes(foundEn) || foundEn.includes(keywordEn))) {
            return true;
          }
          
          // Chinese part matching
          if (keywordCn && foundCn && (keywordCn === foundCn || keywordCn.includes(foundCn) || foundCn.includes(keywordCn))) {
            return true;
          }
          
          return false;
        }
        
        // Method 1: Search all matches related to "品牌" (brand)
        const brandRegex = /品牌[^旗]*?([^()]+)\s*\((\d+)\)/g;
        let matches = [];
        let match;
        
        while ((match = brandRegex.exec(pageText)) !== null) {
          const foundBrandName = match[1].trim();
          const count = match[2];
          
          if (isSimilarBrand(searchKeyword, foundBrandName)) {
            matches.push({
              brandName: foundBrandName,
              count: count,
              index: match.index
            });
            console.log(`Found matching brand: "${foundBrandName}" (${count})`);
          }
        }
        
        // Method 2: If not found, try broader search
        if (matches.length === 0) {
          const generalRegex = /([^()（）]+)\s*[()（](\d+)[)）]/g;
          while ((match = generalRegex.exec(pageText)) !== null) {
            const foundBrandName = match[1].trim();
            const count = match[2];
            
            // Ensure this match appears in brand-related context
            const contextStart = Math.max(0, match.index - 50);
            const contextEnd = Math.min(pageText.length, match.index + match[0].length + 50);
            const context = pageText.substring(contextStart, contextEnd);
            
            if (context.includes('品牌') && !context.includes('品牌旗舰馆') && 
                isSimilarBrand(searchKeyword, foundBrandName)) {
              matches.push({
                brandName: foundBrandName,
                count: count,
                index: match.index
              });
              console.log(`Found matching brand through broad search: "${foundBrandName}" (${count})`);
            }
          }
        }
        
        // Method 3: Search in filter area
        if (matches.length === 0) {
          const filterElements = document.querySelectorAll('.filterArea, .brandFilter, .leftFilter, .sideFilter, [class*="filter"], [class*="brand"]');
          for (let filterElement of filterElements) {
            const filterText = filterElement.innerText || filterElement.textContent;
            if (!filterText) continue;
            
            const filterRegex = /([^()（）]+)\s*[()（](\d+)[)）]/g;
            while ((match = filterRegex.exec(filterText)) !== null) {
              const foundBrandName = match[1].trim();
              const count = match[2];
              
              if (isSimilarBrand(searchKeyword, foundBrandName)) {
                matches.push({
                  brandName: foundBrandName,
                  count: count,
                  index: 0
                });
                console.log(`Found matching brand in filter area: "${foundBrandName}" (${count})`);
                break;
              }
            }
            if (matches.length > 0) break;
          }
        }
        
        // Select best match result (if multiple matches, select first one)
        if (matches.length > 0) {
          // Sort by index, select earliest occurrence
          matches.sort((a, b) => a.index - b.index);
          actualBrandName = matches[0].brandName;
          brandCount = matches[0].count;
          console.log(`Final selected brand: "${actualBrandName}" (${brandCount})`);
        } else {
          console.log("No matching brand information found");
          // If nothing found, use original search keyword
          actualBrandName = searchKeyword;
          console.log("Page text fragment:", pageText.substring(0, 1000));
        }
        
      } catch (e) {
        console.error("Error occurred while extracting brand information:", e);
        actualBrandName = searchKeyword;  // Use search keyword when error occurs
      }
      
      // Save data - use actual extracted brand name
      saveBrandData(actualBrandName, brandCount, searchKeyword);
      
    }, 3000); // Wait 3 seconds to ensure page is fully loaded
  }
  
  // Save brand data
  function saveBrandData(actualBrandName, brandCount, searchKeyword) {
    const brandData = {
      brandName: actualBrandName,  // Actual extracted brand name
      brandCount: brandCount,
      searchKeyword: searchKeyword || actualBrandName,  // Original search keyword
      timestamp: Date.now(),
      url: window.location.href
    };
    
    // Get existing data and add new data
    chrome.storage.local.get(['brandData'], function(result) {
      let data = result.brandData || [];
      
      // Check if data for same brand already exists (prioritize URL match, then brand name or search keyword)
      const currentUrl = window.location.href;
      const existingIndex = data.findIndex(item => 
        item.url === currentUrl ||
        item.brandName === actualBrandName || 
        item.searchKeyword === searchKeyword ||
        item.brandName === searchKeyword
      );
      
      if (existingIndex !== -1) {
        // Keep original batch order and other information
        const originalItem = data[existingIndex];
        data[existingIndex] = {
          ...originalItem,
          ...brandData,
          batchOrder: originalItem.batchOrder,  // Keep original batch order
          status: brandCount ? 'Completed' : 'No data found'
        };
        console.log(`Updated brand data: ${actualBrandName} (search term: ${searchKeyword}) - ${brandCount}`);
      } else {
        data.push({
          ...brandData,
          status: brandCount ? 'Completed' : 'No data found'
        });
        console.log(`Added new brand data: ${actualBrandName} (search term: ${searchKeyword}) - ${brandCount}`);
      }
      
      // Save to storage
      chrome.storage.local.set({ brandData: data }, function() {
        console.log(`Brand data saved successfully: Brand=${actualBrandName}, Count=${brandCount}`);
        
        // Send message to popup to update display
        chrome.runtime.sendMessage({ 
          action: "brandDataUpdated", 
          data: brandData 
        });
        
        // If count was found, auto-close tab
        if (brandCount) {
          console.log(`Found brand count (${brandCount}), auto-closing tab in 3 seconds...`);
          setTimeout(() => {
            chrome.runtime.sendMessage({ 
              action: "closeCurrentTab"
            });
          }, 3000);
        }
      });
    });
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "extractBrandInfo") {
      console.log("Received popup request to extract brand info");
      
      const url = window.location.href;
      if (url.includes("momoshop.com.tw/search/searchShop.jsp")) {
        console.log("Detected MOMO search page, extracting brand info");
        sendResponse({success: true});
        
        setTimeout(() => {
          extractBrandInfo();
        }, 500);
        
        return true;
      } else {
        console.log("Not a MOMO search page");
        sendResponse({success: false});
      }
    }
    return true;
  });
  
  // Initialize function
  function init() {
    console.log("MOMO brand data collection script started");
    
    // Check if it's a search page
    if (window.location.href.includes("momoshop.com.tw/search/searchShop.jsp")) {
      console.log("Detected MOMO search page");
      extractBrandInfo();
    } else {
      console.log("Not a MOMO search page, script will not run");
    }
  }
  
  // Start script
  init();
})(); 