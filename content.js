// content.js - Pass silentMode setting

(async function() {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {
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
        mouseTracking: true,
        tabDetection: true,
        devToolsDetection: true
      }
    };
    
    if (!settings.enabled) {
      console.log('[Optimizer] Extension is disabled');
      return;
    }

    const allowedDomains = settings.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const currentDomain = window.location.hostname;
      const isAllowed = allowedDomains.some(domain => 
        currentDomain.includes(domain)
      );

      if (!isAllowed) {
        console.log('[Optimizer] Domain not in allowed list:', currentDomain);
        return;
      }
    }

    console.log('[Optimizer] Content script activated for:', window.location.hostname);

    // Store BOTH features AND silentMode
    try {
      sessionStorage.setItem('__OPTIMIZER_SETTINGS__', JSON.stringify({
        features: settings.features,
        silentMode: settings.silentMode  // ← Pass silentMode
      }));
      console.log('[Optimizer] Settings stored in sessionStorage');
    } catch (e) {
      console.warn('[Optimizer] sessionStorage blocked, using fallback');
    }

    // Also dispatch event with both
    const event = new CustomEvent('OPTIMIZER_INIT', {
      detail: {
        features: settings.features,
        silentMode: settings.silentMode
      }
    });
    document.dispatchEvent(event);
    
  } catch (error) {
    console.error('[Optimizer] Error in content script:', error);
  }
})();
