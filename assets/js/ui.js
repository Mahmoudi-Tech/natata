/* =========================================================
   النطاطة — واجهة المستخدم والتخزين
   ========================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'natata:v1';
  var MAX_RUNS = 8;
  var VERSION = '1.2.2';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    stage: $('stage'),
    canvas: $('gameCanvas'),
    hud: $('hud'),
    pauseBtn: $('pauseBtn'),
    hudSoundBtn: $('hudSoundBtn'),
    hudScore: $('hudScore'),
    hudBest: $('hudBest'),
    hudStars: $('hudStars'),
    comboPill: $('comboPill'),
    comboMult: $('comboMult'),
    comboBar: $('comboBar'),
    boostJet: $('boostJet'),
    boostJetBar: $('boostJetBar'),
    boostMagnet: $('boostMagnet'),
    boostMagnetBar: $('boostMagnetBar'),
    menuScreen: $('menuScreen'),
    overScreen: $('overScreen'),
    pauseScreen: $('pauseScreen'),
    playBtn: $('playBtn'),
    menuSoundBtn: $('menuSoundBtn'),
    themeBtn: $('themeBtn'),
    menuHowBtn: $('menuHowBtn'),
    menuSettingsBtn: $('menuSettingsBtn'),
    installBtn: $('installBtn'),
    scoresBtn: $('scoresBtn'),
    achBtn: $('achBtn'),
    againBtn: $('againBtn'),
    overMenuBtn: $('overMenuBtn'),
    resumeBtn: $('resumeBtn'),
    pauseSoundBtn: $('pauseSoundBtn'),
    pauseRestartBtn: $('pauseRestartBtn'),
    pauseMenuBtn: $('pauseMenuBtn'),
    bestScore: $('bestScore'),
    totalStars: $('totalStars'),
    championCard: $('championCard'),
    championName: $('championName'),
    championScore: $('championScore'),
    recordBadge: $('recordBadge'),
    overTitle: $('overTitle'),
    overScore: $('overScore'),
    overStars: $('overStars'),
    overCombo: $('overCombo'),
    overBest: $('overBest'),
    overTip: $('overTip'),
    nameEntry: $('nameEntry'),
    playerNameInput: $('playerNameInput'),
    saveNameBtn: $('saveNameBtn'),
    nameHint: $('nameHint'),
    pauseScore: $('pauseScore'),
    toasts: $('toasts'),
    flash: $('flash'),
    hint: $('hint'),
    sheetWrap: $('sheetWrap'),
    sheetTitle: $('sheetTitle'),
    sheetBody: $('sheetBody'),
    sheetClose: $('sheetClose'),
    sheetScrim: $('sheetScrim')
  };

  /* ---------- التخزين ---------- */

  var defaults = {
    version: 1,
    best: 0,
    totalStars: 0,
    plays: 0,
    rockets: 0,
    bestCombo: 0,
    playerName: '',
    runs: [],
    ach: {},
    hintSeen: false,
    settings: {
      sfx: true,
      music: true,
      vibrate: true,
      tilt: false,
      reduceMotion: false,
      theme: 'auto'
    }
  };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function loadStore() {
    var data = cloneDefaults();
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) {
        data.settings.reduceMotion = !!(window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        return data;
      }
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return data;

      if (isFinite(saved.best)) data.best = Math.max(0, Math.floor(saved.best));
      if (isFinite(saved.totalStars)) data.totalStars = Math.max(0, Math.floor(saved.totalStars));
      if (isFinite(saved.plays)) data.plays = Math.max(0, Math.floor(saved.plays));
      if (isFinite(saved.rockets)) data.rockets = Math.max(0, Math.floor(saved.rockets));
      if (isFinite(saved.bestCombo)) data.bestCombo = Math.max(0, Math.floor(saved.bestCombo));
      if (typeof saved.playerName === 'string') data.playerName = cleanName(saved.playerName);
      if (Array.isArray(saved.runs)) {
        data.runs = saved.runs.filter(function (r) {
          return r && isFinite(r.m);
        }).slice(0, MAX_RUNS).map(function (r) {
          return {
            m: Math.max(0, Math.floor(r.m)),
            s: Math.max(0, Math.floor(r.s || 0)),
            c: Math.max(0, Math.floor(r.c || 0)),
            d: r.d || Date.now(),
            n: typeof r.n === 'string' ? cleanName(r.n) : ''
          };
        });
      }
      if (saved.ach && typeof saved.ach === 'object') data.ach = saved.ach;
      data.hintSeen = !!saved.hintSeen;
      if (saved.settings && typeof saved.settings === 'object') {
        ['sfx', 'music', 'vibrate', 'tilt', 'reduceMotion'].forEach(function (k) {
          if (typeof saved.settings[k] === 'boolean') data.settings[k] = saved.settings[k];
        });
        var theme = saved.settings.theme;
        if (theme === 'light' || theme === 'dark' || theme === 'auto') data.settings.theme = theme;
      }
    } catch (err) {
      /* تخزين غير متاح أو بيانات تالفة */
    }
    return data;
  }

  var store = loadStore();
  var game = null;
  var deferredPrompt = null;
  var currentSheet = null;
  var resetArmed = false;
  var resetTimer = 0;
  var lastFocus = null;
  var hintTimer = 0;
  var lastMeters = 0;
  var activeRun = null;
  var nameDirty = false;
  var savedNameTimer = 0;

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (err) { /* تجاهل */ }
  }

  /* ---------- أدوات ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cleanName(raw) {
    return String(raw == null ? '' : raw)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
  }

  function displayName(name) {
    return cleanName(name) || 'لاعب';
  }

  function fmt(n) {
    n = Math.max(0, Math.floor(n || 0));
    try {
      return n.toLocaleString('ar-EG');
    } catch (err) {
      return String(n);
    }
  }

  function dateLabel(ts) {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' }).format(new Date(ts));
    } catch (err) {
      var d = new Date(ts);
      return d.getDate() + '/' + (d.getMonth() + 1);
    }
  }

  function vibrate(pattern) {
    if (!store.settings.vibrate) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (err) { /* تجاهل */ }
    }
  }

  function clickSound() {
    if (audio()) audio().click();
  }

  function audio() { return window.NatataAudio || null; }

  function isMuted() { return !store.settings.sfx; }

  /* ---------- الوضع النهاري / الليلي ---------- */

  var themeMedia = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function resolvedTheme() {
    var mode = store.settings.theme;
    if (mode === 'light' || mode === 'dark') return mode;
    return themeMedia && themeMedia.matches ? 'dark' : 'light';
  }

  function paintThemeButtons() {
    var isDark = resolvedTheme() === 'dark';
    if (el.themeBtn) {
      var label = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
      el.themeBtn.setAttribute('aria-label', label);
      el.themeBtn.title = label;
    }
    var picks = document.querySelectorAll('[data-theme-choice]');
    for (var i = 0; i < picks.length; i++) {
      var on = picks[i].getAttribute('data-theme-choice') === store.settings.theme;
      picks[i].classList.toggle('is-on', on);
      picks[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function applyTheme() {
    var mode = resolvedTheme();
    var root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
    var meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#0a1526' : '#5cc8f7');
    paintThemeButtons();
  }

  function setTheme(mode, silent) {
    if (mode !== 'auto' && mode !== 'light' && mode !== 'dark') return;
    store.settings.theme = mode;
    save();
    applyTheme();
    paintSettingsSheet();
    if (silent) return;
    if (mode === 'dark') {
      toast('الوضع الليلي شغال — عيون مرتاحة', 'mint', '🌙');
    } else if (mode === 'light') {
      toast('الوضع النهاري شغال', 'gold', '☀️');
    } else {
      toast('الشكل بيتبع إعداد جهازك تلقائيًا', null, '🎛️');
    }
  }

  function toggleTheme() {
    clickSound();
    setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
  }

  /* ---------- التنبيهات ---------- */

  function toast(text, kind, ico) {
    if (!el.toasts) return;
    while (el.toasts.children.length >= 3) {
      el.toasts.removeChild(el.toasts.firstChild);
    }
    var node = document.createElement('div');
    node.className = 'toast' + (kind ? ' toast--' + kind : '');
    node.innerHTML = (ico ? '<span class="toast__ico">' + ico + '</span>' : '') +
      '<span>' + esc(text) + '</span>';
    el.toasts.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 3200);
  }

  function flash() {
    if (!el.flash || store.settings.reduceMotion) return;
    el.flash.classList.remove('is-on');
    void el.flash.offsetWidth;
    el.flash.classList.add('is-on');
  }

  /* ---------- الصوت ---------- */

  function applyAudioSettings() {
    var a = audio();
    if (!a) return;
    a.setMuted(isMuted());
    a.setMusicEnabled(store.settings.music && store.settings.sfx);

    if (game && (game.state === 'playing')) {
      if (store.settings.music && store.settings.sfx) a.startMusic();
      else a.stopMusic();
    }
  }

  function paintSoundButtons() {
    var muted = isMuted();
    var href = muted ? '#i-mute' : '#i-sound';
    var nodes = document.querySelectorAll('.js-sound-use');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('href', href);
    }

    var label = muted ? 'الصوت مكتوم' : 'الصوت مفعّل';
    var labels = document.querySelectorAll('.js-sound-label');
    for (var j = 0; j < labels.length; j++) labels[j].textContent = label;

    [el.menuSoundBtn, el.hudSoundBtn, el.pauseSoundBtn].forEach(function (btn) {
      if (!btn) return;
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.setAttribute('aria-label', muted ? 'تشغيل الصوت' : 'كتم الصوت');
    });
  }

  function toggleSound() {
    store.settings.sfx = !store.settings.sfx;
    save();
    applyAudioSettings();
    paintSoundButtons();
    if (store.settings.sfx) {
      if (audio()) audio().resume();
      clickSound();
      toast('الصوت رجع... اسمع النغم!', 'mint', '🔊');
    } else {
      toast('تم كتم الصوت', null, '🔇');
    }
  }

  /* ---------- الإعدادات ---------- */

  function applyGameSettings() {
    if (!game) return;
    game.setReduceMotion(store.settings.reduceMotion);
    if (!store.settings.reduceMotion) {
      document.body.classList.remove('reduce-motion');
    } else {
      document.body.classList.add('reduce-motion');
    }
    if (!store.settings.tilt) game.setTilt(false);
    else game.setTilt(true);
  }

  function requestTiltPermission(cb) {
    var DOE = window.DeviceOrientationEvent;
    if (!DOE) {
      cb(false, 'جهازك ما يدعم الإمالة، استخدم اللمس أو الكيبورد.');
      return;
    }

    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse && !('ontouchstart' in window)) {
      cb(false, 'الإمالة للموبايل فقط — على الكمبيوتر استخدم ← →.');
      return;
    }

    if (typeof DOE.requestPermission === 'function') {
      var settled = false;
      var finish = function (ok, msg) {
        if (settled) return;
        settled = true;
        cb(ok, msg);
      };
      var timer = window.setTimeout(function () {
        finish(false, 'ما وصل رد من إذن الإمالة، جرّب مرة ثانية.');
      }, 8000);

      try {
        DOE.requestPermission().then(function (res) {
          window.clearTimeout(timer);
          finish(res === 'granted', res === 'granted' ? null : 'ما قدرت أخذ إذن الإمالة.');
        }).catch(function () {
          window.clearTimeout(timer);
          finish(false, 'ما قدرت أخذ إذن الإمالة.');
        });
      } catch (err) {
        window.clearTimeout(timer);
        finish(false, 'ما قدرت أطلب إذن الإمالة.');
      }
    } else {
      cb(true, null);
    }
  }

  function setSetting(key, value) {
    if (key === 'tilt' && value) {
      requestTiltPermission(function (ok, msg) {
        if (!ok) {
          store.settings.tilt = false;
          save();
          paintSettingsSheet();
          toast(msg || 'الإمالة غير متاحة.', null, '📱');
          return;
        }
        store.settings.tilt = true;
        save();
        game.setTilt(true);
        paintSettingsSheet();
        toast('الإمالة شغالة — ميل جهازك يمين وشمال', 'mint', '📱');
      });
      return;
    }

    store.settings[key] = !!value;
    save();
    applyGameSettings();
    applyAudioSettings();
    paintSoundButtons();
    paintSettingsSheet();

    if (key === 'vibrate') {
      if (value) vibrate(18);
    }
  }

  function paintSettingsSheet() {
    paintThemeButtons();
    var inputs = el.sheetBody.querySelectorAll('[data-setting]');
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute('data-setting');
      if (key && key in store.settings) inputs[i].checked = !!store.settings[key];
    }
    if (resetArmed) {
      var btn = el.sheetBody.querySelector('[data-action="reset"]');
      if (btn) {
        btn.classList.add('is-armed');
        btn.innerHTML = 'متأكد؟ اضغط مرة ثانية للمسح';
      }
    }
  }

  function disarmReset() {
    resetArmed = false;
    if (resetTimer) {
      window.clearTimeout(resetTimer);
      resetTimer = 0;
    }
  }

  function resetProgress() {
    var settings = store.settings;
    var hintSeen = store.hintSeen;
    var playerName = store.playerName;
    store = cloneDefaults();
    store.settings = settings;
    store.hintSeen = hintSeen;
    store.playerName = playerName;
    activeRun = null;
    save();
    if (game && game.state === 'playing') {
      game.toMenu();
    }
    showMenu();
    paintSettingsSheet();
    paintMenuStats();
    if (window.NatataUI) window.NatataUI.store = store;
    toast('بدأنا من جديد — كل الأرقام انمسحت', null, '🧹');
  }

  /* ---------- الإنجازات ---------- */

  var ACHIEVEMENTS = [
    { id: 'first', ico: '🐣', title: 'أول قفزة', desc: 'العب أول جولة', test: function (s) { return s.plays >= 1; } },
    { id: 'm100', ico: '☁️', title: 'فوق السحاب', desc: 'وصل ١٠٠ متر', test: function (s) { return s.best >= 100; } },
    { id: 'm250', ico: '🌤️', title: 'هوا أرق', desc: 'وصل ٢٥٠ متر', test: function (s) { return s.best >= 250; } },
    { id: 'm500', ico: '🚀', title: 'عابر الغلاف', desc: 'وصل ٥٠٠ متر', test: function (s) { return s.best >= 500; } },
    { id: 'star50', ico: '⭐', title: 'جامع النجوم', desc: 'اجمع ٥٠ نجمة', test: function (s) { return s.totalStars >= 50; } },
    { id: 'star250', ico: '🌟', title: 'صائد النجوم', desc: 'اجمع ٢٥٠ نجمة', test: function (s) { return s.totalStars >= 250; } },
    { id: 'combo5', ico: '🔥', title: 'كومبو خماسي', desc: 'وصل كومبو ×2', test: function (s) { return s.bestCombo >= 5; } },
    { id: 'combo15', ico: '⚡', title: 'سلسلة ذهبية', desc: 'وصل كومبو ١٥ قفزة', test: function (s) { return s.bestCombo >= 15; } },
    { id: 'rocket', ico: '🧨', title: 'إقلاع!', desc: 'استخدم صاروخ', test: function (s) { return s.rockets >= 1; } },
    { id: 'legend', ico: '👑', title: 'أسطورة السماء', desc: 'وصل ١٠٠٠ متر', test: function (s) { return s.best >= 1000; } }
  ];

  function checkAchievements() {
    var fresh = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!store.ach[a.id] && a.test(store)) {
        store.ach[a.id] = Date.now();
        fresh.push(a);
      }
    });
    if (fresh.length) save();
    return fresh;
  }

  /* ---------- شاشات ---------- */

  function setScreen(name) {
    el.menuScreen.hidden = name !== 'menu';
    el.overScreen.hidden = name !== 'over';
    el.pauseScreen.hidden = name !== 'pause';
    el.hud.hidden = !(name === 'playing' || name === 'pause' || name === 'over');
    el.comboPill.hidden = name !== 'playing';
    el.boostJet.hidden = true;
    el.boostMagnet.hidden = true;
    if (name !== 'playing' && name !== 'pause') hideHint(true);
  }

  function showMenu() {
    closeSheet();
    setScreen('menu');
    paintMenuStats();
    el.hudScore.textContent = '0';
    el.hudStars.textContent = '0';
  }

  function startGame() {
    if (!game) return;
    commitNameIfNeeded();
    closeSheet();
    if (audio()) audio().resume();
    clickSound();
    lastMeters = 0;
    activeRun = null;
    nameDirty = false;
    el.overScreen.hidden = true;
    el.pauseScreen.hidden = true;
    el.menuScreen.hidden = true;
    el.hud.hidden = false;
    el.hudScore.textContent = '0';
    el.hudStars.textContent = '0';
    el.hudBest.textContent = fmt(store.best);
    el.comboPill.hidden = true;
    el.boostJet.hidden = true;
    el.boostMagnet.hidden = true;
    el.recordBadge.hidden = true;
    game.start();
    applyAudioSettings();
    if (!store.hintSeen) showHint();
  }

  function pauseGame() {
    if (!game || game.state !== 'playing') return;
    clickSound();
    game.pause();
    el.pauseScore.textContent = fmt(game.metersVal);
    setScreen('pause');
    paintSoundButtons();
  }

  function resumeGame() {
    if (!game || game.state !== 'paused') return;
    clickSound();
    el.pauseScreen.hidden = true;
    el.hud.hidden = false;
    game.resume();
    applyAudioSettings();
  }

  function goMenu() {
    commitNameIfNeeded();
    clickSound();
    if (game) game.toMenu();
    activeRun = null;
    nameDirty = false;
    showMenu();
  }

  /* ---------- التلميح ---------- */

  function showHint() {
    if (!el.hint) return;
    el.hint.hidden = false;
    el.hint.classList.remove('is-out');
    if (hintTimer) window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(function () { hideHint(false); }, 4200);
  }

  function hideHint(instant) {
    if (!el.hint || el.hint.hidden) return;
    if (hintTimer) {
      window.clearTimeout(hintTimer);
      hintTimer = 0;
    }
    if (instant || store.settings.reduceMotion) {
      el.hint.hidden = true;
      return;
    }
    el.hint.classList.add('is-out');
    window.setTimeout(function () { el.hint.hidden = true; }, 450);
  }

  function markHintSeen() {
    if (store.hintSeen) return;
    store.hintSeen = true;
    save();
    hideHint(false);
  }

  /* ---------- تحديث الواجهة ---------- */

  function paintMenuStats() {
    el.bestScore.textContent = fmt(store.best);
    el.totalStars.textContent = fmt(store.totalStars);
    el.hudBest.textContent = fmt(store.best);

    var champ = store.runs && store.runs.length ? store.runs[0] : null;
    if (champ && champ.m > 0) {
      el.championCard.hidden = false;
      el.championName.textContent = displayName(champ.n);
      el.championScore.textContent = fmt(champ.m);
    } else if (store.best > 0) {
      el.championCard.hidden = false;
      el.championName.textContent = displayName(store.playerName);
      el.championScore.textContent = fmt(store.best);
    } else {
      el.championCard.hidden = true;
    }
  }

  function paintChampion() {
    var champ = store.runs && store.runs.length ? store.runs[0] : null;
    if (champ && champ.m > 0) {
      el.championCard.hidden = false;
      el.championName.textContent = displayName(champ.n);
      el.championScore.textContent = fmt(champ.m);
    }
  }

  function savePlayerName(silent) {
    var name = cleanName(el.playerNameInput.value);
    if (!name) {
      if (!silent) {
        toast('اكتب اسمك الأول — حرفين على الأقل.', null, '✍️');
        el.playerNameInput.focus();
      }
      return;
    }

    store.playerName = name;
    if (activeRun) activeRun.n = name;
    save();
    paintMenuStats();
    paintChampion();

    el.playerNameInput.value = name;
    nameDirty = false;
    if (!silent) {
      var isChampion = activeRun && store.runs[0] === activeRun && activeRun.m > 0;
      if (isChampion) {
        toast('بطل جديد: ' + name + ' — ' + fmt(activeRun.m) + ' متر!', 'gold', '👑');
      } else {
        toast('ثبت اسمك: ' + name, 'mint', '👑');
      }
      if (el.saveNameBtn) {
        el.saveNameBtn.textContent = 'تم ✓';
        el.saveNameBtn.classList.add('is-saved');
        if (savedNameTimer) window.clearTimeout(savedNameTimer);
        savedNameTimer = window.setTimeout(function () {
          el.saveNameBtn.textContent = 'حفظ';
          el.saveNameBtn.classList.remove('is-saved');
        }, 1500);
      }
    }
  }

  function commitNameIfNeeded() {
    if (!el.playerNameInput) return;
    if (!el.overScreen.hidden && (nameDirty || !store.playerName)) {
      var v = cleanName(el.playerNameInput.value);
      if (v) savePlayerName(true);
    }
  }

  function updateScore(m) {
    el.hudScore.textContent = fmt(m);
    if (m > lastMeters) {
      lastMeters = m;
      if (!store.settings.reduceMotion && m % 10 === 0) {
        el.hudScore.classList.remove('is-bump');
        void el.hudScore.offsetWidth;
        el.hudScore.classList.add('is-bump');
      }
    }
  }

  function updateCombo(mult, streak) {
    if (mult > 1) {
      el.comboPill.hidden = false;
      el.comboMult.textContent = '×' + mult;
      var inLevel = streak % 5;
      var pct = (inLevel / 5) * 100;
      if (inLevel === 0 && streak > 0) pct = 100;
      el.comboBar.style.width = pct + '%';
    } else {
      el.comboPill.hidden = true;
      el.comboBar.style.width = '0%';
    }
  }

  function updateBoosts(b) {
    var jet = b.jetpack > 0;
    var mag = b.magnet > 0;
    if (el.boostJet.hidden === jet) el.boostJet.hidden = !jet;
    if (el.boostMagnet.hidden === mag) el.boostMagnet.hidden = !mag;
    el.boostJetBar.style.width = Math.max(0, Math.min(100, (b.jetpack / 1.9) * 100)) + '%';
    el.boostMagnetBar.style.width = Math.max(0, Math.min(100, (b.magnet / 7) * 100)) + '%';
  }

  function showGameOver(result) {
    setScreen('over');
    el.hud.hidden = true;

    var isRecord = result.meters > store.best;
    var prevBest = store.best;
    activeRun = null;
    nameDirty = false;

    store.plays++;
    store.totalStars += result.stars;
    store.rockets += result.rocketsUsed || 0;
    if (result.maxStreak > store.bestCombo) store.bestCombo = result.maxStreak;
    if (result.meters > store.best) store.best = result.meters;

    if (result.meters > 0 || result.stars > 0) {
      var run = {
        m: result.meters,
        s: result.stars,
        c: result.maxStreak,
        d: Date.now(),
        n: store.playerName || ''
      };
      store.runs.push(run);
      store.runs.sort(function (a, b) { return (b.m - a.m) || (b.s - a.s); });
      if (store.runs.length > MAX_RUNS) store.runs.length = MAX_RUNS;
      if (store.runs.indexOf(run) >= 0) activeRun = run;
    }

    save();
    paintMenuStats();

    el.recordBadge.hidden = !isRecord;
    el.overScore.textContent = fmt(result.meters);
    el.overStars.textContent = fmt(result.stars);
    el.overCombo.textContent = '×' + (1 + Math.min(4, Math.floor(result.maxStreak / 5)));
    el.overBest.textContent = fmt(store.best);
    el.overTip.textContent = pickTip(result, isRecord, prevBest);

    el.playerNameInput.value = store.playerName || '';
    el.saveNameBtn.textContent = 'حفظ';
    el.saveNameBtn.classList.remove('is-saved');
    if (savedNameTimer) {
      window.clearTimeout(savedNameTimer);
      savedNameTimer = 0;
    }
    el.nameEntry.classList.toggle('is-record', isRecord && result.meters > 0);
    if (isRecord && result.meters > 0) {
      el.nameHint.textContent = 'رقم قياسي جديد! اكتب اسمك عشان يظهر فوق كبطل النطاطة.';
    } else if (activeRun) {
      var rank = store.runs.indexOf(activeRun) + 1;
      el.nameHint.textContent = 'مركزك #' + fmt(rank) + ' على هذا الجهاز — اسمك يظهر في لوحة الأبطال.';
    } else {
      el.nameHint.textContent = 'اكتب اسمك عشان يتحفظ مع جولاتك الجاية.';
    }

    if (result.meters < 30) el.overTitle.textContent = 'ما تأثرت؟';
    else if (result.meters < 100) el.overTitle.textContent = 'بداية حلوة!';
    else if (result.meters < 250) el.overTitle.textContent = 'محاولة حلوة!';
    else if (result.meters < 500) el.overTitle.textContent = 'وصلت بعيد!';
    else el.overTitle.textContent = 'أسطورة السماء!';

    if (isRecord && result.meters > 0) {
      flash();
      if (audio()) audio().record();
    } else {
      clickSound();
    }

    var unlocked = checkAchievements();
    unlocked.forEach(function (a, i) {
      window.setTimeout(function () {
        toast('إنجاز جديد: ' + a.title, 'gold', a.ico);
      }, 500 + i * 650);
    });

    if (!store.hintSeen) {
      store.hintSeen = true;
      save();
    }
  }

  function pickTip(result, isRecord, prevBest) {
    if (isRecord && result.meters > 0) {
      return 'رقم قياسي جديد! الفرق ' + fmt(result.meters - prevBest) + ' متر عن أفضل نتيجة سابقة.';
    }
    if (result.maxStreak >= 15) {
      return 'سلسلة ' + fmt(result.maxStreak) + ' قفزة! حافظ على الكومبو عشان تضاعف النجوم.';
    }
    if (result.stars === 0) {
      return 'نصيحة: النجوم تنزل قريبة من المنصات، جرّب تلمسها في طريقك.';
    }
    if (result.rocketsUsed > 0) {
      return 'الصاروخ يطير فيك فوق بسرعة — استغله تجمع نجوم أكثر.';
    }
    if (result.meters < store.best) {
      return 'أفضل نتيجة عندك ' + fmt(store.best) + ' متر... تقدر تكسرها؟';
    }
    return 'جرّب المنصات السحابية، نطتها أعلى وتوصل للنجوم البعيدة.';
  }

  /* ---------- الشيت ---------- */

  function openSheet(title, html, onPaint) {
    lastFocus = document.activeElement;
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = html;
    el.sheetWrap.hidden = false;
    currentSheet = onPaint || null;
    if (currentSheet) currentSheet();
    window.setTimeout(function () { el.sheetClose.focus(); }, 30);
    clickSound();
  }

  function closeSheet() {
    if (!el.sheetWrap || el.sheetWrap.hidden) return;
    el.sheetWrap.hidden = true;
    currentSheet = null;
    disarmReset();
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus(); } catch (err) { /* تجاهل */ }
    }
    lastFocus = null;
  }

  function settingsHtml() {
    return '' +
      '<div class="sheet__section">' +
        '<h3>الشكل</h3>' +
        '<div class="theme-pick" role="group" aria-label="وضع الألوان">' +
          '<button type="button" data-theme-choice="auto">تلقائي 🎛️</button>' +
          '<button type="button" data-theme-choice="light">نهاري ☀️</button>' +
          '<button type="button" data-theme-choice="dark">ليلي 🌙</button>' +
        '</div>' +
        '<p class="sheet__note">الوضع الليلي يخفف الضوء ويريّح عينك بالليل، والسماء في اللعبة تصير ليل بنجوم. زر 🌙/☀️ فوق يبدّل بسرعة.</p>' +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>اللاعب</h3>' +
        '<div class="name-entry name-entry--settings">' +
          '<label class="name-entry__label" for="settingsNameInput">🏷️ اسمك في لوحة الأبطال</label>' +
          '<div class="name-entry__row">' +
            '<input id="settingsNameInput" type="text" maxlength="16" autocomplete="nickname"' +
              ' dir="auto" enterkeyhint="done" placeholder="مثال: سارة" value="' + esc(store.playerName || '') + '">' +
            '<button type="button" data-action="save-profile">حفظ</button>' +
          '</div>' +
          '<small class="name-entry__hint">يتسجل مع كل جولة جديدة. تقدر تغيّره بعد كل جولة.</small>' +
        '</div>' +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>الصوت واللمس</h3>' +
        settingRow('sfx', '🔊', 'المؤثرات الصوتية', 'أصوات القفز والنجوم والكومبو') +
        settingRow('music', '🎵', 'الموسيقى', 'لحن خفيف يشتغل أثناء اللعب') +
        settingRow('vibrate', '📳', 'الاهتزاز', 'ارتجاف بسيط عند النجوم والأرقام القياسية') +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>التحكم</h3>' +
        settingRow('tilt', '📱', 'التحكم بالإمالة', 'ميل الجهاز يمين أو شمال بدل اللمس') +
        settingRow('reduceMotion', '🌿', 'تقليل الحركة', 'يخفف الاهتزاز والجزيئات والأنيميشن') +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>البيانات</h3>' +
        '<div class="settings-actions">' +
          '<button class="danger-btn" type="button" data-action="reset">مسح كل التقدم والنتائج</button>' +
        '</div>' +
        '<p class="sheet__note">كل شيء محفوظ على جهازك فقط. ما فيه حسابات ولا إنترنت مطلوب.</p>' +
      '</div>' +
      '<div class="about-card">' +
        '<b>النطاطة ' + VERSION + '</b>' +
        '<p>لعبة قفز لا نهائية.<br>اجمع النجوم، اكسر رقمك، وما توقف.</p>' +
        '<p class="about-card__rights">© جميع الحقوق محفوظة لـ The Witcher Store</p>' +
      '</div>';
  }

  function settingRow(key, ico, title, desc) {
    return '' +
      '<div class="set-row">' +
        '<span class="set-row__ico" aria-hidden="true">' + ico + '</span>' +
        '<span class="set-row__main"><b>' + title + '</b><small>' + desc + '</small></span>' +
        '<label class="switch">' +
          '<input type="checkbox" data-setting="' + key + '"' +
            (store.settings[key] ? ' checked' : '') +
            ' aria-label="' + title + '">' +
          '<span class="switch__track"></span>' +
        '</label>' +
      '</div>';
  }

  function howHtml() {
    return '' +
      '<div class="sheet__section">' +
        '<h3>الهدف</h3>' +
        '<ul class="steps">' +
          '<li><span>١</span><div><b>اقفز واطلع فوق</b><p>شخصيتك تنط لوحدها. حرّكها يمين وشمال عشان تحط رجلك على المنصة اللي فوق.</p></div></li>' +
          '<li><span>٢</span><div><b>تحكم باللمس أو الكيبورد</b><p>اسحب إصبعك على الشاشة، أو استخدم ← →. تقدر تشغّل الإمالة من الإعدادات.</p></div></li>' +
          '<li><span>٣</span><div><b>اجمع النجوم</b><p>كل نجمة تزيد مجموعك. النجمة الكبيرة تساوي ٥ نجوم، والكومبو يضاعف قيمتها.</p></div></li>' +
          '<li><span>٤</span><div><b>لا تطيح</b><p>لو نزلت تحت الشاشة تنتهي الجولة. كل ما طلعت أعلى، صارت المنصات أصعب.</p></div></li>' +
        '</ul>' +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>أنواع المنصات</h3>' +
        '<ul class="legend">' +
          '<li><span class="dot dot--grass"></span>عشب عادي</li>' +
          '<li><span class="dot dot--spring"></span>سوستة — نطة قوية</li>' +
          '<li><span class="dot dot--ice"></span>جليد متحرك</li>' +
          '<li><span class="dot dot--wood"></span>خشب يتكسر</li>' +
          '<li><span class="dot dot--cloud"></span>سحابة — نطة عالية</li>' +
        '</ul>' +
        '<div class="pickups-note">' +
          '<span>⭐ نجمة</span><span>🌟 كبيرة = ٥</span><span>🚀 صاروخ</span><span>🧲 مغناطيس</span>' +
        '</div>' +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>أسرار صغيرة</h3>' +
        '<ul class="steps">' +
          '<li><span>✦</span><div><b>الكومبو</b><p>كل منصة جديدة تزيد السلسلة. كل ٥ قفزات يزيد المضاعف لحد ×5.</p></div></li>' +
          '<li><span>✦</span><div><b>كل ١٠٠ متر</b><p>نغمة احتفال... وسماء جديدة: غروب، ليل، نجوم، وشفق.</p></div></li>' +
        '</ul>' +
      '</div>';
  }

  function scoresHtml() {
    if (!store.runs.length) {
      return '' +
        '<div class="empty-state">' +
          '<b>🌱</b>' +
          'ما فيه نتائج بعد.<br>اضغط «ابدأ اللعب» واكتب أول رقم لك.' +
        '</div>' +
        '<div class="sheet__section">' +
          '<h3>ملخصك</h3>' +
          '<div class="over__grid">' +
            '<div><span>أفضل مسافة</span><b>' + fmt(store.best) + '</b></div>' +
            '<div><span>النجوم</span><b>' + fmt(store.totalStars) + '</b></div>' +
            '<div><span>الجولات</span><b>' + fmt(store.plays) + '</b></div>' +
          '</div>' +
        '</div>';
    }

    var rows = store.runs.map(function (r, i) {
      return '' +
        '<li>' +
          '<span class="rank">' + (i === 0 ? '👑' : i + 1) + '</span>' +
          '<span class="score-list__main">' +
            '<b class="score-list__name">' + esc(displayName(r.n)) + '</b>' +
            '<small>⭐ ' + fmt(r.s || 0) + ' · كومبو ×' + (1 + Math.min(4, Math.floor((r.c || 0) / 5))) + '</small>' +
          '</span>' +
          '<span class="score-list__score"><b>' + fmt(r.m) + '</b><small>م</small></span>' +
          '<time datetime="' + new Date(r.d || Date.now()).toISOString() + '">' + dateLabel(r.d) + '</time>' +
        '</li>';
    }).join('');

    return '' +
      '<div class="sheet__section">' +
        '<h3>أفضل ' + store.runs.length + ' جولات</h3>' +
        '<ul class="score-list">' + rows + '</ul>' +
      '</div>' +
      '<div class="sheet__section">' +
        '<h3>ملخصك</h3>' +
        '<div class="over__grid">' +
          '<div><span>أفضل مسافة</span><b>' + fmt(store.best) + '</b></div>' +
          '<div><span>النجوم</span><b>' + fmt(store.totalStars) + '</b></div>' +
          '<div><span>الجولات</span><b>' + fmt(store.plays) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<p class="sheet__note">النتائج محفوظة على هذا الجهاز، وتشتغل حتى بدون إنترنت.</p>';
  }

  function achHtml() {
    var unlockedCount = ACHIEVEMENTS.filter(function (a) { return !!store.ach[a.id]; }).length;
    var rows = ACHIEVEMENTS.map(function (a) {
      var got = !!store.ach[a.id];
      return '' +
        '<div class="ach' + (got ? '' : ' is-locked') + '">' +
          '<span class="ach__ico" aria-hidden="true">' + a.ico + '</span>' +
          '<span class="ach__main"><b>' + a.title + '</b><small>' + a.desc + '</small></span>' +
          '<span class="ach__state">' + (got ? '✓ تم' : 'مقفول') + '</span>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="sheet__section">' +
        '<h3>فتحت ' + unlockedCount + ' من ' + ACHIEVEMENTS.length + '</h3>' +
        '<div class="ach-list">' + rows + '</div>' +
      '</div>' +
      '<p class="sheet__note">الإنجازات تنفتح تلقائيًا بعد كل جولة. ما تحتاج تسوي شيء غير إنك تلعب.</p>';
  }

  /* ---------- التثبيت ---------- */

  function showInstallUi(show) {
    if (el.installBtn) el.installBtn.hidden = !show;
    var chip = document.getElementById('installChip');
    if (chip) chip.hidden = true;
  }

  function promptInstall() {
    if (!deferredPrompt) {
      toast('من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية».', 'mint', '📲');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      if (choice && choice.outcome === 'accepted') {
        toast('تم تثبيت النطاطة!', 'mint', '🎉');
        showInstallUi(false);
      }
      deferredPrompt = null;
    }).catch(function () { deferredPrompt = null; });
  }

  /* ---------- ربط الأحداث ---------- */

  function bind() {
    el.playBtn.addEventListener('click', startGame);
    el.againBtn.addEventListener('click', startGame);
    el.overMenuBtn.addEventListener('click', goMenu);
    el.pauseBtn.addEventListener('click', pauseGame);
    el.resumeBtn.addEventListener('click', resumeGame);
    el.pauseRestartBtn.addEventListener('click', startGame);
    el.pauseMenuBtn.addEventListener('click', goMenu);

    el.menuSoundBtn.addEventListener('click', toggleSound);
    el.hudSoundBtn.addEventListener('click', toggleSound);
    el.pauseSoundBtn.addEventListener('click', toggleSound);

    if (el.themeBtn) el.themeBtn.addEventListener('click', toggleTheme);

    el.saveNameBtn.addEventListener('click', function () {
      savePlayerName(false);
    });

    el.playerNameInput.addEventListener('input', function () {
      nameDirty = true;
    });

    el.playerNameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        savePlayerName(false);
        el.playerNameInput.blur();
      }
    });

    el.menuHowBtn.addEventListener('click', function () {
      openSheet('كيف ألعب', howHtml());
    });
    el.menuSettingsBtn.addEventListener('click', function () {
      openSheet('الإعدادات', settingsHtml(), paintSettingsSheet);
    });
    el.scoresBtn.addEventListener('click', function () {
      openSheet('لوحة الأبطال', scoresHtml());
    });
    el.achBtn.addEventListener('click', function () {
      openSheet('الإنجازات', achHtml());
    });

    el.sheetClose.addEventListener('click', closeSheet);
    el.sheetScrim.addEventListener('click', closeSheet);

    el.sheetBody.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || !input.getAttribute) return;
      var key = input.getAttribute('data-setting');
      if (!key) return;
      setSetting(key, input.checked);
    });

    el.sheetBody.addEventListener('click', function (e) {
      var themeChoice = e.target.closest ? e.target.closest('[data-theme-choice]') : null;
      if (themeChoice) {
        setTheme(themeChoice.getAttribute('data-theme-choice'));
        return;
      }
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'reset') {
        if (!resetArmed) {
          resetArmed = true;
          btn.classList.add('is-armed');
          btn.textContent = 'متأكد؟ اضغط مرة ثانية للمسح';
          resetTimer = window.setTimeout(disarmReset, 4000);
        } else {
          disarmReset();
          resetProgress();
        }
      } else if (action === 'save-profile') {
        var input = document.getElementById('settingsNameInput');
        var name = cleanName(input ? input.value : '');
        if (!name) {
          toast('اكتب اسم أول — حرفين على الأقل.', null, '✍️');
          if (input) input.focus();
          return;
        }
        store.playerName = name;
        save();
        paintMenuStats();
        toast('ثبت اسمك: ' + name, 'mint', '👑');
        btn.textContent = 'تم ✓';
        btn.classList.add('is-saved');
        window.setTimeout(function () {
          btn.textContent = 'حفظ';
          btn.classList.remove('is-saved');
        }, 1500);
      }
    });

    el.sheetBody.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var target = e.target;
      if (!target || target.id !== 'settingsNameInput') return;
      e.preventDefault();
      var btn = el.sheetBody.querySelector('[data-action="save-profile"]');
      if (btn) btn.click();
    });

    el.installBtn.addEventListener('click', promptInstall);

    if (window.matchMedia) {
      var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      var onChange = function (e) {
        if (e.matches && !store.settings.reduceMotion) {
          store.settings.reduceMotion = true;
          save();
          applyGameSettings();
        }
      };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onChange);
      else if (motionQuery.addListener) motionQuery.addListener(onChange);

      if (themeMedia) {
        var onThemeChange = function () {
          if (store.settings.theme === 'auto') applyTheme();
        };
        if (themeMedia.addEventListener) themeMedia.addEventListener('change', onThemeChange);
        else if (themeMedia.addListener) themeMedia.addListener(onThemeChange);
      }
    }

    document.addEventListener('pointerdown', function (e) {
      if (e.target === el.canvas) markHintSeen();
    }, true);

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.sheetWrap.hidden) {
          closeSheet();
          e.preventDefault();
          return;
        }
        if (game && game.state === 'playing') {
          pauseGame();
          e.preventDefault();
        } else if (game && game.state === 'paused') {
          resumeGame();
          e.preventDefault();
        }
        return;
      }

      if (!el.sheetWrap.hidden) return;

      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'p' || e.key === 'P') {
        if (game && game.state === 'playing') pauseGame();
        else if (game && game.state === 'paused') resumeGame();
        e.preventDefault();
      }

      if ((e.key === ' ' || e.key === 'Enter') && game && game.state === 'menu') {
        startGame();
        e.preventDefault();
      }

      if ((e.key === ' ' || e.key === 'Enter') && game && game.state === 'over') {
        startGame();
        e.preventDefault();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && game && game.state === 'playing') {
        pauseGame();
      }
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showInstallUi(true);
    });

    window.addEventListener('appinstalled', function () {
      showInstallUi(false);
      deferredPrompt = null;
      toast('ثبتت النطاطة — افتحها من الشاشة الرئيسية', 'mint', '🎉');
    });
  }

  /* ---------- التشغيل ---------- */

  function boot() {
    if (!window.NatataGame || !window.NatataArt) return;

    game = new window.NatataGame(el.canvas);
    game.hooks = {
      onScore: updateScore,
      onStars: function (n) { el.hudStars.textContent = fmt(n); },
      onCombo: updateCombo,
      onBoosts: updateBoosts,
      onMilestone: function (m) {
        toast('وصلت ' + fmt(m) + ' متر!', 'gold', '🎯');
      },
      onGameOver: showGameOver,
      onVibrate: vibrate
    };

    applyTheme();
    applyGameSettings();
    applyAudioSettings();
    paintSoundButtons();
    paintMenuStats();
    bind();
    showMenu();

    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* تجاهل */ });
    }

    window.NatataUI = {
      game: game,
      store: store,
      refresh: function () {
        store = loadStore();
        applyTheme();
        paintMenuStats();
        applyGameSettings();
        applyAudioSettings();
        paintSoundButtons();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
