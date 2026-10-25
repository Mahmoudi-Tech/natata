/* =========================================================
   النطاطة — كل الرسم (Canvas Art)
   ========================================================= */
(function () {
  'use strict';

  var W = 400;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(a, b, t) {
    return [
      Math.round(lerp(a[0], b[0], t)),
      Math.round(lerp(a[1], b[1], t)),
      Math.round(lerp(a[2], b[2], t))
    ];
  }
  function rgb(c, alpha) {
    if (alpha == null) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  }

  var SKY = [
    { at: 0, top: [86, 196, 250], bottom: [204, 243, 255] },
    { at: 280, top: [98, 174, 250], bottom: [206, 238, 255] },
    { at: 560, top: [255, 154, 112], bottom: [255, 216, 160] },
    { at: 820, top: [150, 98, 211], bottom: [255, 158, 190] },
    { at: 1150, top: [43, 42, 106], bottom: [107, 66, 146] },
    { at: 1600, top: [8, 12, 42], bottom: [26, 33, 78] }
  ];

  /* سماء الوضع الليلي — تبدأ غروب هادي وتغرق في الليل */
  var NIGHT_SKY = [
    { at: 0, top: [26, 40, 78], bottom: [62, 92, 148] },
    { at: 300, top: [18, 28, 60], bottom: [44, 64, 110] },
    { at: 600, top: [12, 20, 48], bottom: [31, 45, 84] },
    { at: 900, top: [9, 15, 38], bottom: [22, 33, 66] },
    { at: 1600, top: [4, 7, 22], bottom: [13, 18, 44] }
  ];

  function isNight() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function skyFrom(table, alt) {
    var i = 0;
    while (i < table.length - 1 && alt > table[i + 1].at) i++;
    var a = table[i];
    var b = table[Math.min(i + 1, table.length - 1)];
    var t = b.at === a.at ? 0 : clamp((alt - a.at) / (b.at - a.at), 0, 1);
    t = t * t * (3 - 2 * t);
    return { top: lerpColor(a.top, b.top, t), bottom: lerpColor(a.bottom, b.bottom, t) };
  }

  function skyAt(alt) {
    return skyFrom(SKY, alt);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, outer, inner, points) {
    var rot = -Math.PI / 2;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = rot + (i * Math.PI) / points;
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function sparklePath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.22, y - r * 0.22, x + r, y);
    ctx.quadraticCurveTo(x + r * 0.22, y + r * 0.22, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.22, y + r * 0.22, x - r, y);
    ctx.quadraticCurveTo(x - r * 0.22, y - r * 0.22, x, y - r);
    ctx.closePath();
  }

  /* ============ الخلفية ============ */

  function drawBackground(ctx, game, alt, scroll) {
    var H = game.worldH;
    var night = isNight();
    var sky = night ? skyFrom(NIGHT_SKY, alt) : skyAt(alt);

    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgb(sky.top));
    grad.addColorStop(1, rgb(sky.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var starAlpha = night
      ? clamp(0.55 + alt / 2600, 0, 1)
      : clamp((alt - 500) / 500, 0, 1);
    if (starAlpha > 0.01) drawStars(ctx, game, scroll, starAlpha);

    var sunAlpha = night ? 0 : clamp(1 - alt / 540, 0, 1);
    if (sunAlpha > 0.01) drawSun(ctx, game, sunAlpha);

    var moonAlpha = night
      ? clamp(0.72 + alt / 1800, 0, 1)
      : clamp((alt - 620) / 380, 0, 1);
    if (moonAlpha > 0.01) drawMoon(ctx, game, moonAlpha);

    if (night || alt > 900) drawAurora(ctx, game, alt, night);

    var dayAlpha = night ? 0 : clamp(1 - alt / 720, 0, 1);
    if (dayAlpha > 0.02) drawBirds(ctx, game, dayAlpha);
    if (dayAlpha > 0.02) drawBalloons(ctx, game, dayAlpha, scroll);

    drawClouds(ctx, game, alt, sky, scroll, night);
  }

  function drawStars(ctx, game, scroll, alpha) {
    var H = game.worldH;
    var t = game.time;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < game.starField.length; i++) {
      var s = game.starField[i];
      var x = s.x;
      var y = ((s.y * H - scroll * 0.035) % H + H) % H;
      var twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.tw + s.phase));
      ctx.globalAlpha = alpha * twinkle;
      if (s.big) {
        sparklePath(ctx, x, y, s.r * 2.6);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(ctx, game, alpha) {
    var H = game.worldH;
    var cx = W * 0.78;
    var cy = H * 0.15;
    var R = Math.min(38, H * 0.06);
    var t = game.time;

    var glow = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 3.8);
    glow.addColorStop(0, 'rgba(255,246,190,' + (0.55 * alpha) + ')');
    glow.addColorStop(0.45, 'rgba(255,225,120,' + (0.2 * alpha) + ')');
    glow.addColorStop(1, 'rgba(255,225,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 3.8, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.07);
    ctx.strokeStyle = 'rgba(255,243,170,' + (0.35 * alpha) + ')';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * TAU;
      var r1 = R * 1.35;
      var r2 = R * 1.6 + Math.sin(t * 1.5 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,235,.85)';
    ctx.beginPath();
    ctx.arc(cx - R * 0.28, cy - R * 0.3, R * 0.55, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawMoon(ctx, game, alpha) {
    var H = game.worldH;
    var cx = W * 0.22;
    var cy = H * 0.14;
    var R = 28;
    var t = game.time;

    var glow = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3.2);
    glow.addColorStop(0, 'rgba(240,240,215,' + (0.28 * alpha) + ')');
    glow.addColorStop(1, 'rgba(240,240,215,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 3.2, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f6f2d8';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(205,200,170,.4)';
    var craters = [
      [-8, -6, 6], [7, 4, 4.5], [-3, 10, 3.4], [10, -9, 3]
    ];
    for (var i = 0; i < craters.length; i++) {
      ctx.beginPath();
      ctx.arc(cx + craters[i][0], cy + craters[i][1], craters[i][2], 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,245,.5)';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 10, 5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (Math.sin(t * 0.8) > 0.3) {
      ctx.fillStyle = 'rgba(255,255,240,' + (alpha * 0.7) + ')';
      sparklePath(ctx, cx + 30, cy - 22, 3.5);
      ctx.fill();
    }
  }

  function drawAurora(ctx, game, alt, night) {
    var H = game.worldH;
    var a = night
      ? 0.1 + clamp(alt / 1400, 0, 1) * 0.18
      : clamp((alt - 900) / 900, 0, 1) * 0.3;
    if (a <= 0) return;
    var t = game.time;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';

    var g1 = ctx.createLinearGradient(0, H * 0.2, W, H * 0.5);
    g1.addColorStop(0, 'rgba(57,217,192,0)');
    g1.addColorStop(0.45, 'rgba(57,217,192,.9)');
    g1.addColorStop(1, 'rgba(120,110,255,0)');
    ctx.strokeStyle = g1;
    ctx.beginPath();
    ctx.moveTo(-30, H * 0.28 + Math.sin(t * 0.4) * 12);
    ctx.bezierCurveTo(W * 0.25, H * 0.16, W * 0.68, H * 0.42, W + 30, H * 0.26);
    ctx.stroke();

    ctx.globalAlpha = a * 0.6;
    ctx.lineWidth = 12;
    var g2 = ctx.createLinearGradient(W, H * 0.15, 0, H * 0.4);
    g2.addColorStop(0, 'rgba(255,140,200,0)');
    g2.addColorStop(0.5, 'rgba(255,140,200,.8)');
    g2.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.strokeStyle = g2;
    ctx.beginPath();
    ctx.moveTo(W + 20, H * 0.16 + Math.cos(t * 0.3) * 10);
    ctx.bezierCurveTo(W * 0.7, H * 0.3, W * 0.3, H * 0.1, -20, H * 0.34);
    ctx.stroke();
    ctx.restore();
  }

  function drawBirds(ctx, game, alpha) {
    var H = game.worldH;
    var t = game.time;
    ctx.save();
    ctx.strokeStyle = 'rgba(42,78,120,' + (0.35 * alpha) + ')';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (var i = 0; i < game.birds.length; i++) {
      var b = game.birds[i];
      var x = ((b.x + t * b.sp) % (W + 100) + (W + 100)) % (W + 100) - 50;
      var y = b.y * H + Math.sin(t * 0.9 + b.ph) * 7;
      var flap = Math.sin(t * 8 + b.ph) * 3;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.quadraticCurveTo(x - 4, y - 5 - flap, x, y);
      ctx.quadraticCurveTo(x + 4, y - 5 - flap, x + 9, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBalloons(ctx, game, alpha, scroll) {
    var H = game.worldH;
    var t = game.time;
    for (var i = 0; i < game.balloons.length; i++) {
      var b = game.balloons[i];
      var span = H + 200;
      var x = ((b.x + Math.sin(t * 0.4 + b.ph) * 16) % (W + 120) + (W + 120)) % (W + 120) - 60;
      var y = ((b.y * span - t * b.sp - scroll * 0.07) % span + span) % span - 100;
      drawBalloon(ctx, x, y, b.scale, b.color, alpha * 0.8);
    }
  }

  function drawBalloon(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 11 * s, 13 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath();
    ctx.ellipse(x - 3 * s, y - 4 * s, 3.5 * s, 5 * s, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,55,40,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 13 * s);
    ctx.quadraticCurveTo(x + 4 * s, y + 19 * s, x, y + 23 * s);
    ctx.stroke();
    ctx.fillStyle = '#a9743f';
    roundRect(ctx, x - 4 * s, y + 23 * s, 8 * s, 6 * s, 1.5);
    ctx.fill();
    ctx.restore();
  }

  var CLOUD_LAYERS = [
    { p: 0.05, a: 0.34, s: 0.55, drift: 5, tint: 0.10 },
    { p: 0.10, a: 0.55, s: 0.80, drift: 9, tint: 0.16 },
    { p: 0.16, a: 0.85, s: 1.10, drift: 14, tint: 0.22 }
  ];

  function drawClouds(ctx, game, alt, sky, scroll, night) {
    var H = game.worldH;
    var t = game.time;
    var base = night ? [124, 152, 200] : [255, 255, 255];
    for (var i = 0; i < game.clouds.length; i++) {
      var c = game.clouds[i];
      var layer = CLOUD_LAYERS[c.layer];
      var span = H + 220;
      var y = ((c.y * span - scroll * layer.p + t * layer.drift * 0.35) % span + span) % span - 110;
      var x = ((c.x + t * layer.drift) % (W + 220) + (W + 220)) % (W + 220) - 110;
      var tintAmt = clamp((alt - 650) / 1100, 0, 1) * 0.55 + layer.tint * 0.3;
      if (night) tintAmt = clamp(tintAmt + 0.2, 0, 1);
      var col = lerpColor(base, sky.top, tintAmt);
      var alpha = layer.a * (0.88 + 0.12 * Math.sin(t * 0.5 + c.phase));
      if (night) alpha *= 0.6;
      alpha *= 1 - clamp((alt - 1400) / 1200, 0, 0.55);
      drawCloudShape(ctx, x, y, c.scale * layer.s, rgb(col), alpha);
    }
  }

  function drawCloudShape(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 20 * s, 0, TAU);
    ctx.arc(x + 22 * s, y - 12 * s, 26 * s, 0, TAU);
    ctx.arc(x + 51 * s, y - 2 * s, 19 * s, 0, TAU);
    ctx.arc(x + 28 * s, y + 9 * s, 21 * s, 0, TAU);
    ctx.arc(x - 13 * s, y + 7 * s, 14 * s, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = '#2f5c8f';
    ctx.beginPath();
    ctx.ellipse(x + 20 * s, y + 15 * s, 40 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMenuSparkles(ctx, game) {
    var H = game.worldH;
    var t = game.time;
    for (var i = 0; i < 9; i++) {
      var x = ((i * 71 + t * 9) % (W + 60) + (W + 60)) % (W + 60) - 30;
      var y = ((i * 113 + Math.sin(t * 0.55 + i * 1.7) * 34) % (H + 60) + (H + 60)) % (H + 60) - 30;
      var a = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.1));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 3 === 0 ? '#fff6c9' : '#ffe28a';
      sparklePath(ctx, x, y, 2.4 + (i % 3));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ============ المنصات ============ */

  function drawPlatforms(ctx, game) {
    var top = game.cameraY - 90;
    var bottom = game.cameraY + game.worldH + 60;
    for (var i = 0; i < game.platforms.length; i++) {
      var p = game.platforms[i];
      if (p.dead || p.y < top || p.y > bottom) continue;
      drawPlatform(ctx, game, p);
    }
  }

  function drawPlatform(ctx, game, p) {
    var x = p.x - p.w / 2;
    var y = p.y;
    var w = p.w;

    ctx.fillStyle = 'rgba(18,48,88,.10)';
    ctx.beginPath();
    ctx.ellipse(p.x, y + 21, w * 0.46, 4.5, 0, 0, TAU);
    ctx.fill();

    if (p.type === 'ice' || p.type === 'moving') drawIce(ctx, p, x, y, w);
    else if (p.type === 'wood' || p.type === 'fragile') drawWood(ctx, p, x, y, w);
    else if (p.type === 'cloud') drawCloudPlatform(ctx, p, x, y, w);
    else if (p.type === 'spring') {
      drawGrass(ctx, x, y, w);
      drawSpringCoil(ctx, p, x, y, w);
    } else {
      drawGrass(ctx, x, y, w);
    }
  }

  function drawGrass(ctx, x, y, w) {
    roundRect(ctx, x, y + 5, w, 13, 7);
    ctx.fillStyle = '#a76a3c';
    ctx.fill();

    roundRect(ctx, x + 2, y + 11, w - 4, 6, 4);
    ctx.fillStyle = '#87522f';
    ctx.fill();

    roundRect(ctx, x, y, w, 10, 6);
    ctx.fillStyle = '#6fce4a';
    ctx.fill();

    ctx.fillStyle = 'rgba(45,140,40,.28)';
    ctx.fillRect(x + 4, y + 7, w - 8, 2);

    roundRect(ctx, x + 4, y + 2, w - 8, 3.5, 2);
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(75,48,22,.26)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y + 1, w, 17, 8);
    ctx.stroke();

    ctx.fillStyle = '#58b93e';
    var n = Math.max(2, Math.floor(w / 26));
    for (var i = 0; i < n; i++) {
      var bx = x + 10 + i * ((w - 20) / Math.max(1, n - 1));
      ctx.beginPath();
      ctx.moveTo(bx - 2.5, y + 2);
      ctx.lineTo(bx, y - 4);
      ctx.lineTo(bx + 2.5, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawIce(ctx, p, x, y, w) {
    var g = ctx.createLinearGradient(0, y, 0, y + 18);
    g.addColorStop(0, '#effcff');
    g.addColorStop(0.45, '#a9e6fc');
    g.addColorStop(1, '#6fc9ee');
    roundRect(ctx, x, y, w, 18, 8);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.6;
    roundRect(ctx, x + 0.8, y + 0.8, w - 1.6, 16.4, 7.4);
    ctx.stroke();

    roundRect(ctx, x + 4, y + 2, w - 8, 4, 2);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(70,160,200,.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + 6);
    ctx.lineTo(x + w * 0.42, y + 17);
    ctx.moveTo(x + w * 0.68, y + 5);
    ctx.lineTo(x + w * 0.55, y + 17);
    ctx.stroke();

    var cx = x + w / 2;
    ctx.strokeStyle = 'rgba(28,118,165,.5)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 4, y + 7);
      ctx.lineTo(cx + s * 10, y + 11);
      ctx.lineTo(cx + s * 4, y + 15);
      ctx.stroke();
    }
  }

  function drawWood(ctx, p, x, y, w) {
    roundRect(ctx, x, y + 2, w, 16, 6);
    ctx.fillStyle = '#c98e58';
    ctx.fill();

    roundRect(ctx, x + 1, y + 2, w - 2, 6, 4);
    ctx.fillStyle = '#e0ad78';
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,74,38,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, y + 7);
    ctx.lineTo(x + w * 0.34, y + 17);
    ctx.moveTo(x + w * 0.67, y + 7);
    ctx.lineTo(x + w * 0.67, y + 17);
    ctx.stroke();

    ctx.strokeStyle = '#7a4e2b';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.22, y + 5);
    ctx.lineTo(x + w * 0.28, y + 9);
    ctx.lineTo(x + w * 0.23, y + 13);
    ctx.lineTo(x + w * 0.3, y + 17);
    ctx.stroke();

    ctx.fillStyle = '#6f4b2c';
    var nails = [[x + 5, y + 6], [x + w - 5, y + 6], [x + 5, y + 14], [x + w - 5, y + 14]];
    for (var i = 0; i < nails.length; i++) {
      ctx.beginPath();
      ctx.arc(nails[i][0], nails[i][1], 1.4, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(95,58,28,.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y + 2, w, 16, 6);
    ctx.stroke();
  }

  function drawSpringCoil(ctx, p, x, y, w) {
    var cx = x + w / 2;
    var lift = p.springT * 8;
    var plateY = y - 15 + lift;
    var top = plateY + 4;
    var bottom = y + 1;

    ctx.strokeStyle = '#b9c8d6';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, bottom);
    for (var i = 0; i <= 5; i++) {
      var yy = bottom + (top - bottom) * (i / 5);
      var xx = cx + (i % 2 === 0 ? -8 : 8);
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    roundRect(ctx, cx - 11, plateY - 3, 22, 6, 3);
    ctx.fillStyle = '#ff7a59';
    ctx.fill();
    ctx.strokeStyle = '#c2511f';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    roundRect(ctx, cx - 8, plateY - 2, 16, 2, 1);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fill();
  }

  function drawCloudPlatform(ctx, p, x, y, w) {
    var cx = x + w / 2;

    roundRect(ctx, x + 4, y + 8, w - 8, 10, 5);
    ctx.fillStyle = 'rgba(205,235,255,.96)';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    var puffs = [
      [x + 12, y + 11, 10],
      [x + w * 0.3, y + 7, 12],
      [x + w * 0.55, y + 6, 13.5],
      [x + w * 0.8, y + 10, 11],
      [cx, y + 15, 12]
    ];
    for (var i = 0; i < puffs.length; i++) {
      ctx.beginPath();
      ctx.arc(puffs[i][0], puffs[i][1], puffs[i][2], 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + 3, 14, 5, -0.15, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff8cf';
    sparklePath(ctx, x + w * 0.18, y + 3, 3);
    ctx.fill();
    sparklePath(ctx, x + w * 0.85, y + 2, 2.4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ============ المكافآت ============ */

  function drawPickups(ctx, game) {
    var top = game.cameraY - 90;
    var bottom = game.cameraY + game.worldH + 60;
    for (var i = 0; i < game.pickups.length; i++) {
      var pk = game.pickups[i];
      if (pk.dead || pk.y < top || pk.y > bottom) continue;
      drawPickup(ctx, game, pk);
    }
  }

  function drawPickup(ctx, game, pk) {
    var t = game.time;
    var bob = Math.sin(t * 2.6 + pk.phase) * 4.5;
    var y = pk.baseY + bob;
    pk.y = y;

    if (pk.type === 'star' || pk.type === 'big') {
      var big = pk.type === 'big';
      var r = big ? 17 : 12;
      var glow = ctx.createRadialGradient(pk.x, y, 2, pk.x, y, r * 2.9);
      glow.addColorStop(0, big ? 'rgba(255,240,150,.55)' : 'rgba(255,236,140,.4)');
      glow.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pk.x, y, r * 2.9, 0, TAU);
      ctx.fill();

      if (big) {
        ctx.strokeStyle = 'rgba(255,225,100,' + (0.35 + 0.2 * Math.sin(t * 4)) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pk.x, y, 24 + Math.sin(t * 4) * 3, 0, TAU);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(t * 1.5 + pk.phase * 0.1);
      var pulse = 1 + Math.sin(t * 4 + pk.phase) * 0.07;
      starPath(ctx, 0, 0, r * pulse, r * 0.46 * pulse, 5);
      ctx.fillStyle = big ? '#ffe66d' : '#ffd93d';
      ctx.fill();
      ctx.strokeStyle = '#f0a51e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.3, r * 0.18, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (pk.type === 'jet') {
      var glow2 = ctx.createRadialGradient(pk.x, y, 2, pk.x, y, 34);
      glow2.addColorStop(0, 'rgba(255,138,76,.42)');
      glow2.addColorStop(1, 'rgba(255,138,76,0)');
      ctx.fillStyle = glow2;
      ctx.beginPath();
      ctx.arc(pk.x, y, 34, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(-0.35 + Math.sin(t * 2 + pk.phase) * 0.08);

      ctx.globalCompositeOperation = 'lighter';
      var fg = ctx.createRadialGradient(0, 16, 1, 0, 16, 12);
      fg.addColorStop(0, 'rgba(255,255,210,.9)');
      fg.addColorStop(0.5, 'rgba(255,170,60,.6)');
      fg.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(0, 19 + Math.sin(t * 20) * 2, 5.5, 10, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.fillStyle = '#f4f8fc';
      roundRect(ctx, -8, -15, 16, 27, 8);
      ctx.fill();
      ctx.strokeStyle = '#9fb3c7';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#ff6b4a';
      roundRect(ctx, -8, -15, 16, 8, 6);
      ctx.fill();

      ctx.fillStyle = '#bfefff';
      ctx.beginPath();
      ctx.arc(0, -2, 4.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7f99b0';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(-14, 14);
      ctx.lineTo(-8, 12);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, 5);
      ctx.lineTo(14, 14);
      ctx.lineTo(8, 12);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      return;
    }

    if (pk.type === 'magnet') {
      var glow3 = ctx.createRadialGradient(pk.x, y, 2, pk.x, y, 32);
      glow3.addColorStop(0, 'rgba(62,207,195,.42)');
      glow3.addColorStop(1, 'rgba(62,207,195,0)');
      ctx.fillStyle = glow3;
      ctx.beginPath();
      ctx.arc(pk.x, y, 32, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(Math.sin(t * 2 + pk.phase) * 0.12);
      ctx.strokeStyle = '#ff5d5d';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(-10, 0);
      ctx.arc(0, 0, 10, Math.PI, Math.PI * 2);
      ctx.lineTo(10, -10);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-10, -12);
      ctx.lineTo(-10, -9);
      ctx.moveTo(10, -12);
      ctx.lineTo(10, -9);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath();
      ctx.arc(-10, -4, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ============ الشخصية ============ */

  function drawPlayer(ctx, game) {
    var p = game.player;

    if (game.magnetTime > 0) {
      var pulse = 0.5 + 0.5 * Math.sin(game.time * 6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 0.2 + 0.18 * pulse;
      var rg = ctx.createRadialGradient(0, 0, 10, 0, 0, 40);
      rg.addColorStop(0, 'rgba(62,207,195,0)');
      rg.addColorStop(0.7, 'rgba(62,207,195,.5)');
      rg.addColorStop(1, 'rgba(62,207,195,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = 'rgba(62,207,195,.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -game.time * 22;
      ctx.beginPath();
      ctx.arc(0, 0, 31, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    var squash = p.squash;
    var stretch = clamp(-p.vy / 9000, 0, 0.12);
    var sy = 1 - squash * 0.55 + stretch;
    var sx = 1 + squash * 0.42 - stretch * 0.55;
    var lean = clamp(p.vx / 4200, -0.16, 0.16);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(lean);
    ctx.scale(sx, sy);

    if (game.jetpackTime > 0) drawJetpack(ctx, game);
    drawScarfTail(ctx, game);

    ctx.fillStyle = '#ffb057';
    ctx.strokeStyle = '#c2511f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(-9, 18, 7, 4.5, -0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(9, 18, 7, 4.5, 0.2, 0, TAU);
    ctx.fill();
    ctx.stroke();

    var grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, '#ffd76a');
    grad.addColorStop(0.55, '#ffab4d');
    grad.addColorStop(1, '#ff7a45');
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 19, 0, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#c2511f';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 7, 12, 10, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,236,180,.32)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-6.5, -9, 6, 3.8, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();

    var blink = p.blinkT > 0;
    if (blink) {
      ctx.strokeStyle = '#4a2a12';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9.5, -4);
      ctx.quadraticCurveTo(-6.5, -1.4, -3.5, -4);
      ctx.moveTo(3.5, -4);
      ctx.quadraticCurveTo(6.5, -1.4, 9.5, -4);
      ctx.stroke();
    } else {
      var lookX = clamp(p.vx / 300, -1, 1) * 1.5;
      var lookY = clamp(p.vy / 800, -1.4, 1.4);
      for (var s = -1; s <= 1; s += 2) {
        var ex = s * 6.5;
        ctx.beginPath();
        ctx.ellipse(ex, -4, 5, 5.6, 0, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + lookX, -4 + lookY, 2.6, 0, TAU);
        ctx.fillStyle = '#33251a';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + lookX - 0.9, -5 + lookY, 0.8, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(255,106,106,.38)';
    ctx.beginPath();
    ctx.ellipse(-12.5, 5, 3.4, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12.5, 5, 3.4, 2.6, 0, 0, TAU);
    ctx.fill();

    if (p.vy > 680) {
      ctx.beginPath();
      ctx.ellipse(0, 8, 3.2, 4.2, 0, 0, TAU);
      ctx.fillStyle = '#8a3a16';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#8a3a16';
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, 7);
      ctx.quadraticCurveTo(0, 11, 4, 7);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-16.5, 9);
    ctx.quadraticCurveTo(0, 17, 16.5, 9);
    ctx.strokeStyle = '#20a9c9';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#2ec9b2';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.quadraticCurveTo(0, 11.5, 12, 6);
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }

  function drawScarfTail(ctx, game) {
    var wave = Math.sin(game.time * 9) * 0.9 + clamp(game.player.vx * 0.02, -1, 1);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-11, 8);
    ctx.bezierCurveTo(-22, 10 + wave * 4, -26, 17 + wave * 6, -34, 15 + wave * 7);
    ctx.bezierCurveTo(-27, 21 + wave * 4, -18, 19, -12, 15);
    ctx.closePath();
    ctx.fillStyle = '#2ec9b2';
    ctx.strokeStyle = '#128aa8';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-12, 11);
    ctx.bezierCurveTo(-20, 14 + wave * 2, -24, 19 + wave * 4, -29, 21 + wave * 5);
    ctx.bezierCurveTo(-23, 23 + wave * 3, -17, 19, -12, 16);
    ctx.closePath();
    ctx.fillStyle = '#20a9c9';
    ctx.fill();
    ctx.restore();
  }

  function drawJetpack(ctx, game) {
    var puff = 0.8 + Math.random() * 0.4;
    ctx.save();

    ctx.fillStyle = '#c7d6e6';
    ctx.strokeStyle = '#7f93a8';
    ctx.lineWidth = 2;
    roundRect(ctx, 4, -10, 13, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff7a4d';
    roundRect(ctx, 6, -14, 9, 5, 2.5);
    ctx.fill();

    ctx.strokeStyle = '#8ea3b8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(3, -6);
    ctx.lineTo(-5, -2);
    ctx.stroke();

    ctx.fillStyle = '#8998a8';
    roundRect(ctx, 8, 13, 6, 5, 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    var fg = ctx.createRadialGradient(11, 20, 1, 11, 20, 13 * puff);
    fg.addColorStop(0, 'rgba(255,255,220,.95)');
    fg.addColorStop(0.45, 'rgba(255,175,60,.8)');
    fg.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(11, 23, 6 * puff, 12 * puff, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /* ============ الجزيئات والنصوص ============ */

  function drawParticles(ctx, game) {
    var list = game.particles;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var a = clamp(p.life / p.max, 0, 1) * (p.alpha == null ? 1 : p.alpha);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color || '#ffffff';

      if (p.type === 'star') {
        starPath(ctx, p.x, p.y, p.size, p.size * 0.45, 5);
        ctx.fill();
      } else if (p.type === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color || '#ffffff';
        ctx.lineWidth = p.width || 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 3), 0, TAU);
        ctx.stroke();
      } else if (p.type === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(ctx, game) {
    var list = game.texts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var a = clamp((t.life / t.max) * 2.2, 0, 1);
      var pop = 1 + (1 - clamp(t.life / t.max, 0, 1)) * 0.25;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.font = '900 ' + (t.size || 15) + 'px Cairo, Segoe UI, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(70,42,18,.25)';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color || '#ffd23f';
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  window.NatataArt = {
    drawBackground: drawBackground,
    drawMenuSparkles: drawMenuSparkles,
    drawPlatforms: drawPlatforms,
    drawPickups: drawPickups,
    drawParticles: drawParticles,
    drawPlayer: drawPlayer,
    drawTexts: drawTexts
  };
})();
