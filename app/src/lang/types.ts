// The shape of the word tables: every key has its Ukrainian and its English words side by side.
// `{name}` marks a hole filled by `t(key, { name })`; words with `|` are plural forms picked by `{n}`
// (Ukrainian: one|few|many, English: one|other).
export type Entry = readonly [uk: string, en: string];
export type Table = Readonly<Record<string, Entry>>;
