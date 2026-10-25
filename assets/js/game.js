/* =========================================================
   النطاطة — منطق اللعبة والفيزياء
   ========================================================= */
(function () {
  'use strict';

  var W = 400;

  var GRAVITY = 2050;
  var JUMP = 815;
  var SPRING_JUMP = 1278;
  var CLOUD_JUMP = 1015;
  var SPEED = 344;
  var MAX_FALL = 1290;
  var PLAYER_R = 16;

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.art = window.NatataArt;
    this.audio = window.NatataAudio || null;

    this.state = 'menu';
    this.hooks = {};
    this.reduceMotion = false;

    this.time = 0;
    this.last = 0;

    this.cssW = 400;
    this.cssH = 700;
    this.dpr = 1;
    this.scale = 1;
    this.rect = null;
    this.worldH = 700;
    this.cameraY = 0;

    this.shakeT = 0;
    this.shakeDur = 0.3;
    this.shakeMag = 0;

    this.platforms = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];

    this.input = {
      left: false,
      right: false,
      pointerActive: false,
      pointerId: null,
      targetX: W / 2
    };

    this.tilt = { enabled: false, base: null, value: 0, handler: null };

    this.buildAmbient();
    this.resize();
    this.resetWorld();
    this.bindEvents();

    this.last = performance.now();
    this._loop = this.loop.bind(this);
    window.requestAnimationFrame(this._loop);
  }

  Game.prototype.buildAmbient = function () {
    this.starField = [];
    for (var i = 0; i < 90; i++) {
      this.starField.push({
        x: rand(0, W),
        y: Math.random(),
        r: rand(0.6, 1.9),
        tw: rand(1.2, 3.8),
        phase: rand(0, TAU),
        big: Math.random() < 0.12
      });
    }

    var layerSeq = [0, 0, 1, 0, 2, 1, 2, 0, 1, 2, 0, 1, 2, 1, 2, 0, 1, 2];
    this.clouds = [];
    for (var j = 0; j < layerSeq.length; j++) {
      this.clouds.push({
        x: rand(-40, W + 80),
        y: Math.random(),
        layer: layerSeq[j],
        scale: rand(0.55, 1.25),
        phase: rand(0, TAU)
      });
    }
    this.clouds.sort(function (a, b) { return a.layer - b.layer; });

    this.birds = [];
    for (var k = 0; k < 3; k++) {
      this.birds.push({
        x: rand(0, W),
        y: rand(0.13, 0.42),
        sp: rand(5, 9),
        ph: rand(0, TAU)
      });
    }

    this.balloons = [
      { x: rand(30, 160), y: 0.18, sp: rand(6, 10), scale: 0.9, color: '#ff8fa3', ph: rand(0, TAU) },
      { x: rand(200, 340), y: 0.34, sp: rand(4, 7), scale: 0.7, color: '#ffd166', ph: rand(0, TAU) }
    ];
  };

  Game.prototype.bindEvents = function () {
    var self = this;

    /* بنأجل إعادة ضبط حجم الكانفس شوية: شريط عنوان الموبايل بيغيّر الارتفاع
       كذا مرة ورا بعض، ولو أعدنا بناء الصورة مع كل تغيير اللعبة بتبقى متقطعة */
    var resizeTimer = 0;
    function queueResize() {
      self.rect = self.canvas.getBoundingClientRect();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        self.resize();
      }, 140);
    }
    window.addEventListener('resize', queueResize);
    if (window.ResizeObserver) {
      new window.ResizeObserver(queueResize).observe(this.canvas);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', queueResize);
    }

    window.addEventListener('keydown', function (e) {
      var key = e.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        self.input.left = true;
        if (self.state === 'playing') e.preventDefault();
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        self.input.right = true;
        if (self.state === 'playing') e.preventDefault();
      }
    });

    window.addEventListener('keyup', function (e) {
      var key = e.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') self.input.left = false;
      if (key === 'ArrowRight' || key === 'd' || key === 'D') self.input.right = false;
    });

    window.addEventListener('blur', function () {
      self.input.left = false;
      self.input.right = false;
      self.input.pointerActive = false;
      self.input.pointerId = null;
    });

    this.canvas.addEventListener('pointerdown', function (e) {
      if (self.state !== 'playing') return;
      if (e.isPrimary === false) return;
      e.preventDefault();
      self.rect = self.canvas.getBoundingClientRect();
      self.input.pointerActive = true;
      self.input.pointerId = e.pointerId;
      self.input.targetX = self.toWorldX(e.clientX);
      try { self.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });

    this.canvas.addEventListener('pointermove', function (e) {
      if (!self.input.pointerActive) return;
      if (e.isPrimary === false) return;
      if (self.input.pointerId != null && e.pointerId !== self.input.pointerId) return;
      var ev = e;
      if (typeof e.getCoalescedEvents === 'function') {
        var list = e.getCoalescedEvents();
        if (list && list.length) ev = list[list.length - 1];
      }
      var wx = self.toWorldX(ev.clientX);
      /* لو الإصبع اتحرك مسافة كبيرة في نفس اللحظة، خُد نقطة أعلى شوية عشان ميبقاش متأخر */
      self.input.targetX = wx;
    }, { passive: true });

    function release(e) {
      if (self.input.pointerId != null && e.pointerId !== self.input.pointerId) return;
      self.input.pointerActive = false;
      self.input.pointerId = null;
      /* لو الإصبع اتشال وهو سريع، خفف الانزلاق عشان النطاطة متكملش بعيد لوحدها */
      if (self.player && Math.abs(self.player.vx) > SPEED) self.player.vx *= 0.4;
    }
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && e.buttons === 0) release(e);
    });

    this.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  Game.prototype.toWorldX = function (clientX) {
    var rect = this.rect || this.canvas.getBoundingClientRect();
    if (!rect.width) return W / 2;
    return clamp(((clientX - rect.left) / rect.width) * W, 0, W);
  };

  Game.prototype.setTilt = function (on) {
    var self = this;
    this.tilt.enabled = !!on;

    if (!on) {
      this.tilt.value = 0;
      return;
    }

    this.tilt.base = null;
    if (this.tilt.handler) return;

    this.tilt.handler = function (e) {
      if (!self.tilt.enabled) return;
      var g = e.gamma;
      if (g == null || isNaN(g)) return;
      if (self.tilt.base == null) self.tilt.base = g;
      var v = (g - self.tilt.base) / 24;
      if (Math.abs(v) < 0.07) v = 0;
      else v = (v - Math.sign(v) * 0.07) / 0.93;
      self.tilt.value = clamp(v, -1, 1);
    };
    window.addEventListener('deviceorientation', this.tilt.handler);
  };

  Game.prototype.setReduceMotion = function (on) {
    this.reduceMotion = !!on;
  };

  Game.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    this.rect = rect;
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);

    this.cssW = w;
    this.cssH = h;
    /* الموبايل: تقليل كثافة البكسل شوية عشان الرسم يبقى أسرع واللمس يبقى سلس */
    var maxDpr = 2.5;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) maxDpr = 1.75;
    this.dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    this.scale = w / W;

    var oldH = this.worldH;
    this.worldH = clamp(h / this.scale, 420, 1150);

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    if (this.player && oldH && (this.state === 'playing' || this.state === 'paused')) {
      var frac = clamp((this.player.y - this.cameraY) / oldH, 0.3, 0.76);
      this.cameraY = this.player.y - this.worldH * frac;
    }
  };

  Game.prototype.platformWidth = function (difficulty) {
    return clamp(74 - difficulty * 14, 58, 74);
  };

  Game.prototype.pickType = function (dist) {
    if (dist < 28) return 'normal';
    var d = clamp(dist / 1400, 0, 1);
    var r = Math.random();
    var acc = 0;

    acc += 0.07;
    if (r < acc) return 'spring';
    acc += 0.07;
    if (r < acc) return 'cloud';
    acc += 0.10 + 0.13 * d;
    if (r < acc) return 'moving';
    acc += 0.06 + 0.20 * d;
    if (r < acc) return 'fragile';
    return 'normal';
  };

  Game.prototype.resetWorld = function () {
    this.platforms = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];

    this.player = {
      x: W / 2,
      y: 0,
      vx: 0,
      vy: 0,
      r: PLAYER_R,
      dir: 1,
      squash: 0,
      blink: 2 + Math.random() * 2.5,
      blinkT: 0
    };

    this.cameraY = -this.worldH * 0.6;
    this.originY = 0;
    this.minY = 0;
    this.altitude = 0;
    this.metersVal = 0;
    this.stars = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.jetpackTime = 0;
    this.magnetTime = 0;
    this.rocketsUsed = 0;
    this.nextMilestone = 100;
    this.shakeT = 0;
    this.topY = 82;
    this.powerCooldown = 0;
    this.dyingT = 0;

    this._hudM = -1;
    this._hudStars = -1;
    this._hudMult = -1;
    this._hudStreak = -1;
    this._hudJet = -1;
    this._hudMag = -1;

    this.input.pointerActive = false;
    this.input.pointerId = null;
    this.input.left = false;
    this.input.right = false;

    this.addPlatform(W / 2, 82, 'normal', 88);
    this.fillPlatforms();
  };

  Game.prototype.addPlatform = function (x, y, type, width) {
    var w = width || this.platformWidth(clamp(-y / 30 / 1400, 0, 1));
    var half = w / 2;
    x = clamp(x, half + 8, W - half - 8);

    var p = {
      x: x,
      y: y,
      w: w,
      h: 18,
      type: type,
      baseX: x,
      range: 0,
      phase: rand(0, TAU),
      speed: rand(0.9, 1.5),
      springT: 0,
      dead: false
    };

    if (type === 'moving') {
      var maxRange = Math.min(x - half - 10, W - half - 10 - x);
      p.range = maxRange > 16 ? rand(18, Math.min(56, maxRange)) : 0;
    }

    this.platforms.push(p);
    return p;
  };

  Game.prototype.spawnPickups = function (p, dist) {
    this.powerCooldown++;

    if (Math.random() < 0.47) {
      var big = Math.random() < 0.07;
      this.pickups.push({
        type: big ? 'big' : 'star',
        x: clamp(p.x + rand(-p.w * 0.3, p.w * 0.3), 22, W - 22),
        baseY: p.y - rand(30, 54),
        y: 0,
        r: big ? 17 : 12,
        phase: rand(0, TAU),
        dead: false
      });
    }

    if (this.powerCooldown > 3 && dist > 110) {
      var roll = Math.random();
      if (roll < 0.045) {
        this.pickups.push({
          type: 'jet',
          x: clamp(p.x + rand(-24, 24), 26, W - 26),
          baseY: p.y - 46,
          y: 0,
          r: 17,
          phase: rand(0, TAU),
          dead: false
        });
        this.powerCooldown = 0;
      } else if (roll < 0.075 && dist > 250) {
        this.pickups.push({
          type: 'magnet',
          x: clamp(p.x + rand(-24, 24), 26, W - 26),
          baseY: p.y - 46,
          y: 0,
          r: 17,
          phase: rand(0, TAU),
          dead: false
        });
        this.powerCooldown = 0;
      }
    }
  };

  Game.prototype.fillPlatforms = function () {
    var guard = 0;
    var limit = this.cameraY - 380;

    while (this.topY > limit && guard++ < 90) {
      var dist = Math.max(0, -this.topY) / 30;
      var diff = clamp(dist / 1400, 0, 1);
      var gap = 76 + diff * 20 + rand(-12, 16);
      var y = this.topY - gap;

      var prevX = this.platforms.length ? this.platforms[this.platforms.length - 1].x : W / 2;
      var x = prevX + rand(-128, 128);
      if (x < 60) x = rand(60, 120);
      if (x > W - 60) x = rand(W - 120, W - 60);

      var w = this.platformWidth(diff);
      var type = this.pickType(dist);
      var p = this.addPlatform(x, y, type, w);
      this.topY = y;
      this.spawnPickups(p, dist);
    }
  };

  Game.prototype.start = function () {
    this.resetWorld();
    this.state = 'playing';
    this.tilt.base = null;
    this.tilt.value = 0;
    this.last = performance.now();

    if (this.audio) {
      this.audio.resume();
      this.audio.startMusic();
    }
  };

  Game.prototype.pause = function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.left = false;
    this.input.right = false;
    this.input.pointerActive = false;
    this.input.pointerId = null;
    this.shakeT = 0;
    if (this.audio) this.audio.stopMusic();
  };

  Game.prototype.resume = function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    if (this.audio) {
      this.audio.resume();
      this.audio.startMusic();
    }
  };

  Game.prototype.toMenu = function () {
    this.state = 'menu';
    this.resetWorld();
    this.particles = [];
    this.texts = [];
    if (this.audio) this.audio.stopMusic();
  };

  Game.prototype.multiplier = function () {
    return 1 + Math.min(4, Math.floor(this.streak / 5));
  };

  Game.prototype.die = function () {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.dyingT = 0.55;
    this.addShake(8, 0.4);
    this.burst(this.player.x, this.player.y, 16, ['#ffd166', '#ff8a4c', '#ffffff'], 240);
    if (this.audio) {
      this.audio.gameover();
      this.audio.stopMusic();
    }
    if (this.hooks.onVibrate) this.hooks.onVibrate([40, 60, 40]);
  };

  Game.prototype.finish = function () {
    if (this.state !== 'dying') return;
    this.state = 'over';
    var result = {
      meters: this.metersVal,
      stars: this.stars,
      maxStreak: this.maxStreak,
      bestMult: this.multiplier(),
      rocketsUsed: this.rocketsUsed,
      altitude: this.altitude
    };
    if (this.hooks.onGameOver) this.hooks.onGameOver(result);
  };

  Game.prototype.loop = function (ts) {
    var dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!isFinite(dt) || dt < 0) dt = 0.016;
    dt = Math.min(0.05, dt);
    this.time += dt;

    if (this.state === 'playing') {
      var steps = Math.max(1, Math.ceil(dt / 0.008));
      var sdt = dt / steps;
      for (var i = 0; i < steps; i++) {
        this.stepPlaying(sdt);
        if (this.state !== 'playing') break;
      }
      this.emitHud();
    } else if (this.state === 'dying') {
      this.dyingT -= dt;
      this.player.vy += GRAVITY * 0.6 * dt;
      this.player.y += this.player.vy * dt;
      if (this.dyingT <= 0) this.finish();
    }

    if (this.state !== 'paused' && this.state !== 'menu') {
      this.updateParticles(dt);
      this.updateTexts(dt);
      this.updateShake(dt);
    }

    this.render();
    window.requestAnimationFrame(this._loop);
  };

  Game.prototype.stepPlaying = function (dt) {
    var p = this.player;
    var H = this.worldH;

    if (this.jetpackTime > 0) this.jetpackTime = Math.max(0, this.jetpackTime - dt);
    if (this.magnetTime > 0) this.magnetTime = Math.max(0, this.magnetTime - dt);

    this.updatePlatforms(dt);

    var dir = 0;
    var speed = SPEED;
    if (this.input.left) dir -= 1;
    if (this.input.right) dir += 1;

    if (dir === 0 && this.input.pointerActive) {
      var diff = this.input.targetX - p.x;
      var dist = Math.abs(diff);
      if (dist > 1.2) {
        dir = diff < 0 ? -1 : 1;
        /* كل ما الإصبع بعيد، النطاطة تجري أسرع عشان تلحق الإصبع بسرعة */
        speed = clamp(dist * 20, 0, SPEED * 2.2);
      }
    } else if (dir === 0 && this.tilt.enabled) {
      dir = this.tilt.value;
    }

    var targetVx = dir * speed;
    var accel = this.input.pointerActive ? 42 : 13;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * accel);
    p.x += p.vx * dt;
    p.x = clamp(p.x, p.r + 2, W - p.r - 2);
    if (dir > 0.12) p.dir = 1;
    else if (dir < -0.12) p.dir = -1;

    p.squash *= Math.exp(-dt * 7.5);
    if (p.squash < 0.001) p.squash = 0;

    p.blink -= dt;
    if (p.blinkT > 0) p.blinkT -= dt;
    if (p.blink <= 0) {
      p.blink = 2.2 + Math.random() * 2.8;
      p.blinkT = 0.12;
    }

    var prevBottom = p.y + p.r;

    if (this.jetpackTime > 0) {
      p.vy = -880;
      if (!this.reduceMotion && Math.random() < 0.35) this.flame();
    } else {
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
    }

    p.y += p.vy * dt;

    if (!this.reduceMotion && p.vy < -620 && Math.random() < 0.22) {
      this.addParticle({
        x: p.x + rand(-8, 8),
        y: p.y + rand(8, 15),
        vx: rand(-20, 20),
        vy: rand(30, 70),
        life: rand(0.25, 0.45),
        size: rand(1.6, 3.4),
        color: 'rgba(255,241,190,.8)',
        gravity: 0,
        type: 'circle'
      });
    }

    if (p.vy > 0) {
      for (var i = 0; i < this.platforms.length; i++) {
        var plat = this.platforms[i];
        if (plat.dead) continue;
        var top = plat.y;
        var half = plat.w / 2;
        if (p.x + p.r * 0.55 > plat.x - half &&
            p.x - p.r * 0.55 < plat.x + half &&
            prevBottom <= top + 8 &&
            p.y + p.r >= top &&
            p.y + p.r <= top + 56) {
          this.land(plat);
          break;
        }
      }
    }

    this.updatePickups(dt);

    this.minY = Math.min(this.minY, p.y);
    this.altitude = Math.max(0, (this.originY - this.minY) / 30);

    var targetCam = p.y - H * 0.58;
    if (targetCam < this.cameraY) this.cameraY = targetCam;

    this.fillPlatforms();
    this.cull();

    var meters = Math.floor(this.altitude);
    if (meters > this.metersVal) this.metersVal = meters;

    while (this.metersVal >= this.nextMilestone) {
      var milestone = this.nextMilestone;
      this.nextMilestone += 100;
      if (this.audio) this.audio.milestone();
      if (this.hooks.onMilestone) this.hooks.onMilestone(milestone);
      if (this.hooks.onVibrate) this.hooks.onVibrate([18, 36, 18]);
    }

    if (p.y - this.cameraY > H + 90) {
      this.die();
    }
  };

  Game.prototype.updatePlatforms = function (dt) {
    for (var i = 0; i < this.platforms.length; i++) {
      var p = this.platforms[i];
      if (p.type === 'moving' && p.range > 0) {
        p.x = p.baseX + Math.sin(this.time * p.speed + p.phase) * p.range;
      }
      if (p.springT > 0) {
        p.springT = Math.max(0, p.springT - dt * 3.2);
      }
    }
  };

  Game.prototype.land = function (plat) {
    var p = this.player;
    p.y = plat.y - p.r;

    var boost = JUMP;

    if (plat.type === 'spring') {
      boost = SPRING_JUMP;
      plat.springT = 1;
      if (this.audio) this.audio.spring();
      this.burst(plat.x, plat.y - 6, 8, ['#cfe7ff', '#ffffff', '#ffd166'], 170);
    } else if (plat.type === 'cloud') {
      boost = CLOUD_JUMP;
      if (this.audio) this.audio.cloud();
      this.puff(plat.x, plat.y - 2, 7);
    } else {
      if (this.audio) this.audio.jump();
    }

    p.vy = -boost;
    p.squash = 0.46;
    this.streak++;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;

    if (!this.reduceMotion) this.dust(p.x, plat.y, 5);

    if (plat.type === 'fragile') {
      plat.dead = true;
      if (this.audio) this.audio.crack();
      this.debris(plat);
      this.addShake(4, 0.22);
    }

    if (this.streak > 0 && this.streak % 5 === 0) {
      this.addText(p.x, p.y - 36, 'كومبو ' + this.streak, '#ffd23f');
    }
  };

  Game.prototype.updatePickups = function (dt) {
    var p = this.player;

    for (var i = this.pickups.length - 1; i >= 0; i--) {
      var pk = this.pickups[i];
      pk.y = pk.baseY + Math.sin(this.time * 2.6 + pk.phase) * 4.5;

      if (this.magnetTime > 0 && (pk.type === 'star' || pk.type === 'big')) {
        var dx = p.x - pk.x;
        var dy = p.y - pk.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 170 && dist > 1) {
          var pull = (1 - dist / 170) * 640 * dt;
          pk.x = clamp(pk.x + (dx / dist) * pull, 12, W - 12);
          pk.baseY += (dy / dist) * pull;
          pk.y += (dy / dist) * pull;
        }
      }

      var ddx = p.x - pk.x;
      var ddy = p.y - pk.y;
      var rr = pk.r + p.r * 0.9;
      if (ddx * ddx + ddy * ddy < rr * rr) {
        this.collect(pk, i);
      }
    }
  };

  Game.prototype.collect = function (pk, index) {
    var p = this.player;
    this.pickups.splice(index, 1);

    if (pk.type === 'star' || pk.type === 'big') {
      var amount = (pk.type === 'big' ? 5 : 1) * this.multiplier();
      this.stars += amount;
      if (this.audio) this.audio.coin(pk.type === 'big');
      this.burst(pk.x, pk.y, pk.type === 'big' ? 14 : 7, ['#ffd93d', '#fff3b0', '#ffb703'], 190);
      this.addText(pk.x, pk.y - 14, '+' + amount, '#ffcf33');
      if (this.hooks.onVibrate) this.hooks.onVibrate(8);
    } else if (pk.type === 'jet') {
      this.jetpackTime = 1.9;
      this.rocketsUsed++;
      if (this.audio) this.audio.power();
      this.addText(p.x, p.y - 42, 'صاروخ!', '#ff8a4c');
      this.addShake(4, 0.25);
      if (this.hooks.onVibrate) this.hooks.onVibrate(20);
    } else if (pk.type === 'magnet') {
      this.magnetTime = 7;
      if (this.audio) this.audio.power();
      this.addText(p.x, p.y - 42, 'مغناطيس!', '#3ecfc3');
      if (this.hooks.onVibrate) this.hooks.onVibrate(20);
    }
  };

  Game.prototype.cull = function () {
    var bottom = this.cameraY + this.worldH + 160;
    this.platforms = this.platforms.filter(function (p) {
      return !p.dead && p.y < bottom;
    });
    this.pickups = this.pickups.filter(function (p) {
      return !p.dead && p.baseY < bottom;
    });
  };

  Game.prototype.emitHud = function () {
    var h = this.hooks;

    if (this.metersVal !== this._hudM) {
      this._hudM = this.metersVal;
      if (h.onScore) h.onScore(this.metersVal);
    }

    if (this.stars !== this._hudStars) {
      this._hudStars = this.stars;
      if (h.onStars) h.onStars(this.stars);
    }

    var mult = this.multiplier();
    if (mult !== this._hudMult || this.streak !== this._hudStreak) {
      this._hudMult = mult;
      this._hudStreak = this.streak;
      if (h.onCombo) h.onCombo(mult, this.streak);
    }

    var jet = this.jetpackTime;
    var mag = this.magnetTime;
    if (Math.abs(jet - this._hudJet) > 0.08 || Math.abs(mag - this._hudMag) > 0.08) {
      this._hudJet = jet;
      this._hudMag = mag;
      if (h.onBoosts) h.onBoosts({ jetpack: jet, magnet: mag });
    }
  };

  /* ---------- جزيئات ---------- */

  Game.prototype.addParticle = function (o) {
    if (this.particles.length > 320) this.particles.shift();
    this.particles.push({
      x: o.x,
      y: o.y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      gravity: o.gravity || 0,
      drag: o.drag || 0,
      life: o.life || 0.5,
      max: o.life || 0.5,
      size: o.size || 3,
      color: o.color || '#ffffff',
      alpha: o.alpha == null ? 1 : o.alpha,
      type: o.type || 'circle',
      rot: o.rot || 0,
      vr: o.vr || 0,
      width: o.width || 2
    });
  };

  Game.prototype.dust = function (x, y, count) {
    for (var i = 0; i < count; i++) {
      this.addParticle({
        x: x + rand(-12, 12),
        y: y - rand(0, 4),
        vx: rand(-70, 70),
        vy: rand(-60, -10),
        gravity: 220,
        drag: 2,
        life: rand(0.3, 0.55),
        size: rand(1.8, 3.6),
        color: 'rgba(255,246,224,.95)',
        type: 'circle'
      });
    }
  };

  Game.prototype.puff = function (x, y, count) {
    for (var i = 0; i < count; i++) {
      this.addParticle({
        x: x + rand(-10, 10),
        y: y - rand(0, 8),
        vx: rand(-40, 40),
        vy: rand(-50, -10),
        gravity: -30,
        drag: 1.6,
        life: rand(0.45, 0.8),
        size: rand(4, 7),
        color: 'rgba(255,255,255,.85)',
        type: 'circle'
      });
    }
  };

  Game.prototype.burst = function (x, y, count, colors, speed) {
    for (var i = 0; i < count; i++) {
      var a = rand(0, TAU);
      var s = rand(speed * 0.35, speed);
      this.addParticle({
        x: x,
        y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        gravity: 280,
        drag: 0.8,
        life: rand(0.4, 0.85),
        size: rand(2, 4.5),
        color: colors[(Math.random() * colors.length) | 0],
        type: Math.random() < 0.4 ? 'star' : 'circle'
      });
    }
  };

  Game.prototype.debris = function (plat) {
    var x = plat.x;
    var y = plat.y;
    for (var i = 0; i < 9; i++) {
      this.addParticle({
        x: x + rand(-plat.w / 2, plat.w / 2),
        y: y + rand(0, 14),
        vx: rand(-130, 130),
        vy: rand(-160, -20),
        gravity: 1350,
        drag: 0.2,
        life: rand(0.5, 0.9),
        size: rand(2.5, 5.5),
        color: i % 3 === 0 ? '#e0ad78' : '#a76a3c',
        type: 'square',
        rot: rand(0, TAU),
        vr: rand(-9, 9)
      });
    }
  };

  Game.prototype.flame = function () {
    var p = this.player;
    this.addParticle({
      x: p.x + rand(2, 12),
      y: p.y + rand(14, 22),
      vx: rand(-25, 25),
      vy: rand(90, 230),
      gravity: 0,
      drag: 1.4,
      life: rand(0.22, 0.42),
      size: rand(2.2, 5),
      color: Math.random() < 0.5 ? 'rgba(255,226,120,.9)' : 'rgba(255,140,60,.85)',
      type: 'glow',
      alpha: 0.9
    });
  };

  Game.prototype.updateParticles = function (dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 1 - Math.min(0.9, p.drag * dt);
      p.vy *= 1 - Math.min(0.9, p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  };

  Game.prototype.addText = function (x, y, text, color) {
    this.texts.push({
      x: x,
      y: y,
      text: text,
      color: color || '#ffd23f',
      life: 0.85,
      max: 0.85,
      vy: -46,
      size: 15
    });
    if (this.texts.length > 10) this.texts.shift();
  };

  Game.prototype.updateTexts = function (dt) {
    for (var i = this.texts.length - 1; i >= 0; i--) {
      var t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.96;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  };

  Game.prototype.addShake = function (mag, dur) {
    if (this.reduceMotion) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeDur = Math.max(this.shakeDur, dur);
    this.shakeT = Math.max(this.shakeT, dur);
  };

  Game.prototype.updateShake = function (dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) {
        this.shakeT = 0;
        this.shakeMag = 0;
      }
    }
  };

  /* ---------- الرسم ---------- */

  Game.prototype.render = function () {
    var ctx = this.ctx;
    var s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    if (this.state === 'menu') {
      this.art.drawBackground(ctx, this, 0, -this.time * 18);
      this.art.drawMenuSparkles(ctx, this);
      return;
    }

    this.art.drawBackground(ctx, this, this.altitude, this.cameraY);

    var shakeX = 0;
    var shakeY = 0;
    if (this.shakeT > 0) {
      var k = this.shakeT / Math.max(0.001, this.shakeDur);
      shakeX = (Math.random() * 2 - 1) * this.shakeMag * k;
      shakeY = (Math.random() * 2 - 1) * this.shakeMag * k;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY - this.cameraY);
    this.art.drawPlatforms(ctx, this);
    this.art.drawPickups(ctx, this);
    this.art.drawParticles(ctx, this);
    this.art.drawPlayer(ctx, this);
    this.art.drawTexts(ctx, this);
    ctx.restore();
  };

  window.NatataGame = Game;
})();
