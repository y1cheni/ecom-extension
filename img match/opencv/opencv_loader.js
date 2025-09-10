// OpenCV.js 加載器
// 由於網絡問題，我們將使用 CDN 版本
const script = document.createElement('script');
script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
script.onload = function() {
    console.log('OpenCV.js 加載成功');
};
script.onerror = function() {
    console.error('OpenCV.js 加載失敗，請檢查網絡連接');
};
document.head.appendChild(script);
