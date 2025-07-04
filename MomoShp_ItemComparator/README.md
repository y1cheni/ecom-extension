# MomoShp_ItemComparator

一個Chrome擴展，用於比較MOMO和Shopee購物平台的商品價格。

## Features

- Extract product information from both MOMO and Shopee product pages
- Capture product IDs, prices, and full product names for easier identification
- Process lists of MOMO TIDs and Shopee URLs for organized tracking
- Automatic opening of product links based on TID/URL lists
- Sort product data according to user-provided list order
- Export formatted data for easy copying to spreadsheets
- Integration with multiple shopping platforms in a single tool
- Auto-extract data when visiting product pages

## Supported Platforms

### MOMO Shopping
- Extracts product IDs and prices from MOMO product pages
- Captures full product names with intelligent font-size based detection
- Processes a list of TIDs (tracking IDs) for organized tracking
- Auto-opens MOMO product links based on TID list

### Shopee
- Extracts product IDs and prices from Shopee product pages
- Captures full product names from product detail pages
- Processes a list of Shopee URLs for organized tracking
- Auto-opens Shopee product links based on URL list

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `momo_price_tracker` folder
5. The extension should now be installed and visible in your extensions list

## Usage

### Basic Usage

1. Click the extension icon to open the popup
2. For a product page you're currently viewing:
   - If it's a MOMO product page, click "Track This Product"
   - If it's a Shopee product page, click "Track This Shopee Product"
3. Click "Open Price Tracker" to open the tracking interface
4. Enter your MOMO TID list or Shopee URL list (one per line)
5. Click the corresponding "Process" button to sort the table based on your list

### Auto-opening Product Links

For MOMO Products:
1. After processing your TID list, use the "Auto-open MOMO Links" feature:
   - Set the desired delay between opening tabs (in seconds)
   - Click "Start" to begin automatically opening product pages
   - You can stop the process at any time by clicking "Stop"

For Shopee Products:
1. After processing your Shopee URL list, use the "Auto-open Shopee Links" feature:
   - Set the desired delay between opening tabs (in seconds)
   - Click "Start" to begin automatically opening product pages
   - You can stop the process at any time by clicking "Stop"

### Exporting Data

1. Once you've collected data, click "Export Data" to format it for copying
2. Click "Copy to Clipboard" to copy the formatted data
3. Paste directly into a spreadsheet (Excel, Google Sheets, etc.)

## Data Description

The exported data contains eight columns:

MOMO Section (A-D):
- Column A: TID (Tracking ID) as entered in your TID list
- Column B: Product ID (filled only after visiting the product page)
- Column C: Product price (formatted as a clean number without commas)
- Column D: Product name (full product title for easier identification)

Shopee Section (E-H):
- Column E: Shopee URL as entered in your URL list
- Column F: Product ID (filled only after visiting the product page)
- Column G: Product price (formatted as a clean number)
- Column H: Product name (full product title for easier identification)

## Product Information Extraction

### MOMO Price Extraction
The extension extracts key information from MOMO product pages:

1. **Price Extraction**: The extension prioritizes finding the most accurate price by:
   - First looking for the price closest to the text "元 賣貴通報"
   - Avoiding prices with "$" symbol
   - Cleaning prices by removing commas and presenting pure numbers

2. **Product Name Extraction**: The extension uses multiple methods to find the product name:
   - First identifies the element with the largest font size on the page (usually the product title)
   - Filters out elements containing only numbers
   - Falls back to common selectors for product names if the font-size method fails
   - As a last resort, checks page title for product name

### Shopee Price Extraction
The extension extracts key information from Shopee product pages:

1. **Price Extraction**: The extension searches for:
   - Price elements with specific class names used by Shopee
   - Removes currency symbols and formatting
   - Presents clean numbers for comparison

2. **Product Name Extraction**: The extension uses multiple methods:
   - Searches for product name in the page's meta tags
   - Looks for specific elements with product name classes
   - Falls back to page title if needed

## Notes

- To clear all data, click the "Clear Data" button
- The B and F columns will remain empty until you actually visit the respective product pages
- Prices are formatted as pure numbers without commas
- For best results, process your TID/URL lists before starting data collection
- Long product names/URLs will be displayed with an ellipsis (...) but the full text will appear on hover

## File Description
- `manifest.json`: Extension configuration file
- `content.js`: Script that runs on MOMO product pages
- `shopee_content.js`: Script that runs on Shopee product pages
- `background.js`: Background script, handles commands and messages
- `popup.html` & `popup.js`: Popup window displayed when clicking the extension icon
- `tracker.html` & `tracker.js`: Price tracker data display page

## Additional Notes
- Data is stored in the browser's local storage and will not be uploaded to any server
- Clearing browser data may cause saved data to be lost
- Price extraction is based on webpage content, if the webpage structure changes, the extension may need to be updated 