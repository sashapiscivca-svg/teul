import init, { Engine, initSync, public_key } from './wasm/teul_wasm.js';
import type { FeelingsView } from './feel';
import { sortKey, type StoredSnapshot } from './storage';
import type {
  CalendarDay,
  Catalog,
  CheckResult,
  Command,
  CommandResult,
  EventRecord,
  HelpView,
  FridgeView,
  RecipeView,
  BillsView,
  Integrity,
  InventoryEntry,
  LocationView,
  PaperView,
  NppView,
  FestivalView,
  QuestsView,
  GrowthView,
  TownView,
  PocketView,
  StationView,
  NpcView,
  DailyView,
  LifeView,
  RoomView,
  ShopEntry,
  WalletView,
  WorldView, DayView, SkyView, SkyStory, ScheduleView, WorkView, ShiftView, PlotView, SkillView, Painting, PieceView, HomesView, SalonView, WardrobeView, WearView, CraftsView, ToolView, TechView, DriveView, DriverStory, BuildsView, PetsView } from './types';

export interface LoadOptions {
  /** Pack texts (JSON). */
  packs: string[];
  device: number;
  seed: number;
  epochUnixSecs: number;
  /** Previously drained events, oldest first (with a snapshot: only those after it). */
  events: EventRecord[];
  /** A snapshot kept beside the log (its exact JSON) and how many events the log has up to it. */
  snapshot?: string;
  covered?: number;
  /** The whole log, for when the snapshot is refused (it does not verify against the log). */
  fullEvents?: () => Promise<EventRecord[]>;
  /** This device's chain secret (kept with the world's meta); old saves without one use 0. */
  secret?: number;
  /** The wasm bytes. In the browser leave this out and the bundler-resolved URL is fetched. */
  wasm?: BufferSource;
  /** A text overlay for the packs' words in another language (`content/base/en.json`); only text, never outcomes. */
  text?: string;
}

/** Lays the words of another language over the packs (the same fingerprint, so outcomes stay the same). */
function retext(inner: Engine, o: LoadOptions): void {
  if (!o.text) return;
  try {
    inner.retext(JSON.stringify(o.packs), o.text);
  } catch (err) {
    console.warn('teul: the words of another language did not fit the packs', err);
  }
}

let wasmReady: Promise<void> | null = null;

function ensureWasm(wasm?: BufferSource): Promise<void> {
  if (!wasmReady) {
    wasmReady = wasm
      ? Promise.resolve().then(() => {
          initSync({ module: wasm });
        })
      : init().then(() => undefined);
  }
  return wasmReady;
}

/** Typed, parsed access to the Rust engine. All game state lives on the other side of this class. */
export class GameEngine {
  /** Every event since the latest snapshot (persisted or not), so the world can be rebuilt with different content. */
  private log: EventRecord[];
  private snapshot: string | undefined;
  private covered: number | undefined;
  /**
   * Views asked again for the same minute with nothing changed (no command since) are not recomputed across the
   * wasm boundary: the street asks for the season every frame, the town once a second.
   */
  private revision = 0;
  private memo = new Map<string, unknown>();

  private cached<T>(name: string, now: number, make: () => T): T {
    const key = `${name}|${now}|${this.revision}`;
    if (this.memo.has(key)) return this.memo.get(key) as T;
    if (this.memo.size > 48) this.memo.clear();
    const value = make();
    this.memo.set(key, value);
    return value;
  }

  constructor(
    private inner: Engine,
    public catalog: Catalog,
    private readonly opts: LoadOptions,
  ) {
    this.log = [...opts.events];
    this.snapshot = opts.snapshot;
    this.covered = opts.covered;
  }

