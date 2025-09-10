# 進階調試指南 - 修正商品抓取問題

## 已修正的問題

### 1. **頁面載入等待時間不足**
- ✅ 增加頁面等待時間：2秒 → 5秒
- ✅ 改善頁面準備檢查邏輯
- ✅ 增加更長的超時時間：30秒 → 60秒

### 2. **商品元素選擇器不夠全面**
- ✅ 增加10+種不同的選擇器
- ✅ 添加產品連結驗證邏輯
- ✅ 包含更廣泛的備用搜尋方式

### 3. **檢測邏輯順序錯誤**
- ✅ 改變檢測順序：先抓取商品，再檢查無商品訊息
- ✅ 避免過早觸發無商品檢測

## 新的調試流程

### 1. 開啟Chrome開發者工具
1. 按F12打開開發者工具
2. 切換到**Console**標籤
3. 清空控制台（右鍵 → Clear Console）

### 2. 重新載入插件
1. 進入 `chrome://extensions/`
2. 找到插件點擊🔄重新載入
3. 關閉所有Shopee標籤頁

### 3. 開始抓取並監控日誌

#### **預期看到的正常流程：**
```
Starting to process URL: https://shopee.tw/mall/search?...
Processing page 1 with URL: ...page=0...
Waiting for page to be ready, timeout: 60000ms
Checking if page is ready...
Document ready state: complete
Has basic content: true HTML length: 234567
Has Shopee elements: true
Page ready status: true
Page is ready!
Starting product data extraction...
Current URL: https://shopee.tw/mall/search?...
Attempting to extract products...
Searching for product elements...
Trying selector: section ul li
Selector section ul li found 24 elements
Using selector section ul li found 24 valid products
Total products extracted: 24 out of 24 elements
Success: Found 24 products, returning hasProducts: true
Page 1 found 24 products
Moving to page 2 for same URL
```

#### **如果出現問題，會看到：**
```
Searching for product elements...
Trying selector: section ul li
Selector section ul li found 0 elements
Trying selector: section ul li > div
Selector section ul li > div found 0 elements
...
No product elements found with any selector
No products extracted, checking for no-products message...
Found no products pattern in page text: 此賣場未找到任何商品
No products message detected, returning hasProducts: false
```

### 4. 關鍵調試點

#### **A. 頁面載入問題**
如果看到：
- `Document not complete yet`
- `Page content too short, not ready`
- `Content script not ready, waiting...`

**解決方法：** 網路連接問題或頁面載入緩慢，等待更長時間

#### **B. 商品選擇器問題**
如果看到：
- `No product elements found with any selector`
- 所有selector都找到0個elements

**解決方法：** 
1. 手動打開同樣的URL
2. 右鍵檢查元素
3. 查看實際的HTML結構
4. 回報實際的選擇器

#### **C. 無商品檢測過敏**
如果看到：
- 明明有商品卻顯示 `Found no products pattern in page text`

**解決方法：** 頁面可能包含其他無關的文字

### 5. 手動驗證步驟

1. **測試單個頁面：**
   - 手動打開：`https://shopee.tw/mall/search?keyword=test&page=0&shop=123`
   - 檢查是否有商品顯示
   - 記錄實際的HTML結構

2. **測試翻頁：**
   - 手動改變page=1, page=2...
   - 找到出現「此賣場未找到任何商品」的頁面
   - 記錄確切的文字內容

3. **測試選擇器：**
   在控制台執行：
   ```javascript
   // 測試商品元素
   document.querySelectorAll('section ul li').length
   document.querySelectorAll('a[href*="/product/"]').length
   
   // 測試無商品訊息
   document.body.textContent.includes('此賣場未找到任何商品')
   ```

### 6. 常見問題排查

| 問題現象 | 可能原因 | 解決方案 |
|---------|---------|----------|
| 立即跳到下一個URL | 無商品檢測過早觸發 | 檢查頁面實際內容 |
| 找不到商品元素 | 選擇器不匹配 | 檢查實際HTML結構 |
| 頁面載入超時 | 網路問題或反爬機制 | 增加等待時間，檢查網路 |
| 重複抓取同一頁 | 翻頁URL構建錯誤 | 檢查URL參數 |

### 7. 回報問題時請提供

1. **完整的控制台日誌**（從開始到出錯）
2. **測試用的URL**
3. **手動檢查的結果**（該頁面實際是否有商品）
4. **頁面的HTML片段**（右鍵查看頁面源碼）

這次的修正應該能解決大部分商品抓取和翻頁邏輯問題。如果仍有問題，請按照上述調試步驟提供詳細信息！
