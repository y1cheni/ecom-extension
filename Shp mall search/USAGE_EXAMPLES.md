# Shopee 商城搜索爬蟲 - 使用範例

## 範例連結格式

以下是一些可以直接使用的Shopee商城搜索連結範例：

### 範例1：食品品牌
```
https://shopee.tw/mall/search?keyword=KOIKEYA%20%E6%B9%96%E6%B1%A0%E5%B1%8B&page=0&shop=6440668
https://shopee.tw/mall/search?keyword=TAO%20KAE%20NOI&page=0&shop=50662979
```

### 範例2：美妝品牌  
```
https://shopee.tw/mall/search?keyword=Naeiae&page=0&shop=21507356
https://shopee.tw/mall/search?keyword=Naeiae&page=0&shop=28773971
https://shopee.tw/mall/search?keyword=Naeiae&page=0&shop=1119697613
```

### 範例3：多品牌批量抓取
```
https://shopee.tw/mall/search?keyword=%E4%B8%89%E5%A5%BD%E7%B1%B3&page=0&shop=19788054
https://shopee.tw/mall/search?keyword=%E7%B5%B1%E4%B8%80&page=0&shop=12345678
https://shopee.tw/mall/search?keyword=%E5%8F%AF%E5%8F%A3%E5%8F%AF%E6%A8%82&page=0&shop=87654321
```

## 實際操作流程

### 步驟1：準備連結
1. 在Shopee網站找到想要抓取的商城搜索頁面
2. 複製完整URL連結
3. 確保URL包含 `keyword` 和 `shop` 參數

### 步驟2：批量輸入
1. 點擊Chrome工具列的插件圖標
2. 在文字框中貼上連結，每行一個：
```
https://shopee.tw/mall/search?keyword=KOIKEYA%20%E6%B9%96%E6%B1%A0%E5%B1%8B&page=0&shop=6440668
https://shopee.tw/mall/search?keyword=TAO%20KAE%20NOI&page=0&shop=50662979
https://shopee.tw/mall/search?keyword=Naeiae&page=0&shop=21507356
```

### 步驟3：開始抓取
1. 點擊「開始抓取」按鈕
2. 觀察狀態顯示：
   - "處理連結 1/3..."
   - "抓取 1/3 - 第 1 頁"
   - "已抓取商品：25"

### 步驟4：監控進度
插件會自動：
- ✅ 打開第一個連結的 page=0
- ✅ 抓取所有商品
- ✅ 自動翻到 page=1、page=2...
- ✅ 發現"此賣場未找到任何商品"時跳到第二個連結
- ✅ 重複直到處理完所有連結

### 步驟5：查看結果
在插件界面可以看到：
- **狀態**: 抓取完成！共處理 3/3 個連結，獲得 156 個商品
- **進度**: 3/3
- **已抓取商品**: 156
- **最新資料預覽**

### 步驟6：匯出資料
1. 點擊「匯出CSV」按鈕
2. CSV文件會自動下載，檔名如：`shopee_products_2024-01-01.csv`
3. 包含欄位：品牌、商店ID、商品名稱、商品連結

## 預期的CSV輸出範例

```csv
品牌,商店ID,商品名稱,商品連結
"KOIKEYA 湖池屋","6440668","KOIKEYA湖池屋 卡拉姆久洋芋片-原味(60g)","https://shopee.tw/product/..."
"TAO KAE NOI","50662979","TAO KAE NOI 小老板 泰式酸辣海苔(32g)","https://shopee.tw/product/..."
"Naeiae","21507356","Naeiae 韓國面膜保濕補水套裝","https://shopee.tw/product/..."
```

## 常見使用情況

### 情況1：品牌研究
- 目標：了解某品牌在不同商店的商品分佈
- 方法：同一品牌，不同shop_id的多個連結

### 情況2：商店分析  
- 目標：分析特定商店的不同品牌商品
- 方法：同一shop_id，不同keyword的多個連結

### 情況3：市場調研
- 目標：大範圍收集多品牌多商店資料
- 方法：混合不同品牌和商店的大量連結

## 注意事項

⚠️ **連結格式檢查**
- 確保URL包含 `https://shopee.tw/mall/search`
- 必須有 `keyword` 參數（品牌名稱）
- 必須有 `shop` 參數（商店ID）
- `page` 參數會被插件自動管理

⚠️ **抓取時間估算**
- 每頁約需要 3-5 秒處理時間
- 每個連結平均 5-20 頁不等
- 10個連結大約需要 10-30 分鐘

⚠️ **資料品質**
- 商品名稱取自網頁顯示的標題
- 連結為商品詳情頁面的完整URL
- 品牌名稱從URL參數自動解碼
- 所有資料都會有時間戳記

---

**小技巧**: 建議先用1-2個連結測試，確認抓取結果符合預期後，再進行大批量處理。
