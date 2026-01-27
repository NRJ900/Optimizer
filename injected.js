// injected.js - COMPLETE with Silent Mode (CLEAN VERSION)

(function() {
  'use strict';

  // Default settings
  const DEFAULT_CONFIG = {
    silentMode: false,
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

  let config = null;
  let settings = null;
  let silentMode = false;

  // Silent logging wrapper
  function log(...args) {
    if (!silentMode) {
      console.log(...args);
    }
  }

  function warn(...args) {
    if (!silentMode) {
      console.warn(...args);
    }
  }

  function error(...args) {
    if (!silentMode) {
      console.error(...args);
    }
  }

  // Method 1: Try reading from sessionStorage
  try {
    const stored = sessionStorage.getItem('__OPTIMIZER_SETTINGS__');
    if (stored) {
      config = JSON.parse(stored);
      settings = config.features || DEFAULT_CONFIG.features;
      silentMode = config.silentMode || false;
      log('[Optimizer] Settings loaded from sessionStorage:', config);
    }
  } catch (e) {
    warn('[Optimizer] Failed to read sessionStorage:', e);
  }

  // Method 2: Listen for custom event (fallback)
  if (!config) {
    document.addEventListener('OPTIMIZER_INIT', function handler(e) {
      config = e.detail;
      settings = config.features || DEFAULT_CONFIG.features;
      silentMode = config.silentMode || false;
      log('[Optimizer] Settings received via custom event:', config);
      document.removeEventListener('OPTIMIZER_INIT', handler);
      init();
    });
  }

  // Method 3: Use defaults if all else fails
  if (!config) {
    warn('[Optimizer] No settings found, using defaults');
    config = DEFAULT_CONFIG;
    settings = DEFAULT_CONFIG.features;
    silentMode = false;
  }

  if (!silentMode) {
    log('[Optimizer] Injected script starting in MAIN world...');
  }

  // === 1. RESTORE TEXT SELECTION & RIGHT-CLICK ===
  function restoreBasics() {
    if (!settings.textSelection && !settings.rightClick && !settings.copyPaste) {
      log('[Optimizer] ⊘ Basic features disabled');
      return;
    }

    if (settings.textSelection) {
      const style = document.createElement('style');
      style.id = 'optimizer-text-selection';
      style.textContent = `
        *, *::before, *::after {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
        body, html {
          -webkit-touch-callout: default !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const blockedAttrs = [];
    if (settings.rightClick) blockedAttrs.push('oncontextmenu');
    if (settings.textSelection) blockedAttrs.push('onselectstart', 'ondragstart', 'onmousedown');
    if (settings.copyPaste) blockedAttrs.push('oncopy', 'onpaste', 'oncut');

    function removeBlockers() {
      blockedAttrs.forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
          el.removeAttribute(attr);
          el[attr] = null;
        });
      });
    }

    removeBlockers();
    
    const observer = new MutationObserver(removeBlockers);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: blockedAttrs
    });

    const eventsToUnblock = [];
    if (settings.rightClick) eventsToUnblock.push('contextmenu');
    if (settings.copyPaste) eventsToUnblock.push('copy', 'paste', 'cut');
    if (settings.textSelection) eventsToUnblock.push('selectstart', 'dragstart', 'mousedown', 'mouseup');

    eventsToUnblock.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, { capture: true, passive: false });

      window.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, { capture: true, passive: false });
    });

    log('[Optimizer] ✓ Basic features restored');
  }

  // === 2. ALLOW KEYBOARD SHORTCUTS ===
  function allowKeyboardShortcuts() {
    if (!settings.keyboardShortcuts) {
      log('[Optimizer] ⊘ Keyboard shortcuts disabled');
      return;
    }

    ['keydown', 'keyup', 'keypress'].forEach(eventType => {
      window.addEventListener(eventType, (e) => {
        e.stopImmediatePropagation();
      }, { capture: true, passive: false });
    });

    log('[Optimizer] ✓ Keyboard shortcuts enabled');
  }

  // === 3. SPOOF VISIBILITY & FOCUS ===
  function spoofVisibility() {
    if (!settings.visibilitySpoof) {
      log('[Optimizer] ⊘ Visibility spoofing disabled');
      return;
    }

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });

    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => true
    });

    const blockEvents = ['visibilitychange', 'blur', 'focusout', 'pagehide', 'beforeunload'];
    
    blockEvents.forEach(eventType => {
      window.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }, { capture: true });

      document.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }, { capture: true });
    });

    setInterval(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    }, 1000);

    log('[Optimizer] ✓ Visibility/focus spoofed');
  }

  // === 4. FULLSCREEN BYPASS & PREVENTION ===
  function spoofWindowSize() {
    if (!settings.windowSizeSpoof) {
      log('[Optimizer] ⊘ Fullscreen bypass disabled');
      return;
    }

    const fakeWidth = screen.width;
    const fakeHeight = screen.height;

    const props = [
      ['window', 'innerWidth', fakeWidth],
      ['window', 'innerHeight', fakeHeight],
      ['window', 'outerWidth', fakeWidth],
      ['window', 'outerHeight', fakeHeight],
      ['screen', 'width', fakeWidth],
      ['screen', 'height', fakeHeight],
      ['screen', 'availWidth', fakeWidth],
      ['screen', 'availHeight', fakeHeight],
    ];

    props.forEach(([obj, prop, value]) => {
      try {
        const target = obj === 'window' ? window : screen;
        Object.defineProperty(target, prop, {
          configurable: true,
          get: () => value
        });
      } catch (e) {}
    });

    window.addEventListener('resize', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, { capture: true });

    const elementProto = Element.prototype;
    
    elementProto.requestFullscreen = function() {
      log('[Optimizer] Blocked requestFullscreen()');
      return Promise.resolve();
    };
    
    elementProto.webkitRequestFullscreen = function() {
      log('[Optimizer] Blocked webkitRequestFullscreen()');
      return Promise.resolve();
    };
    
    elementProto.mozRequestFullScreen = function() {
      log('[Optimizer] Blocked mozRequestFullScreen()');
      return Promise.resolve();
    };
    
    elementProto.msRequestFullscreen = function() {
      log('[Optimizer] Blocked msRequestFullscreen()');
      return Promise.resolve();
    };

    document.exitFullscreen = () => {
      log('[Optimizer] Blocked exitFullscreen()');
      return Promise.resolve();
    };
    document.webkitExitFullscreen = () => Promise.resolve();
    document.mozCancelFullScreen = () => Promise.resolve();
    document.msExitFullscreen = () => Promise.resolve();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    });

    Object.defineProperty(document, 'webkitFullscreenElement', {
      configurable: true,
      get: () => null
    });

    Object.defineProperty(document, 'mozFullScreenElement', {
      configurable: true,
      get: () => null
    });

    Object.defineProperty(document, 'msFullscreenElement', {
      configurable: true,
      get: () => null
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        log('[Optimizer] Blocked', evt);
      }, { capture: true });
    });

    log('[Optimizer] ✓ Fullscreen bypass active + prevention enabled');
  }

  // === 5. ENHANCED MOUSE TRACKING BYPASS ===
  function bypassMouseTracking() {
    if (!settings.mouseTracking) {
      log('[Optimizer] ⊘ Mouse tracking bypass disabled');
      return;
    }

    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;
    let mouseInsideWindow = true;

    document.addEventListener('mousemove', (e) => {
      if (e.clientX >= 0 && e.clientX <= window.innerWidth &&
          e.clientY >= 0 && e.clientY <= window.innerHeight) {
        lastX = e.clientX;
        lastY = e.clientY;
        mouseInsideWindow = true;
      }
    }, true);

    const mouseLeaveEvents = [
      'mouseleave', 'mouseout', 'mouseenter', 'mouseover',
      'focusout', 'blur'
    ];
    
    mouseLeaveEvents.forEach(eventType => {
      window.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        log('[Optimizer] Blocked', eventType, 'on window');
        return false;
      }, { capture: true });

      document.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }, { capture: true });

      if (document.body) {
        document.body.addEventListener(eventType, (e) => {
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.preventDefault();
          return false;
        }, { capture: true });
      }

      document.documentElement.addEventListener(eventType, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }, { capture: true });
    });

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (mouseLeaveEvents.includes(type)) {
        log('[Optimizer] Blocked new listener for', type);
        return;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    setInterval(() => {
      const fakeMouseEvent = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: lastX,
        clientY: lastY,
        screenX: lastX,
        screenY: lastY
      });
      document.dispatchEvent(fakeMouseEvent);

      if (!mouseInsideWindow) {
        const enterEvent = new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: lastX,
          clientY: lastY
        });
        document.dispatchEvent(enterEvent);
        mouseInsideWindow = true;
      }
    }, 500);

    Object.defineProperty(window, 'onblur', {
      configurable: true,
      get: () => null,
      set: () => {}
    });

    Object.defineProperty(window, 'onfocus', {
      configurable: true,
      get: () => null,
      set: () => {}
    });

    const originalHasFocus = Document.prototype.hasFocus;
    Document.prototype.hasFocus = function() {
      return true;
    };

    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: () => true
    });

    log('[Optimizer] ✓ Mouse tracking bypass active');
  }

  // === 6. TAB DETECTION BYPASS ===
  function neutralizeTabDetection() {
    if (!settings.tabDetection) {
      log('[Optimizer] ⊘ Tab detection disabled');
      return;
    }

    ['tabChangeCount', 'blurCount', 'focusLostCount', 'visibilityChangeCount', 'mouseOutCount', 'mouseLeaveCount'].forEach(varName => {
      try {
        Object.defineProperty(window, varName, {
          configurable: true,
          get: () => 0,
          set: () => {}
        });
      } catch (e) {}
    });

    log('[Optimizer] ✓ Tab detection neutralized');
  }

  // === 7. DEVTOOLS DETECTION BYPASS ===
  function disableDevToolsDetection() {
    if (!settings.devToolsDetection) {
      log('[Optimizer] ⊘ DevTools detection disabled');
      return;
    }

    Object.defineProperty(window, 'devtools', {
      configurable: true,
      get: () => ({ isOpen: false, orientation: null })
    });

    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    Object.keys(original).forEach(method => {
      console[method] = function(...args) {
        original[method].apply(console, args);
      };
    });

    log('[Optimizer] ✓ DevTools detection bypassed');
  }

  // === 8. ISOLATE STORAGE ACCESS ===
  function isolateStorageAccess() {
    if (!settings.tabDetection) {
      log('[Optimizer] ⊘ Storage isolation disabled');
      return;
    }

    const isolatedLocalStorage = {};
    const isolatedSessionStorage = {};

    const allowedKeys = [
      'test_id',
      'user_id',
      'question_progress',
      'answers',
      'test_started',
      'current_question'
    ];

    const blockedKeys = [
      'tab_switches',
      'tab_change',
      'blur_count',
      'focus_lost',
      'mouse_out',
      'mouse_leave',
      'visibility_change',
      'monitoring_data',
      'tracking_data',
      'suspicious_activity',
      'cheating_detection',
      'proctoring',
      'violations',
      'focus_changes',
      'window_blur'
    ];

    function shouldBlockKey(key) {
      if (!key) return false;
      const lowerKey = key.toLowerCase();
      return blockedKeys.some(blocked => lowerKey.includes(blocked));
    }

    const originalLocalStorage = {
      getItem: Storage.prototype.getItem.bind(localStorage),
      setItem: Storage.prototype.setItem.bind(localStorage),
      removeItem: Storage.prototype.removeItem.bind(localStorage),
      clear: Storage.prototype.clear.bind(localStorage),
      key: Storage.prototype.key.bind(localStorage)
    };

    Storage.prototype.getItem = function(key) {
      if (this === localStorage) {
        if (shouldBlockKey(key)) {
          log('[Optimizer] Blocked localStorage.getItem:', key);
          return isolatedLocalStorage[key] || null;
        }
        return originalLocalStorage.getItem(key);
      }
      return originalLocalStorage.getItem.call(this, key);
    };

    Storage.prototype.setItem = function(key, value) {
      if (this === localStorage) {
        if (shouldBlockKey(key)) {
          log('[Optimizer] Blocked localStorage.setItem:', key, '=', value);
          isolatedLocalStorage[key] = String(value);
          return;
        }
        return originalLocalStorage.setItem(key, value);
      }
      return originalLocalStorage.setItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function(key) {
      if (this === localStorage) {
        if (shouldBlockKey(key)) {
          log('[Optimizer] Blocked localStorage.removeItem:', key);
          delete isolatedLocalStorage[key];
          return;
        }
        return originalLocalStorage.removeItem(key);
      }
      return originalLocalStorage.removeItem.call(this, key);
    };

    Storage.prototype.clear = function() {
      if (this === localStorage) {
        log('[Optimizer] Intercepted localStorage.clear()');
        Object.keys(isolatedLocalStorage).forEach(key => delete isolatedLocalStorage[key]);
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          keys.push(localStorage.key(i));
        }
        keys.forEach(key => {
          if (!shouldBlockKey(key)) {
            originalLocalStorage.removeItem(key);
          }
        });
        return;
      }
      return originalLocalStorage.clear.call(this);
    };

    const originalSessionStorage = {
      getItem: sessionStorage.getItem.bind(sessionStorage),
      setItem: sessionStorage.setItem.bind(sessionStorage),
      removeItem: sessionStorage.removeItem.bind(sessionStorage),
      clear: sessionStorage.clear.bind(sessionStorage),
      key: sessionStorage.key.bind(sessionStorage)
    };

    const sessionStorageHandler = {
      get(target, prop) {
        if (prop === 'getItem') {
          return function(key) {
            if (shouldBlockKey(key)) {
              log('[Optimizer] Blocked sessionStorage.getItem:', key);
              return isolatedSessionStorage[key] || null;
            }
            return originalSessionStorage.getItem(key);
          };
        }
        if (prop === 'setItem') {
          return function(key, value) {
            if (shouldBlockKey(key)) {
              log('[Optimizer] Blocked sessionStorage.setItem:', key, '=', value);
              isolatedSessionStorage[key] = String(value);
              return;
            }
            return originalSessionStorage.setItem(key, value);
          };
        }
        if (prop === 'removeItem') {
          return function(key) {
            if (shouldBlockKey(key)) {
              log('[Optimizer] Blocked sessionStorage.removeItem:', key);
              delete isolatedSessionStorage[key];
              return;
            }
            return originalSessionStorage.removeItem(key);
          };
        }
        if (prop === 'clear') {
          return function() {
            log('[Optimizer] Intercepted sessionStorage.clear()');
            Object.keys(isolatedSessionStorage).forEach(key => delete isolatedSessionStorage[key]);
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              keys.push(sessionStorage.key(i));
            }
            keys.forEach(key => {
              if (!shouldBlockKey(key)) {
                originalSessionStorage.removeItem(key);
              }
            });
            return;
          };
        }
        if (prop === 'length') {
          const realKeys = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (!shouldBlockKey(key)) realKeys.push(key);
          }
          return realKeys.length + Object.keys(isolatedSessionStorage).length;
        }
        if (prop === 'key') {
          return function(index) {
            const realKeys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (!shouldBlockKey(key)) realKeys.push(key);
            }
            const allKeys = [...realKeys, ...Object.keys(isolatedSessionStorage)];
            return allKeys[index] || null;
          };
        }
        return target[prop];
      },
      set(target, prop, value) {
        if (shouldBlockKey(prop)) {
          log('[Optimizer] Blocked sessionStorage direct set:', prop);
          isolatedSessionStorage[prop] = value;
          return true;
        }
        target[prop] = value;
        return true;
      }
    };

    try {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          return new Proxy(sessionStorage, sessionStorageHandler);
        }
      });
    } catch (e) {
      warn('[Optimizer] Could not proxy sessionStorage:', e);
    }

    function cleanExistingTrackingData() {
      const lsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        lsKeys.push(localStorage.key(i));
      }
      lsKeys.forEach(key => {
        if (shouldBlockKey(key)) {
          log('[Optimizer] Removing existing tracking key from localStorage:', key);
          originalLocalStorage.removeItem(key);
        }
      });

      const ssKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        ssKeys.push(sessionStorage.key(i));
      }
      ssKeys.forEach(key => {
        if (shouldBlockKey(key)) {
          log('[Optimizer] Removing existing tracking key from sessionStorage:', key);
          originalSessionStorage.removeItem(key);
        }
      });
    }

    cleanExistingTrackingData();
    setInterval(cleanExistingTrackingData, 5000);

    log('[Optimizer] ✓ Storage isolation active (tracking data blocked)');
  }

  // === 9. AUTO-EXIT FULLSCREEN IF TRIGGERED ===
  function monitorAndExitFullscreen() {
    if (!settings.windowSizeSpoof) return;

    setInterval(() => {
      if (document.fullscreenElement || 
          document.webkitFullscreenElement || 
          document.mozFullScreenElement) {
        try {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
          log('[Optimizer] Auto-exited fullscreen mode');
        } catch (e) {
          warn('[Optimizer] Could not exit fullscreen:', e);
        }
      }
    }, 500);
  }

  // === NOTIFICATION ===
  function showNotification(count) {
    if (silentMode) return;

    const show = () => {
      const notification = document.createElement('div');
      notification.id = 'optimizer-notification';
      notification.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        z-index: 2147483647 !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        animation: optimizerSlideIn 0.3s ease-out !important;
      `;
      notification.textContent = `⚡ Optimizer: ${count} features active`;

      const style = document.createElement('style');
      style.textContent = `
        @keyframes optimizerSlideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'optimizerSlideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    };

    if (document.body) {
      show();
    } else {
      window.addEventListener('DOMContentLoaded', show);
    }
  }

  // === INITIALIZE ===
  function init() {
    if (window.__OPTIMIZER_INITIALIZED__) return;
    window.__OPTIMIZER_INITIALIZED__ = true;

    log('[Optimizer] Initializing with settings:', settings);

    restoreBasics();
    allowKeyboardShortcuts();
    spoofVisibility();
    spoofWindowSize();
    bypassMouseTracking();
    neutralizeTabDetection();
    disableDevToolsDetection();
    isolateStorageAccess();
    monitorAndExitFullscreen();

    const enabledCount = Object.values(settings).filter(Boolean).length;
    log(`[Optimizer] ✅ ${enabledCount} features active`);

    if (enabledCount > 0) {
      showNotification(enabledCount);
    }
  }

  // Run immediately
  init();

})();
