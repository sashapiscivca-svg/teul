// Stroke icons as SVG path data in a 24x24 box. Shared by the canvas hints and the DOM interface.

export const GLYPHS: Record<string, string> = {
  sit: 'M4 12V9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3 M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z M6 17v2 M18 17v2',
  read: 'M3 5h8a2 2 0 0 1 1 .3 2 2 0 0 1 1-.3h8v13h-8a2 2 0 0 0-2 1 2 2 0 0 0-2-1H3z M12 5.3V19',
  brew_tea: 'M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z M17 10h2a2 2 0 0 1 0 4h-2 M8 3c0 1 1 1 1 2 M12 3c0 1 1 1 1 2',
  water_plant: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  feed_cat: 'M3 12c3-5 9-6 14-3l4-2v10l-4-2c-5 3-11 2-14-3z',
  rest: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  listen: 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14h3v6H4z M17 14h3v6h-3z',
  play_music: 'M9 18V6l10-2v12 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  paint: 'M4 20l4-1 11-11-3-3L5 16z M14 7l3 3',
  door: 'M6 3h12v18H6z M15 12h.01',
  portal: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v8 M9.5 10.5c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.5-2.5 2-2.5.9-2.5 1.9 1 1.6 2.5 1.6 2.5-.6 2.5-1.6',
  gem: 'M7 4h10l4 5-9 11L3 9z M3 9h18 M9 4l-2 5 5 11 5-11-2-5',
  leaf: 'M5 19c0-8 5-13 14-14 0 9-5 14-14 14z M5 19l9-9',
  page: 'M7 3h8l4 4v14H7z M15 3v4h4',
  edit: 'M4 20l4-1 11-11-3-3L5 16z M14 7l3 3',
  shop: 'M6 8h12l-1 12H7z M9 8a3 3 0 0 1 6 0',
  bag: 'M5 7h14v13H5z M9 7a3 3 0 0 1 6 0',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  hammer: 'M14 4l6 6-3 3-6-6z M12 8L4 16l4 4 8-8 M7 15l2 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  power: 'M12 3v8 M6.3 6.3a8 8 0 1 0 11.4 0',
  jump: 'M12 2l-4 4h3v6h2V6h3z M12 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M5 22h14',
  crouch: 'M12 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M8 13l4-2 4 2 M9 20l2-5h3l2 5 M5 21h14',
  walk: 'M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M10 22l2-7 3 3v6 M8 11l3-4 4 2 3 3 M11 7l-1 6',
  harvest: 'M4 10h16l-2 9H6z M8 10l4-6 4 6',
  undo: 'M4 11a8 8 0 1 1 2.3 5.7 M4 4v7h7',
  redo: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  store: 'M4 8h16v12H4z M3 4h18v4H3z M10 12h4',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h3a3 3 0 0 0 3-3A9 9 0 0 0 12 3z M7.5 11h.01 M10 7.5h.01 M14.5 7.5h.01',
  check: 'M5 12l5 5L20 7',
  lock: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3',
  close: 'M6 6l12 12 M18 6L6 18',
  plus: 'M12 5v14 M5 12h14',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  sunset: 'M5 17a7 7 0 0 1 14 0 M2 20h20 M12 6v3 M4.9 10.9l2 1.6 M19.1 10.9l-2 1.6',
  menu: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  talk: 'M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12z',
};

export function iconSvg(name: string, size = 22, color = 'currentColor', fill = 'none'): string {
  const d = GLYPHS[name] ?? GLYPHS.check;
  if (typeof document !== 'undefined' && pixelIcons) {
    const box = 12 * Math.max(1, Math.round(size / 12));
    return pixelIcons(name, box, color === 'currentColor' ? 'currentColor' : color);
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
}

let pixelIcons: ((name: string, size: number, color: string) => string) | null = null;

/** Switches DOM icons to pixel art (the canvas glyphs are rasterised separately by the scene). */
export function usePixelIcons(make: (name: string, size: number, color: string) => string): void {
  pixelIcons = make;
}
