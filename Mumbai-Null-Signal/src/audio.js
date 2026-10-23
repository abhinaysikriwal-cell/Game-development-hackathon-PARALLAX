const NOTES = [55, 65.41, 73.42, 82.41];

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.bed = null;
    this.muted = false;
    this.level = 0;
  }

  async start() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.38;
      this.master.connect(this.context.destination);
      this.createBed();
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.setLevel(this.level);
  }

  createBed() {
    const ctx = this.context;
    const bed = ctx.createGain();
    bed.gain.value = 0.42;
    bed.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 850;
    filter.Q.value = 0.7;
    filter.connect(bed);

    this.drone = [];
    [1, 1.5, 2.003].forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.value = NOTES[0] * ratio;
      gain.gain.value = index === 0 ? 0.48 : 0.13;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.drone.push({ osc, gain, ratio });
    });

    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.11;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 1250;
    rainFilter.Q.value = 0.45;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.19;
    noise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(bed);
    noise.start();

    this.bed = bed;
    this.filter = filter;
  }

  setLevel(index) {
    this.level = index;
    if (!this.context || !this.drone) return;
    const root = NOTES[index % NOTES.length];
    this.drone.forEach((voice) => {
      voice.osc.frequency.setTargetAtTime(root * voice.ratio, this.context.currentTime, 1.2);
    });
    this.filter.frequency.setTargetAtTime(index === 3 ? 1150 : 820 + index * 75, this.context.currentTime, 1);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.38, this.context.currentTime, 0.08);
    }
    return this.muted;
  }

  play(kind = "tap") {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4500;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    let start = 480;
    let end = 95;
    let duration = 0.15;
    let volume = 0.24;
    let wave = "sine";

    if (kind === "pickup") { start = 670; end = 1520; duration = 0.42; volume = 0.25; wave = "triangle"; }
    if (kind === "freeze") { start = 135; end = 64; duration = 0.62; volume = 0.32; wave = "sawtooth"; }
    if (kind === "gravity") { start = 110; end = 690; duration = 0.75; volume = 0.26; wave = "sine"; }
    if (kind === "dimension") { start = 720; end = 115; duration = 0.58; volume = 0.25; wave = "triangle"; }
    if (kind === "gate") { start = 180; end = 720; duration = 1; volume = 0.24; wave = "sine"; }
    if (kind === "impact") { start = 95; end = 42; duration = 0.3; volume = 0.35; wave = "sawtooth"; }
    if (kind === "step") { start = 75; end = 48; duration = 0.07; volume = 0.055; wave = "triangle"; }

    osc.type = wave;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, end), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.04, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);

    if (kind === "pickup" || kind === "gate") {
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(start * 1.5, now);
      overtone.frequency.exponentialRampToValueAtTime(end * 1.5, now + duration);
      overtoneGain.gain.setValueAtTime(0.0001, now);
      overtoneGain.gain.exponentialRampToValueAtTime(volume * 0.24, now + 0.03);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      overtone.connect(overtoneGain);
      overtoneGain.connect(this.master);
      overtone.start(now);
      overtone.stop(now + duration + 0.03);
    }
  }
}