  /**
   * A snapshot the engine made since the last call (at the first command of a world day, or after many inputs),
   * for the shell to keep beside the log; null when none. The log held here then starts after it.
   */
  takeSnapshot(): StoredSnapshot | null {
    const json = this.inner.take_snapshot();
    if (!json) return null;
    const head = JSON.parse(json) as { through: [number, number, number]; covered: number };
    this.snapshot = json;
    this.covered = head.covered;
    this.log = this.log.filter((e) => {
      const k = sortKey(e);
      const t = head.through;
      return k[0] !== t[0] ? k[0] > t[0] : k[1] !== t[1] ? k[1] > t[1] : k[2] > t[2];
    });
    return { json, through: head.through, covered: head.covered };
  }

  /** Rebuilds the engine with other content packs (from the snapshot and the log after it), keeping this object. */
  reloadPacks(packs: string[]): void {
    const inner = new Engine(JSON.stringify(packs), this.opts.device, this.opts.seed, this.opts.epochUnixSecs, JSON.stringify(this.log), this.opts.secret, this.snapshot, this.covered);
    retext(inner, { ...this.opts, packs });
    this.inner.free();
    this.inner = inner;
    this.catalog = JSON.parse(inner.catalog()) as Catalog;
    this.revision++;
  }

  /** The current world minute according to the device clock. */
  nowMinutes(): number {
    return this.inner.world_minutes(Date.now());
  }

  /** How far into the current world minute the device clock is (0..1), for smooth movement. */
  minuteFraction(): number {
    const secs = Date.now() / 1000 - this.opts.epochUnixSecs;
    return secs > 0 ? (secs / 60) % 1 : 0;
  }

  minutesAt(unixMs: number): number {
    return this.inner.world_minutes(unixMs);
  }

  command(cmd: Command, now: number = this.nowMinutes()): CommandResult {
    this.revision++;
    return JSON.parse(this.inner.command(now, JSON.stringify(cmd))) as CommandResult;
  }

  /** Dry run: would this command be accepted? */
  can(cmd: Command, now: number = this.nowMinutes()): CheckResult {
    return JSON.parse(this.inner.can(now, JSON.stringify(cmd))) as CheckResult;
  }

  /** Events produced since the last call, to be persisted. */
  drain(): EventRecord[] {
    const events = JSON.parse(this.inner.drain_events()) as EventRecord[];
    this.log.push(...events);
    return events;
  }

  room(): RoomView {
    return JSON.parse(this.inner.room_view()) as RoomView;
  }

  shop(now: number = this.nowMinutes()): ShopEntry[] {
    return this.cached('shop', now, () => JSON.parse(this.inner.shop_view(now)) as ShopEntry[]);
  }

  inventory(): InventoryEntry[] {
    return JSON.parse(this.inner.inventory_view()) as InventoryEntry[];
  }

  /** The world's weather now, as JSON (clear, cloudy, rain, storm, snow, fog). */
  /** Where the taxi can go from here, with the fare to each. */
  /** Where the taxi goes from a cell at `now`, each with the price of the ride then (by demand), how soon the car
   * comes (minutes), the ride's minutes and road tiles, and why the price is what it is (empty when usual). */
  taxiDestinations(from: string, x: number, y: number, now: number = this.nowMinutes()): TaxiQuoteView[] {
    return JSON.parse(this.inner.taxi_destinations(now, from, x, y));
  }

  /** How warm the hero feels where they are (never shown as a number: the screen and the hero show it). */
  comfort(nearHeat: boolean, swumAgo: number, now: number = this.nowMinutes()): ComfortView {
    return JSON.parse(this.inner.comfort_view(now, nearHeat, swumAgo)) as ComfortView;
  }

  weatherAt(now: number = this.nowMinutes()): string {
    return this.cached('weather', now, () => this.inner.weather(now));
  }

  life(now: number = this.nowMinutes()): LifeView {
    return this.cached('life', now, () => JSON.parse(this.inner.life_view(now)) as LifeView);
  }

  /** A resident's plan for today (work, school, mass, errands, or why they are off). */
  scheduleOf(id: string, now: number = this.nowMinutes()): ScheduleView | null {
    return JSON.parse(this.inner.schedule_of(id, now)) as ScheduleView | null;
  }

