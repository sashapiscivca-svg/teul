//! What happens in the sky over the town, and what comes down from it: the worlds the rifts open into on the
//! equinoxes and the solstices, solar eclipses on their real dates, meteor showers on their real peaks, comets
//! (a few a decade, drawn from the world's seed) and, very rarely, visitors who take a cow. Integer arithmetic
//! only: every answer is a pure function of the seed, the calendar and the time, the same on every device.

use serde::Serialize;

use crate::content::Lang;
use crate::daily::{weather_at, Sky};
use crate::holidays::rift_of;
use crate::rng::{rand_below, Domain};
use crate::time::{civil_from_days, days_from_civil, Calendar, WorldTime, MINUTES_PER_DAY};

const COMET: Domain = Domain(901);
const ALIENS: Domain = Domain(902);

/// The worlds behind the rifts, by the equinox or solstice (spring, summer, autumn, winter). The winter one is
/// the town itself, seen from the other side.
pub const RIFT_WORLDS: [&str; 4] = ["rift_spring", "rift_summer", "rift_autumn", "rift_winter"];

/// The world the rifts open into on a day (a day number since 1970-01-01), if they are open.
pub fn rift_world(date: i64) -> Option<&'static str> {
    rift_of(date).map(|k| RIFT_WORLDS[k])
}

// ---- eclipses ---------------------------------------------------------------------------------------------------

/// Solar eclipses seen (at least in part) from the middle of Europe, 2020–2060: (year, month, day, the local
/// minute of the greatest phase, how much of the sun the moon covers there in percent). Rounded for the region.
const ECLIPSES: &[(i64, u32, u32, u32, u8)] = &[
    (2021, 6, 10, 13 * 60 + 20, 9),
    (2022, 10, 25, 13 * 60 + 50, 38),
    (2025, 3, 29, 13 * 60 + 10, 6),
    (2026, 8, 12, 20 * 60 + 5, 14),
    (2027, 8, 2, 13 * 60 + 20, 30),
    (2030, 6, 1, 9 * 60 + 30, 78),
    (2039, 6, 21, 20 * 60, 44),
    (2048, 6, 11, 15 * 60, 58),
    (2053, 9, 12, 12 * 60 + 10, 24),
];

/// How long before and after the greatest phase the moon is on the sun, in minutes.
pub const ECLIPSE_HALF: u32 = 80;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct EclipseView {
    /// Minutes of the day: the first contact, the greatest phase, the last contact.
    pub start: u32,
    pub peak: u32,
    pub end: u32,
    /// How much of the sun is covered at the greatest phase (percent).
    pub cover: u8,
    /// How much of the sun is covered now (percent; 0 outside the eclipse).
    pub now: u8,
}

fn eclipse_on(date: i64) -> Option<(u32, u8)> {
    let (y, m, d) = civil_from_days(date);
    ECLIPSES.iter().find(|e| e.0 == y && e.1 == m && e.2 == d).map(|e| (e.3, e.4))
}

fn eclipse_view(date: i64, minute: u32) -> Option<EclipseView> {
    let (peak, cover) = eclipse_on(date)?;
    let start = peak.saturating_sub(ECLIPSE_HALF);
    let end = (peak + ECLIPSE_HALF).min(MINUTES_PER_DAY as u32 - 1);
    let now = if minute < start || minute > end {
        0
    } else {
        let off = minute.abs_diff(peak);
        (u32::from(cover) * (ECLIPSE_HALF - off.min(ECLIPSE_HALF)) / ECLIPSE_HALF) as u8
    };
    Some(EclipseView { start, peak, end, cover, now })
}

// ---- meteor showers ---------------------------------------------------------------------------------------------

/// The showers by the evening of their peak night: (month, day, id, name, how rich 1..=3).
const SHOWERS: &[(u32, u32, &str, &str, u8)] = &[
    (1, 3, "quadrantids", "Квадрантиди", 2),
    (4, 22, "lyrids", "Ліриди", 1),
    (8, 12, "perseids", "Персеїди", 3),
    (10, 21, "orionids", "Оріоніди", 1),
    (11, 17, "leonids", "Леоніди", 1),
    (12, 14, "geminids", "Гемініди", 3),
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct MeteorView {
    pub id: String,
    pub name: String,
    /// How many to see: 1 a few, 3 a downpour of stars (the night before and after, one less).
    pub rate: u8,
    /// The night is dark now (21:00 to 05:00).
    pub dark: bool,
    /// The sky is clear enough to see them (clouds, rain, snow and fog hide them).
    pub clear: bool,
}

fn shower_name_en(id: &str) -> &'static str {
    match id {
        "quadrantids" => "the Quadrantids",
        "lyrids" => "the Lyrids",
        "perseids" => "the Perseids",
        "orionids" => "the Orionids",
        "leonids" => "the Leonids",
        _ => "the Geminids",
    }
}

