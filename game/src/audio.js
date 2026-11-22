// Sound, synthesized live with WebAudio — no audio files, nothing to download.
// Engine hum, sirens, gunshots, pickups and a small chiptune loop, all built
// from oscillators and filtered noise. Nothing plays before the player's first
// click, which is when the browser allows an AudioContext to start.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  shot() { this._noise(0.14, 0.5, 2600, 'highpass'); this._tone(190, 0.08, 'square', 0.16, 60); }
  enemyShot() { this._noise(0.12, 0.28, 2000, 'highpass'); }
  punch() { this._noise(0.1, 0.35, 500); this._tone(120, 0.09, 'sine', 0.3, 55); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); setTimeout(() => this._tone(990, 0.12, 'sine', 0.25), 70); }
  crash() { this._noise(0.25, 0.4, 700); }
  explosion() { this._noise(0.7, 0.6, 420); this._tone(70, 0.5, 'sine', 0.4, 30); }
  thud() { this._tone(90, 0.12, 'sine', 0.3, 45); }
  carjack() { this._tone(520, 0.1, 'square', 0.2, 780); }
  sirenBurst() { this._tone(720, 0.22, 'sine', 0.16, 950); setTimeout(() => this._tone(950, 0.22, 'sine', 0.16, 720), 200); }
  lostHeat() { this._tone(523, 0.14, 'sine', 0.22); setTimeout(() => this._tone(784, 0.22, 'sine', 0.22), 130); }
  busted() { this._tone(392, 0.25, 'sawtooth', 0.2, 196); setTimeout(() => this._tone(196, 0.5, 'sawtooth', 0.2, 98), 240); }
  wasted() { this._tone(330, 0.4, 'sawtooth', 0.22, 110); setTimeout(() => this._tone(165, 0.8, 'sawtooth', 0.22, 55), 380); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, 'square', 0.18), i * 110)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'square', 0.2), i * 120)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'sawtooth', 0.18), i * 130)); }
  enemyDown() { this._tone(220, 0.15, 'square', 0.2, 110); }

  // A continuous two-tone siren while the player is wanted.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOn) {
      this.sirenOn = true;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 750;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.55;
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.connect(g); g.connect(this.master);
      osc.start(); lfo.start();
      this.sirenOsc = osc; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOn) {
      this.sirenOn = false;
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null; this.sirenGain = null;
    }
  }

  // Engine hum: one sawtooth whose pitch follows road speed.
  engine(level, handbrake) {
    if (!this.ctx) return;
    if (level <= 0.02 && !this.engineOsc) return;
    if (!this.engineOsc) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      g.gain.value = 0;
      osc.connect(filter); filter.connect(g); g.connect(this.master);
      osc.start();
      this.engineOsc = osc; this.engineGain = g;
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + level * 190 + (handbrake ? 40 : 0), t, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.03 + level * 0.075, t, 0.1);
  }

  // A 16-step chiptune loop in A minor: square bass, square lead, hats as noise.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 0, 110, 0, 130.8, 0, 110, 0, 98, 0, 98, 0, 146.8, 0, 164.8, 0];
    const lead = [440, 0, 523, 659, 0, 587, 523, 0, 440, 0, 523, 587, 659, 0, 587, 523];
    const stepDur = 60 / 116 / 2; // 116 BPM, eighth notes
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted) { this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05); return; }
      while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
        const i = this.musicStep % 16;
        const t = this.nextNoteTime;
        if (bass[i]) this._noteAt(bass[i], t, stepDur * 0.95, 'square', 0.055);
        if (lead[i]) this._noteAt(lead[i], t, stepDur * 0.9, 'square', 0.045);
        if (i % 2 === 0) this._noiseAt(t, 0.03, 0.02, 6000, 'highpass');
        this.nextNoteTime += stepDur;
        this.musicStep++;
      }
    }, 40);
  }

  _noteAt(freq, t, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noiseAt(t, dur, vol, freq, type) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
}
