// 音（素材なし・WebAudio）。ぬりぬりランウェイの音エンジンを土台に、曲と効果音をねこカメラマン用に書いた
// 最初のタップで Snd.init()、画面切替で Snd.setTrack('名前')、毎フレーム Snd.tick()。検証は Snd.played と Snd.level()
window.Snd = {
  ctx: null, muted: false, next: 0, step: 0, track: null, want: null, switchAt: 0, played: {},
  TEMPO: { title: 96, play: 116, win: 128, sad: 68 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.master.connect(this.an); this.an.connect(this.ctx.destination)
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.0001; this.bgm.connect(this.master)
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, len)
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      if (this.want) { const w = this.want; this.want = null; this.setTrack(w) }
    } catch (e) { this.ctx = null }
  },
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7 },
  tone(f, t0, dur, type = 'square', vol = 0.2, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  noise(t0, dur, vol, freq, type = 'highpass', dest, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02)
  },
  level() { if (!this.an) return 0; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  mark(n) { this.played[n] = (this.played[n] || 0) + 1 },
  setTrack(name) {
    if (this.want === name) return
    this.want = name; if (!this.ctx) return
    const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.25)
    this.switchAt = now + 0.27
  },
  tick() {
    if (!this.ctx) return; const c = this.ctx
    if (this.switchAt && c.currentTime >= this.switchAt) {
      this.track = this.want; this.step = 0; this.next = c.currentTime + 0.05; this.switchAt = 0
      const g = this.bgm.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0.0001, c.currentTime); g.linearRampToValueAtTime(0.26, c.currentTime + 0.35)
      if (this.track) this.mark('bgm:' + this.track)
    }
    if (!this.track || this.switchAt) return
    const spb = 60 / this.TEMPO[this.track] / 4
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05
    while (this.next < c.currentTime + 0.25) { this['p_' + this.track](this.step, this.next); this.next += spb; this.step++ }
  },
  kick(t, v = 0.5) { this.tone(140, t, 0.14, 'sine', v, this.bgm, 45) },
  rim(t, v = 0.08) { this.noise(t, 0.03, v, 2600, 'bandpass', this.bgm, 3); this.tone(1800, t, 0.02, 'square', v * 0.25, this.bgm) },
  shaker(t, v = 0.03) { this.noise(t, 0.04, v, 7000, 'highpass', this.bgm) },
  bass(n, t, dur = 0.2, vol = 0.36, type = 'triangle') { this.tone(this.mtof(n), t, dur, type, vol, this.bgm) },
  // エレピ風（サイン2つ＋ベル）
  ep(ns, t, dur = 0.5, vol = 0.04) { for (const n of ns) { this.tone(this.mtof(n), t, dur, 'sine', vol, this.bgm); this.tone(this.mtof(n) * 2, t, dur * 0.4, 'sine', vol * 0.25, this.bgm) } },
  pluck(n, t, vol = 0.07, dur = 0.16) { this.tone(this.mtof(n), t, dur, 'triangle', vol, this.bgm) },
  // タイトル: 昼下がりのボサノバ（Fmaj7 - Em7 - Dm7 - G7）
  p_title(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, ph = Math.floor(i / 64) % 2
    const root = [41, 40, 38, 43][bar], ch = [[57, 60, 64, 65], [55, 59, 62, 64], [53, 57, 60, 62], [53, 57, 59, 62]][bar]
    if (s === 0 || s === 6 || s === 8 || s === 14) this.bass(root + (s === 6 || s === 14 ? 7 : 0), t, 0.22, 0.3)
    if ([0, 3, 6, 10, 12].includes(s)) this.rim(t, 0.05)
    if (s % 2 === 0) this.shaker(t, s % 4 ? 0.025 : 0.015)
    if (s === 2 || s === 7 || s === 11) this.ep(ch, t, 0.32, 0.028)
    const mel = [[72, -1, 76, -1, 77, -1, 76, 74], [74, -1, 72, -1, 71, -1, -1, -1], [72, -1, 74, -1, 77, -1, 76, -1], [74, -1, 71, -1, 67, -1, -1, -1]]
    if (ph === 1 && s % 2 === 0) { const n = mel[bar][s / 2]; if (n > 0) this.tone(this.mtof(n), t, 0.3, 'sine', 0.05, this.bgm) }
  },
  // 撮影中: そろりそろりのピチカート（Am - F - Dm - E）
  p_play(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [45, 41, 38, 40][bar], arp = [[69, 72, 76, 72], [69, 72, 77, 72], [69, 74, 77, 74], [68, 71, 76, 71]][bar]
    if (s % 4 === 0) this.bass(root, t, 0.12, 0.34, 'triangle'); if (s % 4 === 2) this.bass(root + 12, t, 0.08, 0.18, 'triangle')
    if (s % 2 === 1) this.pluck(arp[(s >> 1) % 4], t, 0.045, 0.1)
    if (s === 4 || s === 12) this.rim(t, 0.07)
    if (s % 2 === 0) this.shaker(t, 0.018)
    if (s === 0 && bar === 3) this.tone(this.mtof(83), t, 0.08, 'sine', 0.04, this.bgm)
  },
  // 結果がいい: 跳ねる祝い（C - Am - F - G）
  p_win(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [48, 45, 41, 43][bar], ch = [[64, 67, 72], [64, 69, 72], [65, 69, 72], [62, 67, 71]][bar]
    if (s % 4 === 0) this.kick(t, 0.45); if (s === 4 || s === 12) this.rim(t, 0.1); if (s % 2) this.shaker(t, 0.03)
    if (s % 4 === 0 || s === 10) this.bass(root, t, 0.16, 0.34)
    if (s === 2 || s === 6 || s === 10 || s === 14) this.ep(ch, t, 0.18, 0.03)
    const mel = [76, 79, 84, 79, 81, 77, 79, 74]
    if (s % 8 === 0) this.tone(this.mtof(mel[(bar * 2 + s / 8) % 8]), t, 0.28, 'triangle', 0.06, this.bgm)
  },
  // 結果がいまいち: とぼとぼワルツ
  p_sad(i, t) {
    const bar = Math.floor(i / 12) % 4, s = i % 12
    const ch = [[57, 60, 64], [57, 62, 65], [56, 59, 64], [57, 60, 64]][bar], root = [33, 38, 40, 33][bar]
    if (s === 0) this.bass(root, t, 0.8, 0.3, 'sine'); if (s === 4 || s === 8) for (const n of ch) this.tone(this.mtof(n), t, 0.4, 'triangle', 0.02, this.bgm)
    const mel = [[76, 74, 72], [74, 72, 69], [71, 69, 68], [69, -1, -1]][bar]
    if (s % 4 === 0) { const n = mel[s / 4]; if (n > 0) this.tone(this.mtof(n), t, 0.5, 'sine', 0.06, this.bgm) }
  },
  // 猫の声。f0 を上げて下げ、母音っぽい帯域を通す。kind: meow / squeak（情けない）/ yawn / mrr
  cat(kind = 'meow', pitch = 1, t0) {
    if (!this.ctx) return; const c = this.ctx, t = t0 ?? c.currentTime
    const P = { meow: [520, 820, 430, 0.55, 0.22], squeak: [700, 1250, 520, 0.42, 0.24], yawn: [620, 680, 260, 1.0, 0.16], mrr: [300, 380, 320, 0.25, 0.14] }[kind]
    const o = c.createOscillator(), g = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), mix = c.createGain()
    o.type = 'sawtooth'; const d = P[3]
    o.frequency.setValueAtTime(P[0] * pitch, t); o.frequency.linearRampToValueAtTime(P[1] * pitch, t + d * 0.35); o.frequency.exponentialRampToValueAtTime(P[2] * pitch, t + d)
    if (kind === 'mrr') { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 28; lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.05) }
    f1.type = 'bandpass'; f1.Q.value = 6; f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(kind === 'yawn' ? 500 : 1100, t + d * 0.4); f1.frequency.linearRampToValueAtTime(650, t + d)
    f2.type = 'bandpass'; f2.Q.value = 8; f2.frequency.setValueAtTime(1700, t); f2.frequency.linearRampToValueAtTime(2400, t + d * 0.4); f2.frequency.linearRampToValueAtTime(1500, t + d)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(P[4], t + 0.05); g.gain.setValueAtTime(P[4], t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.gain.value = 1.4; mix.connect(g); g.connect(this.master)
    o.start(t); o.stop(t + d + 0.05)
  },
  sfx(name, v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime; this.mark(name)
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'triangle', 0.12 * v); break
      case 'shutter': this.noise(t, 0.035, 0.5, 3000, 'bandpass', null, 1); this.tone(2400, t, 0.02, 'square', 0.08); this.noise(t + 0.06, 0.05, 0.4, 1800, 'bandpass', null, 1.5); this.tone(180, t + 0.06, 0.06, 'square', 0.1, null, 90); break
      case 'wind': for (let k = 0; k < 9; k++) this.noise(t + 0.12 + k * 0.045, 0.025, 0.12, 4200, 'bandpass', null, 4); this.tone(320, t + 0.12, 0.42, 'sawtooth', 0.025, null, 380); break
      case 'empty': this.tone(1400, t, 0.02, 'square', 0.06); this.tone(700, t + 0.04, 0.03, 'square', 0.04); break
      case 'zoom': this.tone(420, t, 0.16, 'triangle', 0.06, null, v > 1 ? 760 : 300); this.noise(t, 0.14, 0.04, 2400, 'bandpass', null, 3); break
      case 'thud': this.tone(120, t, 0.25, 'sine', 0.55, null, 50); this.noise(t, 0.18, 0.25, 600, 'lowpass'); break
      case 'slip': for (let k = 0; k < 6; k++) this.tone(900 - k * 90, t + k * 0.05, 0.06, 'triangle', 0.06); this.noise(t, 0.35, 0.08, 1500, 'bandpass', null, 2); break
      case 'rustle': for (let k = 0; k < 10; k++) this.noise(t + k * 0.05 + Math.random() * 0.02, 0.05, 0.09, 1800 + Math.random() * 1500, 'bandpass', null, 1.5); break
      case 'pop': this.tone(500, t, 0.12, 'sine', 0.22, null, 1100); break
      case 'swish': this.noise(t, 0.18, 0.12, 1600, 'bandpass', null, 2); break
      case 'tick': this.tone(1200 + v * 40, t, 0.03, 'square', 0.035); break
      case 'beep': this.tone(v > 1 ? 1320 : 880, t, v > 1 ? 0.4 : 0.12, 'square', 0.07); break
      case 'stamp': this.tone(90, t, 0.4, 'sine', 0.7, null, 40); this.noise(t, 0.25, 0.4, 900, 'lowpass'); break
      case 'reveal': this.tone(660, t, 0.1, 'triangle', 0.12); this.tone(990, t + 0.07, 0.16, 'triangle', 0.1); break
      case 'cheer': this.noise(t, 2.0, 0.14, 1300, 'bandpass', null, 0.6); for (let k = 0; k < 5; k++) this.tone(this.mtof([72, 76, 79, 84, 88][k]), t + k * 0.09, 0.3, 'triangle', 0.09); break
      case 'boo': this.tone(311, t, 0.35, 'sawtooth', 0.07, null, 294); this.tone(294, t + 0.38, 0.35, 'sawtooth', 0.07, null, 277); this.tone(277, t + 0.76, 0.9, 'sawtooth', 0.08, null, 200); break
      case 'whistle': this.tone(2100, t, 0.18, 'sine', 0.12); this.tone(2100, t + 0.22, 0.45, 'sine', 0.12, null, 1900); break
    }
  },
}
