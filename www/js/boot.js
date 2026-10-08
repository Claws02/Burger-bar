// Burger Bar boot loader.
//
// Loads the bundled Three.js, then each game file IN ORDER as a classic script.
// Classic scripts share one global scope, so the split files behave exactly like
// the single inline block they were cut from — with one caveat: a function is
// only callable at load time once the file declaring it has run. Keep boot-time
// calls in 14-main.js (the last file).
//
// Everything ships inside the app bundle; there are no network dependencies.
(function(){
  'use strict';
  var GAME_FILES = [
    '00-settings-audio', '01-renderer', '01a-modelkit', '02-world', '03-items', '04-state-save',
    '05-player', '06-shop-edit', '07-progress', '07a-adaptive', '08-home', '09-menus-dayflow',
    '10-customers', '11-actions', '12-robots', '13-hud-input', '14-main'
  ];
  var PRELUDE = ['js/vendor/capacitor.js', 'js/native.js'];
  var queue = ['js/vendor/three.min.js'].concat(GAME_FILES.map(function(f){ return 'js/game/' + f + '.js'; }));
  window.BURGER_GAME_FILES = GAME_FILES;

  function fail(detail){
    if(window._bootFailed) return; window._bootFailed = true;
    var d = document.createElement('div');
    d.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1f2e;color:#fff;font-family:sans-serif;text-align:center;padding:24px;z-index:10000;";
    d.innerHTML = "<div style='font-size:48px'>🍔</div><h2 style='margin:12px 0 4px'>Burger Bar couldn't start</h2>" +
      "<p style='opacity:.7;max-width:340px'>Something went wrong while loading. Please close and reopen the app.</p>" +
      "<button style='margin-top:14px;padding:10px 22px;border:0;border-radius:12px;background:#1E88E5;color:#fff;font-weight:800;font-size:15px' onclick='location.reload()'>Try again</button>";
    document.body.appendChild(d);
    var sp = document.getElementById('boot-splash'); if(sp) sp.remove();
    if(detail) console.error('Boot failed:', detail);
  }
  // Keep the last few runtime errors on the device (Settings > Export Save
  // bundles nothing private; this is only for diagnosing player reports).
  function logError(msg){
    try {
      var k = 'burgerBoss_errlog', log = JSON.parse(localStorage.getItem(k) || '[]');
      log.push({ t: new Date().toISOString(), m: String(msg).slice(0, 300) });
      while(log.length > 20) log.shift();
      localStorage.setItem(k, JSON.stringify(log));
    } catch(_){}
  }
  window.BurgerLogError = logError;
  window.addEventListener('error', function(e){
    logError((e && e.message) + ' @ ' + (e && e.filename || '').split('/').pop() + ':' + (e && e.lineno));
    // Errors thrown while a game file is first evaluated mean the game never
    // finished booting; surface that instead of a frozen splash.
    if(!window._gameBooted) fail(e && (e.error || e.message));
  });
  window.addEventListener('unhandledrejection', function(e){ logError('promise: ' + (e && e.reason)); });

  function load(src, cb){
    var s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = cb;
    s.onerror = function(){ fail('could not load ' + src); };
    document.body.appendChild(s);
  }
  function next(i){
    if(i >= queue.length){
      window._gameBooted = true;
      if(window.NativeBridge && window.NativeBridge.hideSplash) window.NativeBridge.hideSplash();
      return;
    }
    load(queue[i], function(){
      if(i === 0 && !window.THREE){ fail('THREE missing'); return; }
      if(!window._bootFailed) next(i + 1);
    });
  }
  // Native bridge first (it may restore the save from iOS storage), then the game.
  function start(){
    load(PRELUDE[0], function(){
      load(PRELUDE[1], function(){
        var ready = (window.NativeBridge && window.NativeBridge.ready) || Promise.resolve();
        var go = function(){ if(!window._bootFailed) next(0); };
        // Never let a stuck native call hold the game hostage.
        Promise.race([ready, new Promise(function(r){ setTimeout(r, 2500); })]).then(go, go);
      });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
