// Types mirroring the JSON that the Rust engine produces. Kept in one place so the shell has a single
// contract with the core.

export type WallSide = 'north' | 'east' | 'south' | 'west';
export type Layer = 'floor' | 'wall' | 'surface' | 'rug';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export interface PlacementView {
  pid: number;
  item: string;
  x: number;
  y: number;
  rot: number;
  wall: WallSide | null;
  on: number | null;
  /** Slot to colour, defaults already resolved. Empty for unknown items. */
  colors: Record<string, string>;
  /** Per-item settings: mirror, nudge_x, nudge_y, light_color, light_strength, lit, finish.<slot>. */
  props: Record<string, string>;
  known: boolean;
}

export interface RoomView {
  cells: [number, number][];
  styles: Record<string, string>;
  style_params: Record<string, Record<string, string>>;
  placements: PlacementView[];
  /** Floor cells ("x,y") and wall faces ("x,y,n|e|s|w") that have their own style. */
  floor_paint: Record<string, string>;
  wall_paint: Record<string, string>;
  /** Dividers between cells: canonical cell plus east or south. */
  dividers: [number, number, WallSide][];
  settings: Record<string, string>;
  area_budget: number;
  /** Coins for one more cell of floor, bought while building. */
  cell_price?: number;
  area_used: number;
  /** Set by the shell when one room of the home is shown: every cell of the home, to tell house walls from open garden. */
  home_cells?: [number, number][];
  /** Set by the shell for the village: cells nobody can step on (water). */
  blocked?: [number, number][];
  /** The lie of the land (a place's heights): «x,y» → height in model units (a step is 15). None: flat. */
  terrain?: Record<string, number>;
}

export type Missing =
  | { type: 'coins'; have: number; need: number }
  | { type: 'token'; kind: string; have: number; need: number }
  | { type: 'action'; kind: string; have: number; need: number }
  | { type: 'season'; need: Season }
  | { type: 'item'; item: string }
  | { type: 'help'; help: string }
  | { type: 'hearts'; npc: string; need: number; have: number }
  | { type: 'day'; day: string }
  | { type: 'lease'; home: string }
  | { type: 'flag'; flag: string };

export interface Cost {
  coins: number;
  tokens: Record<string, number>;
}

export type ShopStatus =
  | { state: 'available'; cost: Cost }
  | { state: 'locked'; missing: Missing[] }
  | { state: 'owned' };

export interface ShopEntry {
  id: string;
  kind: 'item' | 'style' | 'expansion' | 'theme';
  category: string;
  status: ShopStatus;
}

export interface InventoryEntry {
  item: string;
  owned: number;
  placed: number;
  free: number;
  known: boolean;
}

export interface WalletView {
  coins: number;
  tokens: Record<string, number>;
  counters: Record<string, number>;
}

export interface WorldView {
  time: number;
  day: number;
  minute_of_day: number;
  season: Season;
  /** Which quarter of its (real, calendar) season it is, 0..3. */
  season_phase: number;
  year: number;
  player_name: string | null;
  world_version: number;
  kits?: string[];
}

export interface Primitive {
  /** [x, y, z, w, d, h] in hundredths of a tile, relative to the footprint origin. */
  box: [number, number, number, number, number, number];
  slot: string;
  /** box (default), cyl, ball, cone or round. */
  shape?: string;
}

export interface SlotDef {
  default: string;
  palette: string;
}

export interface ItemDef {
  id: string;
  name: string;
  category: string;
  /** Carried in the pocket (finds, food, goods). */
  carry?: boolean;
  /** A key or guide: on the keyring, opens places. */
  key?: boolean;
  /** A bag: the room it adds to the pocket. */
  bag?: number;
  /** A garment: the slot it is worn in and the look it gives. */
  wear?: { slot: string; set: [string, string][] };
  /** Armour: where it is worn (head, body, legs, feet) and how much it guards. */
  armor?: { slot: string; defense: number; durability?: number };
  bound?: boolean;
  tags: string[];
  footprint: { w: number; d: number };
  layer: Layer;
  rules: { provides_surface: boolean };
  model: Primitive[];
  slots: Record<string, SlotDef>;
  actions: string[];
  unique?: boolean;
  /** Scenery of the world: never sold or owned. */
  hidden?: boolean;
  /** A worn thing: what the workshop mends it back into. */
  restores?: string;
  acquire: unknown;
}

export interface MaterialDef {
  id: string;
  name: string;
  kind: string;
  params: Record<string, string>;
}

export interface ThemeDef {
  id: string;
  name: string;
  styles: Record<string, string>;
  settings: Record<string, string>;
  acquire: unknown;
}

export interface StyleDef {
  id: string;
  kind: string;
  name: string;
  params: Record<string, string>;
  acquire: unknown;
}

