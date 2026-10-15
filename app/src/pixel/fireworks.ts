// Fireworks over the town on a celebration's night: shells rising from behind the roofs, bursting into rings of
// coloured sparks that fall and fade. Deterministic in time (each shell from its index), drawn in art pixels.

const COLORS = ['#ff5a5a', '#ffd34a', '#6ad1ff', '#b98aff', '#7dff9a', '#ffffff', '#ff9ad6'];

function rnd(i: number, k: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 2654435761) ^ Math.imul(k + 7, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Draws the shells in the air at `t` seconds over the top `h * 0.55` of a `w`×`h` picture. */
export function drawFireworks(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const period = 1.1;
  const now = Math.floor(t / period);
  for (let i = now - 3; i <= now; i++) {
    const age = t - i * period - rnd(i, 1) * 0.6;
    if (age < 0 || age > 3.2) continue;
    const x = w * (0.12 + rnd(i, 2) * 0.76);
    const top = h * (0.08 + rnd(i, 3) * 0.22);
    const color = COLORS[Math.floor(rnd(i, 4) * COLORS.length)];
    const rise = 0.9;
    if (age < rise) {
      // the shell going up, a short trail
      const y = h * 0.6 - (h * 0.6 - top) * (age / rise);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
      continue;
    }
    const k = (age - rise) / (3.2 - rise);
    const r = 4 + rnd(i, 5) * 10;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = color;
    const n = 14 + Math.floor(rnd(i, 6) * 10);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const d = r * Math.min(1, k * 3);
      ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(top + Math.sin(a) * d + k * k * 8), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
