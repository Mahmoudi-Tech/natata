/* =========================================================
   النطاطة — لوحة الأبطال العالمية
   Firebase Realtime Database (REST) — بدون أي مكتبات
   ========================================================= */
(function () {
  'use strict';

  /* رابط قاعدة البيانات (بعد إنشائها في Firebase) */
  var DB_URL = 'https://natata-8a39d-default-rtdb.europe-west1.firebasedatabase.app';

  function dbUrl() {
    return String(window.NATATA_DB_URL || DB_URL || '').trim();
  }

  var TOP_KEY = 'natata:online:top';
  var QUEUE_KEY = 'natata:online:queue';
  var DEVICE_KEY = 'natata:online:device';
  var LIMIT = 30;
  var TIMEOUT = 9000;

  function enabled() {
    var url = dbUrl();
    if (!url) return false;
    if (/^https:\/\/[^\s]+/i.test(url)) return true;
    /* السماح بالاختبار المحلي فقط */
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
  }

  function base() {
    return dbUrl().replace(/\/+$/, '');
  }

  function deviceId() {
    var id = '';
    try { id = window.localStorage.getItem(DEVICE_KEY) || ''; } catch (err) { /* تجاهل */ }
    if (id) return id;
    id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { window.localStorage.setItem(DEVICE_KEY, id); } catch (err) { /* تجاهل */ }
    return id;
  }

  function cleanName(name) {
    return String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, 16);
  }

  function keyFor(name) {
    var text = cleanName(name).toLowerCase();
    if (!text) return '';
    var b64;
    try {
      if (window.TextEncoder && window.btoa) {
        var bytes = new TextEncoder().encode(text);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        b64 = window.btoa(bin);
      } else {
        b64 = window.btoa(unescape(encodeURIComponent(text)));
      }
    } catch (err) {
      b64 = text.replace(/[^a-z0-9\u0600-\u06FF]+/g, '_');
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function request(url, options) {
    var opts = options || {};
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = 0;
    if (ctrl) {
      timer = window.setTimeout(function () { try { ctrl.abort(); } catch (e) { /* تجاهل */ } }, TIMEOUT);
      opts.signal = ctrl.signal;
    }
    if (!opts.cache) opts.cache = 'no-store';

    return window.fetch(url, opts).then(function (res) {
      if (timer) window.clearTimeout(timer);
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.text();
    }).then(function (text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) { return null; }
    }, function (err) {
      if (timer) window.clearTimeout(timer);
      if (err && err.status) throw err;
      var off = new Error('offline');
      off.offline = true;
      throw off;
    });
  }

  function normalize(data) {
    if (!data || typeof data !== 'object') return [];
    var out = [];
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (!v || typeof v !== 'object') return;
      var m = Number(v.m);
      if (!isFinite(m) || m <= 0) return;
      var s = Number(v.s);
      var d = Number(v.d);
      out.push({
        key: k,
        name: cleanName(v.n) || 'لاعب',
        score: Math.round(m),
        stars: isFinite(s) && s > 0 ? Math.round(s) : 0,
        date: isFinite(d) && d > 0 ? Math.round(d) : 0
      });
    });
    out.sort(function (a, b) {
      return (b.score - a.score) || (b.stars - a.stars) || (a.date - b.date);
    });
    out.forEach(function (row, i) { row.rank = i + 1; });
    return out;
  }

  function fetchTop(limit) {
    if (!enabled()) {
      var no = new Error('disabled');
      no.disabled = true;
      return Promise.reject(no);
    }
    var n = Math.max(1, Math.min(100, Math.round(limit || LIMIT)));
    var url = base() + '/scores.json?orderBy=' +
      encodeURIComponent('"m"') + '&limitToLast=' + n;

    return request(url).then(function (data) {
      var list = normalize(data);
      writeCache(list);
      return list;
    });
  }

  function submit(entry) {
    var name = cleanName(entry && entry.name);
    var score = Math.round(Number(entry && entry.score));
    if (!enabled() || name.length < 2 || !isFinite(score) || score <= 0) {
      return Promise.resolve(null);
    }

    var payload = {
      n: name,
      m: score,
      s: Math.max(0, Math.round(Number(entry.stars) || 0)),
      d: Math.round(Number(entry.date) || Date.now())
    };
    var url = base() + '/scores/' + encodeURIComponent(keyFor(name)) + '.json';

    return request(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      return { name: name, score: score, key: keyFor(name) };
    });
  }

  /* ---------- طابور الإرسال (لما النت يقطع) ---------- */

  function readQueue() {
    var list = [];
    try {
      list = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
    } catch (err) { list = []; }
    return Array.isArray(list) ? list : [];
  }

  function writeQueue(list) {
    try {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-40)));
    } catch (err) { /* تجاهل */ }
  }

  function queue(entry) {
    var name = cleanName(entry && entry.name);
    var score = Math.round(Number(entry && entry.score));
    if (name.length < 2 || !isFinite(score) || score <= 0) return;

    var list = readQueue();
    var key = keyFor(name);
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (keyFor(list[i].name) === key) { found = list[i]; break; }
    }
    if (found) {
      if (score > found.score) {
        found.score = score;
        found.stars = Math.max(found.stars || 0, Math.round(Number(entry.stars) || 0));
        found.date = Number(entry.date) || Date.now();
      }
    } else {
      list.push({
        name: name,
        score: score,
        stars: Math.max(0, Math.round(Number(entry.stars) || 0)),
        date: Number(entry.date) || Date.now()
      });
    }
    writeQueue(list);
  }

  function pendingCount() {
    return readQueue().length;
  }

  function flush() {
    var list = readQueue();
    if (!list.length || !enabled() || !window.navigator.onLine) {
      return Promise.resolve(0);
    }

    var done = 0;
    var chain = Promise.resolve();
    list.forEach(function (item) {
      chain = chain.then(function () {
        return submit(item).then(function (res) {
          if (res) {
            done++;
            writeQueue(readQueue().filter(function (q) {
              return keyFor(q.name) !== keyFor(item.name);
            }));
          }
        }).catch(function () { /* سيبها للمرة الجاية */ });
      });
    });
    return chain.then(function () { return done; });
  }

  /* ---------- كاش آخر نتائج ---------- */

  function writeCache(list) {
    try {
      window.localStorage.setItem(TOP_KEY, JSON.stringify({
        at: Date.now(),
        list: (list || []).slice(0, LIMIT)
      }));
    } catch (err) { /* تجاهل */ }
  }

  function cachedTop() {
    var data = null;
    try {
      data = JSON.parse(window.localStorage.getItem(TOP_KEY) || 'null');
    } catch (err) { data = null; }
    if (!data || !Array.isArray(data.list)) return { at: 0, list: [] };
    return { at: Number(data.at) || 0, list: data.list };
  }

  /* ---------- التهيئة ---------- */

  if (window.addEventListener) {
    window.addEventListener('online', function () {
      flush().then(function (n) { if (n > 0) flush(); });
    });
  }

  window.NatataOnline = {
    enabled: enabled,
    limit: LIMIT,
    keyFor: keyFor,
    deviceId: deviceId,
    fetchTop: fetchTop,
    submit: submit,
    queue: queue,
    flush: flush,
    pendingCount: pendingCount,
    cachedTop: cachedTop
  };
})();
