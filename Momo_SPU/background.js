// 背景服務腳本
class MomoBackground {
    constructor() {
        this.init();
    }
    
    init() {
        // 監聽安裝事件
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Momo 商品搜尋助手已安裝');
            
            if (details.reason === 'install') {
                // 首次安裝時的初始化
                this.showWelcomeNotification();
            }
        });
        
        // 監聽來自 popup 和 content script 的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持消息通道開放
        });
        
        // 監聽分頁更新事件
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && 
                tab.url && 
                tab.url.includes('momoshop.com.tw/search/searchShop.jsp')) {
                console.log('Momo 搜尋頁面載入完成:', tab.url);
            }
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'GET_ACTIVE_TAB':
                this.getActiveTab().then(sendResponse);
                break;
                
            case 'OPEN_SEARCH_PAGE':
                this.openSearchPage(message.url).then(sendResponse);
                break;
                
            default:
                // 轉發消息到所有相關的接收者
                this.forwardMessage(message, sender);
                break;
        }
    }
    
    async getActiveTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return { success: true, tab: tab };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async openSearchPage(url) {
        try {
            const tab = await chrome.tabs.create({ url: url, active: false });
            return { success: true, tabId: tab.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    forwardMessage(message, sender) {
        // 轉發消息到其他上下文
        if (sender.tab) {
            // 來自 content script，轉發到 popup
            chrome.runtime.sendMessage(message).catch(() => {
                // popup 可能未開啟，忽略錯誤
            });
        } else {
            // 來自 popup，可能需要轉發到特定分頁
            // 這裡可以根據需要實現特定的轉發邏輯
        }
    }
    
    showWelcomeNotification() {
        // 可以在這裡顯示歡迎通知或打開說明頁面
        console.log('歡迎使用 Momo 商品搜尋助手！');
    }
}

// 初始化背景腳本
new MomoBackground(); 