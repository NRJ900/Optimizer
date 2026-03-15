// injected.js - ENHANCED VERSION with Proxies and Event Interception

(function() {
  'use strict';

  // Boot with ALL features enabled by default so hooks are in place IMMEDIATELY.
  // The real user config arrives shortly via postMessage from content.js.
  const DEFAULT_FEATURES = {
    textSelection: true, rightClick: true, copyPaste: true, keyboardShortcuts: true,
    visibilitySpoof: true, windowSizeSpoof: true, mouseTracking: true,
    tabDetection: true, devToolsDetection: true, webcamBypass: true,
    micBypass: true, screenShareBypass: true
  };

  // settings is a live object - we will mutate it when real config arrives
  const settings = Object.assign({}, DEFAULT_FEATURES);
  let silentMode = false;
  let customVideoUrl = null;
  let configReceived = false;

  // Listen for config and custom video from content.js
  window.addEventListener('message', (e) => {
    if (!e.data) return;

    if (e.data.type === 'OPTIMIZER_CONFIG' && !configReceived) {
      configReceived = true;
      const realConfig = e.data.data;
      silentMode = realConfig.silentMode || false;

      if (realConfig.disabled) {
        // Disable all features
        Object.keys(settings).forEach(k => settings[k] = false);
        return;
      }

      // Apply real user selections (overwrite defaults with actual chosen values)
      if (realConfig.features) {
        Object.keys(DEFAULT_FEATURES).forEach(k => {
          settings[k] = realConfig.features[k] !== undefined ? realConfig.features[k] : DEFAULT_FEATURES[k];
        });
      }
      if (!silentMode) log('[Enhanced Optimizer] Real config applied:', settings);
    }

    if (e.data.type === 'OPTIMIZER_CUSTOM_VIDEO') {
      customVideoUrl = e.data.data;
      if (!silentMode) log('[Enhanced Optimizer] Received custom video loop data');
    }
  });

  function log(...args) { if (!silentMode) console.log(...args); }
  function warn(...args) { if (!silentMode) console.warn(...args); }

  if (!silentMode) log('⚡ [Enhanced Optimizer] Injected and hooks active (awaiting real config)...');


  // ==========================================
  // UTILITY: NATIVE FUNCTION SPOOFER
  // ==========================================
  // This ensures that when a website calls .toString() on our overridden functions,
  // it returns "[native code]" just like a real browser function.
  const originalToString = Function.prototype.toString;
  const nativeCodeRegex = /\{\s*\[native code\]\s*\}/;

  function makeNative(wrapper, originalName) {
    Object.defineProperty(wrapper, 'name', { value: originalName, configurable: true });
    Object.defineProperty(wrapper, 'toString', {
      value: function() {
        return `function ${originalName}() { [native code] }`;
      },
      configurable: true,
      writable: true
    });
    return wrapper;
  }

  // Hook Function.prototype.toString itself to prevent detection of our toString overrides
  Function.prototype.toString = function() {
    if (this && this.name === 'toString' && !nativeCodeRegex.test(originalToString.call(this))) {
      return `function toString() { [native code] }`;
    }
    if (this && this.toString !== originalToString && this.toString !== Function.prototype.toString) {
      return this.toString();
    }
    return originalToString.call(this);
  };
  Function.prototype.toString.toString = () => `function toString() { [native code] }`;


  // ==========================================
  // UTILITY: EVENT BLACK HOLE (Interception)
  // ==========================================
  const bannedEvents = new Set();
  const storedListeners = new Map(); // target -> [{type, listener, options}]

  if (settings.visibilitySpoof || settings.mouseTracking) {
    if (settings.visibilitySpoof) {
      ['visibilitychange', 'blur', 'focusout', 'pagehide', 'beforeunload'].forEach(e => bannedEvents.add(e));
    }
    if (settings.mouseTracking) {
      ['mouseleave', 'mouseout'].forEach(e => bannedEvents.add(e));
      
      // Also spoof navigator.userActivation to always seem active if requested
      if (navigator.userActivation) {
         Object.defineProperty(navigator.userActivation, 'isActive', { get: makeNative(() => true, 'get isActive'), configurable: true });
         Object.defineProperty(navigator.userActivation, 'hasBeenActive', { get: makeNative(() => true, 'get hasBeenActive'), configurable: true });
      }
    }
    
    // Neuter global event properties (onblur, onmouseleave, etc.) to prevent var assignment tracking
    const neuterProperty = (obj, prop) => {
      try {
        Object.defineProperty(obj, prop, {
          set: makeNative(function(val) {
            log(`[Enhanced Optimizer] Intercepted setter for ${prop}`);
          }, `set ${prop}`),
          get: makeNative(function() { return null; }, `get ${prop}`),
          configurable: true,
        });
      } catch (e) {}
    };

    bannedEvents.forEach(eventType => {
      const prop = 'on' + eventType;
      neuterProperty(window, prop);
      neuterProperty(document, prop);
      if (document.body) neuterProperty(document.body, prop);
      if (document.documentElement) neuterProperty(document.documentElement, prop);
    });

    // Check if the target is a structural global element where anti-cheats usually attach
    const isGlobalTarget = (target) => {
       return target === window || target === document || 
              (target.nodeName && (target.nodeName === 'HTML' || target.nodeName === 'BODY'));
    };
    
    // Some events should be dropped entirely on global targets (like window.onblur)
    const globalBannedEvents = new Set(['blur', 'focusout', 'visibilitychange', 'pagehide', 'beforeunload']);

    const originalAddEventListener = EventTarget.prototype.addEventListener;

    // Track whether the mouse is genuinely inside the browser viewport.
    // We do this BEFORE we patch addEventListener so the site can't see these listeners.
    let mouseInsideWindow = true;
    originalAddEventListener.call(document, 'mouseleave', () => { mouseInsideWindow = false; }, { capture: true });
    originalAddEventListener.call(document, 'mouseenter', () => { mouseInsideWindow = true; }, { capture: true });
    originalAddEventListener.call(document, 'mousemove', () => { mouseInsideWindow = true; }, { capture: true, passive: true });
    originalAddEventListener.call(window, 'focus', () => { mouseInsideWindow = true; });

    EventTarget.prototype.addEventListener = makeNative(function(type, listener, options) {
      // 1. Drop blur/visibility events on Window/Document entirely
      if (settings.visibilitySpoof && globalBannedEvents.has(type) && isGlobalTarget(this)) {
        log(`[Enhanced Optimizer] Intercepted global addEventListener for: ${type}`);
        return; 
      }
      
      // 2. Wrap mouse events everywhere to protect against out-of-bounds tracking
      if (settings.mouseTracking && (type === 'mousemove' || type === 'mouseleave' || type === 'mouseout')) {
         const wrappedListener = function(e) {
           const isOutOfBounds = e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight;
           
           if (type === 'mouseleave' || type === 'mouseout') {
              // Block if mouse is actually outside the browser window (tracked via our hidden listeners)
              if (!mouseInsideWindow || isOutOfBounds || e.relatedTarget === null) {
                  log(`[Enhanced Optimizer] Blocked ${type} (mouseInsideWindow=${mouseInsideWindow})`);
                  e.stopImmediatePropagation();
                  return;
              }
           }
           
           let spoofedEvent = e;
           if (type === 'mousemove' && isOutOfBounds) {
              spoofedEvent = new Proxy(e, {
                 get(target, prop) {
                    if (prop === 'clientX' || prop === 'x') return Math.max(0, Math.min(target.clientX, window.innerWidth - 1));
                    if (prop === 'clientY' || prop === 'y') return Math.max(0, Math.min(target.clientY, window.innerHeight - 1));
                    if (prop === 'pageX') return Math.max(0, Math.min(target.pageX, window.innerWidth - 1));
                    if (prop === 'pageY') return Math.max(0, Math.min(target.pageY, window.innerHeight - 1));
                    const value = target[prop];
                    if (typeof value === 'function') return value.bind(target);
                    return value;
                 }
              });
           }
           
           if (typeof listener === 'function') {
             return listener.call(this, spoofedEvent);
           } else if (listener && typeof listener.handleEvent === 'function') {
             return listener.handleEvent(spoofedEvent);
           }
         };
         return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      
      // 3. Neuter tracking blur on specific elements? (Inputs need blur, so we let them pass)
      return originalAddEventListener.call(this, type, listener, options);
    }, 'addEventListener');
  }

  // ==========================================
  // 1. TEXT SELECTION & RIGHT-CLICK
  // ==========================================
  if (settings.textSelection || settings.rightClick || settings.copyPaste) {
    const style = document.createElement('style');
    // Randomize or omit ID to prevent detection
    style.textContent = `
      *, *::before, *::after {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    const blockedAttrs = [];
    if (settings.rightClick) blockedAttrs.push('oncontextmenu');
    if (settings.textSelection) blockedAttrs.push('onselectstart', 'ondragstart', 'onmousedown');
    if (settings.copyPaste) blockedAttrs.push('oncopy', 'onpaste', 'oncut');

    // Mute inline attributes dynamically
    const observer = new MutationObserver(() => {
      blockedAttrs.forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
          el.removeAttribute(attr);
          el[attr] = null;
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: blockedAttrs });

    // Block native events
    const eventsToUnblock = [];
    if (settings.rightClick) eventsToUnblock.push('contextmenu');
    if (settings.copyPaste) eventsToUnblock.push('copy', 'paste', 'cut');
    if (settings.textSelection) eventsToUnblock.push('selectstart', 'dragstart');

    eventsToUnblock.forEach(eventType => {
      window.addEventListener(eventType, (e) => { e.stopImmediatePropagation(); }, { capture: true });
    });
  }

  // ==========================================
  // 2. KEYBOARD SHORTCUTS
  // ==========================================
  if (settings.keyboardShortcuts) {
    ['keydown', 'keyup', 'keypress'].forEach(eventType => {
      window.addEventListener(eventType, (e) => {
        // Prevent site from cancelling Ctrl+C, Ctrl+V, F12
        if (e.ctrlKey || e.metaKey || e.key === 'F12') {
          e.stopImmediatePropagation();
        }
      }, { capture: true });
    });
  }

  // ==========================================
  // 3. VISIBILITY SPOOFING (Proxies)
  // ==========================================
  if (settings.visibilitySpoof) {
    // We already intercept visibilitychange via EventBlackHole.
    // Now we proxy the document properties.
    const originalHasFocus = Document.prototype.hasFocus;
    Document.prototype.hasFocus = makeNative(function() { return true; }, 'hasFocus');

    const docHiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden') || {};
    Object.defineProperty(Document.prototype, 'hidden', {
      get: makeNative(function() { return false; }, 'get hidden'),
      configurable: true, enumerable: docHiddenDesc.enumerable
    });

    const docVisDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState') || {};
    Object.defineProperty(Document.prototype, 'visibilityState', {
      get: makeNative(function() { return 'visible'; }, 'get visibilityState'),
      configurable: true, enumerable: docVisDesc.enumerable
    });
  }

  // ==========================================
  // 4. WINDOW SIZE / FULLSCREEN (Proxies)
  // ==========================================
  if (settings.windowSizeSpoof) {
    const fakeWidth = screen.width;
    const fakeHeight = screen.height;

    const proxyGetter = (obj, prop, fakeValue) => {
      const desc = Object.getOwnPropertyDescriptor(obj, prop);
      if (desc) {
        Object.defineProperty(obj, prop, {
          get: makeNative(function() { return fakeValue; }, `get ${prop}`),
          configurable: true,
          enumerable: desc.enumerable
        });
      }
    };

    proxyGetter(window, 'innerWidth', fakeWidth);
    proxyGetter(window, 'innerHeight', fakeHeight);
    proxyGetter(window, 'outerWidth', fakeWidth);
    proxyGetter(window, 'outerHeight', fakeHeight);

    // Neuter fullscreen requests
    const elementProto = Element.prototype;
    elementProto.requestFullscreen = makeNative(function() { return Promise.resolve(); }, 'requestFullscreen');
    elementProto.webkitRequestFullscreen = makeNative(function() { return Promise.resolve(); }, 'webkitRequestFullscreen');
    
    document.exitFullscreen = makeNative(function() { return Promise.resolve(); }, 'exitFullscreen');
    
    Object.defineProperty(Document.prototype, 'fullscreenElement', { get: makeNative(function() { return null; }, 'get fullscreenElement'), configurable: true });
  }

  // ==========================================
  // 5. STORAGE ISOLATION (Proxies)
  // ==========================================
  if (settings.tabDetection) {
    const blockedKeys = ['blur_count', 'focus_lost', 'tab_switches', 'tracking', 'suspicious', 'visibility'];
    const shouldBlock = (key) => key && blockedKeys.some(b => key.toLowerCase().includes(b));
    
    const isolateStorage = (storageObj) => {
      const isolated = {};
      const originalGetItem = storageObj.getItem;
      const originalSetItem = storageObj.setItem;
      const originalRemoveItem = storageObj.removeItem;

      storageObj.getItem = makeNative(function(key) {
        if (shouldBlock(key)) return isolated[key] || null;
        return originalGetItem.apply(this, arguments);
      }, 'getItem');

      storageObj.setItem = makeNative(function(key, val) {
        if (shouldBlock(key)) { isolated[key] = String(val); return; }
        return originalSetItem.apply(this, arguments);
      }, 'setItem');

      storageObj.removeItem = makeNative(function(key) {
        if (shouldBlock(key)) { delete isolated[key]; return; }
        return originalRemoveItem.apply(this, arguments);
      }, 'removeItem');
    };

    isolateStorage(Storage.prototype);
  }

  // ==========================================
  // 6. DEVTOOLS DETECTION
  // ==========================================
  if (settings.devToolsDetection) {
    const originalConsole = {
      log: console.log, info: console.info, warn: console.warn, error: console.error, table: console.table, clear: console.clear
    };
    
    // Prevent devtools detection scripts that override console methods and look for errors
    for (const method in originalConsole) {
      console[method] = makeNative(function(...args) {
        return originalConsole[method].apply(console, args);
      }, method);
    }
  }

  // ==========================================
  // 7. WEBCAM & MIC BYPASS
  // ==========================================
  if ((settings.webcamBypass || settings.micBypass) && navigator.mediaDevices) {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    
    if (originalGetUserMedia) {
      navigator.mediaDevices.getUserMedia = makeNative(async function(constraints) {
        log('[Enhanced Optimizer] Intercepted getUserMedia request:', constraints);
        
        const wantsVideo = constraints && constraints.video;
        const wantsAudio = constraints && constraints.audio;

        // If they don't want anything we are spoofing, let it pass
        if ((!wantsVideo || !settings.webcamBypass) && (!wantsAudio || !settings.micBypass)) {
           return originalGetUserMedia.apply(this, arguments);
        }

        const stream = new MediaStream();

        // Spoof Video
        if (wantsVideo && settings.webcamBypass) {
          if (customVideoUrl) {
            // User provided a custom looping video
            const videoEl = document.createElement('video');
            videoEl.autoplay = true;
            videoEl.loop = true;
            videoEl.muted = true; // Mute it so it doesn't leak audio automatically
            videoEl.src = customVideoUrl;
            videoEl.play().catch(e => warn("Could not auto-play custom video loop", e));
            
            // Wait for video to have enough data to capture
            await new Promise(resolve => {
               if (videoEl.readyState >= 2) resolve();
               else videoEl.addEventListener('loadeddata', resolve, { once: true });
            });
            
            const videoStream = videoEl.captureStream();
            stream.addTrack(videoStream.getVideoTracks()[0]);
          } else {
            // Default: Bouncing dot canvas
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');
            
            let x = 0;
            setInterval(() => {
               ctx.fillStyle = '#1a1a1a';
               ctx.fillRect(0,0, canvas.width, canvas.height);
               ctx.fillStyle = '#ffffff';
               ctx.font = '30px Arial';
               ctx.textAlign = 'center';
               ctx.fillText('Camera Spoofed by Optimizer', canvas.width/2, canvas.height/2);
               ctx.fillStyle = '#4CAF50';
               ctx.beginPath();
               ctx.arc(x, 400, 10, 0, Math.PI * 2);
               ctx.fill();
               x = (x + 5) % canvas.width;
            }, 33);
            
            const videoStream = canvas.captureStream(30);
            stream.addTrack(videoStream.getVideoTracks()[0]);
          }
        } else if (wantsVideo && !settings.webcamBypass) {
           // We need real video, but we are spoofing audio. This is complex because we need to merge tracks.
           // For simplicity in this exploit, if they want real video, we just request it.
           try {
             const realStream = await originalGetUserMedia.call(this, { video: constraints.video, audio: false });
             stream.addTrack(realStream.getVideoTracks()[0]);
           } catch(e) { warn("Failed getting real video", e); }
        }

        // Spoof Audio
        if (wantsAudio && settings.micBypass) {
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dst = audioCtx.createMediaStreamDestination();
            
            // Create 2 seconds of white noise buffer
            const bufferSize = audioCtx.sampleRate * 2; 
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              // Very low volume static noise (-0.02 to 0.02)
              data[i] = (Math.random() * 2 - 1) * 0.02; 
            }
            
            const noiseNode = audioCtx.createBufferSource();
            noiseNode.buffer = buffer;
            noiseNode.loop = true;
            noiseNode.connect(dst);
            noiseNode.start();
            
            stream.addTrack(dst.stream.getAudioTracks()[0]);
          } catch(e) { warn("Could not spoof audio", e); }
        } else if (wantsAudio && !settings.micBypass) {
           try {
             const realStream = await originalGetUserMedia.call(this, { video: false, audio: constraints.audio });
             stream.addTrack(realStream.getAudioTracks()[0]);
           } catch(e) { warn("Failed getting real audio", e); }
        }
        
        return stream;
      }, 'getUserMedia');
    }
  }

  // ==========================================
  // 8. SCREEN SHARE BYPASS
  // ==========================================
  if (settings.screenShareBypass && navigator.mediaDevices) {
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
    
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = makeNative(async function(constraints) {
        log('[Enhanced Optimizer] Intercepted getDisplayMedia request');
        
        // Let the user pick whatever they want (Tab/Window/Screen)
        const stream = await originalGetDisplayMedia.apply(this, arguments);
        
        try {
          // Spoof the track properties so the anti-cheat thinks it's the entire screen
          const videoTracks = stream.getVideoTracks();
          for (const track of videoTracks) {
            const originalGetSettings = track.getSettings;
            track.getSettings = makeNative(function() {
              const trackSettings = originalGetSettings.apply(this, arguments);
              log('[Enhanced Optimizer] Spoofing getDisplayMedia track settings');
              trackSettings.displaySurface = 'monitor';
              trackSettings.logicalSurface = true;
              trackSettings.cursor = 'always';
              trackSettings.width = screen.width;
              trackSettings.height = screen.height;
              return trackSettings;
            }, 'getSettings');
            
            Object.defineProperty(track, 'label', {
              get: makeNative(function() { return 'screen:0:0'; }, 'get label'),
              configurable: true,
              enumerable: true
            });
          }
        } catch (e) {
          warn('Error spoofing screen share track', e);
        }
        
        return stream;
      }, 'getDisplayMedia');
    }
  }

  // Notification
  if (!silentMode) {
    const count = Object.values(settings).filter(Boolean).length;
    setTimeout(() => {
      const n = document.createElement('div');
      n.style.cssText = `position:fixed;top:20px;right:20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:12px 20px;border-radius:8px;z-index:999999;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:optimizerSlideIn 0.3s ease-out;`;
      n.innerHTML = `⚡ <b>Enhanced Optimizer:</b> ${count} active`;
      
      const style = document.createElement('style');
      style.textContent = `@keyframes optimizerSlideIn { from { transform: translateX(200px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
      
      document.documentElement.appendChild(style);
      document.documentElement.appendChild(n);
      
      setTimeout(() => {
        n.style.animation = 'optimizerSlideIn 0.3s ease-out reverse';
        setTimeout(() => n.remove(), 300);
      }, 3000);
    }, 500);
  }

})();
