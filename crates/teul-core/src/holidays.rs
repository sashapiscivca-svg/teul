//! The real year the town lives by: weekdays, holidays (state ones and the town's feasts, with Easter and Trinity
//! computed every year), days off and the school calendar. Integer arithmetic only, the same everywhere.
//! A day is counted from 1970-01-01 (see `time::civil_from_days`).

use crate::time::{civil_from_days, days_from_civil};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize)]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct Holiday {
    pub id: &'static str,
    pub name: &'static str,
    /// Shops and offices rest (the state holidays and the great feasts).
    pub day_off: bool,
    /// The town celebrates: decorations, people out, a fair or a service.
    pub festive: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
pub struct DayInfo {
    pub weekday: Weekday,
    pub weekend: bool,
    pub holiday: Option<Holiday>,
    /// Shops, offices and schools rest: a weekend or a day-off holiday.
    pub day_off: bool,
    /// Children go to school.
    pub school: bool,
    /// An equinox or a solstice: the rifts are open.
    pub rift: bool,
    /// The moon is full tonight (the forest's circle gathers).
    pub full_moon: bool,
}

const fn h(id: &'static str, name: &'static str, day_off: bool, festive: bool) -> Holiday {
    Holiday { id, name, day_off, festive }
}

impl Holiday {
    /// The same holiday with its name in the given language (only text).
    pub fn in_lang(self, l: crate::content::Lang) -> Holiday {
        Holiday { name: name_in(self.id, l), ..self }
    }
}

impl DayInfo {
    /// The same day with the holiday's name in the given language (only text).
    pub fn in_lang(self, l: crate::content::Lang) -> DayInfo {
        DayInfo { holiday: self.holiday.map(|h| h.in_lang(l)), ..self }
    }
}

/// Fixed-date days of the year: (month, day, holiday). `festive` marks the town's own celebrations — secular days
/// everyone enjoys, with a build-up, the day itself and a clean-up (see festival.rs). The church's feasts and the
/// state's days are kept as quiet facts of the calendar: a service for those who go, a day off, a flag.
const FIXED: &[(u32, u32, Holiday)] = &[
    (1, 1, h("new_year", "Новий рік", true, true)),
    (1, 6, h("epiphany", "Водохреще", false, false)),
    (2, 14, h("valentine", "День закоханих", false, true)),
    (3, 8, h("womens_day", "Міжнародний жіночий день", false, true)),
    (4, 1, h("april_fools", "День сміху", false, true)),
    (4, 22, h("earth_day", "День Землі", false, true)),
    (5, 1, h("labour_day", "Першотравень", true, false)),
    (5, 8, h("remembrance", "День пам'яті та перемоги", true, false)),
    (6, 1, h("childrens_day", "День захисту дітей", false, true)),
    (6, 24, h("kupala", "Ніч середини літа", false, true)),
    (6, 28, h("constitution", "День Конституції", true, false)),
    (7, 15, h("statehood", "День Державності", true, false)),
    (8, 1, h("honey_spas", "Медовий Спас", false, false)),
    (8, 6, h("apple_spas", "Яблучний Спас", false, false)),
    (8, 24, h("independence", "День Незалежності", true, false)),
    (9, 1, h("knowledge_day", "Перше вересня", false, true)),
    (10, 1, h("defenders", "День захисників і захисниць", true, false)),
    (10, 31, h("halloween", "Гелловін", false, true)),
    (11, 11, h("lantern_night", "Ніч ліхтариків", false, true)),
    (11, 30, h("st_andrew_eve", "Андріївські вечорниці", false, false)),
    (12, 6, h("st_nicholas", "День святого Миколая", false, false)),
    (12, 24, h("christmas_eve", "Святвечір", false, false)),
    (12, 25, h("christmas", "Різдво", true, false)),
    (12, 31, h("new_year_eve", "Новорічна ніч", false, true)),
];

/// The Lunar New Year (Beijing time): (year, month, day), 2020–2060 (scripts/gen_lunar_new_year.py).
const LUNAR_NEW_YEAR: &[(i64, u32, u32)] = &[
    (2020, 1, 25), (2021, 2, 12), (2022, 2, 1), (2023, 1, 22), (2024, 2, 10), (2025, 1, 29),
    (2026, 2, 17), (2027, 2, 6), (2028, 1, 26), (2029, 2, 13), (2030, 2, 3), (2031, 1, 23),
    (2032, 2, 11), (2033, 1, 31), (2034, 2, 19), (2035, 2, 8), (2036, 1, 28), (2037, 2, 15),
    (2038, 2, 4), (2039, 1, 24), (2040, 2, 12), (2041, 2, 1), (2042, 1, 22), (2043, 2, 10),
    (2044, 1, 30), (2045, 2, 17), (2046, 2, 6), (2047, 1, 26), (2048, 2, 14), (2049, 2, 2),
    (2050, 1, 23), (2051, 2, 11), (2052, 2, 1), (2053, 2, 19), (2054, 2, 8), (2055, 1, 28),
    (2056, 2, 15), (2057, 2, 4), (2058, 1, 24), (2059, 2, 12), (2060, 2, 2),
];

/// The day of the Lunar New Year in a year (from the table; outside it, the second new moon is not computed and
/// 1 February is taken).
pub fn lunar_new_year(year: i64) -> i64 {
    LUNAR_NEW_YEAR.iter().find(|(y, ..)| *y == year).map(|(y, m, d)| days_from_civil(*y, *m, *d)).unwrap_or_else(|| days_from_civil(year, 2, 1))
}

/// The town's celebrations that keep a weekday rather than a date: (id, name, month, weekday, which one of the
/// month; 0 the last). The spring carnival seeing winter off (the last Saturday of March), Mother's Day and the
/// flower festival in May, the school's last bell, the town's own day when the lindens on the square bloom (the
/// second Saturday of July), the end of summer with a film on the square, the harvest fair, and the winter lights.
const NTH: &[(&str, &str, u32, Weekday, u32)] = &[
    ("spring_carnival", "Весняний карнавал", 3, Weekday::Sat, 0),
    ("mothers_day", "День матері", 5, Weekday::Sun, 2),
    ("flower_festival", "Фестиваль квітів", 5, Weekday::Sat, 3),
    ("last_bell", "Останній дзвоник", 5, Weekday::Fri, 0),
    ("town_day", "День Липового", 7, Weekday::Sat, 2),
    ("summer_end", "Прощавай, літо", 8, Weekday::Sat, 0),
    ("harvest_fair", "Ярмарок урожаю", 9, Weekday::Sat, 3),
    ("winter_lights", "Фестиваль зимових вогнів", 12, Weekday::Sat, 2),
];

/// The `n`-th (from 1; 0 for the last) given weekday of a month, as a day number.
fn nth_weekday(year: i64, month: u32, wd: Weekday, n: u32) -> i64 {
    if n == 0 {
        let next = if month == 12 { days_from_civil(year + 1, 1, 1) } else { days_from_civil(year, month + 1, 1) };
        let last = next - 1;
        return last - (weekday(last) as i64 - wd as i64).rem_euclid(7);
    }
    let first = days_from_civil(year, month, 1);
    let shift = (wd as i64 - weekday(first) as i64).rem_euclid(7);
    first + shift + 7 * (i64::from(n) - 1)
}

/// The days of the equinoxes and the solstices in Kyiv time, 2020–2060 (scripts/gen_solstices.py, Meeus ch. 27):
/// (year, [the March, June, September and December day]). Outside these years the usual days are taken.
const RIFTS: &[(i64, [u32; 4])] = &[
    (2020, [20, 21, 22, 21]),
    (2021, [20, 21, 22, 21]),
    (2022, [20, 21, 23, 21]),
    (2023, [20, 21, 23, 22]),
    (2024, [20, 20, 22, 21]),
    (2025, [20, 21, 22, 21]),
    (2026, [20, 21, 23, 21]),
    (2027, [20, 21, 23, 22]),
    (2028, [20, 20, 22, 21]),
    (2029, [20, 21, 22, 21]),
    (2030, [20, 21, 23, 21]),
    (2031, [20, 21, 23, 22]),
    (2032, [20, 20, 22, 21]),
    (2033, [20, 21, 22, 21]),
    (2034, [20, 21, 23, 21]),
    (2035, [20, 21, 23, 22]),
    (2036, [20, 20, 22, 21]),
    (2037, [20, 21, 22, 21]),
    (2038, [20, 21, 23, 21]),
    (2039, [20, 21, 23, 22]),
    (2040, [20, 20, 22, 21]),
    (2041, [20, 21, 22, 21]),
    (2042, [20, 21, 23, 21]),
    (2043, [20, 21, 23, 22]),
    (2044, [20, 20, 22, 21]),
    (2045, [20, 21, 22, 21]),
    (2046, [20, 21, 22, 21]),
    (2047, [20, 21, 23, 22]),
    (2048, [20, 20, 22, 21]),
    (2049, [20, 21, 22, 21]),
    (2050, [20, 21, 22, 21]),
    (2051, [20, 21, 23, 22]),
    (2052, [19, 20, 22, 21]),
    (2053, [20, 21, 22, 21]),
    (2054, [20, 21, 22, 21]),
    (2055, [20, 21, 23, 21]),
    (2056, [19, 20, 22, 21]),
    (2057, [20, 20, 22, 21]),
    (2058, [20, 21, 22, 21]),
    (2059, [20, 21, 23, 21]),
    (2060, [19, 20, 22, 21]),
];

/// The full moons in Kyiv time, 2020–2060 (scripts/gen_full_moons.py, Meeus ch. 49): (year, [(month, day)]).
const FULL_MOONS: &[(i64, &[(u8, u8)])] = &[
    (2020, &[(1, 10), (2, 9), (3, 9), (4, 8), (5, 7), (6, 5), (7, 5), (8, 3), (9, 2), (10, 2), (10, 31), (11, 30), (12, 30)]),
    (2021, &[(1, 28), (2, 27), (3, 28), (4, 27), (5, 26), (6, 24), (7, 24), (8, 22), (9, 21), (10, 20), (11, 19), (12, 19)]),
    (2022, &[(1, 18), (2, 16), (3, 18), (4, 16), (5, 16), (6, 14), (7, 13), (8, 12), (9, 10), (10, 9), (11, 8), (12, 8)]),
    (2023, &[(1, 7), (2, 5), (3, 7), (4, 6), (5, 5), (6, 4), (7, 3), (8, 1), (8, 31), (9, 29), (10, 28), (11, 27), (12, 27)]),
    (2024, &[(1, 25), (2, 24), (3, 25), (4, 24), (5, 23), (6, 22), (7, 21), (8, 19), (9, 18), (10, 17), (11, 15), (12, 15)]),
    (2025, &[(1, 14), (2, 12), (3, 14), (4, 13), (5, 12), (6, 11), (7, 10), (8, 9), (9, 7), (10, 7), (11, 5), (12, 5)]),
    (2026, &[(1, 3), (2, 2), (3, 3), (4, 2), (5, 1), (5, 31), (6, 30), (7, 29), (8, 28), (9, 26), (10, 26), (11, 24), (12, 24)]),
    (2027, &[(1, 22), (2, 21), (3, 22), (4, 21), (5, 20), (6, 19), (7, 18), (8, 17), (9, 16), (10, 15), (11, 14), (12, 13)]),
    (2028, &[(1, 12), (2, 10), (3, 11), (4, 9), (5, 8), (6, 7), (7, 6), (8, 5), (9, 4), (10, 3), (11, 2), (12, 2), (12, 31)]),
    (2029, &[(1, 30), (2, 28), (3, 30), (4, 28), (5, 27), (6, 26), (7, 25), (8, 24), (9, 22), (10, 22), (11, 21), (12, 21)]),
    (2030, &[(1, 19), (2, 18), (3, 19), (4, 18), (5, 17), (6, 15), (7, 15), (8, 13), (9, 12), (10, 11), (11, 10), (12, 10)]),
    (2031, &[(1, 8), (2, 7), (3, 9), (4, 7), (5, 7), (6, 5), (7, 4), (8, 3), (9, 1), (9, 30), (10, 30), (11, 29), (12, 28)]),
    (2032, &[(1, 27), (2, 26), (3, 27), (4, 25), (5, 25), (6, 23), (7, 22), (8, 21), (9, 19), (10, 18), (11, 17), (12, 16)]),
    (2033, &[(1, 15), (2, 14), (3, 16), (4, 14), (5, 14), (6, 13), (7, 12), (8, 10), (9, 9), (10, 8), (11, 6), (12, 6)]),
    (2034, &[(1, 4), (2, 3), (3, 5), (4, 3), (5, 3), (6, 2), (7, 1), (7, 31), (8, 29), (9, 28), (10, 27), (11, 26), (12, 25)]),
    (2035, &[(1, 23), (2, 22), (3, 24), (4, 22), (5, 22), (6, 20), (7, 20), (8, 19), (9, 17), (10, 17), (11, 15), (12, 15)]),
    (2036, &[(1, 13), (2, 12), (3, 12), (4, 10), (5, 10), (6, 9), (7, 8), (8, 7), (9, 5), (10, 5), (11, 4), (12, 3)]),
    (2037, &[(1, 2), (1, 31), (3, 2), (3, 31), (4, 29), (5, 29), (6, 27), (7, 27), (8, 25), (9, 24), (10, 24), (11, 22), (12, 22)]),
    (2038, &[(1, 21), (2, 19), (3, 21), (4, 19), (5, 18), (6, 17), (7, 16), (8, 15), (9, 13), (10, 13), (11, 12), (12, 11)]),
    (2039, &[(1, 10), (2, 9), (3, 10), (4, 9), (5, 8), (6, 6), (7, 6), (8, 4), (9, 2), (10, 2), (11, 1), (11, 30), (12, 30)]),
    (2040, &[(1, 29), (2, 28), (3, 28), (4, 27), (5, 26), (6, 24), (7, 24), (8, 22), (9, 20), (10, 20), (11, 18), (12, 18)]),
    (2041, &[(1, 17), (2, 16), (3, 17), (4, 16), (5, 16), (6, 14), (7, 13), (8, 12), (9, 10), (10, 9), (11, 8), (12, 7)]),
    (2042, &[(1, 6), (2, 5), (3, 6), (4, 5), (5, 5), (6, 3), (7, 3), (8, 1), (8, 31), (9, 29), (10, 28), (11, 27), (12, 26)]),
    (2043, &[(1, 25), (2, 23), (3, 25), (4, 24), (5, 24), (6, 22), (7, 22), (8, 20), (9, 19), (10, 18), (11, 16), (12, 16)]),
    (2044, &[(1, 14), (2, 13), (3, 13), (4, 12), (5, 12), (6, 10), (7, 10), (8, 9), (9, 7), (10, 7), (11, 5), (12, 5)]),
    (2045, &[(1, 3), (2, 1), (3, 3), (4, 1), (5, 1), (5, 30), (6, 29), (7, 29), (8, 27), (9, 26), (10, 26), (11, 24), (12, 24)]),
    (2046, &[(1, 22), (2, 21), (3, 22), (4, 20), (5, 20), (6, 18), (7, 18), (8, 16), (9, 15), (10, 15), (11, 13), (12, 13)]),
    (2047, &[(1, 12), (2, 10), (3, 12), (4, 10), (5, 9), (6, 8), (7, 7), (8, 5), (9, 4), (10, 4), (11, 2), (12, 2)]),
    (2048, &[(1, 1), (1, 31), (2, 29), (3, 30), (4, 28), (5, 27), (6, 26), (7, 25), (8, 23), (9, 22), (10, 21), (11, 20), (12, 20)]),
    (2049, &[(1, 19), (2, 17), (3, 19), (4, 18), (5, 17), (6, 15), (7, 15), (8, 13), (9, 11), (10, 11), (11, 9), (12, 9)]),
    (2050, &[(1, 8), (2, 6), (3, 8), (4, 7), (5, 7), (6, 5), (7, 4), (8, 3), (9, 1), (9, 30), (10, 30), (11, 28), (12, 28)]),
    (2051, &[(1, 26), (2, 25), (3, 27), (4, 26), (5, 25), (6, 24), (7, 23), (8, 22), (9, 20), (10, 19), (11, 18), (12, 17)]),
    (2052, &[(1, 16), (2, 14), (3, 15), (4, 14), (5, 13), (6, 12), (7, 12), (8, 10), (9, 9), (10, 8), (11, 6), (12, 6)]),
    (2053, &[(1, 4), (2, 3), (3, 4), (4, 3), (5, 2), (6, 1), (7, 1), (7, 30), (8, 29), (9, 28), (10, 27), (11, 26), (12, 25)]),
    (2054, &[(1, 23), (2, 22), (3, 23), (4, 22), (5, 21), (6, 20), (7, 19), (8, 18), (9, 17), (10, 16), (11, 15), (12, 15)]),
    (2055, &[(1, 13), (2, 12), (3, 13), (4, 11), (5, 11), (6, 9), (7, 9), (8, 7), (9, 6), (10, 5), (11, 4), (12, 4)]),
    (2056, &[(1, 3), (2, 1), (3, 2), (3, 31), (4, 29), (5, 29), (6, 27), (7, 26), (8, 25), (9, 23), (10, 23), (11, 22), (12, 22)]),
    (2057, &[(1, 20), (2, 19), (3, 21), (4, 19), (5, 18), (6, 17), (7, 16), (8, 14), (9, 13), (10, 12), (11, 11), (12, 11)]),
    (2058, &[(1, 9), (2, 8), (3, 10), (4, 9), (5, 8), (6, 6), (7, 6), (8, 4), (9, 2), (10, 2), (10, 31), (11, 30), (12, 29)]),
    (2059, &[(1, 28), (2, 27), (3, 29), (4, 27), (5, 27), (6, 25), (7, 25), (8, 23), (9, 21), (10, 21), (11, 19), (12, 19)]),
    (2060, &[(1, 17), (2, 16), (3, 17), (4, 16), (5, 15), (6, 14), (7, 13), (8, 12), (9, 10), (10, 9), (11, 8), (12, 7)]),
];

/// A mean lunation in ten-thousandths of a day, and a mean full moon (2000-01-21 04:41 UTC, Kyiv 06:41) the same
/// way, counted from 1970-01-01 00:00 Kyiv: for the years outside the table, within a day.
const LUNATION: i64 = 295_306;
const FULL_MOON_0: i64 = 10_977 * 10_000 + 2_785;

/// Whether the moon is full that night.
pub fn full_moon(day: i64) -> bool {
    let (y, m, d) = civil_from_days(day);
    if let Some((_, ds)) = FULL_MOONS.iter().find(|(yy, _)| *yy == y) {
        return ds.iter().any(|(mm, dd)| u32::from(*mm) == m && u32::from(*dd) == d);
    }
    let from = day * 10_000 - FULL_MOON_0;
    let into = from.rem_euclid(LUNATION);
    into < 10_000
}

const RIFT_MONTHS: [u32; 4] = [3, 6, 9, 12];
const RIFT_IDS: [(&str, &str); 4] = [
    ("spring_equinox", "Весняне рівнодення"),
    ("summer_solstice", "Літнє сонцестояння"),
    ("autumn_equinox", "Осіннє рівнодення"),
    ("winter_solstice", "Зимове сонцестояння"),
];

fn rift_days_of(year: i64) -> [i64; 4] {
    let ds = RIFTS.iter().find(|(y, _)| *y == year).map(|(_, d)| *d).unwrap_or([20, 21, 23, 21]);
    [0, 1, 2, 3].map(|k| days_from_civil(year, RIFT_MONTHS[k], ds[k]))
}

/// The equinox or solstice of a day (index 0..4: spring, summer, autumn, winter), if it is one.
pub fn rift_of(day: i64) -> Option<usize> {
    let (y, _, _) = civil_from_days(day);
    rift_days_of(y).iter().position(|d| *d == day)
}

/// On the equinoxes and the solstices the world cracks open for a day: the rifts to the Other Side.
pub fn rift_day(day: i64) -> bool {
    rift_of(day).is_some()
}

/// Easter Sunday (the Gregorian computus: the town's church is Catholic) of a year, as a day number.
pub fn easter(year: i64) -> i64 {
    let a = year % 19;
    let b = year / 100;
    let c = year % 100;
    let d = b / 4;
    let e = b % 4;
    let f = (b + 8) / 25;
    let g = (b - f + 1) / 3;
    let hh = (19 * a + b - d - g + 15) % 30;
    let i = c / 4;
    let k = c % 4;
    let l = (32 + 2 * e + 2 * i - hh - k) % 7;
    let m = (a + 11 * hh + 22 * l) / 451;
    let month = (hh + l - 7 * m + 114) / 31;
    let day = (hh + l - 7 * m + 114) % 31 + 1;
    days_from_civil(year, month as u32, day as u32)
}

pub fn weekday(day: i64) -> Weekday {
    // 1970-01-01 was a Thursday
    match (day + 3).rem_euclid(7) {
        0 => Weekday::Mon,
        1 => Weekday::Tue,
        2 => Weekday::Wed,
        3 => Weekday::Thu,
        4 => Weekday::Fri,
        5 => Weekday::Sat,
        _ => Weekday::Sun,
    }
}

/// The holiday of a day, if any (movable feasts first).
pub fn holiday(day: i64) -> Option<Holiday> {
    let (y, m, d) = civil_from_days(day);
    let e = easter(y);
    if day == lunar_new_year(y) {
        return Some(h("lunar_new_year", "Місячний Новий рік", false, true));
    }
    if day == e {
        return Some(h("easter", "Великдень", true, false));
    }
    if day == e - 7 {
        return Some(h("palm_sunday", "Вербна неділя", false, false));
    }
    if day == e + 49 {
        return Some(h("trinity", "Трійця", true, false));
    }
    if day >= e - 55 && day <= e - 49 {
        return Some(h("maslyana", "Масляна", false, false));
    }
    if let Some((id, name, ..)) = NTH.iter().find(|(_, _, nm, wd, n)| *nm == m && nth_weekday(y, *nm, *wd, *n) == day) {
        return Some(h(id, name, false, true));
    }
    if let Some(hol) = FIXED.iter().find(|(fm, fd, _)| *fm == m && *fd == d).map(|(_, _, hol)| *hol) {
        return Some(hol);
    }
    rift_of(day).map(|k| h(RIFT_IDS[k].0, RIFT_IDS[k].1, false, true))
}

/// Whether children have school that day: September to May, weekdays, not on day-off holidays, not in the
/// breaks (autumn: the last week of October; winter: 24 December to 7 January; spring: the last week of March).
pub fn school_day(day: i64) -> bool {
    let (_, m, d) = civil_from_days(day);
    let wd = weekday(day);
    if matches!(wd, Weekday::Sat | Weekday::Sun) {
        return false;
    }
    if (6..=8).contains(&m) {
        return false;
    }
    if (m == 10 && d >= 26) || (m == 12 && d >= 24) || (m == 1 && d <= 7) || (m == 3 && d >= 25) {
        return false;
    }
    !holiday(day).is_some_and(|hol| hol.day_off)
}

pub fn day_info(day: i64) -> DayInfo {
    let wd = weekday(day);
    let weekend = matches!(wd, Weekday::Sat | Weekday::Sun);
    let hol = holiday(day);
    DayInfo { weekday: wd, weekend, holiday: hol, day_off: weekend || hol.is_some_and(|x| x.day_off), school: school_day(day), rift: rift_day(day), full_moon: full_moon(day) }
}

/// The date (day number) of a holiday in a year: the fixed ones by their month and day, the movable ones by
/// Easter (for Масляна, the week's first day). None for an unknown id.
pub fn date_of(id: &str, year: i64) -> Option<i64> {
    let e = easter(year);
    match id {
        "easter" => Some(e),
        "lunar_new_year" => Some(lunar_new_year(year)),
        "palm_sunday" => Some(e - 7),
        "trinity" => Some(e + 49),
        "maslyana" => Some(e - 55),
        id if RIFT_IDS.iter().any(|(r, _)| *r == id) => RIFT_IDS.iter().position(|(r, _)| *r == id).map(|k| rift_days_of(year)[k]),
        id if NTH.iter().any(|(r, ..)| *r == id) => NTH.iter().find(|(r, ..)| *r == id).map(|(_, _, m, wd, n)| nth_weekday(year, *m, *wd, *n)),
        _ => FIXED.iter().find(|(_, _, h)| h.id == id).map(|(m, d, _)| days_from_civil(year, *m, *d)),
    }
}

/// Every holiday id the calendar knows (for checking content).
pub fn ids() -> Vec<&'static str> {
    let mut out = vec!["lunar_new_year", "easter", "palm_sunday", "trinity", "maslyana"];
    out.extend(NTH.iter().map(|(id, ..)| *id));
    out.extend(FIXED.iter().map(|(_, _, h)| h.id));
    out.extend(RIFT_IDS.iter().map(|(id, _)| *id));
    out
}

