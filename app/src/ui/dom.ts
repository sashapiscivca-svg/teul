// Tiny DOM helper so the interface code stays readable without a framework.

type Kid = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> | null,
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'html') el.innerHTML = String(value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value as object);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * A mouse wheel turned over a row that scrolls only sideways (the things to set out at the bottom of the room, a
 * strip of photos, a row of choices) moves that row: a wheel only ever goes up and down, and a row has nowhere to
 * go but along. Installed once, for the whole page.
 */
export function wheelScrollsSideways(root: Document = document): void {
  root.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      for (let el = e.target as HTMLElement | null; el && el !== root.body; el = el.parentElement) {
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        const ox = getComputedStyle(el).overflowX;
        if (ox !== 'auto' && ox !== 'scroll') continue;
        // a box that also scrolls up and down keeps the wheel for that
        if (el.scrollHeight > el.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) return;
        const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY;
        const before = el.scrollLeft;
        el.scrollLeft += step;
        if (el.scrollLeft !== before) e.preventDefault();
        return;
      }
    },
    { passive: false },
  );
}
