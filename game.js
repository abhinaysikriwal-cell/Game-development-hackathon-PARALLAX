/* GlitchVerse core: engine + levels. Uses window.SFX from sfx.js if present.
   Hooks for the interface:  Game.on.onScore / onTimer / onLevelComplete / onPlayerDied / onGameWon
   Controls for the interface: Game.init(canvas), setCharacter, startLevel(n), restartLevel(), pause(bool)
   Read-only state: Game.state
   Set Game.config.hud = false and Game.config.overlay = false to draw your own screens. */
(function (root) {
  'use strict';
  const T = 32, W = 30, H = 17, PW = 26, PH = 34;
  const SPEED = 235, GRAV = 1800, JUMP = 617, MAXV = 900;
  const C = { A: '#35F0FF', B: '#FF3EA5', gold: '#D8B04A' };
  const sfx = (n, ...a) => { if (root.SFX && root.SFX[n]) root.SFX[n](...a); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mk() {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    return {
      g: g,
      r(x1, y1, x2, y2, c) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = c; },
      s(x, y, c) { g[y][x] = c; }
    };
  }

  // Tiles: # solid | a solid only in dimension A | b solid only in dimension B
  //        ^ V spikes (up / down) | * shard | E exit | S player start
  const LEVELS = [
    {
      name: 'Phase',
      hint: 'Walls and platforms only exist in their own colour. Press E or Shift to switch dimension.',
      abilities: { dim: true, flip: false, freeze: false },
      startDim: 'A', par: 30,
      build(b) {
        b.r(0, 0, 29, 0, '#'); b.r(0, 0, 0, 16, '#'); b.r(29, 0, 29, 16, '#');
        b.r(0, 14, 12, 16, '#');            // start floor
        b.r(8, 1, 8, 13, 'a');              // wall 1: solid in A, switch to B to pass
        b.s(2, 13, 'S'); b.s(4, 11, '*');
        b.r(13, 16, 23, 16, '^');           // pit spikes
        b.r(15, 14, 16, 14, 'b'); b.s(15, 13, '*');   // platform that exists in B
        b.s(18, 10, '*');
        b.r(20, 12, 23, 12, 'a');           // platform that exists in A
        b.r(24, 12, 29, 16, '#');           // final floor
        b.r(25, 1, 25, 11, 'a');            // wall 2
        b.s(27, 11, '*'); b.s(28, 11, 'E');
      }
    }
  ];

  let canvas, ctx, lvl, grid, idx = 0, dim = 'A', character = 'rin';
  let p, collected = new Set(), shards = 0, shardsTotal = 0, scoreBase = 0, time = 0, deaths = 0;
  let status = 'playing', deadT = 0, glitch = 0, cdDim = 0, frozen = false, freezeBlocked = false;
  let paused = false, t = 0, tickT = 0, last = 0, result = null;
  const down = {}, pressed = {};
  const held = (...k) => k.some(c => down[c]);
  const hit = (...k) => k.some(c => { if (pressed[c]) { pressed[c] = false; return true; } return false; });
  const emit = (n, d) => { const f = Game.on[n]; if (f) f(d); };

  function cell(x, y) { return (x < 0 || x >= W || y < 0 || y >= H) ? '.' : grid[y][x]; }
  function solid(x, y, d) {
    if (x < 0 || x >= W || y < 0) return true;
    if (y >= H) return false;
    const c = grid[y][x];
    return c === '#' || (c === 'a' && d === 'A') || (c === 'b' && d === 'B');
  }
  function hits(x, y, d) {
    const x0 = Math.floor(x / T), x1 = Math.floor((x + PW - 0.01) / T);
    const y0 = Math.floor(y / T), y1 = Math.floor((y + PH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty, d)) return true;
    return false;
  }

  function loadLevel() {
    lvl = LEVELS[idx];
    const b = mk(); lvl.build(b);
    grid = b.g; collected = new Set(); shards = 0; shardsTotal = 0;
    p = { x: 0, y: 0, vx: 0, vy: 0, gs: 1, face: 1, grounded: true, coyote: 0, buf: 0, cut: false, step: 0, anim: 0 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y][x] === 'S') { p.x = x * T + (T - PW) / 2; p.y = (y + 1) * T - PH - 0.01; grid[y][x] = '.'; }
      if (grid[y][x] === '*') shardsTotal++;
    }
    dim = lvl.startDim; time = 0; deaths = deaths || 0; frozen = false; freezeBlocked = false;
    status = 'playing'; result = null; cdDim = 0; glitch = 0;
    sfx('reset'); sfx('startAmbient', dim); sfx('setAmbientDimension', dim);
    emit('onScore', scoreBase); emit('onTimer', 0);
  }

  function startLevel(i) {
    idx = clamp(i | 0, 0, LEVELS.length - 1);
    if (idx === 0) { scoreBase = 0; deaths = 0; }
    loadLevel();
  }
  function restartLevel() { loadLevel(); }

  function die() {
    if (status !== 'playing') return;
    status = 'dead'; deadT = 0.7; deaths++; frozen = false;
    sfx('death'); emit('onPlayerDied', { deaths: deaths, level: idx + 1 });
  }

  function win() {
    if (status !== 'playing') return;
    status = 'complete'; frozen = false; sfx('reset'); sfx('levelComplete');
    const bonus = Math.max(0, Math.round((lvl.par - time) * 10));
    const levelScore = shards * 100 + bonus;
    const stars = 1 + (shards === shardsTotal ? 1 : 0) + (time <= lvl.par ? 1 : 0);
    scoreBase += levelScore;
    result = { level: idx + 1, time: time, shards: shards, shardsTotal: shardsTotal, bonus: bonus, levelScore: levelScore, totalScore: scoreBase, stars: stars };
    emit('onScore', scoreBase); emit('onLevelComplete', result);
  }

  function next() {
    if (idx + 1 >= LEVELS.length) { status = 'won'; sfx('stopAmbient'); emit('onGameWon', { score: scoreBase, deaths: deaths }); }
    else startLevel(idx + 1);
  }

  function switchDim() {
    if (cdDim > 0) return;
    const nd = dim === 'A' ? 'B' : 'A';
    if (hits(p.x, p.y, nd)) { sfx('cooldown'); cdDim = 0.2; return; }   // would trap the player inside a wall
    dim = nd; cdDim = 0.25; glitch = 0.25; sfx('dimensionSwitch', dim);
  }

  function update(dt) {
    t += dt; if (glitch > 0) glitch -= dt; if (cdDim > 0) cdDim -= dt;
    if (hit('Digit1') && Game.config.keySelect) Game.setCharacter('rin');
    if (hit('Digit2') && Game.config.keySelect) Game.setCharacter('vex');
    if (status === 'complete') { if (Game.config.overlay && hit('Enter')) next(); return; }
    if (status === 'won') { if (Game.config.overlay && hit('Enter')) startLevel(0); return; }
    if (status === 'dead') { deadT -= dt; if (deadT <= 0) restartLevel(); return; }
    if (hit('KeyR')) { restartLevel(); return; }

    time += dt; tickT += dt;
    if (tickT >= 0.1) { tickT = 0; emit('onTimer', time); }
    const ab = lvl.abilities;

    // mechanics
    if (hit('KeyE', 'ShiftLeft', 'ShiftRight')) { if (ab.dim) switchDim(); else sfx('cooldown'); }
    if (hit('KeyG', 'KeyX')) {
      if (ab.flip) { p.gs *= -1; p.vy = 0; p.grounded = false; sfx('flipGravity', p.gs < 0); } else sfx('cooldown');
    }
    const wantF = held('KeyF');
    if (wantF && !frozen && !freezeBlocked) {
      if (ab.freeze) { frozen = true; sfx('freezeStart'); } else { freezeBlocked = true; sfx('cooldown'); }
    }
    if (!wantF) { freezeBlocked = false; if (frozen) { frozen = false; sfx('freezeEnd'); } }

    // movement
    const dir = (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0);
    p.vx = dir * SPEED; if (dir) p.face = dir;
    p.vy = clamp(p.vy + GRAV * p.gs * dt, -MAXV, MAXV);
    const jh = held('Space', 'ArrowUp', 'KeyW');
    if (hit('Space', 'ArrowUp', 'KeyW')) p.buf = 0.1; else p.buf -= dt;
    p.coyote = p.grounded ? 0.08 : p.coyote - dt;
    if (p.buf > 0 && p.coyote > 0) { p.vy = -JUMP * p.gs; p.buf = 0; p.coyote = 0; p.grounded = false; p.cut = false; sfx('jump'); }
    if (!jh && p.vy * p.gs < 0 && !p.cut) { p.vy *= 0.45; p.cut = true; }

    const wasG = p.grounded, pvy = p.vy;
    p.x += p.vx * dt;
    if (hits(p.x, p.y, dim)) p.x = p.vx > 0 ? Math.floor((p.x + PW) / T) * T - PW - 0.01 : Math.floor(p.x / T) * T + T + 0.01;
    p.grounded = false;
    p.y += p.vy * dt;
    if (hits(p.x, p.y, dim)) {
      p.y = p.vy > 0 ? Math.floor((p.y + PH) / T) * T - PH - 0.01 : Math.floor(p.y / T) * T + T + 0.01;
      if (p.vy * p.gs > 0) { p.grounded = true; p.cut = false; }
      p.vy = 0;
    }
    if (p.grounded && !wasG) sfx('land', Math.min(1.5, Math.abs(pvy) / 600));
    if (p.grounded && dir) { p.step -= dt; if (p.step <= 0) { sfx('footstep'); p.step = 0.22; } } else p.step = 0;
    if (dir && p.grounded) p.anim += dt * 14;

    // tile interactions
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = cell(tx, ty), k = tx + ',' + ty;
      if (c === '*' && !collected.has(k)) { collected.add(k); shards++; sfx('pickup'); emit('onScore', scoreBase + shards * 100); }
      else if (c === '^' || c === 'V') {
        const hy = c === '^' ? ty * T + 12 : ty * T;
        if (p.x < tx * T + 26 && p.x + PW > tx * T + 6 && p.y < hy + 20 && p.y + PH > hy) die();
      } else if (c === 'E') win();
    }
    if (p.y > H * T + 40 || p.y < -96) die();
  }

  // ---------- drawing ----------
  function drawTile(c, x, y, tx, ty) {
    if (c === '#') {
      ctx.fillStyle = '#1d2138'; ctx.fillRect(x, y, T, T);
      if (cell(tx, ty - 1) !== '#') { ctx.fillStyle = '#3a4170'; ctx.fillRect(x, y, T, 2); }
      if (cell(tx, ty + 1) !== '#') { ctx.fillStyle = '#3a4170'; ctx.fillRect(x, y + T - 2, T, 2); }
    } else if (c === 'a' || c === 'b') {
      const col = c === 'a' ? C.A : C.B, on = (c === 'a') === (dim === 'A');
      ctx.save();
      if (on) { ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.globalAlpha = 0.85; ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, T - 2, T - 2); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 6, y + 6, T - 12, T - 12); }
      else { ctx.globalAlpha = 0.35; ctx.strokeStyle = col; ctx.setLineDash([4, 4]); ctx.strokeRect(x + 3, y + 3, T - 6, T - 6); }
      ctx.restore();
    } else if (c === '^' || c === 'V') {
      ctx.fillStyle = '#ff6b6b'; ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const bx = x + i * 16;
        if (c === '^') { ctx.moveTo(bx, y + T); ctx.lineTo(bx + 8, y + 12); ctx.lineTo(bx + 16, y + T); }
        else { ctx.moveTo(bx, y); ctx.lineTo(bx + 8, y + 20); ctx.lineTo(bx + 16, y); }
      }
      ctx.fill();
    } else if (c === '*' && !collected.has(tx + ',' + ty)) {
      const cy = y + 16 + Math.sin(t * 3 + tx) * 3;
      ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 10; ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(x + 16, cy - 9); ctx.lineTo(x + 24, cy); ctx.lineTo(x + 16, cy + 9); ctx.lineTo(x + 8, cy); ctx.fill(); ctx.restore();
    } else if (c === 'E') {
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
      const g = ctx.createLinearGradient(0, y, 0, y + T); g.addColorStop(0, '#fff6d6'); g.addColorStop(1, C.gold);
      ctx.fillStyle = g; ctx.fillRect(x + 6, y + 2, 20, T - 2); ctx.restore();
    }
  }

  function drawPlayer() {
    const acc = C[dim], rin = character === 'rin';
    ctx.save(); ctx.translate(p.x + PW / 2, p.y + PH / 2);
    if (p.gs < 0) ctx.scale(1, -1);
    ctx.scale(p.face * 1.3, 1.3);
    if (status === 'dead') ctx.globalAlpha = Math.max(0, deadT / 0.7);
    const run = Math.abs(p.vx) > 1 && p.grounded, sw = run ? Math.sin(p.anim) * 3 : 0, br = Math.sin(t * 3) * 0.6;
    const R = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const glow = (on) => { ctx.shadowColor = acc; ctx.shadowBlur = on ? 8 : 0; };
    if (rin) {
      ctx.fillStyle = '#9A1F2A'; ctx.beginPath(); ctx.moveTo(-5, -1);
      ctx.lineTo(-10 + sw * 0.5 - (run ? 4 : 0), 9); ctx.lineTo(-3, 8); ctx.fill();
      R('#6D6A2C', -5 + sw * 0.5, 6, 4, 7); R('#6D6A2C', 1 - sw * 0.5, 6, 4, 7);
      R('#161826', -6, -3, 12, 10); R('#B86F24', -6, -3, 12, 4); R('#D8B04A', -6, 1, 12, 1); R('#A82A46', -6, 4, 12, 2);
      glow(1); ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-9, -15); ctx.stroke();
      ctx.fillStyle = '#E7B98F'; ctx.beginPath(); ctx.arc(0, -8 + br, 5, 0, 7); ctx.fill();
      R('#161826', -5, -13 + br, 10, 4); R('#9A1F2A', -8, -11 + br, 4, 2);
      glow(1); R(acc, -4, -12 + br, 2, 2); R(acc, 2, -9 + br, 2, 2); R(acc, 6, 1, 2, 2); glow(0);
      R('#161826', 5, -1, 3, 6);
    } else {
      R('#3A3446', -5 + sw * 0.5, 6, 4, 7); R('#3A3446', 1 - sw * 0.5, 6, 4, 7);
      R('#3A3446', -6, -3, 12, 10); R('#7A5FC0', -7, -5, 14, 3);
      ctx.fillStyle = '#E6DCC0'; ctx.beginPath();
      ctx.moveTo(-6, -4); ctx.lineTo(-9, -11); ctx.lineTo(-4, -5);
      ctx.moveTo(6, -4); ctx.lineTo(9, -11); ctx.lineTo(4, -5); ctx.fill();
      ctx.fillStyle = '#8F94D6'; ctx.beginPath(); ctx.arc(0, -9 + br, 5.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, -10 + br); ctx.lineTo(-10, -14 + br); ctx.lineTo(-4, -7 + br); ctx.fill();
      R(frozen ? '#BFE3FF' : '#E8222F', 1, -10 + br, 3, 2);
      glow(1); ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(0, 2, 2, 0, 7); ctx.fill();
      R(acc, 6, 3 + sw * 0.3, 2, 2); glow(0);
    }
    ctx.restore();
  }

  function overlay(lines) {
    ctx.fillStyle = 'rgba(8,10,20,.8)'; ctx.fillRect(0, 0, W * T, H * T);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e9ecf8';
    lines.forEach((l, i) => { ctx.font = (i ? '400 18px' : '600 34px') + ' "Chakra Petch", system-ui, sans-serif'; ctx.fillText(l, W * T / 2, 180 + i * 38 + (i ? 14 : 0)); });
    ctx.textAlign = 'left';
  }

  function draw() {
    const acc = C[dim];
    ctx.clearRect(0, 0, W * T, H * T);
    ctx.fillStyle = '#0c0e19'; ctx.fillRect(0, 0, W * T, H * T);
    const bg = ctx.createLinearGradient(0, 0, 0, H * T);
    bg.addColorStop(0, dim === 'A' ? 'rgba(53,240,255,.10)' : 'rgba(255,62,165,.10)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W * T, H * T);
    ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H * T); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * T); ctx.lineTo(W * T, y * T); }
    ctx.stroke();
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { const c = grid[ty][tx]; if (c !== '.') drawTile(c, tx * T, ty * T, tx, ty); }
    drawPlayer();
    if (frozen) { ctx.fillStyle = 'rgba(150,210,255,.13)'; ctx.fillRect(0, 0, W * T, H * T); }
    if (glitch > 0) {
      ctx.fillStyle = acc; ctx.globalAlpha = 0.18;
      for (let i = 0; i < 7; i++) ctx.fillRect(0, Math.random() * H * T, W * T, 3 + Math.random() * 12);
      ctx.globalAlpha = 1;
    }
    if (Game.config.hud) {
      ctx.font = '600 15px "Chakra Petch", system-ui, sans-serif'; ctx.fillStyle = '#e9ecf8';
      ctx.fillText('Level ' + (idx + 1) + ': ' + lvl.name, 40, 28);
      ctx.fillText('Score ' + (scoreBase + shards * 100) + '   Shards ' + shards + '/' + shardsTotal + '   Time ' + time.toFixed(1), 40, 48);
      const ab = lvl.abilities;
      [['E', 'Dimension', ab.dim], ['G', 'Gravity', ab.flip], ['F', 'Freeze', ab.freeze]].forEach((m, i) => {
        ctx.fillStyle = m[2] ? acc : 'rgba(150,155,180,.4)'; ctx.fillText('[' + m[0] + '] ' + m[1], 700 + i * 0, 28 + i * 20);
      });
      ctx.fillStyle = 'rgba(233,236,248,.7)'; ctx.font = '400 14px "Chakra Petch", system-ui, sans-serif';
      ctx.fillText(lvl.hint, 40, H * T - 20);
    }
    if (Game.config.overlay) {
      if (status === 'complete') overlay(['Level complete', result.stars + ' of 3 stars', 'Shards ' + result.shards + '/' + result.shardsTotal + '   Time ' + result.time.toFixed(1) + 's   Score ' + result.totalScore, 'Press Enter to continue']);
      if (status === 'won') overlay(['All levels cleared', 'Final score ' + scoreBase, 'Press Enter to play again']);
    }
  }

  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016); last = ts;
    if (!paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  const Game = {
    config: { hud: true, overlay: true, keySelect: true },
    on: {},
    levels: LEVELS,
    init(cv) {
      canvas = cv; canvas.width = W * T; canvas.height = H * T; ctx = canvas.getContext('2d');
      root.addEventListener('keydown', e => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (!e.repeat) pressed[e.code] = true; down[e.code] = true;
      });
      root.addEventListener('keyup', e => { down[e.code] = false; });
      root.addEventListener('blur', () => { for (const k in down) down[k] = false; });
      startLevel(0); requestAnimationFrame(frame);
    },
    setCharacter(c) { character = c === 'vex' ? 'vex' : 'rin'; sfx('setCharacter', character); },
    startLevel: startLevel, restartLevel: restartLevel,
    pause(b) { paused = !!b; },
    get state() {
      return {
        level: idx + 1, name: lvl && lvl.name, status: status, score: scoreBase + shards * 100, time: time,
        dim: dim, gravityUp: p ? p.gs > 0 : true, frozen: frozen, shards: shards, shardsTotal: shardsTotal, deaths: deaths,
        character: character, abilities: lvl && lvl.abilities, cooldowns: { dim: Math.max(0, cdDim) }
      };
    }
  };
  root.Game = Game;
})(typeof window !== 'undefined' ? window : this);
