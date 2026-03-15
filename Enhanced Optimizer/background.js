// background.js - Manages extension state

const DEFAULT_SETTINGS = {
  enabled: true,
  silentMode: false,
  allowedDomains: [],
  features: {
    textSelection: true,
    rightClick: true,
    copyPaste: true,
    keyboardShortcuts: true,
    visibilitySpoof: true,
    windowSizeSpoof: true,
    tabDetection: true,
    devToolsDetection: true,
    mouseTracking: true,
    webcamBypass: true,
    micBypass: true,
    screenShareBypass: true
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  let currentSettings = settings;
  
  if (!settings) {
    currentSettings = DEFAULT_SETTINGS;
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      features: {
        ...DEFAULT_SETTINGS.features,
        ...settings.features
      },
      silentMode: settings.silentMode ?? false
    };
    await chrome.storage.local.set({ settings: currentSettings });
  }
  console.log('Optimizer extension installed and active');
});

// Update badge based on state
async function updateBadge(tabId) {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.enabled) {
    const enabledCount = Object.values(settings.features || {}).filter(Boolean).length;
    chrome.action.setBadgeText({ text: enabledCount.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
  } else {
    chrome.action.setBadgeText({ text: 'OFF', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336', tabId });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await updateBadge(tabId);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadge(activeInfo.tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleExtension' || message.action === 'updateSettings') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await updateBadge(tabs[0].id);
        if (message.reload !== false) {
          chrome.tabs.reload(tabs[0].id);
        }
      }
    });
  }
  sendResponse({ success: true });
  return true;
});
