// The wonders, gathered for the game: the rift worlds (their look, their beings, the town inside out through the
// shader), the sky (an eclipse, a meteor night, a comet, the visitors and the cow, the circle in the wheat) and the
// eerie nights out of doors. The game hands over what it knows each frame (a narrow host) and takes back figures,
// pose changes and a few words; the world's state is the core's (sky.rs), nothing here changes it.

import { motionReduced } from '../a11y';
import { lookFromSettings, type Dir, type Look } from '../character';
import { kindOf, pickScenario, SCENARIO_TEXT, spookyTheme, type Night, type Scenario } from '../horror';
import type { NpcFigure } from '../render';
import type { Catalog, LocationDef, LocationProp, SkyView } from '../types';
import type { NpcPose, Routes } from '../village';
import { BEINGS, creatureLayers, mirrorBeing, type Creature } from './creatures';
import { SkyFx } from './fx';
import { Nightmare } from './nightmare';
import { Post } from './post';
import { BEING_LINES, BEING_SPOTS, isRiftWorld, MIRROR_TOWN, WORLD_LOOK, type RiftWorld } from './worlds';
import { t } from '../i18n';

export { isRiftWorld, MIRROR_TOWN, RIFT_WORLDS, WORLD_LOOK, worldOfMonth } from './worlds';

export interface WondersHost {
  now(): number;
  location: string;
  walker: { x: number; y: number };
  routes: Routes | null;
  catalog: Catalog;
  skyView(now: number): SkyView;
  toScreen(x: number, y: number, z: number): { x: number; y: number };
  sound(kind: string, volume: number, pan: number): void;
  vibrate(pattern: number[]): void;
  toast(text: string, ms?: number): void;
  outdoors: boolean;
  horrorOn: boolean;
}


