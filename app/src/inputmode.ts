// Which controls to show: the touch stick and the big action button on a phone or a tablet, the keyboard and the
// mouse on a computer (no stick on the screen there; the action shows as a small hint with its key). Follows what
// the player actually uses: a touch brings the touch controls back, keys or a mouse take them away again.

export type InputMode = 'touch' | 'pc';

/** The mode to start in: a device with a fine pointer and no touch screen is a computer. */
export function initialMode(env: { maxTouchPoints: number; finePointer: boolean; desktopShell: boolean }): InputMode {
  if (env.desktopShell) return 'pc';
  return env.maxTouchPoints === 0 && env.finePointer ? 'pc' : 'touch';
}

export function installInputMode(root: HTMLElement): void {
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  const desktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  let mode = initialMode({ maxTouchPoints: navigator.maxTouchPoints ?? 0, finePointer: fine, desktopShell: desktop });
  let lastTouch = 0;
  const set = (m: InputMode) => {
    mode = m;
    root.classList.toggle('pc', m === 'pc');
  };
  set(mode);
  window.addEventListener('touchstart', () => {
    lastTouch = Date.now();
    if (mode !== 'touch') set('touch');
  }, { passive: true, capture: true });
  const toPc = () => {
    // a mouse moving right after a touch is the browser's echo of the touch, not a mouse
    if (mode !== 'pc' && Date.now() - lastTouch > 800) set('pc');
  };
  window.addEventListener('keydown', toPc, { capture: true });
  window.addEventListener('mousemove', (e) => {
    if ((e as MouseEvent).movementX !== 0 || (e as MouseEvent).movementY !== 0) toPc();
  }, { passive: true });
}
