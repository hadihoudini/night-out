(function () {
  'use strict';

  const W = 256;
  const H = 144;
  const FEET = 124; // y where characters stand
  const S = 2; // sprite scale
  const $ = (s) => document.querySelector(s);
  const canvas = $('#screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const PX = '"Press Start 2P", monospace';

  /* =========================================================
     SOUND: chiptune music and effects made live with Web Audio
     ========================================================= */
  const Sound = (function () {
    let ac = null;
    let master;
    let music;
    let sfx;
    let noiseBuf;
    let lowpass;
    let muted = false;
    let track = null;
    let step = 0;
    let nextTime = 0;
    let timer = null;
    const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

    function init() {
      if (ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
      music = ac.createGain();
      music.gain.value = 0.85;
      lowpass = ac.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 20000;
      music.connect(lowpass);
      lowpass.connect(master);
      sfx = ac.createGain();
      sfx.gain.value = 0.5;
      sfx.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }

    function tone(freq, t, dur, type, vol, dest, slideTo) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g);
      g.connect(dest || sfx);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    function noise(t, dur, vol, hp, dest) {
      const s = ac.createBufferSource();
      s.buffer = noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(dest || sfx);
      s.start(t);
      s.stop(t + dur + 0.02);
    }

    /* ---- Composed, adaptive music ----
       Each track has 4 chords (one bar each), a bass rhythm, a melody built from chord tones,
       an arpeggio and drum patterns. `intensity` (0..1) adds layers and drive as danger rises;
       `woozy` slows and detunes everything. A real audio file in music/<track>.mp3|ogg|wav
       replaces the synth for that track. */
    const _ = null;
    const TRACKS = {
      flat: { bpm: 110, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], pad: 'triangle', lead: 'square',
        bass: [0, _, _, _, _, _, 0, _, 0, _, _, _, _, _, 7, _], motif: [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0], contour: [2, 1, 0, 1, 2, 3, 2, 1],
        kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', hatHi: 'x.x.x.x.x.x.xxx.', arpAt: 0.5, swing: 0 },
      bar: { bpm: 90, chords: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]], pad: 'triangle', lead: 'triangle',
        bass: [0, _, _, 0, _, _, _, _, 0, _, 7, _, _, _, 5, _], motif: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0], contour: [3, 2, 1, 2, 0, 1, 2, 3],
        kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hatHi: 'xxx.xxx.xxx.xxx.', arpAt: 0.45, swing: 0.18 },
      club: { bpm: 124, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pad: 'sawtooth', lead: 'square',
        bass: [_, _, 0, _, _, _, 0, _, _, _, 0, _, _, _, 0, 12], motif: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1], contour: [0, 2, 1, 3, 2, 1, 0, 2],
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', hatHi: 'x.xxx.xxx.xxx.xx', arpAt: 0, swing: 0 },
      tense: { bpm: 128, chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [51, 54, 57]], pad: 'sawtooth', lead: 'sawtooth',
        bass: [0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 0, _, 1, _], motif: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0], contour: [0, 1, 0, 2, 1, 0, 1, 2],
        kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', hatHi: 'xxxxxxxxxxxxxxxx', arpAt: 0.35, swing: 0 },
      street: { bpm: 74, chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], pad: 'triangle', lead: 'sine',
        bass: [0, _, _, _, _, _, _, _, 0, _, _, _, _, _, _, _], motif: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], contour: [2, 1, 3, 2, 0, 1, 2, 1],
        kick: '................', snare: '................', hat: '....x.......x...', hatHi: '..x...x...x...x.', arpAt: 0.55, swing: 0 },
      end: { bpm: 118, chords: [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]], pad: 'triangle', lead: 'square',
        bass: [0, _, 0, _, 7, _, 0, _, 0, _, 0, _, 7, _, 12, _], motif: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0], contour: [0, 1, 2, 3, 2, 1, 2, 3],
        kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', hatHi: 'x.x.x.x.x.x.x.x.', arpAt: 0.2, swing: 0 },
    };
    let intensity = 0;
    let woozy = false;
    let melodyIdx = 0;
    let wanted = null;
    let fileAudio = null;
    const FILES = {};
    const FILE_VOL = 0.75;

    function voice(freq, t, dur, type, vol, cutoff) {
      const o = ac.createOscillator();
      const f = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (woozy) {
        o.detune.setValueAtTime((Math.random() - 0.5) * 60, t);
        o.detune.linearRampToValueAtTime((Math.random() - 0.5) * 100, t + dur);
      }
      f.type = 'lowpass';
      f.frequency.value = cutoff || 4000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(f);
      f.connect(g);
      g.connect(music);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function kick(t) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.75, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      g.connect(music);
      o.start(t);
      o.stop(t + 0.2);
      noise(t, 0.012, 0.18, 3000, music); // click so the kick is audible on laptop speakers
    }

    function playStep(t) {
      const tr = TRACKS[track];
      const bpm = tr.bpm * (woozy ? 0.82 : 1) * (1 + intensity * 0.06);
      const len = 60 / bpm / 4;
      const s = step % 16;
      const chord = tr.chords[Math.floor(step / 16) % 4];
      const at = t + (s % 2 ? tr.swing * len : 0);
      if (s === 0) chord.forEach((n) => voice(mtof(n), t, len * 16, tr.pad, 0.045, tr.pad === 'sawtooth' ? 1200 + intensity * 2000 : 2500));
      const b = tr.bass[s];
      if (b !== null) {
        voice(mtof(chord[0] - 12 + b), at, len * 1.7, 'triangle', 0.4, 1200);
        voice(mtof(chord[0] + b), at, len * 1.1, 'square', 0.05, 900); // upper layer for small speakers
      }
      if (tr.motif[s]) {
        const idx = tr.contour[melodyIdx++ % tr.contour.length];
        const n = chord[idx % chord.length] + 12 * (1 + Math.floor(idx / chord.length));
        voice(mtof(n), at, len * (tr.lead === 'sine' ? 6 : 1.8), tr.lead, tr.lead === 'sawtooth' ? 0.07 : 0.11, 3200);
      }
      if (intensity >= tr.arpAt) voice(mtof(chord[s % chord.length] + 24), at, len * 0.9, 'square', 0.03 + intensity * 0.03, 2600);
      const hi = intensity > 0.6;
      if (tr.kick[s] === 'x' || (hi && s % 4 === 0 && tr.kick.includes('x'))) kick(at);
      if (tr.snare[s] === 'x') noise(at, 0.12, 0.22, 1800, music);
      if ((hi ? tr.hatHi : tr.hat)[s] === 'x') noise(at, 0.035, 0.06 + intensity * 0.04, 7500, music);
      step = (step + 1) % 64;
      return len;
    }

    function scheduler() {
      if (!track) return;
      while (nextTime < ac.currentTime + 0.12) nextTime += playStep(nextTime);
    }

    // Look for a real track file; resolves to an <audio> element or null.
    function probe(name) {
      if (FILES[name]) return FILES[name];
      FILES[name] = new Promise((resolve) => {
        const tryExt = (exts) => {
          if (!exts.length) return resolve(null);
          const a = new Audio();
          a.preload = 'auto';
          a.loop = true;
          const off = () => { a.removeEventListener('canplaythrough', ok); a.removeEventListener('error', bad); };
          const ok = () => { off(); resolve(a); };
          const bad = () => { off(); tryExt(exts.slice(1)); };
          a.addEventListener('canplaythrough', ok);
          a.addEventListener('error', bad);
          a.src = `music/${name}.${exts[0]}`;
        };
        tryExt(['mp3', 'ogg', 'wav']);
      });
      return FILES[name];
    }

    function fadeAudio(a, to, ms, done) {
      const from = a.volume;
      const t0 = performance.now();
      const iv = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        a.volume = Math.max(0, Math.min(1, from + (to - from) * p));
        if (p >= 1) {
          clearInterval(iv);
          if (done) done();
        }
      }, 30);
    }

    return {
      unlock() {
        init();
        if (ac && ac.state === 'suspended') ac.resume();
        Object.keys(TRACKS).forEach(probe);
      },
      async play(name) {
        if (!ac || wanted === name) return;
        wanted = name;
        if (fileAudio) {
          const old = fileAudio;
          fadeAudio(old, 0, 800, () => old.pause());
          fileAudio = null;
        }
        // Start the built-in music straight away; switch to a real track only if one exists
        track = name;
        step = 0;
        melodyIdx = 0;
        nextTime = ac.currentTime + 0.05;
        if (!timer) timer = setInterval(scheduler, 25);
        const file = await probe(name);
        if (wanted !== name || !file) return;
        {
          track = null;
          fileAudio = file;
          file.currentTime = 0;
          file.volume = 0;
          file.preservesPitch = false;
          file.playbackRate = woozy ? 0.85 : 1;
          file.play().catch(() => {});
          fadeAudio(file, muted ? 0 : FILE_VOL, 900);
        }
      },
      stop() {
        wanted = null;
        track = null;
        if (fileAudio) {
          const old = fileAudio;
          fadeAudio(old, 0, 600, () => old.pause());
          fileAudio = null;
        }
      },
      setIntensity(v) {
        intensity = Math.max(0, Math.min(1, v));
      },
      isMuted() {
        return muted;
      },
      muffle(on) {
        woozy = on;
        if (lowpass) lowpass.frequency.setTargetAtTime(on ? 420 : 20000, ac.currentTime, 0.4);
        if (fileAudio) {
          fileAudio.playbackRate = on ? 0.85 : 1;
          fadeAudio(fileAudio, muted ? 0 : on ? FILE_VOL * 0.45 : FILE_VOL, 600);
        }
      },
      toggle() {
        muted = !muted;
        if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02);
        if (fileAudio) fileAudio.volume = muted ? 0 : woozy ? FILE_VOL * 0.45 : FILE_VOL;
        return muted;
      },
      fx(name) {
        if (!ac) return;
        const t = ac.currentTime + 0.01;
        if (name === 'blip') tone(880 + Math.random() * 120, t, 0.03, 'square', 0.04);
        if (name === 'select') { tone(660, t, 0.06, 'square', 0.12); tone(990, t + 0.06, 0.08, 'square', 0.12); }
        if (name === 'good') [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), t + i * 0.07, 0.16, 'square', 0.12));
        if (name === 'risky') { tone(mtof(67), t, 0.14, 'square', 0.12); tone(mtof(66), t + 0.14, 0.2, 'square', 0.12); }
        if (name === 'bad') [64, 60, 55, 48].forEach((n, i) => tone(mtof(n), t + i * 0.09, 0.2, 'sawtooth', 0.1));
        if (name === 'buzz') for (let i = 0; i < 3; i++) tone(110, t + i * 0.22, 0.15, 'sawtooth', 0.15);
        if (name === 'steps') for (let i = 0; i < 4; i++) noise(t + i * 0.32, 0.07, 0.35, 300);
        if (name === 'car') tone(70, t, 0.9, 'sawtooth', 0.12, sfx, 45);
        if (name === 'heart') { tone(70, t, 0.12, 'sine', 0.6, sfx, 45); tone(62, t + 0.16, 0.14, 'sine', 0.5, sfx, 40); }
        if (name === 'step') noise(t, 0.06, 0.45, 250);
        if (name === 'ring') for (let i = 0; i < 2; i++) { tone(440, t + i * 0.5, 0.35, 'sine', 0.12); tone(480, t + i * 0.5, 0.35, 'sine', 0.12); }
        if (name === 'tap') tone(1400, t, 0.03, 'square', 0.08);
        if (name === 'siren') for (let i = 0; i < 4; i++) { tone(700, t + i * 0.4, 0.2, 'square', 0.07); tone(950, t + i * 0.4 + 0.2, 0.2, 'square', 0.07); }
      },
    };
  })();

  /* =========================================================
     PIXEL ART: characters
     ========================================================= */
  const LONG = [
    '....HHHHHH....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HHSSSSSSHH..',
    '..HSSSSSSSSH..',
    '..HSESSSSESH..',
    '..HSSSSSSSSH..',
    '..HSSSMMSSSH..',
    '..HHSSSSSSHH..',
    '..HH.SSSS.HH..',
    '..HHTTTTTTHH..',
    '.HTTTTTTTTTTH.',
    '.TTTTTTTTTTTT.',
    '.STTTTTTTTTTS.',
    '.S.TTTTTTTT.S.',
    '...PPPPPPPP...',
    '..PPPPPPPPPP..',
    '...SS....SS...',
    '...SS....SS...',
    '...SS....SS...',
    '...SS....SS...',
    '...SS....SS...',
    '..BBB....BBB..',
    '..BBB....BBB..',
  ];
  const SHORT = [
    '....HHHHHH....',
    '...HHHHHHHH...',
    '..HHHHHHHHHH..',
    '..HSSSSSSSSH..',
    '...SSSSSSSS...',
    '...SESSSSES...',
    '...SSSSSSSS...',
    '...SSSMMSSS...',
    '....SSSSSS....',
    '.....SSSS.....',
    '....TTTTTT....',
    '..TTTTTTTTTT..',
    '.TTTTTTTTTTTT.',
    '.TTTTTTTTTTTT.',
    '.STTTTTTTTTTS.',
    '.S.TTTTTTTT.S.',
    '...PPPPPPPP...',
    '...PPPPPPPP...',
    '...PPP..PPP...',
    '...PPP..PPP...',
    '...PP....PP...',
    '...PP....PP...',
    '..BBB....BBB..',
    '..BBB....BBB..',
  ];
  const CAST = {
    you: { grid: LONG, H: '#3b2219', S: '#c68642', T: '#e0457b', P: '#2b2d42', B: '#151515', E: '#1a1a1a', M: '#7a2e2e' },
    jess: { grid: LONG, H: '#f2c14e', S: '#f1c27d', T: '#3fa7d6', P: '#1d1d2b', B: '#151515', E: '#1a1a1a', M: '#a8433a' },
    dean: { grid: SHORT, H: '#2a2a2a', S: '#e0ac69', T: '#8a8f98', P: '#30343f', B: '#111', E: '#111', M: '#6e3b2b' },
    staff: { grid: LONG, H: '#b5442c', S: '#8d5524', T: '#141414', P: '#141414', B: '#111', E: '#111', M: '#5a2020' },
    security: { grid: SHORT, H: '#111', S: '#5c3a21', T: '#0d0d0d', P: '#1b1b1b', B: '#000', E: '#000', M: '#3a1a10' },
    medic: { grid: SHORT, H: '#6b4423', S: '#f1c27d', T: '#2e8b57', P: '#2e8b57', B: '#111', E: '#111', M: '#8a3b30' },
    follower: { grid: SHORT, H: '#0d0d12', S: '#4a3c36', T: '#1b1b25', P: '#15151c', B: '#000', E: '#bbb', M: '#2a1c18', alpha: 0.9 },
  };

  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawChar(c, t) {
    const def = CAST[c.id];
    if (!def) return;
    let x = c.x - 7 * S;
    let y = FEET - 24 * S;
    const mood = c.mood || 'ok';
    if (mood === 'woozy') x += Math.round(Math.sin(t * 2.6 + c.x) * 3);
    if (Math.floor(t * 1.6 + c.x * 0.13) % 2 === 0) y += 1; // breathing
    ctx.save();
    if (def.alpha) ctx.globalAlpha = def.alpha;
    const flip = c.face === 'left';
    def.grid.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const k = row[rx];
        if (k === '.') continue;
        const col = flip ? row.length - 1 - rx : rx;
        px(x + col * S, y + ry * S, S, S, def[k]);
      }
    });
    // Face details
    const fx = (gx) => x + (flip ? 13 - gx : gx) * S;
    const blink = (t + c.x * 0.37) % 3.4 < 0.13;
    if (blink) {
      [4, 9].forEach((gx) => { px(fx(gx), y + 5 * S, S, S, def.S); px(fx(gx), y + 5 * S + 1, S, 1, def.E); });
    }
    if (mood === 'happy') {
      px(fx(6), y + 7 * S, S, S, def.S); px(fx(7), y + 7 * S, S, S, def.S);
      px(fx(5), y + 7 * S, S, S, def.M); px(fx(8), y + 7 * S, S, S, def.M);
      px(fx(6), y + 8 * S, S, 1, def.M); px(fx(7), y + 8 * S, S, 1, def.M);
    }
    if (mood === 'worried') {
      px(fx(4), y + 4 * S, S, 1, def.E); px(fx(9), y + 4 * S, S, 1, def.E);
      px(fx(5), y + 4 * S - 1, S, 1, def.E); px(fx(8), y + 4 * S - 1, S, 1, def.E);
      px(fx(7), y + 7 * S, S, S, def.S);
    }
    if (mood === 'sleazy') {
      px(fx(9), y + 4 * S - 1, S * 2, 1, def.E);
      px(fx(8), y + 7 * S - 1, S, S, def.M);
    }
    if (mood === 'woozy') {
      ctx.globalAlpha = 0.35;
      px(x + 3 * S, y + 3 * S, 8 * S, 6 * S, '#7bd389');
      ctx.globalAlpha = def.alpha || 1;
      [4, 9].forEach((gx) => { px(fx(gx), y + 5 * S, S, S, def.S); px(fx(gx) - 1, y + 5 * S + 1, S + 2, 1, def.E); });
      // little dizzy stars
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + (i * Math.PI * 2) / 3;
        px(c.x + Math.cos(a) * 12, y - 4 + Math.sin(a) * 3, 2, 2, '#ffd166');
      }
    }
    if (mood === 'firm') {
      px(fx(3), y + 4 * S, S * 2, 1, def.E); px(fx(9), y + 4 * S, S * 2, 1, def.E);
    }
    ctx.restore();
  }

  /* =========================================================
     PIXEL ART: scenes (all drawn live so they can animate)
     ========================================================= */
  function seeded(n) {
    let s = n;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }
  const rnd = seeded(42);
  const STARS = Array.from({ length: 40 }, () => [rnd() * W, rnd() * 70, rnd() * 6]);
  const BUILDINGS = [];
  for (let x = 0; x < W; ) {
    const w = 22 + Math.floor(rnd() * 26);
    const h = 30 + Math.floor(rnd() * 46);
    const wins = [];
    for (let wy = 0; wy < h - 10; wy += 9) for (let wx = 4; wx < w - 6; wx += 8) if (rnd() > 0.45) wins.push([wx, wy + 6, rnd()]);
    BUILDINGS.push({ x, w, h, wins, c: rnd() > 0.5 ? '#1b1b33' : '#232245' });
    x += w + 1;
  }

  function neonText(text, x, y, size, on, col) {
    ctx.font = `${size}px ${PX}`;
    ctx.textBaseline = 'top';
    if (on) { ctx.shadowColor = col; ctx.shadowBlur = 6; }
    ctx.fillStyle = on ? col : '#3a2340';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function sky(dawn) {
    const bands = dawn ? ['#2b2d5c', '#4b3f72', '#8a5a83', '#e08e79'] : ['#070b24', '#0b1233', '#111a44', '#1a2357'];
    bands.forEach((c, i) => px(0, i * 24, W, 24, c));
  }

  const SCENES = {
    flat(t) {
      px(0, 0, W, H, '#3d2f52');
      px(0, 110, W, 2, '#2b2038');
      px(0, 112, W, 32, '#5a3e2b');
      for (let x = 0; x < W; x += 16) px(x, 112, 1, 32, '#4c3423');
      // window
      px(18, 22, 54, 50, '#2b2038');
      px(22, 26, 46, 42, '#0e1440');
      STARS.slice(0, 8).forEach(([sx, sy, ph]) => { if (Math.sin(t * 2 + ph) > -0.3) px(22 + (sx % 44), 28 + (sy % 36), 1, 1, '#fff'); });
      px(54, 32, 6, 6, '#f1faee');
      px(44, 26, 2, 42, '#2b2038');
      // poster + lamp
      px(96, 26, 30, 38, '#f4a261'); px(100, 30, 22, 14, '#e76f51'); px(100, 48, 22, 3, '#264653'); px(100, 54, 16, 3, '#264653');
      px(146, 56, 3, 54, '#2b2038'); px(140, 48, 15, 10, '#ffd166');
      ctx.globalAlpha = 0.12; px(128, 58, 40, 52, '#ffd166'); ctx.globalAlpha = 1;
      // sofa
      px(170, 80, 80, 12, '#93354f'); px(166, 90, 88, 18, '#7b2d43'); px(166, 86, 8, 22, '#93354f'); px(246, 86, 8, 22, '#93354f');
      px(170, 108, 4, 4, '#2b2038'); px(246, 108, 4, 4, '#2b2038');
      // fairy lights
      const cols = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0'];
      for (let i = 0; i < 22; i++) {
        const x = 6 + i * 12;
        const y = 10 + Math.round(Math.sin((i / 21) * Math.PI) * 6);
        px(x, y - 1, 12, 1, '#1d1530');
        px(x, y, 3, 3, cols[(i + Math.floor(t * 3)) % 4]);
      }
    },

    bar(t) {
      px(0, 0, W, H, '#2a1b3d');
      for (let x = 0; x < W; x += 24) px(x, 0, 12, 118, '#2e1e43');
      px(0, 118, W, 26, '#3b2a1f');
      for (let x = 0; x < W; x += 20) px(x, 118, 1, 26, '#2e2018');
      // lamps
      [40, 96].forEach((lx, i) => {
        px(lx, 0, 1, 14, '#111');
        const on = Math.sin(t * 9 + i * 3) > -0.95;
        px(lx - 3, 14, 7, 4, on ? '#ffd166' : '#7a6230');
        ctx.globalAlpha = on ? 0.1 : 0.03; px(lx - 20, 18, 41, 100, '#ffd166'); ctx.globalAlpha = 1;
      });
      // neon sign
      neonText('BAR', 18, 24, 16, Math.sin(t * 13) > -0.9 || Math.floor(t) % 4 !== 0, '#ff4fa3');
      // Ask for Angela poster
      px(68, 48, 50, 30, '#f7d6e0');
      px(70, 50, 46, 26, '#ffffff');
      ctx.font = `5px ${PX}`;
      ctx.fillStyle = '#b5179e';
      ctx.fillText('ASK FOR', 75, 55);
      ctx.fillText('ANGELA', 77, 64);
      // shelves + bottles
      px(146, 22, 110, 54, '#22152f');
      [46, 72].forEach((sy) => px(146, sy, 110, 3, '#5c3a21'));
      const bc = ['#7ad3a0', '#e9c46a', '#f4a261', '#a8dadc', '#e76f51', '#c77dff'];
      for (let i = 0; i < 11; i++) {
        const h = 10 + ((i * 7) % 5);
        px(150 + i * 9, 46 - h, 6, h, bc[i % bc.length]);
        px(152 + i * 9, 46 - h - 4, 2, 4, bc[i % bc.length]);
        const h2 = 9 + ((i * 3) % 6);
        px(152 + i * 9, 72 - h2, 5, h2, bc[(i + 2) % bc.length]);
      }
    },
    barFront() {
      px(140, 94, 116, 26, '#6b3e26');
      px(138, 90, 118, 5, '#8a5233');
      for (let x = 146; x < W; x += 18) px(x, 98, 2, 20, '#5a321e');
    },

    club(t) {
      px(0, 0, W, H, '#120a1f');
      // beams
      const beamCols = ['#ff006e', '#3a86ff', '#ffbe0b', '#8338ec'];
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 4; i++) {
        const ox = 40 + i * 58;
        const a = Math.sin(t * 0.9 + i * 1.7) * 0.7;
        ctx.fillStyle = beamCols[i];
        ctx.beginPath();
        ctx.moveTo(ox, 0);
        ctx.lineTo(ox + Math.sin(a) * 160 - 18, 104);
        ctx.lineTo(ox + Math.sin(a) * 160 + 18, 104);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) px(36 + i * 58, 0, 8, 5, '#333');
      // DJ booth
      px(98, 62, 60, 26, '#22223a');
      px(98, 60, 60, 3, '#3d3d63');
      for (let i = 0; i < 6; i++) px(104 + i * 9, 68, 5, 3, Math.floor(t * 8 + i) % 3 ? '#3a86ff' : '#ff006e');
      // speakers
      [[8, 50], [226, 50]].forEach(([sx, sy]) => {
        px(sx, sy, 22, 54, '#1c1c28');
        const pulse = Math.floor(t * 4) % 2;
        px(sx + 5, sy + 8, 12, 12, '#0c0c12'); px(sx + 3 - pulse, sy + 26 - pulse, 16 + pulse * 2, 16 + pulse * 2, '#0c0c12');
      });
      // dance floor
      const fc = ['#ff006e', '#8338ec', '#3a86ff', '#fb5607'];
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 16; i++) {
          const on = (i + j + Math.floor(t * 2.5)) % 4;
          px(i * 16, 104 + j * 8, 16, 8, j % 2 === i % 2 ? fc[on] : '#1a0f2e');
        }
      }
      ctx.globalAlpha = 0.25; px(0, 104, W, 40, '#000'); ctx.globalAlpha = 1;
    },

    street(t, opts) {
      opts = opts || {};
      sky(opts.dawn);
      STARS.forEach(([sx, sy, ph]) => { if (!opts.dawn && Math.sin(t * 1.5 + ph * 3) > 0) px(sx, sy, 1, 1, '#e0e6ff'); });
      px(222, 14, 12, 12, opts.dawn ? '#ffe8c2' : '#f1faee');
      if (!opts.dawn) px(226, 14, 8, 8, '#d9dee8');
      BUILDINGS.forEach((b) => {
        const top = 108 - b.h;
        px(b.x, top, b.w, b.h, b.c);
        b.wins.forEach(([wx, wy, r]) => {
          const lit = r > 0.35 && !(r > 0.9 && Math.sin(t * 5 + r * 40) > 0.6);
          px(b.x + wx, top + wy, 3, 4, lit ? '#ffd166' : '#14142a');
        });
      });
      // 24h shop
      px(168, 70, 64, 38, '#1f4d3a');
      px(172, 82, 56, 26, '#b7e4c7');
      px(198, 86, 8, 22, '#2d6a4f');
      neonText('OPEN 24H', 174, 72, 6, true, '#95d5b2');
      ctx.globalAlpha = 0.12; px(160, 100, 80, 24, '#b7e4c7'); ctx.globalAlpha = 1;
      // pavement + road
      px(0, 108, W, 16, '#4a4a58');
      for (let x = 0; x < W; x += 22) px(x, 108, 1, 16, '#3d3d4a');
      px(0, 124, W, 2, '#6c6c7a');
      px(0, 126, W, 18, '#23232b');
      for (let x = (-(t * 0) % 30); x < W; x += 30) px(x, 135, 14, 2, '#e9c46a');
      // street lamp
      px(122, 46, 3, 62, '#555a66');
      px(116, 42, 14, 5, '#555a66');
      px(118, 46, 10, 3, '#ffe9a8');
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.moveTo(118, 49); ctx.lineTo(128, 49); ctx.lineTo(150, 124); ctx.lineTo(96, 124); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      if (opts.car) drawCar(t, opts.car);
      if (opts.ambulance) drawAmbulance(t);
      if (!opts.dawn) {
        // wet pavement: puddles reflecting the shop sign and the street lamp
        ctx.globalAlpha = 0.32;
        px(176, 116, 40, 3, '#95d5b2'); px(184, 119, 22, 2, '#95d5b2');
        px(108, 117, 28, 3, '#ffe9a8'); px(114, 120, 14, 1, '#ffe9a8');
        ctx.globalAlpha = 0.12 + 0.08 * Math.sin(t * 3);
        px(176, 116, 40, 1, '#ffffff');
        // rain
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = '#9fb4e8';
        for (let i = 0; i < 70; i++) ctx.fillRect(Math.floor((i * 37.7 + t * 30) % W), Math.floor((i * 53.3 + t * 210) % 128), 1, 4);
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 6; i++) {
          const ph = (t * 2 + i * 0.37) % 1;
          if (ph < 0.25) px(((i * 71 + Math.floor(t * 2 + i * 0.37) * 29) % W) - 1, 121, 3, 1, '#cfd8f5');
        }
        ctx.globalAlpha = 1;
      }
    },
  };

  function drawCar(t, kind) {
    const enter = Math.min(1, (t - sceneStart) / 1.4);
    const x = Math.round(W + 10 - (W - 136) * (1 - Math.pow(1 - enter, 3)));
    const y = 116;
    const body = kind === 'booked' ? '#f2c14e' : '#4a4e69';
    px(x, y + 4, 92, 14, body);
    px(x + 16, y - 8, 54, 13, body);
    px(x + 20, y - 5, 22, 9, '#9fb4c7');
    px(x + 46, y - 5, 20, 9, '#9fb4c7');
    px(x + 86, y + 6, 6, 4, '#ffe9a8');
    px(x, y + 8, 4, 4, '#d00000');
    [x + 14, x + 66].forEach((wx) => { px(wx, y + 14, 14, 10, '#111'); px(wx + 4, y + 18, 6, 3, '#777'); });
    px(x + 70, y - 2, 1, 1, '#000');
    // no taxi sign, no plate light: it's an unbooked car
    px(x + 38, y + 12, 16, 4, '#ddd');
  }

  function drawAmbulance(t) {
    const x = 150;
    const y = 104;
    px(x, y, 96, 26, '#f4f4f4');
    for (let i = 0; i < 6; i++) px(x + i * 16, y + 14, 8, 6, i % 2 ? '#2a9d8f' : '#ffd166');
    px(x + 70, y + 4, 20, 9, '#9fb4c7');
    const on = Math.floor(t * 4) % 2;
    px(x + 20, y - 4, 10, 4, on ? '#3a86ff' : '#0a2a66');
    px(x + 34, y - 4, 10, 4, on ? '#0a2a66' : '#3a86ff');
    [x + 12, x + 72].forEach((wx) => px(wx, y + 22, 14, 10, '#111'));
  }

  /* =========================================================
     STORY
     ========================================================= */
  const CH = {
    pre: 'Pre-drinks',
    s1: 'Scene 1 of 4 · Unwanted attention',
    s2: 'Scene 2 of 4 · Separated',
    s3: 'Scene 3 of 4 · Spiking',
    s4: 'Scene 4 of 4 · Getting home',
  };

  // The safety framework every choice trains
  const SKILLS = { plan: 'PLAN', spot: 'SPOT', act: 'ACT', report: 'REPORT' };
  const SKILL_HINT = { plan: 'Sort it before it happens', spot: 'Notice the warning signs', act: 'Do the safe thing, fast', report: 'Tell someone who can act' };

  const STORY = {
    intro: {
      ch: CH.pre, scene: 'flat', music: 'flat',
      chars: [{ id: 'you', x: 80, mood: 'happy' }, { id: 'jess', x: 132, mood: 'happy', face: 'left' }],
      who: 'Jess', text: "First proper night out of term! Town's going to be heaving. Ready?", next: 'plan',
    },
    plan: {
      ch: CH.pre, skill: 'plan', scene: 'flat', music: 'flat',
      chars: [{ id: 'you', x: 80 }, { id: 'jess', x: 132, mood: 'happy', face: 'left' }],
      who: 'Jess', text: 'Before we go, do we want a plan for if we lose each other?',
      choices: [
        { t: 'Agree a meeting point, charge both phones and share locations', fx: { you: 5, jess: 10 }, set: 'plan', g: 'good',
          tip: 'Agreeing a meeting point and sharing locations before you leave means you both know exactly what to do if you get split up.' },
        { t: "Nah, we'll wing it", fx: { jess: -5 }, g: 'risky',
          tip: "Winging it feels fine until someone's phone dies. A two-minute plan makes it much easier to find each other later." },
      ],
      next: 'bar1',
    },
    bar1: {
      ch: CH.s1, scene: 'bar', music: 'bar',
      chars: [{ id: 'staff', x: 214, behind: true, face: 'left' }, { id: 'you', x: 58 }, { id: 'jess', x: 26 }, { id: 'dean', x: 96, mood: 'sleazy', face: 'left' }],
      who: 'Dean', text: "Hey gorgeous. Let me buy you a drink. Come on, don't be rude.", next: 'bar2',
    },
    bar2: {
      ch: CH.s1, skill: 'act', scene: 'bar', music: 'bar',
      chars: [{ id: 'staff', x: 214, behind: true, face: 'left' }, { id: 'you', x: 58, mood: 'worried' }, { id: 'jess', x: 26, mood: 'worried' }, { id: 'dean', x: 90, mood: 'sleazy', face: 'left' }],
      who: null, text: "He's been hovering round you for twenty minutes, standing far too close. He isn't taking the hint.",
      choices: [
        { t: 'Go to the bar and ask for "Angela"', fx: { you: 15 }, g: 'good', go: 'angela',
          tip: '"Ask for Angela" is a UK scheme in many bars and clubs. Ask staff for Angela and they will quietly help: moving him on, calling you a taxi or getting you back to your friends.' },
        { t: 'Say a firm "No thanks" and move away with Jess', fx: { you: 8, jess: 3 }, g: 'good',
          tip: 'Saying no clearly and moving towards your friends is a good move. If he follows you, tell staff. Dealing with that is their job.' },
        { t: 'Take the drink so he leaves you alone', fx: { you: -15 }, g: 'bad', set: 'spikedYou',
          tip: "If someone spikes a drink, that's on them, not you. If you can, stick to drinks you watched being poured and keep yours with you. Watch how the next scene feels." },
        { t: 'Fake a call from Mum to get away', fx: { you: 12, jess: 3 }, g: 'good', phone: 'escape',
          tip: 'A fake call gives you a reason to leave without an argument or a scene. Real night mode can make your own phone ring like this, for real.',
          wrong: { fx: { you: -5 }, g: 'risky', tip: "You declined your own escape call, so Dean's still there. Next time, answer it and walk away while you're \"on the phone\"." } },
      ],
      next: 'sep1',
    },
    angela: {
      ch: CH.s1, scene: 'bar', music: 'bar',
      chars: [{ id: 'staff', x: 214, behind: true, face: 'left', mood: 'happy' }, { id: 'you', x: 150, face: 'right' }, { id: 'security', x: 70, mood: 'firm' }],
      who: 'Bar staff', text: "Got it, Angela. Stay here with me. Security's having a word with him now.", next: 'sep1',
    },
    sep1: {
      ch: CH.s2, skill: 'plan', scene: 'club', music: 'club', sfx: 'buzz', visionIf: 'spikedYou',
      chars: [{ id: 'you', x: 128, mood: 'worried' }],
      who: null, text: "An hour later, on the dance floor. You turn round and Jess is gone. Your call goes straight to voicemail.",
      choices: [
        { t: 'Head to the meeting point you agreed', need: 'plan', fx: { jess: 15 }, g: 'good',
          tip: "This is why you made a plan. A fixed meeting point means you aren't both wandering the club looking for each other." },
        { t: 'Search the whole club on your own', needNot: 'plan', fx: {}, g: 'risky',
          tip: 'Searching alone is slow and you can get lost too. With no plan, the next best step is telling staff.' },
        { t: "Tell security what she's wearing and where you last saw her", fx: { jess: 12, you: 3 }, g: 'good',
          tip: "Security can check the toilets and smoking area and radio the door. Give her name, what she's wearing and when you last saw her." },
        { t: "She's probably gone for a smoke. Give it another song.", fx: { jess: -20 }, g: 'bad',
          tip: "It's easy to assume she's fine. But if a friend disappears and her phone's off, keep looking and tell staff, and don't leave until you know she's safe." },
      ],
      next: 'sep2',
    },
    sep2: {
      ch: CH.s3, scene: 'club', music: 'tense',
      chars: [{ id: 'you', x: 92, mood: 'worried' }, { id: 'jess', x: 150, mood: 'woozy', face: 'left' }],
      who: null, text: "You find Jess by the toilets. She's slurring, can barely stand, and keeps saying she's only had two drinks.",
      next: 'jessPov',
    },
    jessPov: {
      ch: CH.s3, scene: 'club', music: 'tense', vision: true,
      chars: [{ id: 'you', x: 92, mood: 'worried' }, { id: 'jess', x: 150, mood: 'woozy', face: 'left' }],
      who: 'Through Jess\'s eyes', text: "The room is spinning. Every sound is muffled. Your legs won't work and you can't think straight. You only had two drinks.",
      next: 'spike1',
    },
    spike1: {
      ch: CH.s3, skill: 'spot', scene: 'club', music: 'tense',
      chars: [{ id: 'you', x: 92, mood: 'worried' }, { id: 'jess', x: 150, mood: 'woozy', face: 'left' }],
      who: null, text: 'Jess could have been spiked. What do you do?',
      choices: [
        { t: 'Get her to staff straight away and stay with her', fx: { jess: 15 }, g: 'good',
          tip: 'Feeling far drunker than expected, confusion, being sick or struggling to stand can all be signs of spiking. Tell staff and stay with her.' },
        { t: 'Take her outside for fresh air, just you two', fx: { jess: -10 }, g: 'risky',
          tip: "Don't take a vulnerable friend somewhere quiet or isolated. Stay inside, where staff can help." },
        { t: "She's begging you not to make a fuss. Put her in a cab home on her own.", fx: { jess: -25 }, g: 'bad',
          tip: "She's embarrassed, but someone who may have been spiked shouldn't be left alone, even in a cab. Stay with her and get help." },
      ],
      next: 'spike2',
    },
    spike2: {
      ch: CH.s3, skill: 'act', scene: 'club', music: 'tense',
      chars: [{ id: 'you', x: 70, mood: 'worried' }, { id: 'jess', x: 128, mood: 'woozy' }, { id: 'security', x: 190, face: 'left', mood: 'worried' }],
      who: 'Security', text: "She's getting worse. She's confused and she's been sick.",
      choices: [
        { t: 'Call 999 and say you think she has been spiked', fx: { jess: 15 }, g: 'good', phone: 'call999',
          tip: 'If someone is very unwell, unconscious or struggling to breathe, call 999. Tell them you think she has been spiked, and stay with her.' },
        { t: 'Let her sleep it off on a sofa', fx: { jess: -15 }, g: 'bad',
          tip: "Someone who might have been spiked can get worse fast, so don't leave her to sleep it off alone." },
      ],
      next: 'spike3',
    },
    spike3: {
      ch: CH.s3, skill: 'report', scene: 'street', sceneOpts: { ambulance: true }, music: 'street', sfx: 'siren',
      chars: [{ id: 'you', x: 50, mood: 'worried' }, { id: 'jess', x: 86, mood: 'worried' }, { id: 'medic', x: 124, face: 'left' }],
      who: 'Paramedic', text: "She's going to be okay. You did the right thing. Do you want to report it?",
      choices: [
        { t: 'Yes: report it and ask about getting her tested', fx: { jess: 10, you: 5 }, g: 'good',
          tip: 'Report spiking to the police (999 in an emergency, 101 otherwise) and to the venue. Report quickly: the police can arrange a test, and some drugs leave the body within hours. A&E will treat her but may not test for spiking drugs.' },
        { t: "No point. Nobody will do anything.", fx: { jess: -5 }, g: 'risky',
          tip: 'Reports help police and venues spot patterns and catch people. You can still report spiking days later.' },
      ],
      next: 'home1',
    },
    home1: {
      ch: CH.s4, skill: 'spot', scene: 'street', sceneOpts: { car: 'unbooked' }, music: 'street', sfx: 'car',
      chars: [{ id: 'you', x: 60 }],
      who: null, text: "Jess's sister is with her at A&E. You've booked an Uber home: a silver Toyota. Then a different car pulls up: \"Taxi? Hop in, love, I'll do you a good price.\"",
      choices: [
        { t: 'Say no. Check the car against the cab you booked', fx: { you: 15 }, g: 'good', phone: 'plate',
          tip: "Spot on: the plate didn't match. Cars touting for passengers on the street aren't licensed and aren't safe. Only get in a cab you booked, or a licensed taxi from a rank, and check the plate and driver first.",
          wrong: { fx: { you: -20 }, g: 'bad', set: 'unbooked', tip: "Look again: the plate on that car (KT07 ZPL) didn't match your booking (BD21 XKM). Always check the plate, the car and the driver's photo before you get in." } },
        { t: 'Ask him, "Who are you here for?"', fx: { you: 8 }, g: 'good',
          tip: 'Good instinct: make the driver say your name rather than giving it away. Then check the plate matches your booking before you get in.' },
        { t: "Your Uber's 25 minutes away and this car's right here. Get in.", fx: { you: -25 }, g: 'bad', set: 'unbooked',
          tip: "In an unbooked car, nobody knows who is driving you or where you're going. That's the biggest risk to avoid on a night out." },
      ],
      next: 'home2',
    },
    home2: {
      ch: CH.s4, skill: 'act', scene: 'street', music: 'tense', sfx: 'steps', timer: 12,
      chars: [{ id: 'follower', x: 30, approach: 70 }, { id: 'you', x: 150, mood: 'worried', face: 'left' }],
      who: null, text: "The car drops you at the end of your road. Footsteps. A man has been behind you since the corner, and he's getting closer. Decide fast.",
      choices: [
        { t: 'Go into the 24-hour shop and call someone', fx: { you: 15 }, g: 'good',
          tip: 'Head for somewhere busy and well lit, like a shop, petrol station or takeaway. Call a friend, or 999 if you feel in danger.' },
        { t: 'Share your live location with a friend and stay on the phone', fx: { you: 10 }, g: 'good', phone: 'share',
          tip: 'Sharing your location and staying on a call means someone knows exactly where you are. Keep heading for busy streets while you talk.' },
        { t: 'Run straight home with your keys out', fx: { you: -10 }, g: 'risky', timeout: true,
          tip: 'Leading someone to your door shows them where you live. Get somewhere public and safe first.' },
      ],
      next: 'end',
    },
  };

  /* =========================================================
     GAME STATE + FLOW
     ========================================================= */
  const game = { node: null, you: 50, jess: 50, flags: {}, log: [], typing: null };
  let current = { scene: 'street', opts: { }, chars: [], music: 'street' };
  let sceneStart = 0;
  let fade = 0;
  let fadeTarget = 0;
  let pendingNode = null;
  let shakeUntil = 0;
  let flash = { c: '#000', a: 0 };
  const confetti = [];
  let vision = 0; // 0 = clear, 1 = fully woozy
  let visionTarget = 0;
  const buffer = document.createElement('canvas');
  buffer.width = W;
  buffer.height = H;
  const bctx = buffer.getContext('2d');

  const clamp = (v) => Math.max(0, Math.min(100, v));

  // Vibrate on phones that support it (Android); silently does nothing elsewhere
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  }

  function speak(text) {
    try {
      const s = window.speechSynthesis;
      if (!s || Sound.isMuted()) return;
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = s.getVoices();
      const v = voices.find((x) => /en-GB/i.test(x.lang) && /female|libby|sonia|kate|serena|hazel|susan/i.test(x.name)) || voices.find((x) => /en-GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 1.02;
      u.pitch = 1.05;
      s.speak(u);
    } catch (e) { /* speech not available */ }
  }

  function setVision(on) {
    visionTarget = on ? 1 : 0;
    document.body.classList.toggle('woozy', on);
    Sound.muffle(on);
  }

  // Music intensity follows the danger: the less safe either of you is, the more it drives.
  function updateMusic(extra) {
    const node = STORY[game.node] || {};
    const base = node.music === 'tense' ? 0.45 : node.music === 'club' ? 0.3 : 0.15;
    const danger = (100 - Math.min(game.you, game.jess)) / 100;
    Sound.setIntensity(Math.max(base, danger * 0.9) + (extra || 0));
  }

  function stopTimer() {
    clearInterval(game.timerId);
    game.timerId = null;
    $('#timer').hidden = true;
  }

  // Countdown with a speeding-up heartbeat. Running out picks the panic option.
  function startTimer(node, list) {
    const bar = $('#timer');
    const fill = bar.firstElementChild;
    bar.hidden = false;
    const total = node.timer * 1000;
    const t0 = performance.now();
    let nextBeat = 0;
    game.timerId = setInterval(() => {
      const el = performance.now() - t0;
      const p = Math.min(1, el / total);
      game.timerP = p;
      fill.style.width = 100 - p * 100 + '%';
      Sound.setIntensity(0.65 + p * 0.35);
      if (el >= nextBeat) {
        Sound.fx('heart');
        Sound.fx('step');
        buzz(40); // heartbeat you can feel on a phone
        nextBeat = el + 900 - p * 560;
      }
      if (p >= 1) {
        stopTimer();
        choose(node, list.find((x) => x.timeout) || list[list.length - 1], true);
      }
    }, 50);
  }

  /* ---------- In-game phone ---------- */
  const Phone = {
    open(kind) {
      return new Promise((resolve) => {
        const ph = $('#phone');
        const sc = $('#phoneScreen');
        ph.classList.remove('out');
        ph.hidden = false;
        Sound.fx('buzz');
        const done = (v) => {
          Sound.fx('tap');
          ph.classList.add('out');
          setTimeout(() => {
            ph.hidden = true;
            resolve(v);
          }, 360);
        };
        const btn = (label, cls, fn) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ph-btn ' + (cls || '');
          b.textContent = label;
          b.addEventListener('click', fn);
          return b;
        };
        const focusFirst = () => { const f = sc.querySelector('button, input'); if (f) f.focus({ preventScroll: true }); };
        sc.innerHTML = '';

        if (kind === 'call999') {
          sc.innerHTML = '<p class="ph-top">EMERGENCY CALL</p><p class="ph-big">999</p><p class="ph-small">Slide all the way to call</p>';
          const r = document.createElement('input');
          r.type = 'range';
          r.min = 0;
          r.max = 100;
          r.value = 0;
          r.className = 'ph-slide';
          r.setAttribute('aria-label', 'Slide to call 999');
          sc.append(r);
          r.addEventListener('input', () => {
            if (+r.value < 95 || r.disabled) return;
            r.disabled = true;
            sc.innerHTML = '<p class="ph-top">CALLING</p><p class="ph-big">999</p><p class="ph-small ph-pulse">Ringing…</p>';
            Sound.fx('ring');
            setTimeout(() => {
              sc.innerHTML = '<p class="ph-top">CONNECTED</p><p class="ph-msg">"Ambulance service. Is she breathing? Stay with her and keep her on her side. Help is on the way."</p>';
              sc.append(btn('Stay on the line', 'go', () => done('ok')));
              focusFirst();
            }, 1400);
          });
          // Snap back only when a finger or mouse lets go early; keyboard arrows can step all the way
          ['pointerup', 'touchend'].forEach((ev) => r.addEventListener(ev, () => { if (!r.disabled && +r.value < 95) r.value = 0; }));
        }

        if (kind === 'plate') {
          sc.innerHTML =
            '<p class="ph-top">YOUR BOOKING</p>' +
            '<div class="ph-card"><b>Amir</b> · silver Toyota<br><span class="plate">BD21 XKM</span></div>' +
            '<p class="ph-small">The car outside:</p>' +
            '<div class="ph-card dark">Dark grey hatchback<br><span class="plate">KT07 ZPL</span></div>' +
            '<p class="ph-q">Does it match?</p>';
          sc.append(btn('It matches. Get in', 'bad', () => done('wrong')), btn("It doesn't match. Wait", 'go', () => done('correct')));
        }

        if (kind === 'escape') {
          const line = "Where are you? I'm outside in the car. Come out now, both of you.";
          sc.innerHTML = '<p class="ph-top">INCOMING CALL</p><div class="ph-avatar">M</div><p class="ph-big ph-name">Mum</p><p class="ph-small ph-pulse">mobile</p>';
          Sound.fx('ring');
          buzz([400, 200, 400]);
          const ringLoop = setInterval(() => { Sound.fx('ring'); buzz([400, 200, 400]); }, 1200);
          const row = document.createElement('div');
          row.className = 'ph-callrow';
          row.append(
            btn('Decline', 'bad', () => { clearInterval(ringLoop); done('declined'); }),
            btn('Answer', 'go', () => {
              clearInterval(ringLoop);
              sc.innerHTML = `<p class="ph-top">MUM · ON CALL</p><div class="ph-avatar on">M</div><p class="ph-msg">"${line}"</p>`;
              speak(line);
              sc.append(btn('Leave with Jess', 'go', () => { try { window.speechSynthesis.cancel(); } catch (e) { /* none */ } done('ok'); }));
              focusFirst();
            })
          );
          sc.append(row);
        }

        if (kind === 'share') {
          sc.innerHTML = '<p class="ph-top">SHARE LIVE LOCATION</p><div class="ph-map"><i class="pin"></i></div><p class="ph-small">Send to:</p>';
          ['Mum', "Jess's sister", 'Flat group chat'].forEach((name) =>
            sc.append(
              btn(name, '', () => {
                sc.innerHTML = `<p class="ph-top">SHARED ✓</p><p class="ph-msg">${name} can see where you are, live, for the next hour.</p><p class="ph-small ph-pulse">Calling ${name}…</p>`;
                Sound.fx('ring');
                sc.append(btn('Walk towards the busy street', 'go', () => done('ok')));
                focusFirst();
              })
            )
          );
        }
        focusFirst();
      });
    },
  };

  function setBars() {
    [['you', '#youBar'], ['jess', '#jessBar']].forEach(([k, sel]) => {
      const v = game[k];
      const el = $(sel);
      el.style.width = v + '%';
      el.style.background = v >= 65 ? 'var(--good)' : v >= 35 ? 'var(--risky)' : 'var(--bad)';
    });
  }

  function typeText(text, done) {
    const el = $('#text');
    clearInterval(game.typing);
    el.textContent = '';
    let i = 0;
    game.typingDone = () => {
      clearInterval(game.typing);
      game.typing = null;
      el.textContent = text;
      game.typingDone = null;
      done();
    };
    game.typing = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i % 3 === 0 && text[i - 1] !== ' ') Sound.fx('blip');
      if (i >= text.length && game.typingDone) game.typingDone();
    }, 22);
  }

  function goTo(id) {
    if (id === 'end') {
      showEnding();
      return;
    }
    const node = STORY[id];
    const changing = node.scene !== current.scene || JSON.stringify(node.sceneOpts || {}) !== JSON.stringify(current.opts || {});
    if (changing && game.node) {
      if (pendingNode) return; // already changing scene
      pendingNode = id;
      fadeTarget = 1;
      $('#continueBtn').hidden = true;
      setTimeout(() => {
        pendingNode = null;
        enter(id);
        fade = 1;
        fadeTarget = 0;
      }, 380);
      return;
    }
    enter(id);
  }

  function enter(id) {
    const node = STORY[id];
    game.node = id;
    if (node.scene !== current.scene || JSON.stringify(node.sceneOpts || {}) !== JSON.stringify(current.opts || {})) sceneStart = performance.now() / 1000;
    current = { scene: node.scene, opts: node.sceneOpts || {}, chars: node.chars };
    stopTimer();
    game.timerP = 0;
    setVision(!!(node.vision || (node.visionIf && game.flags[node.visionIf])));
    updateMusic();
    Sound.play(node.music);
    if (node.sfx) setTimeout(() => Sound.fx(node.sfx), 350);
    $('#chapter').textContent = node.ch;
    const sp = $('#speaker');
    sp.textContent = node.who || '';
    sp.className = 'speaker';
    $('#feedback').hidden = true;
    $('#skill').hidden = true;
    $('#choices').textContent = '';
    $('#continueBtn').hidden = true;
    typeText(node.text, () => showOptions(node));
  }

  function showOptions(node) {
    if (!node.choices) {
      $('#continueBtn').hidden = false;
      $('#continueBtn').onclick = () => { Sound.fx('select'); goTo(node.next); };
      $('#continueBtn').focus();
      return;
    }
    const list = node.choices.filter((c) => (!c.need || game.flags[c.need]) && (!c.needNot || !game.flags[c.needNot]));
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pbtn';
      b.innerHTML = `<b>${i + 1}</b>`;
      b.append(c.t);
      b.addEventListener('click', () => choose(node, c));
      $('#choices').append(b);
    });
    $('#choices').firstChild.focus();
    if (node.timer) startTimer(node, list);
    if (node.skill) {
      const pill = $('#skill');
      pill.textContent = `${SKILLS[node.skill]} · ${SKILL_HINT[node.skill]}`;
      pill.className = 'skill-pill ' + node.skill;
      pill.hidden = false;
    }
  }

  async function choose(node, c, timedOut) {
    if (game.choosing) return;
    game.choosing = true;
    stopTimer();
    Sound.fx('select');
    $('#choices').textContent = '';
    if (c.phone) {
      const outcome = await Phone.open(c.phone);
      if ((outcome === 'wrong' || outcome === 'declined') && c.wrong) c = Object.assign({}, c, c.wrong);
    }
    game.choosing = false;
    const fx = c.fx || {};
    if (fx.you) game.you = clamp(game.you + fx.you);
    if (fx.jess) game.jess = clamp(game.jess + fx.jess);
    if (c.set) game.flags[c.set] = true;
    const tip = timedOut ? "Out of time. Freezing is a normal reaction to fear, and it's not your fault. " + c.tip : c.tip;
    game.log.push({ t: timedOut ? c.t + ' (out of time)' : c.t, g: c.g, tip, skill: node.skill });
    setBars();
    updateMusic();
    setTimeout(() => Sound.fx(c.g), 120);
    const now = performance.now() / 1000;
    if (c.g === 'bad') { shakeUntil = now + 0.45; flash = { c: '#ff2a2a', a: 0.45 }; buzz([90, 50, 90]); }
    if (c.g === 'risky') flash = { c: '#ffb347', a: 0.3 };
    if (c.g === 'good') {
      flash = { c: '#3ddc84', a: 0.22 };
      const cols = ['#3ddc84', '#ffd166', '#ff4fa3', '#4cc9f0'];
      for (let i = 0; i < 40; i++) confetti.push({ x: W / 2 + (Math.random() - 0.5) * 60, y: 40, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5, c: cols[i % 4] });
    }

    const fb = $('#feedback');
    fb.className = 'feedback ' + c.g;
    const label = (node.skill ? SKILLS[node.skill] + ' · ' : '') + { good: 'GOOD CALL', risky: 'RISKY', bad: 'DANGER' }[c.g];
    fb.innerHTML = '';
    const v = document.createElement('span');
    v.className = 'verdict';
    v.textContent = label;
    fb.append(v, document.createTextNode(tip));
    const d = document.createElement('div');
    d.className = 'deltas';
    [['you', 'You'], ['jess', 'Jess']].forEach(([k, name]) => {
      if (!fx[k]) return;
      const s = document.createElement('span');
      s.className = fx[k] > 0 ? 'up' : 'down';
      s.textContent = `${fx[k] > 0 ? '+' : ''}${fx[k]} ${name}'s safety`;
      d.append(s);
    });
    if (d.childNodes.length) fb.append(d);
    fb.hidden = false;
    const next = c.go || node.next;
    $('#continueBtn').hidden = false;
    $('#continueBtn').onclick = () => { Sound.fx('select'); goTo(next); };
    $('#continueBtn').focus();
  }

  function showEnding() {
    stopTimer();
    setVision(false);
    const avg = (game.you + game.jess) / 2;
    const grades = [
      [85, 'NIGHT LEGEND', 'You both got home safe, and you knew exactly what to do at every turn. Jess owes you a fry-up.'],
      [65, 'GOOD MATE', 'You made mostly smart calls and looked out for Jess. A couple of moments could have gone better.'],
      [40, 'CLOSE CALL', 'You made it home, but some choices put you or Jess at real risk. Check the tips below and try again.'],
      [-1, 'ROUGH NIGHT', 'Tonight could have ended very differently. Knowing these moves helps. Have another go.'],
    ];
    const [, grade, blurb] = grades.find(([min]) => avg >= min);
    let headline = 'YOU MADE IT HOME';
    if (game.flags.unbooked) headline = 'YOU GOT HOME. THIS TIME.';
    else if (game.jess < 40) headline = 'YOU GOT HOME. JESS HAD IT ROUGH.';
    const skills = Object.keys(SKILLS).map((k) => {
      const ls = game.log.filter((l) => l.skill === k);
      return { k, v: ls.length ? ls.reduce((a, l) => a + { good: 1, risky: 0.5, bad: 0 }[l.g], 0) / ls.length : null };
    });
    const rated = skills.filter((s) => s.v !== null);
    const best = rated.reduce((a, b) => (b.v > a.v ? b : a), rated[0]);
    const worst = rated.reduce((a, b) => (b.v < a.v ? b : a), rated[0]);
    let skillLine = 'Keep practising all four.';
    if (best && worst && best.v !== worst.v) skillLine = `You nailed <b>${SKILLS[best.k]}</b>. Work on <b>${SKILLS[worst.k]}</b>.`;
    else if (best && best.v === 1) skillLine = 'You nailed all four skills.';
    game.result = { grade, headline, avg, skills };
    current = { scene: 'street', opts: { dawn: true }, chars: [{ id: 'you', x: 100, mood: avg >= 65 ? 'happy' : 'ok' }, { id: 'jess', x: 140, mood: game.jess >= 65 ? 'happy' : 'worried', face: 'left' }] };
    Sound.play('end');
    Sound.fx(avg >= 65 ? 'good' : 'risky');
    $('#dialog').hidden = true;
    $('#hud').hidden = true;
    const e = $('#ending');
    e.innerHTML = `
      <div class="end-head">
        <p class="tag">${headline}</p>
        <h2 class="grade">${grade}</h2>
        <p>${blurb}</p>
      </div>
      <div class="end-stats">
        <div>Your safety<b>${game.you}</b></div>
        <div>Jess's safety<b>${game.jess}</b></div>
        <div>Good calls<b>${game.log.filter((l) => l.g === 'good').length}/${game.log.length}</b></div>
      </div>
      <div class="skills">
        <h3>PLAN → SPOT → ACT → REPORT</h3>
        ${skills.map((s) => `<div class="skill ${s.k}"><span>${SKILLS[s.k]}</span><div class="sbar"><i style="width:${Math.round((s.v || 0) * 100)}%"></i></div><b>${s.v === null ? '–' : Math.round(s.v * 100) + '%'}</b></div>`).join('')}
        <p class="skill-line">${skillLine}</p>
      </div>
      <div class="end-cols">
        <div class="end-box"><h3>YOUR NIGHT</h3><ul id="endLog"></ul></div>
        <div class="end-box"><h3>REAL HELP (UK)</h3><ul>
          <li class="info">In danger? Call <b>999</b>. Not an emergency? Call <b>101</b>.</li>
          <li class="info">Can't speak on a 999 call from a mobile? Press <b>55</b> when asked. It doesn't send your location.</li>
          <li class="info">Ask bar staff for <b>"Angela"</b> if you feel unsafe.</li>
          <li class="info">Think you've been spiked? Tell staff, stay with a friend and report it to the police quickly so they can arrange a test. A&amp;E may not test for spiking drugs.</li>
          <li class="info">Sexual assault: <b>Rape Crisis 24/7 Support Line 0808 500 2222</b> (England &amp; Wales). Sexual assault referral centres (SARCs) give free care and can keep evidence while you decide whether to report.</li>
          <li class="info">Only get into a cab you booked or a licensed taxi. Check the plate first.</li>
          <li class="info">Feeling unwell but it's not an emergency? Call NHS <b>111</b>.</li>
        </ul></div>
      </div>
      <div class="end-actions">
        <a class="pbtn primary" href="real.html" id="realBtn">What to do if… guide ▶</a>
        <button type="button" class="pbtn" id="cardBtn">Save my score card</button>
        <button type="button" class="pbtn" id="againBtn">Play again</button>
      </div>
      <p class="end-note">Whatever happens on a night out, it's never the victim's fault. Spiking, harassing and following someone are crimes, and the blame is always on the person who does them.</p>
      <p class="end-real">Save the one-page guide before you go out: what to do if your drink’s spiked, you lose a friend, or someone follows you.</p>`;
    const log = e.querySelector('#endLog');
    game.log.forEach((l) => {
      const li = document.createElement('li');
      li.className = l.g;
      li.textContent = l.t;
      log.append(li);
    });
    e.hidden = false;
    e.scrollTop = 0;
    e.querySelector('#againBtn').addEventListener('click', start);
    e.querySelector('#cardBtn').addEventListener('click', saveCard);
    e.tabIndex = -1;
    e.focus(); // focus the panel, not a button, so a stray Enter can't restart the game
  }

  // A shareable pixel score card (PNG) for Instagram stories and group chats
  function saveCard() {
    const r = game.result;
    if (!r) return;
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1350;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0b0716';
    g.fillRect(0, 0, 1080, 1350);
    g.drawImage(canvas, 0, 0, W, H, 60, 60, 960, 540);
    g.strokeStyle = '#ff4fa3';
    g.lineWidth = 12;
    g.strokeRect(54, 54, 972, 552);
    g.textAlign = 'center';
    g.fillStyle = '#b9a9d6';
    g.font = `28px ${PX}`;
    g.fillText(r.headline, 540, 700);
    g.fillStyle = '#ffd166';
    g.font = `64px ${PX}`;
    g.fillText(r.grade, 540, 800);
    g.font = `30px ${PX}`;
    g.fillStyle = '#f4ecff';
    const good = game.log.filter((l) => l.g === 'good').length;
    g.fillText(`${good}/${game.log.length} GOOD CALLS`, 540, 900);
    g.fillText(`YOU ${game.you}  ·  JESS ${game.jess}`, 540, 960);
    g.font = `20px ${PX}`;
    g.fillStyle = '#3ddc84';
    g.fillText(r.skills.map((s) => `${SKILLS[s.k]} ${s.v === null ? '-' : Math.round(s.v * 100)}`).join('  ·  '), 540, 1030);
    g.fillStyle = '#ff4fa3';
    g.font = `40px ${PX}`;
    g.fillText('NIGHT OUT', 540, 1110);
    g.fillStyle = '#b9a9d6';
    g.font = `22px ${PX}`;
    g.fillText('Practise in the game. Protect on the night.', 540, 1170);
    if (location.protocol.startsWith('http')) g.fillText(location.host + location.pathname.replace(/index\.html$/, ''), 540, 1230);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'night-out-score.png';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }

  function start() {
    Sound.unlock();
    Sound.fx('select');
    Object.assign(game, { node: null, you: 50, jess: 50, flags: {}, log: [], choosing: false, timerP: 0 });
    $('#phone').hidden = true;
    setBars();
    $('#title').hidden = true;
    $('#titleNote').hidden = true;
    $('#ending').hidden = true;
    $('#hud').hidden = false;
    $('#dialog').hidden = false;
    fade = 1;
    fadeTarget = 0;
    const jump = decodeURIComponent(location.hash.slice(1));
    enter(STORY[jump] ? jump : 'intro');
  }

  /* =========================================================
     RENDER LOOP
     ========================================================= */
  function frame(ms) {
    try {
      render(ms);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(frame);
  }

  function render(ms) {
    const t = ms / 1000;
    const drawScene = SCENES[current.scene];
    ctx.save();
    if (t < shakeUntil) ctx.translate(Math.round(Math.random() * 6 - 3), Math.round(Math.random() * 4 - 2));
    drawScene(t, current.opts);
    const since = t - sceneStart;
    const walk = since >= 0 && since < 0.9 ? Math.pow(1 - since / 0.9, 2) : 0; // characters walk in on a new scene
    const chars = (current.chars || []).map((c) => {
      let x = c.x + (c.approach ? c.approach * (game.timerP || 0) : 0);
      if (walk && !c.behind) x += (c.x < W / 2 ? -80 : 80) * walk;
      return x === c.x ? c : Object.assign({}, c, { x });
    });
    chars.filter((c) => c.behind).forEach((c) => drawChar(c, t));
    if (current.scene === 'bar') SCENES.barFront(t);
    chars.filter((c) => !c.behind).forEach((c) => drawChar(c, t));
    // Spiked vision: wobble, blur, double image and a sickly tint
    vision += (visionTarget - vision) * 0.04;
    if (vision > 0.02) {
      const a = vision;
      bctx.clearRect(0, 0, W, H);
      bctx.drawImage(canvas, 0, 0);
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = `blur(${(0.6 + 0.6 * Math.sin(t * 1.9)) * a}px)`;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(Math.sin(t * 1.3) * 0.03 * a);
      const z = 1 + 0.05 * a + Math.sin(t * 0.8) * 0.015 * a;
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(buffer, 0, 0);
      ctx.globalAlpha = 0.42 * a;
      ctx.drawImage(buffer, Math.sin(t * 1.7) * 7 * a, Math.cos(t * 1.1) * 3 * a);
      ctx.restore();
      ctx.globalAlpha = 0.2 * a;
      px(0, 0, W, H, '#5b2a86');
      ctx.globalAlpha = 0.3 * a;
      px(0, 0, 18, H, '#000'); px(W - 18, 0, 18, H, '#000');
      ctx.globalAlpha = 1;
    }
    // choice feedback: coloured flash and confetti
    if (flash.a > 0.01) {
      ctx.globalAlpha = flash.a;
      px(-8, -8, W + 16, H + 16, flash.c);
      ctx.globalAlpha = 1;
      flash.a *= 0.9;
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      if (p.y > H) { confetti.splice(i, 1); continue; }
      px(p.x, p.y, 2, 2, p.c);
    }
    // vignette
    ctx.globalAlpha = 0.18;
    px(0, 0, W, 6, '#000'); px(0, H - 6, W, 6, '#000');
    ctx.globalAlpha = 1;
    // fade between scenes (the scene itself is switched by a timer in goTo)
    if (fade !== fadeTarget) {
      fade += Math.sign(fadeTarget - fade) * 0.07;
      if (Math.abs(fade - fadeTarget) < 0.07) fade = fadeTarget;
    }
    if (fade > 0) {
      ctx.globalAlpha = Math.min(1, fade);
      px(0, 0, W, H, '#000');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* =========================================================
     INPUT
     ========================================================= */
  $('#startBtn').addEventListener('click', start);
  $('#muteBtn').addEventListener('click', () => {
    Sound.unlock();
    const m = Sound.toggle();
    $('#muteBtn').textContent = m ? 'Sound: off' : 'Sound: on';
    $('#muteBtn').setAttribute('aria-pressed', String(m));
  });
  $('#dialog').addEventListener('click', (e) => {
    if (game.typingDone && !e.target.closest('button')) game.typingDone();
  });
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // a held key must not skip screens
    if (e.key === 'm' || e.key === 'M') { $('#muteBtn').click(); return; }
    if (!$('#title').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); return; }
    if (game.typingDone && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); game.typingDone(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) {
      const b = $('#choices').children[n - 1];
      if (b) b.click();
    }
  });

  current = { scene: 'street', opts: {}, chars: [{ id: 'you', x: 104, mood: 'happy' }, { id: 'jess', x: 150, mood: 'happy', face: 'left' }] };
  requestAnimationFrame(frame);
})();
