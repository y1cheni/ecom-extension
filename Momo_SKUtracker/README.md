# MOMO Brand Data Collector

This is a Chrome extension for batch collecting brand information and corresponding product quantities from MOMO shopping website.

## Features

- 🔍 Automatically extract brand names and product quantities from search pages
- 📊 Display collected data in table format
- 📤 Support CSV file export
- 📋 Support copying data to clipboard
- 🚀 Auto-close processed tabs
- 📈 Display statistics
- 🔄 Batch processing mode with fixed brand order
- 📊 Real-time progress display
- 🖥️ Dedicated progress management page for long-term monitoring

## Installation

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked extension"
5. Select the `brand_data_collector` folder

## Usage

### Automatic Mode
1. Batch open links in the following format:
   ```
   https://www.momoshop.com.tw/search/searchShop.jsp?keyword=Apple&_isFuzzy=0&searchType=1
   ```
   Where `Apple` can be replaced with any brand name

2. The extension will automatically:
   - Extract search keywords from URL as matching criteria
   - Intelligently search for "品牌" (brand) related information on the page
   - Use fuzzy matching to find corresponding brand names (e.g., "FL 生活+" matches "FL生活+")
   - Extract actual brand names and numbers (e.g., extract "FL 生活+" and "1775" from "FL 生活+(1775)")
   - Save data and auto-close tabs

### Manual Mode
1. Click the extension icon on MOMO search pages
2. Click "Extract Current Page Data" button
3. Wait for data extraction to complete

### Batch Processing Mode

#### Method 1: In popup window
1. Click extension icon, select "Batch Processing"
2. Enter multiple URLs (one per line)
3. Click "Start Batch Processing"

#### Method 2: Using dedicated progress management page (Recommended)
1. Click extension icon, select "Open Progress Manager"
2. In the newly opened page, enter URL list in format:
   ```
   https://www.momoshop.com.tw/search/searchShop.jsp?keyword=Apple&_isFuzzy=0&searchType=1
   https://www.momoshop.com.tw/search/searchShop.jsp?keyword=Samsung&_isFuzzy=0&searchType=1
   ```
3. Click "Start Batch Processing"
4. The page will display in real-time:
   - Detailed progress statistics
   - Current processing status
   - Real-time data updates
   - Long-term progress monitoring capability

Regardless of which method is used, the extension will:
- Pre-create fixed order data items
- Automatically batch open tabs
- Process each URL sequentially
- Keep brands in fixed positions for easy copying

## Data Format

Collected data contains four fields:
- **Brand Name**: Actual brand name extracted from page (text before the number in second column)
- **Product Count**: Number extracted from "品牌" information on page
- **Search Keyword**: Original search term extracted from URL parameters
- **Collection Time**: Timestamp of data collection

## Notes

- Only works on MOMO search pages
- Excludes "品牌旗舰馆", only extracts information after "品牌"
- Supports fuzzy matching, can handle space differences, Chinese-English name variations
- If product count is not found, it will be marked as "Not found"
- Data is saved in local Chrome storage

## Intelligent Matching Features

The extension has powerful fuzzy matching capabilities:
- **Space Handling**: Automatically handles space differences (e.g., "FL生活+" and "FL 生活+")
- **Mixed Chinese-English**: Intelligently matches Chinese-English name differences
- **Contains Relationship**: Supports partial matching (e.g., "Apple" matches "Apple Inc")
- **Multiple Verification**: Uses multiple methods to ensure matching accuracy

## Export Features

- **Export CSV**: Export data as Excel-readable CSV file
- **Copy Data**: Copy data to clipboard, can be directly pasted into Excel and other applications

## Technical Implementation

- Uses Chrome Extension API
- Content scripts automatically injected into search pages
- Local data storage, no upload to servers
- Written in modern ES6+ JavaScript 