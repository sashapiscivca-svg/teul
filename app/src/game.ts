// The game: wires the engine, the renderer, input, storage and the interface together.

import type { GameEngine } from './engine';
import { canExit, exitApp, isDesktop, setFullscreen, usesMouse } from './platform';
import { ALONG, DELTA, rotXY, cellKey, cellSet, dedupeKey, dividerKey, dividerSet, edgeKey, isWallEdge, SIDES, wallEdgesOfItem, type View } from './geometry';
import { footprintCells, topHeight } from './models';
import { seatMode, seatSpots as seatSpotsOf, sittingPose, type SeatMode } from './seats';
import { has, itemName, t, t as tr } from './i18n';
import { Keys } from './input';
import { clampZoom, SceneRenderer, type Frame, type Ghost, type NpcFigure, type Pick } from './render';
import { DEFAULT_LOOK, dirOf, figureLayers, lookFromSettings, shade, petFromSettings, petLayers, petLookOf, PET_NAMES, type Dir, type Look, type PetLook } from './character';
import { BuildersSheet } from './ui/builders';
import { PetsSheet } from './ui/pets';
import { newHousePet, stepHousePet, warmsAt, type HousePet } from './petlife';
import { siteProps, siteWorkers, sharedEdges, outerEdges, rectCells } from './site';
import type { Store, StoredSnapshot } from './storage';
import type { Command, CommandResult, DailyView, LifeView, ResidentDef, ResidentView, EventRecord, EngineError, InventoryEntry, ItemDef, LocationDef, Missing, PhotoHint, PaperStory, NpcView, PlaceDef, PlacementView, RoomView, WalletView, WallSide, PocketView, HelpView, StationView, WorkView, BillsView, DayView, QuestsView, HomeView, TownView, DriveView, LocationProp, BuildOffer, BuildOrderView, PetOffer, PetsView } from './types';
import { Sound, vibrate, type Mood, type Sfx } from './audio';
import { daylight } from './daylight';
import { lampOf, lightMinute } from './render/lighting';
import { loadPrefs, savePrefs, type Prefs } from './prefs';
import { applyA11y, installA11y, motionReduced } from './a11y';
import { chooseLang } from './i18n';
import { History } from './history';
import { Z_PER_CENTI } from './iso';
import { cellsAround, findPath } from './path';
import { doorwayOf, findSpot } from './rooms';
import { connected, growCells, guessKind, nameKeyFor, newWalls, sectionsOf, shrinkCells, type Section, type SectionKind } from './sections';
import { PlanSheet, kindName, type PlanView, type Quote } from './ui/plan';
import { regionsOf, viewOf, type Regions } from './regions';
import { Bubble } from './ui/bubble';
import { Hud } from './ui/hud';
import { keyName, SettingsPanel } from './ui/settings';
import { residentLayers, walkSpeed, type Traits } from './mobility';
import { heroLayers } from './people/hero';
import { gadgetLayers, gadgetOf } from './gadgets';
import { withWear } from './wear';
import { CraftSheet } from './ui/craft';
import { PhoneSheet } from './ui/phone';
import { dragonAt, paradeClock, type ParadePiece } from './parade';
import { firstName, residentIntro, residentLine, type TalkCtx } from './talk';
import { ExitScreen, lookSettings as heroSettings, randomLook as randomHero } from './ui/screens';
import { PocketSheet, type Recipient } from './ui/pocket';
import { buyPrice, sellBackPrice } from './pocket';
import { AlbumSheet, PhotoBar, capture } from './ui/photo';
import { openAlbum, type Album, type PhotoFilter } from './album';
import { awayNote } from './away';
import { townTopics } from './topics';
import { PaperPhotos, type PhotoScene } from './paperphoto';
import { standNear } from './festive';
import { festiveKinds, festiveProps, festiveStage, fireworksAt, homeDecorations, type FestiveKind, type FestiveStage } from './festive';
import { eveningOf, pickEvent, spookyTheme, type HorrorEvent } from './horror';
import { PaperSheet, type AwayIssues } from './ui/paper';
import { isRiftWorld, MIRROR_TOWN, Wonders, WORLD_LOOK, type WondersHost } from './wonders';
import { AskDialog } from './ui/ask';
import { WardrobeSheet, learnGarments } from './ui/wardrobe';
import { SalonSheet } from './ui/salon';
import { rainWay, dressForWeather } from './dressing';
import { FeelLayer } from './ui/feel';
import { HEAT, heroFx, nearHeat, remark, walkFactor } from './warmth';
import type { ComfortView } from './engine';
import { ProjectsSheet } from './ui/projects';
import { JournalSheet } from './ui/journal';
import { hudLine } from './notebook';
import { BillsSheet, CookSheet, FridgeSheet, billsBlock } from './ui/home';
import { LIVING, PLANS, placeItem, placeOnWall, roomFrame, type RoomPlan } from './homeplan';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ShopSheet } from './ui/shop';
import { Studio, type PaintTarget, type ShapeTool, type StudioMode } from './ui/studio';
import { Toasts } from './ui/toast';
import { Workshop } from './workshop/builder';
import { itemDefOf, newId, packOf, type UserItem } from './workshop/voxels';
import { canStand, gridOf, nearestInteractable, settle, WALK_SPEED, stepWalker, type Target, type Walker } from './world';
import { stepAside, vehicleAt } from './traffic';
import { stepPet, type Pet } from './pet';
import { DialogueBox, GiftPicker, PeoplePanel, type DialogueChoice, type PersonEntry } from './ui/people';
import { Arcade } from './ui/arcade';
import { WorkshopSheet } from './ui/workshop';
import { TaxiSheet } from './ui/taxi';
import { MapsSheet } from './ui/maps';
import { iconSvg } from './icons';
import type { TaxiQuoteView } from './engine';
import { WorkSheet } from './ui/work';
import { StallSheet, type StallRow } from './ui/stall';
import { Media } from './ui/media';
import { ART_COLORS, ART_H, ART_W, PaintSheet } from './ui/paint';
import { raceMovers, raceNews } from './races';
import { FishingGame, TAG_NAMES, TodayPanel, todayCount } from './ui/daily';
import { animalMovers, Drives, postsInside, residentPose, roadRoom, taxiTrips, tripMover, type Mover } from './life';
import { chatPairs, emoteFor, exitAt, exitTo, idSeed, INVITE_HEARTS, locationRoom, lookSettings, mix, NPC_SPEED, npcPose, partOfDay, pickLine, POINTS_PER_HEART, Routes, STEP, VISIT_MINUTES, type LocationRoom, type NpcPose } from './village';
import { cartStop, growthFigures, growthLine, withCartFlag } from './growth';
import { faithLine, riteFigures, templeFigures } from './faiths';
import { FramePerf } from './perf';
import { QualityLadder } from './quality';
import { easedGroundAt, groundAt } from './world';
import { installInputMode } from './inputmode';
import { MeSheet } from './ui/me';
import { CarsSheet } from './ui/cars';
import { PaperMapSheet } from './ui/papermap';
import { LetterSheet } from './ui/letter';
import { mapPath } from './maps/model';
import { TableGames, tableFigures, type TableFigure } from './games/play';
import { heard, surfaceOf, type Around, type Surface } from './audio/ambience';
import type { MoodScene, MusicPlace } from './musicplayer';
import { joinLayers } from './layers';
import { drawPixelThumb } from './pixel/items';
import { TownFeel } from './townfeel';
import { moodLines } from './feel';
import { DriveDesk } from './drive/desk';
import { CAR_MAX, examRoute, nextSpeed, RoadWatch, rotOf, SCHOOL_ZONE, targetSpeed, TOWN_LIMIT, needle, DRIVABLE, type Car, type Fault } from './drive/rules';

export interface DebugOptions {
  /** Force the light of this minute of the day (does not change the world clock). */
  minuteOfDay?: number;
  /** Tests only: the world clock runs this many minutes ahead (never in a release build). */
  shift?: number;
  /** Run a scripted play-through at start to fill the room. */
  demo?: boolean;
  /** Start in the room editor. */
  edit?: boolean;
  /** Open the shop sheet at start, on this tab. */
  sheet?: 'shop' | 'inventory' | 'room';
  /** Show a theme's look without buying it (display only). */
  theme?: string;
  /** Open the workshop at start. */
  workshop?: boolean;
}

export interface GameOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  engine: GameEngine;
  store: Store;
  debug: DebugOptions;
  firstRun: boolean;
  /** The base content packs, to which the player's own items are added. */
  packs: string[];
  userItems: UserItem[];
}

interface Spec {
  x: number;
  y: number;
  wall: WallSide | null;
  on: number | null;
}

/** What residents call their jobs (he, she). */
const ROLE: Record<string, [string, string]> = Object.fromEntries(
  ['sawyer', 'florist', 'waiter', 'baker', 'seller', 'librarian', 'vendor', 'teacher', 'doctor', 'nurse', 'officer', 'night_officer', 'firefighter', 'firefighter_night', 'farmer', 'journalist', 'editor', 'photographer', 'vet', 'vet_nurse', 'coach', 'bartender', 'craftsman', 'winemaker', 'vintner', 'miller', 'factory_baker', 'driver', 'receptionist', 'priest', 'weaver', 'cheesemaker', 'collector', 'hardware_clerk'].map((id) => [id, [tr(`game.role.${id}`), tr(`game.role.${id}.f`)]]),
);

/** Uniforms of the services: firefighters in dark blue with reflective stripes and helmets, the police in blue
 * with caps, the hospital's people in white. */
/** A wandering musician and a lost tourist: visitors of the town, not its people. */
const MUSICIAN: Look = { ...DEFAULT_LOOK, hairStyle: 6, hair: '#3a2a40', topStyle: 4, top: '#8a5a2e', top2: '#e8e0c8', bottom: '#3a3a44', acc: 2, accColor: '#3a2a40' };
const TOURIST: Look = { ...DEFAULT_LOOK, hairStyle: 2, hair: '#e8d9a0', topStyle: 1, top: '#e8a23a', bottom: '#4a8fd0', bottomStyle: 1, acc: 5, accColor: '#f4d35e', skin: '#fbe0c8' };

const UNIFORM: Record<string, Record<string, string>> = {
  firefighter: { 'look.top': '4', 'look.top_color': '#2f3a5a', 'look.top2_color': '#f4d35e', 'look.bottom_color': '#2f3a5a', 'look.acc': '4', 'look.acc_color': '#f4d35e' },
  firefighter_night: { 'look.top': '4', 'look.top_color': '#2f3a5a', 'look.top2_color': '#f4d35e', 'look.bottom_color': '#2f3a5a', 'look.acc': '4', 'look.acc_color': '#f4d35e' },
  officer: { 'look.top': '1', 'look.top_color': '#2f3a5a', 'look.top2_color': '#4a8fd0', 'look.bottom_color': '#2f3a5a', 'look.acc': '4', 'look.acc_color': '#2f3a5a' },
  night_officer: { 'look.top': '1', 'look.top_color': '#2f3a5a', 'look.top2_color': '#4a8fd0', 'look.bottom_color': '#2f3a5a', 'look.acc': '4', 'look.acc_color': '#2f3a5a' },
  doctor: { 'look.top': '2', 'look.top_color': '#e8e0c8', 'look.top2_color': '#3fb8b0', 'look.bottom_color': '#e8e0c8' },
  nurse: { 'look.top': '2', 'look.top_color': '#e8e0c8', 'look.top2_color': '#d86aa0', 'look.bottom_color': '#e8e0c8' },
  collector: { 'look.top': '4', 'look.top_color': '#e8a23a', 'look.top2_color': '#f4d35e', 'look.bottom_color': '#3a3a44' },
};

const SETTING_DEFAULTS: Record<string, string> = { time_mode: 'real', shadows: '1', wall_mode: 'cut', ambient_strength: '40' };
const SIT_ACTIONS = new Set(['sit', 'rest']);
/** Seconds of a hop up onto a root or down off it. */
const HOP_TIME = 0.3;

/** The shops with a bell over the door. */
const SHOP_BELLS = /^(grocery_in|bakery_in|flower_in|clothes_in|salon_in|hardware_in|donuts_in|cafe_in|post_in|workshop_in)$/;
/** Places of worship: their altar stands by the north wall, and people face it. */
const FACE_ALTAR = new Set(['church_in', 'temple_in']);

/**
 * How much to spare the device from the start (0 all, 1 some, 2 the most): few cores or little memory mean an
 * old phone. The frame times may lower it further as the game runs.
 */
export function weakDevice(): number {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { deviceMemory?: number });
  const cores = nav?.hardwareConcurrency ?? 8;
  const memory = nav?.deviceMemory ?? 8;
  if (cores <= 4 || memory <= 2) return 2;
  if (cores <= 6 || memory <= 4) return 1;
  return 0;
}
/** What one lies down on to rest (rather than sits). */
/** A resident with how they live: young, with a partner, how they get about, with a pram. */
type Townsfolk = ResidentDef & Traits & { young?: boolean; partner?: string | null };
/** Things the player sits down to use; the townsfolk do not take the chair in front of them. */
const PLAYER_DESKS = /^(pc_desk|computer|secret_pc)$/;
/** The garden's own crack on a rift day (not a placement of the core: never sent in a command). */
const GARDEN_RIFT_PID = 990_001;
/** The plant drawn on a plot has the pid PLANT_PID - plot (a tap on it is a tap on the plot). */
const PLANT_PID = -10000;
/** The icon of a kind of station. */
const STATION_ICON: Record<string, string> = { buy: 'coin', sell: 'coin', make: 'hammer', gather: 'harvest', play: 'sparkle', wish: 'heart', read: 'read', ride: 'walk', rest: 'rest' };
/** Words for what is missing at a station or a help. */
const STATION_REASON: Record<string, string> = {
  closed: tr('game.reason.closed'),
  coins: tr('game.reason.coins'),
  not_enough: tr('game.reason.notEnough'),
  pocket_full: tr('game.reason.pocketFull'),
  locked: tr('game.reason.locked'),
};

/** The road's options on the things of the town (drive/desk.ts). */
const ROAD_LABELS: Record<string, { icon: string; label: string }> = {
  driving: { icon: 'talk', label: tr('game.road.driving') },
  sto: { icon: 'hammer', label: tr('game.road.sto') },
  police: { icon: 'talk', label: tr('game.road.police') },
  cellmate: { icon: 'talk', label: tr('game.road.cellmate') },
  drive: { icon: 'taxi', label: tr('game.road.drive') },
  car_info: { icon: 'read', label: tr('game.road.carInfo') },
  can: { icon: 'water_plant', label: tr('game.road.can') },
  licence: { icon: 'key', label: tr('game.road.licence') },
};
/** Night behind bars: the room dim and cold. */
const JAIL_FILTER = 'brightness(0.62) saturate(0.55) hue-rotate(12deg)';


export class Game {
  private readonly engine: GameEngine;
  private readonly store: Store;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: SceneRenderer;
  private readonly hud: Hud;
  private readonly shop: ShopSheet;
  private readonly edit: Studio;
  private readonly toasts: Toasts;
  private readonly workshop: Workshop;
  private readonly history: History;
  private readonly bubble: Bubble;
  private path: [number, number][] | null = null;
  private pending: { pid: number; action: string } | null = null;
  private seat: { pid: number; x: number; y: number; lift: number; front: [number, number]; mode: SeatMode; axis: [number, number] } | null = null;
  private menuPid: number | null = null;
  private longPress: number | null = null;
  /** Which room the editor shows (null: the one the player stands in). */
  private viewRegion: number | null = null;
  private shownRegion = -1;
  private fader!: HTMLElement;
  private readonly settings: SettingsPanel;
  private readonly goodbye: ExitScreen;
  private readonly pocketSheet: PocketSheet;
  private readonly paperSheet: PaperSheet;
  private readonly paperPhotos: PaperPhotos;
  private readonly photoBar: PhotoBar;
  private readonly albumSheet: AlbumSheet;
  private albumDb: Promise<Album> | null = null;
  private readonly wardrobeSheet: WardrobeSheet;
  private readonly salonSheet: SalonSheet;
  private readonly ask: AskDialog;
  private readonly projectsSheet: ProjectsSheet;
  /** The town's flags the place on screen was built with (what was built, opened, a storm…). */
  private townKey = '';
  /** Invitations already told about or offered, as "host:day:what". */
  private invitesSeen = new Set<string>();
  private townCheck = 0;
  private readonly journal: JournalSheet;
  private readonly fridgeSheet: FridgeSheet;
  private readonly cookSheet: CookSheet;
  private readonly craftSheet: CraftSheet;
  private readonly buildersSheet: BuildersSheet;
  private readonly petsSheet: PetsSheet;
  private readonly meSheet: MeSheet;
  private readonly carsSheet: CarsSheet;
  private readonly paperMap: PaperMapSheet;
  private readonly letter: LetterSheet;
  private letterBusy = false;
  private readonly lettersOff = import.meta.env.MODE !== 'production' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug') && !new URLSearchParams(location.search).has('letters');
  /** Where the paper map's way leads, and the arrow on the screen that points there. */
  private guide: { loc: string; x: number; y: number; name: string } | null = null;
  private readonly guideEl: HTMLElement;
  /** The animals at home besides the one walking with the player (petlife.ts). */
  private housePets: HousePet[] = [];
  private petsNow: PetsView | null = null;
  private petsOnly: string | null = null;
  private siteBusy = false;
  private wholeCache: { room: RoomView; view: RoomView } | null = null;
  private petNoticeAt = 0;
  private readonly phoneSheet: PhoneSheet;
  /** «Мапи» on the phone and the computer. */
  private readonly mapsSheet: MapsSheet;
  private readonly billsSheet: BillsSheet;
  private readonly workSheet: WorkSheet;
  private readonly stallSheet: StallSheet;
  /** The counter whose wares the stall sheet shows. */
  private stallAt = '';
  private readonly media: Media;
  private readonly paintSheet: PaintSheet;
  /** The monthly bills and which utilities are on (refreshed with everything else). */
  private bills: BillsView | null = null;
  /** What the player carries (and the chest at home), as the core sees it. */
  private pocket: PocketView = { capacity: 8, used: 0, items: {}, chest: {}, keys: [], bag: null };
  /** Keys wait until the world is opened (the title and the hero screens come first). */
  private started = false;
  private prefs: Prefs = loadPrefs();
  private readonly sound: Sound;
  private unsaved: EventRecord[] = [];
  /** Frames drawn so far (the frame rate can be read off this in tests). */
  frames = 0;
  private fade = 0;
  private lowDetail = false;
  private readonly rootEl: HTMLElement;
  private readonly packs: string[];
  private userItems: UserItem[];
  private readonly keys = new Keys();
  private readonly debug: DebugOptions;

  private room: RoomView;
  /** The home, whatever is shown now (the village replaces `room` while the player is out). */
  private homeRoom: RoomView;
  /** `home`, or the id of the location of the world the player is in. */
  private location: string = 'home';
  private village: { def: LocationDef; loc: LocationRoom; routes: Routes; drives: Drives } | null = null;
  /** The settlement's life as the core simulates it, refreshed every second. */
  private life: LifeView | null = null;
  private lifeCheck = 0;
  private readonly resPoses = new Map<string, NpcPose>();
  /** The table games: the boards and the town's players. */
  private readonly tables: TableGames;
  private readonly resLooks = new Map<string, Look>();
  private readonly resDirs = new Map<string, Dir>();
  private movers: Mover[] = [];
  /** Where the player was at home when they went out, to come back to the same door. */
  private homeSpot: { x: number; y: number } | null = null;
  private npcViews: NpcView[] = [];
  private npcPoses = new Map<string, NpcPose>();
  /** The one the player stopped to talk to: they stand where they were, turned to the player, until it is over. */
  private talkWith: { id: string; at: number; pose: NpcPose | null } | null = null;
  private npcCheck = 0;
  private readonly dialogue: DialogueBox;
  private readonly todayPanel: TodayPanel;
  private readonly fishing: FishingGame;
  private readonly arcade: Arcade;
  private readonly planSheet: PlanSheet;
  private readonly mending: WorkshopSheet;
  private readonly taxi: TaxiSheet;
  private raceSaid = '';
  private daily: DailyView | null = null;
  /** Gathering or fishing right where the player stands. */
  private dayTarget: ReturnType<Game['dayTargetHere']> = null;
  private readonly gifts: GiftPicker;
  private readonly people: PeoplePanel;
  private readonly npcTags: HTMLElement;
  private readonly tagEls = new Map<string, HTMLElement>();
  /** Something to do on arriving at the end of a walk that is not using an item (going up to someone). */
  private then: (() => void) | null = null;
  private wallet: WalletView;
  private inventory: InventoryEntry[];
  private walker: Walker = { x: 4.5, y: 5.5, facing: 'right' };
  private look: Look = lookFromSettings({});
  private petLook: PetLook = petFromSettings({});
  private moving = false;
  private dir: Dir = 'down';
  private pet: Pet = { x: 3.5, y: 5.5, dir: 'right', pose: 'sit', idle: 0 };
  private petScreenDir: 'left' | 'right' = 'right';
  private mode: 'walk' | 'edit' = 'walk';
  private held: { item: string; rot: number } | null = null;
  private selectedPid: number | null = null;
  private hover: Pick | null = null;
  private view: View = 0;
  private studioMode: StudioMode = 'items';
  private shapeTool: ShapeTool = 'add';
  private paintTarget: PaintTarget = 'floor';
  private paintStyle: string | null = null;
  private drag: { cells: Map<string, [number, number]>; edges: Map<string, [number, number, WallSide]> } | null = null;
  private ownedStyles = new Set<string>();
  private ownedThemes = new Set<string>();
  private prices: Record<string, number> = {};
  private pointers = new Map<number, { x: number; y: number }>();
  private panDrag: { x: number; y: number; moved: boolean } | null = null;
  private pinch = 0;
  /** A pinch is in progress or just ended; lifting the remaining finger must not count as a tap. */
  private pinched = false;
  private saved: { zoom: number; pan: { x: number; y: number } } | null = null;
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private target: Target | null = null;
  /** What to do once the hero has sat down (watching the TV from the sofa). */
  private afterSit: (() => void) | null = null;
  private performing: { until: number; sitting: boolean; wash?: { x: number; y: number; z: number }; eat?: boolean; pray?: boolean } | null = null;
  private debugOffset = 0;
  /** Set once from the debug options (tests run at midday whatever the hour). */
  private shiftApplied = false;
  private time = 0;
  private last = 0;
  private hudClock = 0;
  private saving: Promise<void> = Promise.resolve();
  /** A snapshot waiting for its events to be written before it is kept. */
  private unsavedSnapshot: StoredSnapshot | null = null;
  private warnedStorage = false;
  private actionKey = '';

  constructor(opts: GameOptions) {
    this.engine = opts.engine;
    this.store = opts.store;
    this.canvas = opts.canvas;
    this.debug = opts.debug;
    this.rootEl = opts.root;
    this.sound = new Sound(this.prefs);
    this.packs = opts.packs;
    this.userItems = opts.userItems;
    this.renderer = new SceneRenderer(opts.canvas);
    this.wonders = new Wonders(opts.canvas);
    this.renderer.profiling = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
    this.toasts = new Toasts(opts.root);
    this.skin = new FeelLayer(opts.canvas);
    this.room = this.engine.room();
    this.homeRoom = this.room;
    this.wallet = this.engine.wallet();
    this.inventory = this.engine.inventory();
    this.history = new History((cmd) => this.run(cmd), () => this.pushEdit());

    this.hud = new Hud(opts.root, {
      onEdit: () => (this.mode === 'edit' ? this.exitEdit() : this.enterEdit()),
      onShop: () => this.shop.open('shop'),
      onAction: () => this.act(),
      onJump: () => this.jump(),
      onCrouch: () => {
        this.crouchHeld = !this.crouchHeld;
      },
      onSlot: (n) => this.chooseSlot(n),
      onSwap: () => this.swapHands(),
      onTurn: (dir) => this.rotateView(dir),
      onSettings: () => this.settings.open(),
      onRoom: (dir) => this.switchRoom(dir),
      onPeople: () => this.openPeople(),
      onToday: () => this.openToday(),
      onPhoto: () => this.enterPhoto(),
      onMe: () => this.meSheet.open(),
      onCars: () => this.carsSheet.open(),
      onMap: () => this.openMap(),
      onPocket: () => this.openPocket(),
      onJournal: () => this.openJournal(),
      onTaxi: () => this.openTaxi(),
      onPhone: () => this.phoneSheet.open(),
      onBusk: () => this.media.busk(),
    });
    // a soft click as the menu opens and closes
    this.hud.root.querySelector('.hud-menu-btn')?.addEventListener('click', () => this.sound.sfx('click'));
    this.shop = new ShopSheet(opts.root, {
      engine: this.engine,
      now: () => this.now(),
      activeStyles: () => this.homeRoom.styles,
      onBuyItem: (id) => this.buyItem(id),
      onBuyStyle: (id, kind, owned) => this.chooseStyle(id, kind, owned),
      onExpand: (id) => this.expand(id),
      onPickInventory: (item) => this.pickFromInventory(item),
      sellBackPrice: (item) => (this.location === 'home' ? sellBackPrice(this.engine.catalog.items[item] as never) : null),
      onSellBack: (item) => {
        const r = this.run({ type: 'sell_back', item });
        if (!r.ok) {
          if (r.error.kind === 'too_soon') this.toasts.show(tr('shop.sellBackDone'), { kind: 'error', icon: 'lock', ms: 3400 });
          return;
        }
        const coins = Number((r.events.map((e) => e.kind).find((k) => k.type === 'SoldBack') as { coins?: number } | undefined)?.coins ?? 0);
        this.sound.sfx('coins');
        this.toasts.show(tr('shop.sold', { item: this.itemName(item), coins }), { icon: 'coin', kind: 'good', ms: 2600 });
        this.shop.refresh();
      },
      onClose: () => this.shop.close(),
    });
    this.edit = new Studio(opts.root, this.engine.catalog, {
      onDone: () => this.exitEdit(),
      onMode: (m) => this.setStudioMode(m),
      onUndo: () => this.history.undo(),
      onRedo: () => this.history.redo(),
      onRotate: () => this.rotate(),
      onStore: () => this.storeSelected(),
      onDuplicate: () => this.duplicateSelected(),
      onPick: (item) => this.pickFromInventory(item),
      onShop: () => this.shop.open('shop'),
      onRecolor: (pid, slot, color) => this.recolor(pid, slot, color),
      onProp: (pid, key, value) => this.setProp(pid, key, value),
      onShapeTool: (tool) => this.chooseShapeTool(tool),
      onPlan: () => this.openPlan(),
      onPaintTarget: (target) => this.choosePaintTarget(target),
      onPaintStyle: (id) => this.choosePaintStyle(id),
      onFill: () => this.fill(),
      onSetting: (key, value) => this.setSetting(key, value),
      onStyle: (kind, id) => this.chooseWorldStyle(kind, id),
      onTheme: (id) => this.chooseTheme(id),
      onLook: (key, value) => this.setSetting(key, value),
      onLookRandom: () => this.randomLook(),
      onWorkshop: () => this.workshop.open(),
      onEditCustom: (id) => {
        const own = this.userItems.find((u) => u.id === id);
        if (own) this.workshop.open(own);
      },
    });

    this.planSheet = new PlanSheet(opts.root, {
      quoteGrow: (id, side) => {
        const part = this.part(id);
        const cells = part ? growCells(part, side, cellSet(this.homeRoom)) : [];
        return cells.length ? this.floorShort(cells.length) : null;
      },
      canShrink: (id, side) => {
        const part = this.part(id);
        const cells = part ? shrinkCells(part, side) : [];
        return cells.length > 0 && connected(this.homeRoom.cells.filter(([x, y]) => !cells.some(([cx, cy]) => cx === x && cy === y)));
      },
      quoteBuild: (kind, w, d) => this.quoteBuild(kind, w, d),
      grow: (id, side) => this.movePartEdge(id, side, true),
      shrink: (id, side) => this.movePartEdge(id, side, false),
      remove: (id) => this.removePart(id),
      rename: (id, name) => this.namePart(id, 'name', name),
      setKind: (id, kind) => this.namePart(id, 'kind', kind),
      build: (kind, w, d) => this.buildPart(kind, w, d),
      setHomeName: (name) => {
        this.run({ type: 'set_setting', key: 'home.name', value: name });
        this.planSheet.refresh(this.planView());
      },
    });
    this.settings = new SettingsPanel(opts.root, this.prefs, { onChange: (p) => this.applyPrefs(p), onExit: () => this.exit(), onLang: (l) => void this.saveNow().then(() => { chooseLang(l); location.reload(); }) });
    installA11y(opts.root);
    installInputMode(opts.root);
    this.goodbye = new ExitScreen(opts.root, { canClose: canExit(), onBack: () => this.sound.hush(false), onClose: () => void exitApp() });
    this.applyPrefs(this.prefs, false);
    // Esc or the browser's own key leaves the full screen: the setting follows
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      if (on !== this.prefs.fullscreen) this.applyPrefs({ ...this.prefs, fullscreen: on });
    });
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    opts.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.sound.sfx('tap');
    });
    this.bubble = new Bubble(opts.root);
    this.fader = document.createElement('div');
    this.fader.className = 'fader';
    opts.root.append(this.fader);
    this.npcTags = document.createElement('div');
    this.npcTags.className = 'npc-tags';
    opts.root.insertBefore(this.npcTags, this.hud.root);
    this.dialogue = new DialogueBox(opts.root);
    this.gifts = new GiftPicker(opts.root);
    this.people = new PeoplePanel(opts.root);
    this.todayPanel = new TodayPanel(opts.root, {
      me: () => this.mePage(),
      bills: () => {
        const v = this.engine.bills(this.now());
        return { block: billsBlock(v, (u) => this.payBills(u)), due: v.bills.filter((b) => !b.paid).length };
      },
      openPaper: () => {
        this.todayPanel.close();
        this.morningPaper(true);
      },
      name: (item) => this.itemLabel(item),
      thumb: (item, size) => this.thumbOf(item, size),
      have: (key) => this.haveFor(key),
      openLetter: (npc, index) => this.openLetter(npc, index),
      whereToFind: (item) => this.whereToFind(item),
      news: () => {
        const day = Math.floor(this.now() / 1440);
        return (this.engine.catalog.sites ? this.engine.life(this.now()).news : []).filter((n) => Math.floor(n.minute / 1440) >= day - 1).map((n) => n.text).reverse();
      },
      person: (id) => this.npcDef(id)?.name ?? id,
    });
    this.fishing = new FishingGame(opts.root, () => vibrate(this.prefs, 30), () => (this.daily?.catches_left ?? 0) > 0);
    this.workshop = new Workshop(opts.root, { onSave: (item) => this.saveUserItem(item), onClose: () => undefined }, () => this.userItems);
    this.bindCanvas();
    this.keys.attach(window);
    this.arcade = new Arcade(opts.root, (kind) => this.sound.sfx(kind === 'line' ? 'chime' : kind === 'over' ? 'error' : 'tap'));
    this.taxi = new TaxiSheet(opts.root, (stop) => this.rideTaxi(stop));
    this.pocketSheet = new PocketSheet(opts.root, {
      name: (item) => this.itemName(item),
      def: (item) => this.engine.catalog.items[item],
      stash: (item, n) => this.moveToChest(item, n, true),
      take: (item, n) => this.moveToChest(item, n, false),
      toHand: (item) => this.toHand(item),
      setSlot: (slot, item) => this.equip({ type: 'set_hotbar', slot, item }),
      setOffhand: (item) => this.equip({ type: 'set_offhand', item }),
      wear: (item) => this.equip({ type: 'wear', item }),
      takeOff: (slot) => this.equip({ type: 'take_off', slot }),
      figure: (dir) => heroLayers(this.armoredLook(), dir, 'idle', 0),
      throwAway: (item, n) => {
        const r = this.run({ type: 'throw_away', item, n });
        if (r.ok) {
          this.sound.sfx('pop');
          this.toasts.show(tr('pocket.thrown', { item: this.itemName(item) }), { icon: 'bag', ms: 2000 });
        }
      },
      recipients: () => this.giftRecipients(),
      give: (item, to) => this.giveFromPocket(item, to),
      price: (item) => (this.sellingAt ? buyPrice(this.engine.catalog.stations?.[this.sellingAt]?.buys ?? [], item, this.engine.catalog.items[item]?.tags ?? []) : null),
      sell: (item, n) => this.sellFromPocket(item, n),
      look: (item) => (item === 'driver_licence' ? tr('game.look') : null),
      open: (item) => {
        if (item === 'driver_licence') this.driveDesk.licence();
      },
    });
    this.paperPhotos = new PaperPhotos({ catalog: this.engine.catalog, scene: (hint, day) => this.photoScene(hint, day) });
    this.paperSheet = new PaperSheet(opts.root, {
      photo: (story: PaperStory, day: number) => (story.photo ? this.paperPhotos.photo(story.id ?? story.title, story.photo, day) : Promise.resolve(null)),
      placeName: (place) => (place === 'village' ? tr('game.lypove') : this.locationName(place)),
    });
    this.albumSheet = new AlbumSheet(opts.root, () => this.album());
    this.photoBar = new PhotoBar(opts.root, this.canvas, {
      face: (f) => (this.dir = f),
      shoot: (look) => this.takePhoto(look),
      openAlbum: () => void this.albumSheet.open(),
      done: () => this.leavePhoto(),
    });
    learnGarments(this.engine.catalog.items);
    this.wardrobeSheet = new WardrobeSheet(opts.root, {
      name: (item) => this.itemName(item),
      settings: () => this.homeRoom.settings,
      buy: (item) => {
        if (this.run({ type: 'acquire', item }).ok) {
          this.sound.sfx('buy');
          this.toasts.show(tr('game.yoursNow', { item: this.itemName(item) }), { kind: 'good', icon: 'check' });
        }
        this.wardrobeSheet.refresh(this.engine.wardrobe(this.now()));
      },
      wear: (slot, item) => {
        if (this.run({ type: 'dress', slot, item }).ok) this.sound.sfx('pop');
        this.wardrobeSheet.refresh(this.engine.wardrobe(this.now()));
      },
    });
    this.salonSheet = new SalonSheet(opts.root, {
      settings: () => this.homeRoom.settings,
      coins: () => this.wallet.coins,
      cut: (set) => {
        if (this.run({ type: 'haircut', set }).ok) {
          this.sound.sfx('chime');
          this.toasts.show(tr('game.hairdresserSmiles'), { kind: 'good', icon: 'heart', ms: 3200 });
        }
        const v = this.engine.salon(this.now());
        if (v) this.salonSheet.done(v);
      },
    });
    this.ask = new AskDialog(opts.root);
    this.tables = new TableGames(opts.root, {
      residents: () => Object.values(this.engine.catalog.residents ?? {}).map((r) => ({ id: r.id, name: r.name, age: r.age })),
      near: (x, y) => [...this.resPoses.entries()].filter(([, p]) => Math.hypot(p.x - x, p.y - y) < 3.5).map(([id]) => id),
      myName: () => this.myName(),
      together: (who) => void this.runQuiet({ type: 'talk', npc: who }),
      seatAt: (x, y) => this.sitByTable(x, y),
    });
    this.driveDesk = new DriveDesk({
      view: () => this.engine.drive(this.now()),
      run: (cmd) => this.run(cmd),
      open: (c) => this.ask.open(c),
      close: () => this.ask.close(),
      who: (role) => this.roadPerson(role),
      coins: () => this.engine.wallet().coins,
      startExam: () => this.startExam(),
      toCar: () => this.toCar(),
      say: (text, good) => this.toasts.show(text, { icon: good ? 'check' : 'taxi', kind: good ? 'good' : undefined, ms: 3600 }),
      sfx: (name) => this.sound.sfx(name as Sfx),
      today: () => Math.floor(this.now() / 1440),
    });
    this.projectsSheet = new ProjectsSheet(opts.root, {
      name: (item) => this.itemName(item),
      inPocket: (item) => this.pocket.items[item] ?? 0,
      coins: () => this.wallet.coins,
      give: (project, coins, items) => this.contribute(project, coins, items),
    });
    this.journal = new JournalSheet(opts.root, {
      names: () => this.locationNames(),
      here: () => this.location,
      today: () => Math.floor(this.now() / 1440),
      epoch: () => this.engine.epochUnixSecs,
      start: (key) => this.promise(key),
      step: (key, choice) => this.questStep(key, choice),
      tracked: () => this.trackedKey(),
      track: (key) => this.setTracked(key),
      people: () => this.engine.feelings(this.now()).warmth,
    });
    const homeDeps = { name: (item: string) => this.itemName(item), keyName: (key: string) => this.keyName(key), def: (item: string) => this.engine.catalog.items[item] };
    this.fridgeSheet = new FridgeSheet(opts.root, homeDeps, (item, n, into) => this.moveFridge(item, n, into));
    this.cookSheet = new CookSheet(opts.root, homeDeps, (recipe) => this.cook(recipe));
    this.billsSheet = new BillsSheet(opts.root, (utility) => this.payBills(utility));
    this.craftSheet = new CraftSheet(opts.root, { ...homeDeps, craft: (recipe) => this.craft(recipe), tinker: (items) => this.tinker(items) });
    this.buildersSheet = new BuildersSheet(opts.root, { order: (o) => this.orderBuild(o), coins: () => this.wallet.coins, today: () => Math.floor(this.now() / 1440) });
    this.meSheet = new MeSheet(opts.root, {
      name: () => this.myName(),
      rename: (name) => {
        if (!name) return tr('game.nameEmpty');
        const r = this.run({ type: 'name_player', name });
        if (!r.ok) return tr('game.nameBad');
        this.refresh();
        return null;
      },
      pets: () => {
        const v = this.engine.pets(this.now());
        return { first: petFromSettings(this.homeRoom.settings), owned: v.owned, companion: v.companion };
      },
      chooseFirst: (kind) => {
        if (this.engine.pets(this.now()).companion) this.run({ type: 'companion', pet: null });
        if (this.run({ type: 'set_setting', key: 'look.pet', value: String(kind) }).ok) {
          this.refresh();
          this.pet.x = this.walker.x;
          this.pet.y = this.walker.y;
        }
      },
      chooseOwned: (id) => this.setCompanion(id),
    });
    this.petsSheet = new PetsSheet(opts.root, {
      look: (k) => petLookOf(k, petFromSettings(this.homeRoom.settings)),
      adopt: (o) => this.adopt(o),
      care: (pet, what) => this.petCare(pet, what),
      companion: (pet) => this.setCompanion(pet),
      firstName: () => {
        const k = petFromSettings(this.homeRoom.settings).kind;
        return k === 3 ? '' : PET_NAMES[k];
      },
    });
    this.phoneSheet = new PhoneSheet(opts.root, {
      camera: () => this.enterPhoto(),
      taxi: () => this.openTaxi(),
      weather: () => {
        const w = this.engine.paper(this.now()).weather;
        return tr('game.weather', { today: w.today, tomorrow: w.tomorrow });
      },
      worn: () => this.engine.wear(this.now()).map((view) => ({ view, name: this.itemName(view.item) })),
      callMaster: (pid) => this.callMaster(pid),
      maps: () => this.mapsSheet.open(),
      cars: () => this.carsSheet.open(),
    });
    this.letter = new LetterSheet(opts.root);
    this.paperMap = new PaperMapSheet(opts.root, {
      catalog: () => ({ locations: this.engine.catalog.locations ?? {}, residents: this.engine.catalog.residents ?? [], stations: this.engine.catalog.stations ?? {} }),
      hero: () => {
        return this.heroOnMap();
      },
      guide: (to) => this.setGuide(to),
      clock: () => ({ minute: this.now() % 1440, weekday: this.weekdayNow() }),
      home: () => this.homeDoor(),
    });
    this.guideEl = document.createElement('div');
    this.guideEl.className = 'world-guide';
    this.guideEl.setAttribute('aria-hidden', 'true');
    this.guideEl.style.display = 'none';
    opts.root.append(this.guideEl);
    this.carsSheet = new CarsSheet(opts.root, {
      cars: () => this.engine.drive(this.now())?.cars ?? [],
      item: (id) => this.engine.catalog.items[id],
      coins: () => this.wallet.coins,
      owned: () => this.engine.drive(this.now())?.car?.model ?? null,
      buy: (id) => {
        const r = this.run({ type: 'buy_car', car: id });
        if (!r.ok) return r.error?.kind === 'closed' ? tr('cars.closed') : tr('cars.cant');
        this.sound.sfx('buy');
        return null;
      },
    });
    this.mapsSheet = new MapsSheet(opts.root, {
      catalog: () => ({ locations: this.engine.catalog.locations ?? {}, residents: this.engine.catalog.residents ?? [], stations: this.engine.catalog.stations ?? {} }),
      hero: () => {
        if (this.location !== 'home') return { loc: this.location, x: this.walker.x, y: this.walker.y, facing: this.walker.facing };
        // at home: at the door of where one lives
        const door = this.engine.taxiDestinations('village', 0, 0, this.now()).find((d) => d.id === 'taxi.home');
        return door ? { loc: door.location, x: door.x + 0.5, y: door.y + 0.5, facing: this.walker.facing } : null;
      },
      minute: () => this.now() % 1440,
      weekday: () => this.weekdayNow(),
      festival: () => {
        const f = this.engine.festival(this.now());
        return f && f.phase === 'day' ? f.name : null;
      },
      weather: () => {
        const sky = JSON.parse(this.engine.weatherAt(this.now())) as string;
        return { sky, words: this.engine.paper(this.now()).weather.today };
      },
      traffic: () => (this.location === 'home' ? [] : this.movers.filter((m) => m.kind && m.kind !== 'cart').map((m) => ({ loc: this.location, x: m.x, y: m.y }))),
      quotes: () => this.taxiQuotes(),
      ride: (id) => this.rideTaxi(id),
      home: () => this.homeDoor(),
      // the place as it is today, taken by the paper's own camera, in colour
      photo: (s) => this.paperPhotos.photo(`maps:${s.at?.join(',') ?? ''}:${s.minute}`, { place: s.place, at: s.at, props: [], people: s.people, minute: s.minute, far: false }, Math.floor(this.now() / 1440), false),
    });
    this.workSheet = new WorkSheet(opts.root, {
      shift: () => this.engine.shift(this.now()),
      now: () => this.now(),
      answer: (choice) => this.workStep(choice),
      end: () => this.endShift(),
    });
    this.stallSheet = new StallSheet(opts.root, {
      rows: () => this.stallRows(),
      coins: () => this.wallet.coins,
      use: (id) => {
        // a buyer opens the pocket with its prices instead
        if (this.engine.catalog.stations?.[id]?.buys?.length) this.stallSheet.close();
        this.useStation(id);
        this.stallSheet.render();
      },
    });
    this.media = new Media(opts.root, {
      run: (cmd) => this.run(cmd),
      repertoire: () => this.engine.repertoire(),
      musicLevel: () => this.engine.skills().find((k) => k.id === 'music')?.level ?? 0,
      owned: (item) => (this.pocket.items[item] ?? 0) + (this.pocket.chest[item] ?? 0) + (this.inventory.find((e) => e.item === item)?.owned ?? 0),
      portable: () => this.inventory.filter((e) => e.owned > 0 && this.engine.catalog.items[e.item]?.tags.includes('portable')).map((e) => e.item),
      audio: () => {
        this.sound.unlock();
        return this.sound.instrumentOut();
      },
      duck: (on) => this.sound.duck(on),
      toast: (text, icon = 'play_music', ms = 3200) => this.toasts.show(text, { icon, ms }),
      location: () => this.location,
      outdoors: () => this.outdoors(),
      minute: () => this.now(),
      month: () => this.engine.calendarDay(this.now()).month,
      weekend: () => this.engine.calendarDay(this.now()).info.day_off,
      time: () => this.time,
      hero: () => ({ x: this.walker.x, y: this.walker.y }),
      people: () => [...this.resPoses, ...[...this.npcPoses].filter(([, p]) => p.visible)].map(([id, p]) => ({ id, x: p.x, y: p.y })),
      placements: () => this.room.placements,
      itemName: (id) => this.itemName(id),
      tvFeed: () => this.tvFeed(),
      wiki: () => this.wikiEntries(),
      weather: () => {
        const w = this.engine.paper(this.now()).weather;
        return { now: w.today, next: w.tomorrow };
      },
      today: () => this.engine.paper(this.now()).date,
      sitNear: (pid, then) => this.sitNear(pid, then),
      printPicture: (pid) => this.printPicture(pid),
      games: () => this.arcade.open(),
      maps: () => this.mapsSheet.open(),
    });
    this.paintSheet = new PaintSheet(opts.root);
    this.mending = new WorkshopSheet(opts.root, () => this.engine.catalog, (item) => this.restore(item));
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.renderer.resize());
    // no music from a phone in a pocket: silent while the app is hidden (the WebView does not always say so, Android does)
    document.addEventListener('visibilitychange', () => this.sound.setHidden(document.hidden));
    if (Capacitor.isNativePlatform()) void App.addListener('appStateChange', (st) => this.sound.setHidden(!st.isActive));
  }

  /** World minute now, per the device clock (plus the debug offset used by the demo script). */
  now(): number {
    if (!this.shiftApplied) {
      this.shiftApplied = true;
      this.debugOffset += this.debug.shift ?? 0;
    }
    return this.engine.nowMinutes() + this.debugOffset;
  }

  /** Opens the world. On the first run the starter room is built and the hero made on the first screen is put on. */
  start(firstRun: boolean, hero?: [string, string][], first?: { name: string; pet: PetLook }): void {
    this.started = true;
    this.renderer.resize();
    // the game opens at home: the core is told so (a session may have ended out in the world)
    if (this.engine.locations(this.now()).location !== 'home') this.travel('home');
    if (firstRun) this.starterRoom();
    if (this.debug.demo) this.demoPlaythrough();
    else this.buildHouse();
    this.refresh();
    if (hero) this.run({ type: 'make_hero', set: hero });
    // the name and the pet chosen at the first meeting
    if (first?.name) this.run({ type: 'name_player', name: first.name });
    if (first) {
      this.run({ type: 'set_setting', key: 'look.pet', value: String(first.pet.kind) });
      this.run({ type: 'set_setting', key: 'look.cat_color', value: first.pet.fur });
    }
    if (this.store.kind === 'memory' && !this.debug.demo) this.toasts.show(t('ui.no_storage'), { kind: 'error', icon: 'lock', ms: 4200 });
    if (this.debug.edit) this.enterEdit();
    if (this.debug.workshop) {
      this.enterEdit();
      this.workshop.open();
    }
    if (this.debug.sheet) this.shop.open(this.debug.sheet);
    this.updateHudClock();
    window.setTimeout(() => this.morningNews(), 2500);
    // the morning paper; back after a day or more, the missed issues lie on top of it
    window.setTimeout(() => {
      const away = this.welcomeBack();
      this.morningPaper(!!away, away);
    }, 900);
    window.setInterval(() => this.rememberSeen(), 30_000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.rememberSeen();
    });
    // a save edited from the outside: what was forged is left out, and the player is told once
    const honest = this.engine.integrity();
    if (honest.tampered > 0) window.setTimeout(() => this.toasts.show(tr('game.tampered', { n: honest.tampered }), { kind: 'error', icon: 'lock', ms: 6000 }), 3500);
    requestAnimationFrame(this.tick);
  }

  // ---- commands ---------------------------------------------------------------------------------

  private run(cmd: Command): CommandResult {
    const result = this.engine.command(cmd, this.now());
    if (result.ok) {
      this.persist();
      this.refresh();
      this.questNews(result);
      // a tool that gave out with it says so
      this.toolsGone(result);
    } else {
      this.reportError(result.error);
    }
    return result;
  }

  private persist(): void {
    this.unsaved.push(...this.engine.drain());
    // a snapshot the engine made covers the events drained so far: it is kept once they are written
    const snapshot = this.engine.takeSnapshot();
    if (snapshot) this.unsavedSnapshot = snapshot;
    if (this.unsaved.length === 0) return;
    // Events are written in order and a failed write is retried with everything after it, so the stored log never has a gap.
    this.saving = this.saving
      .then(async () => {
        const batch = this.unsaved.splice(0, this.unsaved.length);
        const snap = this.unsavedSnapshot;
        this.unsavedSnapshot = null;
        try {
          await this.store.appendEvents(batch);
        } catch (err) {
          this.unsaved.unshift(...batch);
          if (snap && !this.unsavedSnapshot) this.unsavedSnapshot = snap;
          throw err;
        }
        // a snapshot is only a shortcut for the next start: failing to keep one loses nothing
        if (snap) await this.store.saveSnapshot(snap).catch(() => undefined);
      })
      .catch(() => {
        if (!this.warnedStorage) {
          this.warnedStorage = true;
          this.toasts.show(t('ui.no_storage'), { kind: 'error', icon: 'lock', ms: 4200 });
        }
      });
  }

  private refresh(): void {
    this.homeRoom = this.engine.room();
    if (this.debug.theme) this.homeRoom = this.previewTheme(this.homeRoom, this.debug.theme);
    this.homeRoom = this.withGardenRift(this.homeRoom);
    // things at home show their age
    if (this.mode !== 'edit') this.homeRoom = withWear(this.homeRoom, this.engine.wear(this.now()));
    this.room = this.location !== 'home' && this.village ? this.village.loc.room : this.homeRoom;
    this.wallet = this.engine.wallet();
    this.hud.setPhone((this.engine.inventory().find((i) => i.item === 'smartphone')?.owned ?? 0) > 0);
    if (this.craftSheet?.isOpen()) this.craftSheet.refresh(this.engine.crafts(this.now()), this.engine.tools());
    this.inventory = this.engine.inventory();
    this.pocket = this.engine.pocket();
    this.hud.setPocket(this.pocket.used, this.pocket.capacity);
    this.showHotbar();
    this.refreshQuests();
    this.hud.setTaxi(this.location !== 'home');
    this.hud.setBusk(this.media?.canBusk() ?? false);
    if (this.pocketSheet?.isOpen()) this.pocketSheet.refresh(this.pocket, this.location === 'home');
    this.bills = this.engine.bills(this.now());
    if (this.fridgeSheet?.isOpen()) this.fridgeSheet.refresh(this.engine.fridge(this.now()), this.pocket, (i) => this.isFood(i));
    if (this.cookSheet?.isOpen()) this.cookSheet.refresh(this.engine.recipes(this.now()));
    if (this.billsSheet?.isOpen()) this.billsSheet.refresh(this.bills);
    settle(this.walker, this.room, this.engine.catalog);
    settle(this.pet, this.location !== 'home' && this.village ? this.village.routes.dry : this.room, this.engine.catalog);
    this.look = lookFromSettings(this.homeRoom.settings);
    this.petLook = petFromSettings(this.homeRoom.settings);
    this.syncPets();
    if (this.buildersSheet?.isOpen()) this.buildersSheet.refresh(this.engine.builds(this.now()));
    if (this.petsSheet?.isOpen()) this.petsSheet.refresh(this.engine.pets(this.now()), this.petsOnly);
    this.siteWork();
    this.npcCheck = 0;
    this.refreshDaily();
    const shop = this.engine.shop(this.now());
    this.ownedStyles = new Set(shop.filter((e) => e.kind === 'style' && e.status.state === 'owned').map((e) => e.id));
    this.ownedThemes = new Set(shop.filter((e) => e.kind === 'theme' && e.status.state === 'owned').map((e) => e.id));
    this.prices = Object.fromEntries(shop.filter((e) => e.status.state === 'available').map((e) => [e.id, e.status.state === 'available' ? e.status.cost.coins : 0]));
    this.hud.setWallet(this.wallet);
    this.shop.refresh();
    this.pushEdit();
  }

  private describeMissing(m: Missing): string {
    switch (m.type) {
      case 'coins':
        return tr('game.need.count', { need: m.need, have: m.have });
      case 'token':
        return `${t(`token.${m.kind}`)}: ${m.have}/${m.need}`;
      case 'action':
        return `${t(`action.${m.kind}`)}: ${m.have}/${m.need}`;
      case 'item':
        return tr('game.need.item', { item: t(this.engine.catalog.items[m.item]?.name ?? m.item) });
      case 'help':
        return tr('game.need.help', { help: this.engine.catalog.helps?.[m.help]?.title ?? m.help });
      case 'hearts':
        return tr('game.need.friendship', { have: m.have, need: m.need });
      case 'flag':
        return tr('game.need.building');
      case 'lease':
        return tr('game.need.rent');
      case 'day':
        return m.day === 'rift' ? tr('game.need.rift') : tr('game.need.holiday');
      default:
        return tr('game.need.season');
    }
  }

  private reportError(e: EngineError): void {
    if (e.kind === 'locked' && e.missing?.length) {
      this.sound.sfx('error');
      this.toasts.show(this.describeMissing(e.missing[0]), { kind: 'error', icon: 'lock' });
    } else if (e.kind === 'place') {
      this.sound.sfx('error');
      this.toasts.show(t(`place.${String(e.reason)}`), { kind: 'error' });
    } else if (e.kind === 'jailed') {
      this.sound.sfx('error');
      this.toasts.show(tr('game.jail.locked'), { kind: 'error', icon: 'lock', ms: 3600 });
    } else if (e.kind === 'car_broken') {
      this.sound.sfx('error');
      this.toasts.show(tr('game.car.dead'), { kind: 'error', icon: 'taxi', ms: 3600 });
    } else if (e.kind === 'fare_changed') {
      this.toasts.show(tr('game.taxi.fareChanged', { fare: String(e.fare) }), { icon: 'taxi', ms: 3200 });
    } else if (e.kind === 'not_today') {
      this.toasts.show(tr('game.wrongDay'), { kind: 'error', icon: 'clock' });
    } else if (e.kind === 'not_invited') {
      this.sound.sfx('error');
      this.toasts.show(tr('game.noInvite'), { kind: 'error', icon: 'door' });
    } else if (e.kind === 'already_done') {
      this.toasts.show(tr('game.alreadyDone'), { icon: 'check' });
    } else if (e.kind === 'clock_went_backwards') {
      this.toasts.show(t('ui.clock_back'), { kind: 'error' });
    } else if (e.kind === 'no_gift') {
      this.toasts.show(tr('game.freeGift'), { kind: 'error', icon: 'gift' });
    } else if (e.kind === 'utility_off') {
      this.sound.sfx('error');
      const what: Record<string, string> = { water: tr('game.off.water'), power: tr('game.off.power'), gas: tr('game.off.gas'), garbage: tr('game.off.garbage') };
      this.toasts.show(tr('game.off.unpaid', { what: what[String(e.utility)] ?? tr('game.off.any') }), { kind: 'error', icon: 'coin', ms: 4200 });
    } else if (e.kind === 'broken') {
      this.sound.sfx('error');
      this.toasts.show(String(e.words ?? tr('game.broke')), { kind: 'error', icon: 'hammer', ms: 3200 });
    } else if (e.kind === 'fizzled') {
      this.toasts.show(tr('game.craftFailed'), { icon: 'hammer' });
    } else if (e.kind === 'tenant') {
      this.sound.sfx('error');
      this.toasts.show(tr('game.ownersBuild'), { kind: 'error', icon: 'home', ms: 3600 });
    } else if (e.kind === 'needs') {
      const what = String(e.what ?? '');
      const tool = this.engine.catalog.tools?.[what] ? tr('game.needTool', { tool: this.itemName(what).toLowerCase() }) : null;
      this.toasts.show(
        what === 'fridge' ? tr('game.need.fridge') : what === 'stove' ? tr('game.need.stove') : what === 'wardrobe' ? tr('game.need.wardrobe')
          : what === 'workbench' ? tr('game.need.workbench')
          : what === 'master' ? tr('game.need.master')
          : what === 'phone' ? tr('game.need.phone')
          : what === 'pet_food' ? tr('game.need.petFood')
          : what === 'site' ? tr('game.need.site')
          : tool ?? tr('game.need.thing'),
        { kind: 'error', icon: what === 'master' || tool ? 'hammer' : undefined, ms: 3200 },
      );
    } else if (e.kind === 'look_fixed') {
      this.toasts.show(tr('game.dressWhere'), { kind: 'error', icon: 'person' });
    } else if (e.kind === 'not_food') {
      this.toasts.show(tr('game.fridgeFood'), { kind: 'error' });
    } else if (e.kind === 'not_learned') {
      this.toasts.show(tr('game.recipeUnknown'), { kind: 'error', icon: 'lock' });
    } else if (e.kind === 'no_shift') {
      this.toasts.show(tr('game.shiftOver'), { kind: 'error' });
    } else if (e.kind === 'closed') {
      this.toasts.show(tr('game.closedNow'), { kind: 'error', icon: 'clock' });
    } else if (e.kind === 'unknown_quest') {
      this.toasts.show(tr('game.noOneAsks'), { kind: 'error' });
    } else if (e.kind === 'not_owned') {
      this.toasts.show(t('err.not_owned'), { kind: 'error' });
    } else {
      this.toasts.show(e.message || t('err.unknown'), { kind: 'error' });
    }
  }

  private popRewards(result: CommandResult): void {
    if (!result.ok) return;
    if (result.events.some((ev) => ev.kind.type === 'CoinsEarned' || (ev.kind.type === 'Delivered' && Number(ev.kind.coins) > 0))) {
      this.sound.sfx('chime');
      vibrate(this.prefs, 18);
    }
    const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
    let offset = 0;
    for (const ev of result.events) {
      const k = ev.kind;
      if (k.type === 'CoinsEarned') this.toasts.pop(`+${String(k.amount)}`, at.x + offset, at.y, '#f4b860', 'coin');
      else if (k.type === 'Delivered' && Number(k.coins) > 0) this.toasts.pop(`+${String(k.coins)}`, at.x + offset, at.y, '#f4b860', 'coin');
      else continue;
      offset += 34;
    }
  }

  // ---- shop -------------------------------------------------------------------------------------

  private buyItem(id: string): void {
    const result = this.run({ type: 'acquire', item: id });
    if (!result.ok) return;
    const def = this.engine.catalog.items[id];
    this.sound.sfx('buy');
    this.toasts.show(`${t('ui.bought')}: ${def ? t(def.name) : id}`, { kind: 'good', icon: 'check' });
  }

  private chooseStyle(id: string, kind: string, owned: boolean): void {
    if (!owned) {
      const bought = this.run({ type: 'acquire_style', style: id });
      if (!bought.ok) return;
    }
    this.run({ type: 'set_style', kind, style: id });
  }

  private expand(id: string): void {
    const result = this.run({ type: 'expand', expansion: id });
    if (result.ok) this.toasts.show(t('ui.room'), { kind: 'good', icon: 'home' });
  }

  // ---- walking ----------------------------------------------------------------------------------

  private act(): void {
    if (this.mode !== 'walk') return;
    if (this.car) {
      this.stopCar();
      return;
    }
    if (this.overview) {
      this.comeDown();
      return;
    }
    const day = this.dayTarget;
    if (day) {
      if (day.kind === 'spot') this.gather(day.id);
      else this.startFishing(day.id, day.name);
      return;
    }
    const target = this.target;
    if (!target) {
      // out of doors with nothing at hand: sit down right where one stands (or get up again)
      if (this.groundSit) this.groundSit = false;
      else if (this.canSitHere()) {
        this.groundSit = true;
        this.sound.sfx('chime');
      }
      return;
    }
    // the button does what a touch on the thing does: at home too it sits on the chair, lies in the bed or the bath
    if (target.kind === 'item') {
      this.doUse(target.pid, target.action);
    } else {
      if (this.goThrough(target.pid)) return;
      if (this.engine.catalog.front) this.goOut();
      else this.toasts.show(t('ui.door_soon'), { icon: 'door' });
    }
  }

  // ---- living in the room: tap to walk, use things, sit, stroke the cat ------------------------------

  /** What can be done with an item: its actions, plus switching it on or off when it is a light or a device. */
  private optionsFor(pid: number): string[] {
    const p = this.room.placements.find((q) => q.pid === pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (!p || !def) return [];
    // a crack of the rift: through it to the Other Side, or back
    if (p.item === 'rift_crack') return ['rift'];
    if (this.location !== 'home') {
      const out = this.townOptions(p, def);
      // a job of this place: at its own prop first (the counter, the oven, the sorting shelf…), and at its
      // counters and doors too, so whoever comes in finds it
      for (const w of this.engine.works(this.now())) {
        if (w.location !== this.location) continue;
        if (w.prop === p.item) out.unshift(`work:${w.id}`);
        else if (def.tags.includes('door') || this.stationsAt(p.item).length > 0) out.push(`work:${w.id}`);
      }
      return out;
    }
    if (def.tags.includes('plot')) return this.plotOptions(pid);
    // an instrument is played at its sheet (not as a plain action)
    // a bed bought ready-planted is for looking at: what grows at home is sown and gathered on the garden plots
    const out = def.tags.includes('instrument') ? def.actions.filter((a) => a !== 'play_music') : def.actions.filter((a) => a !== 'harvest');
    out.unshift(...this.media.optionsFor(p.item, def.tags, true));
    if (def.tags.includes('easel')) out.unshift('paint');
    if (def.tags.includes('game_table')) out.unshift('games');
    if (def.tags.includes('canvas')) out.unshift('hang_art');
    if (def.tags.includes('fridge')) out.unshift('fridge');
    if (['pet_bowl', 'dragon_nest', 'cat_bed', 'doghouse', 'robot_dock'].includes(p.item)) out.unshift('pets');
    if (def.tags.includes('wardrobe')) out.unshift('dress');
    if (def.tags.includes('stove')) out.unshift('cook');
    if (def.tags.includes('workbench')) out.unshift('craft');
    if (def.tags.includes('computer') && p.item !== 'computer') out.unshift('arcade');
    // something aged: mend it (by hand or by a master)
    if ((this.engine.wear(this.now()).find((w) => w.pid === pid)?.stage ?? 0) > 0) out.push('fix');
    if (def.tags.includes('light') || def.tags.includes('switch')) out.push('toggle');
    return out;
  }

  /** What can be done with a thing of the town (not at home), the jobs of the place aside. */
  private townOptions(p: PlacementView, def: ItemDef): string[] {
    // in the village one can sit down, go home and into the public buildings; the rest belongs to the villagers
    const homes = this.homesAt(p);
    // where one lives: straight in; another home (or a flat in the same block): what it is and what can be done
    if (homes.length > 0) return [...(homes.some((x) => x.current) ? ['home'] : []), ...homes.filter((x) => !x.current).map((x) => `homeinfo:${x.id}`), ...this.stationOptions(p.item)];
    if (p.item === 'water_tower') return this.roomOf(p) ? ['go_in', 'climb'] : ['climb'];
    if (p.item === 'mountain' || p.item === 'fire_lookout' || p.item === 'iron_ladder') return ['climb'];
    if (p.item === 'secret_pc') return ['old_pc'];
    if (this.location === 'townhall_in' && (p.item === 'council_table' || p.item === 'reception_desk')) return ['projects', 'builders', ...this.stationOptions(p.item)];
    if (p.item === 'bill_counter') return ['bills', 'masters', 'builders'];
    if (p.item === 'fox_den') return ['pets'];
    if ((this.location === 'vet_in' && p.item === 'reception_desk') || (this.location === 'post_in' && p.item === 'parcel_shelf' && this.engine.pets(this.now()).here.length)) return ['pets', ...this.stationOptions(p.item)];
    if (this.location === 'clothes_in' && /^(clothes_rack|coat_rack_shop|hat_stand|shoe_shelf|cash_counter)$/.test(p.item)) return ['clothes'];
    if (this.location === 'clothes_in' && /^(fitting_booth|tall_mirror)$/.test(p.item)) return ['dress', 'clothes'];
    if (this.location === 'salon_in' && /^(salon_chair|salon_mirror|cash_counter|salon_sink)$/.test(p.item)) return ['salon'];
    {
      const road = this.roadOptions(p.item);
      if (road) return [...road, ...this.stationOptions(p.item)];
    }
    // a building with a room of its own: a touch takes one in, like every other door in the town
    if (this.roomOf(p)) return ['go_in'];
    const out: string[] = [];
    if (def.tags.includes('game_table')) out.push('games');
    if (p.item === 'flower_shop' || (p.item === 'cash_counter' && this.location === 'flower_in')) out.push('shop');
    if (p.item === 'creamery' || (p.item === 'cash_counter' && this.location === 'creamery_in')) out.push('dairy');
    if (p.item === 'workshop' || p.item === 'workbench') out.push('mend');
    if (p.item === 'workbench' && this.location === 'workshop_in') out.unshift('craft');
    if (p.item === 'pc_desk' || (p.item === 'console' && this.location === 'home')) out.push('arcade');
    if (p.item === 'taxi_sign') out.push('taxi');
    if ((p.item === 'bike_stand' || p.item === 'bike_rack') && this.outdoors()) out.push('bike');
    if (def.tags.includes('door') && this.village?.def.inside) out.push('leave');
    // the things of the town that do something: a counter's wares in its stall, and make, gather, play…
    out.push(...this.stationOptions(p.item));
    if (p.item === 'notice_board') out.unshift('board');
    return [...out, ...def.actions.filter((a) => SIT_ACTIONS.has(a) && seatMode(def, a) !== null)];
  }

  /** A counter's wares as one «Крамничка» (whatever is bought or sold there), the rest of its doings one by one. */
  private stationOptions(item: string): string[] {
    const all = this.stationsAt(item);
    const trade = all.filter((st) => st.kind === 'buy' || st.kind === 'sell');
    return [...(trade.length > 0 ? ['stall'] : []), ...all.filter((st) => !trade.includes(st)).map((st) => `st:${st.id}`)];
  }

  private isOn(pid: number): boolean {
    const p = this.room.placements.find((q) => q.pid === pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (!p || !def) return false;
    const lamp = lampOf(def, p, daylight(lightMinute(this.room.settings, this.debug.minuteOfDay ?? this.now() % 1440)).dark);
    return lamp ? lamp.lit : p.props?.lit === '1';
  }

  private optionLabel(pid: number, option: string): { icon: string; label: string } {
    if (option === 'board') return { icon: 'paper', label: tr('game.opt.board') };
    if (option.startsWith('st:')) {
      const st = this.engine.catalog.stations?.[option.slice(3)];
      return { icon: STATION_ICON[st?.kind ?? ''] ?? 'sparkle', label: st ? st.label + (st.cost > 0 ? ` · ${st.cost}` : '') : option };
    }
    if (option === 'home') return { icon: 'home', label: tr('game.opt.home') };
    if (option === 'rift') return { icon: 'portal', label: isRiftWorld(this.location) ? tr('game.opt.riftBack') : tr('game.opt.riftIn') };
    if (option === 'stall') return { icon: 'bag', label: tr('game.opt.stall') };
    if (option.startsWith('work:')) {
      const live = this.engine.shift(this.now());
      const w = this.engine.catalog.work?.[option.slice(5)];
      if (!this.engine.works(this.now()).find((x) => x.id === option.slice(5))?.hired && live?.work !== option.slice(5)) return { icon: 'hammer', label: tr('game.opt.job') };
      return { icon: 'hammer', label: live && live.work === option.slice(5) ? tr('game.opt.shiftBack') : tr('game.opt.shift', { hours: w ? ` (${w.hours[0]}:00–${w.hours[1]}:00)` : '' }) };
    }
    if (option === 'plant') return { icon: 'harvest', label: tr('game.opt.plant') };
    if (option === 'water') return { icon: 'water_plant', label: tr('game.opt.water') };
    if (option === 'harvest') return { icon: 'harvest', label: tr('game.opt.harvest') };
    if (option === 'clear_plot') return { icon: 'close', label: tr('game.opt.clear') };
    if (option === 'plot_info') {
      const v = this.engine.garden(this.now()).find((x) => x.pid === pid);
      return { icon: 'leaf', label: v?.plant ? `${v.name}: ${v.words}` : tr('game.opt.emptyBed') };
    }
    const media = this.media.label(option);
    if (media) return media;
    if (option === 'paint') return { icon: 'paint', label: tr('game.opt.paint') };
    if (option === 'hang_art') return { icon: 'paint', label: tr('game.opt.hangArt') };
    if (option === 'clothes') return { icon: 'bag', label: tr('game.opt.clothes') };
    if (option === 'dress') return { icon: 'person', label: tr('game.opt.dress') };
    if (option === 'salon') return { icon: 'person', label: tr('game.opt.salon') };
    if (option in ROAD_LABELS) return ROAD_LABELS[option];
    if (option.startsWith('homeinfo:')) {
      const hv = this.engine.homes(this.now()).homes.find((x) => x.id === option.slice(9));
      return { icon: 'home', label: hv ? hv.name : tr('game.opt.housing') };
    }
    if (option === 'fridge') return { icon: 'store', label: tr('game.opt.fridge') };
    if (option === 'builders') return { icon: 'hammer', label: tr('game.opt.builders') };
    if (option === 'pets') {
      const item = this.room.placements.find((q) => q.pid === pid)?.item;
      return { icon: 'heart', label: item === 'fox_den' ? tr('game.opt.foxDen') : this.location === 'vet_in' ? tr('game.opt.shelter') : this.location === 'post_in' ? tr('game.opt.robots') : tr('game.opt.pets') };
    }
    if (option === 'cook') return { icon: 'brew_tea', label: tr('game.opt.cook') };
    if (option === 'bills') return { icon: 'coin', label: tr('game.opt.bills') };
    if (option === 'masters') return { icon: 'hammer', label: tr('game.opt.masters') };
    if (option === 'craft') return { icon: 'hammer', label: tr('game.opt.craft') };
    if (option === 'fix') {
      const w = this.engine.wear(this.now()).find((x) => x.pid === pid);
      return { icon: 'hammer', label: w ? tr('game.opt.fixLooks', { looks: w.looks }) : tr('game.opt.fix') };
    }
    if (option === 'shop') return { icon: 'bag', label: tr('game.opt.flowerShop') };
    if (option === 'dairy') return { icon: 'bag', label: tr('game.opt.dairy') };
    if (option === 'climb') {
      const item = this.room.placements.find((q) => q.pid === pid)?.item;
      return { icon: 'sun', label: item === 'mountain' ? tr('game.opt.mountain') : item === 'fire_lookout' ? tr('game.opt.lookout') : tr('game.opt.tower') };
    }
    if (option === 'arcade') return { icon: 'sparkle', label: tr('game.opt.arcade') };
    if (option === 'games') return { icon: 'sparkle', label: tr('game.opt.games') };
    if (option === 'old_pc') return { icon: 'sparkle', label: tr('game.opt.oldPc') };
    if (option === 'projects') return { icon: 'people', label: tr('game.opt.projects') };
    if (option === 'wash') return { icon: 'water_plant', label: t('action.wash') };
    if (option === 'go_in') {
      // a shut shop's door says so
      const p = this.room.placements.find((q) => q.pid === pid);
      const room = p ? this.roomOf(p) : undefined;
      if (room?.hours && this.engine.locations(this.now()).places[room.id]?.shut) {
        const hour = Math.floor((this.now() % 1440) / 60);
        const inHours = room.hours[0] <= room.hours[1] ? hour >= room.hours[0] && hour < room.hours[1] : hour >= room.hours[0] || hour < room.hours[1];
        return { icon: 'lock', label: inHours && room.days ? tr('game.opt.closedDays') : tr('game.opt.closedTill', { from: room.hours[0] }) };
      }
      return { icon: 'door', label: tr('game.opt.goIn') };
    }
    if (option === 'taxi') return { icon: 'walk', label: tr('game.opt.taxi') };
    if (option === 'bike') return { icon: 'walk', label: this.riding ? tr('game.opt.bikePark') : tr('game.opt.bikeTake') };
    if (option === 'leave') return { icon: 'door', label: tr('game.opt.leave') };
    if (option === 'mend') return { icon: 'hammer', label: tr('game.opt.mend') };
    if (option === 'toggle') return this.isOn(pid) ? { icon: 'power', label: t('ui.turn_off') } : { icon: 'power', label: t('ui.turn_on') };
    if (option === 'enter') return { icon: 'door', label: tr('game.opt.door') };
    return { icon: option, label: t(`action.${option}`) };
  }

  /** Where the player can stand to use an item: around it on the floor, or in front of it on a wall. */
  private standCells(pid: number): [number, number][] {
    const p = this.room.placements.find((q) => q.pid === pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (!p || !def) return [];
    if (def.layer === 'wall' && p.wall) {
      const here = this.regionAt(this.walker.x, this.walker.y);
      const out: [number, number][] = [];
      for (const [x, y, side] of wallEdgesOfItem(def, p.x, p.y, p.wall)) {
        const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
        // stand on this side of a door, so using it takes the player through
        for (const [cx, cy] of [[x, y], [x + dx, y + dy]] as [number, number][]) if (this.regions().of.get(cellKey(cx, cy)) === here) out.push([cx, cy]);
      }
      return out.length > 0 ? out : wallEdgesOfItem(def, p.x, p.y, p.wall).map(([x, y]) => [x, y] as [number, number]);
    }
    if (def.layer === 'surface' && p.on !== null) {
      const host = this.room.placements.find((q) => q.pid === p.on);
      const hd = host ? this.engine.catalog.items[host.item] : undefined;
      if (host && hd) {
        const cells = footprintCells(hd, host.rot);
        return cellsAround(host.x, host.y, Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1);
      }
    }
    const cells = footprintCells(def, p.rot);
    if (def.layer === 'rug') return cells.map(([dx, dy]) => [p.x + dx, p.y + dy] as [number, number]);
    return cellsAround(p.x, p.y, Math.max(...cells.map((c) => c[0])) + 1, Math.max(...cells.map((c) => c[1])) + 1);
  }

  private walkTo(goals: [number, number][], then: { pid: number; action: string } | null = null): void {
    this.seat = null;
    this.then = null;
    const from: [number, number] = [Math.floor(this.walker.x), Math.floor(this.walker.y)];
    const path = findPath(this.room, this.engine.catalog, from, goals);
    if (!path) {
      this.toasts.show(t('ui.cant_reach'), { icon: 'walk' });
      return;
    }
    this.path = path;
    this.pending = then;
    if (path.length === 0) this.arrive();
  }

  private use(pid: number, action: string): void {
    this.bubble.hide();
    // out of a building: through its door, onto the street
    const out = action === 'leave' ? this.village?.def.exits.find((e) => e.to !== this.location) : undefined;
    if (out) {
      const cells: [number, number][] = [];
      for (let x = out.x; x < out.x + out.w; x++) for (let y = out.y; y < out.y + out.h; y++) cells.push([x, y]);
      this.walkTo(cells);
      return;
    }
    const goals = this.standCells(pid);
    const here: [number, number] = [Math.floor(this.walker.x), Math.floor(this.walker.y)];
    if (goals.some(([x, y]) => x === here[0] && y === here[1])) {
      this.path = [];
      this.pending = { pid, action };
      this.arrive();
      return;
    }
    this.walkTo(goals, { pid, action });
  }

  private arrive(): void {
    this.path = null;
    const job = this.pending;
    this.pending = null;
    const then = this.then;
    this.then = null;
    if (job) this.doUse(job.pid, job.action);
    else then?.();
  }

  private doUse(pid: number, action: string): void {
    const p = this.room.placements.find((q) => q.pid === pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (!p || !def) return;
    if (action === 'rift') {
      this.stepRift();
      return;
    }
    if (action === 'board') {
      this.openJournal('asked');
      return;
    }
    if (action === 'games') {
      this.tables.open(p.item, p.x + 0.5, p.y + 0.5, this.tableFigs());
      return;
    }
    if (action.startsWith('work:')) {
      this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      this.jobAction(action.slice(5));
      return;
    }
    if (action === 'stall') {
      this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      this.openStall(p.item);
      return;
    }
    if (action === 'tend') {
      // the bed tells what it needs most: the crop when it is ripe, seeds when it is empty, water when it is dry
      const opts = this.plotOptions(pid);
      const pick = ['harvest', 'plant', 'water', 'clear_plot', 'plot_info'].find((o) => opts.includes(o)) ?? 'plot_info';
      this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      this.tendPlot(pid, pick);
      return;
    }
    if (['plant', 'water', 'harvest', 'clear_plot', 'plot_info'].includes(action) && def.tags.includes('plot')) {
      this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      this.tendPlot(pid, action);
      return;
    }
    if (action.startsWith('watch_from:')) {
      // sat down on the sofa: now the TV
      this.sitOn(p, def, 'sit');
      const then = this.afterSit;
      this.afterSit = null;
      then?.();
      return;
    }
    if (['play', 'watch', 'records', 'stations', 'pc'].includes(action)) {
      if (action === 'play' || action === 'pc') this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      if (this.media.use(pid, p.item, action)) return;
    }
    if (action === 'paint') {
      this.paintSheet.open((title, pixels) => {
        const r = this.run({ type: 'paint', pid, title, pixels });
        if (r.ok) {
          this.sound.sfx('chime');
          this.toasts.show(tr('game.canvasDries', { title }), { icon: 'paint', kind: 'good', ms: 4200 });
        }
      });
      return;
    }
    if (action === 'hang_art') {
      this.chooseArt(pid);
      return;
    }
    if (action.startsWith('st:')) {
      this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
      this.useStation(action.slice(3));
      return;
    }
    this.faceTowards(p.x + def.footprint.w / 2, p.y + def.footprint.d / 2);
    if (this.location !== 'home') {
      // a building with a room of its own is entered; only the house is "home"
      if (action === 'enter' && this.roomOf(p)) this.goIn(p);
      else if (action === 'enter' && p.item === 'water_tower') this.climb(p.item);
      else if (action === 'home' || action === 'enter') this.goHome();
      else if (action === 'go_in') this.goIn(p);
      else if (action === 'old_pc') this.arcade.open(true);
      else if (action === 'clothes') this.wardrobeSheet.open(this.engine.wardrobe(this.now()), 'shop');
      else if (action === 'dress') this.wardrobeSheet.open(this.engine.wardrobe(this.now()), 'wear');
      else if (action === 'salon') {
        const v = this.engine.salon(this.now());
        if (v) this.salonSheet.open(v);
      } else if (action in ROAD_LABELS) this.roadAction(action);
      else if (action.startsWith('homeinfo:')) this.openHome(action.slice(9));
      else if (action === 'projects') this.openProjects();
      else if (action === 'bills') this.openBills();
      else if (action === 'builders') this.openBuilders();
      else if (action === 'pets') this.openPets();
      else if (action === 'masters') this.openMasters();
      else if (action === 'craft') this.openCraft();
      else if (action === 'mend') this.openWorkshop();
      else if (action === 'taxi') this.openTaxi();
      else if (action === 'bike') this.toggleBike();
      else if (action === 'arcade') this.arcade.open();
      else if (action === 'shop') this.openFlowerShop();
      else if (action === 'dairy') this.shop.openStore(tr('game.dairyShop'), ['dairy']);
      else if (action === 'climb' && p.item === 'iron_ladder') this.climbTower();
      else if (action === 'climb') this.climb(p.item);
      else if (SIT_ACTIONS.has(action) && seatMode(def, action)) this.sitOn(p, def, action);
      return;
    }
    if (action === 'dress') {
      this.wardrobeSheet.open(this.engine.wardrobe(this.now()), 'wear');
      return;
    }
    if (action === 'pets') {
      this.openPets();
      return;
    }
    if (action === 'fridge') {
      this.openFridge();
      return;
    }
    if (action === 'cook') {
      this.cookSheet.open(this.engine.recipes(this.now()));
      return;
    }
    if (action === 'craft') {
      this.openCraft();
      return;
    }
    if (action === 'fix') {
      this.offerFix(pid);
      return;
    }
    if (action === 'arcade') {
      this.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
      this.arcade.open();
      return;
    }
    if (action === 'toggle') {
      const on = this.isOn(pid);
      if (this.run({ type: 'set_prop', pid, key: 'lit', value: on ? '0' : '1' }).ok) {
        this.sound.sfx('switch');
        vibrate(this.prefs, 8);
      }
      return;
    }
    if (action === 'enter') {
      if (def.tags.includes('door') && this.goThrough(pid)) return;
      if (def.tags.includes('door') && this.engine.catalog.front) {
        this.goOut();
        return;
      }
      this.target = { kind: 'door', pid, item: p.item, action };
      this.act();
      return;
    }
    const result = this.run({ type: 'perform', action, pid });
    if (!result.ok) return;
    this.popRewards(result);
    if ((action === 'listen' || action === 'play_music') && def.tags.includes('switch')) this.run({ type: 'set_prop', pid, key: 'lit', value: '1' });
    if (SIT_ACTIONS.has(action) && seatMode(def, action)) this.sitOn(p, def, action);
    else if (action === 'wash') {
      // hands under the tap for a little while, water running
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map((c) => c[0])) + 1;
      const d = Math.max(...cells.map((c) => c[1])) + 1;
      this.performing = { until: this.time + 3, sitting: false, wash: { x: p.x + w / 2, y: p.y + d / 2, z: topHeight(def) } };
      this.sound.sfx('pop');
    } else this.performing = { until: this.time + 0.9, sitting: false };
  }

  /**
   * Puts the figure on a seat: sitting on the part nearest to it facing the way the seat faces; resting on a bed
   * or a sofa it lies down along it under the blanket; resting in a bath it lies in the water up to the chin.
   */
  private sitOn(p: PlacementView, def: ItemDef, action = 'sit'): void {
    const mode: SeatMode | null = seatMode(def, action);
    if (!mode) return;
    if (mode !== 'sit') {
      const cells = footprintCells(def, p.rot);
      const w = Math.max(...cells.map((c) => c[0])) + 1;
      const d = Math.max(...cells.map((c) => c[1])) + 1;
      // the long way of the bed (its own y, or x when it is wider than long), turned with it: head to feet
      const local: [number, number] = def.footprint.d >= def.footprint.w ? [0, 1] : [1, 0];
      const turn = (v: [number, number], r: number): [number, number] => (r === 0 ? v : turn([-v[1], v[0]], r - 1));
      const axis = turn(local, p.rot & 3);
      const soft = def.model.filter((m) => ['cushion', 'sheet', 'blanket', 'body', 'seat', 'mattress', 'water'].includes(m.slot) && m.box[2] + m.box[5] <= 70);
      const top = mode === 'bath' ? 18 : soft.length > 0 ? Math.max(...soft.map((m) => m.box[2] + m.box[5])) : Math.min(50, topHeight(def));
      this.seat = { pid: p.pid, x: p.x + w / 2, y: p.y + d / 2, lift: top * Z_PER_CENTI - 6, front: [0, 1], mode, axis };
      this.dir = 'down';
      this.performing = null;
      this.sound.at(mode === 'bath' ? 'splash' : 'rustle', 0.6, 0);
      return;
    }
    // the place on it nearest to where the hero stands, as high as its seat, facing away from its back
    const spots = seatSpotsOf(def, p).sort((a, b) => Math.hypot(a.x - this.walker.x, a.y - this.walker.y) - Math.hypot(b.x - this.walker.x, b.y - this.walker.y));
    const spot = spots[0];
    if (!spot) return;
    const front = spot.front;
    const [rx, ry] = rotXY(this.view, front[0], front[1]);
    this.seat = { pid: p.pid, x: spot.x, y: spot.y, lift: spot.top * Z_PER_CENTI - 6, front, mode: 'sit', axis: [0, 1] };
    this.dir = dirOf(rx - ry, (rx + ry) / 2, this.dir);
    this.performing = null;
  }

  private faceTowards(x: number, y: number): void {
    const [ax, ay] = rotXY(this.view, x - this.walker.x, y - this.walker.y);
    this.dir = dirOf(ax - ay, (ax + ay) / 2, this.dir);
  }

  // ---- building on to the house, the animals at home (builds.rs, pets.rs) --------------------------------------

  private openBuilders(): void {
    this.buildersSheet.open(this.engine.builds(this.now()));
  }

  /** An order to the builders: the site goes where a room of that size fits along the house. */
  private orderBuild(o: BuildOffer): boolean {
    const home = this.homeRoom;
    const outdoorAt = (x: number, y: number) => {
      const painted = home.floor_paint[cellKey(x, y)];
      return !!painted && this.engine.catalog.styles[painted]?.params.outdoor === '1';
    };
    const open = o.kind === 'garden' || o.kind === 'terrace' || o.kind === 'farm';
    const spot = findSpot(home.cells, o.w, o.d, (x, y) => (open ? (outdoorAt(x, y) ? 2 : -1) : outdoorAt(x, y) ? -2 : 0));
    if (!spot) {
      this.toasts.show(tr('game.build.noRoom'), { kind: 'error', icon: 'home' });
      return false;
    }
    const r = this.run({ type: 'order_build', build: o.id, x: spot.x, y: spot.y });
    if (!r.ok) return false;
    this.sound.sfx('chime');
    this.toasts.show(tr('game.build.start', { what: o.name.toLowerCase() }), { kind: 'good', icon: 'hammer', ms: 4200 });
    return true;
  }

  /** At home: the site fenced off next to the house (walled off from the rest), and the keys of a finished room. */
  private siteWork(): void {
    if (this.siteBusy || this.location !== 'home' || this.mode === 'edit' || !this.engine.catalog.builds) return;
    const orders = this.engine.builds(this.now()).orders.filter((o) => !o.done);
    if (!orders.length) return;
    this.siteBusy = true;
    let changed = false;
    try {
      for (const o of orders) {
        const rect = rectCells(o);
        const house = new Set(this.room.cells.map(([x, y]) => cellKey(x, y)));
        const missing = rect.filter(([x, y]) => !house.has(cellKey(x, y)));
        if (missing.length && this.engine.command({ type: 'paint_cells', add: missing, remove: [] }, this.now()).ok) {
          for (const [x, y, side] of sharedEdges(rect, house)) this.engine.command({ type: 'set_divider', x, y, side, on: true }, this.now());
          changed = true;
        }
        if (o.due) changed = this.handOver(o) || changed;
      }
    } finally {
      this.siteBusy = false;
    }
    if (changed) {
      this.history.clear();
      this.persist();
      this.refresh();
    }
  }

  /** The keys: the doorway opened (a door, a garden door or the stairs), floor and walls done, the room furnished. */
  private handOver(o: BuildOrderView): boolean {
    if (!this.run({ type: 'finish_build', n: o.n }).ok) return false;
    const rect = rectCells(o);
    const inRect = new Set(rect.map(([x, y]) => cellKey(x, y)));
    const house = new Set(this.room.cells.map(([x, y]) => cellKey(x, y)).filter((k) => !inRect.has(k)));
    const door = doorwayOf({ x: o.x, y: o.y, w: o.w, d: o.d, shared: sharedEdges(rect, house) });
    const doorItem = o.items.find((i) => i === 'stairs_up' || i === 'door_garden' || i === 'door_basic') ?? 'door_basic';
    const outdoor = !!o.floor && this.engine.catalog.styles[o.floor]?.params.outdoor === '1';
    if (o.floor && this.ownedStyles.has(o.floor)) this.run({ type: 'paint_floor', cells: rect, style: o.floor });
    if (o.wall && !outdoor && this.ownedStyles.has(o.wall)) this.run({ type: 'paint_wall', edges: outerEdges(rect), style: o.wall });
    const keep = new Set<string>();
    if (door) {
      if (this.placeGift(doorItem, door[0], door[1], 0, door[2], null) === null) this.run({ type: 'set_divider', x: door[0], y: door[1], side: door[2], on: false });
      const [dx, dy] = door[2] === 'east' ? [1, 0] : door[2] === 'west' ? [-1, 0] : door[2] === 'south' ? [0, 1] : [0, -1];
      for (const [cx, cy] of [[door[0], door[1]], [door[0] + dx, door[1] + dy]]) for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keep.add(cellKey(cx + ox, cy + oy));
    }
    const placed = o.plan ? this.furnishByPlan({ x: o.x, y: o.y, w: o.w, d: o.d, door }, PLANS[o.plan], keep) : [];
    const inside = rect[Math.floor(rect.length / 2) + Math.floor(o.w / 2)] ?? rect[0];
    while (placed.length > 0 && !this.reachable(inside)) {
      const pid = placed.pop();
      if (pid !== undefined) this.run({ type: 'store', pid });
    }
    this.sound.sfx('chime');
    this.toasts.show(tr('game.build.done', { what: o.name.toLowerCase() }), { kind: 'good', icon: 'home', ms: 4600 });
    return true;
  }

  /** The site as drawn: dug earth or bare walls, the scaffolding and the bricks (not part of the room). */
  private withSite(view: RoomView): RoomView {
    if (!this.engine.catalog.builds) return view;
    const orders = this.engine.builds(this.now()).orders.filter((o) => !o.done && !o.due);
    if (!orders.length) return view;
    const shown = new Set(view.cells.map(([x, y]) => cellKey(x, y)));
    const props: PlacementView[] = [];
    const floor: Record<string, string> = { ...view.floor_paint };
    for (const o of orders) {
      const rect = rectCells(o).filter(([x, y]) => shown.has(cellKey(x, y)));
      if (!rect.length) continue;
      for (const [x, y] of rect) floor[cellKey(x, y)] = o.stage === 0 ? 'floor.dirt' : 'floor.slate';
      props.push(...siteProps(o, (item) => !!this.engine.catalog.items[item]));
    }
    return props.length || Object.keys(floor).length !== Object.keys(view.floor_paint).length ? { ...view, floor_paint: floor, placements: [...view.placements, ...props] } : view;
  }

  /** The crew at work on the site shown. */
  private siteCrew(): NpcFigure[] {
    if (this.location !== 'home' || !this.engine.catalog.builds) return [];
    const minute = this.debug.minuteOfDay ?? this.now() % 1440;
    const shown = new Set(this.shownRoom().cells.map(([x, y]) => cellKey(x, y)));
    return this.engine
      .builds(this.now())
      .orders.filter((o) => !o.done && shown.has(cellKey(o.x + 1, o.y + 1)))
      .flatMap((o) => siteWorkers(o, minute, this.time));
  }

  /** The animals of the house: who lives here besides the one walking with the player. */
  private syncPets(): void {
    if (!this.engine.catalog.pets) return;
    const v = this.engine.pets(this.now());
    this.petsNow = v;
    const chosen = petFromSettings(this.homeRoom.settings);
    const companion = v.companion ? v.owned.find((p) => p.id === v.companion) : undefined;
    if (companion) this.petLook = petLookOf(companion.kind, chosen);
    const want = v.owned.filter((p) => p.id !== v.companion).map((p) => ({ id: p.id, look: petLookOf(p.kind, chosen) }));
    if (companion && chosen.kind !== 3) want.push({ id: 'first', look: chosen });
    const old = new Map(this.housePets.map((p) => [p.id, p]));
    this.housePets = want.map((w) => {
      const p = old.get(w.id) ?? newHousePet(w.id, w.look, this.homeSpawn());
      p.look = w.look;
      return p;
    });
  }

  /** A free cell of the house for an animal to appear on. */
  private homeSpawn(): { x: number; y: number } {
    const grid = gridOf(this.homeRoom, this.engine.catalog);
    const free = this.homeRoom.cells.filter(([x, y]) => !grid.blocked.has(cellKey(x, y)) && !grid.blocked.has(cellKey(x + 1, y)));
    const pick = free[Math.floor(Math.random() * free.length)] ?? [3, 3];
    return { x: pick[0] + 0.5, y: pick[1] + 0.5 };
  }

  private stepHousePets(dt: number): void {
    if (this.mode !== 'walk' || !this.housePets.length) return;
    for (const hp of this.housePets) {
      const [ax, ay] = rotXY(this.view, hp.x, hp.y);
      stepHousePet(hp, dt, { room: this.room, catalog: this.engine.catalog, time: this.time, player: this.walker, view: this.petsNow?.owned.find((o) => o.id === hp.id), near: () => true, random: Math.random });
      const [bx, by] = rotXY(this.view, hp.x, hp.y);
      const sx = bx - by - (ax - ay);
      if (Math.abs(sx) > 1e-4) hp.dir = sx > 0 ? 'right' : 'left';
    }
  }

  private housePetSprites(): NonNullable<Frame['pets']> {
    if (this.location !== 'home' || this.mode === 'edit') return [];
    const multi = this.regions().list.length > 1;
    const here = this.currentRegion();
    return this.housePets
      .filter((p) => !multi || this.regionAt(p.x, p.y) === here)
      .map((p) => ({ x: p.x, y: p.y, lift: 0, layers: petLayers(p.look, p.dir, p.pose, Math.floor(this.time * (p.look.kind === 4 ? 2 : p.pose === 'sleep' ? 1.5 : 6)), p.carry) }));
  }

  private tapHousePet(hp: HousePet): void {
    const at = this.renderer.toScreen(hp.x, hp.y, 30);
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ff7aa8', 'heart'), i * 140);
    this.sound.sfx(hp.look.kind === 6 ? 'chime' : 'purr');
    vibrate(this.prefs, [10, 40, 10]);
    hp.doing = 'play';
    hp.path = [];
    hp.until = this.time + 2.5;
    if (hp.id !== 'first') this.openPets(hp.id);
  }

  private openPets(only: string | null = null): void {
    this.petsOnly = only;
    const v = this.engine.pets(this.now());
    const title = only ? (v.owned.find((p) => p.id === only)?.name ?? tr('game.opt.pets')) : this.location === 'vet_in' ? tr('game.opt.shelter') : this.location === 'forest' ? tr('game.opt.foxDen') : this.location === 'post_in' ? tr('game.pets.techno') : tr('game.opt.pets');
    this.petsSheet.open(v, title, only);
  }

  private adopt(o: PetOffer): void {
    const r = this.run({ type: 'adopt', pet: o.id });
    if (!r.ok) return;
    const kinds = r.events.map((e) => e.kind.type);
    if (kinds.includes('FoxFed')) this.toasts.show(tr('game.pets.foxFed'), { icon: 'heart', ms: 4600 });
    else if (kinds.includes('EggNested')) this.toasts.show(tr('game.pets.egg'), { icon: 'heart', ms: 4600 });
    else {
      this.sound.sfx('chime');
      this.toasts.show(o.id === 'dragon' ? tr('game.pets.dragon') : o.id === 'fox' ? tr('game.pets.fox') : tr('game.pets.together', { name: o.name }), { kind: 'good', icon: 'heart', ms: 4200 });
      this.petsSheet.close();
    }
  }

  private petCare(pet: string, what: string): void {
    if (!this.run({ type: 'pet_care', pet, what }).ok) return;
    const lines: Record<string, string> = {
      feed: tr('game.care.feed'),
      play: tr('game.care.play'),
      stroke: tr('game.care.stroke'),
      charge: tr('game.care.charge'),
      fix: tr('game.care.fix'),
    };
    this.toasts.show(lines[what] ?? '', { icon: 'heart', ms: 2400 });
    const hp = this.housePets.find((p) => p.id === pet);
    if (hp) {
      hp.doing = what === 'feed' || what === 'charge' ? 'eat' : 'play';
      hp.path = [];
      hp.until = this.time + 4;
    }
  }

  private setCompanion(pet: string | null): void {
    if (!this.run({ type: 'companion', pet }).ok) return;
    this.pet.x = this.walker.x;
    this.pet.y = this.walker.y;
    this.toasts.show(pet ? tr('game.pets.walkTogether') : tr('game.pets.firstBack'), { icon: 'heart', ms: 2600 });
  }

  /** Out in town the walking animal is noticed: someone near stops and says something about it. */
  private petNoticed(): void {
    if (this.petAway()) return;
    if (this.location === 'home' || this.petLook.kind === 3 || this.time < this.petNoticeAt) return;
    this.petNoticeAt = this.time + 9;
    const near = [...this.resPoses].find(([id, p]) => Math.hypot(p.x - this.pet.x, p.y - this.pet.y) < 2.6 && (this.saying.get(id)?.until ?? 0) <= this.time);
    if (!near) return;
    const lines: Record<number, string[]> = {
      0: [tr('game.petSeen.0'), tr('game.petSeen.1')],
      1: [tr('game.petSeen.2'), tr('game.petSeen.3')],
      2: [tr('game.petSeen.4')],
      4: [tr('game.petSeen.5'), tr('game.petSeen.6')],
      5: [tr('game.petSeen.7'), tr('game.petSeen.8')],
      6: [tr('game.petSeen.9'), tr('game.petSeen.10')],
      7: [tr('game.petSeen.11'), tr('game.petSeen.12')],
    };
    const options = lines[this.petLook.kind] ?? [tr('game.petSeen.13')];
    this.saying.set(near[0], { text: options[Math.floor(this.time) % options.length], until: this.time + 3.5 });
  }

  private strokeCat(): void {
    const at = this.renderer.toScreen(this.pet.x, this.pet.y, 30);
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ff7aa8', 'heart'), i * 140);
    this.sound.sfx('purr');
    vibrate(this.prefs, [10, 40, 10]);
    this.pet.idle = 0;
    this.pet.pose = 'sit';
  }

  private walkTap(p: { x: number; y: number }): void {
    this.bubble.hide();
    if (this.overview) {
      this.comeDown();
      return;
    }
    const pick = this.renderer.pick(p.x, p.y);
    if (this.location === 'home') {
      const region = this.regions().list.length > 1 ? this.currentRegion() : -1;
      for (const hp of this.housePets) {
        if (region >= 0 && this.regionAt(hp.x, hp.y) !== region) continue;
        const at = this.renderer.toScreen(hp.x, hp.y, 14);
        if (!(pick?.kind === 'item' && pick.exact) && Math.hypot(p.x - at.x, p.y - at.y) < 18) {
          this.tapHousePet(hp);
          return;
        }
      }
    }
    const petAt = this.renderer.toScreen(this.pet.x, this.pet.y, 14);
    if (this.petLook.kind !== 3 && !(pick?.kind === 'item' && pick.exact) && Math.hypot(p.x - petAt.x, p.y - petAt.y) < 18) {
      this.strokeCat();
      return;
    }
    if (!pick) return;
    if (pick.kind === 'npc' && (pick.id.startsWith('being:') || pick.id.startsWith('nm:'))) {
      const line = this.wonders.says(pick.id, Math.floor(this.now() / 1440));
      if (line) {
        this.sound.at('whisper', 0.5, 0);
        this.toasts.show(line, { icon: 'portal', ms: 3400 });
      }
      return;
    }
    if (pick.kind === 'npc') {
      this.talkWith = { id: pick.id, at: this.time, pose: null };
      if (pick.id.startsWith('town:')) {
        this.townFigureTapped(pick.id);
        return;
      }
      // a birthday today: a wish, maybe a gift
      if (this.townNow().today.birthdays.some((b) => b.id === pick.id)) {
        this.openBirthday(pick.id);
        return;
      }
      // someone with something to ask of you, or someone you promised to see: they say it
      if (this.questWith(pick.id)) return;
      const help = this.helpOf(pick.id);
      // the town's people with a task for the player say so; the story people still talk, the help is one more choice
      if (help && this.engine.catalog.residents?.[pick.id]) {
        this.openHelp(help);
        return;
      }
      if (this.engine.catalog.residents?.[pick.id]) this.residentSays(pick.id);
      else this.approach(pick.id, p);
      return;
    }
    if (pick.kind === 'item') {
      if (pick.pid <= PLANT_PID) pick.pid = PLANT_PID - pick.pid;
      const options = this.optionsFor(pick.pid);
      if (options.length === 1) {
        this.use(pick.pid, options[0]);
        return;
      }
      if (options.length > 1) {
        this.menuPid = pick.pid;
        this.bubble.show(
          `use:${pick.pid}`,
          p.x,
          p.y - 6,
          options.map((o, i) => ({ ...this.optionLabel(pick.pid, o), primary: i === 0, run: () => this.use(pick.pid, o) })),
        );
        return;
      }
      this.walkTo(this.standCells(pick.pid));
      return;
    }
    if (pick.kind === 'floor') {
      // a twinkling spot: go there and gather
      const spot = this.village?.def.spots?.find((s) => Math.abs(s.x - pick.x) <= 1 && Math.abs(s.y - pick.y) <= 1 && !this.daily?.gathered_today.includes(s.id));
      if (spot && this.location !== 'home') {
        if (Math.hypot(spot.x + 0.5 - this.walker.x, spot.y + 0.5 - this.walker.y) < 1.2) {
          this.gather(spot.id);
          return;
        }
        this.walkTo([[spot.x, spot.y]]);
        if (this.path) this.then = () => this.gather(spot.id);
        return;
      }
      this.walkTo([[pick.x, pick.y]]);
    }
  }

  /** Follows the tapped path; returns whether the figure moved. */
  private followPath(dt: number): boolean {
    if (!this.path) return false;
    if (this.path.length === 0) {
      this.arrive();
      return false;
    }
    const [tx, ty] = this.path[0];
    const dx = tx - this.walker.x;
    const dy = ty - this.walker.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * 0.85 * dt * (this.swimming() ? 0.6 : 1) * walkFactor(this.comfortNow);
    // (a path keeps to what can be walked up; a cliff in the way ends it)
    if (this.room.terrain && (this.room.terrain[cellKey(Math.floor(tx), Math.floor(ty))] ?? 0) - groundAt(this.room, this.engine.catalog, this.walker.x, this.walker.y) > STEP + 3 && !this.hop) {
      this.path = null;
      return false;
    }
    if (dist <= step) {
      this.walker.x = tx;
      this.walker.y = ty;
      this.path.shift();
      if (this.path.length === 0) this.arrive();
    } else {
      this.walker.x += (dx / dist) * step;
      this.walker.y += (dy / dist) * step;
    }
    const [rx, ry] = rotXY(this.view, dx, dy);
    this.dir = dirOf(rx - ry, (rx + ry) / 2, this.dir);
    return true;
  }

  openSettings(): void {
    this.settings.open();
  }

  /** A row of its own in the settings (the backup: main.ts). */
  settingsAction(label: string, run: () => void): void {
    this.settings.addAction(label, run);
  }

  /**
   * Asks twice before everything on this device is let go of (the worlds, the data key, the settings),
   * offering a copy first. `erase` runs on the second yes.
   */
  askErase(erase: () => void | Promise<void>, backup: () => void): void {
    this.ask.open({
      who: tr('account.erase'),
      title: tr('account.eraseTitle'),
      text: tr('account.eraseText'),
      lines: [{ text: tr('account.eraseWorlds') }, { text: tr('account.eraseDevice') }],
      choices: [
        { label: tr('account.backupFirst'), primary: true, run: () => { this.ask.close(); backup(); } },
        { label: tr('account.eraseGo'), run: () => this.ask.open({
          who: tr('account.erase'),
          title: tr('account.sureTitle'),
          text: tr('account.sureText'),
          choices: [
            { label: tr('account.sureNo'), primary: true, run: () => this.ask.close() },
            { label: tr('account.sureYes'), run: () => { this.ask.close(); this.toasts.show(tr('account.erasing'), { icon: 'close', ms: 4000 }); void erase(); } },
          ],
        }) },
        { label: tr('account.notNow'), run: () => this.ask.close() },
      ],
    });
  }

  /** Closes the settings (a sheet opened from them takes their place). */
  closeSettings(): void {
    this.settings.close();
  }

  /** Saves everything still waiting and resolves when it is written. */
  async saveNow(): Promise<void> {
    this.persist();
    await this.saving;
  }

  /** The goodbye screen, over a saved world. */
  exit(): void {
    this.settings.close();
    this.sound.hush(true);
    this.goodbye.open(this.saveNow());
  }

  /** The phone's back button: closes what is open, and with nothing open says goodbye (twice: closes the app). */
  back(): void {
    if (this.goodbye.isOpen()) {
      if (canExit()) void exitApp();
      return;
    }
    if (this.settings.isOpen()) {
      this.settings.close();
      return;
    }
    if (this.albumSheet.isOpen()) {
      this.albumSheet.close();
      return;
    }
    if (this.photoBar.isOpen()) {
      this.leavePhoto();
      return;
    }
    for (const sheet of [this.ask, this.journal, this.paperSheet, this.pocketSheet, this.fridgeSheet, this.cookSheet, this.billsSheet, this.paintSheet, ...this.media.sheets(), this.workSheet, this.stallSheet, this.wardrobeSheet, this.salonSheet, this.mapsSheet, this.paperMap, this.carsSheet, this.meSheet, this.letter, this.planSheet]) {
      if (sheet.isOpen()) {
        sheet.close();
        return;
      }
    }
    const open = this.arcade.isOpen() || this.taxi.isOpen() || this.mending.isOpen() || this.fishing.isOpen() || this.todayPanel.isOpen() || this.dialogue.isOpen() || this.gifts.isOpen() || this.people.isOpen() || this.shop.isOpen() || this.mode === 'edit';
    if (!open) {
      this.exit();
      return;
    }
    if (this.arcade.isOpen()) this.arcade.close();
    else this.onKey(new KeyboardEvent('keydown', { code: 'Escape' }));
  }

  private onKey(e: KeyboardEvent): void {
    const keys = this.prefs.keys;
    if (this.goodbye.isOpen() || !this.started) return;
    if (this.albumSheet.isOpen() || this.photoBar.isOpen()) {
      if (e.code === 'Escape') this.back();
      // in photo mode the arrows turn the view, nothing walks
      else if (this.photoBar.isOpen() && (e.code === 'BracketLeft' || e.code === 'BracketRight' || e.code === 'KeyQ' || e.code === 'KeyE')) this.rotateView(e.code === 'BracketLeft' || e.code === 'KeyQ' ? -1 : 1);
      return;
    }
    for (const sheet of [this.ask, this.journal, this.paperSheet, this.pocketSheet, this.fridgeSheet, this.cookSheet, this.billsSheet, this.paintSheet, ...this.media.sheets(), this.workSheet, this.stallSheet, this.wardrobeSheet, this.salonSheet, this.mapsSheet, this.paperMap, this.carsSheet, this.meSheet, this.letter, this.planSheet]) {
      if (sheet.isOpen()) {
        if (e.code === 'Escape') sheet.close();
        return;
      }
    }
    // an open overlay gets the keys first
    if (this.arcade.isOpen()) {
      this.arcade.key(e);
      return;
    }
    if (this.taxi.isOpen()) {
      if (e.code === 'Escape') this.taxi.close();
      return;
    }
    if (this.paperMap.isOpen()) {
      if (e.code === 'Escape' || e.code === 'KeyM') this.paperMap.close();
      return;
    }
    if (this.mending.isOpen()) {
      if (e.code === 'Escape') this.mending.close();
      return;
    }
    if (this.fishing.isOpen()) {
      if (e.code === 'Escape') this.fishing.stop();
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.fishing.pull();
      }
      return;
    }
    if (this.todayPanel.isOpen()) {
      if (e.code === 'Escape') this.todayPanel.close();
      return;
    }
    if (this.dialogue.isOpen() || this.gifts.isOpen() || this.people.isOpen()) {
      if (e.code === 'Escape') {
        this.gifts.close();
        this.people.close();
        this.dialogue.close();
      }
      return;
    }
    if (e.code === 'Escape') {
      if (this.shop.isOpen()) this.shop.close();
      else if (this.mode === 'edit') this.exitEdit();
    } else if (/^(Digit|Numpad)[1-8]$/.test(e.code) && e.altKey && this.mode === 'walk' && !this.shop.isOpen()) {
      // the place's buttons by Alt and their numbers
      if (this.hud.pressPlace(Number(e.code.slice(-1)) - 1)) e.preventDefault();
    } else if (/^(Digit|Numpad)[1-9]$/.test(e.code) && this.mode === 'walk' && !this.shop.isOpen()) {
      // the places at hand by their numbers, as in Minecraft
      e.preventDefault();
      this.chooseSlot(Number(e.code.slice(-1)) - 1);
    } else if (e.code === 'KeyI' && this.mode === 'walk') {
      e.preventDefault();
      this.openPocket();
    } else if (e.code === keys.swap && this.mode === 'walk' && !this.shop.isOpen()) {
      e.preventDefault();
      if (!e.repeat) this.swapHands();
    } else if (e.code === keys.map && this.mode === 'walk') {
      this.openMap();
    } else if (e.code === 'F11') {
      e.preventDefault();
      this.applyPrefs({ ...this.prefs, fullscreen: !this.prefs.fullscreen });
    } else if (e.code === 'BracketLeft' || e.code === keys.turnLeft) {
      // the world turns a quarter (Q to the left, E to the right, or one's own keys, or the brackets); held, once
      if (!e.repeat) this.rotateView(-1);
    } else if (e.code === 'BracketRight' || e.code === keys.turnRight) {
      if (!e.repeat) this.rotateView(1);
    } else if (e.code === keys.jump && this.mode === 'walk' && !this.shop.isOpen()) {
      e.preventDefault();
      if (!e.repeat) this.jump();
    } else if ((e.code === keys.act || e.code === 'Enter') && this.mode === 'walk' && !this.shop.isOpen()) {
      e.preventDefault();
      this.act();
    }
  }

  private previewTheme(room: RoomView, id: string): RoomView {
    const th = this.engine.catalog.themes[id];
    if (!th) return room;
    const styles = { ...room.styles, ...th.styles };
    const params = { ...room.style_params };
    for (const [kind, sid] of Object.entries(th.styles)) params[kind] = this.engine.catalog.styles[sid]?.params ?? {};
    return { ...room, styles, style_params: params, settings: { ...room.settings, ...th.settings } };
  }

  /** The map: on a computer the maps with their search and side panel, on a phone the folded paper one. */
  private openMap(): void {
    if (usesMouse()) this.mapsSheet.open();
    else this.paperMap.open();
  }

  private applyPrefs(p: Prefs, save = true): void {
    // the whole screen follows the choice (at start only in the desktop app: a browser wants a click first)
    if (p.fullscreen !== this.prefs?.fullscreen || (!save && isDesktop() && p.fullscreen)) void setFullscreen(p.fullscreen);
    this.prefs = p;
    if (save) savePrefs(p);
    this.sound.setPrefs(p);
    applyA11y(p);
    const cl = this.rootEl.classList;
    const mouse = usesMouse();
    cl.toggle('stick-right', p.stick === 'right' && !mouse);
    cl.toggle('mouse', mouse);
    cl.toggle('key-hints', mouse && p.keyHints);
    this.hud?.setKeys(keyName(p.keys.act), keyName(p.keys.jump), keyName(p.keys.crouch));
    this.settings?.sync(p);
    cl.toggle('hud-small', p.hudSize === 0);
    cl.toggle('hud-large', p.hudSize === 2);
    // (only a new choice of quality starts the ladder afresh: a sound slider moved leaves it where it stands)
    if (p.quality !== this.ladderFor) {
      this.ladderFor = p.quality;
      this.ladder = new QualityLadder(p.quality === 'low' ? 2 : p.quality === 'high' ? 0 : weakDevice());
      // the first seconds load the town and draw its pictures: not a measure of the device
      this.ladder.hold(performance.now(), 5000);
      this.setLevel(this.ladder.level);
    }
  }

  /** Turn the view a quarter turn; the picture cross-fades into the new angle. */
  rotateView(dir: 1 | -1): void {
    this.renderer.startFade(260, performance.now());
    this.fade = 0.3;
    this.sound.sfx('turn');
    this.view = ((this.view + dir + 4) % 4) as View;
  }

  zoomBy(factor: number): void {
    this.zoom = clampZoom(this.zoom * factor);
    // zooming out pulls a dragged picture back in
    this.pan = this.clampPan(this.pan);
  }

  // ---- history ----------------------------------------------------------------------------------

  private placeItem(cmd: Extract<Command, { type: 'place' }>): CommandResult {
    const r = this.history.place(cmd);
    if (r.ok) {
      this.sound.sfx('place');
      vibrate(this.prefs, 12);
    }
    return r;
  }

  private storeItem(pid: number): CommandResult {
    const p = this.room.placements.find((q) => q.pid === pid);
    if (!p) return this.run({ type: 'store', pid });
    const defaults = Object.fromEntries(Object.entries(this.engine.catalog.items[p.item]?.slots ?? {}).map(([k, v]) => [k, v.default]));
    return this.history.store(p, defaults);
  }

  // ---- editing ----------------------------------------------------------------------------------

  private enterEdit(): void {
    if (this.location !== 'home') {
      this.toasts.show(tr('game.homeOnly'), { icon: 'home' });
      return;
    }
    this.bubble.hide();
    this.toasts.clear();
    this.path = null;
    this.pending = null;
    this.seat = null;
    this.mode = 'edit';
    this.hud.setMode('edit');
    this.edit.show(true);
    this.shop.close();
    this.target = null;
    this.pushEdit();
  }

  private exitEdit(): void {
    this.bubble.hide();
    this.viewRegion = null;
    this.mode = 'walk';
    this.held = null;
    this.selectedPid = null;
    this.hover = null;
    this.drag = null;
    this.hud.setMode('walk');
    this.edit.show(false);
    this.pushEdit();
  }

  private setStudioMode(mode: StudioMode): void {
    this.studioMode = mode;
    this.held = null;
    this.selectedPid = null;
    this.drag = null;
    this.pushEdit();
  }

  private pushEdit(): void {
    // the studio is hidden outside the editor: it is brought up to date when the editor opens (enterEdit)
    if (this.mode !== 'edit') return;
    const selected = this.selectedPid === null ? null : (this.room.placements.find((p) => p.pid === this.selectedPid) ?? null);
    if (this.selectedPid !== null && !selected) this.selectedPid = null;
    this.edit.update({
      mode: this.studioMode,
      held: this.held,
      selected,
      inventory: this.inventory,
      room: this.room,
      shapeTool: this.shapeTool,
      paintTarget: this.paintTarget,
      paintStyle: this.paintStyle,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      ownedStyles: this.ownedStyles,
      ownedThemes: this.ownedThemes,
      prices: this.prices,
    });
  }

  private pickFromInventory(item: string): void {
    if (this.location !== 'home') {
      this.shop.close();
      this.toasts.show(tr('game.homeOnly'), { icon: 'home' });
      return;
    }
    if (this.held?.item === item) {
      this.held = null;
    } else {
      this.held = { item, rot: 0 };
      this.selectedPid = null;
    }
    this.shop.close();
    if (this.mode !== 'edit') this.enterEdit();
    this.studioMode = 'items';
    this.pushEdit();
  }

  private rotate(): void {
    if (this.held) {
      this.held = { ...this.held, rot: (this.held.rot + 1) % 4 };
    } else if (this.selectedPid !== null) {
      const p = this.room.placements.find((q) => q.pid === this.selectedPid);
      if (p) this.history.commit({ type: 'rotate', pid: p.pid, rot: (p.rot + 1) % 4 }, [{ type: 'rotate', pid: p.pid, rot: p.rot }]);
    }
  }

  private storeSelected(): void {
    if (this.selectedPid === null) return;
    const result = this.storeItem(this.selectedPid);
    if (result.ok) this.selectedPid = null;
    this.pushEdit();
  }

  private duplicateSelected(): void {
    const p = this.room.placements.find((q) => q.pid === this.selectedPid);
    if (!p) return;
    const free = this.inventory.find((i) => i.item === p.item)?.free ?? 0;
    if (free === 0 && !this.run({ type: 'acquire', item: p.item }).ok) return;
    this.held = { item: p.item, rot: p.rot };
    this.selectedPid = null;
    this.pushEdit();
  }

  private setProp(pid: number, key: string, value: string): void {
    const p = this.room.placements.find((q) => q.pid === pid);
    this.history.commit({ type: 'set_prop', pid, key, value }, [{ type: 'set_prop', pid, key, value: p?.props?.[key] ?? '' }]);
  }

  private recolor(pid: number, slot: string, color: string): void {
    const p = this.room.placements.find((q) => q.pid === pid);
    const before = p?.colors[slot];
    if (before === color) return;
    this.history.commit({ type: 'recolor', pid, slot, color }, before ? [{ type: 'recolor', pid, slot, color: before }] : []);
  }

  private setSetting(key: string, value: string): void {
    const before = this.room.settings[key] ?? SETTING_DEFAULTS[key] ?? '';
    this.history.commit({ type: 'set_setting', key, value }, [{ type: 'set_setting', key, value: before }]);
  }

  // ---- the name, quiet commands, the computer and the television ---------------------------------------

  private myName(): string {
    return this.engine.world(this.now()).player_name || tr('game.neighbour');
  }

  /** A command run without the usual error toasts (the caller says what happened). */
  private runQuiet(cmd: Command): CommandResult {
    const result = this.engine.command(cmd, this.now());
    if (result.ok) {
      this.persist();
      this.refresh();
    }
    return result;
  }

  /** Walks to the seat nearest the TV (a sofa, an armchair) and sits facing it, then `then`. */
  private sitNear(pid: number, then: () => void): void {
    const tv = this.room.placements.find((q) => q.pid === pid);
    if (!tv) return then();
    const region = this.regionAt(tv.x + 0.5, tv.y + 0.5);
    const seats = this.room.placements
      .filter((q) => q.pid !== pid && this.engine.catalog.items[q.item]?.layer === 'floor' && this.engine.catalog.items[q.item]?.actions.includes('sit') && this.regionAt(q.x + 0.5, q.y + 0.5) === region)
      .map((q) => ({ q, d: Math.hypot(q.x - tv.x, q.y - tv.y) }))
      .filter((x) => x.d <= 8 && x.d >= 1.5)
      .sort((a, b) => Number(/sofa|armchair|chesterfield/.test(b.q.item)) - Number(/sofa|armchair|chesterfield/.test(a.q.item)) || a.d - b.d);
    const seat = seats[0]?.q;
    if (!seat || this.seat?.pid === seat.pid) return then();
    this.afterSit = then;
    this.use(seat.pid, `watch_from:${pid}`);
  }

  /** The computer's picture: drawn in the paint app, printed and framed (a canvas to hang). */
  private printPicture(pid: number): void {
    this.paintSheet.open((title, pixels) => {
      const r = this.run({ type: 'paint', pid, title, pixels });
      if (r.ok) {
        this.sound.sfx('chime');
        this.toasts.show(tr('game.printed', { title }), { icon: 'paint', kind: 'good', ms: 4200 });
      }
    }, tr('game.pcDrawing'));
  }

  /** What «Липове ТБ» shows today: the paper's headlines, the weather, the recipe of the day. */
  private tvFeed() {
    const paper = this.engine.paper(this.now());
    const recipes = this.engine.recipes(this.now());
    const r = recipes.length ? recipes[Math.floor(this.now() / 1440) % recipes.length] : null;
    return {
      headlines: [paper.headline.title, ...paper.stories.map((x) => x.title), ...paper.town].filter(Boolean).slice(0, 8),
      weatherNow: paper.weather.today,
      weatherNext: paper.weather.tomorrow,
      sky: this.sky,
      recipe: r ? { name: r.name, needs: r.needs.map(([k, n]) => `${this.itemName(k)}${n > 1 ? ` ×${n}` : ''}`), text: r.text } : null,
    };
  }

  /** The town's encyclopedia on the computer: its places, and the people one has met. */
  private wikiEntries() {
    const places = Object.values(this.engine.catalog.locations ?? {})
      .filter((l) => !isRiftWorld(l.id) && l.id !== MIRROR_TOWN && !l.id.startsWith('guest'))
      .map((l) => ({ kind: 'place' as const, name: l.name, text: l.places.length ? tr('game.placeHas', { list: [...new Set(l.places.map((x) => x.name))].slice(0, 8).join(', ') }) : tr('game.placeQuiet') }));
    const people = this.npcViews.filter((v) => v.met).map((v) => ({ kind: 'person' as const, name: v.name, text: this.npcDef(v.id)?.about ?? '' }));
    return [...places, ...people];
  }

  /** Buys a style the player does not have yet, then returns whether it can be used. */
  private ensureStyle(id: string): boolean {
    if (this.ownedStyles.has(id)) return true;
    return this.run({ type: 'acquire_style', style: id }).ok;
  }

  private chooseWorldStyle(kind: string, id: string): void {
    if (!this.ensureStyle(id)) return;
    const before = this.room.styles[kind];
    this.history.commit({ type: 'set_style', kind, style: id }, before ? [{ type: 'set_style', kind, style: before }] : []);
  }

  private chooseTheme(id: string): void {
    if (!this.ownedThemes.has(id) && !this.run({ type: 'acquire_theme', theme: id }).ok) return;
    const before = { styles: { ...this.room.styles }, settings: { ...this.room.settings } };
    const r = this.run({ type: 'apply_theme', theme: id });
    if (!r.ok) return;
    this.history.push({
      undo: () => {
        const back: Command[] = [
          ...Object.entries(before.styles).map(([kind, style]) => ({ type: 'set_style', kind, style }) as Command),
          ...Object.keys({ ...before.settings, ...this.room.settings }).map((key) => ({ type: 'set_setting', key, value: before.settings[key] ?? SETTING_DEFAULTS[key] ?? '' }) as Command),
        ];
        return this.history.runAll(back);
      },
      redo: () => this.run({ type: 'apply_theme', theme: id }).ok,
    });
  }

  /** An item already in the room may change its look and use, but not what it needs from the room. */
  private safeEdit(item: UserItem): boolean {
    if (!this.room.placements.some((p) => p.item === item.id)) return true;
    const before = this.engine.catalog.items[item.id];
    const after = itemDefOf(item);
    return !before || (before.layer === after.layer && before.footprint.w === after.footprint.w && before.footprint.d === after.footprint.d && before.rules.provides_surface === after.rules.provides_surface);
  }

  /** Saves an item built in the workshop: rebuilds the content with it and puts a copy in the inventory. */
  private saveUserItem(item: UserItem): void {
    const isNew = !item.id;
    const saved = isNew ? { ...item, id: newId(this.userItems, item.name) } : item;
    const next = isNew ? [...this.userItems, saved] : this.userItems.map((u) => (u.id === saved.id ? saved : u));
    if (!isNew && !this.safeEdit(saved)) {
      this.sound.sfx('error');
      this.toasts.show(tr('game.own.placed'), { kind: 'error', icon: 'lock', ms: 4200 });
      return;
    }
    this.persist();
    try {
      this.engine.reloadPacks([...this.packs, packOf(next)]);
    } catch {
      this.toasts.show(t('err.unknown'), { kind: 'error' });
      return;
    }
    this.userItems = next;
    this.store.saveUserItems(next).catch(() => this.toasts.show(t('ui.no_storage'), { kind: 'error', icon: 'lock', ms: 4200 }));
    this.edit.setCatalog(this.engine.catalog);
    if (isNew) this.run({ type: 'acquire', item: saved.id });
    else this.refresh();
    this.sound.sfx('save');
    this.toasts.show(`${t('ui.bought')}: ${saved.name}`, { kind: 'good', icon: 'check' });
    if (isNew) {
      this.held = { item: saved.id, rot: 0 };
      this.studioMode = 'items';
      this.pushEdit();
    }
  }

  private randomLook(): void {
    const values = heroSettings(randomHero());
    const before = values.map(([key]) => [key, this.room.settings[key] ?? ''] as [string, string]);
    const apply = (list: [string, string][]) => list.every(([key, value]) => this.run({ type: 'set_setting', key, value }).ok);
    if (apply(values)) this.history.push({ undo: () => apply(before), redo: () => apply(values) });
  }

  /**
   * Builds a room (or a garden) next to the home in one go: floor, a wall along the shared side and a door in it.
   * Returns whether it worked; everything is one step of undo.
   */
  /** Adds a room (or garden, farm, orangery) next to the home; returns where it went, with its door, or null. */
  addRoom(kind: 'room' | 'garden' | 'farm' | 'orangery', w: number, d: number, quiet = false, noBuy = false): { x: number; y: number; w: number; d: number; door: [number, number, WallSide] | null } | null {
    const outdoorAt = (x: number, y: number) => {
      const painted = this.room.floor_paint[cellKey(x, y)];
      return !!painted && this.engine.catalog.styles[painted]?.params.outdoor === '1';
    };
    // gardens like to sit next to other gardens; rooms next to rooms
    const spot = findSpot(this.room.cells, w, d, (x, y) => (kind === 'room' || kind === 'orangery' ? (outdoorAt(x, y) ? -2 : 0) : outdoorAt(x, y) ? 2 : -1));
    if (!spot) {
      if (!quiet) this.toasts.show(tr('game.noSpace'), { kind: 'error' });
      return null;
    }
    if (this.room.area_used + w * d > this.room.area_budget) {
      if (!quiet) {
        this.sound.sfx('error');
        this.toasts.show(tr('game.needArea'), { kind: 'error', icon: 'lock', ms: 4200 });
      }
      return null;
    }
    const rect: [number, number][] = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) rect.push([spot.x + i, spot.y + j]);
    if (!this.run({ type: 'paint_cells', add: rect, remove: [] }).ok) return null;
    for (const [x, y, side] of spot.shared) this.run({ type: 'set_divider', x, y, side, on: true });
    const outside = kind === 'garden' || kind === 'farm';
    const floor = kind === 'farm' ? 'floor.soil' : 'floor.grass';
    if (outside && (noBuy ? this.ownedStyles.has(floor) : this.ensureStyle(floor))) this.run({ type: 'paint_floor', cells: rect, style: floor });
    // next to another garden there is a fence with a gate; next to the house, a garden door in the house wall
    const besideGarden = outside && spot.shared.some(([x, y, side]) => {
      const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
      const painted = this.room.floor_paint[cellKey(x + dx, y + dy)];
      return !!painted && this.engine.catalog.styles[painted]?.params.outdoor === '1';
    });
    let doorPid: number | null = null;
    const door = doorwayOf(spot);
    const placed: number[] = [];
    const put = (item: string, x: number, y: number, side: WallSide): number | null => {
      if ((this.inventory.find((i) => i.item === item)?.free ?? 0) === 0) {
        // the house built as a gift never spends the player's coins
        if (noBuy) return null;
        this.run({ type: 'acquire', item });
      }
      const r = this.run({ type: 'place', item, x, y, rot: 0, wall: side, on: null });
      const ev = r.ok ? r.events.find((e) => e.kind.type === 'Placed') : undefined;
      return ev ? (ev.kind.pid as number) : null;
    };
    if (door) {
      const item = besideGarden ? 'garden_gate' : outside ? 'door_garden' : 'door_basic';
      doorPid = put(item, door[0], door[1], door[2]);
      if (doorPid === null && item !== 'door_basic') doorPid = put('door_basic', door[0], door[1], door[2]);
      if (doorPid === null) this.run({ type: 'set_divider', x: door[0], y: door[1], side: door[2], on: false });
    }
    if (besideGarden) {
      for (const [x, y, side] of spot.shared) {
        if (door && x === door[0] && y === door[1] && side === door[2]) continue;
        const pid = put('fence_picket', x, y, side);
        if (pid !== null) placed.push(pid);
      }
    }
    if (kind === 'orangery') {
      // glass all round and warm tiles underfoot
      const cellsNow = new Set(this.room.cells.map(([x, y]) => cellKey(x, y)));
      const edges: [number, number, WallSide][] = [];
      for (const [x, y] of rect) {
        for (const side of ['north', 'east', 'south', 'west'] as WallSide[]) {
          const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
          const across = cellKey(x + dx, y + dy);
          const inRect = rect.some(([rx, ry]) => rx === x + dx && ry === y + dy);
          if (!inRect && (!cellsNow.has(across) || spot.shared.some(([sx, sy, ss]) => sx === x && sy === y && ss === side))) edges.push([x, y, side]);
        }
      }
      if (noBuy ? this.ownedStyles.has('wall.glass') : this.ensureStyle('wall.glass')) this.run({ type: 'paint_wall', edges, style: 'wall.glass' });
      if (noBuy ? this.ownedStyles.has('floor.terracotta_tiles') : this.ensureStyle('floor.terracotta_tiles')) this.run({ type: 'paint_floor', cells: rect, style: 'floor.terracotta_tiles' });
    }
    this.history.push({
      undo: () => {
        for (const pid of placed) this.run(this.history.mapped({ type: 'store', pid }));
        if (doorPid !== null) this.run(this.history.mapped({ type: 'store', pid: doorPid }));
        return this.run({ type: 'paint_cells', add: [], remove: rect }).ok;
      },
      redo: () => {
        doorPid = null;
        return this.run({ type: 'paint_cells', add: rect, remove: [] }).ok;
      },
    });
    if (!quiet) {
      this.sound.sfx('place');
      this.toasts.show(kind === 'garden' ? tr('game.ready.garden') : kind === 'farm' ? tr('game.ready.farm') : kind === 'orangery' ? tr('game.ready.orangery') : tr('game.ready.room'), { kind: 'good', icon: kind === 'room' ? 'home' : 'leaf' });
    }
    return { x: spot.x, y: spot.y, w, d, door };
  }

  // ---- the plan of the home (sections.ts, ui/plan.ts) -----------------------------------------------------

  /** What open ground a cell of the home is: a garden, a vegetable plot, or none (indoors). */
  private outdoorKind(x: number, y: number): 'garden' | 'farm' | null {
    const painted = this.homeRoom.floor_paint[cellKey(x, y)];
    if (!painted || this.engine.catalog.styles[painted]?.params.outdoor !== '1') return null;
    return painted === 'floor.soil' ? 'farm' : 'garden';
  }

  /** The parts of the home, each told what it is by its name, its ground or the things in it. */
  homeParts(): (Section & { entrance: boolean })[] {
    const room = this.homeRoom;
    const parts = sectionsOf(room.cells, dividerSet(room), room.settings, (x, y) => this.outdoorKind(x, y));
    const all = cellSet(room);
    // the doors out of the house: on a wall with nothing of the home behind it
    const ways: string[] = [];
    for (const p of room.placements) {
      const def = this.engine.catalog.items[p.item];
      if (!def?.tags.includes('door') || !p.wall) continue;
      const [dx, dy] = DELTA[p.wall];
      if (!all.has(cellKey(p.x + dx, p.y + dy))) ways.push(cellKey(p.x, p.y));
    }
    return parts.map((part) => {
      const own = new Set(part.cells.map(([x, y]) => cellKey(x, y)));
      const items = room.placements.filter((p) => own.has(cellKey(p.x, p.y))).map((p) => p.item);
      const glass = part.cells.some(([x, y]) => ['n', 'e', 's', 'w'].some((l) => room.wall_paint[`${x},${y},${l}`] === 'wall.glass'));
      const kind = part.nameKey && room.settings[`room.${part.nameKey}.kind`] ? part.kind : part.outdoor ? part.kind : glass ? 'orangery' : (guessKind(items) ?? part.kind);
      // the part with every way out of the house in it cannot go: there would be no door left to go out by
      const entrance = ways.length === 0 ? part === parts[0] : ways.every((k) => own.has(k));
      return { ...part, kind, entrance };
    });
  }

  private planView(): PlanView {
    const room = this.homeRoom;
    return {
      parts: this.homeParts(),
      dividers: dividerSet(room),
      used: room.area_used,
      budget: room.area_budget,
      cellPrice: room.cell_price ?? 0,
      coins: this.wallet.coins,
      homeName: room.settings['home.name'] ?? '',
    };
  }

  private openPlan(select?: string | null): void {
    if (this.location !== 'home') return;
    this.planSheet.open(this.planView(), select);
  }

  private part(id: string): (Section & { entrance: boolean }) | undefined {
    return this.homeParts().find((p) => p.id === id);
  }

  /** Floor still to buy for `cells` more cells, and what it costs. */
  private floorShort(cells: number): Quote {
    const r = this.homeRoom;
    const short = Math.max(0, r.area_used + cells - r.area_budget);
    return { cells: short, coins: short * (r.cell_price ?? 0) };
  }

  /** Buys the floor still missing for `cells` more cells; false (said in words) when it cannot be had. */
  private buyFloor(cells: number): boolean {
    const q = this.floorShort(cells);
    if (q.cells === 0) return true;
    if (!this.homeRoom.cell_price) {
      this.toasts.show(tr('game.needArea'), { kind: 'error', icon: 'lock', ms: 4200 });
      return false;
    }
    return this.run({ type: 'buy_area', cells: q.cells }).ok;
  }

  /** Everything standing on (or hanging in) these cells, things on top first, so the cells can be given back. */
  private thingsOn(cells: [number, number][]): PlacementView[] {
    const gone = new Set(cells.map(([x, y]) => cellKey(x, y)));
    const out = this.homeRoom.placements.filter((p) => {
      const def = this.engine.catalog.items[p.item];
      if (!def) return false;
      if (p.wall) return gone.has(cellKey(p.x, p.y)) || wallEdgesOfItem(def, p.x, p.y, p.wall).some(([x, y]) => gone.has(cellKey(x, y)));
      return footprintCells(def, p.rot).some(([dx, dy]) => gone.has(cellKey(p.x + dx, p.y + dy)));
    });
    return out.sort((a, b) => Number(b.on !== null) - Number(a.on !== null));
  }

  /**
   * Moves one edge of a part by a row: out (`grow`) or in. What hung on that wall (windows, a door, a picture)
   * goes with it; what stood on a row given back goes to the inventory.
   */
  private movePartEdge(id: string, side: WallSide, grow: boolean): void {
    const part = this.part(id);
    if (!part) return;
    const all = cellSet(this.homeRoom);
    const cells = grow ? growCells(part, side, all) : shrinkCells(part, side);
    if (cells.length === 0) return;
    if (!grow && !connected(this.homeRoom.cells.filter(([x, y]) => !cells.some(([cx, cy]) => cx === x && cy === y)))) {
      this.toasts.show(tr('plan.cutsOff'), { kind: 'error', icon: 'home' });
      return;
    }
    if (grow && !this.buyFloor(cells.length)) return;
    const [dx, dy] = DELTA[side];
    const own = new Set(part.cells.map(([x, y]) => cellKey(x, y)));
    // the wall that moves: what hangs on it, on the cells along it
    const edge = new Set((grow ? cells.map(([x, y]) => [x - dx, y - dy]) : cells).map(([x, y]) => cellKey(x, y)));
    const onWall = this.homeRoom.placements.filter((p) => p.wall === side && edge.has(cellKey(p.x, p.y)));
    const moved: { item: string; x: number; y: number; colors: Record<string, string> }[] = [];
    const away = grow ? onWall : this.thingsOn(cells);
    for (const p of away) {
      if (p.wall === side) moved.push({ item: p.item, x: p.x + (grow ? dx : -dx), y: p.y + (grow ? dy : -dy), colors: p.colors });
      this.runQuiet({ type: 'store', pid: p.pid });
    }
    const stored = away.length - moved.length;
    const ok = grow ? this.run({ type: 'paint_cells', add: cells, remove: [] }).ok : this.run({ type: 'paint_cells', add: [], remove: cells }).ok;
    if (ok && grow) {
      for (const [x, y, s] of newWalls(cells, own, all)) this.runQuiet({ type: 'set_divider', x, y, side: s, on: true });
      // the new row takes the ground of the row it grew from
      const byStyle = new Map<string, [number, number][]>();
      for (const [x, y] of cells) {
        const st = this.homeRoom.floor_paint[cellKey(x - dx, y - dy)];
        if (st) byStyle.set(st, [...(byStyle.get(st) ?? []), [x, y]]);
      }
      for (const [style, list] of byStyle) this.runQuiet({ type: 'paint_floor', cells: list, style });
    }
    if (ok && !grow && part.nameKey) {
      const keep = nameKeyFor(part, cells);
      if (keep && keep !== part.nameKey) {
        for (const f of ['name', 'kind']) {
          const v = this.homeRoom.settings[`room.${part.nameKey}.${f}`];
          if (!v) continue;
          this.runQuiet({ type: 'set_setting', key: `room.${part.nameKey}.${f}`, value: '' });
          this.runQuiet({ type: 'set_setting', key: `room.${keep}.${f}`, value: v });
        }
      }
    }
    // the windows and doors of the moved wall, hung again where it now stands (or where it stood, if it could not move)
    for (const m of moved) {
      const pid = this.placeGift(m.item, ok ? m.x : m.x - (grow ? dx : -dx), ok ? m.y : m.y - (grow ? dy : -dy), 0, side, null);
      if (pid !== null) for (const [slot, color] of Object.entries(m.colors ?? {})) this.runQuiet({ type: 'recolor', pid, slot, color });
    }
    this.history.clear();
    this.persist();
    this.refresh();
    if (ok) {
      this.sound.sfx(grow ? 'place' : 'pop');
      if (stored > 0) this.toasts.show(tr('plan.putAway', { n: stored }), { icon: 'bag' });
    }
    this.planSheet.refresh(this.planView());
  }

  /** Takes a whole part of the home away: its things go to the inventory, its floor stays bought. */
  private removePart(id: string): void {
    const part = this.part(id);
    if (!part || part.entrance) return;
    const own = new Set(part.cells.map(([x, y]) => cellKey(x, y)));
    if (!connected(this.homeRoom.cells.filter(([x, y]) => !own.has(cellKey(x, y))))) {
      this.toasts.show(tr('plan.cutsOff'), { kind: 'error', icon: 'home' });
      return;
    }
    const things = this.thingsOn(part.cells);
    for (const p of things) this.runQuiet({ type: 'store', pid: p.pid });
    for (const key of Object.keys(this.homeRoom.settings)) {
      const m = /^room\.(\d+)_(\d+)\./.exec(key);
      if (m && own.has(cellKey(Number(m[1]), Number(m[2])))) this.runQuiet({ type: 'set_setting', key, value: '' });
    }
    const ok = this.run({ type: 'paint_cells', add: [], remove: part.cells }).ok;
    this.history.clear();
    this.persist();
    this.refresh();
    if (ok) {
      this.sound.sfx('pop');
      this.toasts.show(things.length ? tr('plan.removed', { n: things.length }) : tr('plan.removedEmpty'), { icon: 'home' });
    }
    this.planSheet.refresh(this.planView());
  }

  private namePart(id: string, field: 'name' | 'kind', value: string): void {
    const part = this.part(id);
    if (!part) return;
    const key = part.nameKey ?? `${part.cells[0][0]}_${part.cells[0][1]}`;
    this.run({ type: 'set_setting', key: `room.${key}.${field}`, value });
    this.planSheet.refresh(this.planView());
  }

  /** The plan a new part is furnished by, and what is built for it underneath (a room, a garden…). */
  private static readonly BUILT: Partial<Record<SectionKind, ['room' | 'garden' | 'farm' | 'orangery', string | null, string | null]>> = {
    room: ['room', null, null],
    hall: ['room', 'hall', 'floor.herring'],
    kitchen: ['room', 'kitchen', 'floor.checker'],
    bedroom: ['room', 'bedroom', 'floor.carpet_rose'],
    bath: ['room', 'bath', 'floor.slate'],
    lounge: ['room', 'lounge', 'floor.walnut'],
    cinema: ['room', 'cinema', 'floor.carpet_moss'],
    games: ['room', 'games', 'floor.checker'],
    workshop: ['room', 'workshop', 'floor.slate'],
    garden: ['garden', 'garden', null],
    farm: ['farm', 'farm', null],
    orangery: ['orangery', 'orangery', null],
  };

  /** The things of a plan not in the inventory yet, with their coins. */
  private planShopping(plan: RoomPlan | undefined): { items: string[]; coins: number } {
    const need = new Map<string, number>();
    for (const t of [...(plan?.floor ?? []), ...(plan?.walls ?? [])]) need.set(t.item, (need.get(t.item) ?? 0) + 1);
    const items: string[] = [];
    let coins = 0;
    for (const [item, n] of need) {
      const def = this.engine.catalog.items[item];
      if (!def || def.hidden) continue;
      const have = this.inventory.find((i) => i.item === item)?.free ?? 0;
      const price = this.prices[item];
      if (price === undefined && have < n) continue;
      for (let i = have; i < n; i++) {
        items.push(item);
        coins += price ?? 0;
      }
    }
    return { items, coins };
  }

  private quoteBuild(kind: SectionKind, w: number, d: number): Quote | null {
    const built = Game.BUILT[kind];
    if (!built) return null;
    const outdoorAt = (x: number, y: number) => this.outdoorKind(x, y) !== null;
    const open = built[0] === 'garden' || built[0] === 'farm';
    if (!findSpot(this.homeRoom.cells, w, d, (x, y) => (open ? (outdoorAt(x, y) ? 2 : -1) : outdoorAt(x, y) ? -2 : 0))) return null;
    const floor = this.floorShort(w * d);
    const shopping = this.planShopping(built[1] ? PLANS[built[1]] : undefined);
    const door = open ? 'door_garden' : 'door_basic';
    const doorCoins = (this.inventory.find((i) => i.item === door)?.free ?? 0) > 0 ? 0 : (this.prices[door] ?? 0);
    const styles = [built[2], built[0] === 'farm' ? 'floor.soil' : built[0] === 'garden' ? 'floor.grass' : null, ...(built[0] === 'orangery' ? ['wall.glass', 'floor.terracotta_tiles'] : [])];
    const styleCoins = styles.reduce((a, st) => a + (st && !this.ownedStyles.has(st) && built[0] !== 'room' ? (this.prices[st] ?? 0) : 0), 0);
    return { cells: floor.cells, coins: floor.coins + shopping.coins + doorCoins + styleCoins };
  }

  /** Builds a new part of the home: the floor bought, the walls and a door, and what it is for, set in place. */
  private buildPart(kind: SectionKind, w: number, d: number): void {
    const built = Game.BUILT[kind];
    const q = this.quoteBuild(kind, w, d);
    if (!built || !q) return;
    if (q.coins > this.wallet.coins) {
      this.toasts.show(tr('plan.tooDear'), { kind: 'error', icon: 'lock' });
      return;
    }
    if (!this.buyFloor(w * d)) return;
    const plan = built[1] ? PLANS[built[1]] : undefined;
    for (const item of this.planShopping(plan).items) this.runQuiet({ type: 'acquire', item });
    const spot = this.addRoom(built[0], w, d, true);
    if (!spot) {
      this.toasts.show(tr('game.noSpace'), { kind: 'error' });
      return;
    }
    const rect: [number, number][] = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) rect.push([spot.x + i, spot.y + j]);
    if (built[2] && built[0] === 'room' && this.ownedStyles.has(built[2])) this.runQuiet({ type: 'paint_floor', cells: rect, style: built[2] });
    if (kind !== built[0] || kind === 'room') this.runQuiet({ type: 'set_setting', key: `room.${spot.x}_${spot.y}.kind`, value: kind });
    if (plan) {
      const placed = this.furnishByPlan(spot, plan, this.doorKeep());
      const inside = this.room.cells.find(([x, y]) => x === spot.x + Math.floor(spot.w / 2) && y === spot.y + Math.floor(spot.d / 2));
      while (placed.length > 0 && inside && !this.reachable(inside)) {
        const pid = placed.pop();
        if (pid !== undefined) this.runQuiet({ type: 'store', pid });
      }
    }
    this.history.clear();
    this.persist();
    this.refresh();
    this.sound.sfx('place');
    this.toasts.show(tr('plan.built', { what: kindName(kind) }), { kind: 'good', icon: 'home' });
    this.openPlan(cellKey(spot.x, spot.y));
  }

  /** Both sides of every door of the home and a step around them: nothing is set there. */
  private doorKeep(): Set<string> {
    const keep = new Set<string>();
    for (const p of this.room.placements) {
      const def = this.engine.catalog.items[p.item];
      if (!def || !p.wall || !def.tags.includes('door')) continue;
      for (const [x, y, side] of wallEdgesOfItem(def, p.x, p.y, p.wall)) {
        const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
        for (const [cx, cy] of [[x, y], [x + dx, y + dy]]) for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keep.add(cellKey(cx + ox, cy + oy));
      }
    }
    return keep;
  }

  /**
   * The whole house, once: a kitchen, a bedroom, a bath, a garden, a vegetable plot and an orangery next to the
   * first room, with doors and a few things in each (a gift from the content, so it costs nothing). Old homes that
   * had only their first room get it too.
   */
  private buildHouse(): void {
    const kit = 'kit.house';
    if (!this.engine.catalog.kits?.[kit] || this.engine.world(this.now()).kits?.includes(kit)) return;
    if (!this.engine.command({ type: 'claim_kit', kit }, this.now()).ok) return;
    this.persist();
    this.refresh();
    const plan: ['room' | 'garden' | 'farm' | 'orangery', number, number, string | null, string][] = [
      ['room', 7, 6, 'floor.checker', 'kitchen'],
      ['room', 7, 6, 'floor.carpet_rose', 'bedroom'],
      ['room', 5, 5, 'floor.slate', 'bath'],
      ['garden', 10, 10, null, 'garden'],
      ['farm', 8, 8, null, 'farm'],
      ['orangery', 6, 6, null, 'orangery'],
    ];
    // all the rooms first, so every door is known before anything is put near one
    const built: [NonNullable<ReturnType<Game['addRoom']>>, string][] = [];
    for (const [kind, w, d, floor, things] of plan) {
      const spot = this.addRoom(kind, w, d, true, true);
      if (!spot) continue;
      const rect: [number, number][] = [];
      for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) rect.push([spot.x + i, spot.y + j]);
      if (floor && this.ownedStyles.has(floor)) this.run({ type: 'paint_floor', cells: rect, style: floor });
      built.push([spot, things]);
    }
    // both sides of every door, and a step around them, stay free
    const keep = this.doorKeep();
    for (const [spot, name] of built) {
      if (name !== 'garden' && name !== 'farm') this.run({ type: 'set_setting', key: `room.${spot.x}_${spot.y}.kind`, value: name });
      const placed = this.furnishByPlan(spot, PLANS[name], keep);
      // whatever stops the way into the room goes back to the inventory, last first
      const inside = this.room.cells.find(([x, y]) => x === spot.x + Math.floor(spot.w / 2) && y === spot.y + Math.floor(spot.d / 2));
      while (placed.length > 0 && inside && !this.reachable(inside)) {
        const pid = placed.pop();
        if (pid !== undefined) this.run({ type: 'store', pid });
      }
    }
    // the living room last, now that every door in its walls is known
    this.furnishLiving(keep);
    this.history.clear();
    this.toasts.show(tr('game.houseOpen'), { kind: 'good', icon: 'home', ms: 4200 });
  }

  /** Places one thing of the house's gift (if it is still in the inventory); returns its pid or null. */
  private placeGift(item: string, x: number, y: number, rot: number, wall: WallSide | null, on: number | null): number | null {
    if ((this.inventory.find((i) => i.item === item)?.free ?? 0) === 0) return null;
    const cmd: Command = { type: 'place', item, x, y, rot, wall, on };
    if (!this.engine.can(cmd, this.now()).ok) return null;
    const result = this.run(cmd);
    const ev = result.ok ? result.events.find((e) => e.kind.type === 'Placed') : undefined;
    return ev ? (ev.kind.pid as number) : null;
  }

  /**
   * Furnishes a new room by its plan (homeplan.ts): read from the back wall toward the door, so things stand
   * along walls facing into the room wherever the door is. What the plan cannot place (a door in the way) stays
   * in the inventory. Returns the floor things placed, in order.
   */
  private furnishByPlan(spot: { x: number; y: number; w: number; d: number; door: [number, number, WallSide] | null }, plan: RoomPlan | undefined, keep: Set<string>): number[] {
    if (!plan) return [];
    const inside = (x: number, y: number) => x >= spot.x && y >= spot.y && x < spot.x + spot.w && y < spot.y + spot.d;
    // other rooms may have put doors in any wall: the plan is turned (and mirrored) the way most of it fits
    const fits = (frame: ReturnType<typeof roomFrame>) =>
      plan.floor.filter((t) => {
        const def = this.engine.catalog.items[t.item];
        if (!def || t.on || def.layer !== 'floor') return false;
        const at = placeItem(frame, def.footprint, t.u, t.v, t.face);
        return at.cells.every(([x, y]) => inside(x, y) && !keep.has(cellKey(x, y))) && this.engine.can({ type: 'place', item: t.item, x: at.x, y: at.y, rot: at.rot, wall: null, on: null }, this.now()).ok;
      }).length;
    const sides: WallSide[] = [spot.door?.[2] ?? 'south', 'north', 'east', 'south', 'west'];
    const frames = sides.flatMap((side) => [roomFrame(spot, side), roomFrame(spot, side, true)]);
    const frame = frames.reduce((best, f) => (fits(f) > fits(best) ? f : best), frames[0]);
    const byItem = new Map<string, number[]>();
    const placed: number[] = [];
    const host = (on: string | undefined): number | null | undefined => {
      if (!on) return null;
      const [id, n] = on.split('#');
      return byItem.get(id)?.[Number(n ?? 0)];
    };
    const free = (cells: [number, number][]) => cells.every(([x, y]) => inside(x, y) && !keep.has(cellKey(x, y)));
    for (const t of plan.floor) {
      const def = this.engine.catalog.items[t.item];
      if (!def) continue;
      const on = host(t.on);
      if (on === undefined) continue;
      let pid: number | null = null;
      if (on !== null) {
        // on a table or a counter: on its first cell
        const hp = this.room.placements.find((q) => q.pid === on);
        if (hp) pid = this.placeGift(t.item, hp.x, hp.y, 0, null, on);
      } else {
        // where the plan says, or a step from there when a door is in the way (nothing stands before a door)
        for (const [du, dv] of [[0, 0], [0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [0, 2], [-2, 0]]) {
          const u = t.u < 0 ? Math.min(-1, t.u + du) : Math.max(0, t.u + du);
          const v = t.v < 0 ? Math.min(-1, t.v + dv) : Math.max(0, t.v + dv);
          const at = placeItem(frame, def.footprint, u, v, t.face);
          if (!(def.layer === 'rug' ? at.cells.every(([x, y]) => inside(x, y)) : free(at.cells))) continue;
          pid = this.placeGift(t.item, at.x, at.y, at.rot, null, null);
          if (pid !== null) break;
        }
      }
      if (pid === null) continue;
      byItem.set(t.item, [...(byItem.get(t.item) ?? []), pid]);
      if (on === null && def.layer === 'floor') placed.push(pid);
    }
    for (const w of plan.walls) {
      const def = this.engine.catalog.items[w.item];
      if (!def) continue;
      const at = placeOnWall(frame, def.footprint, w.wall, w.along);
      if (!at.cells.every(([x, y]) => inside(x, y))) continue;
      this.placeGift(w.item, at.x, at.y, 0, at.side, null);
    }
    return placed;
  }

  /** The first room: a living room round the television (homeplan.ts LIVING), keeping every door clear. */
  private furnishLiving(keep: Set<string>): void {
    const byItem = new Map<string, number>();
    for (const t of LIVING.floor) {
      const def = this.engine.catalog.items[t.item];
      if (!def) continue;
      const on = t.on ? byItem.get(t.on) : null;
      if (on === undefined) continue;
      const cells = footprintCells(def, t.rot).map(([dx, dy]) => [t.x + dx, t.y + dy] as [number, number]);
      if (on === null && def.layer !== 'rug' && cells.some(([x, y]) => keep.has(cellKey(x, y)))) continue;
      const pid = this.placeGift(t.item, t.x, t.y, t.rot, null, on);
      if (pid !== null) byItem.set(t.item, pid);
    }
    for (const w of LIVING.walls) this.placeGift(w.item, w.x, w.y, 0, w.side, null);
  }

  /** Whether a cell of the home can be walked to from the first room. */
  private reachable(cell: [number, number]): boolean {
    const start = this.room.cells.find(([x, y]) => !gridOf(this.room, this.engine.catalog).blocked.has(cellKey(x, y)) && x < 10 && y < 10);
    if (!start) return true;
    const near = cellsAround(cell[0], cell[1], 1, 1).concat([cell]);
    return findPath(this.room, this.engine.catalog, start, near) !== null;
  }

  private chooseShapeTool(tool: ShapeTool): void {
    this.shapeTool = tool;
    this.pushEdit();
  }

  private choosePaintStyle(id: string | null): void {
    if (id && !this.ensureStyle(id)) return;
    this.paintStyle = id;
    this.pushEdit();
  }

  private choosePaintTarget(target: PaintTarget): void {
    this.paintTarget = target;
    this.paintStyle = null;
    this.pushEdit();
  }

  private paintCells(cells: [number, number][], style: string | null): void {
    if (cells.length === 0) return;
    const groups = new Map<string, [number, number][]>();
    for (const c of cells) {
      const k = this.room.floor_paint[cellKey(c[0], c[1])] ?? '';
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    const inverse = [...groups].map(([k, list]) => ({ type: 'paint_floor', cells: list, style: k || null }) as Command);
    this.history.commit({ type: 'paint_floor', cells, style }, inverse);
  }

  private paintEdges(edges: [number, number, WallSide][], style: string | null): void {
    if (edges.length === 0) return;
    const groups = new Map<string, [number, number, WallSide][]>();
    for (const e of edges) {
      const k = this.room.wall_paint[edgeKey(e[0], e[1], e[2])] ?? '';
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const inverse = [...groups].map(([k, list]) => ({ type: 'paint_wall', edges: list, style: k || null }) as Command);
    this.history.commit({ type: 'paint_wall', edges, style }, inverse);
  }

  private fill(): void {
    if (this.paintTarget === 'floor') {
      this.paintCells(this.room.cells, this.paintStyle);
      return;
    }
    const cells = cellSet(this.room);
    const dividers = dividerSet(this.room);
    const seen = new Set<string>();
    const edges: [number, number, WallSide][] = [];
    for (const [x, y] of this.room.cells) {
      for (const side of SIDES) {
        if (!isWallEdge(cells, dividers, x, y, side)) continue;
        const k = dedupeKey(x, y, side);
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push([x, y, side]);
      }
    }
    this.paintEdges(edges, this.paintStyle);
  }

  private shapeAdd(cells: [number, number][]): void {
    if (cells.length === 0) return;
    const q = this.floorShort(cells.length);
    if (q.cells > 0 && this.homeRoom.cell_price) {
      // the floor is bought as it is laid: the price first, then the floor
      this.ask.open({
        who: tr('plan.title'),
        text: tr('plan.buyAsk', { cells: q.cells, n: q.coins }),
        choices: [
          { label: q.coins > this.wallet.coins ? tr('plan.tooDear') : tr('plan.buyYes', { n: q.coins }), primary: true, disabled: q.coins > this.wallet.coins, run: () => {
            this.ask.close();
            if (this.buyFloor(cells.length)) this.history.commit({ type: 'paint_cells', add: cells, remove: [] }, [{ type: 'paint_cells', add: [], remove: cells }]);
          } },
          { label: tr('plan.notNow'), run: () => this.ask.close() },
        ],
      });
      return;
    }
    this.history.commit({ type: 'paint_cells', add: cells, remove: [] }, [{ type: 'paint_cells', add: [], remove: cells }]);
  }

  private shapeRemove(cells: [number, number][]): void {
    if (cells.length === 0) return;
    this.history.commit({ type: 'paint_cells', add: [], remove: cells }, [{ type: 'paint_cells', add: cells, remove: [] }]);
  }

  private toggleDivider(x: number, y: number, side: WallSide): void {
    const on = !dividerSet(this.room).has(dividerKey(x, y, side));
    this.history.commit({ type: 'set_divider', x, y, side, on }, [{ type: 'set_divider', x, y, side, on: !on }]);
  }

  /**
   * What is under the pointer while arranging. A thing for a wall (a door, a gate, a fence) also goes on the walls
   * inside the home — between two rooms, between the garden and the vegetable plot — which are not drawn standing
   * and so cannot be pointed at: near such an edge the floor point means the edge.
   */
  private editPick(x: number, y: number): Pick | null {
    const pick = this.renderer.pick(x, y);
    if (pick?.kind === 'wall' || this.mode !== 'edit') return pick;
    const held = this.held ? this.engine.catalog.items[this.held.item] : this.selectedPid !== null ? this.engine.catalog.items[this.room.placements.find((q) => q.pid === this.selectedPid)?.item ?? ''] : undefined;
    if (held?.layer !== 'wall') return pick;
    const e = this.renderer.pickEdge(x, y, 0.35);
    if (!e || !dividerSet(this.room).has(dividerKey(e.x, e.y, e.side))) return pick;
    return { kind: 'wall', x: e.x, y: e.y, side: e.side };
  }

  /** Where an item would go if dropped on what is under the pointer, or null if that spot makes no sense. */
  private specFor(def: ItemDef, rot: number, pick: Pick): Spec | null {
    if (def.layer === 'wall') {
      if (pick.kind !== 'wall') return null;
      const back = Math.floor((def.footprint.w - 1) / 2);
      const [ax, ay] = ALONG[pick.side];
      return { x: pick.x - ax * back, y: pick.y - ay * back, wall: pick.side, on: null };
    }
    if (def.layer === 'surface') {
      if (pick.kind !== 'item') return null;
      const host = this.room.placements.find((p) => p.pid === pick.pid);
      const hostDef = host ? this.engine.catalog.items[host.item] : undefined;
      if (!host || !hostDef?.rules.provides_surface) return null;
      const cells = footprintCells(hostDef, host.rot).map(([dx, dy]) => [host.x + dx, host.y + dy] as [number, number]);
      let best = cells[0];
      let bestD = Infinity;
      for (const c of cells) {
        const d = Math.hypot(c[0] - pick.cell[0], c[1] - pick.cell[1]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return { x: best[0], y: best[1], wall: null, on: host.pid };
    }
    if (pick.kind === 'wall' || pick.kind === 'npc') return null;
    const cell: [number, number] = pick.kind === 'floor' ? [pick.x, pick.y] : pick.cell;
    const w = rot % 2 ? def.footprint.d : def.footprint.w;
    const d = rot % 2 ? def.footprint.w : def.footprint.d;
    return { x: cell[0] - Math.floor((w - 1) / 2), y: cell[1] - Math.floor((d - 1) / 2), wall: null, on: null };
  }

  private editIntent(): { def: ItemDef; rot: number; command: Command; spec: Spec } | null {
    if (this.mode !== 'edit' || this.studioMode !== 'items' || !this.hover) return null;
    if (this.held) {
      const def = this.engine.catalog.items[this.held.item];
      if (!def) return null;
      const spec = this.specFor(def, this.held.rot, this.hover);
      if (!spec) return null;
      return { def, rot: this.held.rot, spec, command: { type: 'place', item: def.id, x: spec.x, y: spec.y, rot: this.held.rot, wall: spec.wall, on: spec.on } };
    }
    if (this.selectedPid !== null) {
      const p = this.room.placements.find((q) => q.pid === this.selectedPid);
      const def = p ? this.engine.catalog.items[p.item] : undefined;
      if (!p || !def) return null;
      const spec = this.specFor(def, p.rot, this.hover);
      if (!spec) return null;
      return { def, rot: p.rot, spec, command: { type: 'move', pid: p.pid, x: spec.x, y: spec.y, wall: spec.wall, on: spec.on } };
    }
    return null;
  }

  private bindCanvas(): void {
    const local = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const editing = () => this.mode === 'edit' && this.pointers.size < 2;
    this.canvas.addEventListener('pointerdown', (e) => {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-ended pointers cannot be captured; tapping still works without it.
      }
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        this.pinched = true;
        this.pinch = this.pinchDistance();
        this.drag = null;
        this.panDrag = null;
        return;
      }
      if (this.mode === 'edit') {
        this.hover = this.editPick(p.x, p.y);
        if (this.studioMode === 'shape' && this.shapeTool !== 'divider') this.drag = { cells: new Map(), edges: new Map() };
        else if (this.studioMode === 'paint') this.drag = { cells: new Map(), edges: new Map() };
        this.dragTo(p);
        if (!this.drag && this.studioMode === 'world') this.panDrag = { x: p.x, y: p.y, moved: false };
      } else {
        this.panDrag = { x: p.x, y: p.y, moved: false };
        // holding a finger on an item jumps into the editor with it selected
        const held = this.renderer.pick(p.x, p.y);
        if (this.longPress !== null) window.clearTimeout(this.longPress);
        if (held?.kind === 'item' && this.location === 'home') {
          this.longPress = window.setTimeout(() => {
            this.longPress = null;
            if (!this.panDrag || this.panDrag.moved) return;
            this.panDrag = null;
            this.bubble.hide();
            this.enterEdit();
            this.studioMode = 'items';
            this.selectedPid = held.pid;
            vibrate(this.prefs, 20);
            this.pushEdit();
          }, 520);
        }
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if (this.pointers.size >= 2) {
        const d = this.pinchDistance();
        if (this.pinch > 0 && d > 0) this.zoomBy(d / this.pinch);
        this.pinch = d;
        return;
      }
      if (this.panDrag) {
        const dx = p.x - this.panDrag.x;
        const dy = p.y - this.panDrag.y;
        if (this.panDrag.moved || Math.hypot(dx, dy) > 8) {
          this.panDrag.moved = true;
          this.pan = this.clampPan({ x: this.pan.x + dx, y: this.pan.y + dy });
          this.panDrag.x = p.x;
          this.panDrag.y = p.y;
        }
        return;
      }
      if (this.mode !== 'edit') return;
      this.hover = this.editPick(p.x, p.y);
      this.dragTo(p);
    });
    const finish = (e: PointerEvent, cancelled: boolean) => {
      const p = local(e);
      const wasPinch = this.pointers.size >= 2 || this.pinched;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.pinched = false;
      if (wasPinch) {
        this.pinch = 0;
        this.drag = null;
        this.panDrag = null;
        return;
      }
      if (this.panDrag) {
        const moved = this.panDrag.moved;
        this.panDrag = null;
        if (this.longPress !== null) {
          window.clearTimeout(this.longPress);
          this.longPress = null;
        }
        if (!moved && !cancelled && this.mode === 'walk' && !this.photoBar.isOpen()) this.walkTap(p);
        if (moved || cancelled || this.mode !== 'edit') return;
      }
      if (!editing() || cancelled) {
        this.drag = null;
        return;
      }
      this.hover = this.editPick(p.x, p.y);
      this.commitTap(p);
    };
    this.canvas.addEventListener('pointerup', (e) => finish(e, false));
    this.canvas.addEventListener('pointercancel', (e) => finish(e, true));
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      },
      { passive: false },
    );
    this.canvas.addEventListener('dblclick', () => {
      this.pan = { x: 0, y: 0 };
      this.zoom = 1;
    });
    this.canvas.addEventListener('pointerleave', () => {
      if (this.mode === 'edit' && !this.drag) this.hover = null;
    });
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  /** Adds what is under the pointer to the current brush stroke. */
  private dragTo(p: { x: number; y: number }): void {
    if (!this.drag) return;
    if (this.studioMode === 'shape') {
      const f = this.renderer.floorPoint(p.x, p.y);
      const c: [number, number] = [Math.floor(f.x), Math.floor(f.y)];
      const inRoom = this.room.cells.some(([x, y]) => x === c[0] && y === c[1]);
      if (this.shapeTool === 'add' ? !inRoom : inRoom) this.drag.cells.set(cellKey(c[0], c[1]), c);
    } else if (this.paintTarget === 'floor') {
      const hit = this.renderer.pick(p.x, p.y);
      if (hit && (hit.kind === 'floor' || hit.kind === 'item')) {
        const f = this.renderer.floorPoint(p.x, p.y);
        const c: [number, number] = [Math.floor(f.x), Math.floor(f.y)];
        if (this.room.cells.some(([x, y]) => x === c[0] && y === c[1])) this.drag.cells.set(cellKey(c[0], c[1]), c);
      }
    } else {
      const hit = this.renderer.pick(p.x, p.y);
      if (hit?.kind === 'wall') this.drag.edges.set(edgeKey(hit.x, hit.y, hit.side), [hit.x, hit.y, hit.side]);
    }
  }

  private commitTap(p: { x: number; y: number }): void {
    const drag = this.drag;
    this.drag = null;
    if (this.studioMode === 'shape') {
      if (this.shapeTool === 'divider') {
        const e = this.renderer.pickEdge(p.x, p.y, 0.35);
        if (e) this.toggleDivider(e.x, e.y, e.side);
      } else if (drag) {
        const cells = [...drag.cells.values()];
        if (this.shapeTool === 'add') this.shapeAdd(cells);
        else this.shapeRemove(cells);
      }
      return;
    }
    if (this.studioMode === 'paint') {
      if (!drag) return;
      if (this.paintTarget === 'floor') this.paintCells([...drag.cells.values()], this.paintStyle);
      else this.paintEdges([...drag.edges.values()], this.paintStyle);
      return;
    }
    if (this.studioMode !== 'items') return;
    const pick = this.hover;
    if (!pick) return;
    const intent = this.editIntent();
    if (this.held) {
      if (!intent) return;
      const result = intent.command.type === 'place' ? this.placeItem(intent.command) : this.run(intent.command);
      if (result.ok) {
        const left = this.engine.inventory().find((i) => i.item === this.held?.item)?.free ?? 0;
        if (left === 0) this.held = null;
        this.pushEdit();
      }
      return;
    }
    if (pick.kind === 'item' && pick.pid !== this.selectedPid) {
      this.selectedPid = pick.pid;
      this.pushEdit();
      return;
    }
    if (this.selectedPid !== null && intent && intent.command.type === 'move') {
      const sel = this.room.placements.find((q) => q.pid === this.selectedPid);
      const back: Command[] = sel ? [{ type: 'move', pid: sel.pid, x: sel.x, y: sel.y, wall: sel.wall, on: sel.on }] : [];
      this.history.commit(intent.command, back);
      return;
    }
    this.selectedPid = null;
    this.pushEdit();
  }

  private ghost(): { ghost: Ghost | null; highlight: Frame['highlight'] } {
    let highlight: Frame['highlight'];
    if (this.mode === 'edit' && this.drag && this.drag.cells.size > 0) {
      highlight = [...this.drag.cells.values()].map(([x, y]) => ({ x, y, ok: true }));
    } else if (this.mode === 'edit' && this.studioMode === 'shape' && this.shapeTool !== 'divider' && this.hover === null) {
      highlight = undefined;
    }
    const intent = this.editIntent();
    if (!intent) return { ghost: null, highlight };
    const check = this.engine.can(intent.command, this.now());
    const valid = check.ok;
    const { def, rot, spec } = intent;
    const ghost: Ghost = { item: def.id, x: spec.x, y: spec.y, rot, wall: spec.wall, on: spec.on, valid };
    if (def.layer === 'floor' || def.layer === 'rug') {
      highlight = footprintCells(def, rot).map(([dx, dy]) => ({ x: spec.x + dx, y: spec.y + dy, ok: valid }));
    }
    return { ghost, highlight };
  }

  // ---- frame loop -------------------------------------------------------------------------------

  private updateHudClock(): void {
    // the clock tells the world's time, even in a cave where it is always dark
    const minuteOfDay = this.village?.def.underground ? (this.debug.minuteOfDay ?? this.now() % 1440) : lightMinute(this.room.settings, this.debug.minuteOfDay ?? this.now() % 1440);
    // the air out of doors (also shown indoors and at home: what one would step out into)
    let air: number | null = this.comfortNow?.out ?? null;
    if (air === null) {
      try {
        air = this.engine.comfort(false, -1, this.now()).out;
      } catch {
        air = null;
      }
    }
    this.hud.setTime(minuteOfDay, air, this.todayHoliday());
  }

  private updateActionButton(): void {
    if (this.car) {
      if (this.actionKey !== 'car') {
        this.actionKey = 'car';
        this.hud.setAction({ glyph: 'taxi', label: this.exam ? tr('game.act.stop') : tr('game.act.stopOut') });
      }
      return;
    }
    if (this.overview) {
      if (this.actionKey !== 'overview') {
        this.actionKey = 'overview';
        this.hud.setAction({ glyph: 'walk', label: tr('game.act.down') });
      }
      return;
    }
    const day = this.dayTarget;
    const ground = !day && !this.target && this.canSitHere();
    const key = day ? `d${day.kind}${day.id}` : this.target ? (this.target.kind === 'item' ? `i${this.target.pid}${this.target.action}` : this.target.kind) : this.groundSit ? 'up' : ground ? 'ground' : '';
    if (key === this.actionKey) return;
    this.actionKey = key;
    if (day) this.hud.setAction(day.kind === 'spot' ? { glyph: 'harvest', label: tr('game.act.gather') } : { glyph: 'fish', label: tr('game.act.fish') });
    else if (!this.target && this.groundSit) this.hud.setAction({ glyph: 'walk', label: tr('game.act.standUp') });
    else if (!this.target && ground) this.hud.setAction({ glyph: 'sit', label: tr('game.act.sit') });
    else if (!this.target) this.hud.setAction(null);
    else if (this.target.kind === 'item' && (this.target.action === 'go_in' || this.target.action === 'home')) this.hud.setAction({ glyph: 'door', label: tr('game.opt.goIn') });
    else if (this.target.kind === 'item') this.hud.setAction({ glyph: this.target.action, label: t(`action.${this.target.action}`) });
    else this.hud.setAction({ glyph: 'door', label: tr('game.opt.door') });
  }

  private tick = (ms: number): void => {
    try {
      this.frame(ms);
    } catch (err) {
      // One bad frame must not stop the game; the next frame starts from a clean renderer.
      this.renderer.recover();
      console.error(err);
    }
    requestAnimationFrame(this.tick);
  };

  private frame(ms: number): void {
    if (ms - this.placeChecked > 700) {
      this.placeChecked = ms;
      this.hud.setPlace(this.placeButtons());
    }
    this.nightTick(ms);
    const elapsed = this.last ? (ms - this.last) / 1000 : 0.016;
    // Moving things need smooth frames; a quiet room is drawn a few times a second to save the battery.
    const busy = this.moving || !!this.hop || this.pet.pose === 'walk' || [...this.npcPoses.values()].some((n) => n.walking) || this.fade > 0 || !!this.drag || this.pointers.size > 0 || this.saved !== null || this.mode === 'edit';
    const weather = this.room.style_params.weather?.kind ?? 'none';
    // walking runs at the display's own rate; other motion at 30 a second; a still room a few times a second
    // (on a slow phone walking is drawn at 30 a second too: steady beats fast)
    const interval = this.moving || this.path ? (this.level >= 1 ? 1 / 30 : 0) : busy || weather !== 'none' ? (this.level >= 2 ? 1 / 20 : 1 / 30) : this.level >= 2 ? 1 / 8 : 1 / 12;
    if (this.last && elapsed < interval - 0.004) {
      return;
    }
    const dt = Math.min(0.05, elapsed);
    this.last = ms;
    const workFrom = performance.now();
    this.perf?.start();
    this.checkTown(dt);
    this.time += dt;

    const start = { x: this.walker.x, y: this.walker.y };
    if (this.car) {
      this.moving = this.driveStep(dt);
    } else if (this.mode === 'walk' && !this.overview && !this.shop.isOpen() && !this.dialogue.isOpen() && !this.gifts.isOpen() && !this.fishing.isOpen() && !this.arcade.isOpen() && !this.mending.isOpen() && !this.taxi.isOpen() && !this.todayPanel.isOpen() && !this.tables.isOpen()) {
      const stick = this.hud.push();
      const key = this.keys.vector();
      const vx = stick.mag > 0 ? stick.x * stick.mag : key.x;
      const vy = stick.mag > 0 ? stick.y * stick.mag : key.y;
      this.moving = vx !== 0 || vy !== 0;
      if (this.moving) {
        this.performing = null;
        this.groundSit = false;
        this.path = null;
        this.pending = null;
        this.seat = null;
        this.bubble.hide();
        this.dir = dirOf(vx, vy, this.dir);
        // water is slow going
        // crouched, one goes slowly, step by step
        const k = (this.swimming() ? 0.55 : this.riding && this.outdoors() ? 1.9 : this.onIce() ? 1.25 : 1) * walkFactor(this.comfortNow) * (this.crouching() ? 0.45 : 1);
        const was = { x: this.walker.x, y: this.walker.y };
        stepWalker(this.walker, vx * k, vy * k, dt, this.room, this.engine.catalog, this.view);
        // the lie of the land: a step is walked up, two want a hop, more are a cliff
        if (!this.canClimbTo(was)) {
          this.walker.x = was.x;
          this.walker.y = was.y;
        }
        const mx = this.walker.x - was.x;
        const my = this.walker.y - was.y;
        if (Math.abs(mx) + Math.abs(my) > 1e-4) this.bikeRot = Math.abs(mx) >= Math.abs(my) ? (mx >= 0 ? 0 : 2) : my >= 0 ? 1 : 3;
      }
    } else {
      this.moving = false;
    }
    if (!this.moving && this.mode === 'walk' && this.path && !this.car) this.moving = this.followPath(dt);
    this.climbStep(dt);
    this.hud.setCrouch(this.crouching());
    if (!this.car && this.location !== 'home') this.keepOutOfCars(start);
    if (this.moving && !this.car) this.checkExits();
    if (!this.car) this.roadAfoot();
    const before = { x: this.pet.x, y: this.pet.y };
    if (!this.petAway()) stepPet(this.pet, this.walker, this.moving, dt, this.location !== 'home' && this.village ? this.village.routes.dry : this.room, this.engine.catalog);
    {
      const [ax, ay] = rotXY(this.view, before.x, before.y);
      const [bx, by] = rotXY(this.view, this.pet.x, this.pet.y);
      const sx = bx - by - (ax - ay);
      if (Math.abs(sx) > 1e-4) this.petScreenDir = sx > 0 ? 'right' : 'left';
    }
    if (this.location === 'home') this.stepHousePets(dt);
    if (this.performing && this.time > this.performing.until) this.performing = null;
    const shown = this.shownRoom();
    this.target = this.mode === 'walk' && !this.performing && !this.seat ? nearestInteractable(this.walker, shown, this.engine.catalog) : null;
    if (this.location !== 'home' && this.target?.kind === 'item' && !SIT_ACTIONS.has(this.target.action) && this.target.action !== 'enter') this.target = null;
    if (this.location !== 'home' && this.target && this.target.kind !== 'item') this.target = null;
    // at any building's door the button says «Увійти», the same everywhere
    if (this.mode === 'walk' && !this.seat && !this.target) this.target = this.doorNear();
    this.dayTarget = this.mode === 'walk' && !this.seat && !this.fishing.isOpen() ? this.dayTargetHere() : null;
    if (this.dayTarget?.kind === 'spot') this.target = null;
    this.perf?.mark('walk');
    this.updateNpcs(dt);
    this.holdTalker();
    this.perf?.mark('npcs');
    this.petNoticed();
    this.roadMovers();
    this.updateActionButton();

    this.hudClock -= dt;
    if (this.hudClock <= 0) {
      this.hudClock = 0.5;
      this.updateHudClock();
      this.updateWeather();
      this.updateComfort();
      this.checkJail();
      if (this.daily && Math.floor(this.now() / 1440) !== this.daily.day) this.refreshDaily();
    }

    this.fade = Math.max(0, this.fade - dt);
    this.focusCamera();
    this.updateSelectionBubble();
    this.tuneQuality(ms, elapsed, interval);
    this.updateSound();
    this.onAir();
    this.soundscape(dt);
    this.perf?.mark('tick');
    const { ghost, highlight } = this.ghost();
    const frame: Frame = {
      room: shown,
      catalog: this.engine.catalog,
      walker: this.seat ? { x: this.seat.x, y: this.seat.y, facing: this.walker.facing } : this.walker,
      seat: this.seat ? { pid: this.seat.pid, lift: this.seat.lift, mode: this.seat.mode, axis: this.seat.axis, look: this.look } : null,
      washAt: this.performing?.wash,
      playerLayers: this.playerSprite(),
      pet: this.petSprite(),
      pets: this.housePetSprites(),
      minuteOfDay: this.debug.minuteOfDay ?? this.now() % 1440,
      time: this.time,
      ghost,
      highlight: highlight ?? this.examMarks() ?? this.exitCells(),
      selectedPids: this.selectedPid === null ? [] : [this.selectedPid],
      view: this.view,
      zoom: this.zoom,
      pan: this.pan,
      target: this.target,
      lowDetail: this.lowDetail,
      minimal: this.level >= 2,
      landscape: this.outdoors(),
      grounded: !this.outdoors() && !this.village?.def.underground && ['sky', 'forest', 'mountains'].includes(this.room.style_params.backdrop?.kind ?? 'sky'),
      underground: !!this.village?.def.underground,
      sitting: !!this.seat || (this.performing?.sitting ?? false),
      heroLift: this.seat ? undefined : this.heroLift,
      held: this.heldItem(),
      offhand: this.offhandItem(),
      heroGround: this.seat || this.location === 'home' ? 0 : groundAt(this.room, this.engine.catalog, this.walker.x, this.walker.y),
      insetBottom: this.mode === 'edit' ? this.edit.height() : this.dialogue.isOpen() ? 120 : 0,
      follow: this.location !== 'home' ? (this.seat ? { x: this.seat.x, y: this.seat.y } : this.walker) : null,
      overview: this.overview && this.location !== 'home',
      npcs: this.mode === 'edit' ? [] : this.paradeNow() ? [...this.npcsSeated(shown), ...(this.paradeNow()?.dancers ?? [])] : [...this.npcsSeated(shown), ...this.siteCrew()],
      movers: this.location !== 'home' ? (this.paradeNow() ? [...this.movers, ...(this.paradeNow()?.pieces ?? [])] : this.movers) : undefined,
      fires: this.firesHere(),
      sprays: this.spraysHere(),
      wires: this.outdoors() ? this.wiresHere() : undefined,
      bike: this.riding && this.outdoors() && !this.swimming() && !this.seat ? this.bikeRot : undefined,
      wind: this.sky === 'storm' ? 3.2 : this.sky === 'rain' ? 1.8 : this.sky === 'snow' ? 1.4 : this.sky === 'fog' ? 0.5 : 1,
      season: this.outdoors() ? this.seasonNow() : undefined,
      overcast: this.outdoors() ? this.overcast() : 0,
      lightning: !motionReduced() && this.outdoors() && this.sky === 'storm' && (Math.floor(this.time * 10) % 97 < 2 || Math.floor(this.time * 10) % 131 === 0),
      swimming: this.swimming(),
      sparkles: this.sparkles(),
      plant: this.outdoors() ? this.plantOnHorizon() : null,
      fireworks: this.outdoors() && fireworksAt(this.engine.festival(this.now()), this.debug.minuteOfDay ?? this.now() % 1440),
      driving: !!this.car,
      handLight: this.village?.def.dark && this.location !== 'home' ? this.handLight() : undefined,
      coins: this.coinsShown(),
    };
    if (this.car) frame.pet = null;
    this.perf?.mark('figures');
    this.renderer.draw(frame);
    this.perf?.mark('draw');
    this.skin.draw(dt);
    this.wondersFrame(frame);
    this.placeTags();
    this.stepGuide();
    this.perf?.mark('overlays');
    this.hud.root.classList.toggle('talking', this.dialogue.isOpen() || this.gifts.isOpen());
    this.frames++;
    this.lastWork = performance.now() - workFrom;
    this.perf?.end();
  }

  /** Where the frames' time goes (test builds with `?perf` only). */
  readonly perf: FramePerf | null = import.meta.env.MODE !== 'production' && typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf') ? new FramePerf() : null;

  /** A small toolbar floats above the selected item while editing. */
  private updateSelectionBubble(): void {
    const sel = this.mode === 'edit' && this.studioMode === 'items' && !this.held && this.selectedPid !== null ? this.room.placements.find((q) => q.pid === this.selectedPid) : undefined;
    const def = sel ? this.engine.catalog.items[sel.item] : undefined;
    if (!sel || !def || this.workshop.isOpen()) {
      if (this.mode === 'edit') this.bubble.hide();
      return;
    }
    const cells = def.layer === 'wall' ? [[0, 0]] : footprintCells(def, sel.rot);
    const w = Math.max(...cells.map((c) => c[0])) + 1;
    const d = Math.max(...cells.map((c) => c[1])) + 1;
    let ax = sel.x + w / 2;
    let ay = sel.y + d / 2;
    if (def.layer === 'wall' && sel.wall) {
      const [dx, dy] = ALONG[sel.wall];
      ax = sel.x + 0.5 + dx * (def.footprint.w - 1) * 0.5;
      ay = sel.y + 0.5 + dy * (def.footprint.w - 1) * 0.5;
    }
    const lift = def.layer === 'surface' && sel.on !== null ? topHeight(this.engine.catalog.items[this.room.placements.find((q) => q.pid === sel.on)?.item ?? ''] ?? def) : 0;
    const at = this.renderer.toScreen(ax, ay, (lift + topHeight(def)) * Z_PER_CENTI + 6);
    this.bubble.show(`sel:${sel.pid}`, at.x, at.y, [
      { icon: 'rotate', label: tr('game.act.rotate'), run: () => this.rotate() },
      { icon: 'copy', label: t('ui.duplicate'), run: () => this.duplicateSelected() },
      { icon: 'store', label: tr('game.act.store'), run: () => this.storeSelected() },
      { icon: 'check', label: t('ui.done'), primary: true, run: () => { this.selectedPid = null; this.pushEdit(); } },
    ]);
  }

  /** In the look editor the camera closes in on the player; leaving it restores the old view. */
  private focusCamera(): void {
    // playing an instrument, the camera comes close (above the keys at the bottom); watching TV, the hero on the
    // sofa stays in view beside the screen
    const playing = this.mode === 'walk' && this.media.instrument.isOpen();
    const watching = this.mode === 'walk' && this.media.tv.isOpen() && !!this.seat;
    if ((this.mode === 'edit' && this.studioMode === 'look') || playing || watching) {
      if (!this.saved) this.saved = { zoom: this.zoom, pan: { ...this.pan } };
      // the zoom goes in whole steps on screen: ease towards it and then settle on it exactly, and stop nudging the
      // view once it is within a pixel (else the camera hunts back and forth and everything trembles)
      const want = playing ? (this.location === 'home' ? 2.4 : 1.35) : watching ? 2.0 : 2.6;
      this.zoom = Math.abs(want - this.zoom) < 0.02 ? want : this.zoom + (want - this.zoom) * 0.12;
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 40);
      const wide = this.canvas.clientWidth > 600;
      const cx = watching && wide ? this.canvas.clientWidth * 0.27 : this.canvas.clientWidth / 2;
      const cy = playing ? this.canvas.clientHeight * 0.21 : watching ? this.canvas.clientHeight * (wide ? 0.5 : 0.2) : (this.canvas.clientHeight - this.edit.height()) / 2 + 24;
      const dx = cx - at.x;
      const dy = cy - at.y;
      if (Math.hypot(dx, dy) > 1.5) this.pan = this.clampPan({ x: Math.round(this.pan.x + dx * 0.15), y: Math.round(this.pan.y + dy * 0.15) });
    } else if (this.saved) {
      this.zoom += (this.saved.zoom - this.zoom) * 0.15;
      this.pan = { x: this.pan.x + (this.saved.pan.x - this.pan.x) * 0.15, y: this.pan.y + (this.saved.pan.y - this.pan.y) * 0.15 };
      if (Math.abs(this.zoom - this.saved.zoom) < 0.01 && Math.hypot(this.pan.x - this.saved.pan.x, this.pan.y - this.saved.pan.y) < 1) {
        this.zoom = this.saved.zoom;
        this.pan = this.saved.pan;
        this.saved = null;
      }
    }
  }

  /** Quality ladder for slow devices: full, then fewer details and a lower pixel ratio, then lower still. */
  private level = 0;

  private setLevel(level: number): void {
    this.level = level;
    this.lowDetail = level >= 1;
    this.sound.setLowPower(level >= 2);
    this.renderer.setMaxPixelRatio(level === 0 ? 2 : level === 1 ? 1.25 : 1);
  }

  private ladder = new QualityLadder(0);
  private ladderFor: Prefs['quality'] | null = null;
  /** How long the last frame's own work took (ms). */
  private lastWork = 0;

  private tuneQuality(now: number, elapsed: number, interval: number): void {
    if (this.prefs.quality !== 'auto') return;
    if (this.ladder.frame(now, elapsed, interval, this.lastWork)) this.setLevel(this.ladder.level);
  }

  private updateSound(): void {
    const minute = this.debug.minuteOfDay ?? this.now() % 1440;
    const lit = this.room.placements.some((p) => p.item === 'fireplace' && p.props?.lit !== '0');
    const dark = daylight(lightMinute(this.room.settings, minute)).dark;
    const now = this.now();
    const fest = this.engine.festival(now);
    const day = this.today();
    // the feast the town's music follows: a celebration on its day, or the holiday itself (the town's own ones)
    const festival = fest && fest.phase === 'day' ? fest.id : day.festive ? day.holiday_id : null;
    this.sound.update(
      {
        dark, weather: this.room.style_params.weather?.kind ?? 'none', backdrop: this.room.style_params.backdrop?.kind ?? 'void', moving: this.moving, fire: lit && dark > 0.2, active: true,
        place: this.musicPlace(), playing: this.playingNow(), minute, season: this.season as MoodScene['season'], day: Math.floor(now / 1440), festival, outdoors: this.outdoors(),
        around: this.around ?? undefined, surface: this.moving ? this.surfaceNow() : undefined,
      },
      this.time,
    );
  }

  // ---- one room at a time ------------------------------------------------------------------------------

  private regions(): Regions {
    return regionsOf(this.room, (x, y) => {
      const painted = this.room.floor_paint[cellKey(x, y)];
      const params = (painted ? this.engine.catalog.styles[painted]?.params : undefined) ?? this.room.style_params.floor ?? {};
      return params.outdoor === '1';
    });
  }

  private regionAt(x: number, y: number): number {
    return this.regions().of.get(cellKey(Math.floor(x), Math.floor(y))) ?? 0;
  }

  private currentRegion(): number {
    const r = this.regions();
    if (this.mode === 'edit' && this.viewRegion !== null && this.viewRegion < r.list.length) return this.viewRegion;
    return this.regionAt(this.walker.x, this.walker.y);
  }

  /** A name for a room from what is in it. */
  private regionName(id: number): string {
    const region = this.regions().list[id];
    if (!region) return tr('game.room.generic');
    // a room the builders built (or are building) keeps the name it was ordered by
    if (this.engine.catalog.builds) {
      const [fx, fy] = region.cells[0];
      const o = this.engine.builds(this.now()).orders.find((q) => fx >= q.x && fy >= q.y && fx < q.x + q.w && fy < q.y + q.d);
      if (o) return o.done ? o.name : tr('game.room.site');
    }
    if (region.outdoor) {
      const keys2 = new Set(region.cells.map(([x, y]) => cellKey(x, y)));
      const farm = this.room.placements.some((p) => keys2.has(cellKey(p.x, p.y)) && this.engine.catalog.items[p.item]?.category === 'farm');
      const soil = region.cells.filter(([x, y]) => this.room.floor_paint[cellKey(x, y)] === 'floor.soil').length * 2 > region.cells.length;
      return farm || soil ? tr('game.room.farm') : tr('game.room.garden');
    }
    const keys = new Set(region.cells.map(([x, y]) => cellKey(x, y)));
    const items = new Set(this.room.placements.filter((p) => keys.has(cellKey(p.x, p.y))).map((p) => p.item));
    const has = (...ids: string[]) => ids.some((i) => items.has(i));
    if ([...items].some((i) => this.engine.catalog.items[i]?.category === 'orangery') || region.cells.some(([x, y]) => this.room.floor_paint[cellKey(x, y)] === 'floor.terracotta_tiles')) return tr('game.room.orangery');
    if (has('bathtub', 'toilet', 'shower', 'washbasin')) return tr('game.room.bath');
    if (has('stove', 'fridge', 'counter', 'counter_sink', 'kitchen_island')) return tr('game.room.kitchen');
    if (has('bed', 'bed_single', 'bunk_bed', 'canopy_bed', 'futon')) return tr('game.room.bedroom');
    if (has('desk', 'desk_l', 'computer', 'office_chair')) return tr('game.room.study');
    if (has('sofa2', 'sofa3', 'sofa_l', 'tv', 'chesterfield', 'sofa_modern2', 'sofa_modern3')) return tr('game.room.living');
    return tr('game.room.n', { n: id + 1 });
  }

  /** The room drawn now: only the region being shown, with its own walls. */
  private festiveDay = -1;
  private festiveCache: FestiveKind[] = [];

  private paradeCache: { time: number; value: { pieces: ParadePiece[]; dancers: NonNullable<Frame['npcs']> } | null } = { time: -1, value: null };

  /** The Lunar New Year's dragon dancing down the main street from the square and back, its dancers under it. */
  private paradeNow(): { pieces: ParadePiece[]; dancers: NonNullable<Frame['npcs']> } | null {
    if (this.paradeCache.time === this.time) return this.paradeCache.value;
    let value: { pieces: ParadePiece[]; dancers: NonNullable<Frame['npcs']> } | null = null;
    const minute = this.debug.minuteOfDay ?? this.now() % 1440;
    const clock = this.village?.def.id === 'village' ? paradeClock(this.engine.festival(this.now()), minute) : null;
    if (clock !== null && this.village) {
      // the main street: from the square's fountain to the school (or the church), as the paths go
      const props = this.village.def.props;
      const from = props.find((p) => p.item === 'fountain') ?? props.find((p) => p.item === 'town_hall');
      const to = props.find((p) => p.item === 'school') ?? props.find((p) => p.item === 'church');
      if (from && to) {
        const a = this.village.routes.spot(from.x, from.y + 3);
        const b = this.village.routes.spot(to.x, to.y + 4);
        const route = this.village.routes.route('parade', a, b);
        // the dance goes by the clock (a still clock in screenshots: by the seconds the page has run)
        const pieces = dragonAt(route, clock + (this.debug.minuteOfDay !== undefined ? this.time % 600 : 0));
        const people = Object.keys(this.engine.catalog.residents ?? {}).filter((id) => (this.engine.catalog.residents?.[id] as Townsfolk | undefined)?.age === 'adult');
        const step = Math.floor(this.time * 8) % 4;
        const dancers: NonNullable<Frame['npcs']> = [];
        pieces.forEach((p, k) => {
          const id = people[(k * 7) % Math.max(1, people.length)];
          const look = id ? this.lookOf(id) : null;
          if (!look) return;
          const [dx, dy] = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.rot] as [number, number];
          const [rx, ry] = rotXY(this.view, dx, dy);
          dancers.push({ id: `parade:${k}`, x: p.x - dx * 0.05, y: p.y - dy * 0.05, layers: residentLayers(look, dirOf(rx - ry, (rx + ry) / 2, 'down'), true, step, (this.engine.catalog.residents?.[id] ?? {}) as Townsfolk, k) });
        });
        value = { pieces, dancers };
      }
    }
    this.paradeCache = { time: this.time, value };
    return value;
  }

  /** The plant beyond the fields as far as it has been built (nothing before its site is fenced). */
  private plantOnHorizon(): Frame['plant'] {
    const n = this.engine.npp(this.now());
    return n && n.stage >= 6 ? { stage: n.stage, built: n.built } : null;
  }

  /** The feasts whose decorations are out today (by the real calendar), and how far the town is with them. */
  private festiveStageCache: FestiveStage = { phase: 'day', ready: 1 };

  private festive(): FestiveKind[] {
    const now = this.now();
    const day = Math.floor(now / 1440);
    if (day !== this.festiveDay) {
      const today = this.engine.calendarDay(now);
      const fest = { holiday: today.info.holiday?.id ?? null, festival: this.engine.festival(now), npp: this.engine.npp(now)?.event ?? null };
      this.festiveCache = festiveKinds(today.month, today.day, fest);
      this.festiveStageCache = festiveStage(fest);
      this.festiveDay = day;
    }
    return this.festiveCache;
  }

  private shownRoom(): RoomView {
    if (this.location !== 'home') {
      this.hud.setRoom(this.village?.def.name ?? tr('game.room.town'), 0, 1);
      return this.room;
    }
    const r = this.regions();
    if (r.list.length <= 1) return this.withGarden(this.room);
    const id = this.currentRegion();
    if (id === -1) {
      // the whole house at once (the editor's plan view)
      this.hud.setRoom(tr('game.room.wholeHouse'), -1, r.list.length);
      if (this.shownRegion !== -1) {
        this.shownRegion = -1;
        this.pan = { x: 0, y: 0 };
      }
      if (this.wholeCache?.room !== this.room) this.wholeCache = { room: this.room, view: this.withSite(this.withGarden(this.withUtilities({ ...this.room, home_cells: this.room.cells }))) };
      return this.wholeCache.view;
    }
    if (id !== this.shownRegion) {
      if (this.shownRegion >= 0) {
        this.fader.classList.add('on');
        window.setTimeout(() => this.fader.classList.remove('on'), 140);
      }
      this.shownRegion = id;
      this.pan = { x: 0, y: 0 };
    }
    this.hud.setRoom(this.regionName(id), id, r.list.length);
    // the same object while nothing changes, so the renderer's layers stay cached
    const util = this.utilityKey() + '|' + this.gardenKey() + '|' + (this.engine.catalog.builds ? this.engine.builds(this.now()).orders.filter((o) => !o.done).map((o) => `${o.n}:${o.stage}:${o.due}`).join(',') : '');
    const feast = this.mode === 'walk' ? this.festive().join(',') : '';
    if (this.shownCache?.room !== this.room || this.shownCache.id !== id || this.shownCache.util !== util || this.shownCache.feast !== feast) {
      const view = this.withSite(this.withGarden(this.withUtilities(viewOf(this.room, this.engine.catalog, r, id))));
      // the feasts reach home too: a little fir in a free corner (only to look at, not part of the room)
      const deco = feast ? homeDecorations(view, this.engine.catalog, this.festive(), view.cells) : [];
      this.shownCache = { room: this.room, id, util, feast, view: deco.length ? { ...view, placements: [...view.placements, ...deco] } : view };
    }
    return this.shownCache.view;
  }

  /** What grows and what hangs painted, as a key (the shown room changes with it). */
  private gardenKey(): string {
    const plots = this.engine.garden(this.now()).map((p) => `${p.pid}:${p.model ?? ''}`).join(',');
    const art = this.room.placements.filter((p) => p.props?.art).map((p) => `${p.pid}=${p.props.art}`).join(',');
    return `${plots}#${art}#${this.engine.paintings().length}`;
  }

  /**
   * The home as it grows: each plot shows its plant's stage (a thing drawn on the plot, its pid tells the plot), and
   * a canvas painted at the easel shows its picture (a look made from its pixels).
   */
  private withGarden(view: RoomView): RoomView {
    const plots = this.engine.garden(this.now()).filter((p) => p.model);
    const painted = view.placements.some((p) => p.props?.art);
    if (plots.length === 0 && !painted) return view;
    const at = new Map(view.placements.map((p) => [p.pid, p]));
    const growing: PlacementView[] = [];
    for (const plot of plots) {
      const p = at.get(plot.pid);
      const def = plot.model ? this.engine.catalog.items[plot.model] : undefined;
      if (!p || !def) continue;
      const colors = Object.fromEntries(Object.entries(def.slots ?? {}).map(([k, v]) => [k, v.default]));
      growing.push({ pid: PLANT_PID - plot.pid, item: def.id, x: p.x, y: p.y, rot: p.rot, wall: null, on: null, colors, props: {}, known: true });
    }
    const placements = view.placements.map((p) => (p.props?.art ? this.paintedCanvas(p) : p));
    return { ...view, placements: [...placements, ...growing] };
  }

  /** A canvas with its picture: a look made once per painting from its 16×12 pixels (runs of a colour). */
  private paintedCanvas(p: PlacementView): PlacementView {
    const index = Number(p.props.art);
    const art = this.engine.paintings().find((x) => x.index === index);
    const base = this.engine.catalog.items[p.item];
    if (!art || !base) return p;
    const id = `${p.item}#${index}`;
    if (!this.engine.catalog.items[id]) {
      const model = base.model.filter((m) => m.slot === 'frame');
      for (let y = 0; y < ART_H; y++) {
        let x = 0;
        while (x < ART_W) {
          const c = art.pixels[y * ART_W + x];
          let w = 1;
          while (x + w < ART_W && art.pixels[y * ART_W + x + w] === c) w++;
          model.push({ box: [18 + x * 4, 6, 88 - (y + 1) * 4, w * 4, 2, 4], slot: `c${c}` });
          x += w;
        }
      }
      const slots = { ...base.slots, ...Object.fromEntries(ART_COLORS.map((c, i) => [`c${i.toString(16)}`, { default: c, palette: 'pastel' }])) };
      this.engine.catalog.items[id] = { ...base, id, model, slots };
    }
    const def = this.engine.catalog.items[id];
    const colors = { ...p.colors, ...Object.fromEntries(Object.entries(def.slots ?? {}).filter(([k]) => k.startsWith('c')).map(([k, v]) => [k, v.default])) };
    return { ...p, item: id, colors };
  }

  /** Which utilities are off, as a key (the shown room changes with it). */
  private utilityKey(): string {
    return (this.bills?.utilities ?? []).filter((u) => !u.on).map((u) => u.id).join(',');
  }

  /**
   * The home as the unpaid bills leave it: without electricity no lamp, screen or radio is on; with the garbage
   * not taken away, bags of it pile up outside by the house.
   */
  private withUtilities(view: RoomView): RoomView {
    const off = new Set((this.bills?.utilities ?? []).filter((u) => !u.on).map((u) => u.id));
    if (off.size === 0) return view;
    let placements = view.placements;
    if (off.has('power')) {
      placements = placements.map((p) => {
        const def = this.engine.catalog.items[p.item];
        const electric = !!def && ['light', 'switch', 'power'].some((t) => def.tags.includes(t)) && !def.tags.includes('self_glow');
        return electric ? { ...p, props: { ...p.props, lit: '0' } } : p;
      });
    }
    if (off.has('garbage') && this.engine.catalog.items.trash_bags) {
      // a few bags in the garden cells nearest the house, where nothing stands
      const outdoor = (x: number, y: number) => this.engine.catalog.styles[this.room.floor_paint[cellKey(x, y)] ?? '']?.params.outdoor === '1';
      const blocked = gridOf(view, this.engine.catalog).blocked;
      const spots = view.cells.filter(([x, y]) => outdoor(x, y) && !blocked.has(cellKey(x, y))).sort((a, b) => a[0] + a[1] - (b[0] + b[1])).slice(0, 3);
      const bagDef = this.engine.catalog.items.trash_bags;
      const colors = Object.fromEntries(Object.entries(bagDef.slots ?? {}).map(([k, v]) => [k, v.default]));
      placements = [...placements, ...spots.map(([x, y], i): PlacementView => ({ pid: -100 - i, item: 'trash_bags', x, y, rot: i % 4, wall: null, on: null, colors, props: {}, known: true }))];
    }
    return { ...view, placements };
  }

  /** Arrows in the top bar: in the editor they turn the view; walking, they take the player there. */
  private switchRoom(dir: 1 | -1): void {
    const r = this.regions();
    if (r.list.length <= 1) return;
    const next = (Math.max(0, this.currentRegion()) + dir + r.list.length) % r.list.length;
    if (this.mode === 'edit') {
      // in the editor the arrows also go round to the whole house at once (between the last room and the first)
      const cur = this.viewRegion === -1 ? -1 : this.currentRegion();
      const to = cur + dir;
      this.viewRegion = to < -1 ? r.list.length - 1 : to >= r.list.length ? -1 : to;
      this.selectedPid = null;
      this.held = null;
      this.pushEdit();
      return;
    }
    const region = r.list[next];
    const cx = region.cells.reduce((a, c) => a + c[0], 0) / region.cells.length;
    const cy = region.cells.reduce((a, c) => a + c[1], 0) / region.cells.length;
    const spot = [...region.cells].sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
    this.seat = null;
    this.path = null;
    this.walker.x = spot[0] + 0.5;
    this.walker.y = spot[1] + 0.5;
    settle(this.walker, this.room, this.engine.catalog);
    this.pet.x = this.walker.x;
    this.pet.y = this.walker.y;
    settle(this.pet, this.room, this.engine.catalog);
  }

  /** Using a door: walk through it to the room behind; an outside door leads to the garden if there is one. */
  private goThrough(pid: number): boolean {
    const p = this.room.placements.find((q) => q.pid === pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (!p || !def || !p.wall) return false;
    const here = this.regionAt(this.walker.x, this.walker.y);
    const r = this.regions();
    for (const [x, y, side] of wallEdgesOfItem(def, p.x, p.y, p.wall)) {
      const [dx, dy] = side === 'east' ? [1, 0] : side === 'west' ? [-1, 0] : side === 'south' ? [0, 1] : [0, -1];
      for (const [ax, ay, bx, by] of [[x, y, x + dx, y + dy], [x + dx, y + dy, x, y]]) {
        if (r.of.get(cellKey(ax, ay)) === here && r.of.has(cellKey(bx, by)) && r.of.get(cellKey(bx, by)) !== here) {
          this.walkTo([[bx, by]]);
          return true;
        }
      }
    }
    if (this.engine.catalog.front && !def.tags.includes('portal')) return false;
    const garden = r.list.find((g) => g.outdoor && g.id !== here);
    if (garden && !def.tags.includes('portal')) {
      this.viewRegion = null;
      const near = garden.cells[0];
      this.walker.x = near[0] + 0.5;
      this.walker.y = near[1] + 0.5;
      settle(this.walker, this.room, this.engine.catalog);
      this.pet.x = this.walker.x;
      this.pet.y = this.walker.y;
      return true;
    }
    return false;
  }

  // ---- the day: gathering, fishing, requests, letters, stories ---------------------------------

  private refreshDaily(): void {
    if (!this.engine.catalog.collections) return;
    const before = this.daily;
    this.daily = this.engine.daily(this.now());
    this.hud.setToday(todayCount(this.daily));
    this.todayPanel.update(this.daily);
    // a new morning: say there is mail
    if (before && before.day !== this.daily.day) {
      this.morningNews();
      this.morningPaper();
    }
  }

  private morningNews(): void {
    const d = this.daily;
    if (!d) return;
    const unread = d.letters.filter((l) => !l.opened).length;
    if (unread > 0) this.toasts.show(unread === 1 ? tr('game.mail.one') : tr('game.mail.new', { n: unread }), { icon: 'mail', kind: 'good', ms: 3200 });
    // the bills: switched off is said every morning, due ones the first days of the month
    const bills = this.engine.bills(this.now());
    const off = bills.utilities.filter((u) => !u.on);
    const due = bills.bills.filter((b) => !b.paid);
    if (off.length > 0) window.setTimeout(() => this.toasts.show(tr('game.bills.off', { list: off.map((u) => u.name.toLowerCase()).join(', ') }), { kind: 'error', icon: 'coin', ms: 5200 }), 3600);
    else if (due.length > 0) window.setTimeout(() => this.toasts.show(tr('game.bills.due', { total: bills.total_due, due: due[0].due }), { icon: 'coin', ms: 4200 }), 3600);
    else if (d.requests.some((r) => !r.done)) this.toasts.show(tr('game.someoneWaits'), { icon: 'heart', ms: 3000 });
  }

  // ---- the notebook: promises to the town's people ------------------------------------------------------

  private quests: QuestsView | null = null;

  private locationNames(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, l] of Object.entries(this.engine.catalog.locations ?? {})) out[id] = l.name;
    return out;
  }

  private trackedKey(): string | null {
    let key: string | null = null;
    try {
      key = localStorage.getItem('teul.tracked');
    } catch {
      // storage blocked: follow the first promise
    }
    const active = this.quests?.active ?? [];
    if (key === '-') return null;
    return active.some((q) => q.key === key) ? key : (active[0]?.key ?? null);
  }

  private setTracked(key: string | null): void {
    try {
      localStorage.setItem('teul.tracked', key ?? '-');
    } catch {
      // see above
    }
    this.refreshQuests();
  }

  private refreshQuests(): void {
    this.quests = this.engine.quests(this.now());
    this.nextLetter();
    const key = this.trackedKey();
    const q = this.quests.active.find((a) => a.key === key);
    this.hud.setQuest(q ? hudLine(q, this.locationNames()) : null);
    if (this.journal?.isOpen()) this.journal.refresh(this.quests);
  }

  private openJournal(tab?: 'promised' | 'asked' | 'done'): void {
    this.quests = this.engine.quests(this.now());
    this.journal.open(this.quests, tab);
  }

  /** Promises to do it. */
  private promise(key: string): void {
    const offer = this.quests?.offers.find((o) => o.key === key);
    const r = this.run({ type: 'quest_start', quest: key });
    if (!r.ok) return;
    this.sound.sfx('chime');
    this.ask.close();
    if (offer) this.toasts.show(tr('game.promised', { title: offer.title }), { icon: 'paper', ms: 3000 });
  }

  private questStep(key: string, choice: number | null): void {
    // the dialog closes first: finishing opens the thanks
    this.ask.close();
    this.run({ type: 'quest_step', quest: key, choice });
  }

  /** What the quest events of a command mean to the player: a word when a step is done, thanks at the end. */
  private questNews(result: CommandResult): void {
    if (!result.ok) return;
    const before = this.questsBefore;
    this.questsBefore = this.quests;
    for (const ev of result.events) {
      const k = ev.kind as { type: string; quest?: string; choice?: number | null; reward?: { coins: number; items: string[]; recipes: string[]; title?: string | null } };
      if (k.type === 'QuestAdvanced') {
        const q = before?.active.find((a) => a.key === k.quest);
        const chosen = q && q.act.do === 'choose' && k.choice !== null && k.choice !== undefined ? q.act.options[k.choice]?.text : '';
        const said = chosen || q?.done;
        if (said) this.toasts.show(said, { icon: 'heart', kind: 'good', ms: 4200 });
      } else if (k.type === 'QuestDone') {
        const q = before?.active.find((a) => a.key === k.quest) ?? before?.offers.find((o) => o.key === k.quest);
        const done = this.quests?.done.find((d) => d.key === k.quest);
        const r = k.reward;
        const lines: { text: string; ok?: boolean }[] = [];
        if (r?.coins) lines.push({ text: tr('game.coinsN', { n: r.coins }) });
        for (const item of r?.items ?? []) lines.push({ text: this.itemName(item) });
        for (const rc of r?.recipes ?? []) lines.push({ text: tr('game.learned', { what: this.engine.recipes(this.now()).find((x) => x.id === rc)?.name ?? rc }) });
        if (r?.title) lines.push({ text: tr('game.titled', { title: r.title }) });
        this.sound.sfx('chime');
        vibrate(this.prefs, [12, 40, 12]);
        this.ask.open({
          who: q?.giver_name ?? done?.giver_name ?? '',
          title: q?.title ?? done?.title,
          text: done?.bye || tr('game.thanks'),
          lines,
          choices: [{ label: tr('game.notAtAll'), primary: true, run: () => this.ask.close() }],
        });
      }
    }
  }

  private questsBefore: QuestsView | null = null;

  /** Someone tapped who asks something of you, or whom a promise is about: they say it. */
  private questWith(person: string): boolean {
    const v = this.engine.quests(this.now());
    this.questsBefore = v;
    const mine = v.active.find((q) => q.who === person && q.here);
    if (mine) {
      const choices =
        mine.act.do === 'choose'
          ? mine.act.options.map((o, i) => ({ label: o.label, primary: i === 0, run: () => this.questStep(mine.key, i) }))
          : [{ label: mine.act.do === 'bring' ? tr('game.give') : tr('game.yes'), primary: true, disabled: !mine.ready, run: () => this.questStep(mine.key, null) }];
      this.ask.open({ who: mine.giver_name, title: mine.title, text: mine.text, choices: [...choices, { label: tr('game.later'), run: () => this.ask.close() }] });
      return true;
    }
    const offer = v.offers.find((o) => o.giver === person && o.can_start && !o.reason);
    if (offer) {
      this.ask.open({
        who: offer.giver_name,
        title: offer.title,
        text: offer.intro,
        choices: [
          { label: tr('game.willHelp'), primary: true, run: () => this.promise(offer.key) },
          { label: tr('game.anotherTime'), run: () => this.ask.close() },
        ],
      });
      return true;
    }
    return false;
  }

  // ---- while you were away --------------------------------------------------------------------------

  /** The last world minute the player was here (kept on this device). */
  private rememberSeen(): void {
    if (!this.started || this.debug.demo) return;
    try {
      localStorage.setItem('teul.lastSeen', String(this.now()));
    } catch {
      // storage blocked: no summary next time, nothing else changes
    }
  }

  /** After a day or more away: the issues missed (their front pages) and the paper's short note; null otherwise. */
  private welcomeBack(): AwayIssues | null {
    let last = NaN;
    try {
      last = Number(localStorage.getItem('teul.lastSeen'));
    } catch {
      // see rememberSeen
    }
    const now = this.now();
    this.rememberSeen();
    if (!Number.isFinite(last) || last <= 0 || now - last < 1440 || this.debug.demo) return null;
    const days = Math.floor((now - last) / 1440);
    const today = Math.floor(now / 1440);
    const holidays: string[] = [];
    for (let d = Math.floor(last / 1440) + 1; d < today && holidays.length < 6 && d > today - 62; d++) {
      const h = this.engine.calendarDay(d * 1440 + 720).info.holiday;
      if (h?.festive && !holidays.includes(h.name)) holidays.push(h.name);
    }
    // the front pages of the issues missed, the latest first (five at most)
    const issues: AwayIssues['issues'] = [];
    for (let d = today - 1; d > Math.floor(last / 1440) && issues.length < 5; d--) {
      const p = this.engine.paper(d * 1440 + 420);
      issues.push({ day: d, date: p.date, story: p.headline });
    }
    const daily = this.daily;
    const waiting = [...new Set((daily?.requests ?? []).filter((r) => !r.done).map((r) => r.name.split(' ')[0]))].slice(0, 3);
    const off: Record<string, string> = { water: tr('game.away.water'), gas: tr('game.away.gas'), electricity: tr('game.away.electricity'), garbage: tr('game.away.garbage') };
    const note = awayNote({
      days,
      sky: this.sky,
      season: this.season,
      holidays,
      news: [],
      waiting,
      letters: (daily?.letters ?? []).filter((l) => !l.opened).length,
      bills: (this.bills?.bills ?? []).filter((b) => !b.paid).map((b) => ({ name: b.name, amount: b.amount, overdue: b.overdue })),
      switchedOff: (this.bills?.utilities ?? []).filter((u) => !u.on).map((u) => off[u.id] ?? u.name.toLowerCase()),
    });
    return { note, issues };
  }

  /** A newspaper photo's scene: the story's place on its day — its season, weather, light, decorations, people. */
  /** The door of where one lives now on the town's map, with the home's own name if one gave it one. */
  private homeDoor(): { loc: string; x: number; y: number; name: string | null } | null {
    const door = this.engine.taxiDestinations('village', 0, 0, this.now()).find((d) => d.id === 'taxi.home');
    return door ? { loc: door.location, x: door.x, y: door.y, name: this.homeRoom.settings['home.name'] || null } : null;
  }

  /** Today's weekday: 0 Monday … 6 Sunday. */
  private weekdayNow(): number {
    return Math.max(0, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(this.engine.dayView(this.now()).weekday_id));
  }

  private photoScene(hint: PhotoHint, day: number): PhotoScene | null {
    const catalog = this.engine.catalog;
    const minute = hint.minute ?? 12 * 60;
    const at = day * 1440 + minute;
    if (hint.place === 'home') {
      return { room: this.homeRoom, landscape: false, grounded: true, underground: false, focus: { x: 4.5, y: 4.5 }, npcs: [], minute, overcast: 0, wide: false };
    }
    const def = catalog.locations?.[hint.place];
    if (!def) return null;
    const cal = this.engine.calendarDay(at);
    const fest = { holiday: cal.info.holiday?.id ?? null, festival: this.engine.festival(at), npp: this.engine.npp(at)?.event ?? null };
    const festive = festiveProps(def, catalog, festiveKinds(cal.month, cal.day, fest), festiveStage(fest));
    // the story's own things: where they are on the map, or stood near its spot for the picture
    const findProp = (item: string) => [...def.props, ...festive].find((p) => p.item === item);
    const first = hint.props.map(findProp).find(Boolean);
    const centreOf = (p: { item: string; x: number; y: number }) => {
      const f = catalog.items[p.item]?.footprint ?? { w: 1, d: 1 };
      return [p.x + f.w / 2, p.y + f.d / 2] as [number, number];
    };
    const spot: [number, number] = hint.at ? [hint.at[0] + 0.5, hint.at[1] + 0.5] : first ? centreOf(first) : [def.w / 2, def.h / 2];
    const missing = hint.props.filter((p) => !findProp(p) && catalog.items[p]);
    const extra = standNear(def, catalog, missing, [Math.floor(spot[0]) + 2, Math.floor(spot[1]) + 2], festive);
    const flags = new Set(this.engine.town(at).flags);
    const loc = locationRoom(def, catalog, this.homeRoom, 0, day, [...festive, ...extra], this.engine.dayView(at).rift ?? false, flags);
    const outdoors = !def.inside && !def.underground;
    let sky = 'clear';
    try {
      sky = JSON.parse(this.engine.weatherAt(at)) as string;
    } catch {
      // clear
    }
    if (outdoors) loc.room.style_params.weather = { kind: sky === 'storm' || sky === 'rain' || sky === 'snow' || sky === 'fog' ? sky : 'none' };
    const world = this.engine.world(at);
    // the people of the story, and a few more about on a celebration
    const routes = new Routes(loc, catalog);
    const crowd = fest.festival?.phase === 'day' || cal.info.holiday?.festive ? 9 : hint.people.length > 0 ? 0 : 3;
    const residents = Object.keys(catalog.residents ?? {});
    const ids = [...hint.people, ...Array.from({ length: crowd }, (_, k) => residents[(day * 13 + k * 17) % Math.max(1, residents.length)])].filter(Boolean);
    const npcs: NonNullable<Frame['npcs']> = [];
    ids.forEach((id, k) => {
      const def2 = catalog.residents?.[id] as Townsfolk | undefined;
      const look0 = this.lookOf(id);
      if (!def2 || !look0) return;
      const settings: Record<string, string> = Object.fromEntries(Object.entries(def2.look).map(([a, v]) => [`look.${a}`, v]));
      Object.assign(settings, dressForWeather({ season: world.season, sky, outdoors }, idSeed(id), def2.age, false));
      const look = lookFromSettings(settings);
      const angle = k * 2.4;
      const r = 1.6 + (k % 4) * 0.9;
      const [x, y] = routes.spot(Math.floor(spot[0] + Math.cos(angle) * r), Math.floor(spot[1] + 2 + Math.sin(angle) * r));
      npcs.push({ id: `photo:${id}:${k}`, x, y, layers: residentLayers(look, k % 3 === 0 ? 'right' : k % 3 === 1 ? 'left' : 'down', false, 0, def2, idSeed(id)), scale: def2.age === 'child' ? 0.78 : undefined });
    });
    const n = this.engine.npp(at);
    return {
      room: loc.room,
      landscape: outdoors,
      grounded: !outdoors && !def.underground,
      underground: !!def.underground,
      focus: hint.far ? { x: def.w * 0.35, y: 1 } : { x: spot[0], y: spot[1] },
      npcs,
      minute,
      season: outdoors ? `${world.season}:${world.season_phase ?? 1}` : undefined,
      overcast: outdoors ? ({ clear: 0, cloudy: 0.35, fog: 0.4, rain: 0.7, snow: 0.45, storm: 1 }[sky] ?? 0) : 0,
      plant: outdoors && n && n.stage >= 6 ? { stage: n.stage, built: n.built } : null,
      wide: hint.far,
      panorama: hint.far && outdoors,
    };
  }

  // ---- photos: memories kept on this device ------------------------------------------------------------

  private album(): Promise<Album> {
    this.albumDb ??= openAlbum();
    return this.albumDb;
  }

  private enterPhoto(): void {
    if (this.mode !== 'walk' || this.photoBar.isOpen()) return;
    this.bubble.hide();
    this.rootEl.classList.add('photo-mode');
    this.photoBar.open();
  }

  private leavePhoto(): void {
    this.photoBar.close();
    this.albumSheet.close();
    this.rootEl.classList.remove('photo-mode');
    this.pan = this.clampPan(this.pan);
  }

  private async takePhoto(look: PhotoFilter): Promise<void> {
    this.sound.sfx('switch');
    const now = this.now();
    const place = this.location === 'home' ? tr('game.home') : (this.village?.def.name ?? tr('game.lypove'));
    try {
      const url = capture(this.canvas, look, Math.floor(Date.now() / 1000));
      await (await this.album()).add(url, { taken: Date.now(), place, season: this.season || 'Autumn', day: Math.floor(now / 1440) });
      this.toasts.show(tr('game.photo.saved'), { icon: 'camera', kind: 'good', ms: 1600 });
    } catch {
      this.toasts.show(tr('game.photo.failed'), { kind: 'error', icon: 'lock' });
    }
  }

  // ---- the pocket, the chest at home --------------------------------------------------------------

  private itemName(item: string): string {
    const def = this.engine.catalog.items[item];
    return def ? t(def.name) : item;
  }

  // ---- a town that lives on: projects, birthdays, invitations, visitors, the rare day -----------------------

  private townNow(): TownView {
    return this.engine.town(this.now());
  }

  /** The town's flags a place is drawn with now: the core's, and the stop the ice-cream cart stands at this hour. */
  private placeFlags(): string[] {
    return withCartFlag(this.engine.catalog.growth, this.townNow().flags, Math.floor(this.now()) % 1440);
  }

  /** Every second or so: the place redrawn when the town changed (built, opened, a storm), invitations told. */
  private checkTown(dt: number): void {
    this.townCheck -= dt;
    if (this.townCheck > 0 || !this.started) return;
    this.townCheck = 1.5;
    // a letter waiting since a dialog was open
    this.nextLetter();
    const t = this.townNow();
    const key = this.placeFlags().join('|');
    if (this.location !== 'home' && this.village && key !== this.townKey) this.reloadPlace();
    const today = Math.floor(this.now() / 1440);
    for (const inv of t.invitations) {
      if (inv.done) continue;
      const k = `${inv.host}:${inv.day}`;
      if (inv.active && this.location !== 'guest_home' && !this.invitesSeen.has(`${k}:go`) && !this.ask.isOpen()) {
        this.invitesSeen.add(`${k}:go`);
        this.sound.sfx('chime');
        this.ask.open({
          who: inv.name,
          text: tr('game.dinner.calls', { name: firstName(inv.name) }),
          choices: [
            { label: tr('game.dinner.go'), primary: true, run: () => this.goToDinner() },
            { label: tr('game.dinner.notToday'), run: () => this.ask.close() },
          ],
        });
      } else if (!inv.active && (inv.day === today || inv.day === today + 1) && !this.invitesSeen.has(`${k}:told`)) {
        this.invitesSeen.add(`${k}:told`);
        const at = `${String(Math.floor(inv.from / 60)).padStart(2, '0')}:${String(inv.from % 60).padStart(2, '0')}`;
        this.toasts.show(tr('game.dinner.invites', { name: firstName(inv.name), when: inv.day === today ? tr('game.today') : tr('game.tomorrow'), at }), { icon: 'heart', kind: 'good', ms: 5200 });
      }
    }
  }

  /** The place on screen built again with the town as it is now (keeping the player where they stand). */
  private reloadPlace(): void {
    const v = this.village;
    if (!v) return;
    const flags = this.placeFlags();
    this.townKey = flags.join('|');
    const def = this.wonders.withSky(this.engine.catalog.locations?.[v.def.id] ?? v.def, this.wonders.skyNow(this.wondersHost()));
    const loc = locationRoom(def, this.engine.catalog, this.homeRoom, def.props.some((p) => p.min_fill) ? this.engine.life(this.now()).dump : 0, Math.floor(this.now() / 1440), [...festiveProps(def, this.engine.catalog, this.festive(), this.festiveStageCache), ...this.carProps(def.id)], this.today().rift, new Set(flags), this.iceToday());
    this.village = { def, loc, routes: new Routes(loc, this.engine.catalog), drives: new Drives(roadRoom(loc.room), this.engine.catalog) };
    this.renderer.prewarm(loc.room, this.engine.catalog);
    this.room = loc.room;
    settle(this.walker, this.room, this.engine.catalog);
  }

  private openProjects(): void {
    this.projectsSheet.open(this.townNow().projects, this.location === 'townhall_in');
  }

  private contribute(project: string, coins: number, items: [string, number][]): void {
    const r = this.run({ type: 'contribute', project, coins, items });
    if (!r.ok) return;
    this.sound.sfx('buy');
    vibrate(this.prefs, 14);
    this.toasts.show(tr('game.donated'), { icon: 'check', kind: 'good', ms: 3600 });
    this.projectsSheet.refresh(this.townNow().projects);
  }

  /** The look of someone of the town or of the story. */
  private lookOf(id: string): Look | null {
    const def = this.engine.catalog.residents?.[id];
    if (def) {
      const settings: Record<string, string> = Object.fromEntries(Object.entries(def.look).map(([k, v]) => [`look.${k}`, v]));
      return lookFromSettings(settings);
    }
    const npc = this.npcDef(id);
    return npc ? lookFromSettings(lookSettings(npc)) : null;
  }

  private nameOf(id: string): string {
    return this.engine.catalog.residents?.[id]?.name ?? this.npcDef(id)?.name ?? '';
  }

  /** A birthday: wishes, and maybe a gift from the pocket. */
  private openBirthday(id: string): void {
    const name = this.nameOf(id);
    const gifts = Object.entries(this.pocket.items)
      .filter(([item, n]) => n > 0 && !this.engine.catalog.items[item]?.key)
      .slice(0, 5)
      .map(([item]) => ({ label: tr('game.bday.give', { item: this.itemName(item) }), run: () => this.congratulate(id, item) }));
    this.ask.open({
      who: name,
      title: tr('game.bday.title'),
      text: tr('game.bday.text', { name: firstName(name) }),
      choices: [{ label: tr('game.bday.greet'), primary: true, run: () => this.congratulate(id, null) }, ...gifts, { label: tr('game.laterPl'), run: () => this.ask.close() }],
    });
  }

  private congratulate(id: string, gift: string | null): void {
    this.ask.close();
    const r = this.run({ type: 'congratulate', who: id, gift });
    if (!r.ok) return;
    const ev = r.events.find((e) => e.kind.type === 'Congratulated')?.kind as { taste?: number } | undefined;
    this.sound.sfx('chime');
    vibrate(this.prefs, [10, 40, 10]);
    const name = firstName(this.nameOf(id));
    const reply = !gift
      ? tr('game.bday.remember')
      : ev?.taste === 1
        ? tr('game.bday.loved')
        : ev?.taste === -1
          ? tr('game.bday.meh')
          : tr('game.bday.ok');
    this.ask.open({ who: name, text: reply, choices: [{ label: tr('game.bday.wish'), primary: true, run: () => this.ask.close() }] });
  }

  /** Off to a friend's for dinner: through their door, to the table. */
  private goToDinner(): void {
    this.ask.close();
    const def = this.engine.catalog.locations?.guest_home;
    const exit = def?.exits[0];
    if (!def || !exit) return;
    this.enterLocation('guest_home', [exit.x + 1, Math.max(0, exit.y - 1)]);
  }

  /** At a friend's: they sit the player at the table. */
  private dinnerTable(): void {
    const inv = this.townNow().invitations.find((i) => i.active && !i.done);
    if (!inv) {
      this.toasts.show(tr('game.dinner.over'), { icon: 'heart', ms: 3600 });
      return;
    }
    this.ask.open({
      who: inv.name,
      text: tr('game.dinner.seat', { name: firstName(inv.name) }),
      choices: [
        { label: tr('game.dinner.eat'), primary: true, run: () => this.dine(inv.host) },
        { label: tr('game.dinner.minute'), run: () => this.ask.close() },
      ],
    });
  }

  private dine(host: string): void {
    this.ask.close();
    const r = this.run({ type: 'dine', host });
    if (!r.ok) return;
    const ev = r.events.find((e) => e.kind.type === 'Dined')?.kind as { gave?: string | null } | undefined;
    this.sound.sfx('chime');
    const name = firstName(this.nameOf(host));
    this.ask.open({
      who: name,
      text: tr('game.dinner.bye'),
      lines: ev?.gave ? [{ text: tr('game.dinner.wraps', { name, item: this.itemName(ev.gave) }), ok: true }] : [],
      choices: [{ label: tr('game.dinner.thanks'), primary: true, run: () => this.ask.close() }],
    });
  }

  /** People of the town who are not in its simulation: a friend come round, the host at dinner, a musician and a
   * lost tourist on the square. */
  private townFigures(): NonNullable<Frame['npcs']> {
    const out: NonNullable<Frame['npcs']> = [];
    const t = this.townNow();
    const minute = Math.floor(this.now()) % 1440;
    const frame = Math.floor(this.time / 0.75) % 2;
    const seated = (id: string, look: Look, x: number, y: number, emote: string | null = null) => {
      const seat = this.npcSeat(x, y, this.seatsTaken);
      if (seat) out.push({ id, x: seat.x, y: seat.y, layers: figureLayers(look, seat.dir, this.poseOnSeat(seat.pid), frame, false), emote, seat: { pid: seat.pid, lift: seat.lift } });
      else out.push({ id, x, y, layers: figureLayers(look, 'down', 'idle', frame, false), emote });
    };
    if (this.location === 'home' && t.visitor) {
      const look = this.lookOf(t.visitor.id);
      const spot = this.seatSpots().find((s) => this.regionAt(s.x, s.y) === this.currentRegion() && !this.seatsTaken.has(`${s.x},${s.y}`));
      if (look && spot) seated('town:visitor', look, spot.x, spot.y, 'talk');
    }
    if (this.village?.def.invite_only) {
      const inv = t.invitations.find((i) => i.active);
      const look = inv ? this.lookOf(inv.host) : null;
      const post = this.village.def.posts?.[0];
      if (look && post) seated('town:host', look, post[0] + 0.5, post[1] + 0.5);
    }
    if (this.location === this.engine.catalog.front && this.village) {
      const sq = this.engine.catalog.sites?.square_site;
      if (sq) {
        const [ax, ay, aw, ah] = sq.area ?? [sq.x, sq.y, 1, 1];
        const cx = ax + aw / 2;
        const cy = ay + ah / 2;
        if (t.flags.includes('musician') && minute >= 17 * 60 + 50 && minute < 19 * 60 + 40) {
          out.push({ id: 'town:musician', x: cx - 1.5, y: cy + 0.5, layers: figureLayers(MUSICIAN, 'down', Math.floor(minute / 20) % 2 ? 'violin' : 'guitar', Math.floor(this.time * 5) % 4, false), emote: 'play_music' });
        }
        if (t.flags.includes('tourist') && minute >= 10 * 60 && minute < 17 * 60) {
          out.push({ id: 'town:tourist', x: cx + 2.5, y: cy - 0.5, layers: figureLayers(TOURIST, 'left', 'idle', frame, false), emote: 'page' });
        }
      }
    }
    // the town at work on its buildings, the ice-cream seller and the children queueing
    for (const f of growthFigures(this.engine.catalog.growth, this.location, this.placeFlags(), minute, Math.floor(this.now() / 1440))) {
      const pose = f.pose === 'work' ? 'work' : f.pose === 'eat' ? 'eat' : 'idle';
      out.push({ id: `town:${f.role}:${f.id}`, x: f.x, y: f.y, layers: figureLayers(f.look, f.dir, pose, pose === 'work' ? Math.floor(this.time * 2.5) % 2 : frame, false), emote: f.emote, scale: f.child ? 0.78 : undefined });
    }
    // the ring round the fire of the old forest circle on the full-moon night; people at the temple's offerings
    const flags = this.placeFlags();
    const faith = [
      ...riteFigures({ location: this.location, grove: this.engine.catalog.sites?.grove_site, fullTonight: !!this.today().full_moon, fullLastNight: !!this.today(-1).full_moon, minuteOfDay: minute, time: this.time }),
      ...templeFigures({ location: this.location, offerings: flags.includes('offerings'), minuteOfDay: minute, day: Math.floor(this.now() / 1440) }),
    ];
    for (const f of faith) {
      const seat = f.pose === 'lotus' ? this.npcSeat(f.x, f.y, this.seatsTaken) : null;
      if (seat) out.push({ id: `town:${f.role}:${f.id}`, x: seat.x, y: seat.y, layers: figureLayers(f.look, seat.dir, 'lotus', frame, false), emote: f.emote, seat: { pid: seat.pid, lift: seat.lift } });
      else {
        const [rx, ry] = rotXY(this.view, f.face[0], f.face[1]);
        out.push({ id: `town:${f.role}:${f.id}`, x: f.x, y: f.y, layers: figureLayers(f.look, dirOf(rx - ry, (rx + ry) / 2, f.dir), f.pose === 'lotus' ? 'pray' : f.pose, frame, false), emote: f.emote });
      }
    }
    // the town's players at their tables: dominoes by the square, chess in the park
    for (const f of this.tableFigs()) {
      const look = this.lookOf(f.who);
      if (!look) continue;
      const seat = this.npcSeat(f.x, f.y, this.seatsTaken);
      if (seat) out.push({ id: `town:table:${f.id}:${f.who}`, x: seat.x, y: seat.y, layers: figureLayers(look, seat.dir, 'sit', frame, false), emote: f.emote, seat: { pid: seat.pid, lift: seat.lift } });
    }
    return out;
  }

  private townFigureTapped(id: string): void {
    const t = this.townNow();
    if (id === 'town:visitor' && t.visitor) {
      const bond = t.bonds.find((b) => b.id === t.visitor?.id);
      this.toasts.show(tr('game.visitor.drop', { name: firstName(t.visitor.name), line: bond?.line ?? tr('game.visitor.passing') }), { icon: 'talk', ms: 4200 });
    } else if (id === 'town:host') {
      this.dinnerTable();
    } else if (id === 'town:musician') {
      const minute = Math.floor(this.now()) % 1440;
      const piece = this.media.serenade(Math.floor(minute / 20) % 2 ? 'violin' : 'guitar');
      this.toasts.show(piece ? tr('game.busker.piece', { piece }) : tr('game.busker.song'), { icon: 'play_music', ms: 3600 });
    } else if (/^town:(builder|mender|mover|seller|kid):/.test(id)) {
      const role = id.split(':')[1] as 'builder' | 'mender' | 'mover' | 'seller' | 'kid';
      this.toasts.show(growthLine(role, Math.floor(this.now() / 37) + id.length), { icon: role === 'seller' || role === 'kid' ? 'talk' : 'hammer', ms: 3800 });
    } else if (id.startsWith('town:table:')) {
      const who = id.split(':').pop() ?? '';
      const name = this.engine.catalog.residents?.[who]?.name.split(' ')[0] ?? tr('game.player');
      const lines = [0, 1, 2, 3].map((i) => tr(`game.tables.${i}`, { name }));
      this.toasts.show(lines[(Math.floor(this.now() / 13) + who.length) % lines.length], { icon: 'talk', ms: 3800 });
    } else if (/^town:(rite|devotee):/.test(id)) {
      const role = id.split(':')[1] as 'rite' | 'devotee';
      this.toasts.show(faithLine(role, Math.floor(this.now() / 41) + id.length), { icon: 'talk', ms: 4200 });
    } else if (id === 'town:tourist') {
      this.toasts.show(tr('game.tourist'), { icon: 'page', ms: 4200 });
    }
  }

  private openPocket(): void {
    this.sellingAt = null;
    this.pocket = this.engine.pocket();
    this.pocketSheet.open(this.pocket, this.location === 'home');
  }

  /** The buyer the pocket is open at (its prices shown), or none. */
  private sellingAt: string | null = null;

  /** At a buyer's stall: the pocket with its prices. */
  private openBuyer(station: string): void {
    const st = this.engine.catalog.stations?.[station];
    if (!st) return;
    this.sellingAt = station;
    this.pocket = this.engine.pocket();
    this.pocketSheet.open(this.pocket, this.location === 'home', 'pocket', st.label);
  }

  private sellFromPocket(item: string, n: number): void {
    if (!this.sellingAt) return;
    const r = this.run({ type: 'sell_to', station: this.sellingAt, item, n });
    if (!r.ok) {
      if (r.error.kind === 'too_soon') this.toasts.show(this.engine.catalog.stations?.[this.sellingAt]?.spent ?? tr('game.station.allDone'), { kind: 'error', icon: 'lock', ms: 3400 });
      return;
    }
    const sold = r.events.map((e) => e.kind).find((k) => k.type === 'SoldTo') as { coins?: number } | undefined;
    this.sound.sfx('coins');
    this.toasts.show(tr('pocket.sold', { item: this.itemName(item), n, coins: sold?.coins ?? 0 }), { icon: 'coin', kind: 'good', ms: 2600 });
  }

  /** Who could be given a thing now: the people standing within a few steps. */
  private giftRecipients(): Recipient[] {
    const out: Recipient[] = [];
    if (this.location !== 'home') {
      const near = [...this.resPoses.entries(), ...[...this.npcPoses.entries()].filter(([, p]) => p.visible)]
        .map(([id, p]) => ({ id, d: Math.hypot(p.x - this.walker.x, p.y - this.walker.y) }))
        .filter((q) => q.d < 4)
        .sort((a, b) => a.d - b.d);
      for (const { id } of near) {
        const name = this.npcDef(id)?.name ?? (this.engine.catalog.residents?.[id] as { name?: string } | undefined)?.name;
        if (name && !out.some((o) => o.id === id)) out.push({ id, name });
      }
    }
    return out;
  }

  private giveFromPocket(item: string, to: Recipient): void {
    this.pocketSheet.close();
    if (this.npcDef(to.id)) {
      this.give(to.id, item);
      return;
    }
    // someone of the town: one gift a day, the taste says how it is taken
    const r = this.engine.command({ type: 'gift', npc: to.id, item }, this.now());
    if (!r.ok) {
      if (r.error.kind === 'too_soon') this.say(to.id, tr('game.npc.giftHad'));
      else this.reportError(r.error);
      return;
    }
    this.persist();
    this.refresh();
    const taste = Number(r.events.map((e) => e.kind).find((k) => k.type === 'NpcGifted')?.taste ?? 0);
    const key = taste > 0 ? `game.react.love.${Math.floor(this.time) % 3}` : taste < 0 ? `game.react.dislike.${Math.floor(this.time) % 2}` : `game.react.ok.${Math.floor(this.time) % 2}`;
    if (taste > 0) {
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
      for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ef6f8a', 'heart'), i * 140);
      this.sound.sfx('chime');
    }
    this.say(to.id, tr(key));
  }

  /** Puts things from the pocket into the chest (or takes them out); only at home. */
  private moveToChest(item: string, n: number, toChest: boolean): void {
    const r = this.run(toChest ? { type: 'stash', item, n } : { type: 'take', item, n });
    if (r.ok) this.sound.sfx(toChest ? 'place' : 'pop');
  }

  // ---- living at home: the fridge, the stove, the bills -------------------------------------------------

  private isFood(item: string): boolean {
    const def = this.engine.catalog.items[item];
    return !!def?.carry && ['food', 'fruit', 'veg', 'vegetable', 'fish', 'drink', 'dish', 'dairy', 'berry', 'mushroom'].some((t) => def.tags.includes(t));
  }

  private openFridge(): void {
    this.fridgeSheet.open(this.engine.fridge(this.now()), this.engine.pocket(), (i) => this.isFood(i));
  }

  private moveFridge(item: string, n: number, into: boolean): void {
    const r = this.run(into ? { type: 'to_fridge', item, n } : { type: 'from_fridge', item, n });
    if (r.ok) this.sound.sfx(into ? 'place' : 'pop');
  }

  private cook(recipe: string): void {
    const r = this.run({ type: 'cook', recipe });
    if (!r.ok) return;
    const ev = r.events.find((e) => e.kind.type === 'Cooked')?.kind as { gave?: string; n?: number; to_fridge?: boolean } | undefined;
    this.sound.sfx('chime');
    vibrate(this.prefs, 14);
    const name = ev?.gave ? this.itemName(ev.gave) : tr('game.dish');
    this.toasts.show(tr('game.cooked', { name, n: (ev?.n ?? 1) > 1 ? ` ×${ev?.n}` : '', fridge: ev?.to_fridge ? tr('game.cooked.fridge') : '' }), { icon: 'brew_tea', kind: 'good', ms: 3200 });
  }

  // ---- the workbench, mending, masters ------------------------------------------------------------------

  private openCraft(): void {
    this.craftSheet.open(this.engine.crafts(this.now()), this.engine.tools());
  }

  private craft(recipe: string): void {
    const r = this.run({ type: 'craft', recipe });
    if (r.ok) this.crafted(r);
  }

  private tinker(items: [string, number][]): void {
    const r = this.run({ type: 'tinker', items });
    if (r.ok) this.crafted(r);
  }

  /** What came of the bench, and any tool that gave out doing it. */
  private crafted(r: Extract<CommandResult, { ok: true }>): void {
    const ev = r.events.find((e) => e.kind.type === 'Crafted')?.kind as { gave?: string[]; learned?: boolean; to_chest?: boolean } | undefined;
    const what = ev?.gave?.[0];
    this.sound.sfx('chime');
    vibrate(this.prefs, 14);
    if (what) {
      const furniture = !this.engine.catalog.items[what]?.carry;
      this.toasts.show(tr('game.crafted', { learned: ev?.learned ? tr('game.crafted.learned') : '', item: this.itemName(what), n: (ev?.gave?.length ?? 1) > 1 ? ` ×${ev?.gave?.length}` : '', where: furniture ? tr('game.crafted.home') : ev?.to_chest ? tr('game.crafted.chest') : '' }), { icon: 'hammer', kind: 'good', ms: 3200 });
    }
    if (this.craftSheet.isOpen()) this.craftSheet.refresh(this.engine.crafts(this.now()), this.engine.tools());
  }

  /** A tool that wore out with this, said in its own words. */
  private toolsGone(r: CommandResult): void {
    if (!r.ok) return;
    for (const e of r.events) {
      if (e.kind.type !== 'ToolUsed' || !e.kind.broke) continue;
      const gone = this.engine.catalog.tools?.[String(e.kind.item)]?.gone;
      if (gone) this.toasts.show(gone, { icon: 'hammer', ms: 3400 });
    }
  }

  /** Something aged at home: mend it with one's own hands, or call a master (by phone), or leave it. */
  private offerFix(pid: number): void {
    const w = this.engine.wear(this.now()).find((x) => x.pid === pid);
    if (!w) return;
    const phone = (this.engine.inventory().find((i) => i.item === 'smartphone')?.owned ?? 0) > 0;
    this.ask.open({
      who: this.itemName(w.item),
      text: `${w.looks[0].toUpperCase()}${w.looks.slice(1)}.`,
      choices: [
        { label: tr('game.fix.self'), run: () => { this.ask.close(); this.repair(pid); } },
        ...(phone ? [{ label: tr('game.fix.call', { fix: w.fix }), run: () => { this.ask.close(); this.callMaster(pid); } }] : []),
        { label: tr('game.fix.leave'), run: () => this.ask.close() },
      ],
    });
  }

  private repair(pid: number): void {
    const r = this.run({ type: 'repair', pid });
    if (!r.ok) return;
    this.sound.sfx('pop');
    this.toasts.show(tr('game.fix.done'), { icon: 'hammer', kind: 'good' });
  }

  private callMaster(pid: number): void {
    const r = this.run({ type: 'call_master', pid });
    if (!r.ok) return;
    const coins = Number(r.events.find((e) => e.kind.type === 'Repaired')?.kind.coins ?? 0);
    this.sound.sfx('buy');
    this.toasts.show(tr('game.fix.master', { n: coins }), { icon: 'hammer', kind: 'good', ms: 3400 });
  }

  /** At the utility office: what at home could use a master. */
  private openMasters(): void {
    const worn = this.engine.wear(this.now()).filter((w) => w.stage >= 1);
    if (worn.length === 0) {
      this.toasts.show(tr('game.fix.nothing'), { icon: 'check' });
      return;
    }
    this.ask.open({
      who: tr('game.utilities'),
      text: tr('game.fix.ask'),
      choices: [
        ...worn.slice(0, 5).map((w) => ({ label: `${this.itemName(w.item)} — ${w.looks} · ${w.fix}`, run: () => { this.ask.close(); this.callMaster(w.pid); } })),
        { label: tr('game.anotherTime'), run: () => this.ask.close() },
      ],
    });
  }

  private openBills(): void {
    this.billsSheet.open(this.engine.bills(this.now()));
  }

  /** Pays one utility's oldest bill, or everything due (null). */
  private payBills(utility: string | null): void {
    const r = this.run(utility ? { type: 'pay_bill', utility, month: null } : { type: 'pay_all' });
    if (!r.ok) return;
    const paid = r.events.filter((e) => e.kind.type === 'BillPaid').reduce((s, e) => s + Number(e.kind.amount ?? 0), 0);
    this.sound.sfx('buy');
    this.toasts.show(tr('game.paid', { n: paid }), { icon: 'coin', kind: 'good', ms: 2800 });
    if (this.todayPanel.isOpen() && this.daily) this.todayPanel.open(this.daily, 'bills');
  }

  // ---- stations: the things of the town that do something ------------------------------------------

  /** The stations at a prop of this location. */
  private stationsAt(item: string): StationView[] {
    // '*': everything of the place (the stall of a whole shop)
    return (this.stationsMemo ?? this.engine.stations(this.now())).filter((s) => s.location === this.location && (item === '*' || s.prop === item));
  }

  /** The stations of the moment, while many things of a place are asked about at once. */
  private stationsMemo: StationView[] | null = null;
  private placeChecked = 0;

  /** What the place offers, as buttons by the hand: in a building everything its things do (its wares in one
   * stall, its services, its job, the way out); out in the street what the stalls and counters close by do. */
  private placeButtons(): { key: string; icon: string; label: string; run: () => void }[] {
    const def = this.village?.def;
    if (!def || this.location === 'home' || this.mode !== 'walk' || this.car) return [];
    this.stationsMemo = this.engine.stations(this.now());
    try {
      const inside = !!def.inside;
      const near = (p: PlacementView) => {
        const d = this.engine.catalog.items[p.item];
        if (!d) return false;
        const cx = p.x + d.footprint.w / 2;
        const cy = p.y + d.footprint.d / 2;
        return Math.hypot(cx - this.walker.x, cy - this.walker.y) < 3 + Math.max(d.footprint.w, d.footprint.d) / 2;
      };
      const SKIP = /^(go_in|home|homeinfo:|leave|enter|climb|bike|taxi|toggle|rift)/;
      const offers = new Map<string, number>();
      let trade: string | null = null;
      let door: number | null = null;
      for (const p of this.room.placements) {
        if (!inside && !near(p)) continue;
        for (const o of this.optionsFor(p.pid)) {
          if (o === 'stall') {
            trade ??= p.item;
            continue;
          }
          if (o === 'leave') door ??= p.pid;
          if (SIT_ACTIONS.has(o) || SKIP.test(o) || offers.has(o)) continue;
          offers.set(o, p.pid);
        }
      }
      const out: { key: string; icon: string; label: string; run: () => void }[] = [];
      if (trade) {
        const item = inside ? '*' : trade;
        out.push({ key: 'stall', icon: 'bag', label: tr('game.opt.stall'), run: () => this.openStall(item) });
      }
      for (const [o, pid] of offers) {
        const l = this.optionLabel(pid, o);
        out.push({ key: o, icon: l.icon, label: l.label, run: () => {
          this.bubble.hide();
          this.doUse(pid, o);
        } });
      }
      const exit = door;
      // the way out, straight onto the street
      const street = def.exits.find((e) => e.to !== this.location);
      if (inside && exit !== null && street) out.push({ key: 'leave', icon: 'door', label: tr('game.opt.leave'), run: () => this.enterLocation(street.to, street.at) });
      return out.slice(0, 8);
    } finally {
      this.stationsMemo = null;
    }
  }

  private useStation(id: string): void {
    const view = this.engine.stations(this.now()).find((s) => s.id === id);
    // a buyer: the pocket opens with its prices (when the stall is open)
    if (this.engine.catalog.stations?.[id]?.buys?.length && (!view || view.ok || view.reason === 'not_enough')) {
      this.openBuyer(id);
      return;
    }
    if (view && !view.ok) {
      this.sound.sfx('error');
      this.toasts.show(this.stationRefusal(view), { kind: 'error', icon: 'lock', ms: 3400 });
      return;
    }
    const result = this.run({ type: 'use', station: id });
    if (!result.ok) return;
    // an ice cream eaten on the spot, the cone up by the face
    if (id.startsWith('st.eat_icecream.')) this.performing = { until: this.time + 6, sitting: false, eat: true };
    // an offering, a bow at the idol, a moment in the circle: the palms together for a while
    if (/^st\.(temple|grove)\./.test(id) && !this.seat) this.performing = { until: this.time + 6, sitting: false, pray: true };
    const used = result.events.find((e) => e.kind.type === 'Used')?.kind as { gave?: string[]; earn?: number; cost?: number } | undefined;
    this.sound.sfx(used?.earn ? 'buy' : 'chime');
    vibrate(this.prefs, 14);
    const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
    let offset = 0;
    if (used?.earn) {
      this.toasts.pop(`+${used.earn}`, at.x, at.y, '#f4b860', 'coin');
      offset += 34;
    }
    const gave = new Map<string, number>();
    for (const g of used?.gave ?? []) gave.set(g, (gave.get(g) ?? 0) + 1);
    for (const [item, n] of gave) {
      this.toasts.pop(`+${n}`, at.x + offset, at.y, '#7ad06a', 'pouch');
      offset += 34;
      void item;
    }
    const text = view?.text ?? this.engine.catalog.stations?.[id]?.text;
    const got = [...gave.keys()].map((i) => this.itemName(i)).join(', ');
    if (text) this.toasts.show(got ? `${text} (${got})` : text, { icon: STATION_ICON[view?.kind ?? ''] ?? 'sparkle', kind: 'good', ms: 3600 });
  }

  /** Why a station cannot be used now, in the world's own words (the cow was milked this morning…). */
  private stationRefusal(view: StationView): string {
    const need = view.reason === 'not_enough' ? ': ' + view.needs.map(([k, n]) => `${this.keyName(k)} ×${n}`).join(', ') : view.reason === 'closed' && view.hours ? tr('game.station.hours', { from: view.hours[0], to: view.hours[1] }) : '';
    return view.reason === 'too_soon' ? view.spent || tr('game.station.allDone') : (STATION_REASON[view.reason ?? ''] ?? tr('game.station.failed')) + need;
  }

  /** The stall sheet of a counter: everything bought and sold there. */
  private openStall(item: string): void {
    this.stallAt = item;
    this.bubble.hide();
    // inside a shop or a café: the place's own name; out in the street: the stall's
    this.stallSheet.open(this.village?.def.inside || item === '*' ? this.locationName(this.location) : this.itemName(item));
  }

  /** The wares of the open stall today: what is not sold today at all (another season, a feast's day) is not shown;
   * what is shut only for the hour says when it opens. */
  private stallRows(): StallRow[] {
    const hour = Math.floor((this.now() % 1440) / 60);
    return this.stationsAt(this.stallAt)
      .filter((st) => st.kind === 'buy' || st.kind === 'sell')
      .filter((st) => st.ok || st.reason !== 'closed' || (!!st.hours && (hour < st.hours[0] || hour >= st.hours[1])))
      // a feast's own wares only on its day
      .filter((st) => !(st.reason === 'locked' && st.missing.length > 0 && st.missing.every((m) => m.type === 'day' || m.type === 'season')))
      .map((st) => {
        const buyer = !!this.engine.catalog.stations?.[st.id]?.buys?.length;
        const [item, n] = st.gives[0] ?? ['', 0];
        const closedFor = !st.ok && st.reason === 'closed' && st.hours ? (hour < st.hours[0] ? tr('game.stall.opens', { from: st.hours[0] }) : tr('game.stall.closes', { from: st.hours[0] })) : '';
        // what it takes, in the stall's own words (a shovel for the clay…)
        const hint = st.reason === 'locked' ? this.engine.catalog.stations?.[st.id]?.requires?.hint : '';
        const why = st.ok ? '' : closedFor || hint || this.stationRefusal(st);
        if (st.kind === 'sell') {
          const what = st.needs.map(([k, m]) => `${this.keyName(k)} ×${m}`).join(', ');
          return { id: st.id, thumb: null, name: st.label, note: why || (buyer ? tr('game.stall.anything') : tr('game.stall.for', { what })), button: buyer ? tr('game.stall.sellAny') : tr('game.stall.sell', { n: st.earn }), ok: st.ok || (buyer && st.reason === 'not_enough') };
        }
        const name = item ? `${this.itemName(item)}${n > 1 ? ` ×${n}` : ''}` : st.label;
        return { id: st.id, thumb: item ? this.thumbOf(item, 40) : null, name, note: why, button: st.cost > 0 ? tr('game.stall.buy', { n: st.cost }) : tr('game.stall.take'), ok: st.ok };
      });
  }

  /** A name for a need: an item, or a kind of things (#fish → «риба»). */
  private keyName(key: string): string {
    if (!key.startsWith('#')) return this.itemName(key);
    const tag = key.slice(1);
    return has(`game.tag.${tag}`) ? tr(`game.tag.${tag}`) : tag;
  }

  // ---- help: one-time tasks from the town's people -------------------------------------------------

  /** An open help someone gives (the first not done that is available). */
  private helpOf(giver: string): HelpView | null {
    const helps = this.engine.helps(this.now()).filter((h) => h.giver === giver && !h.done);
    return helps.find((h) => h.available) ?? null;
  }

  private openHelp(help: HelpView): void {
    const here = this.location === help.location;
    const where = this.locationName(help.location);
    const lines = [
      ...help.needs.map(([k, n]) => {
        const have = this.haveFor(k);
        return { text: `${this.keyName(k)}: ${Math.min(have, n)}/${n}`, ok: have >= n };
      }),
      { text: tr('game.help.reward', { what: [help.coins > 0 ? tr('game.coinsN', { n: help.coins }) : '', ...help.gives.map((g) => this.itemName(g))].filter(Boolean).join(', ') || tr('game.help.kindWord') }) },
    ];
    if (!here) lines.push({ text: tr('game.help.bringHere', { where }), ok: false });
    this.ask.open({
      who: help.giver_name,
      title: help.title,
      text: help.text,
      lines,
      choices: [
        { label: help.ready && here ? tr('game.give') : here ? tr('game.help.notAll') : tr('game.help.giveAt', { where }), primary: help.ready && here, disabled: !(help.ready && here), run: () => this.giveHelp(help) },
        { label: tr('game.laterPl'), run: () => this.ask.close() },
      ],
    });
  }

  private giveHelp(help: HelpView): void {
    const result = this.run({ type: 'help', help: help.id });
    if (!result.ok) return;
    this.sound.sfx('chime');
    vibrate(this.prefs, [12, 40, 12]);
    const ev = result.events.find((e) => e.kind.type === 'Helped')?.kind as { coins?: number; gives?: string[]; to_chest?: boolean } | undefined;
    const gifts = (ev?.gives ?? help.gives).map((g) => this.itemName(g));
    this.ask.open({
      who: help.giver_name,
      title: help.title,
      text: help.thanks,
      lines: [
        ...(ev?.coins ? [{ text: tr('game.plusCoins', { n: ev.coins }), ok: true }] : []),
        ...gifts.map((g) => ({ text: `${g}${ev?.to_chest ? tr('game.sentHome') : ''}`, ok: true })),
      ],
      choices: [{ label: tr('game.thanks'), primary: true, run: () => this.ask.close() }],
    });
  }

  private locationName(id: string): string {
    if (id === 'home') return tr('game.homeLower');
    return this.engine.catalog.locations?.[id]?.name ?? id;
  }

  // ---- the morning paper -----------------------------------------------------------------------------

  /** Opens today's paper by itself once a world day (the first time the world is opened that day). */
  private morningPaper(force = false, away: AwayIssues | null = null): void {
    if (this.debug.demo) return;
    const paper = this.engine.paper(this.now());
    let seen = -1;
    try {
      seen = Number(localStorage.getItem('teul.paper.day') ?? -1);
    } catch {
      // storage blocked: the paper just opens every time
    }
    if (!force && seen === paper.day) return;
    try {
      localStorage.setItem('teul.paper.day', String(paper.day));
    } catch {
      // see above
    }
    this.paperSheet.open(paper, away);
    this.sound.sfx('page');
  }

  // ---- the rift: on the equinoxes and the solstices, a day-long way to the Other Side --------------------

  private riftShown = false;
  private readonly wonders: Wonders;
  private eveCache: { day: number; view: DayView } | null = null;
  private nightCheck = 0;
  private horrorSlot = -1;

  /** Today in the real year (asked once a world day); `-1` is yesterday (for the night after midnight). */
  private today(offset: 0 | -1 = 0): DayView {
    const day = Math.floor(this.now() / 1440) + offset;
    if (offset === 0) {
      if (this.dayCache?.day !== day) this.dayCache = { day, view: this.engine.dayView(this.now()) };
      return this.dayCache.view;
    }
    if (this.eveCache?.day !== day) this.eveCache = { day, view: this.engine.dayView(Math.max(0, this.now() - 1440)) };
    return this.eveCache.view;
  }

  /** On a rift day a crack opens in the garden too (not in the editor: it is no furniture). */
  private withGardenRift(room: RoomView): RoomView {
    if (this.mode === 'edit' || !this.engine.catalog.items.rift_crack || !this.today().rift) return room;
    const taken = new Set<string>();
    for (const p of room.placements) {
      const def = this.engine.catalog.items[p.item];
      if (!def || def.layer === 'wall' || def.layer === 'surface') continue;
      for (const [dx, dy] of footprintCells(def, p.rot)) taken.add(cellKey(p.x + dx, p.y + dy));
    }
    const outdoor = (x: number, y: number) => {
      const st = room.floor_paint[cellKey(x, y)];
      return !!st && this.engine.catalog.styles[st]?.params.outdoor === '1' && st !== 'floor.water';
    };
    const cells = [...room.cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const spot = cells.find(([x, y]) => outdoor(x, y) && !taken.has(cellKey(x, y)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !taken.has(cellKey(x + dx, y + dy))));
    if (!spot) return room;
    const crack: PlacementView = { pid: GARDEN_RIFT_PID, item: 'rift_crack', x: spot[0], y: spot[1], rot: 0, wall: null, on: null, colors: {}, props: {}, known: true };
    return { ...room, placements: [...room.placements, crack] };
  }

  private stepRift(): void {
    this.sound.at('drone', 0.7, 0);
    this.sound.at('whisper', 0.4, 0);
    vibrate(this.prefs, [20, 60, 20]);
    if (isRiftWorld(this.location)) {
      // back where one stepped in (or to the town's square)
      const from = this.riftFrom;
      const leaving = WORLD_LOOK[this.location];
      if (from && from.location === 'home') this.goHome();
      else this.enterLocation(from?.location ?? this.engine.catalog.front ?? 'village', from?.at ?? [41, 23]);
      if (!isRiftWorld(this.location)) this.toasts.show(leaving.leave, { icon: 'portal', ms: 2800 });
      return;
    }
    const world = this.wonders.riftWorld(this.wondersHost());
    if (!world) return;
    this.riftFrom = { location: this.location, at: [Math.floor(this.walker.x), Math.floor(this.walker.y) + 1] };
    // one arrives by the crack that leads back
    const crack = this.engine.catalog.locations?.[world]?.props.find((q) => q.item === 'rift_crack');
    this.enterLocation(world, crack ? [crack.x, crack.y + 1] : [28, 36]);
    if (this.location === world) {
      this.sound.at(WORLD_LOOK[world].sound, 0.8, 0);
      this.toasts.show(WORLD_LOOK[world].arrive, { icon: 'portal', ms: 3600 });
    }
  }

  /** Where one stepped into the rift from (the way back leads there). */
  private riftFrom: { location: string; at: [number, number] } | null = null;

  /** What the wonders need to know of the game, each time they are asked. */
  private wondersHost(): WondersHost {
    return {
      now: () => this.now(),
      location: this.location,
      walker: this.walker,
      routes: this.village?.routes ?? null,
      catalog: this.engine.catalog,
      skyView: (now) => this.engine.skyView(now),
      toScreen: (x, y, z) => this.renderer.toScreen(x, y, z),
      sound: (kind, volume, pan) => this.sound.at(kind, volume, pan),
      vibrate: (pattern) => vibrate(this.prefs, pattern),
      toast: (text, ms = 3600) => this.toasts.show(text, { icon: 'portal', ms }),
      outdoors: this.outdoors(),
      horrorOn: this.prefs.horror,
    };
  }

  /** The figures of tonight's eerie night (the wonders move them; drawn with the others). */
  private nightFigures: NonNullable<Frame['npcs']> = [];
  /** Residents out watching the sky, with what they watch. */
  private watching = new Map<string, string>();
  private wondersAt = 0;

  /** After the scene: the sky over it, the town inside out, the eerie night's figures and what it does. */
  private wondersFrame(frame: Frame): void {
    const t = performance.now() / 1000;
    const dt = this.wondersAt ? Math.min(0.1, t - this.wondersAt) : 0.016;
    this.wondersAt = t;
    const night = this.location === 'home' ? 0 : daylight(lightMinute(this.room.settings, frame.minuteOfDay)).dark;
    const r = this.wonders.frame(this.wondersHost(), this.time, dt, night);
    this.nightFigures = r.figures;
    if (r.caught) {
      this.goHome();
      this.toasts.show(tr('game.horror.woke'), { icon: 'home', ms: 6000 });
    }
  }

  /** Once a second: the rift opening or closing with the day (one still on the Other Side is brought home at
   * midnight, gently), and — for those who want it — what happens on an eerie night. */
  private nightTick(ms: number): void {
    if (!this.started || ms - this.nightCheck < 1000) return;
    this.nightCheck = ms;
    const today = this.today();
    if (isRiftWorld(this.location) && !today.rift) {
      this.goHome();
      this.toasts.show(tr('game.rift.closed'), { icon: 'home', ms: 4200 });
      return;
    }
    if (today.rift !== this.riftShown && this.village && this.location !== 'home') {
      this.enterLocation(this.location, [Math.floor(this.walker.x), Math.floor(this.walker.y)], true);
    }
    if (this.location === 'home' && this.homeRiftShown !== today.rift) {
      this.homeRiftShown = today.rift;
      this.refresh();
    }
    const minute = this.now() % 1440;
    const eve = eveningOf(minute) === -1 ? this.today(-1) : today;
    const cal = this.engine.calendarDay(eveningOf(minute) === -1 ? Math.max(0, this.now() - 1440) : this.now());
    const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const night = { holiday: eve.holiday_id, tomorrow: eve.tomorrow, rift: eve.rift, minute, place: this.location, date: { month: cal.month, day: cal.day, weekday: WD.indexOf(cal.info.weekday) } };
    const theme = spookyTheme(night);
    this.wonders.eerieTonight = !!theme;
    const slot = Math.floor(ms / 1000 / 70);
    if (!theme || slot === this.horrorSlot) return;
    this.horrorSlot = slot;
    if (this.ask.isOpen() || this.mode !== 'walk') return;
    // out of doors, now and then, a whole night unfolds
    if (this.wonders.maybeNight(this.wondersHost(), night, Math.floor(this.now() / 1440), slot)) return;
    const e = pickEvent(theme, this.location, Math.floor(this.now() / 1440), slot, this.prefs.horror);
    if (e) this.haunt(e);
  }

  private homeRiftShown = false;

  /** An eerie moment: a flicker, someone at the edge of sight, whispers, or a small dialog with a way out. */
  private haunt(e: HorrorEvent): void {
    this.sound.at(e.sound, 0.8, 0);
    if (e.flicker) {
      this.canvas.classList.remove('flicker');
      void this.canvas.offsetWidth;
      this.canvas.classList.add('flicker');
      window.setTimeout(() => this.canvas.classList.remove('flicker'), 1700);
    }
    if (e.figure) this.shade();
    if (e.lines) {
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 70);
      e.lines.slice(0, 3).forEach((l, i) => window.setTimeout(() => this.toasts.pop(l, at.x + (i - 1) * 60, at.y - i * 10, '#a3a8cf'), i * 700));
    }
    if (e.choices) {
      const choices = e.choices;
      this.ask.open({
        who: '…',
        text: e.text,
        choices: choices.map((c) => ({
          label: c.label,
          primary: false,
          run: () => this.ask.open({ who: '…', text: c.text, choices: [{ label: tr('game.next'), primary: true, run: () => this.ask.close() }] }),
        })),
      });
    } else {
      this.toasts.show(e.text, { icon: 'portal', ms: 4600 });
    }
  }

  /** A dark figure at the edge of the screen for a moment. */
  private shade(): void {
    const el = document.createElement('div');
    el.className = `shade ${Math.random() < 0.5 ? 'left' : 'right'}`;
    this.rootEl.append(el);
    window.setTimeout(() => el.classList.add('gone'), 1300);
    window.setTimeout(() => el.remove(), 2400);
  }

  // ---- work: shifts at the town's places ------------------------------------------------------------

  /** A job's word at the place: taken on first (a word with the boss), then the shift. */
  private jobAction(work: string): void {
    const live = this.engine.shift(this.now());
    const w = this.engine.works(this.now()).find((x) => x.id === work);
    if (!w) return;
    if (live?.work === work || w.hired) {
      this.startShift(work);
      return;
    }
    this.bubble.hide();
    this.ask.open({
      who: w.name,
      text: tr('game.work.offer', { boss: w.boss, from: w.hours[0], to: w.hours[1], pay: w.pay }),
      choices: [
        { label: tr('game.work.take'), run: () => this.takeJob(work) },
        { label: tr('game.notNow'), run: () => this.ask.close() },
      ],
    });
  }

  private takeJob(work: string): void {
    this.ask.close();
    if (!this.run({ type: 'take_job', work }).ok) return;
    this.sound.sfx('chime');
    const w = this.engine.works(this.now()).find((x) => x.id === work);
    if (!w) return;
    if (w.ok) {
      this.ask.open({
        who: w.name,
        text: tr('game.work.welcomeNow', { boss: w.boss }),
        choices: [
          { label: tr('game.work.startNow'), run: () => { this.ask.close(); this.startShift(work); } },
          { label: tr('game.work.later'), run: () => this.ask.close() },
        ],
      });
    } else this.toasts.show(tr('game.work.welcome', { boss: w.boss, from: w.hours[0], to: w.hours[1] }), { icon: 'hammer', kind: 'good', ms: 4200 });
  }

  /** Leaving a job, asked once more by the boss. */
  private quitJob(work: string): void {
    const w = this.engine.works(this.now()).find((x) => x.id === work);
    if (!w) return;
    this.ask.open({
      who: w.name,
      text: tr('game.work.quitAsk', { boss: w.boss }),
      choices: [
        { label: tr('game.work.quitYes'), run: () => {
          this.ask.close();
          if (this.engine.shift(this.now())?.work === work) this.workSheet.hide();
          if (!this.run({ type: 'leave_job', work }).ok) return;
          this.toasts.show(tr('game.work.quitDone', { boss: w.boss }), { icon: 'hammer', ms: 3400 });
          if (this.todayPanel.isOpen() && this.daily) this.todayPanel.open(this.daily, 'me');
        } },
        { label: tr('game.work.quitStay'), run: () => this.ask.close() },
      ],
    });
  }

  /** The job someone runs, when they and the hero are at its place. */
  private jobRunBy(id: string): WorkView | null {
    const work = Object.values(this.engine.catalog.work ?? {}).find((w) => w.employer === id && w.location === this.location);
    return work ? (this.engine.works(this.now()).find((x) => x.id === work.id) ?? null) : null;
  }

  private startShift(work: string): void {
    const live = this.engine.shift(this.now());
    const w = this.engine.works(this.now()).find((x) => x.id === work);
    if ((!live || live.work !== work) && w && !w.ok) {
      // the place says why, in its own words
      const said = w.reason === 'closed' ? tr('game.work.closed', { boss: w.boss, from: w.hours[0], to: w.hours[1] }) : w.reason === 'done_today' ? tr('game.work.doneToday', { boss: w.boss }) : w.reason === 'busy' ? tr('game.work.busy') : '';
      if (said) this.toasts.show(said, { icon: 'clock', ms: 3600 });
      return;
    }
    if (!live || live.work !== work) {
      const r = this.run({ type: 'start_shift', work });
      if (!r.ok) return;
      this.sound.sfx('pop');
    }
    this.workSheet.open();
  }

  private workStep(choice: number): void {
    const before = this.engine.shift(this.now());
    const r = this.run({ type: 'work_step', choice });
    if (!r.ok) {
      this.workSheet.render();
      return;
    }
    const done = r.events.find((e) => e.kind.type === 'WorkDone')?.kind as { right?: boolean } | undefined;
    const good = !!done?.right;
    this.sound.sfx(good ? 'chime' : 'error');
    const wanted = before?.asks ?? '';
    this.workSheet.answered(good, good ? tr(`game.work.good.${(before?.step ?? 0) % 4}`) : tr('game.work.wrong', { wanted }));
  }

  private endShift(): void {
    const live = this.engine.shift(this.now());
    const r = this.run({ type: 'end_shift' });
    this.workSheet.hide();
    if (!r.ok) return;
    const ended = r.events.find((e) => e.kind.type === 'ShiftEnded')?.kind as { pay?: number; full?: boolean; work?: string } | undefined;
    const def = ended?.work ? this.engine.catalog.work?.[ended.work] : undefined;
    if (ended?.pay) {
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
      this.toasts.pop(`+${ended.pay}`, at.x, at.y, '#f4b860', 'coin');
      this.sound.sfx('buy');
    }
    const words = ended?.full ? (def?.thanks ?? tr('game.work.thanks')) : ended?.pay ? tr('game.work.partly') : tr('game.work.none');
    this.toasts.show(tr('game.work.ended', { boss: live?.boss ?? '', words, pay: ended?.pay ? tr('game.work.pay', { n: ended.pay }) : '' }), { icon: 'coin', kind: 'good', ms: 4200 });
  }

  // ---- the garden --------------------------------------------------------------------------------------

  private plotOptions(pid: number): string[] {
    const v = this.engine.garden(this.now()).find((x) => x.pid === pid);
    if (!v || !v.plant) return ['plant'];
    if (v.dead) return ['clear_plot', 'plot_info'];
    const out: string[] = [];
    if (v.ready) out.push('harvest');
    if (!v.watered_today) out.push('water');
    out.push('plot_info');
    if (!v.ready) out.push('clear_plot');
    return out;
  }

  private tendPlot(pid: number, action: string): void {
    const v = this.engine.garden(this.now()).find((x) => x.pid === pid);
    if (action === 'plot_info') {
      if (v) this.toasts.show(v.plant ? `${v.name}: ${v.words}` : tr('game.garden.empty'), { icon: 'leaf', ms: 3000 });
      return;
    }
    if (action === 'plant') {
      const seeds = Object.entries(this.pocket.items).filter(([id, n]) => n > 0 && Object.values(this.engine.catalog.plants ?? {}).some((pl) => pl.seed === id));
      if (seeds.length === 0) {
        this.toasts.show(tr('game.garden.noSeeds'), { icon: 'leaf', ms: 3800 });
        return;
      }
      this.ask.open({
        who: tr('game.room.farm'),
        text: v?.indoor ? tr('game.garden.tub') : tr('game.garden.bed'),
        choices: [
          ...seeds.map(([id, n]) => ({ label: `${this.itemLabel(id)}${n > 1 ? ` (${n})` : ''}`, run: () => {
            this.ask.close();
            if (this.run({ type: 'plant', pid, seed: id }).ok) {
              this.sound.at('rustle', 0.6, 0);
              this.toasts.show(tr('game.garden.planted'), { icon: 'leaf', kind: 'good', ms: 3200 });
            }
          } })),
          { label: tr('game.notNow'), run: () => this.ask.close() },
        ],
      });
      return;
    }
    const type = action === 'clear_plot' ? 'clear_plot' : action;
    const r = this.run({ type, pid } as Command);
    if (!r.ok) return;
    if (action === 'water') {
      this.sound.at('splash', 0.5, 0);
      this.toasts.show(tr('game.garden.watered'), { icon: 'water_plant', ms: 2200 });
    } else if (action === 'harvest') {
      const h = r.events.find((e) => e.kind.type === 'Harvested')?.kind as { item?: string; n?: number } | undefined;
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
      this.toasts.pop(`+${h?.n ?? 1}`, at.x, at.y, '#7ad06a', 'pouch');
      this.sound.sfx('chime');
      if (h?.item) this.toasts.show(tr('game.garden.harvested', { item: this.itemLabel(h.item), n: String(h.n) }), { icon: 'harvest', kind: 'good', ms: 3000 });
    }
  }

  /** A canvas on the wall: which of one's pictures it shows. */
  private chooseArt(pid: number): void {
    const art = this.engine.paintings();
    if (art.length === 0) {
      this.toasts.show(tr('game.art.none'), { icon: 'paint', ms: 2800 });
      return;
    }
    this.ask.open({
      who: tr('game.art.who'),
      text: tr('game.art.which'),
      choices: [
        ...art.map((a) => ({ label: `«${a.title}»`, run: () => {
          this.ask.close();
          this.run({ type: 'set_prop', pid, key: 'art', value: String(a.index) });
        } })),
        { label: tr('game.notNow'), run: () => this.ask.close() },
      ],
    });
  }

  // ---- «Я»: what the hands know, where one works, the pictures ---------------------------------------

  private mePage(): HTMLElement {
    const skills = this.engine.skills();
    const works = this.engine.works(this.now()).filter((w) => w.hired || w.shifts > 0);
    const art = this.engine.paintings();
    const box = document.createElement('div');
    box.className = 'me-page';
    const head = (t: string) => {
      const e = document.createElement('div');
      e.className = 'paper-section';
      e.textContent = t;
      box.append(e);
    };
    head(tr('game.me.skills'));
    for (const k of skills) {
      const row = document.createElement('p');
      row.className = 'me-row';
      row.innerHTML = `<b>${k.name}</b> — ${k.word}`;
      box.append(row);
    }
    head(tr('game.me.known'));
    if (works.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = tr('game.me.noWork');
      box.append(p);
    }
    for (const w of works) {
      const row = document.createElement('p');
      row.className = 'me-row';
      row.textContent = w.hired ? tr('game.me.job', { place: w.name, boss: w.boss, standing: w.standing, from: w.hours[0], to: w.hours[1] }) : tr('game.me.standing', { place: w.name, boss: w.boss, standing: w.standing });
      if (w.hired) {
        const quit = document.createElement('button');
        quit.type = 'button';
        quit.className = 'cta muted small me-quit';
        quit.textContent = tr('game.me.quit');
        quit.addEventListener('click', () => this.quitJob(w.id));
        row.append(' ', quit);
      }
      box.append(row);
    }
    if (art.length > 0) {
      head(tr('game.me.paintings'));
      const strip = document.createElement('div');
      strip.className = 'me-art';
      for (const a of art) {
        const c = document.createElement('canvas');
        c.width = ART_W;
        c.height = ART_H;
        c.title = a.title;
        const g = c.getContext('2d');
        if (g) for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
          g.fillStyle = ART_COLORS[parseInt(a.pixels[y * ART_W + x], 16) || 0];
          g.fillRect(x, y, 1, 1);
        }
        strip.append(c);
      }
      box.append(strip);
    }
    return box;
  }

  // ---- homes: the first house, flats and houses to rent or buy, plots ---------------------------------------

  /** The homes whose door is at this building. */
  private homesAt(p: PlacementView): HomeView[] {
    const def = this.engine.catalog.items[p.item];
    if (!def) return [];
    const cells = footprintCells(def, p.rot).map(([dx, dy]) => [p.x + dx, p.y + dy]);
    return this.engine
      .homes(this.now())
      .homes.filter((x) => x.location === this.location && x.prop === p.item && cells.some(([cx, cy]) => Math.abs(cx - x.x) + Math.abs(cy - x.y) <= 1));
  }

  /** A home: what it is, and what can be done about it here. */
  private openHome(id: string): void {
    const hv = this.engine.homes(this.now()).homes.find((x) => x.id === id);
    if (!hv) return;
    const plot = hv.kind === 'plot';
    const lines: { text: string; ok?: boolean }[] = [];
    if (hv.current) lines.push({ text: tr('game.home.current'), ok: true });
    else if (hv.owned) lines.push({ text: tr('game.home.owned'), ok: true });
    else if (hv.leased) lines.push({ text: plot ? tr('game.home.plotLeased') : tr('game.home.leased'), ok: true });
    if (!hv.owned && hv.rent > 0) lines.push({ text: tr('game.home.rent', { rent: hv.rent }) });
    if (!hv.owned && hv.price > 0) lines.push({ text: tr('game.home.price', { price: hv.price }) });
    const choices: { label: string; primary?: boolean; disabled?: boolean; run: () => void }[] = [];
    const act = (cmd: Command, done: string) => () => {
      this.ask.close();
      if (this.run(cmd).ok) {
        this.sound.sfx('chime');
        this.toasts.show(done, { kind: 'good', icon: 'home', ms: 3400 });
      }
    };
    if (!plot && !hv.current && (hv.owned || hv.leased)) choices.push({ label: tr('game.home.moveIn'), primary: true, run: act({ type: 'move_home', home: id }, tr('game.home.moved', { name: hv.name })) });
    if (!hv.owned && !hv.leased && hv.rent > 0) choices.push({ label: tr('game.home.rentFor', { n: hv.rent }), primary: true, disabled: this.wallet.coins < hv.rent, run: act({ type: 'rent', home: id }, plot ? tr('game.home.plotYours') : tr('game.home.keys', { name: hv.name })) });
    if (!hv.owned && hv.price > 0) choices.push({ label: tr('game.home.buyFor', { n: hv.price }), disabled: this.wallet.coins < hv.price, run: act({ type: 'buy', home: id }, tr('game.home.bought', { name: hv.name })) });
    if (hv.leased && !hv.current) choices.push({ label: tr('game.home.endLease'), run: act({ type: 'end_lease', home: id }, tr('game.home.leaseEnded')) });
    choices.push({ label: tr('game.go'), run: () => this.ask.close() });
    this.ask.open({ who: hv.name, text: hv.text, lines, choices });
  }

  private openToday(): void {
    if (!this.daily) return;
    this.refreshDaily();
    if (this.daily) this.todayPanel.open(this.daily, this.daily.letters.some((l) => !l.opened) ? 'mail' : undefined);
  }

  /** Free copies of things answering a key (an id or `#tag`). */
  private haveFor(key: string): number {
    const tag = key.startsWith('#') ? key.slice(1) : null;
    // things one carries count only in the pocket (that is where requests, helps and stalls take them from)
    const fits = (item: string) => (tag ? !!(this.engine.catalog.items[item]?.tags.includes(tag) || this.engine.catalog.items[item]?.category === tag) : item === key);
    const carried = Object.entries(this.pocket.items).filter(([item]) => fits(item)).reduce((n, [, c]) => n + c, 0);
    const furniture = this.inventory
      .filter((i) => i.free > 0 && !this.engine.catalog.items[i.item]?.carry && fits(i.item))
      .reduce((n, i) => n + i.free, 0);
    return carried + furniture;
  }

  /** Free copies of things answering a key, counted the old way (furniture and finds alike). */
  private haveAnyFor(key: string): number {
    const tag = key.startsWith('#') ? key.slice(1) : null;
    return this.inventory
      .filter((i) => i.free > 0 && (tag ? (this.engine.catalog.items[i.item]?.tags.includes(tag) || this.engine.catalog.items[i.item]?.category === tag) : i.item === key))
      .reduce((n, i) => n + i.free, 0);
  }

  private thumbOf(item: string, size: number, rot = 0): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const def = this.engine.catalog.items[item];
    const ctx = c.getContext('2d');
    if (def && ctx) drawPixelThumb(ctx, def, size, size, rot);
    return c;
  }

  private itemLabel(item: string): string {
    return t(this.engine.catalog.items[item]?.name ?? item);
  }

  /** Where and when a thing of the album turns up. */
  private whereToFind(item: string): string {
    const seasons: Record<string, string> = { Spring: tr('game.find.spring'), Summer: tr('game.find.summer'), Autumn: tr('game.find.autumn'), Winter: tr('game.find.winter') };
    const parts: Record<string, string> = { morning: tr('game.find.morning'), day: tr('game.find.day'), evening: tr('game.find.evening'), night: tr('game.find.night') };
    for (const loc of Object.values(this.engine.catalog.locations ?? {})) {
      for (const f of loc.fishing ?? []) {
        const g = f.fish.find((x) => x.item === item);
        if (g) return [f.name, ...(g.seasons ?? []).map((s) => seasons[s]), ...(g.when ?? []).map((w) => parts[w])].join(', ');
      }
      for (const s of loc.spots ?? []) {
        const g = s.gives.find((x) => x.item === item);
        const kind = s.id.split('.')[1];
        if (g) return [`${has(`game.find.${kind}`) ? tr(`game.find.${kind}`) : ''} (${loc.name})`.trim(), ...(g.seasons ?? []).map((x) => seasons[x])].join(', ');
      }
    }
    return tr('game.find.somewhere');
  }

  /** What the player can do right here with the day: gather at a spot, or fish from a shore. */
  private dayTargetHere(): { kind: 'spot'; id: string } | { kind: 'fish'; id: string; name: string } | null {
    if (!this.village || this.location === 'home' || !this.daily) return null;
    const done = new Set(this.daily.gathered_today);
    let best: { id: string; d: number } | null = null;
    for (const s of this.village.def.spots ?? []) {
      if (done.has(s.id)) continue;
      const d = Math.hypot(s.x + 0.5 - this.walker.x, s.y + 0.5 - this.walker.y);
      if (d < 1.15 && (!best || d < best.d)) best = { id: s.id, d };
    }
    if (best) return { kind: 'spot', id: best.id };
    if (this.target || this.daily.catches_left <= 0) return null;
    const cx = Math.floor(this.walker.x);
    const cy = Math.floor(this.walker.y);
    const water = this.village.loc.water;
    const byWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => water.has(cellKey(cx + dx, cy + dy)));
    if (!byWater) return null;
    for (const f of this.village.def.fishing ?? []) {
      if (cx >= f.x && cy >= f.y && cx < f.x + f.w && cy < f.y + f.h) return { kind: 'fish', id: f.id, name: f.name };
    }
    return null;
  }

  private gather(spot: string): void {
    const result = this.engine.command({ type: 'gather', spot }, this.now());
    if (!result.ok) {
      this.toasts.show(result.error.kind === 'nothing_there' ? tr('game.nothingThere') : result.error.message, { icon: 'leaf' });
      return;
    }
    this.persist();
    this.refresh();
    const found = result.events.map((e) => e.kind).find((k) => k.type === 'Gathered');
    const item = String(found?.item ?? '');
    const at = this.renderer.toScreen(this.walker.x, this.walker.y, 70);
    this.toasts.pop(this.itemLabel(item), at.x, at.y, '#7ad06a', 'leaf');
    this.sound.sfx('chime');
    vibrate(this.prefs, 12);
    this.performing = { until: this.time + 0.7, sitting: false };
    this.celebrate(result);
  }

  /** A collection completed by the last find: its reward. */
  private celebrate(result: CommandResult): void {
    if (!result.ok) return;
    for (const k of result.events.map((e) => e.kind)) {
      if (k.type !== 'CollectionCompleted') continue;
      const name = this.engine.catalog.collections?.[String(k.collection)]?.name ?? '';
      this.sound.sfx('buy');
      this.toasts.show(tr('game.collection', { name, reward: this.itemLabel(String(k.reward)) }), { icon: 'gift', kind: 'good', ms: 4200 });
    }
  }

  private startFishing(place: string, name: string): void {
    if (this.daily && this.daily.catches_left <= 0) {
      this.toasts.show(tr('game.fish.gone'), { icon: 'fish' });
      return;
    }
    this.bubble.hide();
    this.fishing.start(name, (ok) => {
      if (!ok) return;
      const known = new Set(this.daily?.collected ?? []);
      const result = this.engine.command({ type: 'fish', place }, this.now());
      if (!result.ok) {
        this.fishing.stop();
        this.toasts.show(result.error.kind === 'too_soon' ? tr('game.fish.gone') : result.error.message, { icon: 'fish' });
        return;
      }
      this.persist();
      this.refresh();
      const item = String(result.events.map((e) => e.kind).find((k) => k.type === 'Caught')?.item ?? '');
      this.sound.sfx('chime');
      vibrate(this.prefs, [20, 40, 20]);
      this.toasts.show(tr('game.fish.caught', { what: known.has(item) ? tr('game.fish.again') : tr('game.fish.new'), item: this.itemLabel(item) }), { icon: 'fish', kind: 'good', ms: 2600 });
      this.celebrate(result);
    });
  }

  private requestOf(npc: string) {
    return this.daily?.requests.find((r) => r.npc === npc && !r.done);
  }

  private deliver(id: string): void {
    const r = this.requestOf(id);
    if (!r) return;
    const result = this.engine.command({ type: 'deliver', npc: id }, this.now());
    if (!result.ok) {
      if (result.error.kind === 'not_enough') this.say(id, tr('game.req.notAll', { text: r.text }), this.followUps(id));
      else this.reportError(result.error);
      return;
    }
    this.persist();
    this.refresh();
    this.npcViews = this.engine.npcs(this.now());
    this.popRewards(result);
    const gift = result.events.map((e) => e.kind).find((k) => k.type === 'Delivered')?.gift;
    if (gift) this.toasts.show(tr('game.gives', { name: this.npcDef(id)?.name ?? '', item: this.itemLabel(String(gift)) }), { icon: 'gift', kind: 'good', ms: 3200 });
    const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ef6f8a', 'heart'), i * 140);
    this.say(id, r.thanks || tr('game.thanks'), this.followUps(id));
  }

  private storyOf(npc: string) {
    return this.daily?.stories.find((s) => s.npc === npc && s.ready && s.next);
  }

  private missingFor(items: [string, number][]): string {
    return items.map(([k, n]) => `${k.startsWith('#') ? TAG_NAMES[k.slice(1)] ?? k : this.itemLabel(k)} ×${n}`).join(', ');
  }

  /** Plays the next chapter of someone's story: its lines one by one, then what it needs and brings. */
  private playStory(id: string): void {
    const s = this.storyOf(id);
    if (!s) return;
    if (!s.has_items && s.ask) {
      // say what is needed first, rather than play the whole scene and stop at the end
      this.say(id, tr('game.story.need', { line: s.lines[s.lines.length - 1] ?? '', items: this.missingFor(s.ask.items) }), [{ icon: 'check', label: tr('game.story.bring'), primary: true, run: () => this.dialogue.close() }]);
      return;
    }
    const lines = [...s.lines];
    const next = () => {
      const line = lines.shift();
      if (line !== undefined) {
        this.say(id, line, [{ icon: 'talk', label: lines.length > 0 ? tr('game.next') : s.ask ? tr('game.story.give', { what: s.ask.text }) : tr('game.wow'), primary: true, run: next }]);
        return;
      }
      const result = this.engine.command({ type: 'advance_story', npc: id }, this.now());
      if (!result.ok) {
        const missing = s.ask ? this.missingFor(s.ask.items) : '';
        this.say(id, result.error.kind === 'not_enough' ? tr('game.story.stillNeed', { missing }) : tr('game.story.laterOk'), [{ icon: 'check', label: tr('game.okay'), primary: true, run: () => this.dialogue.close() }]);
        return;
      }
      this.persist();
      this.refresh();
      const gift = result.events.map((e) => e.kind).find((k) => k.type === 'StoryAdvanced')?.gift;
      if (gift) this.toasts.show(tr('game.gift', { item: this.itemLabel(String(gift)) }), { icon: 'gift', kind: 'good', ms: 3200 });
      this.toasts.show(tr('game.chapterDone', { name: String(s.next) }), { icon: 'talk', kind: 'good', ms: 2600 });
      this.dialogue.close();
    };
    next();
  }

  private openLetter(npc: string, index: number): void {
    const result = this.engine.command({ type: 'claim_letter', npc, letter: index }, this.now());
    if (!result.ok) {
      this.reportError(result.error);
      return;
    }
    this.persist();
    this.refresh();
    this.sound.sfx('tap');
    const gift = result.events.map((e) => e.kind).find((k) => k.type === 'LetterClaimed')?.gift;
    if (gift) this.toasts.show(tr('game.inLetter', { item: this.itemLabel(String(gift)) }), { icon: 'gift', kind: 'good', ms: 3200 });
  }

  // ---- the world outside and its people ---------------------------------------------------------

  private resetWalk(): void {
    this.path = null;
    this.pending = null;
    this.then = null;
    this.seat = null;
    this.performing = null;
    this.bubble.hide();
    this.dialogue.close();
    this.fishing.stop();
    this.pan = { x: 0, y: 0 };
    this.shownRegion = -1;
    this.fader.classList.add('on');
    window.setTimeout(() => this.fader.classList.remove('on'), 160);
  }

  /** Out of the front door: the location it opens onto, in front of the player's own house. */
  private goOut(): void {
    const front = this.engine.catalog.front;
    const def = front ? this.engine.catalog.locations?.[front] : undefined;
    if (!def?.entry || this.location !== 'home' || this.mode !== 'walk') return;
    this.homeSpot = { x: this.walker.x, y: this.walker.y };
    // out of the front door of wherever the player lives now
    const here = this.engine.homes(this.now()).homes.find((x) => x.current);
    if (here && here.location !== 'home' && !(here.location === def.id && here.x === def.entry[0] && here.y === def.entry[1])) this.enterLocation(here.location, [here.x, here.y]);
    else this.enterLocation(def.id, def.entry);
  }

  /**
   * Tells the core where the player goes (finds, stations and help need the player to be there). A locked place
   * says what it wants, and the player stays where they are.
   */
  private travel(to: string): boolean {
    const r = this.engine.command({ type: 'travel', to }, this.now());
    if (r.ok) {
      this.persist();
      return true;
    }
    if (r.error.kind === 'closed') {
      // a shut shop or office: its hours, in its own words
      const def = this.engine.catalog.locations?.[to];
      this.sound.sfx('error');
      if (def?.hours) this.toasts.show(tr(def.days === 'weekdays' ? 'game.place.closedDays' : 'game.place.closed', { name: t(def.name), from: def.hours[0], to: def.hours[1] }), { kind: 'error', icon: 'lock', ms: 4200 });
      else this.reportError(r.error);
      return false;
    }
    if (r.error.kind === 'locked') {
      const hint = this.engine.locations(this.now()).places[to]?.hint;
      this.sound.sfx('error');
      this.toasts.show(hint || tr('game.cantPass'), { kind: 'error', icon: 'lock', ms: 4200 });
    } else {
      this.reportError(r.error);
    }
    return false;
  }

  /** Into a location of the world, standing at a cell (`sent`: the core knows already, as after a taxi ride). */
  private enterLocation(id: string, at: [number, number], sent = false, given?: LocationDef): void {
    const def = given ?? this.engine.catalog.locations?.[id];
    if (!def) return;
    if (!sent && !this.travel(id)) return;
    at = this.cellAt(id, at);
    // a door opens and shuts going in or out of a building
    if (def.inside || this.village?.def.inside) this.sound.at('door', 0.7, 0);
    // a shop's bell over its door, going in
    if (def.inside && SHOP_BELLS.test(id)) window.setTimeout(() => this.sound.at('shop_bell', 0.6, 0), 180);
    const flags = this.placeFlags();
    this.townKey = flags.join('|');
    // the sky leaves its marks on some places (the circle in the wheat)
    const shownDef = this.wonders.withSky(def, this.wonders.skyNow(this.wondersHost()));
    const loc = locationRoom(shownDef, this.engine.catalog, this.homeRoom, def.props.some((p) => p.min_fill) ? this.engine.life(this.now()).dump : 0, Math.floor(this.now() / 1440), [...festiveProps(def, this.engine.catalog, this.festive(), this.festiveStageCache), ...this.carProps(def.id)], this.today().rift, new Set(flags), this.iceToday());
    this.riftShown = this.today().rift;
    this.canvas.style.filter = this.jailedNow() && id === this.engine.drive(this.now())?.police ? JAIL_FILTER : '';
    // a night's chase ends at a door; the rift worlds have their own look (the wonders paint it)
    if (id !== this.location) this.wonders.interrupt(this.wondersHost());
    this.village = { def: shownDef, loc, routes: new Routes(loc, this.engine.catalog), drives: new Drives(roadRoom(loc.room), this.engine.catalog) };
    this.lifeCheck = 0;
    this.updateWeather();
    this.renderer.prewarm(loc.room, this.engine.catalog);
    this.placeChecked = 0;
    // a new place draws its pictures in its first moments: not a measure of the device
    this.ladder.hold(performance.now(), 3000);
    this.location = id;
    this.hud.setTaxi(true);
    this.hud.setBusk(this.media.canBusk());
    this.room = loc.room;
    this.resetWalk();
    this.walker.x = at[0] + 0.5;
    this.walker.y = at[1] + 0.5;
    settle(this.walker, this.room, this.engine.catalog);
    this.landHere();
    this.pet.x = this.walker.x + 0.8;
    this.pet.y = this.walker.y;
    settle(this.pet, this.village.routes.dry, this.engine.catalog);
    this.npcCheck = 0;
    this.greeted.clear();
    this.feel.reset();
    this.sound.sfx('tap');
    this.toasts.show(def.name, { icon: id === this.engine.catalog.front ? 'village' : 'leaf', ms: 1800 });
    if (def.invite_only) window.setTimeout(() => this.dinnerTable(), 700);
  }

  /** Steps into a way out of the location: off to the next one. */
  private checkExits(): void {
    if (!this.village || this.location === 'home') return;
    const exit = exitAt(this.village.def, this.walker.x, this.walker.y);
    if (exit) this.enterLocation(exit.to, exit.at);
  }

  private goHome(): void {
    if (this.location === 'home') return;
    if (!this.travel('home')) return;
    this.overview = false;
    // only guests come in; a walk ends at the door
    this.endWalk(true);
    this.wonders.interrupt(this.wondersHost());
    this.location = 'home';
    this.hud.setTaxi(false);
    this.hud.setBusk(false);
    this.canvas.style.filter = '';
    this.room = this.homeRoom;
    this.village = null;
    this.resetWalk();
    const spot = this.homeSpot ?? { x: 4.5, y: 5.5 };
    this.walker.x = spot.x;
    this.walker.y = spot.y;
    settle(this.walker, this.room, this.engine.catalog);
    this.pet.x = this.walker.x;
    this.pet.y = this.walker.y;
    settle(this.pet, this.room, this.engine.catalog);
    this.npcPoses.clear();
    this.npcCheck = 0;
    const guests = this.npcViews.filter((n) => n.visiting).map((n) => n.name);
    if (guests.length > 0) this.toasts.show(tr('game.guestsHere', { list: guests.join(', ') }), { icon: 'invite', ms: 3200 });
  }

  /** Spots that still have something today, twinkling. */
  private sparkles(): Frame['sparkles'] {
    if (!this.village || this.location === 'home' || !this.daily || this.mode !== 'walk') return undefined;
    const done = new Set(this.daily.gathered_today);
    return (this.village.def.spots ?? []).filter((s) => !done.has(s.id)).map((s) => ({ x: s.x + 0.5, y: s.y + 0.5 }));
  }

  /** The ways out of the location shown, lit on the ground. */
  private exitCells(): Frame['highlight'] {
    if (!this.village || this.location === 'home' || this.mode !== 'walk') return undefined;
    const out: NonNullable<Frame['highlight']> = [];
    for (const e of this.village.def.exits) for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) out.push({ x: e.x + i, y: e.y + j, ok: true });
    return out;
  }

  /** Up the water tower: the whole village at a glance, until the player comes down. */
  private overview = false;

  /** Up the ladder inside the water tower: out onto its gallery, the village below. */
  private climbTower(): void {
    const site = this.engine.catalog.locations?.village?.sites?.find((q) => q.id === 'water_tower_site');
    if (site) this.enterLocation('village', [site.x, site.y]);
    this.climb('water_tower');
  }

  private climb(item = 'water_tower'): void {
    this.overview = true;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.bubble.hide();
    this.sound.sfx('chime');
    const said: Record<string, string> = {
      mountain: tr('game.view.mountain'),
      fire_lookout: tr('game.view.lookout'),
    };
    this.toasts.show(tr('game.view.tower', { said: said[item] ?? tr('game.view.town') }), { icon: 'sun', ms: 3600 });
  }

  /** On a bicycle the player goes nearly twice as fast; it stays outside (left at the door of a building). */
  private riding = false;
  private bikeRot = 0;

  private toggleBike(): void {
    this.riding = !this.riding;
    this.sound.sfx(this.riding ? 'switch' : 'tap');
    this.toasts.show(this.riding ? tr('game.bike.yours') : tr('game.bike.back'), { icon: 'walk', ms: 2200 });
  }

  // ---- the road: the driving school, the service station, driving, the police, the cell, money found -----

  private readonly driveDesk: DriveDesk;
  /** The car being driven (null on foot), the way it was last pushed, the trip's watcher. */
  private car: Car | null = null;
  private carItem = '';
  private carDir: [number, number] = [1, 0];
  private readonly roadWatch = new RoadWatch();
  /** The practical exam under way: the route's points, the next one, what the instructor wrote down. */
  private exam: { route: [number, number][]; next: number; faults: Fault[] } | null = null;
  /** A police car pulled up behind, lights flashing, until then. */
  private policeCar: { x: number; y: number; rot: number; until: number } | null = null;
  private policeSeen = false;
  private roadSaid = 0;
  private wasJailed = false;
  private dash: HTMLElement | null = null;
  private zebraCells: { def: LocationDef; cells: Set<string> } | null = null;

  /** What can be done with a thing of the road where the player is. */
  private roadOptions(item: string): string[] | null {
    const v = this.engine.drive(this.now());
    if (!v) return null;
    const def = this.engine.catalog.items[item];
    if (def?.tags.includes('player_car') && this.location === v.car?.at[0]) {
      const out = ['drive', 'car_info'];
      if ((this.pocket?.items[v.can_item] ?? 0) > 0 && (v.car?.fuel ?? 100) < 100) out.push('can');
      return out;
    }
    if (this.location === v.school && /^(desk|blackboard|school_desk|drive_trainer|office_chair|road_rules_poster)$/.test(item)) return ['driving'];
    if (this.location === v.sto && /^(car_lift|tool_chest|cash_counter|engine_stand|tyre_stack|workbench|car_blue)$/.test(item)) return ['sto'];
    if (this.location === v.town && item === 'fuel_pump') return ['sto'];
    if (this.location === v.police && /^(desk|pc_desk|filing_cabinet)$/.test(item)) return ['police'];
    if (this.location === v.police && item === 'cell_bars' && this.jailedNow()) return ['cellmate'];
    return null;
  }

  private roadAction(action: string): void {
    if (action === 'driving') this.driveDesk.school();
    else if (action === 'sto') this.driveDesk.sto();
    else if (action === 'police') this.driveDesk.police();
    else if (action === 'cellmate') this.driveDesk.cell();
    else if (action === 'drive') this.startCar();
    else if (action === 'licence') this.driveDesk.licence();
    else if (action === 'can') {
      if (this.run({ type: 'refuel' }).ok) {
        this.sound.sfx('pop');
        this.toasts.show(tr('game.car.fuel'), { icon: 'taxi', kind: 'good' });
      }
    } else if (action === 'car_info') {
      const car = this.engine.drive(this.now())?.car;
      if (car) this.ask.open({ who: `«${car.name}»`, text: car.words.join(' '), choices: [{ label: tr('game.road.drive'), primary: !car.broken, run: () => { this.ask.close(); this.startCar(); } }, { label: tr('game.close'), run: () => this.ask.close() }] });
    }
  }

  /** Who of the town's people speaks for the road: the instructor, the mechanic, an officer on duty. */
  private roadPerson(role: 'instructor' | 'mechanic' | 'officer'): string {
    const defs = (this.engine.catalog.residents ?? {}) as Record<string, ResidentDef>;
    const id = role === 'instructor' ? 'res_instructor' : role === 'mechanic' ? 'res_mechanic' : Object.values(defs).find((r) => r.job?.[1] === 'officer')?.id;
    const r = id ? defs[id] : undefined;
    const f = r?.gender === 'f';
    const what = tr(`game.staff.${role === 'instructor' ? 'instructor' : role === 'mechanic' ? 'mechanic' : 'patrol'}${f ? '.f' : ''}`);
    return r ? `${r.name}, ${what}` : what[0].toUpperCase() + what.slice(1);
  }

  /** The parked car among the things of a location (not while it is being driven). */
  private carProps(location: string): LocationProp[] {
    const v = this.engine.drive(this.now());
    const car = v?.car;
    if (!car || car.at[0] !== location || this.car) return [];
    return [{ item: car.item, x: car.at[1], y: car.at[2], rot: car.at[3] }];
  }

  private jailedNow(): boolean {
    const v = this.engine.drive(this.now());
    return !!v?.jailed_until && this.now() < v.jailed_until;
  }

  /** In the cell: one stands behind the bars, not at the door. */
  private cellAt(id: string, at: [number, number]): [number, number] {
    const v = this.engine.drive(this.now());
    if (!v || id !== v.police || !this.jailedNow()) return at;
    const bars = this.engine.catalog.locations?.[id]?.props.filter((q) => q.item === 'cell_bars') ?? [];
    if (bars.length === 0) return at;
    return [Math.min(...bars.map((b) => b.x)) + 1, bars[Math.floor(bars.length / 2)].y];
  }

  /** Once a while: let out of the cell when the time is up; keep inside the bars until then. */
  private checkJail(): void {
    const jailed = this.jailedNow();
    if (this.wasJailed && !jailed) {
      this.canvas.style.filter = '';
      this.toasts.show(tr('game.jail.free'), { icon: 'door', ms: 5200 });
      this.sound.at('door', 0.7, 0);
    }
    this.wasJailed = jailed;
  }

  /** On foot: kept behind the bars while jailed; money on the road picked up by walking over it. */
  private roadAfoot(): void {
    const v = this.engine.drive(this.now());
    if (!v) return;
    if (this.location === v.police && this.jailedNow()) {
      const bars = this.room.placements.filter((q) => q.item === 'cell_bars');
      if (bars.length > 0) {
        const x0 = Math.min(...bars.map((b) => b.x)) + 1.3;
        const y1 = Math.max(...bars.map((b) => b.y)) + 0.7;
        this.walker.x = Math.max(this.walker.x, x0);
        this.walker.y = Math.min(this.walker.y, y1);
      }
    }
    for (const c of v.coins) {
      if (Math.hypot(c.x + 0.5 - this.walker.x, c.y + 0.5 - this.walker.y) > 0.6) continue;
      const r = this.engine.command({ type: 'pick_coin', x: c.x, y: c.y }, this.now());
      if (!r.ok) continue;
      this.persist();
      this.refresh();
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 70);
      this.toasts.pop(`+${c.coins}`, at.x, at.y, '#f4b860', 'coin');
      this.sound.sfx('buy');
      vibrate(this.prefs, 10);
      this.toasts.show(tr(c.coins >= 20 ? 'game.road.note' : c.coins >= 10 ? 'game.road.coin' : 'game.road.coins'), { icon: 'coin', ms: 2600 });
    }
  }

  /** Money lying about here, for the scene. */
  private coinsShown(): Frame['coins'] {
    if (this.location === 'home' || this.mode !== 'walk') return undefined;
    const v = this.engine.drive(this.now());
    return v?.coins.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5, note: c.coins >= 20 }));
  }

  /** Into the car where it stands: a trip begins. */
  private startCar(): void {
    const v = this.engine.drive(this.now());
    const car = v?.car;
    if (!v || !car || this.car) return;
    const r = this.run({ type: 'start_drive', exam: false });
    if (!r.ok) return;
    this.takeWheel(car.item, car.at[1], car.at[2], car.at[3]);
    if (v.licence === null) this.toasts.show(tr('game.car.noLicence'), { icon: 'taxi', ms: 3200 });
  }

  /** Out to the car from the service station's door. */
  private toCar(): void {
    const v = this.engine.drive(this.now());
    const car = v?.car;
    if (!v || !car) return;
    const door = this.engine.catalog.sites?.[v.sto_site];
    if (this.location !== car.at[0] && door) this.enterLocation(car.at[0], [door.x, door.y]);
  }

  private takeWheel(item: string, x: number, y: number, rot: number): void {
    const [w, d] = rot % 2 === 0 ? [2, 1] : [1, 2];
    this.car = { x: x + w / 2, y: y + d / 2, speed: 0, rot, cells: 0 };
    this.carItem = item;
    this.carDir = [[1, 0], [0, 1], [-1, 0], [0, -1]][rot % 4] as [number, number];
    this.roadWatch.reset();
    this.policeSeen = false;
    this.riding = false;
    this.seat = null;
    this.path = null;
    this.walker.x = this.car.x;
    this.walker.y = this.car.y;
    this.sound.sfx('switch');
    this.reloadPlace();
    this.walker.x = this.car.x;
    this.walker.y = this.car.y;
    this.showDash(true);
  }

  /** A frame at the wheel: the stick sets the pace, the car keeps to what is free, the road watches. */
  private driveStep(dt: number): boolean {
    const car = this.car;
    const v = this.village;
    if (!car || !v) return false;
    const blocked = this.ask.isOpen() || this.dialogue.isOpen();
    const stick = this.hud.push();
    const key = this.keys.vector();
    const fromKeys = stick.mag === 0;
    const vx = fromKeys ? key.x : stick.x;
    const vy = fromKeys ? key.y : stick.y;
    const push = blocked ? 0 : fromKeys ? Math.hypot(vx, vy) : stick.mag;
    if (push > 0.05) {
      const n = Math.hypot(vx, vy) || 1;
      this.carDir = [vx / n, vy / n];
    }
    const hurry = this.keys.down.has('ShiftLeft') || this.keys.down.has('ShiftRight');
    car.speed = nextSpeed(car.speed, targetSpeed(push, fromKeys, hurry), dt);
    // the fuel left (the core knows the tank; what is driven now is counted here)
    const range = this.exam ? Infinity : (this.engine.drive(this.now())?.car?.range ?? 0) - car.cells;
    if (range <= 0 && !this.exam) {
      this.toasts.show(tr('game.car.empty'), { icon: 'taxi', ms: 4200 });
      this.parkCar();
      return false;
    }
    if (this.examProgress()) return false;
    if (car.speed < 0.01) return false;
    const want = car.speed * dt;
    const was = { x: this.walker.x, y: this.walker.y };
    stepWalker(this.walker, this.carDir[0], this.carDir[1], want / WALK_SPEED, this.room, this.engine.catalog, this.view);
    // the town's edge: further on the roads are dirt, the car stays in town
    if (exitAt(v.def, this.walker.x, this.walker.y)) {
      this.walker.x = was.x;
      this.walker.y = was.y;
      car.speed = 0;
      if (this.time - this.roadSaid > 4) {
        this.roadSaid = this.time;
        this.toasts.show(tr('game.car.dirt'), { icon: 'taxi', ms: 2600 });
      }
      return false;
    }
    const mx = this.walker.x - was.x;
    const my = this.walker.y - was.y;
    const moved = Math.hypot(mx, my);
    const bumped = want > 0.02 && moved < want * 0.35;
    car.cells += moved;
    car.rot = rotOf(mx, my, car.rot);
    car.x = this.walker.x;
    car.y = this.walker.y;
    if (bumped) {
      this.sound.sfx('error');
      vibrate(this.prefs, 30);
    }
    const speed = car.speed;
    if (bumped) car.speed = 0;
    this.watchRoad(dt, speed, bumped);
    this.updateDash();
    return moved > 1e-4;
  }

  /** The zebra crossings of the place shown. */
  private zebras(): Set<string> {
    const def = this.village?.def;
    if (!def) return new Set();
    if (this.zebraCells?.def !== def) this.zebraCells = { def, cells: new Set(def.props.filter((q) => q.item === 'road_zebra').map((q) => cellKey(q.x, q.y))) };
    return this.zebraCells.cells;
  }

  /** What the road sees of the car this frame: the faults, the police, the exam's points. */
  private watchRoad(dt: number, speed: number, bumped: boolean): void {
    const car = this.car;
    const v = this.engine.drive(this.now());
    if (!car || !v) return;
    const cx = Math.floor(car.x);
    const cy = Math.floor(car.y);
    const floor = this.room.floor_paint[cellKey(cx, cy)] ?? '';
    const school = this.engine.catalog.sites?.school_site;
    const nearSchool = !!school && Math.hypot(school.x + 0.5 - car.x, school.y + 0.5 - car.y) < SCHOOL_ZONE;
    const people = [...this.resPoses.values(), ...[...this.npcPoses.values()].filter((q) => q.visible)];
    let nearest = Infinity;
    for (const q of people) nearest = Math.min(nearest, Math.hypot(q.x - car.x, q.y - car.y));
    const zebra = this.zebras();
    const onZebra = zebra.has(cellKey(cx, cy));
    const zebraBusy = onZebra && people.some((q) => Math.hypot(q.x - car.x, q.y - car.y) < 1.8);
    const faults = this.roadWatch.step({ dt, speed, floor, nearSchool, zebraBusy, nearestPerson: nearest, bumped });
    if (this.exam) {
      for (const f of faults) {
        this.exam.faults.push(f);
        this.toasts.show(tr('game.exam.notes', { more: f === 'speeding' || f === 'school_zone' ? tr('game.exam.speedo') : '' }), { icon: 'page', ms: 2400 });
      }
      return;
    }
    // without a licence, near the police station or a patrol, one is stopped for it
    const police = this.engine.catalog.sites?.[v.police_site];
    const patrol = this.movers.some((m) => m.kind === 'police' && Math.hypot(m.x - car.x, m.y - car.y) < 5);
    if (v.trip && !v.trip.licensed && !this.policeSeen && (patrol || (police && Math.hypot(police.x + 0.5 - car.x, police.y + 0.5 - car.y) < 7))) {
      this.policeSeen = true;
      faults.push('no_licence' as Fault);
    }
    for (const f of faults) {
      if (this.reportFault(f)) return;
    }
  }

  /** The exam's points reached one by one; at the last (the school) it is over. True when it ended. */
  private examProgress(): boolean {
    const car = this.car;
    const exam = this.exam;
    if (!car || !exam) return false;
    const goal = exam.route[exam.next];
    if (!goal || Math.hypot(goal[0] + 0.5 - car.x, goal[1] + 0.5 - car.y) >= 1.8) return false;
    exam.next++;
    this.sound.sfx('chime');
    if (exam.next >= exam.route.length) {
      this.finishExam(true);
      return true;
    }
    this.toasts.show(exam.next === exam.route.length - 1 ? tr('game.exam.back') : tr('game.exam.on'), { icon: 'taxi', ms: 2200 });
    return false;
  }

  /** For the tests: the car put down at a point of the street (as if driven there). */
  debugCarTo(x: number, y: number): void {
    if (!this.car) return;
    this.car.cells += Math.hypot(x - this.car.x, y - this.car.y);
    this.car.x = x;
    this.car.y = y;
    this.walker.x = x;
    this.walker.y = y;
  }

  /** Tells the core of a wrong on the road; when someone saw it, the police pull the car over. True when stopped. */
  private reportFault(kind: string): boolean {
    const car = this.car;
    if (!car) return false;
    const r = this.engine.command({ type: 'violation', kind, cells: Math.round(car.cells), x: Math.floor(car.x), y: Math.floor(car.y) }, this.now());
    if (!r.ok) return false;
    this.persist();
    const kinds = r.events.map((e) => e.kind);
    const seen = kinds.find((k) => k.type === 'Violated') as { seen?: boolean; fine?: number; paid?: boolean } | undefined;
    const arrested = kinds.some((k) => k.type === 'Arrested');
    if (!seen?.seen) {
      if (kind === 'pedestrian' || kind === 'zebra') this.toasts.show(tr('game.car.pedestrian'), { icon: 'talk', ms: 2400 });
      if (kind === 'crash') this.toasts.show(tr('game.car.crash'), { icon: 'taxi', ms: 2400 });
      return false;
    }
    // pulled over: the police car behind, lights flashing
    car.speed = 0;
    const back = [[-1, 0], [0, -1], [1, 0], [0, 1]][car.rot % 4];
    this.policeCar = { x: car.x + back[0] * 2.6, y: car.y + back[1] * 2.6, rot: car.rot, until: this.time + 7 };
    this.sound.at('horn', 0.8, 0);
    this.refresh();
    this.driveDesk.stopped(kind, seen.fine ?? 0, !!seen.paid, arrested, () => {
      if (arrested) this.toCell();
    });
    return true;
  }

  /** Arrested: the car is towed, the night is spent behind bars. */
  private toCell(): void {
    const v = this.engine.drive(this.now());
    this.car = null;
    this.exam = null;
    this.showDash(false);
    this.policeCar = null;
    if (!v) return;
    const police = this.engine.catalog.locations?.[v.police];
    if (!police) return;
    this.enterLocation(v.police, [police.exits[0]?.x ?? 1, police.exits[0]?.y ?? 1], true);
    this.wasJailed = true;
    window.setTimeout(() => this.driveDesk.cell(), 900);
  }

  /** The button at the wheel: stop where one is and get out (on the exam: the instructor is asked to stop). */
  private stopCar(): void {
    if (!this.car) return;
    if (this.exam) {
      this.finishExam(false);
      return;
    }
    // the pavement is no place to leave a car
    const floor = this.room.floor_paint[cellKey(Math.floor(this.car.x), Math.floor(this.car.y))] ?? '';
    if (!DRIVABLE.has(floor) && this.reportFault('sidewalk')) return;
    if (!this.car) return;
    this.parkCar();
  }

  private parkCar(): void {
    const car = this.car;
    if (!car) return;
    const [w, d] = car.rot % 2 === 0 ? [2, 1] : [1, 2];
    const x = Math.floor(car.x - w / 2 + 0.5);
    const y = Math.floor(car.y - d / 2 + 0.5);
    const r = this.engine.command({ type: 'park', cells: Math.round(car.cells), x, y, rot: car.rot }, this.now());
    this.car = null;
    this.showDash(false);
    if (r.ok) this.persist();
    this.refresh();
    this.reloadPlace();
    // out of the door on the near side
    const side = [[0, 1.2], [1.2, 0], [0, -1.2], [-1.2, 0]][car.rot % 4];
    this.walker.x = car.x + side[0];
    this.walker.y = car.y + side[1];
    settle(this.walker, this.room, this.engine.catalog);
    this.sound.at('door', 0.6, 0);
  }

  /** The practical exam: out to the street in the school's car, the instructor beside. */
  private startExam(): void {
    const v = this.engine.drive(this.now());
    const site = v ? this.engine.catalog.sites?.[v.school_site] : undefined;
    if (!v || !site || v.exam === null) return;
    this.ask.close();
    this.enterLocation(v.town, [site.x, site.y]);
    const r = this.run({ type: 'start_drive', exam: true });
    if (!r.ok || !this.village) return;
    // the school's car waits on the street nearest the door
    const roads: [number, number][] = [];
    for (const [x, y] of this.room.cells) if (DRIVABLE.has(this.room.floor_paint[cellKey(x, y)] ?? '') && (this.room.floor_paint[cellKey(x, y)] ?? '') === 'floor.cobble') roads.push([x, y]);
    let start: [number, number] = [site.x, site.y];
    let best = Infinity;
    for (const c of roads) {
      const dd = Math.abs(c[0] - site.x) + Math.abs(c[1] - site.y);
      if (dd < best) {
        best = dd;
        start = c;
      }
    }
    this.exam = { route: examRoute(roads, start, Math.floor(this.now() / 1440)), next: 0, faults: [] };
    this.takeWheel('school_car', start[0], start[1], 0);
    this.toasts.show(tr('game.exam.start'), { icon: 'taxi', ms: 3000 });
  }

  private finishExam(done: boolean): void {
    const exam = this.exam;
    const car = this.car;
    if (!exam || !car) return;
    const faults: string[] = [...exam.faults];
    if (!done) faults.push('unfinished');
    this.engine.command({ type: 'park', cells: Math.round(car.cells), x: Math.floor(car.x), y: Math.floor(car.y), rot: car.rot }, this.now());
    this.car = null;
    this.exam = null;
    this.showDash(false);
    const r = this.run({ type: 'end_exam', faults });
    this.reloadPlace();
    const side = [[0, 1.2], [1.2, 0], [0, -1.2], [-1.2, 0]][car.rot % 4];
    this.walker.x = car.x + side[0];
    this.walker.y = car.y + side[1];
    settle(this.walker, this.room, this.engine.catalog);
    if (!r.ok) return;
    const passed = r.events.some((e) => e.kind.type === 'ExamEnded' && e.kind.passed === true);
    this.sound.sfx(passed ? 'chime' : 'tap');
    if (passed) vibrate(this.prefs, 20);
    this.driveDesk.examResult(passed, faults.filter((f) => f !== 'unfinished'));
  }

  /** The exam's next point, lit on the street. */
  private examMarks(): Frame['highlight'] {
    const goal = this.exam?.route[this.exam.next];
    if (!goal) return undefined;
    const out: NonNullable<Frame['highlight']> = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push({ x: goal[0] + i, y: goal[1] + j, ok: true });
    return out;
  }

  /** The car (and a patrol pulled up behind it) among the movers. */
  /** Whoever one is talking to stays put while the talk lasts (from the tap, while one walks up to them, while
   * the words or the choices are open), and faces the player. */
  private holdTalker(): void {
    const tw = this.talkWith;
    if (!tw) return;
    const talking = this.ask.isOpen() || this.dialogue.isOpen() || this.gifts.isOpen() || this.shop.isOpen() || this.bubble.isOpen() || (this.saying.get(tw.id)?.until ?? 0) > this.time;
    const coming = !!this.path || !!this.pending || this.time - tw.at < 1.5;
    if ((!talking && !coming) || this.companion?.id === tw.id || this.time - tw.at > 600) {
      this.talkWith = null;
      return;
    }
    const map = this.resPoses.has(tw.id) ? this.resPoses : this.npcPoses.has(tw.id) ? this.npcPoses : null;
    if (!map) return;
    tw.pose ??= { ...map.get(tw.id)! };
    const dx = this.walker.x - tw.pose.x;
    const dy = this.walker.y - tw.pose.y;
    map.set(tw.id, { ...tw.pose, walking: false, dx: Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0, dy: Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy) });
  }

  /** Cars are solid: one does not walk into one (sliding along it instead), and a car coming on someone standing
   * in its way moves them aside, to its nearer side. */
  private keepOutOfCars(start: { x: number; y: number }): void {
    const fp = (item: string) => this.engine.catalog.items[item]?.footprint;
    const movers = this.movers.filter((m) => m.kind !== 'cart' || m.moving);
    const w = this.walker;
    const hit = vehicleAt(w, movers, fp);
    if (!hit) return;
    if (!vehicleAt(start, movers, fp)) {
      // walked into it: keep whichever half of the step stays clear of it
      const end = { x: w.x, y: w.y };
      if (!vehicleAt({ x: end.x, y: start.y }, movers, fp)) w.y = start.y;
      else if (!vehicleAt({ x: start.x, y: end.y }, movers, fp)) w.x = start.x;
      else { w.x = start.x; w.y = start.y; }
      this.path = null;
      return;
    }
    // it came on us: step aside if there is ground there (or else to its other side)
    for (const side of [stepAside(w, hit, fp(hit.item)), stepAside({ x: 2 * hit.x - w.x, y: 2 * hit.y - w.y }, hit, fp(hit.item))]) {
      if (canStand(this.room, this.engine.catalog, side.x, side.y) && !vehicleAt(side, movers, fp)) {
        w.x = side.x;
        w.y = side.y;
        this.path = null;
        return;
      }
    }
  }

  private roadMovers(): void {
    if (this.car) this.movers.push({ item: this.carItem, x: this.car.x, y: this.car.y, rot: this.car.rot, bob: this.car.speed > 0.5 ? Math.round(Math.sin(this.time * 9) * 0.5) : 0, moving: this.car.speed > 0.1, kind: 'car' });
    const p = this.policeCar;
    if (p && this.time < p.until) this.movers.push({ item: 'police_car', x: p.x, y: p.y, rot: p.rot, bob: 0, flash: true, moving: false, kind: 'police' });
    else if (p) this.policeCar = null;
  }

  /** The speedometer: a round dial with a needle and a red mark at the town's limit, no numbers. */
  private showDash(on: boolean): void {
    if (on && !this.dash) {
      const el = document.createElement('div');
      el.className = 'drive-dash';
      el.setAttribute('aria-hidden', 'true');
      const mark = needle(TOWN_LIMIT);
      const a = (t: number) => Math.PI * (0.75 + 1.5 * t);
      const tick = (t: number, r0: number, r1: number, color: string, w: number) =>
        `<line x1="${32 + Math.cos(a(t)) * r0}" y1="${32 + Math.sin(a(t)) * r0}" x2="${32 + Math.cos(a(t)) * r1}" y2="${32 + Math.sin(a(t)) * r1}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
      let ticks = '';
      for (let i = 0; i <= 10; i++) ticks += tick(i / 10, 22, 27, '#e8e0c8', 1.5);
      el.innerHTML = `<svg viewBox="0 0 64 64" width="84" height="84"><circle cx="32" cy="32" r="30" fill="#1f1a26" stroke="#3a3a44" stroke-width="3"/>${ticks}${tick(mark, 18, 28, '#d9534f', 3)}<line class="drive-needle" x1="32" y1="32" x2="32" y2="10" stroke="#f4b860" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="32" r="3.5" fill="#f4b860"/></svg>`;
      document.getElementById('app')?.append(el);
      this.dash = el;
    }
    if (this.dash) this.dash.style.display = on ? '' : 'none';
    this.updateDash();
  }

  private updateDash(): void {
    const n = this.dash?.querySelector('.drive-needle');
    if (!n || !this.car) return;
    const deg = (0.75 + 1.5 * needle(this.car.speed)) * 180 + 90;
    n.setAttribute('transform', `rotate(${deg.toFixed(1)} 32 32)`);
  }

  /** For the tests: the car under way, the exam, and the road's view. */
  debugRoad(): { car: Car | null; exam: { route: [number, number][]; next: number; faults: string[] } | null; view: DriveView | null; police: boolean } {
    return { car: this.car ? { ...this.car } : null, exam: this.exam ? { ...this.exam, faults: [...this.exam.faults] } : null, view: this.engine.drive(this.now()), police: !!this.policeCar };
  }

  private comeDown(): void {
    this.overview = false;
    this.pan = { x: 0, y: 0 };
  }

  /** The flower shop: Olena (if she is in) says hello, and its own catalogue opens. */
  private wiresOf: { def: LocationDef; wires: NonNullable<Frame['wires']> } | null = null;

  /** The wires of the location shown, in tiles. */
  private wiresHere(): Frame['wires'] {
    const def = this.village?.def;
    if (!def?.wires) return undefined;
    if (this.wiresOf?.def !== def) {
      const t = (p: [number, number, number]): [number, number, number] => [p[0] / 100, p[1] / 100, p[2]];
      this.wiresOf = { def, wires: def.wires.map((w) => ({ a: t(w.a), b: t(w.b) })) };
    }
    return this.wiresOf.wires;
  }

  /** Something switched on in the room that plays music: a radio, a record player or gramophone, a music box. */
  private playingNow(): Mood | undefined {
    if (this.location === 'radio_in') return 'radio';
    return this.media.playing(this.room.placements);
  }

  /** «Липове FM» on the air: between the songs the presenter reads the village's news and the weather. */
  private nextOnAir = 0;
  private onAir(): void {
    if (this.media.station(this.room.placements) !== 'fm' || this.playingNow() !== 'radio' || this.time < this.nextOnAir) return;
    this.nextOnAir = this.time + 45;
    const news = (this.life?.news ?? []).slice(-12);
    const sky = has(`game.sky.${this.sky}`) ? tr(`game.sky.${this.sky}`) : tr('game.sky.calm');
    const lines = [
      tr('game.fm.0'),
      tr('game.fm.weather', { sky }),
      ...news.map((n) => n.text),
      tr('game.fm.song'),
      tr('game.fm.letters'),
    ];
    const pick = lines[Math.floor(this.time / 45) % lines.length];
    this.toasts.show(tr('game.fm.on', { line: pick }), { icon: 'listen', ms: 5200 });
  }

  private traffic = new Map<string, { delay: number; honk: number; seen: number }>();
  private scapeClock = 0;
  private lastBell = -1;
  private lastSaid = new Map<string, string>();
  private hoofAt = 0;
  private wasLightning = false;
  private wasInWater = false;

  /**
   * Everything that happens makes its sound, heard from where it is: animals in their voices now and then, the
   * hum of engines going by, a siren, hooves; water lapping and fountains; machines at work; the church bell on
   * the hour, the school bell between lessons; people talking; inside, the typewriters, the till, the drips of
   * the cave; thunder after lightning; a splash going into the water.
   */
  private soundscape(dt: number): void {
    const outdoors = this.outdoors();
    // a splash going in, thunder after the flash (every frame: these are moments)
    const inWater = this.swimming();
    if (inWater !== this.wasInWater) this.sound.at('splash', 0.7, 0);
    this.wasInWater = inWater;
    const flash = outdoors && this.sky === 'storm' && (Math.floor(this.time * 10) % 97 < 2 || Math.floor(this.time * 10) % 131 === 0);
    if (flash && !this.wasLightning) window.setTimeout(() => this.sound.at('thunder', 0.9, Math.random() * 0.6 - 0.3), 600 + Math.random() * 1400);
    this.wasLightning = flash;
    this.scapeClock -= dt;
    if (this.scapeClock > 0) return;
    this.scapeClock = 0.25;
    const me = this.walker;
    const near = (x: number, y: number, r = 10) => Math.max(0, 1 - Math.hypot(x - me.x, y - me.y) / r);
    const chance = (perSecond: number) => Math.random() < perSecond * 0.25;
    let engine = 0;
    let siren = 0;
    let hooves = 0;
    let crowd = 0;
    // traffic and animals: the movers about
    const VOICE: Record<string, [string, number]> = {
      cow: ['moo', 0.05], sheep: ['baa', 0.06], goat: ['baa', 0.05], chicken: ['cluck', 0.12], duck: ['quack', 0.08], goose: ['honk_goose', 0.06], swan: ['honk_goose', 0.02],
      dog_street: ['bark', 0.05], pig: ['oink', 0.07], horse: ['neigh', 0.02], bird: ['bird', 0.12], bat: ['bat', 0.15], boar: ['oink', 0.03],
    };
    for (const m of this.movers) {
      const v = near(m.x, m.y, m.kind ? 12 : 9);
      if (v <= 0) continue;
      if (m.kind) {
        if (m.moving && m.kind !== 'bike' && m.kind !== 'cart') engine = Math.max(engine, v);
        if (m.flash && m.moving) siren = Math.max(siren, v);
        if (m.kind === 'cart' && m.moving) hooves = Math.max(hooves, v);
        continue;
      }
      if (m.item.startsWith('horse_rider')) {
        hooves = Math.max(hooves, v);
        continue;
      }
      const voice = VOICE[m.item];
      if (voice && chance(voice[1])) this.soundAt(voice[0], m.x, m.y, 0.8);
    }
    if (hooves > 0 && this.time - this.hoofAt > 0.45) {
      this.hoofAt = this.time;
      this.sound.at('hooves', hooves * 0.8, 0);
    }
    // what stands about: fountains, water, machines and turbines, crowds where many people are
    let water = 0;
    let fountain = 0;
    let machine = 0;
    let turbine = 0;
    if (this.village && outdoors) {
      const lw = this.village.loc.water;
      for (let dy = -5; dy <= 5 && water < 1; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (lw.has(cellKey(Math.floor(me.x) + dx, Math.floor(me.y) + dy))) water = Math.max(water, 1 - Math.hypot(dx, dy) / 6);
        }
      }
      if (this.season === 'Winter') water *= 0.2;
      for (const p of this.room.placements) {
        if (Math.abs(p.x - me.x) > 12 || Math.abs(p.y - me.y) > 12) continue;
        if (p.item === 'fountain' || p.item === 'tiled_fountain') fountain = Math.max(fountain, near(p.x + 1, p.y + 1, 7));
        else if (p.item === 'sawmill' || p.item === 'bread_factory' || p.item === 'flour_mill' || p.item === 'tunnel_oven' || p.item === 'lathe' || p.item === 'printing_press') machine = Math.max(machine, near(p.x + 1, p.y + 1, 9));
        else if (p.item === 'wind_turbine') turbine = Math.max(turbine, near(p.x + 1, p.y + 1, 12));
      }
      const many = [...this.resPoses.values()].filter((r) => Math.hypot(r.x - me.x, r.y - me.y) < 6).length;
      crowd = Math.min(1, Math.max(0, (many - 3) / 8));
      if (this.location === 'hippodrome' && this.raceSaid.endsWith(':off')) crowd = 1;
      // the church bell on the hour (as many strokes as the hour, up to twelve), the school bell between lessons
      const minute = this.now() % 1440;
      const hour = Math.floor(minute / 60);
      if (minute % 60 === 0 && this.lastBell !== Math.floor(this.now() / 60) && hour >= 7 && hour <= 21) {
        this.lastBell = Math.floor(this.now() / 60);
        const church = this.engine.catalog.sites?.church_site;
        const loud = church && this.location === this.engine.catalog.front ? Math.max(0.25, near(church.x, church.y, 60)) : 0.2;
        for (let i = 0; i < ((hour + 11) % 12) + 1; i++) window.setTimeout(() => this.sound.at('church', loud, 0.2), i * 1800);
      }
      const school = this.engine.catalog.sites?.school_site;
      if (school && [480, 525, 570, 615, 660, 705, 750, 795, 840].includes(minute) && this.lastBell !== -minute && this.location === this.engine.catalog.front) {
        this.lastBell = -minute;
        this.soundAt('school_bell', school.x, school.y, 1);
      }
      // the forest's woodpecker by day and the owl at night; frogs by the water of an evening
      const part = partOfDay(minute);
      if (this.location === 'forest' && part !== 'night' && chance(0.03)) this.sound.at('woodpecker', 0.4, Math.random() - 0.5);
      if (part === 'night' && chance(0.03)) this.sound.at('owl', 0.35, Math.random() - 0.5);
      if (water > 0.2 && (part === 'evening' || part === 'night') && this.season !== 'Winter' && chance(0.12)) this.sound.at('frog', water * 0.5, Math.random() - 0.5);
    }
    // the world around for the ambience: the hour, the sky, the water and the ice nearby, the temple, the feast
    {
      const minute = this.debug.minuteOfDay ?? this.now() % 1440;
      let ice = 0;
      const iced = this.village?.loc.ice;
      if (outdoors && iced && iced.size) {
        for (let dy = -6; dy <= 6 && ice < 1; dy++) for (let dx = -6; dx <= 6; dx++) if (iced.has(cellKey(Math.floor(me.x) + dx, Math.floor(me.y) + dy))) ice = Math.max(ice, 1 - Math.hypot(dx, dy) / 7);
      }
      const t = this.engine.catalog.sites?.temple_site;
      const temple = this.location === 'temple_in' ? 1 : t && this.location === this.engine.catalog.front ? Math.max(0, 1 - Math.hypot(t.x - me.x, t.y - me.y) / 14) : 0;
      this.around = {
        dark: daylight(lightMinute(this.room.settings, minute)).dark, minute, season: this.season, sky: this.sky, place: this.location, outdoors,
        roofed: !outdoors && !this.village?.def.underground, underground: !!this.village?.def.underground, water, ice,
        fireworks: outdoors && fireworksAt(this.engine.festival(this.now()), minute), sunday: this.today().weekday_id === 'sunday', temple,
      };
      // the ice-cream cart's bell where it stands, now and then
      const cart = this.engine.catalog.growth?.cart;
      const stop = cart && cart.location === this.location ? cartStop(this.engine.catalog.growth, this.placeFlags(), minute) : null;
      if (cart && stop !== null && chance(0.06)) this.soundAt('cart_bell', cart.spots[stop].x, cart.spots[stop].y, 0.8);
    }
    // inside: the trade of the place
    const id = this.location;
    if (id === 'newsroom_in' && chance(0.6)) this.sound.at('typewriter', 0.35, Math.random() - 0.5);
    if ((id === 'grocery_in' || id === 'bakery_in' || id === 'flower_in' || id === 'cafe_in' || id === 'bar_in' || id === 'creamery_in') && chance(0.04)) this.sound.at('till', 0.4, 0.3);
    if (id === 'library_in' && chance(0.06)) this.sound.at('pages', 0.3, Math.random() - 0.5);
    if (id === 'workshop_in' && chance(0.05)) this.sound.at('saw', 0.4, 0.2);
    if (id === 'factory_in') machine = 0.8;
    if (this.village?.def.underground) {
      if (chance(0.5)) this.sound.at('drip', 0.35 + Math.random() * 0.3, Math.random() * 1.6 - 0.8);
    }
    // people talking near the player: a murmur as each new line is said
    for (const [who, said] of this.saying) {
      if (this.lastSaid.get(who) === said.text) continue;
      this.lastSaid.set(who, said.text);
      const pose = this.resPoses.get(who) ?? this.npcPoses.get(who);
      if (pose) this.soundAt('chatter', pose.x, pose.y, 0.6);
    }
    // washing: the tap runs
    this.sound.loop('tap', this.performing?.wash ? 0.8 : 0);
    if (this.car) engine = Math.max(engine, 0.3 + (this.car.speed / CAR_MAX) * 0.5);
    if (this.policeCar && this.time < this.policeCar.until) siren = Math.max(siren, 0.7);
    this.sound.loop('engine', engine);
    this.sound.loop('siren', siren);
    this.sound.loop('water', water);
    this.sound.loop('fountain', fountain);
    this.sound.loop('machine', machine);
    this.sound.loop('turbine', turbine);
    this.sound.loop('crowd', crowd);
  }

  /** A sound from a place on the map: quieter the further off it is, to the side it is on. */
  private soundAt(kind: string, x: number, y: number, loud = 1): void {
    const d = Math.hypot(x - this.walker.x, y - this.walker.y);
    if (d > 14) return;
    const s = this.renderer.toScreen(x, y, 0);
    const w = typeof window === 'undefined' ? 800 : window.innerWidth;
    const h = heard(d, s.x, w);
    this.sound.at(kind, loud * h.volume, h.pan);
  }

  /**
   * How far the picture can be dragged aside: a little (more when zoomed in), never so far that the room or the
   * player leaves the screen.
   */
  private clampPan(p: { x: number; y: number }): { x: number; y: number } {
    const w = typeof window === 'undefined' ? 800 : window.innerWidth;
    const h = typeof window === 'undefined' ? 400 : window.innerHeight;
    // a photographer may look further round the place than a walker
    const reach = this.photoBar?.isOpen() ? 0.6 : 0.22;
    const mx = w * reach * Math.max(1, this.zoom);
    const my = h * reach * Math.max(1, this.zoom);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }

  /** Which music the place has. */
  private musicPlace(): MusicPlace {
    const id = this.location;
    if (id === 'home') return 'home';
    if (id === MIRROR_TOWN) return 'mirror';
    if (isRiftWorld(id)) return id as MusicPlace;
    if (id === 'cafe_in' || id === 'donuts_in') return 'cafe';
    if (id === 'church_in') return 'church';
    if (id === 'temple_in') return 'temple';
    // the old forest circle on the full-moon night, near its fire
    if (id === 'forest' && this.circleNight()) return 'grove';
    if (this.village?.def.underground) return 'cave';
    if (id === 'forest') return 'forest';
    if (id === 'fields' || id === 'vineyard' || id === 'winery_in') return 'fields';
    if (id === 'farm') return 'farm';
    if (id === 'hippodrome') return 'race';
    return 'village';
  }

  /** The full-moon night at the old circle in the forest (from eight in the evening to one), within earshot of it. */
  private circleNight(): boolean {
    const minute = this.now() % 1440;
    const night = (!!this.today().full_moon && minute >= 20 * 60) || (!!this.today(-1).full_moon && minute < 60);
    const g = this.engine.catalog.sites?.grove_site;
    return night && !!g && Math.hypot(g.x - this.walker.x, g.y - this.walker.y) < 16;
  }

  /** The world around, for the ambience (worked out with the rest of the soundscape, a few times a second). */
  private around: Around | null = null;

  /** What the hero walks on now. */
  private surfaceNow(): Surface {
    const key = cellKey(Math.floor(this.walker.x), Math.floor(this.walker.y));
    const style = this.room.floor_paint[key] ?? this.room.styles.floor;
    if (this.swimming()) return 'water';
    if (this.onIce()) return 'ice';
    return surfaceOf(style, this.outdoors() && this.season === 'Winter');
  }

  /** Out in the world, not at home, not inside a building and not under the ground. */
  private outdoors(): boolean {
    return this.location !== 'home' && !this.village?.def.inside && !this.village?.def.underground;
  }

  /** The taxi's stands elsewhere than here, nearest first. */
  private taxiPlaces: TaxiQuoteView[] = [];

  /** The taxi's prices from where the hero stands now (by demand: the hour, the weather, the feasts, the place),
   * or why no taxi comes here. */
  private taxiQuotes(): { list: TaxiQuoteView[]; refusal: string | null } {
    if (this.location === 'home') return { list: [], refusal: tr('game.taxi.atHome') };
    const x = Math.floor(this.walker.x);
    const y = Math.floor(this.walker.y);
    this.taxiPlaces = this.engine.taxiDestinations(this.location, x, y, this.now()).filter((d) => d.location !== this.location || Math.hypot(d.x - x, d.y - y) > 5);
    return { list: this.taxiPlaces, refusal: null };
  }

  /** Everywhere the taxi goes from here, with the fares, grouped by place, the nearest first. */
  private openTaxi(): void {
    const locs = this.engine.catalog.locations ?? {};
    this.taxiQuotes();
    const order = (d: { location: string; fare: number }) => (d.location === this.location ? 0 : 1000) + this.taxiPlaces.filter((q) => q.location === d.location).reduce((m, q) => Math.min(m, q.fare), 999);
    const list = [...this.taxiPlaces].sort((a, b) => order(a) - order(b) || a.location.localeCompare(b.location) || a.fare - b.fare || a.name.localeCompare(b.name));
    this.taxi.open(list.map((d) => ({ id: d.id, name: d.name, fare: d.fare, eta: d.eta, why: d.why, trend: d.trend, shut: d.shut ?? null, where: d.location === this.location ? tr('game.taxi.near') : (locs[d.location]?.name ?? d.location) })), this.wallet.coins);
  }

  /** Sitting right on the ground out of doors (the grass, the sand, the edge of the square). */
  private groundSit = false;

  /** A taxi ride under way (the fade out and in). */
  private inTaxi = false;

  private rideTaxi(id: string): void {
    const stop = this.taxiPlaces.find((d) => d.id === id);
    if (!stop || this.inTaxi) return;
    // the price agreed is the price paid: when the minute moved it on, the new prices are shown
    const res = this.run({ type: 'take_taxi', to: id, from: this.location, x: Math.floor(this.walker.x), y: Math.floor(this.walker.y), fare: stop.fare });
    if (!res.ok) {
      if (res.error.kind === 'fare_changed') window.setTimeout(() => this.openTaxi(), 400);
      return;
    }
    // the car pulls up (sooner when cars are many), one gets in, the town goes by; out at the stop (one ride at a
    // time, standing up first)
    this.inTaxi = true;
    this.seat = null;
    this.performing = null;
    this.sound.sfx('buy');
    const wait = 600 + Math.min(12, stop.eta) * 120;
    this.toasts.show(tr('game.taxi.coming'), { icon: 'taxi', ms: wait + 300 });
    window.setTimeout(() => this.fader.classList.add('on'), wait);
    window.setTimeout(() => {
      this.enterLocation(stop.location, [stop.x, stop.y], true);
      this.toasts.show(tr('game.taxi.arrived', { name: stop.name }), { icon: 'walk', ms: 2200 });
      this.fader.classList.remove('on');
      this.inTaxi = false;
    }, wait + 500);
  }

  /** The room inside a building of the map, if it can be entered. */
  private roomOf(p: PlacementView): LocationDef | undefined {
    const c = this.engine.catalog;
    if (!this.village || this.village.def.inside) return undefined;
    const site = (this.village.def.sites ?? []).find((s) => s.building && s.building[0] === p.x && s.building[1] === p.y);
    return site ? Object.values(c.locations ?? {}).find((l) => l.inside === site.id) : undefined;
  }

  /** The building whose door the hero stands at (one with a room inside, or one's own home), as a target. */
  private doorNear(): Target | null {
    const v = this.village;
    if (!v || v.def.inside || this.location === 'home') return null;
    for (const site of v.def.sites ?? []) {
      if (!site.building || Math.hypot(site.x + 0.5 - this.walker.x, site.y + 0.5 - this.walker.y) > 1.5) continue;
      const p = this.room.placements.find((q) => q.x === site.building![0] && q.y === site.building![1]);
      if (!p) continue;
      if (this.roomOf(p)) return { kind: 'item', pid: p.pid, item: p.item, action: 'go_in' };
      if (this.homesAt(p).some((h) => h.current)) return { kind: 'item', pid: p.pid, item: p.item, action: 'home' };
    }
    return null;
  }

  /** The doors one can go in by, near the hero: each building with a room inside and one's own home. */
  private doorsAround(r: number): { id: string; x: number; y: number; home: boolean }[] {
    const v = this.village;
    if (!v || v.def.inside || this.location === 'home') return [];
    const out: { id: string; x: number; y: number; home: boolean }[] = [];
    for (const site of v.def.sites ?? []) {
      if (!site.building || Math.hypot(site.x + 0.5 - this.walker.x, site.y + 0.5 - this.walker.y) > r) continue;
      const p = this.room.placements.find((q) => q.x === site.building![0] && q.y === site.building![1]);
      if (!p) continue;
      const home = site.kind === 'home' && this.homesAt(p).some((h) => h.current);
      if (home || this.roomOf(p)) out.push({ id: site.id, x: site.x + 0.5, y: site.y + 0.5, home });
    }
    return out;
  }

  /** Into a public building: just inside its door. */
  private goIn(p: PlacementView): void {
    const room = this.roomOf(p);
    const door = room?.exits[0];
    if (!room || !door) return;
    this.enterLocation(room.id, [door.x + Math.floor(door.w / 2), door.y - 1]);
  }

  private wornThings(): { item: string; free: number }[] {
    const c = this.engine.catalog;
    return this.engine.inventory().filter((i) => i.free > 0 && !!c.items[i.item]?.restores).map((i) => ({ item: i.item, free: i.free }));
  }

  private openWorkshop(): void {
    this.mending.open(this.wornThings(), this.wallet.coins);
  }

  private restore(item: string): boolean {
    const c = this.engine.catalog;
    const into = c.items[item]?.restores;
    const ok = this.run({ type: 'restore', item }).ok;
    if (ok && into) {
      this.sound.sfx('buy');
      this.toasts.show(tr('game.restored', { name: t(c.items[into].name) }), { icon: 'hammer', ms: 2800 });
    }
    this.mending.render(this.wornThings(), this.wallet.coins);
    return ok;
  }

  private openFlowerShop(): void {
    const olena = this.npcViews.find((n) => n.id === 'olena');
    if (olena && olena.place === 'flower_shop' && (this.npcPoses.get('olena')?.visible ?? false)) {
      this.saying.set('olena', { text: tr('game.florist.welcome'), until: this.time + 3 });
    }
    this.shop.openStore(tr('game.florist.shop'), ['flowers']);
  }

  /** The world's weather and season, shown in the village and the forest. */
  private sky = 'clear';
  private season = '';

  /** The season and its week (0..3), as the scene takes it: "Autumn:2". */
  private seasonNow(): string {
    if (this.forcedSeason?.includes(':')) return this.forcedSeason;
    const week = this.engine.world(this.now()).season_phase ?? 1;
    return `${this.season}:${this.forcedSeason ? 1 : week}`;
  }

  /** A look from settings and its figure (the tests' and the screenshots' board of outfits). */
  debugLook(settings: Record<string, string>): Look {
    return lookFromSettings(settings);
  }

  debugFigure(look: Look, dir: Dir) {
    return heroLayers(look, dir, 'idle', 0);
  }

  /** Shows a season and weather regardless of the world's (screenshots and tests). */
  debugWeather(sky: string | null, season: string | null): void {
    this.forcedSky = sky;
    this.forcedSeason = season;
    this.updateWeather();
  }

  /** How the hero feels the air (frost, a glow by the stove, the heat, the rain) — the screen shows it. */
  private skin: FeelLayer;
  private comfortNow: ComfortView | null = null;
  /** When the hero last came out of the water (Date.now()), and when someone last remarked on the cold. */
  private swumAt = 0;
  private remarkAt = -1e9;

  private forcedSky: string | null = null;
  private forcedSeason: string | null = null;

  private updateWeather(): void {
    const now = this.now();
    try {
      this.sky = JSON.parse(this.engine.weatherAt(now)) as string;
    } catch {
      this.sky = 'clear';
    }
    this.season = this.engine.world(now).season;
    if (this.forcedSky) this.sky = this.forcedSky;
    if (this.forcedSeason) this.season = this.forcedSeason.split(':')[0];
    if (this.village && this.location !== 'home') {
      // weather only out of doors: not inside a building, not in the cave
      const kind = !this.outdoors() ? 'none' : this.sky === 'storm' ? 'storm' : this.sky === 'rain' ? 'rain' : this.sky === 'snow' ? 'snow' : this.sky === 'fog' ? 'fog' : 'none';
      this.village.loc.room.style_params.weather = { kind };
    }
  }

  private overcast(): number {
    return { clear: 0, cloudy: 0.35, fog: 0.4, rain: 0.7, snow: 0.45, storm: 1 }[this.sky] ?? 0;
  }

  /** Whether the player stands on a frozen lake. */
  private onIce(): boolean {
    return !!this.village && this.location !== 'home' && this.village.loc.ice.has(cellKey(Math.floor(this.walker.x), Math.floor(this.walker.y)));
  }

  /** The lakes and ponds are frozen today (the core decides, by the real winter's frosts). */
  private iceToday(): boolean {
    try {
      return this.engine.comfort(false, -1, this.now()).ice;
    } catch {
      return false;
    }
  }

  /** How warm the hero feels: the core weighs the air, the clothes, the roof, the stove; the screen shows it. */
  private updateComfort(): void {
    if (this.mode === 'edit' || this.overview) {
      this.comfortNow = null;
      this.skin.set(null);
      return;
    }
    if (this.swimming()) this.swumAt = Date.now();
    const swumAgo = this.swumAt ? Math.floor((Date.now() - this.swumAt) / 60000) : -1;
    const things = this.shownRoom()
      .placements.filter((p) => p.item in HEAT)
      .map((p) => ({ item: p.item, x: p.x, y: p.y, w: this.engine.catalog.items[p.item]?.footprint.w ?? 1, d: this.engine.catalog.items[p.item]?.footprint.d ?? 1 }));
    const at = this.seat ?? this.walker;
    const gas = !(this.bills?.utilities ?? []).some((u) => u.id === 'gas' && !u.on);
    try {
      const dragon = this.location === 'home' && (warmsAt(this.housePets, at.x, at.y) || (this.petLook.kind === 7 && Math.hypot(this.pet.x - at.x, this.pet.y - at.y) < 2.5));
      this.comfortNow = this.engine.comfort(nearHeat(at.x, at.y, things, gas) || dragon, swumAgo, this.now());
    } catch {
      this.comfortNow = null;
    }
    // water on the "lens" just out of the lake only for a moment (the rain's stays while it rains)
    const raining = (this.sky === 'rain' || this.sky === 'storm') && this.outdoors();
    const lensDry = !!this.comfortNow?.wet && !raining && !this.swimming() && swumAgo >= 1;
    this.skin.set(this.comfortNow && lensDry ? { ...this.comfortNow, wet: false } : this.comfortNow);
    // someone passing by sees how cold (or hot, or wet) one is, now and then
    const line = this.location !== 'home' ? remark(this.comfortNow, Math.floor(this.time / 7)) : null;
    if (line && this.time - this.remarkAt > 75) {
      const near = [...this.resPoses].find(([id, p]) => Math.hypot(p.x - this.walker.x, p.y - this.walker.y) < 3.2 && (this.saying.get(id)?.until ?? 0) <= this.time);
      if (near) {
        this.saying.set(near[0], { text: line, until: this.time + 4 });
        this.remarkAt = this.time;
      }
    }
  }

  /** Whether the player is in the water (swimming). */
  private swimming(): boolean {
    return !!this.village && this.location !== 'home' && this.season !== 'Winter' && this.village.loc.water.has(cellKey(Math.floor(this.walker.x), Math.floor(this.walker.y)));
  }

  private npcDef(id: string) {
    return this.engine.catalog.npcs?.[id];
  }

  private placesById(): Record<string, PlaceDef> {
    if (!this.allPlaces) {
      this.allPlaces = {};
      for (const loc of Object.values(this.engine.catalog.locations ?? {})) for (const p of loc.places) this.allPlaces[p.id] = p;
    }
    return this.allPlaces;
  }

  private allPlaces: Record<string, PlaceDef> | null = null;
  private shownCache: { room: RoomView; id: number; util: string; feast: string; view: RoomView } | null = null;
  /** Who greeted the player lately, and when (seconds of play). */
  private readonly greeted = new Map<string, number>();
  /** What someone is saying now over their head, until when. */
  private readonly saying = new Map<string, { text: string; until: number }>();
  /** How the townsfolk feel: faces, bubbles, waves, whom they walk with (see townfeel.ts). */
  private readonly feel = new TownFeel();
  private pairs: [string, string][] = [];
  /** Someone walking along with the player, where, and until when (seconds of play). */
  private companion: { id: string; x: number; y: number; until: number; next: number; location: string; trail: [number, number][] } | null = null;

  /** Someone the player likes walks along for a few minutes, chatting on the way. */
  private walkWith(id: string): void {
    const pose = this.npcPoses.get(id);
    const def = this.npcDef(id);
    if (!pose || !def) return;
    this.companion = { id, x: pose.x, y: pose.y, until: this.time + 300, next: this.time + 6, location: this.location, trail: [[pose.x, pose.y]] };
    this.saying.set(id, { text: tr('game.walk.go'), until: this.time + 3 });
  }

  private endWalk(thanks: boolean): void {
    const c = this.companion;
    if (!c) return;
    this.companion = null;
    if (thanks) {
      this.saying.set(c.id, { text: tr('game.walk.thanks'), until: this.time + 3.5 });
      this.toasts.show(tr('game.walk.back', { name: this.npcDef(c.id)?.name ?? '' }), { icon: 'walk', ms: 2400 });
    }
  }

  /** The companion follows the player's own footsteps on dry land, a step behind, and now and then says something. */
  private followCompanion(dt: number): void {
    const c = this.companion;
    if (!c || !this.village) return;
    if (this.time > c.until) {
      this.endWalk(true);
      return;
    }
    const dry = this.village.routes.dry;
    const onDry = (x: number, y: number) => !this.village?.loc.water.has(cellKey(Math.floor(x), Math.floor(y)));
    if (c.location !== this.location) {
      // through a way out together: they arrive right beside the player
      c.location = this.location;
      c.trail = [];
      const p = { x: this.walker.x - 0.8, y: this.walker.y };
      settle(p, dry, this.engine.catalog);
      c.x = p.x;
      c.y = p.y;
    }
    const last = c.trail[c.trail.length - 1];
    if (onDry(this.walker.x, this.walker.y) && (!last || Math.hypot(last[0] - this.walker.x, last[1] - this.walker.y) > 0.3)) {
      c.trail.push([this.walker.x, this.walker.y]);
      if (c.trail.length > 60) c.trail.shift();
    }
    // footsteps are a queue: walk to the oldest one, drop it when reached, stop a step and a half behind
    const behind = () => {
      let n = c.trail.length > 0 ? Math.hypot(c.trail[0][0] - c.x, c.trail[0][1] - c.y) : 0;
      for (let i = 1; i < c.trail.length; i++) n += Math.hypot(c.trail[i][0] - c.trail[i - 1][0], c.trail[i][1] - c.trail[i - 1][1]);
      const tail = c.trail[c.trail.length - 1] ?? [c.x, c.y];
      return n + Math.hypot(this.walker.x - tail[0], this.walker.y - tail[1]);
    };
    let walking = false;
    let dx = 0;
    let dy = 0;
    let left = (behind() > 4 ? 4.5 : 2.8) * dt;
    while (left > 0 && c.trail.length > 0 && behind() > 1.4) {
      const [tx, ty] = c.trail[0];
      const d = Math.hypot(tx - c.x, ty - c.y);
      if (d <= left) {
        c.x = tx;
        c.y = ty;
        left -= d;
        c.trail.shift();
      } else {
        c.x += ((tx - c.x) / d) * left;
        c.y += ((ty - c.y) / d) * left;
        left = 0;
      }
      dx = tx - c.x || dx;
      dy = ty - c.y || dy;
      walking = true;
    }
    this.npcPoses.set(c.id, { x: c.x, y: c.y, walking, dx, dy, visible: true });
    if (this.time > c.next) {
      c.next = this.time + 9 + (mix(idSeed(c.id), Math.floor(this.time)) % 6);
      const def = this.npcDef(c.id);
      const where = this.village?.def.name;
      const lines = [...(def?.chatter ?? []), ...(where ? [tr('game.npc.likes', { where })] : [])];
      if (lines.length > 0) this.saying.set(c.id, { text: lines[mix(idSeed(c.id), Math.floor(this.time / 9)) % lines.length], until: this.time + 3.5 });
    }
  }

  private isHomePlace(place: string): boolean {
    return this.placesById()[place]?.activity === 'home';
  }

  /** Where everyone is this frame: about the location shown, or in the player's home as a guest. */
  private updateNpcs(dt: number): void {
    if (!this.engine.catalog.npcs) return;
    this.npcCheck -= dt;
    if (this.npcCheck <= 0) {
      this.npcCheck = 1;
      this.npcViews = this.engine.npcs(this.now());
    }
    this.npcPoses.clear();
    this.pairs = [];
    if (this.location !== 'home' && this.village) {
      const minutes = this.now() + this.engine.minuteFraction();
      const hour = (minutes % 1440) / 60;
      // people swim only on a summer day in the warm hours; otherwise they walk the shore
      const swim = this.season === 'Summer' && hour >= 10 && hour < 19 && !/rain|storm/i.test(this.sky);
      const ctx = { routes: this.village.routes, here: this.village.def, places: this.placesById(), swim };
      for (const n of this.npcViews) this.npcPoses.set(n.id, npcPose(n, minutes, ctx));
      this.followCompanion(dt);
      this.updateLife(dt, minutes);
      this.socialise();
      return;
    }
    // guests stand about the middle of the room the player is in, each in their own free cell
    const guests = this.npcViews.filter((n) => n.visiting);
    if (guests.length === 0) return;
    const region = this.regions().list[this.currentRegion()];
    if (!region) return;
    const cx = region.cells.reduce((a, c) => a + c[0], 0) / region.cells.length;
    const cy = region.cells.reduce((a, c) => a + c[1], 0) / region.cells.length;
    const blocked = gridOf(this.room, this.engine.catalog).blocked;
    // a guest keeps their spot while the player walks about; it is chosen again when the room changes (something
    // moved) or the player goes to another room, away from where the player stands
    const regionId = this.currentRegion();
    if (this.guestRoom !== this.room || this.guestRegion !== regionId) {
      this.guestRoom = this.room;
      this.guestRegion = regionId;
      this.guestSpots.clear();
    }
    const taken = new Set([...this.guestSpots.values()].map(([x, y]) => cellKey(x, y)));
    const free = region.cells
      .filter(([x, y]) => !blocked.has(cellKey(x, y)) && Math.hypot(x + 0.5 - this.walker.x, y + 0.5 - this.walker.y) > 1.6)
      .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    for (const n of guests) {
      let spot = this.guestSpots.get(n.id);
      if (!spot) {
        spot = free.find(([x, y]) => !taken.has(cellKey(x, y)));
        if (!spot) continue;
        taken.add(cellKey(spot[0], spot[1]));
        this.guestSpots.set(n.id, spot);
      }
      this.npcPoses.set(n.id, { x: spot[0] + 0.5, y: spot[1] + 0.5, walking: false, dx: 0, dy: 0, visible: true });
    }
  }

  /** The settlement's residents, vehicles and animals in the location shown. */
  private updateLife(dt: number, minutes: number): void {
    this.resPoses.clear();
    this.movers = [];
    const v = this.village;
    const c = this.engine.catalog;
    if (!v || !c.sites || !c.site_location) return;
    this.lifeCheck -= dt;
    if (this.lifeCheck <= 0 || !this.life) {
      this.lifeCheck = 1;
      this.life = this.engine.life(this.now());
    }
    const lifeNow = this.now();
    this.feel.update(this.time, () => this.engine.feelings(lifeNow));
    const defs = (c.residents ?? {}) as Record<string, Townsfolk>;
    const day = ((minutes % 1440) + 1440) % 1440;
    // on the other side of the town its people's hours are kept by other beings: the town's own map and plans
    const mirror = v.def.id === MIRROR_TOWN;
    const here = mirror ? (c.locations?.[c.front ?? 'village'] ?? v.def) : v.def;
    const ctx = {
      routes: v.routes,
      here,
      sites: c.sites,
      siteLocation: c.site_location,
      posts: here.inside ? postsInside(here, this.life.residents, minutes) : undefined,
      speedOf: (r: ResidentView) => walkSpeed(r.age, defs[r.id] ?? {}, day) * this.feel.pace(r.id) * this.rainPace(r.id, r.age),
      // a couple go about together; so do two out on a date, or two who just made up
      partnerOf: (id: string) => defs[id]?.partner ?? this.feel.withOf(id),
    };
    const byId = new Map(this.life.residents.map((r) => [r.id, r]));
    for (const r0 of this.life.residents) {
      // two out together keep the same pace about the place, whoever came first
      const other = byId.get(this.feel.withOf(r0.id) ?? '');
      const r = other && other.site === r0.site && !defs[r0.id]?.partner ? { ...r0, since: Math.max(r0.since, other.since) } : r0;
      const pose = this.feel.pose(r.id, residentPose(r, minutes, ctx), this.time, this.walker);
      if (pose.visible) this.resPoses.set(r.id, pose);
    }
    if (!here.inside) this.townReacts();
    // an eclipse or a night of falling stars brings some of them out together to watch
    this.watching = here.id === c.front ? this.wonders.gather(this.wondersHost(), here, this.resPoses, this.life.residents, minutes) : new Map();
    // the taxis drive between the village's doors; at the racecourse the horses race
    const doors = (v.def.sites ?? []).filter((s) => s.kind !== 'home').map((s) => s.id);
    // bread vans from the factory to the bakery, the shops and the café; a grain truck in from the farm and the field
    const bread = ['bread_factory_site', 'bakery', 'grocery', 'cafe_site', 'market_site', 'bar_site'].filter((s) => c.sites?.[s]);
    const vans = taxiTrips(minutes, bread, 1, 'van', 2.6).map((t) => ({ ...t, from: 'bread_factory_site', to: t.to === 'bread_factory_site' ? 'bakery' : t.to }));
    const grain = taxiTrips(minutes, ['farm', 'bread_factory_site'], 1, 'grain', 4).map((t) => ({ ...t, from: 'farm', to: 'bread_factory_site' }));
    // a slow phone has fewer of them about
    const few = this.level >= 2;
    const taxis = v.def.id === c.front ? [...taxiTrips(minutes, doors, few ? 1 : 2), ...taxiTrips(minutes, (v.def.sites ?? []).map((s) => s.id), few ? 1 : 3, 'bike', 2.2), ...vans, ...(few ? [] : grain)] : [];
    // traffic: a vehicle with someone on the road in front of it stops and sounds its horn (a bicycle rings
    // its bell) until they are out of the way, then drives on
    const people = [...this.resPoses.values(), ...[...this.npcPoses.values()].filter((p) => p.visible), this.walker];
    for (const trip of [...this.life.trips, ...taxis]) {
      const key = `${trip.kind}|${trip.from}|${trip.to}|${trip.depart}`;
      const st = this.traffic.get(key) ?? { delay: 0, honk: -9, seen: 0 };
      const m = tripMover(trip, minutes - st.delay / 60, ctx, v.drives);
      if (!m) continue;
      st.seen = this.time;
      if (m.moving && m.heading && st.delay < 30) {
        const ax = m.x + m.heading[0] * 1.1;
        const ay = m.y + m.heading[1] * 1.1;
        if (people.some((p) => Math.hypot(p.x - ax, p.y - ay) < 0.75)) {
          st.delay += dt;
          if (this.time - st.honk > 2.5) {
            st.honk = this.time;
            this.soundAt(m.kind === 'bike' ? 'bell' : m.kind === 'cart' ? 'neigh' : 'horn', m.x, m.y);
          }
        }
      }
      this.traffic.set(key, st);
      this.movers.push(m);
    }
    for (const [k, st] of this.traffic) if (this.time - st.seen > 5) this.traffic.delete(k);
    if (v.def.id === 'hippodrome') {
      this.movers.push(...raceMovers(minutes));
      const news = raceNews(minutes);
      if (news && news.key !== this.raceSaid) {
        this.raceSaid = news.key;
        if (news.key.endsWith(':won')) this.sound.at('cheer', 0.9, 0);
        this.toasts.show(news.text, { icon: 'sparkle', ms: 3200 });
      }
    }
    const part = partOfDay(this.debug.minuteOfDay ?? this.now() % 1440);
    const grid = gridOf(v.routes.dry, c);
    const sky = this.wonders.skyNow(this.wondersHost());
    const herds = (this.level >= 2 ? (v.def.animals ?? []).map((a) => ({ ...a, count: Math.ceil(a.count / 2) })) : (v.def.animals ?? [])).map((a) => (a.kind === 'cow' ? { ...a, count: this.wonders.cows(v.def, sky, a.count) } : a));
    this.movers.push(...animalMovers(herds, minutes * 60, part, v.loc.water, (x, y) => !grid.blocked.has(cellKey(x, y)), this.season));
    // no cars and no cattle on the other side of the town
    if (mirror) this.movers = [];
  }

  /** Firefighters at a burning building aim their hoses at it. */
  private spraysHere(): Frame['sprays'] {
    const c = this.engine.catalog;
    if (!this.life || !c.sites || this.location === 'home') return undefined;
    const out: NonNullable<Frame['sprays']> = [];
    for (const r of this.life.residents) {
      if (r.activity !== 'firefight') continue;
      const pose = this.resPoses.get(r.id);
      const b = c.sites[r.site]?.building;
      const burning = this.life.sites.some((s) => s.id === r.site && s.fire > 0);
      const truck = this.movers.find((m) => m.item === 'fire_truck');
      if (pose && b && burning) out.push({ from: { x: pose.x, y: pose.y }, to: { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 }, hose: truck ? { x: truck.x, y: truck.y } : undefined });
    }
    return out;
  }

  /** Buildings burning in the location shown. */
  private firesHere(): Frame['fires'] {
    const c = this.engine.catalog;
    if (!this.village || this.location === 'home' || !this.life || !c.sites) return undefined;
    const out: NonNullable<Frame['fires']> = [];
    for (const s of this.life.sites) {
      const def = c.sites[s.id];
      if (s.fire > 0 && def?.building && c.site_location?.[s.id] === this.location) out.push({ x: def.building[0], y: def.building[1], w: def.building[2], h: def.building[3], fire: s.fire });
    }
    return out;
  }

  /** Who of the town has a smartphone and a laptop today (the core's adoption, asked once a day). */
  private gadgetsToday(): { day: number; phones: Set<string>; laptops: Set<string> } {
    const day = Math.floor(this.now() / 1440);
    if (this.gadgetDay?.day !== day) {
      const tech = this.engine.tech(this.now());
      this.gadgetDay = { day, phones: new Set(tech.phones), laptops: new Set(tech.laptops) };
    }
    return this.gadgetDay;
  }

  private gadgetDay: { day: number; phones: Set<string>; laptops: Set<string> } | null = null;

  private residentFigures(): NonNullable<Frame['npcs']> {
    const out: NonNullable<Frame['npcs']> = [];
    const defs = this.engine.catalog.residents ?? {};
    const gadgets = this.gadgetsToday();
    const feast = this.outdoors() && this.festive().length > 0;
    const minute = Math.floor(this.now()) % 1440;
    for (const [id, pose] of this.resPoses) {
      const def = defs[id];
      if (!def) continue;
      // dressed for the weather when out (a coat in winter, a raincoat in the rain), as they are indoors
      const weather = { season: this.season, sky: this.sky, outdoors: this.outdoors(), air: this.comfortNow?.out };
      const lookKey = `${id}|${weather.outdoors ? `${weather.season}|${weather.sky}|${Math.floor((weather.air ?? 0) / 40)}` : 'in'}`;
      let look = this.resLooks.get(lookKey);
      if (!look) {
        const settings: Record<string, string> = Object.fromEntries(Object.entries(def.look).map(([k, v]) => [`look.${k}`, v]));
        const uniform = UNIFORM[def.job?.[1] ?? ''];
        Object.assign(settings, uniform ?? {});
        Object.assign(settings, dressForWeather(weather, idSeed(id), def.age, !!uniform, def.gender));
        look = lookFromSettings(settings);
        this.resLooks.set(lookKey, look);
      }
      let dir = this.resDirs.get(id) ?? 'down';
      if (pose.walking) {
        const [rx, ry] = rotXY(this.view, pose.dx, pose.dy);
        dir = dirOf(rx - ry, (rx + ry) / 2, dir);
      } else if (FACE_ALTAR.has(this.location)) {
        // in the church and the temple everyone faces the altar (the north wall); the priest, the keeper face them
        const serving = this.life?.residents.find((x) => x.id === id)?.activity === 'work';
        const [rx, ry] = rotXY(this.view, 0, serving ? 1 : -1);
        dir = dirOf(rx - ry, (rx + ry) / 2, dir);
      } else if (Math.hypot(this.walker.x - pose.x, this.walker.y - pose.y) < 2.5 || this.feel.waving(id, this.time)) {
        const [rx, ry] = rotXY(this.view, this.walker.x - pose.x, this.walker.y - pose.y);
        dir = dirOf(rx - ry, (rx + ry) / 2, dir);
      }
      this.resDirs.set(id, dir);
      const seed = (idSeed(id) % 100) / 37;
      const r0 = this.life?.residents.find((x) => x.id === id);
      // as they are now: a parent with a new baby's pram, a child grown up
      const traits = { ...(def as Townsfolk), pram: r0?.pram ?? (def as Townsfolk).pram, young: r0?.young ?? (def as Townsfolk).young } as Townsfolk;
      const age = r0?.age ?? def.age;
      // the steps keep time with the pace (an elder with a stick steps slowly)
      const pace = (walkSpeed(def.age, traits, Math.floor(this.now()) % 1440) / NPC_SPEED) * this.rainPace(id, def.age);
      const frame = pose.walking ? Math.floor(this.time * 8 * pace) % 4 : Math.floor((this.time + seed) / 0.75) % 2;
      const r = this.life?.residents.find((x) => x.id === id);
      const postman = r?.activity === 'work' && def.job?.[1] === 'postman' && this.engine.catalog.sites?.[r.site]?.kind === 'home';
      const work = r?.activity === 'firefight' ? 'water_plant' : r?.activity === 'patrol' ? 'lock' : r?.activity === 'interview' || postman ? 'page' : null;
      // what they feel shows: on the face, in a bubble now and then, in a skip in the step
      const glare = this.feel.nearCross(id, pose, this.resPoses);
      look = this.feel.face(id, look, this.time, glare);
      const feeling = work ? null : this.feel.bubble(id, this.time, pose, this.resPoses);
      const emote = this.watching.get(id) ?? work ?? feeling?.glyph ?? null;
      const emoteColor = feeling?.color;
      const hop = this.feel.hop(id, pose.walking, this.time);
      // someone in a wheelchair stays in it; a parent with a pram does not sit down on a bench with it
      const seat = pose.walking || r?.activity === 'firefight' || traits.mobility === 'wheelchair' || traits.pram ? null : this.npcSeat(pose.x, pose.y, this.seatsTaken);
      // the pram is the family's: the same colour for both parents
      const family = traits.partner && traits.partner < id ? traits.partner : id;
      if (this.location === MIRROR_TOWN) {
        out.push({ id: `being:mirror:${id}`, x: pose.x, y: pose.y, layers: this.wonders.mirrorLayers(id, dir, pose.walking, frame), emote: null, scale: age === 'child' ? 0.78 : undefined });
        continue;
      }
      // stopped to listen to the hero playing in the street (and clapping when it ends)
      const pin = this.media.audience.pin(id, this.time);
      if (pin) {
        const [rx, ry] = rotXY(this.view, this.walker.x - pin.x, this.walker.y - pin.y);
        const d = dirOf(rx - ry, (rx + ry) / 2, dir);
        this.resDirs.set(id, d);
        out.push({ id, x: pin.x, y: pin.y, layers: residentLayers(look, d, false, Math.floor(this.time / (pin.clap ? 0.2 : 0.75)) % 2, traits, idSeed(family)), emote: pin.clap ? 'heart' : 'play_music', scale: age === 'child' ? 0.78 : undefined });
        continue;
      }
      // a phone in the hands, a laptop on the café table — once the town has them
      const gadget = gadgetOf({ phone: gadgets.phones.has(id), laptop: gadgets.laptops.has(id), walking: pose.walking, seated: !!seat, cafe: this.location === 'cafe_in',
        feast, working: r?.activity === 'work' || r?.activity === 'firefight' || r?.activity === 'patrol', seed: idSeed(id), minute });
      const held = gadget ? gadgetLayers(gadget, seat ? seat.dir : dir, !!seat) : [];
      if (seat) out.push({ id, x: seat.x, y: seat.y, layers: joinLayers(figureLayers(look, seat.dir, this.poseOnSeat(seat.pid), frame, false), this.poseOnSeat(seat.pid) === 'lotus' ? [] : held), emote, emoteColor, scale: age === 'child' ? 0.78 : undefined, seat: { pid: seat.pid, lift: seat.lift } });
      else {
        // out on a frozen lake they skate; on a frosty day their breath shows
        const iced = pose.walking && !!this.village?.loc.ice.has(cellKey(Math.floor(pose.x), Math.floor(pose.y)));
        const fx = { skate: iced, breath: !pose.walking && !!this.comfortNow?.breath && this.outdoors() };
        out.push({ id, x: pose.x, y: pose.y, layers: joinLayers(residentLayers(look, dir, pose.walking, iced ? Math.floor((this.time + seed) / 0.6) % 2 : frame, traits, idSeed(family), false, fx), iced ? [] : held), emote, emoteColor, hop, scale: age === 'child' ? 0.78 : undefined });
      }
    }
    return out;
  }

  /** What a resident says when the player taps them: who they are, what they do, what they heard. */
  /** The name of today's holiday, if it is one (asked once a world day). */
  private todayHoliday(): string | null {
    const day = Math.floor(this.now() / 1440);
    if (this.dayCache?.day !== day) this.dayCache = { day, view: this.engine.dayView(this.now()) };
    return this.dayCache.view.holiday;
  }

  private dayCache: { day: number; view: DayView } | null = null;

  /** Tapping someone: who they are, and what their day is (work, school, mass, or why they are off). */
  private residentSays(id: string): void {
    const r = this.life?.residents.find((x) => x.id === id);
    const def = this.engine.catalog.residents?.[id];
    if (!r || !def) return;
    const f = def.gender === 'f';
    const job = def.job ? ROLE[def.job[1]]?.[f ? 1 : 0] : def.age === 'child' ? tr(f ? 'game.role.pupil.f' : 'game.role.pupil') : def.age === 'elder' ? tr('game.role.retired') : '';
    const ctx = this.talkCtx(id);
    // a word with them counts: they come to know the player (the first word of the day warms them a little)
    const talk: Command = { type: 'talk', npc: id };
    if (this.engine.can(talk, this.now()).ok) this.run(talk);
    const w = this.feel.warmth(id);
    if (!w || w.level === 'stranger' || w.level === 'known') this.feel.surprise(id, this.time);
    if (w?.gift) {
      this.saying.set(id, { text: tr('game.res.gift'), until: this.time + 4 });
      window.setTimeout(() => this.takeKindness(id, def.name), 700);
      return;
    }
    // someone the player did something for remembers it, and says so now and then
    const bond = this.townNow().bonds.find((b) => b.id === id);
    const slot = Math.floor(this.time / 5);
    const remember = bond?.line && slot % 2 === 0 ? bond.line : null;
    // a friend does not introduce themselves again: they greet the player, and may tell them a secret
    const friendly = w && w.level !== 'stranger' && w.level !== 'known';
    const said = friendly ? (w.confide && slot % 3 === 0 ? w.confide : remember ?? `${w.greet}${ctx ? ` ${residentLine(ctx, slot)}` : ''}`) : remember ?? (ctx ? residentIntro(ctx, job ?? '', slot) : null);
    if (said) this.saying.set(id, { text: said, until: this.time + 5 });
    const plan = this.engine.scheduleOf(id, this.now());
    if (plan) this.toasts.show(`${firstName(def.name)}. ${plan.text}`, { icon: 'clock', ms: 4200 });
  }

  /**
   * The townsfolk who like the player show it: a wave and a hello from a little way off; now and then one who is
   * fond of them walks over to say something (and, on a day they have one, has a little something for them).
   */
  private townReacts(): void {
    const busy = (id: string) => this.pairs.some((p) => p.includes(id)) || this.companion?.id === id;
    const { waved, arrived } = this.feel.react(this.time, this.walker, this.resPoses, (x, y) => !!this.village?.routes.free(x, y), busy);
    for (const id of waved) {
      const w = this.feel.warmth(id);
      if (w && (this.saying.get(id)?.until ?? 0) < this.time) this.saying.set(id, { text: w.greet, until: this.time + 3.4 });
    }
    for (const id of arrived) {
      const w = this.feel.warmth(id);
      if (!w) continue;
      const text = w.gift ? tr('game.res.gift2') : w.confide && mix(idSeed(id), Math.floor(this.time / 60)) % 2 === 0 ? w.confide : w.greet;
      this.saying.set(id, { text, until: this.time + 6 });
    }
  }

  /** A close friend's little something, taken with thanks. */
  private takeKindness(id: string, name: string): void {
    const f = this.engine.catalog.residents?.[id]?.gender === 'f';
    this.ask.open({
      who: name,
      text: tr(f ? 'game.res.present.f' : 'game.res.present'),
      choices: [
        {
          label: tr('game.thanks'),
          run: () => {
            this.ask.close();
            const r = this.run({ type: 'accept_gift', who: id });
            const ev = r.ok ? (r.events.find((e) => e.kind.type === 'ResidentGave')?.kind as { item?: string } | undefined) : undefined;
            if (ev?.item) {
              this.feel.surprise(id, this.time);
              this.toasts.show(tr(f ? 'game.res.gave.f' : 'game.res.gave', { name: firstName(name), item: this.itemName(ev.item) }), { icon: 'gift', kind: 'good', ms: 3200 });
            }
          },
        },
        { label: tr('game.res.noNeed'), run: () => this.ask.close() },
      ],
    });
  }

  /** Who a resident is, for what they say: their work, age, other half, the hour, the weather, the news. */
  private talkCtx(id: string): TalkCtx | null {
    const r = this.life?.residents.find((x) => x.id === id);
    const defs = (this.engine.catalog.residents ?? {}) as Record<string, Townsfolk>;
    const def = defs[id];
    if (!r || !def) return null;
    const partner = def.partner && defs[def.partner] ? firstName(defs[def.partner].name) : undefined;
    return {
      id,
      name: firstName(def.name),
      gender: def.gender,
      age: def.age,
      young: def.young,
      partner,
      role: def.job?.[1],
      activity: r.activity,
      part: partOfDay(Math.floor(this.now()) % 1440),
      weather: this.sky,
      season: this.season,
      mood: r.mood,
      mobility: def.mobility,
      pram: def.pram,
      news: [...(this.life?.news ?? []).slice(-6).map((n) => n.text), ...(this.feel.current?.gossip ?? []).slice(0, 3)],
      extra: moodLines(this.feel.mood(id)?.mood, this.feel.mood(id)?.why, def.gender === 'f'),
      topics: def.age === 'child' ? [] : townTopics(id, this.engine.festival(this.now()), this.engine.npp(this.now())),
    };
  }

  /** Who of the paper's people has already asked the player, this outing. */
  private askedBy = new Set<string>();

  /** A journalist out on an interview who sees the player nearby comes up with a question — once an outing. */
  private journalistsAsk(): void {
    for (const r of this.life?.residents ?? []) {
      if (r.activity !== 'interview') continue;
      const key = `${r.id}|${r.since}`;
      const pose = this.resPoses.get(r.id);
      if (!pose || this.askedBy.has(key) || Math.hypot(pose.x - this.walker.x, pose.y - this.walker.y) > 3) continue;
      this.askedBy.add(key);
      const def = this.engine.catalog.residents?.[r.id];
      const f = def?.gender === 'f';
      const name = def?.name.split(' ')[0] ?? '';
      const questions = this.engine.catalog.interviews ?? [];
      if (questions.length === 0) continue;
      const q = idSeed(key) % questions.length;
      const question = questions[q];
      this.saying.set(r.id, { text: tr('game.press.ask', { q: question.q }), until: this.time + 5 });
      window.setTimeout(() => {
        if (this.ask.isOpen()) return;
        this.ask.open({
          who: tr('game.press.who', { name: def?.name ?? tr('game.press.reporter') }),
          text: question.q,
          choices: [
            ...question.answers.map((a, i) => ({
              label: a,
              run: () => {
                this.ask.close();
                const result = this.run({ type: 'interview', question: q, answer: i });
                if (result.ok) this.toasts.show(tr(f ? 'game.press.noted.f' : 'game.press.noted', { name }), { icon: 'paper', kind: 'good', ms: 3600 });
              },
            })),
            { label: tr('game.press.hurry'), run: () => this.ask.close() },
          ],
        });
      }, 1200);
    }
  }

  /**
   * People who meet talk to each other: pairs standing near each other at the same place take turns saying a
   * line of small talk; someone the player walks past says hello.
   */
  private socialise(): void {
    this.journalistsAsk();
    const placeOf = new Map(this.npcViews.map((n) => [n.id, n.place]));
    for (const r of this.life?.residents ?? []) placeOf.set(r.id, r.site);
    const everyone = new Map([...this.npcPoses, ...this.resPoses]);
    // two who are not speaking today do not chat (they glare: see townfeel.ts)
    this.pairs = chatPairs(everyone, placeOf).filter((p) => !p.includes(this.companion?.id ?? '') && !this.feel.quarrel(p[0], p[1]));
    const slot = Math.floor(this.time / 4.5);
    const news = (this.life?.news ?? []).slice(-8).map((n) => n.text);
    for (const [a, b] of this.pairs) {
      const speaker = slot % 2 === 0 ? a : b;
      const current = this.saying.get(speaker);
      if (current && current.until > this.time) continue;
      // not every turn: sometimes they just listen and nod
      if (mix(idSeed(a + b), slot) % 3 === 0) continue;
      const def = this.npcDef(speaker);
      // villagers say their own things; residents each their own (see talk.ts), not what the one beside says
      const busy = new Set([...this.saying.values()].filter((v) => v.until > this.time).map((v) => v.text));
      const ctx = def ? null : this.talkCtx(speaker);
      const text = def ? (def.chatter.length > 0 ? def.chatter[mix(idSeed(speaker), slot + Math.floor(this.now() / 30)) % def.chatter.length] : '') : ctx ? residentLine(ctx, slot + Math.floor(this.now() / 30), busy) : '';
      if (!text) continue;
      this.saying.set(speaker, { text, until: this.time + 3.6 });
    }
    const chatting = new Set(this.pairs.flat());
    if (this.companion) chatting.add(this.companion.id);
    for (const [id, pose] of this.npcPoses) {
      if (!pose.visible || pose.walking || chatting.has(id)) continue;
      const near = Math.hypot(this.walker.x - pose.x, this.walker.y - pose.y) < 2.2;
      const last = this.greeted.get(id) ?? -1e9;
      if (!near || this.time - last < 90) continue;
      const def = this.npcDef(id);
      if (!def || def.greet.length === 0) continue;
      this.greeted.set(id, this.time);
      this.saying.set(id, { text: def.greet[mix(idSeed(id), Math.floor(this.time)) % def.greet.length], until: this.time + 3 });
    }
  }

  private readonly guestSpots = new Map<string, [number, number]>();
  private guestRoom: RoomView | null = null;
  private guestRegion = -1;
  private readonly npcLooks = new Map<string, Look>();
  private readonly npcDirs = new Map<string, Dir>();

  private seatSpotCache: { room: RoomView; spots: { pid: number; x: number; y: number; lift: number; front: [number, number] }[] } | null = null;

  /** Every place to sit in the room shown: each cell of each chair, bench and sofa, facing the way it faces. */
  private seatSpots(): { pid: number; x: number; y: number; lift: number; front: [number, number] }[] {
    if (this.seatSpotCache?.room === this.room) return this.seatSpotCache.spots;
    const spots: { pid: number; x: number; y: number; lift: number; front: [number, number] }[] = [];
    // the chair at a computer is the player's: townsfolk leave it free (and so the computer reachable)
    const desks = new Set<string>();
    for (const p of this.room.placements) {
      const def = this.engine.catalog.items[p.item];
      if (def && PLAYER_DESKS.test(p.item)) for (const [dx, dy] of footprintCells(def, p.rot)) desks.add(cellKey(p.x + dx, p.y + dy));
    }
    const byDesk = (x: number, y: number) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => desks.has(cellKey(Math.floor(x) + dx, Math.floor(y) + dy))));
    for (const p of this.room.placements) {
      const def = this.engine.catalog.items[p.item];
      if (!def || !def.actions.includes('sit')) continue;
      if (footprintCells(def, p.rot).some(([dx, dy]) => byDesk(p.x + dx + 0.5, p.y + dy + 0.5))) continue;
      for (const s of seatSpotsOf(def, p)) spots.push({ pid: p.pid, x: s.x, y: s.y, lift: s.top * Z_PER_CENTI - 6, front: s.front });
    }
    this.seatSpotCache = { room: this.room, spots };
    return spots;
  }

  /** Someone standing still right by a free seat sits down on it (and faces the way it faces). */
  private npcSeat(x: number, y: number, taken: Set<string>): { pid: number; x: number; y: number; lift: number; dir: Dir } | null {
    let best: { pid: number; x: number; y: number; lift: number; front: [number, number] } | null = null;
    let bestD = 1.06;
    for (const s of this.seatSpots()) {
      const d = Math.hypot(s.x - x, s.y - y);
      // right on it, or standing at it (seats themselves are not walked on): it is the one to sit on
      if (d < bestD && !taken.has(`${s.x},${s.y}`)) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return null;
    taken.add(`${best.x},${best.y}`);
    const [rx, ry] = rotXY(this.view, best.front[0], best.front[1]);
    return { pid: best.pid, x: best.x, y: best.y, lift: best.lift, dir: dirOf(rx - ry, (rx + ry) / 2, 'down') };
  }

  /** Out in the rain those with neither an umbrella nor a raincoat hurry along. */
  private rainPace(id: string, age: string): number {
    const wet = this.sky === 'rain' || this.sky === 'storm';
    return wet && this.outdoors() && rainWay(idSeed(id), age) === 'run' ? 1.9 : 1;
  }

  /** Where the hero is on the town's maps: indoors at the building's door, at home at one's address. */
  private heroOnMap(): { loc: string; x: number; y: number } | null {
    if (this.location === 'home') {
      const door = this.engine.taxiDestinations('village', 0, 0, this.now()).find((d) => d.id === 'taxi.home');
      return door ? { loc: door.location, x: door.x, y: door.y } : null;
    }
    const out = this.village?.def.inside ? this.village.def.exits[0] : null;
    if (out) return { loc: out.to, x: out.at[0], y: out.at[1] };
    return { loc: this.location, x: Math.floor(this.walker.x), y: Math.floor(this.walker.y) };
  }

  private setGuide(to: { loc: string; x: number; y: number; name: string } | null): void {
    this.guide = to;
    if (!to) this.guideEl.style.display = 'none';
  }

  /** The paper map's way: an arrow by the hero pointing where to go (to the way out towards it from another map
   * or a room), gone on arrival. */
  private stepGuide(): void {
    const g = this.guide;
    if (!g || this.mode !== 'walk' || this.location === 'home') {
      this.guideEl.style.display = 'none';
      return;
    }
    let tx = g.x + 0.5;
    let ty = g.y + 0.5;
    if (this.location !== g.loc) {
      const locs = this.engine.catalog.locations ?? {};
      const inside = this.village?.def.inside;
      const next = inside ? null : mapPath(locs, this.location, g.loc)?.[1];
      const exit = (this.village?.def.exits ?? []).find((e) => (inside ? true : e.to === next));
      if (!exit) {
        this.guideEl.style.display = 'none';
        return;
      }
      tx = exit.x + exit.w / 2;
      ty = exit.y + exit.h / 2;
    } else if (Math.hypot(tx - this.walker.x, ty - this.walker.y) < 2.6) {
      this.toasts.show(tr('papermap.arrived', { name: g.name }), { icon: 'pin', ms: 2600 });
      this.setGuide(null);
      return;
    }
    const a = this.renderer.toScreen(this.walker.x, this.walker.y, 30);
    const b = this.renderer.toScreen(tx, ty, 0);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    this.guideEl.style.display = '';
    this.guideEl.style.transform = `translate(${Math.round(a.x + Math.cos(ang) * 46)}px, ${Math.round(a.y + Math.sin(ang) * 46)}px) rotate(${ang}rad)`;
  }

  /** The neighbour's letters: the next one is found as soon as the last was followed (at home or in the town),
   * read at once, and kept in the notebook like any promise. */
  private nextLetter(): void {
    // (test builds: the other suites go about their business; ?letters lets the letters come)
    if (this.lettersOff) return;
    if (this.letterBusy || !this.started) return;
    // a letter that asked one to go somewhere is followed by getting there (whatever is open on the screen)
    const went = this.quests?.active.find((q) => q.kind === 'letters' && q.act.do === 'go' && q.act.location === this.location);
    if (went) {
      this.letterBusy = true;
      this.run({ type: 'quest_step', quest: went.key, choice: null });
      this.letterBusy = false;
      return;
    }
    if (this.ask.isOpen() || this.letter.isOpen() || this.paperSheet.isOpen() || (this.location !== 'home' && this.location !== 'village')) return;
    const offer = this.quests?.offers.find((o) => o.kind === 'letters' && o.can_start);
    if (!offer) return;
    this.letterBusy = true;
    const r = this.engine.command({ type: 'quest_start', quest: offer.key }, this.now());
    if (r.ok) {
      this.persist();
      this.quests = this.engine.quests(this.now());
      this.setTracked(offer.key);
      window.setTimeout(() => {
        this.letter.open({ title: offer.title, text: offer.intro, from: offer.giver_name, todo: offer.stages[0] });
        this.sound.sfx('chime');
      }, 900);
    }
    this.letterBusy = false;
  }

  /** Whether one can sit down on the ground here: out of doors, on dry, open ground off the carriageway. */
  private canSitHere(): boolean {
    if (this.location === 'home' || !this.outdoors() || this.car || this.seat || this.swimming() || this.onIce() || this.overview) return false;
    const x = Math.floor(this.walker.x);
    const y = Math.floor(this.walker.y);
    const tile = this.village?.def.tiles?.[y]?.[x];
    return !!this.village?.routes.free(x, y) && tile !== 'c';
  }

  /** Who plays at the town's tables now (old neighbours, by the day). */
  private tableFigs(): TableFigure[] {
    const res = Object.values(this.engine.catalog.residents ?? {}).filter((r) => r.age === 'elder').map((r) => r.id);
    const minute = Math.floor(this.now()) % 1440;
    return tableFigures({ location: this.location, landmarks: this.engine.catalog.locations?.village?.landmarks as never, elders: res, minuteOfDay: minute, day: Math.floor(this.now() / 1440), wet: this.sky === 'rain' || this.sky === 'storm' || this.sky === 'snow', time: this.time });
  }

  /** Sits down at a table: on the free seat nearest to it. */
  private sitByTable(x: number, y: number): void {
    const free = this.seatSpots().filter((s) => !this.seatsTaken.has(`${s.x},${s.y}`) && Math.hypot(s.x - x, s.y - y) < 1.8).sort((a, b) => Math.hypot(a.x - this.walker.x, a.y - this.walker.y) - Math.hypot(b.x - this.walker.x, b.y - this.walker.y))[0];
    if (!free) return;
    const p = this.room.placements.find((q) => q.pid === free.pid);
    const def = p ? this.engine.catalog.items[p.item] : undefined;
    if (p && def) this.sitOn(p, def, 'sit');
  }

  /** The way one sits on the placement `pid` here: on a seat, or cross-legged on the floor (a temple cushion). */
  private poseOnSeat(pid: number): 'sit' | 'lotus' {
    return sittingPose(this.room.placements.find((q) => q.pid === pid)?.item);
  }

  /** Seats taken this frame (the player's own first), so two never sit on one. */
  private seatsTaken = new Set<string>();

  private npcsSeated(shown: RoomView): NonNullable<Frame['npcs']> {
    this.seatsTaken = new Set(this.seat ? [`${this.seat.x},${this.seat.y}`] : []);
    return [...(this.npcFigures(shown) ?? []), ...(this.location !== 'home' ? this.residentFigures() : []), ...(isRiftWorld(this.location) ? this.wonders.beings(this.wondersHost(), this.time) : []), ...this.nightFigures, ...this.townFigures()];
  }

  private npcFigures(shown: RoomView): Frame['npcs'] {
    const out: NonNullable<Frame['npcs']> = [];
    const cells = this.location === 'home' ? new Set(shown.cells.map(([x, y]) => cellKey(x, y))) : null;
    const partner = new Map<string, string>();
    for (const [a, b] of this.pairs) {
      partner.set(a, b);
      partner.set(b, a);
    }
    const part = partOfDay(this.debug.minuteOfDay ?? this.now() % 1440);
    for (const [id, pose] of this.npcPoses) {
      const def = this.npcDef(id);
      if (!def || !pose.visible) continue;
      if (cells && !cells.has(cellKey(Math.floor(pose.x), Math.floor(pose.y)))) continue;
      let look = this.npcLooks.get(id);
      if (!look) {
        look = lookFromSettings(lookSettings(def));
        this.npcLooks.set(id, look);
      }
      let dir = this.npcDirs.get(id) ?? 'down';
      const face = (x: number, y: number) => {
        const [rx, ry] = rotXY(this.view, x - pose.x, y - pose.y);
        dir = dirOf(rx - ry, (rx + ry) / 2, dir);
      };
      // stopped to listen to the hero playing in the street (and clapping when it ends)
      const pin = this.media.audience.pin(id, this.time);
      if (pin) {
        const [rx, ry] = rotXY(this.view, this.walker.x - pin.x, this.walker.y - pin.y);
        const d = dirOf(rx - ry, (rx + ry) / 2, dir);
        this.npcDirs.set(id, d);
        out.push({ id, x: pin.x, y: pin.y, layers: figureLayers(look, d, 'idle', Math.floor(this.time / (pin.clap ? 0.2 : 0.75)) % 2, false), emote: pin.clap ? 'heart' : 'play_music' });
        continue;
      }
      const other = partner.get(id);
      const otherPose = other ? this.npcPoses.get(other) : undefined;
      if (pose.walking) {
        const [rx, ry] = rotXY(this.view, pose.dx, pose.dy);
        dir = dirOf(rx - ry, (rx + ry) / 2, dir);
      } else if (Math.hypot(this.walker.x - pose.x, this.walker.y - pose.y) < 2.5) face(this.walker.x, this.walker.y);
      else if (otherPose) face(otherPose.x, otherPose.y);
      this.npcDirs.set(id, dir);
      const seed = (idSeed(id) % 100) / 37;
      const frame = pose.walking ? Math.floor(this.time * 8) % 4 : Math.floor((this.time + seed) / 0.75) % 2;
      const blink = !pose.walking && (this.time + seed * 3) % 4.7 < 0.16;
      const swim = this.village?.loc.water.has(cellKey(Math.floor(pose.x), Math.floor(pose.y))) ?? false;
      const view = this.npcViews.find((n) => n.id === id);
      const talking = (this.saying.get(id)?.until ?? 0) > this.time;
      const emote = talking || !view ? null : other ? (Math.floor(this.time / 4.5) % 2 === 0 ? 'talk' : null) : emoteFor(id, this.placesById()[view.place]?.activity ?? '', part, this.time);
      const seat = pose.walking || swim ? null : this.npcSeat(pose.x, pose.y, this.seatsTaken);
      if (seat) out.push({ id, x: seat.x, y: seat.y, layers: figureLayers(look, seat.dir, this.poseOnSeat(seat.pid), frame, blink), emote, seat: { pid: seat.pid, lift: seat.lift } });
      else out.push({ id, x: pose.x, y: pose.y, layers: figureLayers(look, dir, pose.walking ? 'walk' : 'idle', frame, blink), swim, emote });
    }
    return out;
  }

  /** Name tags (and what people say) over their heads, and signs over the ways out, as sharp interface text. */
  private placeTags(): void {
    const seen = new Set<string>();
    // up the tower the people are too small for names
    const busy = this.mode !== 'walk' || this.dialogue.isOpen() || this.overview;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const tag = (key: string, x: number, y: number, z: number, html: string, cls: string) => {
      seen.add(key);
      const at = this.renderer.toScreen(x, y, z);
      let el = this.tagEls.get(key);
      // off the screen (most of the town's people on a big map): hidden, and nothing about it changes
      const off = at.x < -120 || at.y < -60 || at.x > vw + 120 || at.y > vh + 120;
      if (off) {
        if (el && el.style.display !== 'none') el.style.display = 'none';
        return;
      }
      if (!el) {
        el = document.createElement('div');
        this.npcTags.append(el);
        this.tagEls.set(key, el);
      }
      if (el.dataset.html !== html) {
        el.innerHTML = html;
        el.dataset.html = html;
      }
      if (el.className !== cls) el.className = cls;
      if (el.style.display === 'none') el.style.display = '';
      // moved only when it has moved (every write of a place lays the page out again)
      const left = `${Math.round(at.x)}px`;
      const top = `${Math.round(at.y)}px`;
      if (el.style.left !== left) el.style.left = left;
      if (el.style.top !== top) el.style.top = top;
    };
    const views = new Map(this.npcViews.map((n) => [n.id, n]));
    if (!busy) {
      for (const [id, pose] of this.npcPoses) {
        const view = views.get(id);
        if (!pose.visible || !view) continue;
        if (this.location === 'home' && this.regionAt(pose.x, pose.y) !== this.currentRegion()) continue;
        const said = this.saying.get(id);
        const say = said && said.until > this.time ? `<span class="say">${said.text}</span>` : '';
        const name = view.met ? `${view.name}<span class="h">♥${view.hearts}</span>` : view.name;
        const swim = this.village?.loc.water.has(cellKey(Math.floor(pose.x), Math.floor(pose.y)));
        tag(`npc:${id}`, pose.x, pose.y, swim ? 44 : 72, say + `<span class="nm">${name}</span>`, `npc-tag${view.talked_today ? '' : ' talk'}`);
      }
      // on the other side of the town no one has a name
      for (const [id, pose] of this.location === MIRROR_TOWN ? [] : this.resPoses) {
        const said = this.saying.get(id);
        const speaking = said && said.until > this.time;
        if (!speaking && Math.hypot(pose.x - this.walker.x, pose.y - this.walker.y) > 3.5) continue;
        const def = this.engine.catalog.residents?.[id];
        const say = speaking ? `<span class="say">${said.text}</span>` : '';
        tag(`res:${id}`, pose.x, pose.y, 72, say + `<span class="nm">${def ? firstName(def.name) : ''}</span>`, 'npc-tag res');
      }
      for (const e of this.village && this.location !== 'home' ? this.village.def.exits : []) {
        tag(`exit:${e.to}`, e.x + e.w / 2, e.y + e.h / 2, 30, `<span class="nm">${e.name}</span>`, 'npc-tag exit');
      }
      // a small mark on the ground at each door one can go in by (no boards over the roofs: the names are on the map)
      for (const d of this.doorsAround(9)) tag(`door:${d.id}`, d.x, d.y, 4, iconSvg(d.home ? 'home' : 'door', 14, '#fff'), d.home ? 'door-mark home' : 'door-mark');
    }
    for (const [key, el] of this.tagEls) {
      if (seen.has(key)) continue;
      el.remove();
      this.tagEls.delete(key);
    }
  }

  /** A tap on someone: what can be done with them, done after walking up to them. */
  private approach(id: string, at: { x: number; y: number }): void {
    const view = this.npcViews.find((n) => n.id === id);
    if (!view) return;
    const actions = [
      { icon: 'talk', label: tr('game.npc.talk'), primary: true, run: () => this.goUpTo(id, () => this.talk(id)) },
      { icon: 'gift', label: tr('game.npc.give'), run: () => this.goUpTo(id, () => this.giveTo(id)) },
    ];
    if (view.hearts >= 1 && this.companion?.id !== id) actions.push({ icon: 'walk', label: tr('game.npc.walk'), run: () => this.goUpTo(id, () => this.walkWith(id)) });
    if (this.companion?.id === id) actions.push({ icon: 'check', label: tr('game.npc.bye'), run: () => this.endWalk(true) });
    if (view.hearts >= INVITE_HEARTS && !view.visiting && !(view.visit && view.visit[1] > this.now())) actions.push({ icon: 'invite', label: tr('game.npc.invite'), run: () => this.goUpTo(id, () => this.inviteDialog(id)) });
    const help = this.helpOf(id);
    if (help) actions.push({ icon: 'heart', label: tr('game.npc.help'), run: () => this.openHelp(help) });
    const job = this.jobRunBy(id);
    if (job) actions.push({ icon: 'hammer', label: tr('game.npc.job'), run: () => this.goUpTo(id, () => this.jobAction(job.id)) });
    this.bubble.show(`npc:${id}`, at.x, at.y - 30, actions);
  }

  private goUpTo(id: string, then: () => void): void {
    this.bubble.hide();
    const pose = this.npcPoses.get(id);
    if (!pose) return;
    if (Math.hypot(this.walker.x - pose.x, this.walker.y - pose.y) <= 1.7) {
      then();
      return;
    }
    const cx = Math.floor(pose.x);
    const cy = Math.floor(pose.y);
    this.walkTo(cellsAround(cx, cy, 1, 1));
    if (this.path) this.then = then;
  }

  private faceNpc(id: string): void {
    const pose = this.npcPoses.get(id);
    if (pose) this.faceTowards(pose.x, pose.y);
  }

  private say(id: string, text: string, choices: DialogueChoice[] = [], onClose: (() => void) | null = null): void {
    const def = this.npcDef(id);
    const view = this.npcViews.find((n) => n.id === id);
    if (!def || !view) return;
    const look = this.npcLooks.get(id) ?? lookFromSettings(lookSettings(def));
    const progress = view.hearts >= 5 ? 1 : (view.points % POINTS_PER_HEART) / POINTS_PER_HEART;
    this.dialogue.show({ name: def.name, layers: figureLayers(look, 'down', 'idle', 0), hearts: view.hearts, progress, text, choices }, onClose);
  }

  private followUps(id: string): DialogueChoice[] {
    const view = this.npcViews.find((n) => n.id === id);
    const out: DialogueChoice[] = [];
    const story = this.storyOf(id);
    if (story) out.push({ icon: 'talk', label: `«${story.next}»`, primary: true, run: () => this.playStory(id) });
    const request = this.requestOf(id);
    if (request) out.push({ icon: 'heart', label: request.ready ? tr('game.npc.deliver') : tr('game.npc.whatNeeded'), primary: request.ready, run: () => (request.ready ? this.deliver(id) : this.say(id, request.text, this.followUps(id))) });
    out.push({ icon: 'gift', label: tr('game.npc.give'), run: () => this.giveTo(id) });
    const job = this.jobRunBy(id);
    if (job) out.push({ icon: 'hammer', label: tr('game.npc.job'), run: () => { this.dialogue.close(); this.jobAction(job.id); } });
    if (view && view.hearts >= INVITE_HEARTS && !view.visiting && !(view.visit && view.visit[1] > this.now())) out.push({ icon: 'invite', label: tr('game.npc.invite'), run: () => this.inviteDialog(id) });
    out.push({ icon: 'check', label: tr('game.npc.bye'), primary: true, run: () => this.dialogue.close() });
    return out;
  }

  /** Talking: the first talk of a day brings the two closer; at some hearts they give something back. */
  private talk(id: string): void {
    const def = this.npcDef(id);
    const before = this.npcViews.find((n) => n.id === id);
    if (!def || !before) return;
    this.faceNpc(id);
    const result = this.engine.command({ type: 'talk', npc: id }, this.now());
    if (!result.ok) {
      if (result.error.kind === 'too_soon') this.say(id, tr('game.npc.talkedOut'));
      else this.reportError(result.error);
      return;
    }
    this.persist();
    this.refresh();
    this.npcViews = this.engine.npcs(this.now());
    const view = this.npcViews.find((n) => n.id === id) ?? before;
    const now = this.now();
    const text = before.met
      ? pickLine(def, { ...view, talks_today: Math.max(0, view.talks_today - 1) }, now % 1440, Math.floor(now / 1440), view.visiting)
      : tr('game.npc.hello', { name: def.name });
    const gift = result.events.map((e) => e.kind).find((k) => k.type === 'NpcGaveGift');
    const giftName = gift ? t(this.engine.catalog.items[String(gift.item)]?.name ?? String(gift.item)) : '';
    const closer = view.hearts > before.hearts;
    if (closer) {
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
      for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ef6f8a', 'heart'), i * 140);
      this.sound.sfx('chime');
    }
    if (gift) {
      this.sound.sfx('buy');
      vibrate(this.prefs, [10, 30, 10]);
      this.toasts.show(tr('game.gives', { name: def.name, item: giftName }), { icon: 'gift', kind: 'good', ms: 3600 });
    } else if (closer) {
      this.toasts.show(tr('game.npc.closer', { name: def.name }), { icon: 'heart', kind: 'good' });
    }
    const request = this.requestOf(id);
    const line = gift ? tr('game.npc.giftLine', { text, gift: giftName }) : text;
    this.say(id, request && before.met ? tr('game.npc.byTheWay', { line, request: request.text }) : line, this.followUps(id));
  }

  private giveTo(id: string): void {
    const def = this.npcDef(id);
    const view = this.npcViews.find((n) => n.id === id);
    if (!def || !view) return;
    if (view.gift_today) {
      this.say(id, tr('game.npc.giftHad'));
      return;
    }
    this.dialogue.close();
    const options = this.engine
      .inventory()
      .filter((i) => i.known && i.free > 0)
      .map((i) => this.engine.catalog.items[i.item])
      .filter((d): d is ItemDef => !!d && !d.hidden && d.acquire !== 'free' && !d.tags.includes('portal'))
      .map((d) => {
        const c = document.createElement('canvas');
        c.width = 48;
        c.height = 48;
        const ctx = c.getContext('2d');
        if (ctx) drawPixelThumb(ctx, d, 48, 48);
        return { id: d.id, name: t(d.name), count: this.inventory.find((i) => i.item === d.id)?.free ?? 1, taste: view.tastes[d.id], thumb: c };
      });
    this.gifts.open(def.name, options, (item) => this.give(id, item));
  }

  private give(id: string, item: string): void {
    const def = this.npcDef(id);
    if (!def) return;
    const result = this.engine.command({ type: 'gift', npc: id, item }, this.now());
    if (!result.ok) {
      this.reportError(result.error);
      return;
    }
    this.persist();
    this.refresh();
    this.npcViews = this.engine.npcs(this.now());
    const taste = Number(result.events.map((e) => e.kind).find((k) => k.type === 'NpcGifted')?.taste ?? 0);
    const lines = taste > 0
      ? [0, 1, 2].map((i) => tr(`game.react.love.${i}`))
      : taste < 0
        ? [0, 1].map((i) => tr(`game.react.dislike.${i}`))
        : [0, 1].map((i) => tr(`game.react.ok.${i}`));
    const view = this.npcViews.find((n) => n.id === id);
    if (taste > 0) {
      const at = this.renderer.toScreen(this.walker.x, this.walker.y, 78);
      for (let i = 0; i < 3; i++) window.setTimeout(() => this.toasts.pop('', at.x - 14 + i * 14, at.y, '#ef6f8a', 'heart'), i * 140);
      this.sound.sfx('chime');
    }
    this.say(id, lines[(view?.points ?? 0) % lines.length], this.followUps(id).filter((c) => c.icon !== 'gift'));
  }

  private inviteDialog(id: string): void {
    const def = this.npcDef(id);
    if (!def) return;
    const now = this.now();
    const evening = Math.floor(now / 1440) * 1440 + 18 * 60;
    const choices: DialogueChoice[] = [{ icon: 'home', label: tr('game.inv.now'), primary: true, run: () => this.invite(id, now, now + VISIT_MINUTES) }];
    if (evening > now) choices.push({ icon: 'rest', label: tr('game.inv.evening'), run: () => this.invite(id, evening, evening + VISIT_MINUTES) });
    choices.push({ icon: 'close', label: tr('game.anotherTime'), run: () => this.dialogue.close() });
    this.say(id, tr('game.inv.ask'), choices);
  }

  private invite(id: string, from: number, until: number): void {
    const def = this.npcDef(id);
    if (!def) return;
    const result = this.engine.command({ type: 'invite', npc: id, from, until }, this.now());
    if (!result.ok) {
      this.dialogue.close();
      this.reportError(result.error);
      return;
    }
    this.persist();
    this.npcViews = this.engine.npcs(this.now());
    const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const soon = from <= this.now();
    this.say(id, soon ? tr('game.inv.going') : tr('game.inv.deal', { at: hhmm(from) }), [], () =>
      this.toasts.show(soon ? tr('game.inv.waits', { name: def.name }) : tr('game.inv.comes', { name: def.name, at: hhmm(from) }), { icon: 'invite', kind: 'good', ms: 3200 }),
    );
  }

  private openPeople(): void {
    const defs = this.engine.catalog.npcs;
    if (!defs) return;
    this.npcViews = this.engine.npcs(this.now());
    const now = this.now();
    const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const names = (view: NpcView, sign: number) => Object.entries(view.tastes).filter(([, v]) => Math.sign(v) === sign).map(([item]) => t(this.engine.catalog.items[item]?.name ?? item));
    const entries: PersonEntry[] = this.npcViews.map((v) => {
      const def = defs[v.id];
      const look = lookFromSettings(lookSettings(def));
      const where = v.visiting ? tr('game.people.visiting') : this.isHomePlace(v.place) ? tr('game.people.atHome', { place: v.place_name }) : v.place_name;
      const visit = v.visit && v.visit[1] > now && !v.visiting ? tr('game.people.comes', { at: hhmm(v.visit[0]) }) : null;
      return {
        id: v.id, name: v.name, about: def.about, layers: figureLayers(look, 'down', 'idle', 0), met: v.met, hearts: v.hearts,
        progress: (v.points % POINTS_PER_HEART) / POINTS_PER_HEART, where, liked: names(v, 1), disliked: names(v, -1), visit,
      };
    });
    entries.sort((a, b) => Number(b.met) - Number(a.met) || b.hearts - a.hearts || a.name.localeCompare(b.name));
    this.people.open(entries);
  }

  /** The look with the armour worn over it: a helmet on the head, the body, the legs and the boots in leather or iron. */
  private armoredLook(): Look {
    const worn = this.pocket.armor;
    if (!worn || !Object.keys(worn).length) return this.look;
    const tone = (id: string) => (/iron|steel/.test(id) ? '#9aa3ad' : /leather/.test(id) ? '#8a5a34' : '#7a7468');
    const key = JSON.stringify(worn);
    if (this.armorLook?.key === key && this.armorLook.base === this.look) return this.armorLook.look;
    const l: Look = { ...this.look };
    if (worn.head) Object.assign(l, { acc: 15, accColor: tone(worn.head) });
    if (worn.body) Object.assign(l, { top: tone(worn.body), top2: shade(tone(worn.body), 0.75) });
    if (worn.legs) Object.assign(l, { bottom: shade(tone(worn.legs), 0.85) });
    if (worn.feet) Object.assign(l, { shoes: shade(tone(worn.feet), 0.7), shoeStyle: 1 });
    this.armorLook = { key, base: this.look, look: l };
    return l;
  }

  private armorLook: { key: string; base: Look; look: Look } | null = null;

  private playerSprite() {
    // lying in bed with the eyes closed; in the bath, at ease; washing, the hands under the tap
    if (this.seat?.mode === 'lie') return heroLayers(this.armoredLook(), 'down', 'idle', 0, true);
    if (this.seat?.mode === 'bath') return heroLayers(this.armoredLook(), 'down', 'idle', 0, this.time % 4.3 < 0.16);
    const hold = this.media.heroHold();
    if (hold) return heroLayers(this.armoredLook(), this.dir, hold, this.media.holdFrame(this.time), this.time % 4.3 < 0.16);
    // on a bicycle: astride its saddle, the hands on the bars, the pedals going round as it rolls
    if (this.riding && this.outdoors() && !this.swimming() && !this.seat) return heroLayers(this.armoredLook(), this.dir, 'pedal', this.moving ? Math.floor(this.time * 8) % 4 : 0, this.time % 4.3 < 0.16);
    const sitting = !!this.seat || (this.performing?.sitting ?? false);
    const pose = this.performing?.wash ? 'wash' : this.performing?.eat ? 'eat' : this.performing?.pray ? 'pray' : this.groundSit && !this.seat ? 'ground' : sitting ? (this.seat ? this.poseOnSeat(this.seat.pid) : 'sit') : this.crouching() && !this.hop ? 'crouch' : this.moving || this.hop ? 'walk' : 'idle';
    // in a hop: the legs apart, mid-stride, the whole way
    const frame = this.hop ? 1 : pose === 'walk' ? Math.floor(this.time * 8) % 4 : pose === 'wash' ? Math.floor(this.time * 6) % 2 : Math.floor(this.time / 0.75) % 2;
    const blink = pose !== 'walk' && this.time % 4.3 < 0.16;
    const fx = heroFx(this.comfortNow, { moving: this.moving, seated: sitting, onIce: this.onIce(), outdoors: this.outdoors() });
    // the shiver and the breath keep their own beat
    const beat = fx.hug || fx.breath ? Math.floor(this.time / (fx.hug ? 0.12 : 1.1)) : frame;
    return heroLayers(this.armoredLook(), this.dir, fx.skate ? 'idle' : pose, fx.skate ? Math.floor(this.time / 0.6) % 2 : pose === 'walk' ? frame : beat, blink, fx);
  }

  /** How high the hero stands now (on a root), and a hop under way up onto one or down off it. */
  private heroLift = 0;
  private hop: { from: number; to: number; t: number; arc?: number; time?: number } | null = null;
  /** The crouch button's state (the key is held instead). */
  private crouchHeld = false;

  /** Down on one's heels: the key held (C, Ctrl or one's own) or the button on. */
  private crouching(): boolean {
    if (this.seat || this.car || this.mode !== 'walk') return false;
    const k = this.keys.down;
    return this.crouchHeld || k.has(this.prefs.keys.crouch) || k.has('ControlLeft') || k.has('ControlRight');
  }

  /** A hop: up on the spot, or along while walking (over a low thing, down off a root). */
  private jump(): void {
    if (this.seat || this.car || this.hop || this.mode !== 'walk' || this.swimming()) return;
    this.crouchHeld = false;
    this.hop = { from: this.heroLift, to: this.heroLift, t: 0, arc: 42 * STEP / 15, time: 0.42 };
    this.sound.at('step', 0.6, 0);
  }

  /** Up and down the land's single steps as one walks (eased over the edge, world.ts easedHeight); a hop up two or
   * onto a root that high, a fall off a higher edge; on the ground everywhere else. */
  private climbStep(dt: number): void {
    const ground = this.seat || this.car || this.location === 'home' ? 0 : easedGroundAt(this.room, this.engine.catalog, this.walker.x, this.walker.y, STEP + 3);
    if (this.hop) {
      // the ground changed under a hop (onto a root, off it): it comes down there
      if (Math.abs(ground - this.hop.to) > 12) this.hop = { ...this.hop, to: ground };
      this.hop.t += dt;
      const k = Math.min(1, this.hop.t / (this.hop.time ?? HOP_TIME));
      // up in an arc and down onto the new height
      const arc = (this.hop.arc ?? 24 + Math.abs(this.hop.to - this.hop.from) * 0.35) * Math.sin(k * Math.PI);
      this.heroLift = this.hop.from + (this.hop.to - this.hop.from) * k + arc;
      if (k >= 1) {
        this.heroLift = this.hop.to;
        this.hop = null;
      }
      return;
    }
    // (a step one walks is eased into the ground's height: only more than a step is hopped or fallen)
    if (Math.abs(ground - this.heroLift) > STEP + 3) {
      this.hop = { from: this.heroLift, to: ground, t: 0 };
      this.sound.at('step', 0.5, 0);
      return;
    }
    this.heroLift = ground;
  }

  /** Whether one may go on from `was` to where one is now: up a step on foot, two in a hop, no more (land only). */
  private canClimbTo(was: { x: number; y: number }): boolean {
    if (!this.room.terrain || this.location === 'home') return true;
    const to = groundAt(this.room, this.engine.catalog, this.walker.x, this.walker.y);
    const from = this.hop ? this.heroLift : groundAt(this.room, this.engine.catalog, was.x, was.y);
    return to - from <= STEP + 3;
  }

  /** The place at hand chosen (what the hero holds), kept on this device. */
  private handSlot = (() => {
    try {
      return Math.max(0, Math.min(8, Number(localStorage.getItem('teul.hand') ?? 0) || 0));
    } catch {
      return 0;
    }
  })();

  private chooseSlot(n: number): void {
    this.handSlot = Math.max(0, Math.min(8, n));
    try {
      localStorage.setItem('teul.hand', String(this.handSlot));
    } catch {
      // the hand is kept for this run only
    }
    this.showHotbar();
  }

  /** What the hero holds: the thing in the chosen place at hand, if any. */
  heldItem(): string | null {
    return this.pocket.hotbar?.[this.handSlot] ?? null;
  }

  /** The light in the hands (either hand): a lantern reaches further and burns steady, a torch flickers nearer; with
   * none, one sees little more than oneself. */
  private handLight(): { reach: number; flicker: boolean; color: string } {
    const tags = [this.heldItem(), this.offhandItem()].flatMap((id) => (id ? this.engine.catalog.items[id]?.tags ?? [] : []));
    if (tags.includes('lantern')) return { reach: 7, flicker: false, color: '#ffe2a0' };
    if (tags.includes('torch')) return { reach: 5, flicker: true, color: '#ffb060' };
    return { reach: 0.9, flicker: false, color: '#ffe2a0' };
  }

  /** What the hero holds in the left hand. */
  offhandItem(): string | null {
    return this.pocket.offhand ?? null;
  }

  private readonly hotThumbs = new Map<string, HTMLCanvasElement>();

  private showHotbar(): void {
    const bar = this.pocket.hotbar ?? Array(9).fill(null);
    const slot = (item: string | null | undefined) => (item ? { item, n: this.pocket.items[item] ?? 0, name: this.itemName(item), thumb: () => {
      let c = this.hotThumbs.get(item);
      if (!c) {
        c = this.thumbOf(item, 34);
        this.hotThumbs.set(item, c);
      }
      return this.copyCanvas(c);
    } } : null);
    this.hud.setHotbar(bar.map(slot), this.handSlot, slot(this.pocket.offhand));
  }

  private copyCanvas(c: HTMLCanvasElement): HTMLCanvasElement {
    const d = document.createElement('canvas');
    d.width = c.width;
    d.height = c.height;
    d.getContext('2d')?.drawImage(c, 0, 0);
    return d;
  }

  /** Puts a carried thing into the chosen place at hand (from the inventory). */
  private toHand(item: string): void {
    const r = this.run({ type: 'set_hotbar', slot: this.handSlot, item });
    if (!r.ok) return;
    this.sound.sfx('pop');
    this.refresh();
  }

  /** A thing put in a hand, a place at hand, or worn (from the inventory's equipment). */
  private equip(cmd: Command): void {
    const r = this.run(cmd);
    if (!r.ok) {
      if (r.error.kind === 'pocket_full') this.toasts.show(tr('game.reason.pocketFull'), { kind: 'error', icon: 'lock', ms: 2600 });
      return;
    }
    this.sound.sfx(cmd.type === 'wear' || cmd.type === 'take_off' ? 'place' : 'pop');
    this.refresh();
  }

  /** The thing in the hand and the one in the left hand change places (X). */
  private swapHands(): void {
    const v = this.engine.pocket();
    if (!v.hotbar?.[this.handSlot] && !v.offhand) return;
    if (!this.run({ type: 'swap_hands', slot: this.handSlot }).ok) return;
    this.sound.sfx('pop');
    this.refresh();
  }

  /** The pets live at home, in one's own rooms: not out in the town. */
  private petAway(): boolean {
    return this.location !== 'home';
  }

  private petSprite() {
    if (this.petLook.kind === 3 || this.petAway()) return null;
    if (this.regions().list.length > 1 && this.regionAt(this.pet.x, this.pet.y) !== this.currentRegion()) return null;
    const p = this.pet;
    const bed = this.room.placements.find((q) => q.item === 'cat_bed' || q.item === 'doghouse');
    const asleep = p.pose === 'sleep' && !!bed;
    return {
      x: p.x,
      y: p.y,
      lift: asleep ? 6 : 0,
      layers: petLayers(this.petLook, this.petScreenDir, p.pose, Math.floor(this.time * 6)),
    };
  }

  // ---- test hooks (used by the browser smoke test through ?debug) -------------------------------

  /** A small summary of the state, for end-to-end tests. */
  debugState() {
    return {
      mode: this.mode,
      walker: { x: this.walker.x, y: this.walker.y },
      coins: this.wallet.coins,
      tokens: this.wallet.tokens,
      placements: this.room.placements.map((p) => ({ pid: p.pid, item: p.item, x: p.x, y: p.y, rot: p.rot })),
      free: Object.fromEntries(this.inventory.map((i) => [i.item, i.free])),
      target: this.target,
      held: this.held,
      selected: this.selectedPid,
      sheet: this.shop.isOpen(),
      storage: this.store.kind,
      room: { cells: this.room.cells.length, floorPaint: this.room.floor_paint, wallPaint: this.room.wall_paint, dividers: this.room.dividers.length, settings: this.room.settings, view: this.view },
      history: { undo: this.history.canUndo, redo: this.history.canRedo },
      seat: this.seat ? this.seat.pid : null,
      path: this.path ? this.path.length : null,
      bubble: this.bubble.isOpen(),
      location: this.location,
      dialogue: this.dialogue.isOpen() ? this.dialogue.line() : null,
      npcs: this.npcViews.map((n) => ({ id: n.id, place: n.place, hearts: n.hearts, points: n.points, visiting: n.visiting, shown: this.npcPoses.get(n.id)?.visible ?? false, x: this.npcPoses.get(n.id)?.x ?? null, y: this.npcPoses.get(n.id)?.y ?? null })),
    };
  }

  /** For each room of the home, whether the player can walk into it from the first one. */
  /** People drawn on a blocked cell right now (a prop, a building, water): there should be none (tests). */
  debugStuckPeople(): string[] {
    if (!this.village) return [];
    const grid = gridOf(this.village.routes.dry, this.engine.catalog);
    const out: string[] = [];
    for (const [id, pose] of [...this.resPoses, ...this.npcPoses]) {
      if (!pose.visible) continue;
      const k = cellKey(Math.floor(pose.x), Math.floor(pose.y));
      // swimmers in the pond on a summer day are where they should be
      if (this.season === 'Summer' && this.village.loc.water.has(k)) continue;
      if (!grid.cells.has(k) || grid.blocked.has(k)) {
        const r = this.life?.residents.find((q) => q.id === id);
        out.push(`${id}@${pose.x.toFixed(2)},${pose.y.toFixed(2)}@${pose.walking ? 'walk' : 'stand'}:${r?.activity}:${r?.site}:${r?.from}:${grid.cells.has(k) ? 'blocked' : 'off'}`);
      }
    }
    return out;
  }

  debugReachable(): Record<string, boolean> {
    const grid = gridOf(this.room, this.engine.catalog);
    return Object.fromEntries(this.regions().list.map((r) => {
      const free = r.cells.filter(([x, y]) => !grid.blocked.has(cellKey(x, y)));
      return [this.regionName(r.id), free.some((c) => this.reachable(c))];
    }));
  }

  /** Goes out to the village or back home at once (tests and screenshots). */
  debugGo(where: 'home' | 'village'): void {
    const front = this.engine.catalog.front;
    const entry = front ? this.engine.catalog.locations?.[front]?.entry : undefined;
    if (where === 'village' && this.location !== 'home' && front && entry) this.enterLocation(front, entry);
    else if (where === 'village') this.goOut();
    else this.goHome();
  }

  /** Screen position (CSS px) of someone in the village, for tapping in tests. */
  debugNpcScreen(id: string): { x: number; y: number } | null {
    const pose = this.npcPoses.get(id);
    return pose ? this.renderer.toScreen(pose.x, pose.y, 30) : null;
  }

  /** Starts a talk with someone right away, wherever they are. */
  debugTalk(id: string): void {
    this.talk(id);
  }

  debugProfile(): Record<string, number> {
    return { ...this.renderer.prof };
  }

  debugTeleport(x: number, y: number): void {
    this.walker.x = x;
    this.walker.y = y;
    this.landHere();
  }

  /** One stands on the ground where one has just come (through a door, an arch, a jump of the tests): not up at the
   * height of the place one left, to fall from it. */
  private landHere(): void {
    this.hop = null;
    this.heroLift = this.room ? groundAt(this.room, this.engine.catalog, this.walker.x, this.walker.y) : 0;
  }

  /** Screen position (CSS px, canvas-relative) of the centre of a floor cell, for tapping in tests. */
  debugCellScreen(x: number, y: number): { x: number; y: number } {
    return this.renderer.toScreen(x + 0.5, y + 0.5, 0);
  }

  // ---- scripted content for the first run and for screenshots --------------------------------------

  /** A few cheap things so the first minutes have something to do. */
  private starterRoom(): void {
    // a first room: light from a window, a door, a corner to sit in; the rest is for the player
    // the window, the door, the cup and the fern come with the room (kit.starter); the rest is bought
    const steps: Command[] = [
      { type: 'claim_kit', kit: 'kit.starter' },
      { type: 'place', item: 'window_basic', x: 2, y: 0, rot: 0, wall: 'north' },
      { type: 'place', item: 'door_basic', x: 0, y: 7, rot: 0, wall: 'west' },
      // by the sofa that comes with the house: a little table with a cup on it; a fern by the window; a stool
      // by the lamp; a mat inside the front door
      { type: 'acquire', item: 'side_table' },
      { type: 'place', item: 'side_table', x: 3, y: 5, rot: 0 },
    ];
    for (const cmd of steps) this.engine.command(cmd, this.now());
    const table = this.engine.room().placements.find((p) => p.item === 'side_table')?.pid ?? null;
    const more: Command[] = [
      { type: 'place', item: 'cup', x: 3, y: 5, rot: 0, on: table },
      { type: 'place', item: 'fern', x: 1, y: 0, rot: 0 },
      { type: 'acquire', item: 'stool' },
      { type: 'place', item: 'stool', x: 8, y: 6, rot: 0 },
      { type: 'acquire', item: 'rug_small' },
      { type: 'place', item: 'rug_small', x: 1, y: 7, rot: 0 },
    ];
    for (const cmd of more) this.engine.command(cmd, this.now());
    this.persist();
  }

  /** Plays many world days (with a fake clock offset) and builds a whole furnished house with a garden. */
  private demoPlaythrough(): void {
    const find = (item: string) => this.engine.room().placements.find((p) => p.item === item)?.pid ?? null;
    const findAll = (item: string) => this.engine.room().placements.filter((p) => p.item === item).map((p) => p.pid);
    const place = (item: string, x: number, y: number, rot = 0, wall: WallSide | null = null, on: number | null = null) => {
      this.engine.command({ type: 'acquire', item }, this.now());
      const r = this.engine.command({ type: 'place', item, x, y, rot, wall, on }, this.now());
      const ev = r.ok ? r.events.find((e) => e.kind.type === 'Placed') : undefined;
      return ev ? (ev.kind.pid as number) : null;
    };
    // a few weeks of small chores pay for the house
    place('armchair', 6, 6, 1);
    place('bookcase_tall', 0, 4, 3);
    const fern = find('fern');
    const cup = find('cup');
    const chair = find('armchair');
    const shelf = find('bookcase_tall');
    for (let day = 1; day <= 150; day++) {
      this.debugOffset = day * 1440;
      for (let i = 0; i < 4; i++) {
        if (fern !== null) this.engine.command({ type: 'perform', action: 'water_plant', pid: fern }, this.now() + i);
        if (cup !== null) this.engine.command({ type: 'perform', action: 'brew_tea', pid: cup }, this.now() + 10 + i);
      }
      for (let i = 0; i < 2; i++) if (shelf !== null) this.engine.command({ type: 'perform', action: 'read', pid: shelf }, this.now() + 30 + i * 20);
      if (chair !== null) this.engine.command({ type: 'perform', action: 'rest', pid: chair }, this.now() + 90);
      // friends made over the months: some every day, some now and then
      for (const [npc, every] of [['marta', 1], ['olena', 1], ['yarynka', 2], ['ostap', 4], ['panas', 8]] as const) {
        if (day % every === 0) this.engine.command({ type: 'talk', npc }, this.now() + 600);
      }
    }
    this.debugOffset = 151 * 1440;
    for (const exp of ['exp.nook', 'exp.room', 'exp.wing', 'exp.floor']) this.engine.command({ type: 'expand', expansion: exp }, this.now());
    this.refresh();
    // rooms around the living room, and a garden
    this.addRoom('room', 6, 10, true); // kitchen, east
    this.addRoom('room', 10, 6, true); // bedroom, south
    this.addRoom('room', 6, 6, true); // bathroom, south-east
    this.addRoom('garden', 8, 16, true); // garden along the east side
    this.refresh();
    for (const pid of [find('cup'), find('stool'), find('rug_small'), find('side_table'), find('armchair'), fern]) if (pid !== null) this.engine.command({ type: 'store', pid }, this.now());

    // living room
    place('sofa3', 1, 0);
    place('rug_long', 1, 2);
    const ct = place('coffee_table', 1, 3);
    if (ct !== null) {
      place('teapot', 1, 3, 0, null, ct);
      place('candle', 2, 3, 0, null, ct);
    }
    place('armchair', 4, 2, 1);
    place('floor_lamp', 4, 0);
    place('fern', 0, 0);
    const tvs = place('tv_stand', 1, 6, 2);
    if (tvs !== null) place('tv', 1, 6, 2, null, tvs);
    place('monstera', 3, 6);
    place('painting_wide', 5, 0, 0, 'north');
    place('wall_lamp', 0, 6, 0, 'west');
    const dt = place('round_dining', 6, 2);
    place('dining_chair_wood', 5, 3, 3);
    place('dining_chair_wood', 8, 2, 1);
    if (dt !== null) place('fruit_bowl', 6, 2, 0, null, dt);
    place('piano', 7, 7, 2);
    place('rug_round', 6, 5);
    place('palm', 9, 0);
    // kitchen (x 10..15, y 0..9)
    place('counter', 10, 0);
    const sink = place('counter_sink', 11, 0);
    place('stove', 12, 0);
    const cd = place('counter_drawers', 13, 0);
    place('fridge', 14, 0);
    place('wall_cabinet', 10, 0, 0, 'north');
    place('wall_cabinet', 13, 0, 0, 'north');
    const c1 = find('counter');
    if (c1 !== null) place('coffee_machine', 10, 0, 0, null, c1);
    if (cd !== null) place('herb_pots', 13, 0, 0, null, cd);
    void sink;
    const isl = place('kitchen_island', 11, 4);
    if (isl !== null) place('fruit_bowl', 11, 4, 0, null, isl);
    place('bar_stool', 11, 5);
    place('bar_stool', 12, 5);
    place('olive_tree', 15, 9);
    place('rug_runner', 14, 4);
    // bedroom (x 0..9, y 10..15)
    place('bed', 1, 10);
    const n1 = place('nightstand', 0, 10);
    if (n1 !== null) place('table_lamp', 0, 10, 0, null, n1);
    const n2 = place('nightstand', 3, 10);
    if (n2 !== null) place('photo_frame', 3, 10, 0, null, n2);
    place('rug_shaggy', 1, 13);
    place('wardrobe', 5, 10);
    const van = place('vanity', 7, 10);
    if (van !== null) place('candles_set', 7, 10, 0, null, van);
    place('cat_bed', 8, 14);
    place('toy_box', 5, 14);
    place('floor_lamp_arc', 9, 12);
    place('string_lights', 1, 10, 0, 'north');
    // bathroom (x 10..15, y 10..15)
    place('bathtub', 11, 10);
    place('toilet', 14, 10);
    place('washbasin', 15, 12, 1);
    place('shower', 15, 15);
    place('bath_mat', 12, 12);
    place('laundry_basket', 10, 14);
    place('washing_machine', 11, 15);
    place('towel_rail', 13, 10, 0, 'north');
    place('hanging_plant', 10, 12, 0, 'west');
    // garden (x 16..23, y 0..15): its own place behind the kitchen door, with a pond, trees and a winding path
    const path: [number, number][] = [];
    for (let x = 16; x <= 18; x++) path.push([x, 7]);
    for (let y = 1; y <= 14; y++) path.push([18, y]);
    this.engine.command({ type: 'acquire_style', style: 'floor.path' }, this.now());
    this.engine.command({ type: 'paint_floor', cells: path, style: 'floor.path' }, this.now());
    place('tree_oak', 21, 0);
    place('tree_apple', 16, 0);
    place('tree_maple', 20, 3);
    place('tree_pine', 23, 3);
    place('tree_birch', 16, 3);
    place('bush_round', 19, 0);
    place('berry_bush', 23, 0);
    place('mushrooms', 19, 4);
    place('garden_bench', 19, 6);
    place('lamp_post', 22, 6);
    place('garden_gnome', 21, 7);
    place('birdhouse', 23, 7);
    place('pond_big', 20, 9);
    place('reeds', 23, 9);
    place('reeds', 23, 11);
    place('rocks', 19, 10);
    place('tree_willow', 16, 10);
    place('tulips', 16, 9);
    place('garden_lights', 17, 8);
    place('rose_arch', 16, 13);
    place('flower_bed', 19, 13);
    place('tree_sakura', 21, 13);
    place('doghouse', 23, 15);
    place('picnic_blanket', 19, 14);
    place('pumpkin', 16, 15);
    for (let x = 16; x <= 23; x++) {
      place('fence_picket', x, 0, 0, 'north');
      place('fence_picket', x, 15, 0, 'south');
    }
    for (let y = 0; y <= 15; y++) if (y !== 7) place('fence_picket', 23, y, 0, 'east');
    place('garden_gate', 23, 7, 0, 'east');
    // vegetable garden behind a gate from the garden
    this.refresh();
    this.addRoom('farm', 8, 8, true);
    this.refresh();
    const farm = this.regions().list.find((r) => this.regionName(r.id) === tr('game.room.farm'));
    if (farm) {
      const fx = Math.min(...farm.cells.map((c) => c[0]));
      const fy = Math.min(...farm.cells.map((c) => c[1]));
      const at = (dx: number, dy: number) => [fx + dx, fy + dy] as const;
      place('bed_tomatoes', ...at(0, 0));
      place('bed_cucumbers', ...at(3, 0));
      place('greenhouse', ...at(6, 0));
      place('bed_carrots', ...at(0, 2));
      place('bed_cabbage', ...at(3, 2));
      place('bed_strawberries', ...at(0, 4));
      place('bed_peppers', ...at(3, 4));
      place('corn_row', ...at(6, 3));
      place('pumpkin_patch', ...at(6, 5));
      place('bed_potatoes', ...at(0, 6));
      place('scarecrow', ...at(3, 6));
      place('rain_barrel', ...at(5, 7));
      place('compost_bin', ...at(4, 7));
      place('veg_crate', ...at(2, 7));
      place('watering_can', ...at(5, 2));
    }
    // an orangery next to the house
    this.refresh();
    this.addRoom('orangery', 6, 6, true);
    this.refresh();
    const og = this.regions().list.find((r) => this.regionName(r.id) === tr('game.room.orangery'));
    if (og) {
      const ox = Math.min(...og.cells.map((c) => c[0]));
      const oy = Math.min(...og.cells.map((c) => c[1]));
      place('orange_tree', ox, oy);
      place('lemon_tree', ox + 5, oy);
      place('fig_tree', ox, oy + 5);
      place('banana_plant', ox + 5, oy + 5);
      place('tiled_fountain', ox + 2, oy + 2);
      place('wicker_sofa', ox + 2, oy);
      place('wicker_chair', ox + 4, oy + 3, 1);
      place('bird_of_paradise', ox, oy + 2);
      place('orchid_stand', ox + 5, oy + 2);
      place('potting_bench', ox + 2, oy + 5);
      place('big_palm_pot', ox + 4, oy + 5);
    }
    void findAll;
    this.engine.command({ type: 'recolor', pid: find('sofa3') ?? 0, slot: 'body', color: '#d86aa0' }, this.now());
    this.engine.command({ type: 'invite', npc: 'marta', from: this.now(), until: this.now() + VISIT_MINUTES }, this.now());
    this.walker = { x: 3.5, y: 5.5, facing: 'right' };
    this.persist();
  }
}

export { itemName };
