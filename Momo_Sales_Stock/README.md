# Momo_sales_stock

## Feature Description
This extension automatically extracts sales and stock information from MOMO Shopping website product pages:
- Sales data: Total sales volume information (e.g., >100萬, >50萬, etc.)
- Stock status: Product availability status (0 = available, 1 = low stock/out of stock)
- Product ID: Extracted from URL (number after i_code=)

## Usage

### Sales and Stock Data Extraction
1. Open a MOMO product page (format: https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13154711)
2. The extension will automatically extract sales and stock information and save it
3. You can open multiple product pages consecutively, all data will be saved automatically

### View Data
There are two ways to open the data tracker:
1. Click the extension icon, then select the "Data Tracking" tab in the popup window and click the "Open Data Tracker" button
2. Use keyboard shortcut (Windows: Ctrl+Shift+P, Mac: Command+Shift+P)

### Data Management
In the data tracker page, you can:
- View all captured product sales and stock data
- Clear all data (click "Clear All Data" button)
- Export data (click "Export Data" button)
- Copy data to clipboard (click "Copy to Clipboard" button)

The exported data format is tab-separated text that can be easily pasted into Excel or similar software.

## Important Notes
- Data is stored in the browser's local storage and will not be uploaded to any server
- Clearing browser data may result in loss of saved data
- Data extraction is based on webpage content; if the webpage structure changes, the extension may need updating 