export function rand(min, max) { return Math.random() * (max - min) + min; }
export function randi(min, max) { return Math.floor(rand(min, max + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}
export function pickWeighted(items, weightFn) {
  const total = items.reduce((s, it) => s + Math.max(0, weightFn(it)), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
