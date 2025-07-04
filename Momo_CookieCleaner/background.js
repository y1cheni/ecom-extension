// Initialize cookie cleanup count (background service worker is non-persistent, so use storage for persistence)
let cookieCleanedCount = 0;

// Check when tab update status becomes complete
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.includes("momoshop.com.tw")) {
    // Set cookie threshold: trigger cleanup if current page cookie count exceeds this value
    const COOKIE_THRESHOLD = 5;

    // Get all cookies for the specified URL
    chrome.cookies.getAll({ url: tab.url }, (cookies) => {
      if (cookies.length > COOKIE_THRESHOLD) {
        console.log(`Detected ${cookies.length} cookies, exceeding threshold ${COOKIE_THRESHOLD}, starting cleanup.`);

        cookies.forEach(cookie => {
          // Construct cookie URL (note: need to remove dot prefix from domain)
          let cookieUrl = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain.replace(/^\./, "") + cookie.path;
          chrome.cookies.remove({ url: cookieUrl, name: cookie.name }, (result) => {
            if (result) {
              console.log(`Removed cookie: ${cookie.name}`);
              cookieCleanedCount += 1;
              // Update count in storage
              chrome.storage.local.set({ cookieCleanedCount: cookieCleanedCount });
            } else {
              console.log(`Failed to remove cookie: ${cookie.name}`);
            }
          });
        });
      }
    });
  }
});
