// The computer's little composer: sixteen steps, eight notes of a scale that never sounds wrong, one instrument;
// it loops what is written. Pure helpers for the pattern; the sheet is in desktop.ts.

/** C major pentatonic over an octave and a half, low to high. */
export const ROWS = [60, 62, 64, 67, 69, 72, 74, 76];
export const STEPS = 16;

export type Pattern = boolean[][];

export function emptyPattern(): Pattern {
  return ROWS.map(() => Array<boolean>(STEPS).fill(false));
}

/** The notes of a pattern, one loop: seconds from its start (a step is an eighth at `bpm`). */
export function patternNotes(p: Pattern, bpm: number): { t: number; key: number; len: number }[] {
  const step = 60 / bpm / 2;
  const out: { t: number; key: number; len: number }[] = [];
  for (let s = 0; s < STEPS; s++) {
    p.forEach((row, r) => {
      if (!row[s]) return;
      // a note held over the steps after it that are also on
      let len = 1;
      while (s + len < STEPS && row[s + len] && len < 4) len++;
      if (s > 0 && row[s - 1]) return;
      out.push({ t: s * step, key: ROWS[r], len: len * step });
    });
  }
  return out;
}

/** A pattern as a short text (kept between visits), and back. */
export function packPattern(p: Pattern): string {
  return p.map((row) => row.map((b) => (b ? '1' : '0')).join('')).join('.');
}

export function unpackPattern(s: string | null): Pattern {
  const rows = (s ?? '').split('.');
  if (rows.length !== ROWS.length || rows.some((r) => r.length !== STEPS || /[^01]/.test(r))) return emptyPattern();
  return rows.map((r) => [...r].map((c) => c === '1'));
}