  /** Today in the real year: weekday, date, holiday. */
  dayView(now: number = this.nowMinutes()): DayView {
    return JSON.parse(this.inner.day_view(now)) as DayView;
  }

  /** The sky over the town now: the rift world of the day, an eclipse, a meteor night, a comet, the visitors. */
  skyView(now: number = this.nowMinutes()): SkyView {
    return JSON.parse(this.inner.sky_view(now)) as SkyView;
  }

  /** The sky's stories for the paper of the day of `now`. */
  skyStories(now: number = this.nowMinutes()): SkyStory[] {
    return JSON.parse(this.inner.sky_stories(now)) as SkyStory[];
  }

  /** The world time (minute 0 of the day) of the next day a sky event happens, within `days`, or null. */
  skyNext(kind: string, now: number = this.nowMinutes(), days = 4000): number | null {
    return JSON.parse(this.inner.sky_next(kind, now, days)) as number | null;
  }

  /** The real date of a world time and what kind of day it is. */
  calendarDay(now: number = this.nowMinutes()): CalendarDay {
    return JSON.parse(this.inner.calendar_day(now)) as CalendarDay;
  }

  /** What happened in town between two world times (a week back from `to` at most). */
  newsBetween(from: number, to: number): LifeView['news'] {
    return JSON.parse(this.inner.news_between(from, to)) as LifeView['news'];
  }

  daily(now: number = this.nowMinutes()): DailyView {
    return this.cached('daily', now, () => JSON.parse(this.inner.daily_view(now)) as DailyView);
  }

  npcs(now: number = this.nowMinutes()): NpcView[] {
    return this.cached('npcs', now, () => JSON.parse(this.inner.npc_view(now)) as NpcView[]);
  }

  wallet(): WalletView {
    return JSON.parse(this.inner.wallet_view()) as WalletView;
  }

  world(now: number = this.nowMinutes()): WorldView {
    return this.cached('world', now, () => JSON.parse(this.inner.world_view(now)) as WorldView);
  }

  /** What the player carries, the chest at home, the keyring. */
  pocket(): PocketView {
    return JSON.parse(this.inner.pocket_view()) as PocketView;
  }

  stations(now: number = this.nowMinutes()): StationView[] {
    return this.cached('stations', now, () => JSON.parse(this.inner.stations_view(now)) as StationView[]);
  }

  helps(now: number = this.nowMinutes()): HelpView[] {
    return this.cached('helps', now, () => JSON.parse(this.inner.helps_view(now)) as HelpView[]);
  }

  /** The fridge at home (and whether it works). */
  fridge(now: number = this.nowMinutes()): FridgeView {
    return this.cached('fridge', now, () => JSON.parse(this.inner.fridge_view(now)) as FridgeView);
  }

  /** The dishes one can cook at the stove, with what is there and what is missing. */
  recipes(now: number = this.nowMinutes()): RecipeView[] {
    return this.cached('recipes', now, () => JSON.parse(this.inner.recipes_view(now)) as RecipeView[]);
  }

  /** The monthly bills and which utilities are on. */
  bills(now: number = this.nowMinutes()): BillsView {
    return this.cached('bills', now, () => JSON.parse(this.inner.bills_view(now)) as BillsView);
  }

  /** The jobs of the town and what each remembers of the player. */
  works(now: number = this.nowMinutes()): WorkView[] {
    return this.cached('works', now, () => JSON.parse(this.inner.works_view(now)) as WorkView[]);
  }

  /** The shift going on, if any. */
  shift(now: number = this.nowMinutes()): ShiftView | null {
    return this.cached('shift', now, () => JSON.parse(this.inner.shift_view(now)) as ShiftView | null);
  }

