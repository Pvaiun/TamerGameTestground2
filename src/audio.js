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
  const tone = (freq, dur, kind = 'sine', vol = 0.08) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = kind; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  };
  const slide = (f1, f2, dur, kind = 'sine', vol = 0.08) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = kind;
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  };
  switch (type) {
    case 'step':    tone(140, 0.04, 'triangle', 0.05); break;
    case 'door':    tone(220, 0.10, 'square', 0.08); break;
    case 'listen':  tone(900, 0.02, 'sine', 0.04); break;
    case 'take':    slide(440, 660, 0.08, 'triangle', 0.06); break;
    case 'hide':    slide(200, 90, 0.18, 'sine', 0.06); break;
    case 'caught':  slide(110, 60, 0.6, 'sawtooth', 0.14); setTimeout(() => slide(140, 55, 0.5, 'sawtooth', 0.10), 200); break;
    case 'tick':    tone(660, 0.02, 'sine', 0.04); break;
    case 'escape':  slide(220, 880, 0.5, 'sine', 0.10); setTimeout(() => slide(440, 1320, 0.45, 'sine', 0.08), 240); break;
    case 'admit':   slide(220, 50, 0.9, 'sawtooth', 0.14); break;
    case 'select':  tone(600, 0.04, 'sine', 0.05); break;
    case 'wake':    slide(180, 80, 0.4, 'triangle', 0.08); break;
    case 'reject':  tone(140, 0.08, 'square', 0.08); break;
  }
}
