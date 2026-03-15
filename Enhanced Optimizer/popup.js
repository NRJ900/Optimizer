// popup.js - Controls the extension popup with individual feature toggles

document.addEventListener('DOMContentLoaded', async () => {
  const mainToggle = document.getElementById('toggle-enabled');
  const featureToggles = document.querySelectorAll('.feature-toggle');
  const statusText = document.getElementById('status-text');
  const statusDot = document.querySelector('.status-dot');
  const currentUrl = document.getElementById('current-url');
  const featureCount = document.getElementById('feature-count');
  const featuresSection = document.getElementById('features-section');
  const reloadBtn = document.getElementById('reload-btn');
  const resetBtn = document.getElementById('reset-btn');

  let { settings, customVideo } = await chrome.storage.local.get(['settings', 'customVideo']);
  
  // Custom video ui mapping
  const videoInput = document.getElementById('custom-video-upload');
  const videoStatus = document.getElementById('video-status');
  const clearVideoBtn = document.getElementById('clear-video-btn');

  function updateVideoUI(hasVideo) {
    if (hasVideo) {
      videoStatus.textContent = 'Custom video active';
      videoStatus.style.color = '#4CAF50';
      clearVideoBtn.style.display = 'block';
    } else {
      videoStatus.textContent = 'Using default animation';
      videoStatus.style.color = '#aaa';
      clearVideoBtn.style.display = 'none';
      videoInput.value = ''; // reset file input
    }
  }

  updateVideoUI(!!customVideo);

  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('Video file is too large! Please keep it under 10MB.');
      updateVideoUI(!!customVideo);
      return;
    }

    videoStatus.textContent = 'Loading...';
    videoStatus.style.color = '#fff';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Video = event.target.result;
      customVideo = base64Video;
      await chrome.storage.local.set({ customVideo });
      updateVideoUI(true);
    };
    reader.readAsDataURL(file);
  });

  clearVideoBtn.addEventListener('click', async () => {
    customVideo = null;
    await chrome.storage.local.remove('customVideo');
    updateVideoUI(false);
  });

  // Update main toggle
  mainToggle.checked = settings?.enabled ?? true;
  updateStatus(settings?.enabled ?? true);

  // Update feature toggles
  if (settings?.features) {
    featureToggles.forEach(toggle => {
      const feature = toggle.dataset.feature;
      toggle.checked = settings.features[feature] ?? true;
    });
  }

  // Update feature count
  updateFeatureCount();

  // Enable/disable features section based on main toggle
  if (!mainToggle.checked) {
    featuresSection.classList.add('disabled');
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try {
      const url = new URL(tab.url);
      currentUrl.textContent = url.hostname;
    } catch (e) {
      currentUrl.textContent = 'Invalid URL';
    }
  }

  // Main toggle handler
  mainToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    
    // Update storage
    settings.enabled = enabled;
    await chrome.storage.local.set({ settings });

    // Update UI
    updateStatus(enabled);
    
    if (enabled) {
      featuresSection.classList.remove('disabled');
    } else {
      featuresSection.classList.add('disabled');
    }

    // Notify background (don't reload yet)
    chrome.runtime.sendMessage({ 
      action: 'updateSettings',
      reload: false 
    });
  });
// Silent mode toggle handler
const silentToggle = document.getElementById('toggle-silent');

// Load silent mode state
silentToggle.checked = settings?.silentMode ?? false;

silentToggle.addEventListener('change', async (e) => {
  const silentMode = e.target.checked;
  
  // Update storage
  const { settings } = await chrome.storage.local.get('settings');
  settings.silentMode = silentMode;
  await chrome.storage.local.set({ settings });

  // Show feedback
  statusText.textContent = silentMode ? 'Silent Mode ON' : 'Active';
  
  setTimeout(() => {
    updateStatus(settings.enabled);
  }, 1000);

  // Notify background (don't reload yet)
  chrome.runtime.sendMessage({ 
    action: 'updateSettings',
    reload: false 
  });
});

  // Feature toggle handlers
  featureToggles.forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const feature = toggle.dataset.feature;
      const enabled = e.target.checked;
      
      // Update storage
      if (!settings.features) {
        settings.features = {};
      }
      settings.features[feature] = enabled;
      await chrome.storage.local.set({ settings });

      // Update feature count
      updateFeatureCount();

      // Notify background (don't reload yet)
      chrome.runtime.sendMessage({ 
        action: 'updateSettings',
        reload: false 
      });
    });
  });

  // Reload button
  reloadBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'toggleExtension' });
    window.close();
  });

  // Reset button
  resetBtn.addEventListener('click', async () => {
    if (confirm('Reset all features to default?')) {
      // Reset to default
      const defaultFeatures = {
        textSelection: true,
        rightClick: true,
        copyPaste: true,
        keyboardShortcuts: true,
        visibilitySpoof: true,
        windowSizeSpoof: true,
        tabDetection: true,
        devToolsDetection: true,
        webcamBypass: true,
        micBypass: true,
        screenShareBypass: true
      };
      
      settings.features = defaultFeatures;
      await chrome.storage.local.set({ settings });

      // Update all toggles
      featureToggles.forEach(toggle => {
        const feature = toggle.dataset.feature;
        toggle.checked = defaultFeatures[feature];
      });

      // Update feature count
      updateFeatureCount();

      // Show feedback
      resetBtn.textContent = 'Reset ✓';
      setTimeout(() => {
        resetBtn.textContent = 'Reset All';
      }, 1500);
    }
  });

  function updateStatus(enabled) {
    if (enabled) {
      statusText.textContent = 'Active';
      statusDot.className = 'status-dot active';
    } else {
      statusText.textContent = 'Disabled';
      statusDot.className = 'status-dot inactive';
    }
  }

  function updateFeatureCount() {
    const enabledFeatures = Array.from(featureToggles)
      .filter(toggle => toggle.checked)
      .length;
    const totalFeatures = featureToggles.length;
    featureCount.textContent = `${enabledFeatures} / ${totalFeatures}`;
  }
});
