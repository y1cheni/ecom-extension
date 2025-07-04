# 🏷️ Coupang L2 Brand Data Collector

A powerful Chrome extension for collecting category and brand data from Coupang Taiwan website with automated SKU statistics functionality.

## 🚀 Features

### Core Data Collection
- **L2 Category Information**: Automatically extracts L2 category type and name
- **Brand Information**: Collects brand code and brand name  
- **URL Tracking**: Records source URLs for reference
- **Smart Detection**: Automatically detects appropriate Coupang pages for data collection

### Advanced SKU Statistics (Optional)
- **Stock Counting**: Automatically counts in-stock and out-of-stock products
- **Multi-Page Processing**: Continuously processes across multiple pages
- **Rocket Filter**: Specifically targets "Rocket" filtered product pages
- **Progress Monitoring**: Real-time progress tracking with completion detection

### Batch Processing
- **Bulk Operations**: Process multiple category-brand combinations
- **Progress Management**: Visual progress tracking with detailed statistics
- **Data Protection**: Prevents overwriting completed data entries
- **Fixed Ordering**: Maintains consistent data ordering for batch operations

## 📋 Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your Chrome toolbar

## 🔧 Usage

### Basic Data Collection

1. **Navigate to Target Page**: Visit a Coupang category page with brand filter applied
   - URL format: `https://www.coupang.com/np/categories/[category]?[parameters]&brand=[brandId]`
   - Must contain both category and brand parameters

2. **Open Extension**: Click the extension icon to open the popup

3. **Data Collection Options**:
   - **Basic Collection**: Collect category and brand information only
   - **With SKU Statistics**: Enable SKU counting for comprehensive product analysis

4. **View Results**: Collected data appears in the popup table with status indicators

### SKU Statistics (Advanced Feature)

1. **Enable SKU Function**: Toggle the SKU switch in the extension popup

2. **URL Requirements**: 
   - Must contain `filterType=rocket` parameter
   - Should be on first page of results for optimal processing

3. **Automatic Processing**:
   - Extension automatically navigates through all pages
   - Counts in-stock products (containing "信用卡")
   - Counts out-of-stock products (containing "暫時缺貨")
   - Stops when reaching "沒有此類產品" message

4. **Progress Monitoring**: Monitor real-time progress in browser console

### Batch Processing

1. **Open Progress Manager**: Navigate to the progress management page

2. **Input Format**: Enter category-brand pairs in the text area
   ```
   Mobile    Apple
   Mobile    SAMSUNG
   Accessories    PHILIPS
   ```
   - Use TAB separator between category and brand name
   - One pair per line

3. **Start Processing**: Click "Start Batch Processing" to create data entries

4. **Manual Collection**: Visit corresponding Coupang pages to trigger automatic data collection

5. **Monitor Progress**: View real-time statistics and completion status

## 📊 Data Export

### CSV Export
- Export all collected data to CSV format
- Includes all fields: category, brand, codes, SKU counts, URLs, timestamps
- Filename format: `Coupang_L2Brand_Data_YYYYMMDD_HHMMSS.csv`

### Data Management
- **Copy to Clipboard**: Copy formatted data for external use
- **Clear Individual**: Remove specific data entries
- **Clear All**: Reset entire dataset (with confirmation)

## 🛠️ Technical Details

### Detection Logic
- **Category Detection**: Extracts L2 category from breadcrumb navigation
- **Brand Detection**: Identifies brand information from page elements and filters
- **URL Parsing**: Analyzes URL parameters for brand and category codes
- **Page Validation**: Ensures page meets requirements for data collection

### SKU Counting Algorithm
- **Stock Detection**: Searches for "信用卡" text indicating payment options (in-stock)
- **Out-of-Stock Detection**: Identifies "暫時缺貨" text for unavailable products
- **End Detection**: Recognizes "沒有此類產品" to stop processing
- **Page Navigation**: Automatically constructs next page URLs with proper parameters

### Data Storage
- Uses Chrome extension local storage
- Automatic data persistence across browser sessions
- Conflict resolution for duplicate entries
- Status tracking for batch processing

## ⚠️ Important Notes

### URL Requirements
- **Category Pages Only**: Works specifically with Coupang category browsing pages
- **Brand Filter Required**: Must have brand parameter in URL
- **Rocket Filter**: SKU statistics require `filterType=rocket` parameter

### Performance Considerations
- **Rate Limiting**: Built-in delays to avoid overwhelming the website
- **Resource Usage**: Monitor browser performance during large batch operations
- **Data Protection**: Completed entries are protected from accidental overwriting

### Limitations
- **Taiwan Coupang Only**: Designed specifically for Coupang Taiwan website
- **Chinese Text Detection**: SKU counting relies on specific Chinese text patterns
- **Page Structure Dependency**: May require updates if website structure changes

## 🔍 Troubleshooting

### Common Issues

1. **No Data Collected**
   - Verify URL contains both category and brand parameters
   - Check if page has finished loading completely
   - Ensure you're on a valid Coupang category page

2. **SKU Statistics Not Working**
   - Confirm URL contains `filterType=rocket` parameter
   - Verify SKU function is enabled in extension settings
   - Check if page contains product listings

3. **Batch Processing Issues**
   - Use TAB separator between category and brand names
   - Ensure proper format: one pair per line
   - Manually visit Coupang pages to trigger data collection

### Debug Information
- Open browser console (F12) to view detailed processing logs
- Extension logs all major operations and status changes
- Error messages include specific guidance for resolution

## 📝 Data Fields

| Field | Description | Example |
|-------|-------------|---------|
| L2 Category | Category type code | `186764` |
| Category Name | Human-readable category name | `Mobile` |
| Brand Code | Brand parameter from URL | `brand=12345&` |
| Brand Name | Display name of brand | `Apple` |
| In Stock Count | Number of available products | `48` |
| Out of Stock Count | Number of unavailable products | `12` |
| Total SKU | Sum of in-stock and out-of-stock | `60` |
| URL | Source page URL | `https://www.coupang.com/...` |
| Timestamp | Collection date/time | `2024-01-01 12:00:00` |
| Status | Processing status | `Completed` |

## 🔄 Version History

- **v1.0**: Basic category and brand data collection
- **v1.1**: Added SKU statistics functionality  
- **v1.2**: Implemented batch processing capabilities
- **v1.3**: Enhanced data protection and progress monitoring
- **v2.0**: Complete English localization and improved UI

## 📞 Support

For technical support or feature requests:
1. Check the troubleshooting section above
2. Review browser console logs for error details
3. Verify URL format and page requirements
4. Ensure latest Chrome browser version

## 📄 License

This extension is provided as-is for educational and research purposes. Please respect Coupang's terms of service and use responsibly. 