function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Wonders {
  readonly post: Post;
  readonly fx: SkyFx;
  readonly nightmare = new Nightmare();
  private sky: SkyView | null = null;
  private skyAt = -1;
  private skyFor = -1;
  private looks: Look[] | null = null;
  private meteorSound = 0;
  private ufoSound = 0;
  private gatherStart = new Map<string, number>();
  private shown = { blackout: 0 };
  /** Test-only: a sky forced over the real one (never in production). */
  forced: Partial<SkyView> | null = null;

  constructor(scene: HTMLCanvasElement) {
    this.post = new Post(scene);
    this.fx = new SkyFx(this.post.canvas);
  }

  /** The sky now (asked of the core every few seconds of play, and whenever the minute jumps). */
  skyNow(h: WondersHost): SkyView {
    const now = h.now();
    const t = performance.now();
    if (!this.sky || t - this.skyAt > 4000 || Math.abs(now - this.skyFor) > 2) {
      this.sky = h.skyView(now);
      this.skyAt = t;
      this.skyFor = now;
    }
    return this.forced ? { ...this.sky, ...this.forced } : this.sky;
  }

  // ---- the rift worlds ---------------------------------------------------------------------------------------

  /** The world the cracks lead into today (null when they are shut). */
  riftWorld(h: WondersHost): RiftWorld | null {
    const w = this.skyNow(h).rift_world;
    return isRiftWorld(w) ? w : null;
  }

  /** The beings drifting about a rift world (the winter one has the residents' own, see `mirrorLayers`). */
  beings(h: WondersHost, time: number): NpcFigure[] {
    const w = h.location;
    if (!isRiftWorld(w) || w === 'rift_winter') return [];
    const kinds = BEINGS[w];
    return BEING_SPOTS[w].map(([x, y], i) => {
      const kind = kinds[i % kinds.length];
      const drift = motionReduced() ? 0 : 1;
      const px = x + 0.5 + Math.sin(time * 0.3 + i * 1.7) * 0.9 * drift;
      const py = y + 0.5 + Math.cos(time * 0.23 + i) * 0.7 * drift;
      const dir: Dir = (['down', 'left', 'up', 'right'] as const)[(i + Math.floor(time / 5)) % 4];
      return { id: `being:${kind}:${i}`, x: px, y: py, layers: creatureLayers(kind, dir, kind === 'clockfox' || kind === 'beetle', Math.floor(time * 6) % 4) };
    });
  }

  /** On the other side of the town, a resident's day is lived by one of the beings. */
  mirrorLayers(id: string, dir: Dir, walking: boolean, frame: number) {
    return creatureLayers(mirrorBeing(idHash(id)), dir, walking, frame);
  }

  /** What a being (or a figure of the night) says when one stops by it. */
  says(id: string, day: number): string | null {
    const part = id.split(':');
    const kind = (part[1] === 'mirror' ? mirrorBeing(idHash(part[2] ?? '')) : part[1]) as Creature | undefined;
    if (id.startsWith('nm:')) return [t('wonders.nm1'), t('wonders.nm2'), t('wonders.nm3')][(day + id.length) % 3];
    const lines = kind ? BEING_LINES[kind] : undefined;
    if (!lines) return null;
    return t(lines[(day + idHash(id)) % lines.length]);
  }

  /** The look of a rift world for the location's room settings (village.ts applies it). */
  look(id: string) {
    return isRiftWorld(id) ? WORLD_LOOK[id] : null;
  }

  // ---- the sky over the town ----------------------------------------------------------------------------------

  /** The location as the sky leaves it today (the circle pressed into the wheat). */
  withSky(def: LocationDef, sky: SkyView): LocationDef {
    return withSkyMarks(def, sky);
  }

  /** How many cows of a herd are out today. */
  cows(def: LocationDef, sky: SkyView, count: number): number {
    return cowsOut(def, sky, count);
  }

  /** On an eclipse afternoon or a night of falling stars, some of the town come out to watch it together: the
   * square for the eclipse, the starry hill for the meteors and the comet. Those out walk there; some of those at
   * home come out to it. Returns the emote for those watching. */
  gather(h: WondersHost, here: LocationDef, poses: Map<string, NpcPose>, residents: { id: string; activity: string }[], minutes: number): Map<string, string> {
    const out = new Map<string, string>();
    const sky = this.skyNow(h);
    const minute = ((minutes % 1440) + 1440) % 1440;
    const ec = sky.eclipse && minute >= sky.eclipse.start - 20 && minute <= sky.eclipse.end ? sky.eclipse : null;
    const stars = (sky.meteors && sky.meteors.rate >= 2 && sky.meteors.clear && minute >= 21 * 60 + 30) || (sky.comet && sky.comet.bright > 60 && minute >= 21 * 60 && minute < 23 * 60);
    if ((!ec && !stars) || !h.routes) return out;
    const placeId = ec ? 'square' : 'hill';
    const place = here.places.find((p) => p.id === placeId) ?? here.places.find((p) => p.activity === 'chat');
    if (!place) return out;
    const cells = h.routes.strollCells(place, false);
    if (cells.length === 0) return out;
    const key = `${placeId}|${Math.floor(minutes / 1440)}`;
    let k = 0;
    for (const r of residents) {
      if (r.activity === 'sick' || r.activity === 'injured' || r.activity === 'arrested' || r.activity === 'away' || r.activity === 'work' || r.activity === 'firefight') continue;
      const hsh = idHash(r.id);
      if (hsh % 100 >= (ec ? 45 : 35)) continue;
      const spot = cells[(hsh >>> 7) % cells.length];
      const was = poses.get(r.id);
      const startKey = `${key}|${r.id}`;
      if (!this.gatherStart.has(startKey)) this.gatherStart.set(startKey, minutes);
      if (was && Math.hypot(was.x - spot[0], was.y - spot[1]) > 0.8) {
        // walking there from where they were
        const since = (minutes - (this.gatherStart.get(startKey) ?? minutes)) * 60;
        const path = h.routes.route(`gather|${Math.floor(was.x)},${Math.floor(was.y)}|${spot[0]},${spot[1]}`, [was.x, was.y], spot);
        const p = alongPath(path, since * 1.2);
        poses.set(r.id, { x: p.x, y: p.y, walking: !p.done, dx: p.dx, dy: p.dy, visible: true });
      } else poses.set(r.id, { x: spot[0], y: spot[1], walking: false, dx: 0, dy: 0, visible: true });
      out.set(r.id, ec ? 'sun' : 'heart');
      if (++k > 22) break;
    }
    if (this.gatherStart.size > 400) this.gatherStart.clear();
    return out;
  }

  // ---- the eerie nights ----------------------------------------------------------------------------------------

  /** Once a slot of an eerie night: whether a whole night begins out here (the setting is on). */
  maybeNight(h: WondersHost, night: Night, day: number, slot: number): Scenario | null {
    if (this.nightmare.active) return null;
    const theme = spookyTheme(night);
    const kind = pickScenario(theme, h.location, day, slot, h.horrorOn);
    if (!kind) return null;
    return this.begin(kind, h, day * 977 + slot) ? kind : null;
  }

  /** Starts a night (also for tests and photographs). */
  begin(kind: Scenario, h: WondersHost, seed = 1): boolean {
    if (!this.nightmare.start(kind, { walker: h.walker, routes: h.routes, looks: this.townLooks(h.catalog), sound: h.sound, vibrate: h.vibrate }, seed)) return false;
    h.toast(SCENARIO_TEXT[kind].start, 5200);
    h.sound(kind === 'chase' ? 'steps' : kind === 'mob' ? 'crowd_far' : 'drone', 0.8, 0);
    return true;
  }

  /** The night is cut short (one went in through a door, or home). */
  interrupt(h: WondersHost): void {
    if (!this.nightmare.active) return;
    const kind = this.nightmare.kind;
    this.nightmare.stop();
    if (kind === 'chase') h.toast(SCENARIO_TEXT.chase.end, 3600);
  }

  private townLooks(c: Catalog): Look[] {
    if (!this.looks) {
      this.looks = Object.values(c.residents ?? {})
        .filter((r) => r.age !== 'child')
        .slice(0, 16)
        .map((r) => lookFromSettings(Object.fromEntries(Object.entries(r.look).map(([k, v]) => [`look.${k}`, v]))));
    }
    return this.looks;
  }

  // ---- each frame --------------------------------------------------------------------------------------------

  /** The night's figures this frame, and what the night does to the picture; `caught` when it got you. */
  frame(h: WondersHost, time: number, dt: number, night: number): { figures: NpcFigure[]; caught: boolean } {
    const sky = this.skyNow(h);
    const loc = h.location;
    const kind = this.nightmare.kind;
    const n = kind ? this.nightmare.update(dt, { walker: h.walker, routes: h.routes, looks: this.townLooks(h.catalog), sound: h.sound, vibrate: h.vibrate }, time, motionReduced()) : null;
    if (kind && n?.done === 'end') h.toast(SCENARIO_TEXT[kind].end, 3600);
    this.shown.blackout = n?.blackout ?? 0;
    // the picture: the town inside out, or the night gone wrong
    const eerie = !!n || (h.horrorOn && night > 0.5 && h.outdoors && kindOf(loc) !== 'rift' && this.eerieTonight);
    this.post.render(loc === MIRROR_TOWN ? 'mirror' : eerie ? 'horror' : 'none', time, { amount: n ? 1 : 0.6, pulse: n?.pulse ?? 0.1, still: motionReduced(), filter: loc === MIRROR_TOWN ? WORLD_LOOK.rift_winter.filter : undefined });
    const out = h.outdoors && !isRiftWorld(loc);
    let ufo: { x: number; y: number; phase: number; lift: number } | null = null;
    if (sky.aliens && loc === 'farm') {
      const pasture = h.catalog.locations?.farm?.places.find((p) => p.id === 'pasture');
      const px = pasture ? pasture.x + pasture.w / 2 : 56;
      const py = pasture ? pasture.y + pasture.h / 2 : 20;
      const at = h.toScreen(px, py, 0);
      const minute = h.now() % 1440;
      const lift = sky.aliens.phase === 2 ? Math.min(1, (minute - sky.aliens.beam) / 26) : 0;
      ufo = { x: at.x, y: at.y, phase: sky.aliens.phase, lift };
      if (performance.now() - this.ufoSound > 3000) {
        this.ufoSound = performance.now();
        h.sound(sky.aliens.phase === 2 ? 'beam' : 'ufo', 0.6, 0);
      }
    }
    if (out && sky.meteors && night > 0.3 && sky.meteors.clear && performance.now() - this.meteorSound > 6000 && Math.random() < 0.02) {
      this.meteorSound = performance.now();
      h.sound('meteor', 0.3, 0);
    }
    this.fx.draw({
      t: time,
      dt,
      night,
      eclipse: out && sky.eclipse ? { now: sky.eclipse.now, cover: sky.eclipse.cover } : null,
      meteors: out && sky.meteors?.clear ? { rate: sky.meteors.rate } : null,
      comet: out && sky.comet ? { bright: sky.comet.bright } : null,
      ufo,
      horror: n ? { dark: n.dark, moon: h.outdoors, blackout: n.blackout } : eerie ? { dark: 0.1, moon: h.outdoors, blackout: 0 } : null,
      mirror: loc === MIRROR_TOWN && !this.post.supported,
      glows: (n?.figures ?? []).filter((f) => /^nm:mob:\d*[02468]$/.test(f.id)).map((f) => {
        const at = h.toScreen(f.x, f.y, 70);
        return { x: at.x, y: at.y, r: 46 };
      }),
      still: motionReduced(),
    });
    return { figures: n?.figures ?? [], caught: n?.done === 'caught' };
  }

  /** Tonight is one of the eerie nights (the game tells it once a slot). */
  eerieTonight = false;
}