export interface ExpansionDef {
  id: string;
  name: string;
  area: number;
  acquire: unknown;
}

export interface ActionDef {
  id: string;
  name: string;
  minutes: number;
}

export interface Catalog {
  items: Record<string, ItemDef>;
  styles: Record<string, StyleDef>;
  actions: Record<string, ActionDef>;
  expansions: Record<string, ExpansionDef>;
  materials: Record<string, MaterialDef>;
  themes: Record<string, ThemeDef>;
  palettes: Record<string, string[]>;
  start_coins: number;
  packs: Record<string, number>;
  npcs?: Record<string, NpcDef>;
  kits?: Record<string, { id: string; items: string[]; styles: string[] }>;
  collections?: Record<string, { id: string; name: string; items: string[]; reward: string }>;
  sites?: Record<string, SiteDef>;
  site_location?: Record<string, string>;
  residents?: Record<string, ResidentDef>;
  /** The taxi's stands. */
  taxi?: Record<string, { id: string; name: string; location: string; x: number; y: number; fare: number }>;
  /** What mending each worn thing costs at the workshop. */
  restore_prices?: Record<string, number>;
  locations?: Record<string, LocationDef>;
  /** The location the front door opens onto. */
  front?: string | null;
  /** The room of an empty pocket. */
  pocket?: number;
  stations?: Record<string, StationDef>;
  helps?: Record<string, HelpDef>;
  interviews?: { q: string; answers: string[] }[];
  work?: Record<string, { id: string; location: string; prop: string; name: string; boss: string; employer?: string | null; hours: [number, number]; ask: string; options: string[]; start: string; thanks: string }>;
  plants?: Record<string, PlantDef>;
  /** Tools: how long each serves and what is said when it is gone. */
  tools?: Record<string, { item: string; uses: number; gone: string }>;
  builds?: Record<string, { id: string; name: string; kind: string; w: number; d: number; price: number; days: number }>;
  pets?: Record<string, { id: string; name: string; kind: number; source: string; location?: string | null; price: number; food: string[]; text: string }>;
  crafts?: Record<string, { id: string; name: string }>;
  /** How the town grows and wears (crates/teul-core/src/growth.rs). */
  growth?: GrowthDef | null;
}

/** A spot on a map: a building site's builders, a worn building's mender, a stop of the cart. */
export interface GrowthSpot {
  id: string;
  name: string;
  location: string;
  x: number;
  y: number;
}

export interface GrowthDef {
  sites: (GrowthSpot & { kind: string })[];
  abandon: GrowthSpot[];
  wear: (GrowthSpot & { kinds: string[] })[];
  cart?: { location: string; months: number[]; hours: [number, number]; spots: { name: string; x: number; y: number }[] } | null;
}

export interface GrowthNews {
  day: number;
  kind: string;
  id: string;
  text: string;
}

export interface GrowthView {
  sites: (GrowthSpot & { stage: string })[];
  news: GrowthNews[];
  cart: boolean;
}