  /** How the things at home have aged. */
  wear(now: number = this.nowMinutes()): WearView[] {
    return this.cached('wear', Math.floor(now / 1440), () => JSON.parse(this.inner.wear_view(now)) as WearView[]);
  }

  /** What one knows how to make, and whether one stands at a workbench. */
  crafts(now: number = this.nowMinutes()): CraftsView {
    return this.cached('crafts', now, () => JSON.parse(this.inner.crafts_view(now)) as CraftsView);
  }

  tools(): ToolView[] {
    return this.cached('tools', 0, () => JSON.parse(this.inner.tools_view()) as ToolView[]);
  }

  /** Who of the town has a smartphone, a laptop (changes by the day). */
  tech(now: number = this.nowMinutes()): TechView {
    return this.cached('tech', Math.floor(now / 1440), () => JSON.parse(this.inner.tech_view(now)) as TechView);
  }

  /** The builders' offers and one's orders (changes by the day and with every command). */
  builds(now: number = this.nowMinutes()): BuildsView {
    return this.cached('builds', Math.floor(now / 1440), () => JSON.parse(this.inner.builds_view(now)) as BuildsView);
  }

  /** The animals one lives with, and what can be done about animals here. */
  pets(now: number = this.nowMinutes()): PetsView {
    return this.cached('pets', Math.floor(now / 1440), () => JSON.parse(this.inner.pets_view(now)) as PetsView);
  }

  /** The plots at home and what grows in them. */
  garden(now: number = this.nowMinutes()): PlotView[] {
    return this.cached('garden', now, () => JSON.parse(this.inner.garden_view(now)) as PlotView[]);
  }

  skills(): SkillView[] {
    return this.cached('skills', 0, () => JSON.parse(this.inner.skills_view()) as SkillView[]);
  }

  /** The pieces one can play and which are known. */
  repertoire(): PieceView[] {
    return this.cached('repertoire', 0, () => JSON.parse(this.inner.repertoire_view()) as PieceView[]);
  }

  /** How many would stop to listen in the street now. */
  listeners(now: number = this.nowMinutes()): number {
    return this.inner.listeners(now);
  }

  paintings(): Painting[] {
    return this.cached('paintings', 0, () => JSON.parse(this.inner.paintings_view()) as Painting[]);
  }

  /** Clothes owned and worn, the first day's, and what the shop sells right here and now. */
  wardrobe(now: number = this.nowMinutes()): WardrobeView {
    return this.cached('wardrobe', now, () => JSON.parse(this.inner.wardrobe_view(now)) as WardrobeView);
  }

  salon(now: number = this.nowMinutes()): SalonView | null {
    return this.cached('salon', now, () => JSON.parse(this.inner.salon_view(now)) as SalonView | null);
  }

  /** Homes and plots, and the address. */
  homes(now: number = this.nowMinutes()): HomesView {
    return this.cached('homes', now, () => JSON.parse(this.inner.homes_view(now)) as HomesView);
  }

  /** The morning paper of the world day of `now`. */
  /** The world's first local midnight (for telling world days as dates). */
  get epochUnixSecs(): number {
    return this.opts.epochUnixSecs;
  }

  /** The notebook of promises: what one is doing for whom, who would be glad of a hand, what was done. */
  /** The town at `now`: the day's events, projects, openings, invitations, a visitor, bonds, flags. */
  town(now: number = this.nowMinutes()): TownView {
    return this.cached('town', now, () => JSON.parse(this.inner.town_view(now)) as TownView);
  }

  /** How the town feels: moods, the ties between people, how warm they are with the player, gossip. */
  feelings(now: number = this.nowMinutes()): FeelingsView {
    return this.cached('feelings', now, () => JSON.parse(this.inner.feelings_view(now)) as FeelingsView);
  }

  /** How the town grows and wears: building sites, what changed lately, whether the ice-cream cart is out. */
  growth(now: number = this.nowMinutes()): GrowthView {
    return this.cached('growth', now, () => JSON.parse(this.inner.growth_view(now)) as GrowthView);
  }

