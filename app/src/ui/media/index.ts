// Music, the TV, the radio and the record player, the computer: what the hero does with the things that play, gathered
// here so the game only asks what a thing offers and hands over what was chosen.

import type { HoldName } from '../../character';
import type { Mood } from '../../musicplayer';
import type { Command, CommandResult, PieceView, PlacementView } from '../../types';
import { perform, scoreOf, SCORES } from './arrange';
import { Audience } from './audience';
import { Desktop, type WikiEntry } from './desktop';
import { InstrumentSheet } from './instrument';
import { KITS, kitOfItem, type KitId } from './kits';
import { nextStation, onAir, RecordSheet, RECORDS, type StationId } from './radio';
import { Sampler, type AudioOut } from './sampler';
import { TvSheet, type TvFeed } from './tv';
import { t } from '../../i18n';

export interface MediaHost {
  run(cmd: Command): CommandResult;
  repertoire(): PieceView[];
  musicLevel(): number;
  owned(item: string): number;
  /** Things owned that are portable instruments. */
  portable(): string[];
  audio(): AudioOut | null;
  duck(on: boolean): void;
  toast(text: string, icon?: string, ms?: number): void;
  location(): string;
  outdoors(): boolean;
  /** The world minute (and the month 1..12). */
  minute(): number;
  month(): number;
  weekend(): boolean;
  /** Game seconds (for the audience). */
  time(): number;
  hero(): { x: number; y: number };
  people(): { id: string; x: number; y: number }[];
  placements(): PlacementView[];
  itemName(id: string): string;
  tvFeed(): Omit<TvFeed, 'minute' | 'weekend' | 'concert'>;
  wiki(): WikiEntry[];
  weather(): { now: string; next: string };
  today(): string;
  /** Walk to a seat near `pid` (a TV) and sit, then `then` (or straight `then` when there is none). */
  sitNear(pid: number, then: () => void): void;
  printPicture(pid: number): void;
  games(): void;
  /** «Мапи». */
  maps(): void;
}

/** The record players and radios of the world. */
const RECORD_PLAYERS = /^(record_player|gramophone)$/;
const RADIOS = /^(radio|radio_vintage)$/;
const SCREENS = /^(tv|wall_tv)$/;

export class Media {
  readonly instrument: InstrumentSheet;
  readonly tv: TvSheet;
  readonly records: RecordSheet;
  readonly desktop: Desktop;
  readonly audience = new Audience();
  private hold: HoldName | null = null;
  private holdSince = 0;
  private busking: string | null = null;
  private tvSampler: Sampler | null = null;
  private lastOnAir = '';
  private pcPid = 0;

  constructor(root: HTMLElement, private readonly host: MediaHost) {
    this.instrument = new InstrumentSheet(root);
    this.tv = new TvSheet(root);
    this.records = new RecordSheet(root);
    this.desktop = new Desktop(root, {
      paint: () => this.host.printPicture(this.pcPid),
      games: () => this.host.games(),
      maps: () => this.host.maps(),
      wiki: () => this.host.wiki(),
      weather: () => this.host.weather(),
      audio: () => this.host.audio(),
      today: () => this.host.today(),
      minute: () => this.host.minute(),
    });
  }

  /** The sheets this opens (closed by Escape and the back button). */
  sheets(): { isOpen(): boolean; close(): void }[] {
    return [this.instrument, this.tv, this.records, this.desktop];
  }

  /** What a thing at home offers besides its own actions. */
  optionsFor(item: string, tags: string[], home: boolean): string[] {
    if (!home) return [];
    const out: string[] = [];
    if (SCREENS.test(item)) out.push('watch');
    if (RECORD_PLAYERS.test(item)) out.push('records');
    if (RADIOS.test(item)) out.push('stations');
    if (item === 'computer') out.push('pc');
    if (tags.includes('instrument')) out.push('play');
    return out;
  }

