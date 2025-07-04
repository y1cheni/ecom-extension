# Coupang_Item

A Chrome extension that automatically extracts product information from Coupang product pages.

## Features

- **Automatic Data Extraction**: Extract brand, VendorItemId, itemId, model name, price, review count, and URL from Coupang product pages
- **Search Page Integration**: Automatically process product links from search results
- **Real-time Data Collection**: Collect data as you browse product pages
- **Export Functions**: Support CSV export and clipboard copy
- **Data Management**: Clear data, view statistics, and manage collected information

## Installation

1. Download and extract the extension folder
2. Open Chrome browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extracted folder
5. The extension will be installed and the icon will appear in the browser toolbar

## Usage

### Automatic Data Collection
1. Visit Coupang product pages (https://www.tw.coupang.com/products/*)
2. The extension automatically extracts and saves product information
3. Click the extension icon to view collected data

### Data Management
- **View Data**: Click the extension icon to see all collected product information
- **Clear Data**: Click "Clear Data" button to remove all stored data
- **Export CSV**: Click "Export CSV" to download data in CSV format
- **Copy Data**: Click "Copy Data" to copy formatted data to clipboard

## Data Fields

| Field | Description | Source |
|-------|-------------|---------|
| **Brand** | Product brand name | Extracted from page content or search URL |
| **VendorItemId** | Vendor item identifier | URL parameter |
| **itemId** | Item identifier | URL parameter |
| **Model_name** | Product model/title | Page title and content |
| **Price** | Product price | Price display elements |
| **Reviews** | Number of reviews | Review count elements |
| **URL** | Product page URL | Current page URL |

## File Structure

- `manifest.json`: Extension configuration
- `content.js`: Content script for product pages
- `search_automation.js`: Script for search page processing
- `popup.html` & `popup.js`: Extension popup interface
- `README.md`: Documentation

## Technical Notes

- Data is stored in Chrome's local storage
- Supports both Traditional and Simplified Chinese content
- Automatically handles URL encoding/decoding
- Compatible with Coupang Taiwan site structure

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Privacy

- All data is stored locally in your browser
- No data is transmitted to external servers
- You can clear all data at any time 