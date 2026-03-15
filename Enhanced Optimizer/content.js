// content.js - Runs in ISOLATED world at document_start.
// injected.js is now a native MAIN world content script (declared in manifest.json)
// and has ALREADY run synchronously before this. We just need to send the real config.

(async function() {
  const { settings, customVideo } = await chrome.storage.local.get(['settings', 'customVideo']);

  if (settings && !settings.enabled) {
    window.postMessage({ type: 'OPTIMIZER_CONFIG', data: { disabled: true } }, '*');
    return;
  }

  // Send real config to injected.js (which is already running with defaults)
  window.postMessage({ type: 'OPTIMIZER_CONFIG', data: settings || {} }, '*');

  // Send custom video data if set
  if (customVideo) {
    setTimeout(() => {
      window.postMessage({ type: 'OPTIMIZER_CUSTOM_VIDEO', data: customVideo }, '*');
    }, 50);
  }
})();
