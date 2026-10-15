//! The nuclear power plant to be built beyond the fields: a calm, slow story told by the real calendar, the
//! same for everyone. First a rumour (geologists drilling in the fields), then the announcement, a public hearing
//! in the town hall, debates and a protest on the square, the approval, the site fenced, workers renting rooms in
//! town, cranes on the horizon, the cooling towers rising, the dome, and at last the first power. Each step
//! starts on its own day; the building itself grows day by day between the site's first crane and the launch.

use serde::Serialize;

use crate::time::days_from_civil;

/// A step of the story: (id, what it is called, the year, month and day it begins).
const STAGES: &[(&str, &str, i64, u32, u32)] = &[
    ("rumour", "Чутки", 2026, 10, 5),
    ("announced", "Оголошення", 2026, 10, 26),
    ("hearing", "Громадські слухання", 2026, 11, 14),
    ("debate", "Суперечки", 2026, 11, 15),
    ("protest", "Мітинг на площі", 2026, 12, 5),
    ("approved", "Рішення ухвалено", 2027, 1, 20),
    ("site", "Майданчик", 2027, 3, 1),
    ("workers", "Будівельники", 2027, 4, 12),
    ("cranes", "Крани на обрії", 2027, 6, 1),
    ("towers", "Градирні ростуть", 2027, 10, 1),
    ("dome", "Купол реактора", 2029, 6, 1),
    ("launch", "Перший струм", 2031, 9, 1),
];

/// Days that are one-day events rather than the start of a long stretch.
const ONE_DAY: &[&str] = &["hearing", "protest"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NppView {
    /// Index of the step (0 = the rumour).
    pub stage: u8,
    pub id: &'static str,
    pub name: &'static str,
    /// The day number (from 1970-01-01) the step began.
    pub since: i64,
    /// How far the building on the horizon has got, in thousandths (0 before the site, 1000 at the launch).
    pub built: u16,
    /// Today is a one-day event (the hearing, the protest): its id.
    pub event: Option<&'static str>,
}

fn start(k: usize) -> i64 {
    let (_, _, y, m, d) = STAGES[k];
    days_from_civil(y, m, d)
}

/// The step of the story on a day (by the real calendar), or None before the first rumour.
pub fn npp_at(day: i64) -> Option<NppView> {
    let k = (0..STAGES.len()).rev().find(|k| start(*k) <= day)?;
    let (site, launch) = (start(6), start(STAGES.len() - 1));
    let built = if day < site { 0 } else if day >= launch { 1000 } else { ((day - site) * 1000 / (launch - site)) as u16 };
    let id = STAGES[k].0;
    Some(NppView { stage: k as u8, id, name: STAGES[k].1, since: start(k), built, event: (day == start(k) && ONE_DAY.contains(&id)).then_some(id) })
}

/// The day a step begins (for tests and the calendar).
pub fn npp_day(id: &str) -> Option<i64> {
    STAGES.iter().position(|s| s.0 == id).map(start)
}

/// A step's name in English.
pub fn name_en(id: &str) -> &'static str {
    match id {
        "rumour" => "Rumours",
        "announced" => "The announcement",
        "hearing" => "Public hearing",
        "debate" => "Arguments",
        "protest" => "A rally on the square",
        "approved" => "The decision is made",
        "site" => "The building site",
        "workers" => "Builders",
        "cranes" => "Cranes on the horizon",
        "towers" => "The cooling towers rise",
        "dome" => "The reactor dome",
        _ => "First power",
    }
}