  label(option: string): { icon: string; label: string } | null {
    switch (option) {
      case 'watch':
        return { icon: 'sit', label: t('media.index.watchTv') };
      case 'records':
        return { icon: 'listen', label: t('media.index.playRecord') };
      case 'stations':
        return { icon: 'listen', label: t('media.index.changeStation') };
      case 'pc':
        return { icon: 'power', label: t('media.index.computerOn') };
      case 'play':
        return { icon: 'play_music', label: t('media.index.play') };
      default:
        return null;
    }
  }

  /** Does what was chosen, if it is the media's to do. */
  use(pid: number, item: string, action: string): boolean {
    if (action === 'play') {
      this.playAt(pid, item);
      return true;
    }
    if (action === 'watch') {
      this.host.sitNear(pid, () => this.watch(pid));
      return true;
    }
    if (action === 'records') {
      const p = this.host.placements().find((q) => q.pid === pid);
      const have = RECORDS.map((r) => r.id).filter((id) => this.host.owned(id) > 0);
      this.records.openRecords(have, p?.props?.record ?? '', (id) => {
        if (id) this.host.run({ type: 'set_prop', pid, key: 'record', value: id });
        else this.host.run({ type: 'set_prop', pid, key: 'record', value: '' });
        this.host.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
        const title = RECORDS.find((r) => r.id === id)?.title;
        this.host.toast(title ? t('media.index.needle', { title }) : t('media.index.oldRecord'), 'listen', 2800);
      });
      return true;
    }
    if (action === 'stations') {
      const p = this.host.placements().find((q) => q.pid === pid);
      const on = (p?.props?.station as StationId | undefined) ?? 'fm';
      this.records.openRadio(on, this.host.minute() % 1440, this.host.month(), (id) => {
        this.host.run({ type: 'set_prop', pid, key: 'station', value: id });
        this.host.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
      });
      return true;
    }
    if (action === 'pc') {
      this.pcPid = pid;
      this.host.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
      this.desktop.open();
      return true;
    }
    return false;
  }

  private watch(pid: number): void {
    this.host.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
    const feed = this.host.tvFeed();
    this.tv.open({
      ...feed,
      minute: () => this.host.minute() % 1440,
      weekend: this.host.weekend(),
      concert: (on) => {
        this.tvSampler?.stop();
        this.host.duck(on);
        if (!on) return null;
        const out = this.host.audio();
        const pool = SCORES.filter((s) => s.level >= 1);
        const score = pool[Math.floor(this.host.minute() / 30) % pool.length];
        if (!out || !score) return score?.name ?? null;
        this.tvSampler = new Sampler(out, KITS.piano);
        const sampler = this.tvSampler;
        void sampler.ready().then(() => sampler.play(perform(score, KITS.piano, 3), () => {}, () => {}));
        return `«${score.name}» (${score.by})`;
      },
    }, () => {
      this.tvSampler?.stop();
      this.host.duck(false);
    });
  }

  /** At an instrument at home (or in a public room). */
  private playAt(pid: number, item: string): void {
    const kit = kitOfItem(item) ?? 'piano';
    this.open(kit, this.host.itemName(item), false, (r) => {
      if (r.piece) this.host.run({ type: 'play', pid, piece: r.piece });
      else if (r.notes >= 6) this.host.run({ type: 'play', pid });
    });
  }

  /** Whether the hero can play in the street here (out of the house, with an instrument to carry). */
  canBusk(): boolean {
    return this.host.location() !== 'home' && this.host.outdoors() && this.host.portable().length > 0;
  }

