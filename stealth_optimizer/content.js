// content.js - Stealth Mode
(async function () {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {
      enabled: true,
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

    if (!settings.enabled) return;

    const allowedDomains = settings.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const currentDomain = window.location.hostname;
      const isAllowed = allowedDomains.some(domain =>
        currentDomain.includes(domain)
      );
      if (!isAllowed) return;
    }

    // Stealth store
    try {
      sessionStorage.setItem('__sys_conf__', JSON.stringify({
        features: settings.features
      }));
    } catch (e) { }

    // Stealth event
    const event = new CustomEvent('sys-init', {
      detail: { features: settings.features }
    });
    document.dispatchEvent(event);

  } catch (error) { }
})();