/// The paper's story on the day a step begins, in the given language.
pub fn npp_story_in(id: &str, l: crate::content::Lang) -> Option<(&'static str, &'static str)> {
    if !l.en() {
        return npp_story(id);
    }
    Some(match id {
        "rumour" => ("Boreholes are being drilled in the field beyond Lypove", "Geologists with a drilling rig are at work behind the farm. They say they're looking for a site for a nuclear power plant."),
        "announced" => ("A nuclear power plant will be built beyond Lypove", "The ministry has confirmed it: the plant will go up twenty kilometres away, across the river. Hearings at the town hall."),
        "hearing" => ("Hearing at the town hall today", "At six this evening the town hall will talk about the plant. Come along — everyone can have their say."),
        "debate" => ("The town hall argued till midnight", "Some look forward to jobs and cheap power, others fear for the river and the forest. Nothing has been decided yet."),
        "protest" => ("A rally on the square", "Today the plant's opponents came out with placards. All peaceful: tea from flasks, songs and signatures."),
        "approved" => ("The plant will be built", "The decision is made. The builders promise to look after the river, and the town promises to watch every step."),
        "site" => ("The site is fenced off", "A fence and the first crane have gone up across the river. Lorries full of sand are taking a detour round Lypove."),
        "workers" => ("Builders are looking for somewhere to live", "Fitters and welders have arrived in town. The hostel is full, and people are letting rooms in their houses too."),
        "cranes" => ("Cranes on the horizon", "Several cranes can already be seen from the water tower. In the evening red lights glow on them."),
        "towers" => ("The first cooling tower is rising", "A concrete ring of a cooling tower is rising over the fields. A few metres higher every week."),
        "dome" => ("A dome over the reactor", "The reactor dome went on in a single night. The engineers applauded, and at “Lypa” people drank coffee to its success."),
        "launch" => ("The plant has produced its first power", "White steam over the cooling towers. The lamps on the square now shine with atomic light."),
        _ => return None,
    })
}

/// The paper's story on the day a step begins: (headline, one or two short lines).
pub fn npp_story(id: &str) -> Option<(&'static str, &'static str)> {
    Some(match id {
        "rumour" => ("У полі за Липовим бурять свердловини", "Геологи з машиною-буром працюють за фермою. Кажуть, шукають місце під атомну станцію."),
        "announced" => ("За Липовим збудують атомну станцію", "Міністерство підтвердило: станцію зведуть за двадцять кілометрів, за річкою. Слухання — в ратуші."),
        "hearing" => ("Сьогодні — слухання в ратуші", "О шостій вечора в залі ратуші говоритимуть про станцію. Приходьте, кожен може сказати своє."),
        "debate" => ("Ратуша сперечалась до півночі", "Одні чекають роботи й дешевого світла, інші бояться за річку й ліс. Рішення ще не ухвалене."),
        "protest" => ("Мітинг на площі", "Сьогодні опоненти станції вийшли з плакатами. Усе мирно: чай із термосів, пісні й підписи."),
        "approved" => ("Станції бути", "Рішення ухвалене. Будівельники обіцяють берегти річку, громада — стежити за кожним кроком."),
        "site" => ("Майданчик огородили", "За річкою виріс паркан і перший кран. Вантажівки з піском їздять в об'їзд Липового."),
        "workers" => ("Будівельники шукають житло", "У місто приїхали монтажники й зварювальники. Хостел повний, кімнати здають і в приватних будинках."),
        "cranes" => ("Крани на обрії", "З водонапірної вежі видно вже кілька кранів. Увечері на них світяться червоні вогники."),
        "towers" => ("Росте перша градирня", "Над полями підіймається бетонне коло градирні. Кожного тижня — на кілька метрів вище."),
        "dome" => ("Над реактором — купол", "Купол реактора встановили за одну ніч. Інженери аплодували, а в «Липі» пили каву за успіх."),
        "launch" => ("Станція дала перший струм", "Над градирнями — біла пара. Ліхтарі на площі світять уже атомним світлом."),
        _ => return None,
    })
}

/// What one person thinks of the plant: some for it, some against, some not sure — always the same person the
/// same way (by their id), and what they say grows with the story.
pub fn npp_opinion(person: &str) -> i8 {
    let h = person.bytes().fold(0x811c_9dc5u32, |h, b| (h ^ u32::from(b)).wrapping_mul(0x0100_0193));
    match h % 5 {
        0 | 1 => 1,
        2 | 3 => -1,
        _ => 0,
    }
}

impl<S: crate::storage::Storage> crate::core::Core<S> {
    /// The plant's story on the day of `now`.
    pub fn npp_view(&self, now: crate::time::WorldTime) -> Option<NppView> {
        npp_at(self.calendar().date(now)).map(|v| if self.lang().en() { NppView { name: name_en(v.id), ..v } } else { v })
    }
}
