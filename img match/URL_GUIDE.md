# URL 使用指南

## 📋 **支持的URL格式**

### **A組 - 搜索頁面URL**
系統支持蝦皮搜索頁面URL，例如：
```
https://shopee.tw/search?keyword=%E8%8E%AB%E6%AF%94%E8%87%AA%E7%84%B6%E9%A3%9F%20%E9%9B%9E%E8%82%89%E7%B1%B3%E5%B9%BC%E6%AF%8D%E7%8A%AC%E9%A3%9F%E8%AD%9C&page=0
```

**注意**：搜索頁面URL本身不是圖片，系統無法直接處理。你需要：
1. 從搜索結果中提取實際的商品圖片URL
2. 或者使用網頁截圖工具將搜索結果轉為圖片

### **B組 - 直接圖片URL** ✅
系統完全支持直接圖片URL，例如：
```
https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee__item-card-standard-v2/0.1.77/pc/f782781ad9d1d954ff22.png
```

## 🛠️ **URL轉換建議**

### **方法1：提取商品圖片URL**
從蝦皮搜索頁面中找到實際的商品圖片連結：
- 右鍵點擊商品圖片 → "複製圖片網址"
- 通常格式為：`https://cf.shopee.tw/file/xxxxx` 或 `https://deo.shopeemobile.com/xxxxx.jpg`

### **方法2：使用截圖API**
如果需要比較整個搜索結果頁面，可以使用：
- 瀏覽器截圖擴展
- 網頁截圖服務API
- 將截圖上傳到圖床獲得圖片URL

### **方法3：修改搜索URL**
將搜索URL修改為具體商品頁面，然後提取商品主圖。

## ⚠️ **重要提醒**

1. **A組和B組都必須是直接的圖片URL**
2. **支持的圖片格式**：JPG, PNG, WebP, GIF
3. **跨域問題**：確保圖片URL支持跨域訪問
4. **圖片大小**：建議單張圖片不超過10MB

## 📝 **正確的使用範例**

### **A組輸入**：
```
https://cf.shopee.tw/file/abc123def456.jpg
https://cf.shopee.tw/file/def789ghi012.png
https://deo.shopeemobile.com/product1.jpg
```

### **B組輸入**：
```
https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee__item-card-standard-v2/0.1.77/pc/f782781ad9d1d954ff22.png
https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee__item-card-standard-v2/0.1.77/pc/ba4d855d92aae2828365.png
```

這樣系統就能正確地比較A組中的單一商品圖片是否出現在B組的商品圖片中。
