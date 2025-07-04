// Update cookie cleanup count displayed in popup
function updateCookieCount() {
    chrome.storage.local.get("cookieCleanedCount", (data) => {
      const count = data.cookieCleanedCount || 0;
      document.getElementById("cookieCount").textContent = count;
    });
  }
  
  // Update display values when popup opens
  document.addEventListener("DOMContentLoaded", () => {
    updateCookieCount();
  
    // Click "Reset Counter" button to reset count to 0
    document.getElementById("resetBtn").addEventListener("click", () => {
      chrome.storage.local.set({ cookieCleanedCount: 0 }, () => {
        updateCookieCount();
      });
    });
  });
  