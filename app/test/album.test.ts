import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { applyFilter, openAlbum, type PhotoMeta } from '../src/album';

const meta = (n: number): PhotoMeta => ({ taken: 1_700_000_000_000 + n * 60_000, place: 'Село Липове', season: 'Autumn', day: n });

describe('the album', () => {
  it('keeps photos, newest first, with where and when they were taken', async () => {
    const album = await openAlbum('a1', new IDBFactory());
    expect(await album.list()).toEqual([]);
    const a = await album.add('data:image/png;base64,AAA', meta(1));
    const b = await album.add('data:image/png;base64,BBB', meta(2));
    const list = await album.list();
    expect(list.map((p) => p.id)).toEqual([b, a]);
    expect(list[0].place).toBe('Село Липове');
    expect(await album.image(a)).toBe('data:image/png;base64,AAA');
  });

  it('forgets a photo when asked', async () => {
    const album = await openAlbum('a2', new IDBFactory());
    const a = await album.add('data:x', meta(1));
    await album.add('data:y', meta(2));
    await album.remove(a);
    expect((await album.list()).map((p) => p.day)).toEqual([2]);
    expect(await album.image(a)).toBeNull();
  });

  it('survives reopening', async () => {
    const idb = new IDBFactory();
    const one = await openAlbum('a3', idb);
    await one.add('data:z', meta(5));
    const two = await openAlbum('a3', idb);
    expect((await two.list()).length).toBe(1);
  });
});

describe('the filters', () => {
  const px = () => new Uint8ClampedArray([200, 100, 50, 255, 10, 20, 30, 255]);

  it('black and white makes every pixel grey', () => {
    const d = px();
    applyFilter(d, 2, 1, 'bw', 1);
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[4]).toBe(d[5]);
  });

  it('warm adds red and takes away blue; plain changes nothing', () => {
    const d = px();
    applyFilter(d, 2, 1, 'warm', 1);
    expect(d[0]).toBeGreaterThanOrEqual(200);
    expect(d[2]).toBeLessThan(50);
    const p = px();
    applyFilter(p, 2, 1, 'plain', 1);
    expect([...p]).toEqual([...px()]);
  });

  it('film grain is the same for the same photo (no flicker between saves)', () => {
    const a = px();
    const b = px();
    applyFilter(a, 2, 1, 'film', 7);
    applyFilter(b, 2, 1, 'film', 7);
    expect([...a]).toEqual([...b]);
  });
});