  /** Takes an instrument out in the street. */
  busk(): void {
    const all = this.host.portable();
    if (all.length === 0) return;
    const pick = all.includes(this.busking ?? '') ? (this.busking as string) : all[0];
    this.busking = pick;
    const kit = kitOfItem(pick) ?? 'guitar';
    this.open(kit, this.host.itemName(pick), true, () => {}, (piece) => {
      const r = this.host.run({ type: 'busk', piece, instrument: pick });
      const ev = r.ok ? r.events.find((e) => e.kind.type === 'Busked') : undefined;
      this.audience.end(this.host.time());
      if (!ev) return;
      const listeners = Number(ev.kind.listeners ?? 0);
      const coins = Number(ev.kind.coins ?? 0);
      const said =
        listeners === 0
          ? t('media.index.noOne')
          : coins > 0
            ? t('media.index.coinsIn', { who: listeners === 1 ? t('media.index.oneListened') : t('media.index.manyListened', { n: listeners }), coins: `${coins} ${t('media.index.coinWord', { n: coins })}` })
            : listeners === 1 ? t('media.index.oneClaps') : t('media.index.manyClap');
      this.host.toast(said, 'play_music', 3600);
    }, all.length > 1 ? all : undefined);
  }

  private open(kit: KitId, title: string, street: boolean, done: (r: { notes: number; piece?: string }) => void, onPiece?: (piece: string) => void, choose?: string[]): void {
    const hold = KITS[kit].pose as HoldName;
    this.instrument.open({
      choices: choose?.map((id) => ({ id, name: this.host.itemName(id) })),
      chosen: this.busking ?? undefined,
      onChoose: (id) => {
        this.busking = id;
        this.instrument.close();
        this.busk();
      },
      kit,
      title,
      pieces: this.host.repertoire(),
      skill: this.host.musicLevel(),
      audio: this.host.audio(),
      street,
      onPose: (on) => {
        this.hold = on ? hold : null;
        this.holdSince = this.host.time();
        this.host.duck(on);
        if (street && on && this.audience.size() === 0) {
          const h = this.host.hero();
          this.audience.start(h.x, h.y, this.host.people(), 3 + this.host.musicLevel());
        }
      },
      onPiece,
      done: (r) => {
        this.hold = null;
        this.host.duck(false);
        if (street && !r.piece) this.audience.cancel();
        done(r);
      },
    });
  }

  /** The hero's pose while playing (and the frame of the hands). */
  heroHold(): HoldName | null {
    return this.hold;
  }

  holdFrame(now: number): number {
    return Math.floor((now - this.holdSince) * 5) % 4;
  }

  /** What a thing switched on in the room plays now: a record, a station. */
  playing(placements: PlacementView[]): Mood | undefined {
    const on = placements.filter((p) => p.props?.lit === '1');
    const player = on.find((p) => RECORD_PLAYERS.test(p.item));
    if (player?.props?.record && RECORDS.some((r) => r.id === player.props?.record)) return `rec/${player.props.record}`;
    if (player) return 'vinyl';
    const radio = on.find((p) => RADIOS.test(p.item));
    if (radio) {
      const air = onAir((radio.props?.station as StationId | undefined) ?? 'fm', this.host.minute() % 1440, this.host.month());
      const key = `${air.station}|${air.title}`;
      if (key !== this.lastOnAir) {
        if (this.lastOnAir) this.host.toast(`📻 ${air.name}: ${air.title}`, 'listen', 3200);
        this.lastOnAir = key;
      }
      return air.track;
    }
    if (on.some((p) => p.item === 'music_box')) return 'musicbox';
    return undefined;
  }

  /** The station a radio is tuned to (the presenter talks only on «Липове FM»). */
  station(placements: PlacementView[]): StationId | null {
    const radio = placements.find((p) => RADIOS.test(p.item) && p.props?.lit === '1');
    return radio ? ((radio.props?.station as StationId | undefined) ?? 'fm') : null;
  }

  /** A street musician's piece, played near the hero when tapped. */
  serenade(kit: KitId = 'violin'): string | null {
    const out = this.host.audio();
    const pool = SCORES.filter((s) => s.level <= 2);
    const score = pool[Math.floor(this.host.minute() / 7) % pool.length];
    if (!score) return null;
    if (out) {
      const s = new Sampler(out, KITS[kit]);
      void s.ready().then(() => s.play(perform(score, KITS[kit], 3), () => {}, () => {}));
    }
    return score.name;
  }
}

export { nextStation, scoreOf };