/// The holiday's name by id in the given language (the Ukrainian when there is no English one).
pub fn name_in(id: &str, l: crate::content::Lang) -> &'static str {
    if l.en() {
        let en = name_en(id);
        if !en.is_empty() {
            return en;
        }
    }
    name_of(id)
}

/// The holiday's English name by id (empty for an unknown one).
pub fn name_en(id: &str) -> &'static str {
    match id {
        "new_year" => "New Year's Day",
        "epiphany" => "Epiphany",
        "valentine" => "Valentine's Day",
        "womens_day" => "International Women's Day",
        "april_fools" => "April Fools' Day",
        "earth_day" => "Earth Day",
        "labour_day" => "May Day",
        "remembrance" => "Day of Remembrance and Victory",
        "childrens_day" => "Children's Day",
        "kupala" => "Midsummer Night",
        "constitution" => "Constitution Day",
        "statehood" => "Statehood Day",
        "honey_spas" => "Honey Saviour's Day",
        "apple_spas" => "Apple Saviour's Day",
        "independence" => "Independence Day",
        "knowledge_day" => "First Day of School",
        "defenders" => "Defenders' Day",
        "halloween" => "Halloween",
        "lantern_night" => "Lantern Night",
        "st_andrew_eve" => "St Andrew's Eve",
        "st_nicholas" => "St Nicholas Day",
        "christmas_eve" => "Christmas Eve",
        "christmas" => "Christmas",
        "new_year_eve" => "New Year's Eve",
        "spring_carnival" => "Spring Carnival",
        "mothers_day" => "Mother's Day",
        "flower_festival" => "Flower Festival",
        "last_bell" => "Last Bell",
        "town_day" => "Lypove Day",
        "summer_end" => "Goodbye, Summer",
        "harvest_fair" => "Harvest Fair",
        "winter_lights" => "Winter Lights Festival",
        "spring_equinox" => "Spring Equinox",
        "summer_solstice" => "Summer Solstice",
        "autumn_equinox" => "Autumn Equinox",
        "winter_solstice" => "Winter Solstice",
        "lunar_new_year" => "Lunar New Year",
        "easter" => "Easter",
        "palm_sunday" => "Palm Sunday",
        "trinity" => "Trinity Sunday",
        "maslyana" => "Maslyana",
        _ => "",
    }
}

/// The holiday's name by id (empty for an unknown one).
pub fn name_of(id: &str) -> &'static str {
    match id {
        "lunar_new_year" => "Місячний Новий рік",
        "easter" => "Великдень",
        "palm_sunday" => "Вербна неділя",
        "trinity" => "Трійця",
        "maslyana" => "Масляна",
        id if RIFT_IDS.iter().any(|(r, _)| *r == id) => RIFT_IDS.iter().find(|(r, _)| *r == id).map(|(_, n)| *n).unwrap_or(""),
        id if NTH.iter().any(|(r, ..)| *r == id) => NTH.iter().find(|(r, ..)| *r == id).map(|(_, n, ..)| *n).unwrap_or(""),
        _ => FIXED.iter().find(|(_, _, h)| h.id == id).map(|(_, _, h)| h.name).unwrap_or(""),
    }
}