const DISCOVERERS_EN: [&str; 14] = ["Hayakawa", "Okafor", "Novak", "Reyes", "Lindqvist", "Mendes", "Koval", "Tanaka", "O'Brien", "Schmidt", "Ferreira", "Ahmadi", "Berger", "Liu"];

/// A meteor shower in the given language: (id, name, how rich).
fn shower_in(evening: i64, l: Lang) -> Option<(&'static str, &'static str, u8)> {
    shower_of(evening).map(|(id, name, rate)| (id, if l.en() { shower_name_en(id) } else { name }, rate))
}

fn shower_of(evening: i64) -> Option<(&'static str, &'static str, u8)> {
    let (y, _, _) = civil_from_days(evening);
    for (m, d, id, name, rate) in SHOWERS {
        let peak = days_from_civil(y, *m, *d);
        if evening == peak {
            return Some((id, name, *rate));
        }
        if (evening - peak).abs() == 1 && *rate > 1 {
            return Some((id, name, rate - 1));
        }
    }
    None
}

// ---- comets -----------------------------------------------------------------------------------------------------

const DISCOVERERS: [&str; 14] = ["Хаякава", "Окафор", "Новак", "Рейес", "Ліндквіст", "Мендес", "Коваль", "Танака", "О'Браєн", "Шмідт", "Феррейра", "Ахмаді", "Бергер", "Ліу"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct CometView {
    pub name: String,
    /// Its day in the sky (0 the first) and how many days it stays.
    pub day: u32,
    pub days: u32,
    /// How bright it is tonight (0..=100): it grows to the middle of its stay, then fades.
    pub bright: u8,
}

/// A year's comet, if the year has one: (the first day, how many days, the name). About three a decade.
fn comet_of_year(seed: u64, year: i64, l: Lang) -> Option<(i64, u32, String)> {
    let y = year as u64;
    if rand_below(seed, COMET, y, 0, 100) >= 30 {
        return None;
    }
    let first = days_from_civil(year, 1, 1) + rand_below(seed, COMET, y, 1, 330) as i64;
    let days = 12 + rand_below(seed, COMET, y, 2, 10) as u32;
    let a = rand_below(seed, COMET, y, 3, DISCOVERERS.len() as u64) as usize;
    let b = (a + 1 + rand_below(seed, COMET, y, 4, DISCOVERERS.len() as u64 - 1) as usize) % DISCOVERERS.len();
    Some((first, days, if l.en() { format!("Comet {}–{}", DISCOVERERS_EN[a], DISCOVERERS_EN[b]) } else { format!("Комета {}–{}", DISCOVERERS[a], DISCOVERERS[b]) }))
}

fn comet_on(seed: u64, date: i64, l: Lang) -> Option<CometView> {
    let (y, _, _) = civil_from_days(date);
    for year in [y - 1, y] {
        if let Some((first, days, name)) = comet_of_year(seed, year, l) {
            if date >= first && date < first + i64::from(days) {
                let day = (date - first) as u32;
                let half = days / 2;
                let bright = (100 - (day.abs_diff(half) * 100 / (half + 1)).min(100)).max(20) as u8;
                return Some(CometView { name, day, days, bright });
            }
        }
    }
    None
}

// ---- the visitors ---------------------------------------------------------------------------------------------

/// The minutes of the visitors' night (on the calendar day the small hours belong to): lights over the farm, the
/// beam, and nothing.
pub const ALIEN_LIGHTS: u32 = 70;
pub const ALIEN_BEAM: u32 = 110;
pub const ALIEN_GONE: u32 = 160;
/// The cow comes back on its own a week later, in the morning, with a bell nobody has seen before.
pub const COW_AWAY_DAYS: i64 = 7;
pub const CIRCLE_DAYS: i64 = 10;

/// The day (whose small hours) the visitors come in a year, if they come that year (about one year in four),
/// between June and the middle of October, when the cows sleep out.
fn aliens_of_year(seed: u64, year: i64) -> Option<i64> {
    let y = year as u64;
    if rand_below(seed, ALIENS, y, 0, 100) >= 25 {
        return None;
    }
    Some(days_from_civil(year, 6, 1) + rand_below(seed, ALIENS, y, 1, 137) as i64)
}

/// The most recent visitors' night up to `date` (inclusive), searching back a year and a bit.
fn aliens_before(seed: u64, date: i64) -> Option<i64> {
    let (y, _, _) = civil_from_days(date);
    [y, y - 1].into_iter().filter_map(|yr| aliens_of_year(seed, yr)).filter(|a| *a <= date).max()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AlienView {
    /// 1 lights over the farm, 2 the beam (the cow goes up), 3 gone.
    pub phase: u8,
    pub lights: u32,
    pub beam: u32,
    pub gone: u32,
}

// ---- the view -----------------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SkyView {
    /// The world the rifts open into today, if they are open.
    pub rift_world: Option<String>,
    pub eclipse: Option<EclipseView>,
    /// Tonight's meteor shower (the night belongs to its evening: before 05:00 it is still last night).
    pub meteors: Option<MeteorView>,
    pub comet: Option<CometView>,
    /// The visitors are over the farm tonight.
    pub aliens: Option<AlienView>,
    /// A circle pressed into the wheat of the field (some days after the visitors).
    pub crop_circle: bool,
    /// One of the farm's cows is gone (taken; back in a week).
    pub cow_missing: bool,
    /// The cow came back this morning.
    pub cow_back: bool,
}

const DUSK: u32 = 21 * 60;
const DAWN: u32 = 5 * 60;

pub fn sky_view(seed: u64, cal: Calendar, now: WorldTime) -> SkyView {
    sky_view_in(seed, cal, now, Lang::Uk)
}

/// `sky_view` with its names in the given language (only text).
pub fn sky_view_in(seed: u64, cal: Calendar, now: WorldTime, l: Lang) -> SkyView {
    let date = cal.date(now);
    let minute = now.minute_of_day() as u32;
    let dark = !(DAWN..DUSK).contains(&minute);
    let evening = if minute < DAWN { date - 1 } else { date };
    let meteors = shower_in(evening, l).map(|(id, name, rate)| {
        let clear = matches!(weather_at(seed, now, cal.season(now)), Sky::Clear);
        MeteorView { id: id.to_string(), name: name.to_string(), rate, dark, clear }
    });
    let aliens_day = aliens_before(seed, date);
    let aliens = aliens_day.filter(|a| *a == date && (ALIEN_LIGHTS..ALIEN_GONE).contains(&minute)).map(|_| AlienView {
        phase: if minute < ALIEN_BEAM { 1 } else if minute < ALIEN_BEAM + 30 { 2 } else { 3 },
        lights: ALIEN_LIGHTS,
        beam: ALIEN_BEAM,
        gone: ALIEN_GONE,
    });
    let taken = |a: i64| (a < date || minute >= ALIEN_BEAM + 20) && a <= date;
    let cow_missing = aliens_day.is_some_and(|a| taken(a) && (date < a + COW_AWAY_DAYS || (date == a + COW_AWAY_DAYS && minute < 6 * 60)));
    let cow_back = aliens_day.is_some_and(|a| date == a + COW_AWAY_DAYS && minute >= 6 * 60);
    let crop_circle = aliens_day.is_some_and(|a| taken(a) && date < a + CIRCLE_DAYS);
    SkyView {
        rift_world: rift_world(date).map(str::to_string),
        eclipse: eclipse_view(date, minute),
        meteors,
        comet: comet_on(seed, date, l),
        aliens,
        crop_circle,
        cow_missing,
        cow_back,
    }
}

/// The next date from `from` (inclusive, within `days`) on which a sky event of `kind` happens:
/// "eclipse", "meteors", "comet", "aliens", "rift_spring" … "rift_winter".
pub fn next_date(seed: u64, kind: &str, from: i64, days: i64) -> Option<i64> {
    (from..from + days).find(|d| match kind {
        "eclipse" => eclipse_on(*d).is_some(),
        "meteors" => shower_of(*d).is_some_and(|s| s.2 >= 2),
        "comet" => comet_on(seed, *d, Lang::Uk).is_some(),
        "aliens" => aliens_before(seed, *d) == Some(*d),
        w => rift_world(*d) == Some(w),
    })
}

// ---- for the paper ----------------------------------------------------------------------------------------------

/// What a story's photograph should show: the place (a location id, or a named place of the town map), the minute
/// of the day the picture was taken, and what is in it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct PhotoHint {
    pub place: String,
    pub minute: u32,
    pub subject: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SkyStory {
    pub id: String,
    /// The day (since 1970-01-01) the story is in the paper of.
    pub date: i64,
    /// How much it weighs against the other news (the paper's 1..=9, and the visitors a 10).
    pub weight: u32,
    pub headline: String,
    pub text: String,
    pub photo: PhotoHint,
}

fn hhmm(m: u32) -> String {
    format!("{}:{:02}", m / 60, m % 60)
}

fn photo(place: &str, minute: u32, subject: &str) -> PhotoHint {
    PhotoHint { place: place.to_string(), minute, subject: subject.to_string() }
}

/// The sky's stories for the paper of a day (a day number since 1970-01-01): short, a headline and a line.
pub fn stories(seed: u64, date: i64) -> Vec<SkyStory> {
    stories_in(seed, date, Lang::Uk)
}

/// `stories` in the given language (the same stories, only their words differ).
pub fn stories_in(seed: u64, date: i64, l: Lang) -> Vec<SkyStory> {
    if l.en() {
        return stories_en(seed, date);
    }
    let mut out = Vec::new();
    let mut add = |id: &str, weight: u32, headline: String, text: String, photo: PhotoHint| {
        out.push(SkyStory { id: format!("sky.{id}.{date}"), date, weight, headline, text, photo });
    };
    if let Some(w) = rift_world(date) {
        let (head, text) = match w {
            "rift_spring" => ("Тріщини знову відкрилися", "Рівнодення. За тріщинами — затоплена оранжерея, де квіти вищі за дерева. Опівночі все зачиниться."),
            "rift_summer" => ("Найдовший день — і тріщини", "За тріщинами сьогодні біла соляна пустеля і місто, якого немає. Беріть воду."),
            "rift_autumn" => ("Рівнодення: світло бурштину", "За тріщинами — годинниковий сад, де з дерев падають сторінки. До півночі."),
            _ => ("Найдовша ніч", "Сонцестояння. Хто ступав у тріщину, каже: там те саме Липове. Тільки живуть у ньому не люди."),
        };
        add("rift", 7, head.to_string(), text.to_string(), photo("square", 12 * 60, "rift_crack"));
    }
    if let Some((peak, cover)) = eclipse_on(date) {
        add("eclipse", 8, format!("Сьогодні о {} — сонячне затемнення", hhmm(peak)), format!("Місяць закриє близько {cover}% сонця. Не дивіться без захисних окулярів."), photo("square", peak, "eclipse"));
    }
    if let Some((peak, _)) = eclipse_on(date + 1) {
        add("eclipse_soon", 6, "Завтра затемнення".to_string(), format!("Найбільша фаза о {}. Окуляри — в аптеці та на пошті.", hhmm(peak)), photo("square", 12 * 60, "eclipse_glasses"));
    }
    if let Some((_, cover)) = eclipse_on(date - 1) {
        add("eclipse_after", 5, "Площа дивилася вгору".to_string(), format!("Учора сонце стало серпиком на {cover}%. Птахи замовкли, а потім усі заплескали."), photo("square", 14 * 60, "crowd_up"));
    }
    if let Some((_, name, rate)) = shower_of(date).filter(|s| s.2 >= 2) {
        let line = if rate >= 3 { "Пік уночі: десятки зірок на годину. Найкраще видно з Зоряного пагорба." } else { "Уночі — зорепад. Вдягніться тепло й вимкніть ліхтарик." };
        add("meteors", 5, format!("Сьогодні вночі — {name}"), line.to_string(), photo("hill", 23 * 60, "meteors"));
    }
    if let Some((_, name, _)) = shower_of(date - 1).filter(|s| s.2 >= 3) {
        add("meteors_after", 4, "Ніч, коли ніхто не спав".to_string(), format!("{name}: на пагорбі лежали на ковдрах до світанку й загадували бажання."), photo("hill", 1 * 60, "blankets"));
    }
    if let Some(c) = comet_on(seed, date, Lang::Uk) {
        if c.day == 0 {
            add("comet", 6, format!("{} — у нашому небі", c.name), format!("Хвіст видно після заходу сонця на заході. Пробуде близько {} днів.", c.days), photo("hill", 22 * 60, "comet"));
        } else if c.day == c.days / 2 {
            add("comet_peak", 5, "Комета найяскравіша".to_string(), format!("{} сьогодні видно навіть із площі.", c.name), photo("square", 22 * 60, "comet"));
        }
    }
    if let Some(a) = aliens_before(seed, date) {
        if a == date {
            add("aliens", 10, "Світло над фермою. Корова зникла".to_string(), "Уночі над пасовищем висіли вогні. Зранку однієї корови не було. Фермер не жартує.".to_string(), photo("farm", 8 * 60, "empty_stall"));
        } else if date == a + 1 {
            add("circle", 7, "Коло в пшениці".to_string(), "На полі за ніч з'явилося рівне коло. Пшениця не зламана — покладена.".to_string(), photo("fields", 10 * 60, "crop_circle"));
        } else if date == a + COW_AWAY_DAYS {
            add("cow_back", 8, "Корова повернулася сама".to_string(), "Зранку стояла біля воріт ферми. На шиї — дзвіник, якого ніхто не бачив.".to_string(), photo("farm", 7 * 60, "cow_bell"));
        }
    }
    out
}

fn stories_en(seed: u64, date: i64) -> Vec<SkyStory> {
    let l = Lang::En;
    let mut out = Vec::new();
    let mut add = |id: &str, weight: u32, headline: String, text: String, photo: PhotoHint| {
        out.push(SkyStory { id: format!("sky.{id}.{date}"), date, weight, headline, text, photo });
    };
    if let Some(w) = rift_world(date) {
        let (head, text) = match w {
            "rift_spring" => ("The cracks have opened again", "The equinox. Beyond the cracks lies a flooded greenhouse where the flowers are taller than trees. Everything closes at midnight."),
            "rift_summer" => ("The longest day — and the cracks", "Beyond the cracks today: a white salt desert and a town that isn't there. Take water."),
            "rift_autumn" => ("Equinox: amber light", "Beyond the cracks — a clockwork garden where pages fall from the trees. Until midnight."),
            _ => ("The longest night", "The solstice. Those who have stepped into a crack say it's the same Lypove there. Only it isn't people who live in it."),
        };
        add("rift", 7, head.to_string(), text.to_string(), photo("square", 12 * 60, "rift_crack"));
    }
    if let Some((peak, cover)) = eclipse_on(date) {
        add("eclipse", 8, format!("A solar eclipse today at {}", hhmm(peak)), format!("The moon will cover about {cover}% of the sun. Don't look without protective glasses."), photo("square", peak, "eclipse"));
    }
    if let Some((peak, _)) = eclipse_on(date + 1) {
        add("eclipse_soon", 6, "An eclipse tomorrow".to_string(), format!("The greatest phase is at {}. Glasses are at the pharmacy and the post office.", hhmm(peak)), photo("square", 12 * 60, "eclipse_glasses"));
    }
    if let Some((_, cover)) = eclipse_on(date - 1) {
        add("eclipse_after", 5, "The square looked up".to_string(), format!("Yesterday the sun became a {cover}% crescent. The birds fell silent, and then everyone clapped."), photo("square", 14 * 60, "crowd_up"));
    }
    if let Some((_, name, rate)) = shower_in(date, l).filter(|s| s.2 >= 2) {
        let line = if rate >= 3 { "The peak is tonight: dozens of shooting stars an hour. Best seen from Starry Hill." } else { "Shooting stars tonight. Dress warmly and switch off your torch." };
        add("meteors", 5, format!("Tonight — {name}"), line.to_string(), photo("hill", 23 * 60, "meteors"));
    }
    if let Some((_, name, _)) = shower_in(date - 1, l).filter(|s| s.2 >= 3) {
        let name = name.strip_prefix("the ").unwrap_or(name);
        add("meteors_after", 4, "The night nobody slept".to_string(), format!("The {name}: people lay on blankets on the hill until dawn, making wishes."), photo("hill", 60, "blankets"));
    }
    if let Some(c) = comet_on(seed, date, l) {
        if c.day == 0 {
            add("comet", 6, format!("{} is in our sky", c.name), format!("Its tail can be seen in the west after sunset. It will stay for about {} days.", c.days), photo("hill", 22 * 60, "comet"));
        } else if c.day == c.days / 2 {
            add("comet_peak", 5, "The comet at its brightest".to_string(), format!("{} can be seen even from the square tonight.", c.name), photo("square", 22 * 60, "comet"));
        }
    }
    if let Some(a) = aliens_before(seed, date) {
        if a == date {
            add("aliens", 10, "Lights over the farm. A cow is missing".to_string(), "Last night lights hung over the pasture. By morning one cow was gone. The farmer isn't joking.".to_string(), photo("farm", 8 * 60, "empty_stall"));
        } else if date == a + 1 {
            add("circle", 7, "A circle in the wheat".to_string(), "A perfect circle appeared in the field overnight. The wheat isn't broken — it's laid flat.".to_string(), photo("fields", 10 * 60, "crop_circle"));
        } else if date == a + COW_AWAY_DAYS {
            add("cow_back", 8, "The cow came back on her own".to_string(), "This morning she was standing by the farm gate. Round her neck — a bell nobody had ever seen.".to_string(), photo("farm", 7 * 60, "cow_bell"));
        }
    }
    out
}
