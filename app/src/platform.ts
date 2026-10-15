// Where the game runs, and what each place does differently: the phone (Capacitor, Android), the desktop
// (Tauri: Windows, Linux) and a plain browser. Files are saved and opened, secrets kept and the app closed
// through here, so the rest of the game does not ask which one it is.
//
// The desktop's side lives in desktop/src-tauri (commands `secret_get`, `secret_set`, `save_file`,
// `open_file`, `exit_app`; the web app reaches them through `window.__TAURI__.core.invoke`).

import { Capacitor } from '@capacitor/core';
import { fromB64, toB64 } from './secure/seal';

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function tauri(): Invoke | null {
  const w = globalThis as unknown as { __TAURI__?: { core?: { invoke?: Invoke } }; __TAURI_INTERNALS__?: { invoke?: Invoke } };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI_INTERNALS__?.invoke ?? null;
}

export type PlatformKind = 'android' | 'desktop' | 'web';

export function platform(): PlatformKind {
  if (tauri()) return 'desktop';
  if (Capacitor.isNativePlatform()) return 'android';
  return 'web';
}

export const isDesktop = (): boolean => platform() === 'desktop';
export const isPhone = (): boolean => platform() === 'android';
/**
 * Played with a mouse and keys rather than fingers: the desktop app, or a browser on a computer (a fine pointer that
 * hovers, and no touch screen). Then there is no joystick on the screen, no vibration, and the sheets are laid out
 * wide. `?device=mouse|touch` decides it in a test build.
 */
export function usesMouse(): boolean {
  if (import.meta.env.MODE !== 'production') {
    const forced = new URLSearchParams(globalThis.location?.search ?? '').get('device');
    if (forced === 'mouse' || forced === 'touch') return forced === 'mouse';
  }
  if (platform() === 'desktop') return true;
  if (platform() === 'android') return false;
  const mq = globalThis.matchMedia?.('(hover: hover) and (pointer: fine)');
  return !!mq?.matches && (globalThis.navigator?.maxTouchPoints ?? 0) === 0;
}

/** The whole screen or a window: the desktop app's own window, the browser's full screen. */
export async function setFullscreen(on: boolean): Promise<void> {
  const inv = tauri();
  if (inv) {
    await inv('set_fullscreen', { on }).catch(() => undefined);
    return;
  }
  const d = globalThis.document;
  if (!d) return;
  try {
    if (on && !d.fullscreenElement) await d.documentElement.requestFullscreen?.();
    else if (!on && d.fullscreenElement) await d.exitFullscreen?.();
  } catch {
    // the browser wants a click first: it stays as it is
  }
}

/** The app can close itself (the phone and the desktop; a browser tab cannot). */
export const canExit = (): boolean => platform() !== 'web';

export async function exitApp(): Promise<void> {
  const inv = tauri();
  if (inv) {
    await inv('exit_app').catch(() => window.close());
    return;
  }
  if (Capacitor.isNativePlatform()) {
    const { App } = await import('@capacitor/app');
    await App.exitApp();
  }
}

/** A secret kept by the platform (Android Keystore, the desktop's keyring); null in a plain browser. */
export async function secretGet(name: string): Promise<string | null> {
  const inv = tauri();
  if (inv) return ((await inv('secret_get', { name })) as string | null) ?? null;
  if (Capacitor.isNativePlatform()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    const v = await SecureStorage.getItem(name);
    return typeof v === 'string' ? v : null;
  }
  return null;
}

export async function secretSet(name: string, value: string): Promise<boolean> {
  const inv = tauri();
  if (inv) {
    await inv('secret_set', { name, value });
    return true;
  }
  if (Capacitor.isNativePlatform()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.setItem(name, value);
    return true;
  }
  return false;
}

/** Forgets a secret kept by the platform (nothing to do in a plain browser). */
export async function secretDelete(name: string): Promise<void> {
  const inv = tauri();
  if (inv) {
    await inv('secret_delete', { name }).catch(() => undefined);
    return;
  }
  if (Capacitor.isNativePlatform()) {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.removeItem(name).catch(() => undefined);
  }
}

/** Whether this platform keeps secrets outside the web storage. */
export const hasSecretStore = (): boolean => platform() !== 'web';

/**
 * Saves a file the player keeps: the desktop's Save dialog, the phone's share sheet (to Files, a messenger,
 * a drive), a download in a browser. False when the player cancelled.
 */
export async function saveFile(name: string, bytes: Uint8Array, mime = 'application/octet-stream', title = name): Promise<boolean> {
  // the tests read what was saved (never in a release build)
  if (import.meta.env.MODE !== 'production') (globalThis as { __teulSaved?: { name: string; bytes: Uint8Array } }).__teulSaved = { name, bytes };
  const inv = tauri();
  if (inv) return (await inv('save_file', { name, data: toB64(bytes) })) === true;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const file = await Filesystem.writeFile({ path: name, data: toB64(bytes), directory: Directory.Cache });
    try {
      await Share.share({ title, files: [file.uri], dialogTitle: title });
      return true;
    } catch {
      // closed without choosing: also keep it in the app's documents, where a file manager finds it
      await Filesystem.writeFile({ path: name, data: toB64(bytes), directory: Directory.Documents }).catch(() => undefined);
      return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/** Lets the player pick a file (the desktop's Open dialog, the phone's file picker, the browser's). */
export async function openFile(accept = '*/*'): Promise<Uint8Array | null> {
  // the tests hand over a file instead of the picker (never in a release build)
  const g = globalThis as { __teulPick?: Uint8Array };
  if (import.meta.env.MODE !== 'production' && g.__teulPick) {
    const picked = g.__teulPick;
    delete g.__teulPick;
    return picked;
  }
  const inv = tauri();
  if (inv) {
    const b64 = (await inv('open_file')) as string | null;
    return b64 ? fromB64(b64) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const done = (v: Uint8Array | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      done(f ? new Uint8Array(await f.arrayBuffer()) : null);
    });
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}
