// Pixel-art pieces for the interface: 9-slice frames for panels and buttons, and pixel icons, all generated
// at start-up from a few colours so the whole interface shares the scene's pixel grid.

import { glyphBits } from '../pixel/glyph';

type Frame = { fill: string; light: string; dark: string; line: string; inset?: boolean };

/** A 12×12 frame image: 1 px outline, 1 px bevel, notched corners. Sliced 4 px from each side. */
function frameUrl(f: Frame): string {
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 12;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const edge = x === 0 || y === 0 || x === 11 || y === 11;
      const corner = (x === 0 || x === 11) && (y === 0 || y === 11);
      if (corner) continue;
      if (edge) {
        px(x, y, f.line);
        continue;
      }
      const tl = x === 1 || y === 1;
      const br = x === 10 || y === 10;
      const nearCorner = (x === 1 || x === 10) && (y === 1 || y === 10);
      if (nearCorner) px(x, y, f.line);
      else if (tl) px(x, y, f.inset ? f.dark : f.light);
      else if (br) px(x, y, f.inset ? f.light : f.dark);
      else px(x, y, f.fill);
    }
  }
  return c.toDataURL();
}

const iconCache = new Map<string, string>();

/** A pixel icon as inline SVG made of unit squares (crisp at any size, no canvas involved). */
export function pixelIconSvg(name: string, size: number, color = '#f4eedf'): string {
  let d = iconCache.get(name);
  if (d === undefined) {
    const on = glyphBits(name);
    d = '';
    for (let y = 0; y < 12; y++) {
      let x = 0;
      while (x < 12) {
        if (!on[y * 12 + x]) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < 12 && on[y * 12 + x + w]) w++;
        d += `M${x} ${y}h${w}v1h-${w}z`;
        x += w;
      }
    }
    iconCache.set(name, d);
  }
  return `<svg class="pxi" width="${size}" height="${size}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><path fill="${color}" d="${d}"/></svg>`;
}

/** Installs the frames as CSS custom properties on the document root. */
export function installPixelKit(): void {
  const root = document.documentElement.style;
  const set = (name: string, f: Frame) => root.setProperty(name, `url("${frameUrl(f)}")`);
  set('--px-panel', { fill: '#23264a', light: '#3a3f72', dark: '#16182f', line: '#0b0c18' });
  set('--px-panel-2', { fill: '#2d3160', light: '#474d8a', dark: '#1d2042', line: '#0b0c18' });
  set('--px-button', { fill: '#3a3f72', light: '#5a61a6', dark: '#262a52', line: '#0b0c18' });
  set('--px-button-down', { fill: '#2d3160', light: '#5a61a6', dark: '#1d2042', line: '#0b0c18', inset: true });
  set('--px-primary', { fill: '#f6b347', light: '#ffe0a0', dark: '#c47a22', line: '#3a1e08' });
  set('--px-teal', { fill: '#3fbfa6', light: '#8ff0dc', dark: '#22806e', line: '#0a2a24' });
  set('--px-rose', { fill: '#e2667f', light: '#ffb0c0', dark: '#9e3b52', line: '#2a0a12' });
  set('--px-input', { fill: '#14162c', light: '#2d3160', dark: '#0b0c18', line: '#0b0c18', inset: true });
  set('--px-card', { fill: '#2a2d55', light: '#41467e', dark: '#1b1d3a', line: '#0b0c18' });
  set('--px-card-on', { fill: '#3a3a5a', light: '#ffe0a0', dark: '#c47a22', line: '#3a1e08' });
  set('--px-chip', { fill: '#2d3160', light: '#474d8a', dark: '#1d2042', line: '#0b0c18' });
  set('--px-chip-on', { fill: '#5a4426', light: '#ffe0a0', dark: '#c47a22', line: '#3a1e08' });
}
