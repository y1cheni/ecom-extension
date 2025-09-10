# Coupang SKU Counter

A Chrome extension that automatically counts and manages delivery SKU numbers from Coupang search pages.

## Features

- **SKU Counting**: Automatically count delivery items on Coupang search pages
- **Batch Processing**: Process multiple brand URLs automatically and collect delivery counts
- **Real-time Data Collection**: Collect data as you browse search pages
- **Export Functions**: Support CSV export and clipboard copy
- **Data Management**: Clear data, view statistics, and manage collected information
- **Automatic Closing**: Automatically close the page after counting is complete (default enabled)
- **Status Management**: Automatically save progress and support resuming from where you left off

## Installation

1. Download and extract the extension folder
2. Open Chrome browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extracted folder
5. The extension will be installed and the icon will appear in the browser toolbar

## Usage

### Manual SKU Counting
1. Visit Coupang search pages (https://www.tw.coupang.com/search?q=brand)
2. Page will show a control panel in the top-left corner
3. Click "Start Delivery Counting" to begin counting
4. The extension will automatically:
   - Count delivery items on current page
   - Jump to next page automatically
   - Continue counting without manual intervention
   - Stop when no more delivery items are found
5. Click the extension icon to view results

### Batch Processing
1. Click the extension icon and go to "Batch Processing" tab
2. Add brand URLs in the text area (one URL per line):
   ```
   https://www.tw.coupang.com/search?q=Samsung
   https://www.tw.coupang.com/search?q=LG
   https://www.tw.coupang.com/search?q=Apple
   ```
3. Click "Save URLs" to store the list
4. Click "Start Batch Processing" to begin automatic processing
5. The extension will:
   - Open each URL in a new tab
   - Automatically count delivery items
   - Close the tab and move to the next URL
   - Record results for each brand
6. View results in the batch processing table
7. Export results using "Export Results" or "Copy Results"

## Data Fields

### SKU Count Data
| Field | Description | Source |
|-------|-------------|---------|
| **Brand** | Brand name | Extracted from search URL |
| **# of SKU** | Total delivery count | Sum of all pages for the brand |
| **Pages Processed** | Number of pages processed | Count of pages with delivery items |
| **Last Update** | Timestamp of last processing | Processing time |

### Batch Processing Results
| Field | Description |
|-------|-------------|
| **Brand** | Brand name extracted from URL |
| **URL** | Original search URL |
| **# of SKU** | Total delivery count for the brand |
| **Status** | Processing status (Completed/Failed) |
| **Last Update** | Timestamp of processing |

## File Structure

- `manifest.json`: Extension configuration
- `search_automation.js`: Script for search page processing and SKU counting
- `popup.html` & `popup.js`: Extension popup interface with tabbed interface
- `README.md`: Documentation
- `TESTING.md`: Testing instructions

## Technical Notes

- Data is stored in Chrome's local storage
- Supports both Traditional and Simplified Chinese content
- Automatically handles URL encoding/decoding
- Compatible with Coupang Taiwan site structure
- Batch processing uses tab management for automation
- Progress tracking and status monitoring included

## Browser Compatibility

- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium-based browsers

## Privacy

- All data is stored locally in your browser
- No data is transmitted to external servers
- You can clear all data at any time 

## Update Notes

### v1.2
- Simplified to focus only on SKU counting functionality
- Removed product detail extraction features
- Enhanced SKU counting accuracy
- Improved batch processing reliability
- Updated interface for better user experience

### v1.1
- Added batch processing functionality
- Added URL management system
- Added progress tracking for batch operations
- Added automatic tab management
- Enhanced popup interface with tabbed design
- Added delivery counting functionality
- Added results tab to popup
- Added brand summary functionality
- Added automatic page navigation 

## Features (Chinese)

- **SKU Counting**: Automatically count delivery items on Coupang search pages
- **Batch Processing**: Automatically process multiple brand URLs and collect delivery counts
- **Real-time Data Collection**: Collect data while browsing search pages
- **Export Functions**: Support CSV export and clipboard copy
- **Data Management**: Clear data, view statistics, and manage collected information
- **Auto Close**: Option to automatically close pages after counting (enabled by default)
- **Status Management**: Automatically save progress and support resuming from breakpoints 