// Burger Bar — native bridge (iOS app via Capacitor; a no-op in the browser).
//
// Loaded by boot.js after vendor/capacitor.js and BEFORE the game files.
// Exposes window.NativeBridge = { native, haptics, ready: Promise }.
//
// Saves: the game keeps using localStorage (synchronous, simple), but on iOS
// WKWebView storage can be purged by the OS under storage pressure. Every
// burgerBoss_* key is therefore mirrored into native UserDefaults through
// @capacitor/preferences, and restored from there at launch if the web copy is
// missing or older. The game code never needs to know.
(function(){
  'use strict';
  var C = window.Capacitor;
  var native = !!(C && C.isNativePlatform && C.isNativePlatform());
  var NB = window.NativeBridge = { native: native, ready: Promise.resolve() };
  if(!native) return;

  var reg = C.registerPlugin;
  var Prefs = reg('Preferences'), Haptics = reg('Haptics'), StatusBar = reg('StatusBar'),
      Splash = reg('SplashScreen'), App = reg('App');
  NB.haptics = Haptics;
  NB.hideSplash = function(){ try { Splash.hide({ fadeOutDuration: 250 }); } catch(e){} };

  var PREFIX = 'burgerBoss_';
  function savedAt(raw){ try { return (JSON.parse(raw) || {}).savedAt || 0; } catch(e){ return -1; } }

  // 1) Restore from native storage before the game reads localStorage.
  NB.ready = Prefs.keys().then(function(res){
    var keys = (res && res.keys || []).filter(function(k){ return k.indexOf(PREFIX) === 0; });
    return Promise.all(keys.map(function(k){
      return Prefs.get({ key: k }).then(function(r){
        var nativeVal = r && r.value;
        if(nativeVal == null) return;
        var webVal = localStorage.getItem(k);
        // The main save carries a timestamp: keep whichever copy is newer.
        var useNative = webVal == null ||
          (k === PREFIX + 'save' && savedAt(nativeVal) > savedAt(webVal));
        if(useNative){ try { localStorage.setItem(k, nativeVal); } catch(e){} }
      });
    }));
  }).catch(function(e){ console.warn('Native restore failed', e); });

  // 2) Mirror every write/remove of our keys to native storage.
  var proto = Storage.prototype, _set = proto.setItem, _remove = proto.removeItem;
  proto.setItem = function(k, v){
    _set.call(this, k, v);
    if(this === window.localStorage && typeof k === 'string' && k.indexOf(PREFIX) === 0){
      Prefs.set({ key: k, value: String(v) }).catch(function(){});
    }
  };
  proto.removeItem = function(k){
    _remove.call(this, k);
    if(this === window.localStorage && typeof k === 'string' && k.indexOf(PREFIX) === 0){
      Prefs.remove({ key: k }).catch(function(){});
    }
  };

  // 3) Chrome: no status bar during play; the web splash takes over from the
  //    native launch screen as soon as the page is up.
  try { StatusBar.hide(); } catch(e){}

  // 4) Lifecycle: pause the shift and save when the app is backgrounded.
  try {
    App.addListener('pause', function(){
      try { if(typeof gameState !== 'undefined' && gameState === 'playing' && !gamePaused) togglePause(); } catch(e){}
      try { if(typeof saveGame === 'function' && gameState !== 'playing') saveGame(); } catch(e){}
    });
    App.addListener('resume', function(){
      try { if(typeof startMusic === 'function' && settings && settings.music !== false && typeof audioCtx !== 'undefined' && audioCtx) audioCtx.resume(); } catch(e){}
    });
  } catch(e){}
})();