/** A named place of a map (`door:<site>` for each building's door). */
export interface LandmarkDef {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceDef {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  activity: string;
}

export interface NpcLine {
  text: string;
  hearts?: number;
  when?: string;
  at?: string;
}

export interface NpcDef {
  id: string;
  name: string;
  look: Record<string, string>;
  traits: Record<string, number>;
  home: string;
  likes: string[];
  dislikes: string[];
  lines: NpcLine[];
  gifts: { hearts: number; item: string }[];
  about: string;
  chatter: string[];
  greet: string[];
  asks: AskDef[];
}

export interface ExitDef {
  x: number;
  y: number;
  w: number;
  h: number;
  to: string;
  at: [number, number];
  name: string;
}

/** A thing standing in a place of the map. */
export interface LocationProp {
  item: string;
  x: number;
  y: number;
  rot?: number;
  wall?: WallSide | null;
  colors?: Record<string, string>;
  min_fill?: number;
  min_day?: number;
  /** A crack to the Other Side: shown only on rift days. */
  rift?: boolean;
  /** Shown only while the town has this flag (a stage of building, a shop open…), or not while it has `unflag`. */
  flag?: string;
  unflag?: string;
}

export interface LocationDef {
  id: string;
  name: string;
  /** When a shop or an office lets people in (past midnight when the second is smaller); always when absent. */
  hours?: [number, number];
  /** "weekdays" or "weekends"; every day when absent. */
  days?: string;
  w: number;
  h: number;
  tiles: string[];
  legend: Record<string, string>;
  props: LocationProp[];
  places: PlaceDef[];
  entry?: [number, number] | null;
  exits: ExitDef[];
  spots: SpotDef[];
  fishing: FishingDef[];
  sites?: SiteDef[];
  animals?: AnimalDef[];
  /** A room inside a building: the site whose building it is. */
  inside?: string;
  /** Its wall style. */
  wall?: string;
  /** Where its people stand: the staff first, then the visitors. */
  posts?: [number, number][];
  /** Someone's home one goes into only when invited (to dinner). */
  invite_only?: boolean;
  /** Named places: the square's centre, the main street, the park, each building's door (`door:<site>`)… */
  landmarks?: Record<string, LandmarkDef>;
  /** Under the ground (a cave): no sky, no weather, its own dark. */
  underground?: boolean;
  /** No light here but what one carries in the hands. */
  dark?: boolean;
  /** The lie of the land: per row a character per cell, the height in steps (base 36). */
  heights?: string[];
  /** Overhead wires: x, y and height in hundredths of a tile. */
  wires?: { a: [number, number, number]; b: [number, number, number] }[];
  /** Still water that freezes in a frosty winter: runs of cells (y, x0, x1). */
  ice?: [number, number, number][];
}

export interface AnimalDef {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
  when?: string[];
  swims?: boolean;
  speed?: number | null;
}

export interface SiteDef {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  area?: [number, number, number, number] | null;
  building?: [number, number, number, number] | null;
  /** A few words about the place, for the maps. */
  about?: string;
}

export interface ResidentDef {
  id: string;
  name: string;
  gender: string;
  age: string;
  home: string;
  job?: [string, string] | null;
  look: Record<string, string>;
}

export type Activity = 'sleep' | 'home' | 'work' | 'school' | 'eat' | 'shop' | 'leisure' | 'sick' | 'injured' | 'arrested' | 'firefight' | 'patrol' | 'interview' | 'away';

/** Today in the real year. */
export interface DayView {
  weekday: string;
  /** The weekday by id, the same in every language: monday … sunday. */
  weekday_id: string;
  date: string;
  holiday: string | null;
  day_off: boolean;
  school: boolean;
  festive: boolean;
  holiday_id: string | null;
  /** Tomorrow's holiday (tonight is its eve). */
  tomorrow: string | null;
  /** An equinox or a solstice: the rifts are open. */
  rift: boolean;
  /** The moon is full tonight. */
  full_moon?: boolean;
}

export interface ScheduleItem {
  from: number;
  to: number;
  site: string;
  place: string;
  /** sleep, work, school, coffee, mass, errand, evening */
  what: string;
}

/** A resident's plan for the day, and the same told in a line («Сьогодні: пошта 8:00–17:00, ввечері — дім»). */
export interface ScheduleView {
  id: string;
  day: DayView;
  /** vacation, away, day_off, holiday */
  absence: string | null;
  working_now: boolean;
  items: ScheduleItem[];
  text: string;
}

export interface ResidentView {
  id: string;
  name: string;
  gender: string;
  age: string;
  site: string;
  from: string;
  since: number;
  activity: Activity;
  mood: number;
  /** As they are now: a child grown up into a young one, a parent pushing a new baby's pram. */
  young?: boolean;
  pram?: boolean;
}

export interface TripView {
  kind: 'cart' | 'car' | 'police' | 'ambulance' | 'fire_truck' | 'garbage' | 'taxi' | 'bike' | 'van' | 'grain';
  from: string;
  to: string;
  depart: number;
  arrive: number;
}

export interface LifeView {
  /** How full the dump is, in percent (over 100 it spills over the fence). */
  dump: number;
  residents: ResidentView[];
  sites: { id: string; fire: number; damage: number; stock: number }[];
  trips: TripView[];
  news: { minute: number; kind: string; site: string; text: string }[];
}

export interface GiveDef {
  item: string;
  weight: number;
  seasons?: string[];
  when?: string[];
}

export interface SpotDef {
  id: string;
  x: number;
  y: number;
  gives: GiveDef[];
}

export interface FishingDef {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fish: GiveDef[];
}

export interface AskDef {
  text: string;
  items: [string, number][];
  coins: number;
  gift?: string | null;
  thanks: string;
}

export interface RequestView {
  npc: string;
  name: string;
  text: string;
  items: [string, number][];
  coins: number;
  gift: string | null;
  thanks: string;
  done: boolean;
  ready: boolean;
}

export interface LetterView {
  npc: string;
  name: string;
  index: number;
  text: string;
  gift: string | null;
  opened: boolean;
}

export interface CollectionView {
  id: string;
  name: string;
  items: string[];
  found: string[];
  reward: string;
  done: boolean;
}

export interface StoryView {
  npc: string;
  step: number;
  total: number;
  next: string | null;
  ready: boolean;
  ask: AskDef | null;
  has_items: boolean;
  lines: string[];
}

export interface DailyView {
  day: number;
  requests: RequestView[];
  paper: string[];
  /** Who wrote the morning note (id, name) and what. */
  note: [string, string, string] | null;
  letters: LetterView[];
  collections: CollectionView[];
  collected: string[];
  stories: StoryView[];
  gathered_today: string[];
  catches_left: number;
}

/** Where someone is now and what the player did with them (from the engine). */
export interface NpcView {
  /** The location they are in (`home` while visiting the player) and the one they come from. */
  location: string;
  from_location: string;
  id: string;
  name: string;
  place: string;
  place_name: string;
  activity: string;
  x: number;
  y: number;
  from_place: string;
  from_x: number;
  from_y: number;
  since: number;
  until: number;
  arrives: number;
  visiting: boolean;
  visit: [number, number] | null;
  met: boolean;
  points: number;
  hearts: number;
  talked_today: boolean;
  talks_today: number;
  gift_today: boolean;
  tastes: Record<string, number>;
  received: string[];
}

export type Command =
  | { type: 'acquire'; item: string }
  | { type: 'talk'; npc: string }
  | { type: 'claim_kit'; kit: string }
  | { type: 'gather'; spot: string }
  | { type: 'fish'; place: string }
  | { type: 'deliver'; npc: string }
  | { type: 'claim_letter'; npc: string; letter: number }
  | { type: 'advance_story'; npc: string }
  | { type: 'restore'; item: string }
  | { type: 'take_taxi'; to: string; from: string; x: number; y: number; fare?: number }
  | { type: 'gift'; npc: string; item: string }
  | { type: 'invite'; npc: string; from: number; until: number }
  | { type: 'acquire_style'; style: string }
  | { type: 'place'; item: string; x: number; y: number; rot: number; wall?: WallSide | null; on?: number | null }
  | { type: 'move'; pid: number; x: number; y: number; wall?: WallSide | null; on?: number | null }
  | { type: 'rotate'; pid: number; rot: number }
  | { type: 'recolor'; pid: number; slot: string; color: string }
  | { type: 'store'; pid: number }
  | { type: 'set_style'; kind: string; style: string }
  | { type: 'expand'; expansion: string }
  | { type: 'buy_area'; cells: number }
  | { type: 'perform'; action: string; pid: number | null }
  | { type: 'paint_cells'; add: [number, number][]; remove: [number, number][] }
  | { type: 'set_divider'; x: number; y: number; side: WallSide; on: boolean }
  | { type: 'paint_floor'; cells: [number, number][]; style: string | null }
  | { type: 'paint_wall'; edges: [number, number, WallSide][]; style: string | null }
  | { type: 'set_prop'; pid: number; key: string; value: string }
  | { type: 'set_setting'; key: string; value: string }
  | { type: 'name_player'; name: string }
  | { type: 'acquire_theme'; theme: string }
  | { type: 'apply_theme'; theme: string }
  | { type: 'travel'; to: string }
  | { type: 'stash'; item: string; n: number }
  | { type: 'throw_away'; item: string; n: number }
  | { type: 'sell_to'; station: string; item: string; n: number }
  | { type: 'sell_back'; item: string }
  | { type: 'take'; item: string; n: number }
  | { type: 'use'; station: string }
  | { type: 'help'; help: string }
  | { type: 'interview'; question: number; answer: number }
  | { type: 'to_fridge'; item: string; n: number }
  | { type: 'from_fridge'; item: string; n: number }
  | { type: 'cook'; recipe: string }
  | { type: 'pay_bill'; utility: string; month: number | null }
  | { type: 'pay_all' }
  | { type: 'make_hero'; set: [string, string][] }
  | { type: 'dress'; slot: string; item: string | null }
  | { type: 'haircut'; set: [string, string][] }
  | { type: 'rent'; home: string }
  | { type: 'buy'; home: string }
  | { type: 'move_home'; home: string }
  | { type: 'end_lease'; home: string }
  | { type: 'quest_start'; quest: string }
  | { type: 'quest_step'; quest: string; choice: number | null }
  | { type: 'take_job'; work: string }
  | { type: 'set_hotbar'; slot: number; item: string | null }
  | { type: 'set_offhand'; item: string | null }
  | { type: 'swap_hands'; slot: number }
  | { type: 'wear'; item: string }
  | { type: 'take_off'; slot: string }
  | { type: 'leave_job'; work: string }
  | { type: 'start_shift'; work: string }
  | { type: 'work_step'; choice: number }
  | { type: 'end_shift' }
  | { type: 'plant'; pid: number; seed: string }
  | { type: 'water'; pid: number }
  | { type: 'harvest'; pid: number }
  | { type: 'clear_plot'; pid: number }
  | { type: 'play'; pid: number; piece?: string }
  | { type: 'busk'; piece: string; instrument: string }
  | { type: 'paint'; pid: number; title: string; pixels: string }
  | { type: 'congratulate'; who: string; gift: string | null }
  | { type: 'contribute'; project: string; coins: number; items: [string, number][] }
  | { type: 'dine'; host: string }
  | { type: 'repair'; pid: number }
  | { type: 'call_master'; pid: number }
  | { type: 'craft'; recipe: string }
  | { type: 'tinker'; items: [string, number][] }
  | { type: 'accept_gift'; who: string }
  | { type: 'lesson' }
  | { type: 'theory'; answers: number[] }
  | { type: 'start_exam' }
  | { type: 'end_exam'; faults: string[] }
  | { type: 'buy_car'; car: string }
  | { type: 'refuel' }
  | { type: 'service'; what: string }
  | { type: 'start_drive'; exam: boolean }
  | { type: 'park'; cells: number; x: number; y: number; rot: number }
  | { type: 'violation'; kind: string; cells: number; x: number; y: number }
  | { type: 'pay_fine' }
  | { type: 'pick_coin'; x: number; y: number }
  | { type: 'order_build'; build: string; x: number; y: number }
  | { type: 'finish_build'; n: number }
  | { type: 'adopt'; pet: string }
  | { type: 'pet_care'; pet: string; what: string }
  | { type: 'companion'; pet: string | null };

export interface EventRecord {
  id: { device: number; seq: number };
  time: number;
  rules_version: number;
  kind: { type: string; [field: string]: unknown };
  /** The link to the device's previous event (tamper evidence); absent on old saves. */
  chain?: number;
}

/** What the player carries, what waits in the chest at home, and the keyring. */

export interface PocketView {
  capacity: number;
  used: number;
  items: Record<string, number>;
  chest: Record<string, number>;
  keys: string[];
  bag: string | null;
  /** The nine places at hand (the bar at the bottom). */
  hotbar?: (string | null)[];
  /** The left hand. */
  offhand?: string | null;
  /** Armour worn, by its place. */
  armor?: Record<string, string>;
  defense?: number;
}

export interface Requires {
  items?: string[];
  helped?: string[];
  hearts?: [string, number][];
  hint?: string;
}

export interface StationDef {
  id: string;
  location: string;
  prop: string;
  label: string;
  text: string;
  needs: [string, number][];
  cost: number;
  gives: [string, number][];
  earn: number;
  per_day: number;
  seasons: Season[];
  hours: [number, number] | null;
  requires: Requires | null;
  kind: string;
  /** A buyer of what the pocket holds: a price a piece for an item, a `#tag` or `*` (0: not that). */
  buys?: [string, number][];
  /** What the world says when it has given all it has today. */
  spent?: string;
}

export interface StationView {
  id: string;
  location: string;
  prop: string;
  label: string;
  text: string;
  kind: string;
  needs: [string, number][];
  cost: number;
  gives: [string, number][];
  earn: number;
  per_day: number;
  used_today: number;
  hours: [number, number] | null;
  /** What the world says when it has given all it has today ("Корову вже подоїли зранку"). */
  spent: string;
  ok: boolean;
  /** locked, closed, too_soon, coins, not_enough, pocket_full */
  reason: string | null;
  missing: Missing[];
}

export interface HelpDef {
  id: string;
  giver: string;
  giver_name: string;
  location: string;
  title: string;
  text: string;
  needs: [string, number][];
  after: string[];
  requires: Requires | null;
  coins: number;
  gives: string[];
  thanks: string;
}

export interface HelpView {
  id: string;
  giver: string;
  giver_name: string;
  location: string;
  title: string;
  text: string;
  needs: [string, number][];
  coins: number;
  gives: string[];
  thanks: string;
  done: boolean;
  available: boolean;
  ready: boolean;
  missing: Missing[];
}

/** Where a story's photo is taken (core paper.rs `PhotoHint`). */
export interface PhotoHint {
  /** A location id, or "home". */
  place: string;
  /** The cell the camera looks at. */
  at: [number, number] | null;
  /** Things that should be in the frame (item ids). */
  props: string[];
  /** Residents (ids) standing in the frame. */
  people: string[];
  /** The minute of the day (the light); null: midday. */
  minute: number | null;
  /** A wide shot towards the horizon. */
  far: boolean;
}

export interface PaperStory {
  title: string;
  text: string;
  photo?: PhotoHint | null;
  /** Stable within the day. */
  id?: string;
}

/** A big celebration of the town (core festival.rs): getting ready, the day, the clean-up. */
export interface FestivalView {
  id: string;
  name: string;
  phase: 'prep' | 'day' | 'after';
  days_left: number;
  /** Thousandths of the getting ready done (1000 on the day). */
  ready: number;
}

/** The nuclear plant's story on a day (core npp.rs). */
export interface NppView {
  stage: number;
  id: string;
  name: string;
  since: number;
  /** How far the building has got, thousandths. */
  built: number;
  event: string | null;
}

/** The morning paper of a world day. */
export interface PaperView {
  day: number;
  title: string;
  number: number;
  date: string;
  weather: { today: string; tomorrow: string };
  headline: PaperStory;
  stories: PaperStory[];
  interview: { question: string; answer: string } | null;
  town: string[];
  asks: string[];
  ads: string[];
  /** The year's days coming (today's and the next fortnight's feasts) and the season's requests. */
  events?: string[];
}

/** What thanks bring (never shown before: they come as thanks, not as prizes). */
export interface QuestReward {
  coins: number;
  items: string[];
  recipes: string[];
  title?: string | null;
  rep: number;
  hearts: [string, number][];
}

export interface QuestChoice {
  label: string;
  text: string;
  goto?: number | null;
}

export type StageAct =
  | { do: 'go'; location: string; hours?: [number, number] | null }
  | { do: 'bring'; location: string; items: [string, number][] }
  | { do: 'use'; station: string }
  | { do: 'cook'; recipe: string }
  | { do: 'gather'; location: string; item?: string | null }
  | { do: 'wait'; days: number }
  | { do: 'choose'; location?: string | null; options: QuestChoice[] };

/** A promise one is keeping: what to do now and where. */
export interface QuestView {
  key: string;
  id: string;
  title: string;
  /** story, calendar or job */
  kind: string;
  giver: string;
  giver_name: string;
  stage: number;
  stages: number;
  text: string;
  /** What is said when it is done. */
  done: string;
  act: StageAct;
  who: string | null;
  location: string;
  here: boolean;
  ready: boolean;
  reason: string | null;
  wait_left: number;
  deadline: number | null;
}

/** Someone who would be glad of a hand. */
export interface QuestOffer {
  key: string;
  id: string;
  title: string;
  kind: string;
  giver: string;
  giver_name: string;
  offer: string;
  intro: string;
  stages: string[];
  deadline: number | null;
  can_start: boolean;
  reason: string | null;
  missing: Missing[];
}

export interface QuestDone {
  key: string;
  title: string;
  kind: string;
  giver_name: string;
  day: number;
  bye: string;
}

export interface QuestsView {
  active: QuestView[];
  offers: QuestOffer[];
  done: QuestDone[];
  missed: QuestDone[];
  reputation: number;
  titles: string[];
}

export interface LocationAccess {
  open: boolean;
  missing: Missing[];
  hint: string;
  /** Shut now for its hours or its day. */
  shut?: boolean;
}

/** Where the player is, and which places are open. */
export interface LocationView {
  location: string;
  places: Record<string, LocationAccess>;
}

/** What opening the save found: events left out as forged or edited. */
/** The fridge at home: food kept out of the pocket. */
export interface FridgeView {
  items: Record<string, number>;
  has_fridge: boolean;
  /** False while the electricity is off for an unpaid bill. */
  working: boolean;
  /** What a broken fridge says: nothing new goes in until it is mended. */
  broken?: string;
}

/** A dish one can cook at the stove, with what one has of what it needs. */
export interface RecipeView {
  id: string;
  name: string;
  text: string;
  /** [key, need, have] */
  needs: [string, number, number][];
  gives: [string, number];
  ok: boolean;
  /** not_here, no_stove, gas, not_enough, pocket_full */
  reason: string | null;
}

export interface BillView {
  utility: string;
  name: string;
  month: number;
  period: string;
  due: string;
  amount: number;
  paid: boolean;
  overdue: boolean;
}

/** The monthly bills for garbage, water, electricity and gas, and which of them is switched off. */
/** A job one can take a shift at, and what it remembers of the player. */
export interface WorkView {
  id: string;
  location: string;
  prop: string;
  name: string;
  boss: string;
  hours: [number, number];
  pay: number;
  /** Taken on here. */
  hired: boolean;
  ok: boolean;
  /** not_here, not_hired, closed, done_today, busy */
  reason: string | null;
  shifts: number;
  whole: number;
  tasks: number;
  right: number;
  standing: string;
}

/** The shift going on: the task asked now and how to answer it. */
export interface ShiftView {
  work: string;
  name: string;
  boss: string;
  start: string;
  asks: string;
  who: string;
  line: string;
  options: string[];
  step: number;
  steps: number;
  right: number;
  /** The world minute from which the next task can be done. */
  ready_at: number;
  earned: number;
  over: boolean;
}

/** A plot at home and what grows in it. */
export interface PlotView {
  pid: number;
  item: string;
  indoor: boolean;
  plant: string | null;
  name: string;
  growth: number;
  stage: number;
  stages: number;
  model: string | null;
  ripe: boolean;
  ready: boolean;
  wilting: boolean;
  dead: boolean;
  thirsty: boolean;
  watered_today: boolean;
  words: string;
}

/** How a thing at home has aged (crates/teul-core/src/wear.rs). */
export interface WearView {
  pid: number;
  item: string;
  /** 0 new, 1 used, 2 worn, 3 broken. */
  stage: number;
  looks: string;
  broken: boolean;
  /** What a master asks now. */
  fix: number;
  /** One's own hands can mend it now. */
  by_hand: boolean;
}

export interface CraftView {
  id: string;
  name: string;
  needs: [string, number][];
  gives: [string, number];
  have: number[];
  from: string;
  text: string;
  tools: string[];
  ok: boolean;
}

export interface CraftsView {
  bench: boolean;
  known: CraftView[];
  materials: [string, number][];
}

export interface ToolView {
  item: string;
  words: string;
}

/** Who of the town has a smartphone and a laptop, and what the post office sells (crates/teul-core/src/tech.rs). */
export interface TechView {
  phones_sold: boolean;
  laptops_sold: boolean;
  phones: string[];
  laptops: string[];
  my_phone: boolean;
  my_laptop: boolean;
}

/** A piece of the repertoire (its score is in ui/media/scores.json). */
export interface PieceView {
  id: string;
  name: string;
  by: string;
  level: number;
  learned: boolean;
  known: boolean;
  sheet: string | null;
}

export interface SkillView {
  id: string;
  name: string;
  practice: number;
  level: number;
  word: string;
}

export interface Painting {
  index: number;
  title: string;
  day: number;
  /** 192 hex digits: 16×12 pixels, row by row. */
  pixels: string;
}

export interface PlantDef {
  id: string;
  name: string;
  seed: string;
  tree?: boolean;
  stages: number[];
  models: string[];
  dead_model: string;
  harvest: [string, number];
}

/** A garment the player owns, and whether it is worn now. */
export interface GarmentView {
  item: string;
  slot: 'top' | 'bottom' | 'shoes' | 'acc' | 'hands';
  set: [string, string][];
  worn: boolean;
}

export interface WardrobeView {
  owned: GarmentView[];
  /** The first day's clothes, per slot. */
  first: Record<string, [string, string][]>;
  can_change: boolean;
  /** not_here, no_wardrobe */
  reason: string | null;
  /** Garments for sale right here (at the shop while it is open): [item, price]. */
  for_sale: [string, number][];
  shop_open: boolean;
}

/** The road (crates/teul-core/src/drive.rs): the school, the car, the licence, fines, the cell, money found. */
export interface DriveLesson {
  title: string;
  lines: string[];
}

export interface DriveCarDef {
  id: string;
  name: string;
  item: string;
  price: number;
  text: string;
}

export interface DriveFine {
  kind: string;
  name: string;
  coins: number;
  holes: number;
  seen: number;
  arrest?: boolean;
}

export interface DriveCarView {
  model: string;
  name: string;
  item: string;
  fuel: number;
  at: [string, number, number, number];
  broken: boolean;
  needs: string[];
  words: string[];
  range: number;
  at_sto: boolean;
}

export interface RoadCoin {
  index: number;
  x: number;
  y: number;
  coins: number;
}

export interface DriveView {
  school: string;
  sto: string;
  police: string;
  town: string;
  school_site: string;
  sto_site: string;
  police_site: string;
  school_open: boolean;
  sto_open: boolean;
  lessons_done: number;
  lessons_total: number;
  next_lesson: DriveLesson | null;
  lesson_today: boolean;
  theory: boolean;
  theory_today: boolean;
  questions: { q: string; answers: string[] }[];
  theory_pass: number;
  exam: number | null;
  exam_today: boolean;
  licence: number | null;
  back_in: number | null;
  holes: number;
  coupon: number;
  hole_names: string[];
  fines_due: number;
  car: DriveCarView | null;
  trip: { start: number; licensed: boolean; exam: boolean } | null;
  jailed_until: number | null;
  cars: DriveCarDef[];
  lesson_price: number;
  theory_price: number;
  exam_price: number;
  fuel_price: number;
  oil_price: number;
  tyres_price: number;
  repair_price: number;
  can_item: string;
  can_fuel: number;
  fines: DriveFine[];
  coins: RoadCoin[];
  cellmate: string[];
  tone: string;
}

/** A story of the paper about the player on the road. */
export interface DriverStory {
  headline: string;
  text: string;
  /** Where its photo is taken (a site or a location id). */
  photo: string;
  weight: number;
  section: string;
}

export interface SalonView {
  location: string;
  hours: [number, number];
  open: boolean;
  here: boolean;
  price_style: number;
  price_color: number;
  price_beard: number;
}

export interface HomeView {
  id: string;
  name: string;
  location: string;
  prop: string;
  x: number;
  y: number;
  kind: 'house' | 'flat' | 'cottage' | 'plot';
  rent: number;
  price: number;
  text: string;
  owned: boolean;
  leased: boolean;
  current: boolean;
}

export interface HomesView {
  /** The home id the player lives in. */
  address: string;
  /** The hero is made: clothes and hair are changed in town, not in the studio. */
  fixed: boolean;
  homes: HomeView[];
}

export interface BillsView {
  bills: BillView[];
  utilities: { id: string; name: string; on: boolean }[];
  total_due: number;
  office: string;
  office_name: string;
  hours: [number, number];
  can_pay: boolean;
}

export interface Integrity {
  tampered: number;
  dropped: { device: number; seq: number }[];
  legacy: number;
  inputs: number;
  /** Events of what the game no longer has (the network world of 1.0), passed over. */
  retired: number;
  from_snapshot: boolean;
}

export interface EngineError {
  kind: string;
  message: string;
  missing?: Missing[];
  reason?: string;
  [extra: string]: unknown;
}

export type CommandResult = { ok: true; events: EventRecord[] } | { ok: false; error: EngineError };
export type CheckResult = { ok: true } | { ok: false; error: EngineError };

/** A real date of the world and what kind of day it is (from the core's calendar). */
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
  info: {
    weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
    weekend: boolean;
    holiday: { id: string; name: string; day_off: boolean; festive: boolean } | null;
    day_off: boolean;
    school: boolean;
  };
}

