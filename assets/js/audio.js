/* =========================================================
   النطاطة — محرك صوت بسيط مبني على Web Audio
   كل المؤثرات والموسيقى مولّدة برمجيًا (بدون ملفات صوت).
   ========================================================= */
(function () {
  'use strict';

  var AudioCtx = window.AudioContext || window.webkitAudioContext;

  var Sound = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    noiseBuffer: null,
    muted: false,
    musicEnabled: true,
    musicTimer: null,
    musicStep: 0,
    nextNoteAt: 0,
    _lastPlayed: Object.create(null),

    /* ---------- تهيئة ---------- */

    init: function () {
      if (this.ctx || !AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.9;
        this.master.connect(this.ctx.destination);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.55;
        this.musicBus.connect(this.master);

        var len = Math.floor(this.ctx.sampleRate * 0.5);
        var buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      } catch (err) {
        this.ctx = null;
      }
    },

    resume: function () {
      if (!AudioCtx) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        var p = this.ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    },

    setMuted: function (muted) {
      this.muted = !!muted;
      if (!this.ctx || !this.master) return;
      var t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.02);
    },

    setMusicEnabled: function (on) {
      this.musicEnabled = !!on;
      if (!this.musicEnabled) this.stopMusic();
    },

    /* ---------- أدوات توليد الصوت ---------- */

    note: function (freq, when, dur, type, vol, bus, slideTo) {
      if (!this.ctx) return;
      var ctx = this.ctx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var start = when == null ? ctx.currentTime : when;

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.1), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(bus || this.sfxBus || this.master);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    },

    noise: function (dur, vol, cutoff, when) {
      if (!this.ctx || !this.noiseBuffer) return;
      var ctx = this.ctx;
      var start = when == null ? ctx.currentTime : when;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff || 1200, start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(120, (cutoff || 1200) * 0.4), start + dur);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.08), start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus || this.master);
      src.start(start);
      src.stop(start + dur + 0.03);
    },

    arp: function (freqs, step, dur, vol, type) {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      for (var i = 0; i < freqs.length; i++) {
        this.note(freqs[i], t + i * step, dur, type || 'triangle', vol);
      }
    },

    /* ---------- مؤثرات اللعبة ---------- */

    jump: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.note(340, t, 0.13, 'sine', 0.15, null, 660);
      this.note(760, t, 0.05, 'triangle', 0.045);
    },

    land: function () {
      if (!this.ctx) return;
      this.note(170, this.ctx.currentTime, 0.07, 'sine', 0.07, null, 110);
    },

    spring: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.note(300, t, 0.3, 'sine', 0.18, null, 1180);
      this.note(920, t + 0.06, 0.16, 'triangle', 0.06, null, 1560);
      this.noise(0.12, 0.035, 2600, t);
    },

    cloud: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.note(520, t, 0.22, 'sine', 0.1, null, 940);
      this.note(1040, t + 0.09, 0.16, 'triangle', 0.035);
    },

    coin: function (big) {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      var base = big ? 1046.5 : 988;
      this.note(base, t, 0.08, 'triangle', 0.1);
      this.note(base * 1.335, t + 0.075, 0.16, 'triangle', 0.09);
      if (big) {
        this.note(base * 2, t + 0.15, 0.22, 'sine', 0.06);
      }
    },

    power: function () {
      this.arp([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.065, 0.2, 0.075, 'triangle');
    },

    crack: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.noise(0.18, 0.13, 1400, t);
      this.note(180, t, 0.16, 'square', 0.06, null, 70);
    },

    milestone: function () {
      this.arp([783.99, 1046.5, 1318.5], 0.085, 0.24, 0.075, 'triangle');
    },

    record: function () {
      this.arp([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.085, 0.3, 0.085, 'triangle');
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this.note(261.63, t, 1.1, 'sine', 0.05);
      this.note(392, t, 1.1, 'sine', 0.035);
      this.note(523.25, t, 1.1, 'sine', 0.028);
    },

    gameover: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      var seq = [523.25, 415.3, 329.63, 261.63];
      for (var i = 0; i < seq.length; i++) {
        this.note(seq[i], t + i * 0.16, 0.3, 'triangle', 0.1);
      }
      this.note(130.81, t + 0.5, 0.7, 'sine', 0.07, null, 98);
    },

    click: function () {
      if (!this.ctx) return;
      this.note(720, this.ctx.currentTime, 0.045, 'sine', 0.055);
    },

    /* ---------- موسيقى خلفية ---------- */

    melody: [
      659.25, 0, 783.99, 0, 880, 0, 783.99, 659.25,
      587.33, 0, 659.25, 0, 783.99, 0, 659.25, 0,
      523.25, 0, 659.25, 0, 783.99, 0, 880, 783.99,
      659.25, 0, 587.33, 0, 523.25, 0, 0, 0
    ],

    bassLine: [130.81, 110, 87.31, 98],

    startMusic: function () {
      if (!this.ctx || !this.musicEnabled || this.musicTimer) return;
      var self = this;
      this.musicStep = 0;
      this.nextNoteAt = this.ctx.currentTime + 0.1;
      this.musicTimer = window.setInterval(function () {
        self.scheduleMusic();
      }, 120);
    },

    stopMusic: function () {
      if (this.musicTimer) {
        window.clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    },

    scheduleMusic: function () {
      if (!this.ctx) return;
      var ahead = this.ctx.currentTime + 0.4;
      var guard = 0;
      while (this.nextNoteAt < ahead && guard++ < 16) {
        var step = this.musicStep % 32;
        var freq = this.melody[step];
        var when = this.nextNoteAt;

        if (freq) {
          this.note(freq, when, 0.26, 'triangle', 0.045, this.musicBus);
          if (step % 4 === 0) {
            this.note(freq * 2, when, 0.14, 'sine', 0.014, this.musicBus);
          }
        }

        if (step % 8 === 0) {
          var bass = this.bassLine[Math.floor(step / 8) % this.bassLine.length];
          this.note(bass, when, 0.85, 'sine', 0.05, this.musicBus);
          this.note(bass * 2, when, 0.55, 'triangle', 0.018, this.musicBus);
        }

        this.musicStep++;
        this.nextNoteAt += 0.24;
      }
    }
  };

  window.NatataAudio = Sound;
})();