  quests(now: number = this.nowMinutes()): QuestsView {
    return JSON.parse(this.inner.quests_view(now)) as QuestsView;
  }

  /** The road: the driving school, the car, the licence and its coupon, fines, the cell, money on the road. */
  drive(now: number = this.nowMinutes()): DriveView | null {
    return this.cached('drive', now, () => JSON.parse(this.inner.drive_view(now)) as DriveView | null);
  }

  /** What the paper of the day of `now` tells of the player on the road. */
  driverStories(now: number = this.nowMinutes()): DriverStory[] {
    return JSON.parse(this.inner.driver_stories(now)) as DriverStory[];
  }

  paper(now: number = this.nowMinutes()): PaperView {
    return this.cached('paper', now, () => JSON.parse(this.inner.paper_view(now)) as PaperView);
  }

  /** The nuclear plant beyond the fields: its story's step on the day of `now`, or null before it begins. */
  npp(now: number = this.nowMinutes()): NppView | null {
    const day = Math.floor(now / 1440) * 1440 + 720;
    return this.cached('npp', day, () => JSON.parse(this.inner.npp_view(day)) as NppView | null);
  }

  /** The town's celebration of the day of `now`: getting ready, the day itself, or the clean-up after; null. */
  festival(now: number = this.nowMinutes()): FestivalView | null {
    const day = Math.floor(now / 1440) * 1440 + 720;
    return this.cached('festival', day, () => JSON.parse(this.inner.festival_view(day)) as FestivalView | null);
  }

  /** Where the player is and which places are open (with the hint of a locked one). */
  locations(now: number = this.nowMinutes()): LocationView {
    return this.cached('locations', now, () => JSON.parse(this.inner.location_view(now)) as LocationView);
  }

  /** What opening the save found. */
  integrity(): Integrity {
    return JSON.parse(this.inner.integrity()) as Integrity;
  }
}

export async function loadEngine(opts: LoadOptions): Promise<GameEngine> {
  await ensureWasm(opts.wasm);
  const make = (o: LoadOptions) => new Engine(JSON.stringify(o.packs), o.device, o.seed, o.epochUnixSecs, JSON.stringify(o.events), o.secret, o.snapshot, o.covered);
  let inner: Engine;
  try {
    inner = make(opts);
  } catch (err) {
    // a snapshot that does not verify against the log is left aside: the whole log is opened instead
    if (!opts.snapshot || !String(err).includes('snapshot_refused')) throw err;
    const events = opts.fullEvents ? await opts.fullEvents() : opts.events;
    opts = { ...opts, events, snapshot: undefined, covered: undefined };
    inner = make(opts);
  }
  retext(inner, opts);
  const catalog = JSON.parse(inner.catalog()) as Catalog;
  return new GameEngine(inner, catalog, opts);
}

/** The public key (hex) of a world's key seed. */
export function publicKeyOf(seedHex: string): string {
  return public_key(seedHex);
}

export interface ComfortView {
  /** The air here, tenths of a degree. */
  air: number;
  /** The air out of doors. */
  out: number;
  /** -3 freezing .. 0 fine .. +3 too hot. */
  feel: number;
  wet: boolean;
  breath: boolean;
  hearth: boolean;
  sun: boolean;
  /** The lakes and ponds are frozen today. */
  ice: boolean;
}

/** A taxi stop with the price of the ride there now. */
export interface TaxiQuoteView {
  id: string;
  name: string;
  location: string;
  x: number;
  y: number;
  fare: number;
  /** Minutes until the car is there. */
  eta: number;
  /** Minutes of the ride. */
  minutes: number;
  tiles: number;
  /** Why the price is what it is now, in the world's words (empty: the usual price). */
  why: string;
  /** 1 dearer than usual, -1 cheaper, 0 usual. */
  trend: number;
  shut?: string | null;
}