// ---- a town that lives on (crates/teul-core/src/town.rs) ---------------------------------------------------------

export interface PersonRef {
  id: string;
  name: string;
  gender: string;
}

export interface TownToday {
  birthdays: PersonRef[];
  storm: boolean;
  storm_hours: [number, number] | null;
  outage: boolean;
  wedding: [PersonRef, PersonRef] | null;
  fair: boolean;
  musician: boolean;
  tourist: boolean;
  funeral: PersonRef | null;
}

export interface ProjectView {
  id: string;
  name: string;
  text: string;
  location: string;
  coins_need: number;
  coins_have: number;
  /** [item, needed, there] */
  items: [string, number, number][];
  mine: number;
  status: 'soon' | 'open' | 'building' | 'done';
  stage_index: number;
  stage: string | null;
  stages: string[];
  done_day: number | null;
  done: string;
}

export interface InvitationView {
  host: string;
  name: string;
  day: number;
  from: number;
  to: number;
  active: boolean;
  done: boolean;
}

export interface TownView {
  flags: string[];
  today: TownToday;
  projects: ProjectView[];
  openings: { id: string; name: string; text: string; open: boolean }[];
  invitations: InvitationView[];
  visitor: { id: string; name: string; from: number; to: number } | null;
  bonds: { id: string; name: string; points: number; memories: string[]; line: string | null }[];
  changes: { day: number; kind: string; who: string[]; text: string }[];
}

