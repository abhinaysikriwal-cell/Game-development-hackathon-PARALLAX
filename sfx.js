/* GlitchVerse SFX: every sound is synthesized with the Web Audio API.
   No audio files needed. Drop this file in your page and use window.SFX.

   Quick start:
     <script src="sfx.js"></script>
     SFX.setCharacter('rin');      // or 'vex'
     SFX.jump();  SFX.flipGravity();  SFX.freezeStart();  SFX.freezeEnd();
   Audio unlocks itself on the first click or key press. */
(function (root) {
  'use strict';

  let ctx = null, master = null, comp = null, analyser = null, noiseBuf = null;
  let character = 'rin', volume = 0.7, muted = false, activeBiome = 0;
  let shimmer = null, amb = null, lastFoot = 0;
  const crushCache = {};

  const jit = (v, a) => v * (1 + (Math.random() * 2 - 1) * (a === undefined ? 0.03 : a));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function init() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      comp = ctx.createDynamicsCompressor();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Bit-crush curve: the "glitch" texture
  function crush(bits) {
    if (!crushCache[bits]) {
      const n = 4096, c = new Float32Array(n), steps = Math.pow(2, bits);
      for (let i = 0; i < n; i++) c[i] = Math.round((i * 2 / n - 1) * steps) / steps;
      crushCache[bits] = c;
    }
    return crushCache[bits];
  }

  // One enveloped oscillator
  function tone(o) {
    const c = init(); if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    const j = o.jitter === undefined ? 0.03 : o.jitter;
    osc.frequency.setValueAtTime(jit(o.f0, j), t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, jit(o.f1, j)), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol === undefined ? 0.2 : o.vol), t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.crush) { const ws = c.createWaveShaper(); ws.curve = crush(o.crush); node.connect(ws); node = ws; }
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); g.connect(master);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib; lg.gain.value = 25;
      l.connect(lg); lg.connect(osc.detune);
      l.start(t); l.stop(t + o.dur + 0.05);
    }
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  // One filtered noise burst
  function noise(o) {
    const c = init(); if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.4); src.stop(t + o.dur + 0.05);
  }

  // Character voice: Rin is bright and metallic, Vex is hollow and detuned
  function V() {
    return character === 'vex'
      ? { wave: 'sawtooth', m: 0.8, lp: 1800, det: 14, vib: 5, foot: ['lowpass', 500] }
      : { wave: 'square', m: 1, lp: 6500, det: 0, vib: 0, foot: ['highpass', 2800] };
  }

  function voiced(f0, f1, dur, vol, extra) {
    const v = V();
    const o = Object.assign({ type: v.wave, f0: f0 * v.m, f1: f1 ? f1 * v.m : 0, dur: dur, vol: vol, lp: v.lp, vib: v.vib }, extra || {});
    tone(o);
    if (v.det) {
      tone(Object.assign({}, o, { detune: v.det, vol: vol * 0.7 }));
      tone(Object.assign({}, o, { detune: -v.det, vol: vol * 0.7 }));
    } else {
      tone(Object.assign({}, o, { type: 'sine', f0: o.f0 * 2, f1: o.f1 * 2, vol: vol * 0.35, lp: 0, vib: 0 }));
    }
  }

  // ---------- Ambient hum (shifts with dimension, slows with time freeze) ----------
  const AMB = {
    A: { f: [146.83, 220, 293.66], lp: 1100 },   // cyan: cooler, higher
    B: { f: [98, 146.83, 196], lp: 700 }          // magenta: warmer, lower
  };

  function ambApply(fast) {
    if (!amb) return;
    const t = ctx.currentTime, tau = fast ? 0.05 : 0.2;
    const p = AMB[amb.dim], k = amb.frozen ? 0.5 : 1;
    amb.oscs.forEach((o, i) => o.frequency.setTargetAtTime(p.f[i] * k, t, tau));
    amb.lp.frequency.setTargetAtTime(amb.frozen ? 250 : p.lp, t, tau + 0.1);
  }

  function rainPatter(){
    if(!amb||amb.biome!==1||muted)return;
    if(Math.random()<.78){
      const f=1300+Math.random()*4200;
      noise({type:'bandpass',f0:f,f1:Math.max(420,f*.42),dur:.045+Math.random()*.095,vol:.018+Math.random()*.018,q:.38,attack:.004});
    }
    if(Math.random()<.12)noise({type:'lowpass',f0:780+Math.random()*520,f1:150+Math.random()*100,dur:.16+Math.random()*.12,vol:.018,q:.7,attack:.008});
  }
  function birdChirp(){
    if(!amb||(amb.biome!==4)||muted)return;
    const c=ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
    const f=1800+Math.random()*1200;
    o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(1.12+Math.random()*.08),t+.055);o.frequency.exponentialRampToValueAtTime(f*.74,t+.2);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.025,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+.21);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+.23);
  }

  function biomeBed(index,t){
    const source=ctx.createBufferSource();source.buffer=noiseBuf;source.loop=true;
    const filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    const settings=[{type:'bandpass',freq:900,q:.45,vol:.022},{type:'bandpass',freq:2400,q:.28,vol:.075},{type:'bandpass',freq:1350,q:.72,vol:.048},{type:'lowpass',freq:210,q:.5,vol:.07},{type:'bandpass',freq:700,q:.3,vol:.028}][index]||{type:'bandpass',freq:900,q:.45,vol:.022};
    filter.type=settings.type;filter.frequency.value=settings.freq;filter.Q.value=settings.q;
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(settings.vol,t+1.2);
    source.connect(filter);filter.connect(gain);gain.connect(master);source.start(t);
    let rumble=null,rumbleGain=null;
    if(index===2||index===3){rumble=ctx.createOscillator();rumble.type='sine';rumble.frequency.value=index===2?58:48;rumbleGain=ctx.createGain();rumbleGain.gain.setValueAtTime(.0001,t);rumbleGain.gain.linearRampToValueAtTime(.035,t+1.4);rumble.connect(rumbleGain);rumbleGain.connect(master);rumble.start(t)}
    return {source:source,filter:filter,gain:gain,rumble:rumble,rumbleGain:rumbleGain};
  }

  function startAmbient(dim,biome){
    const c=init();if(!c)return;if(Number.isInteger(biome))activeBiome=clamp(biome,0,4);
    if(amb){setAmbientDimension(dim);if(amb.biome!==activeBiome)setAmbientBiome(activeBiome);return}
    const t=c.currentTime,g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.05,t+1.5);
    const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;
    const types=['triangle','sine','sawtooth'];
    const oscs=types.map((ty,i)=>{const o=c.createOscillator();o.type=ty;o.detune.value=i===2?8:0;const og=c.createGain();og.gain.value=i===2?.25:1;o.connect(og);og.connect(lp);o.start(t);return o});
    const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.2;lg.gain.value=250;lfo.connect(lg);lg.connect(lp.frequency);lfo.start(t);
    const bed=biomeBed(activeBiome,t);lp.connect(g);g.connect(master);
    amb={g:g,lp:lp,oscs:oscs,lfo:lfo,dim:dim==='B'?'B':'A',frozen:!!shimmer,biome:activeBiome,bed:bed,birdTimer:null};
    if(activeBiome===1)amb.birdTimer=setInterval(rainPatter,85);
    if(activeBiome===4)amb.birdTimer=setInterval(()=>{birdChirp();if(Math.random()<.45)setTimeout(birdChirp,120+Math.random()*180)},2600);
    if(activeBiome===2)amb.birdTimer=setInterval(()=>{tone({type:'sine',f0:680,f1:540,dur:.28,vol:.045,lp:1800});setTimeout(()=>tone({type:'sine',f0:420,f1:340,dur:.34,vol:.035,lp:1300}),220)},6800);
    if(activeBiome===3)amb.birdTimer=setInterval(()=>{if(Math.random()<.82){noise({type:'lowpass',f0:620+Math.random()*240,f1:145,dur:.2+Math.random()*.12,vol:.07,q:.8,attack:.012});tone({type:'triangle',f0:115+Math.random()*60,f1:34,dur:.24,vol:.055,lp:520,jitter:.18});if(Math.random()<.38)setTimeout(()=>noise({type:'bandpass',f0:900,f1:2100,dur:.12,vol:.025,q:.7}),90)}},1450);
    ambApply(true);
  }

  function stopAmbient(){
    if(!amb)return;const a=amb,t=ctx.currentTime;amb=null;
    a.g.gain.cancelScheduledValues(t);a.g.gain.setValueAtTime(Math.max(.0001,a.g.gain.value),t);a.g.gain.linearRampToValueAtTime(.0001,t+.6);
    a.oscs.forEach(o=>o.stop(t+.7));a.lfo.stop(t+.7);if(a.birdTimer)clearInterval(a.birdTimer);
    if(a.bed){a.bed.gain.gain.cancelScheduledValues(t);a.bed.gain.gain.setTargetAtTime(.0001,t,.12);a.bed.source.stop(t+.7);if(a.bed.rumble){a.bed.rumbleGain.gain.setTargetAtTime(.0001,t,.12);a.bed.rumble.stop(t+.7)}}
  }

  function setAmbientBiome(index){activeBiome=clamp(index|0,0,4);if(!amb||amb.biome===activeBiome)return;const d=amb.dim;stopAmbient();startAmbient(d,activeBiome)}

  function setAmbientDimension(dim) {
    if (!amb) return;
    amb.dim = dim === 'B' ? 'B' : 'A';
    ambApply();
  }

  function ambFrozen(b) { if (amb) { amb.frozen = b; ambApply(); } }

  function smashBlock(broken){noise({type:'lowpass',f0:broken?360:540,f1:broken?95:180,dur:.15,vol:.075,q:.85,attack:.008});tone({type:'triangle',f0:broken?92:155,f1:broken?30:58,dur:.2,vol:.065,lp:620,jitter:.12});if(broken)noise({type:'bandpass',f0:1100,f1:2400,dur:.12,vol:.035,q:.9,attack:.003})}

  // ---------- Sounds ----------
  function footstep() {
    const n = (root.performance || Date).now();
    if (n - lastFoot < 80) return;
    lastFoot = n;
    const v = V();
    noise({ type: v.foot[0], f0: jit(v.foot[1], 0.15), dur: 0.07, vol: character === 'vex' ? 0.16 : 0.1, q: 0.7 });
    tone({ type: 'sine', f0: character === 'vex' ? 105 : 155, f1: 55, dur: 0.065, vol: 0.11, lp: 500 });
  }

  function jump() { noise({ type: 'bandpass', f0: 1200, f1: 420, dur: 0.16, vol: 0.055, q: 0.6 }); voiced(300, 640, 0.13, 0.14); }

  function land(strength) {
    const s = clamp(strength === undefined ? 1 : strength, 0.3, 1.5);
    noise({ type: 'lowpass', f0: 500, f1: 150, dur: 0.12, vol: 0.25 * s, q: 0.5 });
    tone({ type: 'sine', f0: 130, f1: 45, dur: 0.14, vol: 0.35 * s });
  }

  function flipGravity(up) {
    const d = up !== false;
    noise({ type: 'bandpass', f0: d ? 300 : 3500, f1: d ? 3500 : 300, q: 2, dur: 0.35, vol: 0.22 });
    voiced(d ? 220 : 660, d ? 660 : 220, 0.3, 0.1);
  }

  function freezeStart() {
    const c = init(); if (!c || shimmer) return;
    const t = c.currentTime;
    tone({ type: 'sine', f0: 900, f1: 90, dur: 0.7, vol: 0.3 });
    noise({ type: 'lowpass', f0: 5000, f1: 200, dur: 0.6, vol: 0.18, q: 0.5 });
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 0.5);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 7; lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g.gain);
    const nodes = [2349, 3136].map(f => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(g); o.start(t); return o;
    });
    nodes.push(lfo); lfo.start(t);
    g.connect(master);
    shimmer = { g: g, nodes: nodes };
    ambFrozen(true);
  }

  function freezeEnd(silent) {
    if (!shimmer) return;
    const c = ctx, t = c.currentTime, s = shimmer; shimmer = null;
    s.g.gain.cancelScheduledValues(t);
    s.g.gain.setValueAtTime(Math.max(0.0001, s.g.gain.value), t);
    s.g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    s.nodes.forEach(n => n.stop(t + 0.2));
    ambFrozen(false);
    if (!silent) {
      tone({ type: 'sine', f0: 120, f1: 900, dur: 0.25, vol: 0.25 });
      noise({ type: 'highpass', f0: 2000, f1: 6000, dur: 0.12, vol: 0.1 });
    }
  }

  function dimensionSwitch(dim) {
    const b = dim === 'B';
    const base = b ? 392 : 659.25;
    const scale = [0, 2, 4, 7, 9, 12, 14];
    for (let i = 0; i < 5; i++) {
      const f = base * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
      tone({ type: 'square', f0: f, dur: 0.04, vol: 0.12, delay: i * 0.04, crush: 5, lp: 5000, jitter: 0 });
    }
    noise({ type: 'highpass', f0: 4000, dur: 0.06, vol: 0.12 });
    tone({ type: 'triangle', f0: base * 2, f1: base * 2.02, dur: 0.12, vol: 0.14, delay: 0.2, jitter: 0.005 });
    setAmbientDimension(b ? 'B' : 'A');
  }

  function pickup() {
    tone({ type: 'sine', f0: 987.77, dur: 0.07, vol: 0.2, jitter: 0.01 });
    tone({ type: 'sine', f0: 1318.5, dur: 0.16, vol: 0.2, delay: 0.07, jitter: 0.01 });
    tone({ type: 'triangle', f0: 2637, dur: 0.12, vol: 0.05, delay: 0.07, jitter: 0.01 });
  }

  function death() {
    freezeEnd(true);
    tone({ type: 'sawtooth', f0: 420, f1: 35, dur: 0.7, vol: 0.3, crush: 4 });
    tone({ type: 'square', f0: 200, f1: 30, dur: 0.5, vol: 0.15, delay: 0.05, crush: 3 });
    noise({ type: 'lowpass', f0: 3000, f1: 200, dur: 0.5, vol: 0.3, q: 0.6 });
  }

  function levelComplete() {
    const third = character === 'vex' ? 622.25 : 659.25;   // Vex plays it minor
    const notes = [523.25, third, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      tone({ type: 'triangle', f0: f, dur: last ? 0.6 : 0.14, vol: 0.22, delay: i * 0.11, jitter: 0 });
      tone({ type: 'square', f0: f, dur: last ? 0.5 : 0.1, vol: 0.05, delay: i * 0.11, lp: 4000, jitter: 0 });
    });
    tone({ type: 'sine', f0: 2093, dur: 0.5, vol: 0.06, delay: 0.33, jitter: 0 });
  }

  function cooldown() { tone({ type: 'square', f0: 140, f1: 110, dur: 0.07, vol: 0.1, lp: 800 }); }
  function uiClick() { tone({ type: 'square', f0: 700, f1: 500, dur: 0.04, vol: 0.08, jitter: 0.01 }); }
  function uiHover() { tone({ type: 'sine', f0: 900, dur: 0.025, vol: 0.04, jitter: 0.01 }); }

  // Call on restart so nothing keeps playing
  function reset() { freezeEnd(true); }

  const SFX = {
    init: init, unlock: init,
    setCharacter: c => { character = c === 'vex' ? 'vex' : 'rin'; },
    getCharacter: () => character,
    setVolume: v => {
      volume = clamp(v, 0, 1);
      if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    },
    mute: m => {
      muted = !!m;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
    },
    toggleMute: () => { SFX.mute(!muted); return muted; },
    isMuted: () => muted,
    isFrozen: () => !!shimmer,
    getAnalyser: () => analyser,
    footstep: footstep, jump: jump, land: land, flipGravity: flipGravity,
    freezeStart: freezeStart, freezeEnd: () => freezeEnd(false),
    dimensionSwitch: dimensionSwitch, pickup: pickup, death: death,
    levelComplete: levelComplete, cooldown: cooldown, smashBlock: smashBlock,
    uiClick: uiClick, uiHover: uiHover,
    startAmbient: startAmbient, stopAmbient: stopAmbient, setAmbientDimension: setAmbientDimension, setAmbientBiome: setAmbientBiome,
    reset: reset
  };

  if (root.addEventListener) {
    ['pointerdown', 'keydown'].forEach(e => root.addEventListener(e, init, { once: true }));
  }
  root.SFX = SFX;
  if (typeof module !== 'undefined' && module.exports) module.exports = SFX;
})(typeof window !== 'undefined' ? window : this);