/** The field as the visitors left it: the wheat pressed flat in a circle where it grows thickest. */
export function withSkyMarks(def: LocationDef, sky: SkyView): LocationDef {
  if (def.id !== 'fields' || !sky.crop_circle) return def;
  const wheat = def.props.filter((p) => p.item.startsWith('wheat'));
  if (wheat.length === 0) return def;
  const cx = Math.round(wheat.reduce((s, p) => s + p.x, 0) / wheat.length);
  const cy = Math.round(wheat.reduce((s, p) => s + p.y, 0) / wheat.length);
  const R = 5;
  const props: LocationProp[] = def.props.filter((p) => !(p.item.startsWith('wheat') && Math.hypot(p.x + 1 - cx, p.y + 1 - cy) < R + 1));
  props.push({ item: 'crop_circle', x: cx - 3, y: cy - 3 } as LocationProp);
  return { ...def, props };
}

/** One of the farm's cows is up there for a week. */
export function cowsOut(def: LocationDef, sky: SkyView, count: number): number {
  return def.id === 'farm' && sky.cow_missing ? Math.max(0, count - 1) : count;
}

function alongPath(route: [number, number][], dist: number): { x: number; y: number; dx: number; dy: number; done: boolean } {
  let left = dist;
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1];
    const [bx, by] = route[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg && seg > 0) {
      const f = left / seg;
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: bx - ax, dy: by - ay, done: false };
    }
    left -= seg;
  }
  const [x, y] = route[route.length - 1];
  return { x, y, dx: 0, dy: 0, done: true };
}

