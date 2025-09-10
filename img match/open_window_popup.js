document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openWindow');
  if (!openBtn) return;
  // 自動縮小視窗以貼合按鈕
  try {
    const rect = openBtn.getBoundingClientRect();
    window.resizeTo(Math.ceil(rect.width + 40), Math.ceil(rect.height + 40));
  } catch(_) {}
  openBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'openWindow' });
    } catch (error) {
      try {
        await chrome.windows.create({
          url: 'matcher_window.html',
          type: 'popup',
          width: 1200,
          height: 800,
          left: 100,
          top: 100
        });
      } catch (fallbackError) {
        console.error('Failed to open standalone window:', fallbackError);
        alert('Failed to open standalone window. Please try again.');
      }
    }
  });
});


