// The world's pictures stay in the world: no "save image" or "copy image" on a long press or a right click, no
// dragging a picture out, no selecting the page. Typing fields still take a long press (paste, select).

const TYPING = 'input, textarea, [contenteditable="true"], [contenteditable=""]';

function typing(t: EventTarget | null): boolean {
  return !!(t as Element | null)?.closest?.(TYPING);
}

export function guardPictures(doc: Pick<Document, 'addEventListener'> = document): void {
  doc.addEventListener('contextmenu', (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
  doc.addEventListener('dragstart', (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
  doc.addEventListener('selectstart', (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
  doc.addEventListener('copy', (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
}
