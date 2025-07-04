# 🚀 Rocket Filter Logic Description

## Overview

The system now only processes URLs containing the `&filterType=rocket` parameter, ensuring only rocket delivery products data is collected.

## 🔍 Filter Logic

### URL Requirements
- **Must contain**: `&filterType=rocket` parameter
- **Valid URL examples**:
  ```
  https://tw.coupang.com/categories/手機-550279?brand=42308&filterType=rocket
  https://tw.coupang.com/categories/手機配件-550280?brand=12345&filterType=rocket&page=1
  ```

### Invalid URL Examples
- **Missing filterType parameter**:
  ```
  https://tw.coupang.com/categories/手機-550279?brand=42308
  ```
- **Incorrect filterType parameter value**:
  ```
  https://tw.coupang.com/categories/手機-550279?brand=42308&filterType=normal
  ```

## 🛡️ Implementation Scope

### Affected Functions
1. **Basic Data Extraction**: Only extracts data from pages containing rocket parameter
2. **SKU Statistics**: Only counts SKU from pages containing rocket parameter
3. **Auto Monitoring**: Only monitors and processes page changes containing rocket parameter
4. **Automation Workflow**: Only starts automation on pages containing rocket parameter

### Console Logs
When URL doesn't contain filterType=rocket, corresponding skip messages are displayed:
- `"URL does not contain filterType=rocket parameter, skipping data extraction"`
- `"URL does not contain filterType=rocket parameter, skipping SKU statistics"`
- `"URL does not contain filterType=rocket parameter, skipping auto processing"`

## 🔄 Workflow

### 1. Page Load Check
```
Page Load → Check URL → Contains filterType=rocket? → Yes: Start Function / No: Standby
```

### 2. URL Change Monitoring
```
URL Change → Check New URL → Contains filterType=rocket? → Yes: Process Data / No: Skip
```

### 3. Brand Filter Change
```
Brand Change → Check URL → Contains filterType=rocket? → Yes: Extract Data / No: Skip
```

## 📊 User Experience

### Impact on Users
- **Transparent Filtering**: Users don't need to understand technical details, system filters automatically
- **Precise Data**: Ensures only rocket delivery products data is collected
- **No Extra Operations**: No need for users to manually add or check parameters

### Status Indication
- **Valid Pages**: Normal display of automation notifications and progress
- **Invalid Pages**: System remains silent, no processing performed
- **Console Logs**: Developers can view filter status through console

## 🔧 Technical Implementation

### Check Function
```javascript
// Basic check
if (!url.includes('filterType=rocket')) {
  console.log("URL does not contain filterType=rocket parameter, skipping processing");
  return;
}
```

### Application Locations
- `extractCoupangData()` - Data extraction function
- `countSKUCurrentPage()` - SKU statistics function  
- `autoDetectAndProcess()` - Auto processing function
- `startContinuousMonitoring()` - Continuous monitoring function

## ⚠️ Important Notes

### URL Format Requirements
- Parameter must match exactly: `filterType=rocket`
- Case sensitive: must be lowercase `rocket`
- Position independent: can be anywhere in the URL

### Compatibility
- **Backward Compatible**: Existing functions remain unchanged
- **Progressive Enhancement**: Adds filter logic on existing foundation
- **Error Handling**: Invalid URLs won't cause errors, just skip processing

## 🎯 Expected Effects

### Data Quality
- **Precise Filtering**: Only collect rocket delivery products data
- **Avoid Confusion**: Exclude non-rocket delivery products
- **Data Consistency**: Ensure all collected data meets requirements

### Performance Optimization
- **Reduce Invalid Processing**: Skip pages that don't meet requirements
- **Resource Conservation**: Avoid processing unwanted data
- **Improve Efficiency**: Focus on target data collection

---

🚀 **Goal**: Ensure only rocket delivery products data is collected
🎯 **Effect**: Improve data accuracy and consistency
✨ **Experience**: User-imperceptible intelligent filtering 