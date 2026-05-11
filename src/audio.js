let audioCtx = null;
let muted = false;

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  return audioCtx;
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

export function sfx(type) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const tone = (freq, dur, kind = 'sine', vol = 0.10) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = kind; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  };
  const slide = (f1, f2, dur, kind = 'sine', vol = 0.10) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = kind;
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  };
  switch (type) {
    case 'draw':       tone(820, 0.04, 'triangle', 0.06); break;
    case 'play':       tone(540, 0.06, 'square', 0.10); break;
    case 'fill':       slide(360, 220, 0.10, 'sawtooth', 0.10); break;
    case 'compress':   slide(440, 660, 0.10, 'sine', 0.08); break;
    case 'condition':  slide(660, 380, 0.16, 'triangle', 0.10); break;
    case 'select':     tone(700, 0.04, 'sine', 0.06); break;
    case 'absorb':     slide(330, 770, 0.30, 'triangle', 0.12); break;
    case 'compile':    slide(440, 990, 0.20, 'sine', 0.10); setTimeout(() => slide(660, 1320, 0.18, 'sine', 0.10), 180); break;
    case 'faint':      slide(220, 60, 0.50, 'triangle', 0.12); break;
    case 'victory':    slide(440, 880, 0.18, 'sine', 0.12); setTimeout(() => slide(660, 1100, 0.22, 'sine', 0.10), 180); break;
    case 'defeat':     slide(220, 50, 0.80, 'sawtooth', 0.14); break;
    case 'end_turn':   tone(330, 0.06, 'sine', 0.06); break;
    case 'shuffle':    tone(110, 0.10, 'triangle', 0.06); break;
    case 'page':       tone(900, 0.02, 'triangle', 0.04); break;
    case 'reject':     tone(140, 0.08, 'square', 0.10); break;
  }
}
