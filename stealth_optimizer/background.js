// background.js - Manages extension state and badge

// Default settings with individual feature toggles
const DEFAULT_SETTINGS = {
  enabled: true,
  silentMode: false,
  allowedDomains: [], // Empty = works on all sites
  features: {
    textSelection: true,
    rightClick: true,
    copyPaste: true,
    keyboardShortcuts: true,
    visibilitySpoof: true,
    windowSizeSpoof: true,
    tabDetection: true,
    devToolsDetection: true,
    mouseTracking: true
  }
};

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get('settings');
  if (!settings.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    // Merge with defaults to add any new features
    const merged = {
      ...DEFAULT_SETTINGS,
      ...settings.settings,
      features: {
        ...DEFAULT_SETTINGS.features,
        ...settings.settings.features
      },
      silentMode: settings.settings.silentMode ?? false
    };
    await chrome.storage.local.set({ settings: merged });
  }
  // Silent init
});

// Update badge based on state
async function updateBadge(tabId) {
  const { settings } = await chrome.storage.local.get('settings');

  if (settings && settings.enabled) {
    // Count enabled features
    const enabledCount = Object.values(settings.features || {}).filter(Boolean).length;
    chrome.action.setBadgeText({ text: enabledCount.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
  } else {
    chrome.action.setBadgeText({ text: 'OFF', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336', tabId });
  }
}

// Check if domain is allowed
function isDomainAllowed(url, allowedDomains) {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain =>
      urlObj.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const { settings } = await chrome.storage.local.get('settings');
    const isAllowed = isDomainAllowed(tab.url, settings?.allowedDomains);

    if (isAllowed) {
      await updateBadge(tabId);
    }
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    const { settings } = await chrome.storage.local.get('settings');
    const isAllowed = isDomainAllowed(tab.url, settings?.allowedDomains);

    if (isAllowed) {
      await updateBadge(activeInfo.tabId);
    }
  }
});

// Listen for messages from popup
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
