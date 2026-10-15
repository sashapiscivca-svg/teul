// Sealing at rest: AES-256-GCM (Web Crypto) with a fresh 96-bit nonce per record and the record's place as
// associated data, so a sealed value cannot be read, changed or moved to another record without the key.
// A passphrase becomes a key through PBKDF2-SHA-256 (600 000 rounds, the OWASP 2023 floor for SHA-256).

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto is not available');
  return s;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

/** A sealed record's mark: the version of this format. */
const MARK = 's1.';

export function isSealed(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(MARK);
}

/** A data key from raw bytes (kept by the platform's secure store), usable only to seal and open. */
export function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** A new random data key that can never be read out of the browser. */
export function newDataKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as Promise<CryptoKey>;
}

export async function sealBytes(key: CryptoKey, plain: Uint8Array, aad: string): Promise<Uint8Array> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: enc.encode(aad) }, key, plain as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

/** Opens what `sealBytes` made; throws when the key is wrong or anything was changed. */
export async function openBytes(key: CryptoKey, sealed: Uint8Array, aad: string): Promise<Uint8Array> {
  if (sealed.length < 12 + 16) throw new Error('sealed record too short');
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) as BufferSource, additionalData: enc.encode(aad) }, key, sealed.subarray(12) as BufferSource);
  return new Uint8Array(plain);
}

export async function seal(key: CryptoKey, text: string, aad: string): Promise<string> {
  return MARK + toB64(await sealBytes(key, enc.encode(text), aad));
}

export async function open(key: CryptoKey, sealed: string, aad: string): Promise<string> {
  if (!isSealed(sealed)) throw new Error('not a sealed record');
  return dec.decode(await openBytes(key, fromB64(sealed.slice(MARK.length)), aad));
}

export const sealJson = (key: CryptoKey, value: unknown, aad: string): Promise<string> => seal(key, JSON.stringify(value), aad);
export const openJson = async <T>(key: CryptoKey, sealed: string, aad: string): Promise<T> => JSON.parse(await open(key, sealed, aad)) as T;

export const PBKDF2_ROUNDS = 600_000;

/** A key from the player's passphrase (and a random salt kept beside what it seals). */
export async function passKey(passphrase: string, salt: Uint8Array, rounds = PBKDF2_ROUNDS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(passphrase.normalize('NFC')) as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** gzip when the platform has it (every current browser and WebView), else the bytes as they are. */
export async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('this device cannot unpack the backup');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await subtle().digest('SHA-256', enc.encode(text) as BufferSource));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}
