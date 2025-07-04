// Background script handles tab management
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background received message:", request);
  
  if (request.action === "closeCurrentTab" && sender.tab) {
    console.log("Closing tab:", sender.tab.id);
    chrome.tabs.remove(sender.tab.id);
  }
  
  if (request.action === "brandDataUpdated") {
    console.log("Brand data updated:", request.data);
    // Additional processing logic can be added here
  }
  
  return true;
}); 