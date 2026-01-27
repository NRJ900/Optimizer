// injected.js - Stealth Mode
(function () {
  'use strict';

  // --- STEALTH CORE ---
  const nativeBind = Function.prototype.bind;
  const nativeToString = Function.prototype.toString;
  const nativeApply = Function.prototype.apply;

  // Anti-detection: Spoof toString to return native code
  function spoofNative(func, name) {
    const p = new Proxy(func, {
      apply(target, thisArg, args) {
        return nativeApply.call(target, thisArg, args);
      },
      get(target, prop) {
        if (prop === 'toString') {
          return new Proxy(nativeToString, {
            apply(t, thisArg, args) {
              // Return standard native string for the function name
              if (thisArg === target || thisArg === p) {
                return `function ${name || func.name}() { [native code] }`;
              }
              return nativeApply.call(t, thisArg, args);
            }
          });
        }
        return target[prop];
      }
    });
    return p;
  }

  // --- CONFIG (Internalized, no global exposure) ---
  const CONFIG = {
    textSelection: true,
    rightClick: true,
    copyPaste: true,
    keyboardShortcuts: true,
    visibilitySpoof: true,
    windowSizeSpoof: true,
    mouseTracking: true,
    tabDetection: true,
    devToolsDetection: true,
    silent: true // Forced silent
  };

  // Try to load from obscured storage key
  try {
    const stored = sessionStorage.getItem('__sys_conf__');
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.assign(CONFIG, parsed.features);
    }
  } catch (e) { }

  // Listens for obscured init event
  document.addEventListener('sys-init', function handler(e) {
    if (e.detail && e.detail.features) {
      Object.assign(CONFIG, e.detail.features);
    }
    document.removeEventListener('sys-init', handler);
  });


  // --- FEATURES ---

  // 1. Restore Text Selection (Style injection + Event Clearing)
  function enableSelection() {
    if (!CONFIG.textSelection) return;

    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{-webkit-user-select:text!important;-moz-user-select:text!important;user-select:text!important;}';
    (document.head || document.documentElement).appendChild(style);

    // Use Proxy to trap event listeners if possible, but for removal we iterate
    const events = ['contextmenu', 'selectstart', 'dragstart', 'mousedown', 'copy', 'paste', 'cut'];

    // Aggressive capture-phase blocking
    events.forEach(evt => {
      window.addEventListener(evt, e => e.stopPropagation(), true);
      document.addEventListener(evt, e => e.stopPropagation(), true);
    });
  }

  // 2. Keyboard Shortcuts
  function enableShortcuts() {
    if (!CONFIG.keyboardShortcuts) return;
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      window.addEventListener(evt, e => e.stopImmediatePropagation(), true);
    });
  }

  // 3. Visibility Spoofing (Proxy-based)
  function spoofVisibility() {
    if (!CONFIG.visibilitySpoof) return;

    // Proxy the document object properties
    Object.defineProperty(document, 'hidden', {
      get: spoofNative(() => false, 'get hidden'),
      configurable: true
    });

    Object.defineProperty(document, 'visibilityState', {
      get: spoofNative(() => 'visible', 'get visibilityState'),
      configurable: true
    });

    // Block events silently
    ['visibilitychange', 'webkitvisibilitychange'].forEach(evt => {
      window.addEventListener(evt, e => e.stopImmediatePropagation(), true);
    });
  }

  // 4. Window Size / Fullscreen (Proxy-based)
  function spoofWindow() {
    if (!CONFIG.windowSizeSpoof) return;

    // Spoof definition of requestFullscreen
    const names = ['requestFullscreen', 'webkitRequestFullscreen', 'mozRequestFullScreen', 'msRequestFullscreen'];
    names.forEach(name => {
      if (Element.prototype[name]) {
        Element.prototype[name] = spoofNative(function () {
          // Silent block
          return Promise.resolve();
        }, name);
      }
    });

    // Screen dimensions
    const screenProps = ['width', 'height', 'availWidth', 'availHeight'];
    screenProps.forEach(prop => {
      try {
        Object.defineProperty(screen, prop, {
          get: spoofNative(() => window.screen[prop], `get ${prop}`) // fallback to real or modify if needed
          // For true spoofing we might want constant values but that breaks layout. 
          // Stealth usually means preventing detection of *changes* or *debugger*.
        });
      } catch (e) { }
    });
  }

  // 5. Mouse Tracking (Proxy EventTarget)
  function bypassMouse() {
    if (!CONFIG.mouseTracking) return;

    // Hook addEventListener to filter mouse leave events
    const origAdd = EventTarget.prototype.addEventListener;
    const blockList = ['mouseleave', 'mouseout', 'blur'];

    EventTarget.prototype.addEventListener = spoofNative(function (type, listener, options) {
      if (blockList.includes(type)) {
        // Silently ignore or wrap
        return;
      }
      return nativeApply.call(origAdd, this, [type, listener, options]);
    }, 'addEventListener');
  }

  // 6. DevTools Detection (Console Proxy)
  function bypassDevTools() {
    if (!CONFIG.devToolsDetection) return;

    // Ensure 'devtools' check returns false
    if (window.devtools) {
      Object.defineProperty(window, 'devtools', {
        get: spoofNative(() => ({ isOpen: false }), 'get devtools'),
        configurable: true
      });
    }
  }

  // --- INIT ---
  // No global flag, or use a very obscure one
  if (window['__sys_ldr_done__']) return;
  window['__sys_ldr_done__'] = true;

  // Run
  enableSelection();
  enableShortcuts();
  spoofVisibility();
  spoofWindow();
  bypassMouse();
  bypassDevTools();

})();