// ---- the sky (sky.rs) ------------------------------------------------------------------------------------------

export interface SkyView {
  rift_world: string | null;
  eclipse: { start: number; peak: number; end: number; cover: number; now: number } | null;
  meteors: { id: string; name: string; rate: number; dark: boolean; clear: boolean } | null;
  comet: { name: string; day: number; days: number; bright: number } | null;
  aliens: { phase: number; lights: number; beam: number; gone: number } | null;
  crop_circle: boolean;
  cow_missing: boolean;
  cow_back: boolean;
}

export interface SkyStory {
  id: string;
  date: number;
  weight: number;
  headline: string;
  text: string;
  photo: { place: string; minute: number; subject: string };
}

/** Rooms the builders build on (crates/teul-core/src/builds.rs). */
export interface BuildOffer {
  id: string;
  name: string;
  kind: string;
  w: number;
  d: number;
  price: number;
  days: number;
  text: string;
}

export interface BuildOrderView {
  n: number;
  build: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  d: number;
  day: number;
  ready: number;
  due: boolean;
  done: boolean;
  words: string;
  /** 0 dug, 1 walls, 2 roof, 3 done. */
  stage: number;
  floor: string | null;
  wall: string | null;
  plan: string | null;
  items: string[];
}

export interface BuildsView {
  here: boolean;
  owner: boolean;
  offers: BuildOffer[];
  orders: BuildOrderView[];
}

/** The animals one lives with (crates/teul-core/src/pets.rs). */
export interface PetView {
  id: string;
  name: string;
  kind: number;
  since: number;
  hungry: boolean;
  lonely: boolean;
  happy: boolean;
  worn: boolean;
  words: string;
  eats: boolean;
}

export interface PetOffer {
  id: string;
  name: string;
  kind: number;
  price: number;
  text: string;
  /** adopt, feed_fox, nest_egg, hatch; or owned, wait, later. */
  step: string;
}

export interface PetsView {
  owned: PetView[];
  companion: string | null;
  egg: [number, number] | null;
  fox: string;
  here: PetOffer[];
}

