//! What people feel: the mood of each resident in a moment, the ties between them (couples, families, friends,
//! neighbours and rivals, a crush that turns into courting and then into a couple, quarrels and making up), and
//! how warm each of them is with the player. Everything is a pure function of the seed, the town's people, the
//! date and what the player did, so it is the same on every device and needs nothing stored; it is told in words
//! and shown by faces and gestures, never as numbers.

use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use std::rc::Rc;

use serde::Serialize;

use crate::content::Lang;
use crate::daily::Sky;
use crate::holidays::DayInfo;
use crate::life::{Activity, ResidentDef};
use crate::npc::{stream_of, Relation};
use crate::rng::{rand_below, Domain};
use crate::time::{Season, MINUTES_PER_DAY};

pub const FEEL: Domain = Domain(91);
pub const FEEL_TIES: Domain = Domain(92);
pub const FEEL_KIND: Domain = Domain(93);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Mood {
    Joyful,
    Content,
    Calm,
    Tired,
    Sleepy,
    Sad,
    Cross,
    InLove,
    Unwell,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TieKind {
    /// Married or living together (from the content).
    Couple,
    /// Under one roof: parents and children, brothers and sisters, the old with the young.
    Family,
    Friends,
    Colleagues,
    Neighbours,
    /// Neighbours who keep an eye on whose garden is greener.
    Rivals,
    /// One of them likes the other and has told nobody.
    Crush,
    /// They go out together.
    Courting,
    /// A couple now, though not married.
    Sweethearts,
    /// It did not work out (for a while it shows).
    Parted,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TieState {
    Fine,
    /// Not speaking today.
    Quarrel,
    /// Made up today, after a quarrel.
    MadeUp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Tie {
    pub a: String,
    pub b: String,
    pub kind: TieKind,
    pub state: TieState,
    /// Who of the two has the crush (for a crush).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub admirer: Option<String>,
    /// Days since this kind of tie began (romances; 0 for the others).
    pub days: i64,
}

impl Tie {
    pub fn other(&self, id: &str) -> &str {
        if self.a == id {
            &self.b
        } else {
            &self.a
        }
    }

    pub fn has(&self, id: &str) -> bool {
        self.a == id || self.b == id
    }

    /// A romance (crush, courting, sweethearts) or a couple.
    pub fn love(&self) -> bool {
        matches!(self.kind, TieKind::Couple | TieKind::Crush | TieKind::Courting | TieKind::Sweethearts)
    }
}

/// How warm someone is with the player.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Warmth {
    Stranger,
    Known,
    Warm,
    Close,
    Dear,
}

/// The two ids of a pair in order, and their own stream of the world's randomness.
fn pair(a: &str, b: &str) -> (String, String, u64) {
    let (x, y) = if a < b { (a, b) } else { (b, a) };
    (x.to_string(), y.to_string(), stream_of(x) ^ (stream_of(y) << 1))
}

fn house_number(home: &str) -> Option<i64> {
    home.strip_prefix("home_").and_then(|n| n.parse().ok())
}

/// The quarrels of a pair come and go: in each stretch of `W` days there may be one, a day or a few long; the day
/// after it they make up.
const W: i64 = 24;

pub fn spat(seed: u64, key: u64, kind: TieKind, date: i64) -> TieState {
    let (share, longest) = match kind {
        TieKind::Couple => (22, 2),
        TieKind::Family => (16, 2),
        TieKind::Friends => (14, 4),
        TieKind::Rivals => (45, 6),
        TieKind::Neighbours => (8, 2),
        TieKind::Colleagues => (8, 1),
        TieKind::Sweethearts => (15, 2),
        TieKind::Courting => (10, 1),
        _ => return TieState::Fine,
    };
    let w0 = date.div_euclid(W);
    for w in [w0, w0 - 1] {
        let t = (w as u64).wrapping_mul(4);
        if rand_below(seed, FEEL_TIES, key, t + 1, 100) >= share {
            continue;
        }
        let start = w * W + rand_below(seed, FEEL_TIES, key, t + 2, W as u64) as i64;
        let len = 1 + rand_below(seed, FEEL_TIES, key, t + 3, longest) as i64;
        if date >= start && date < start + len {
            return TieState::Quarrel;
        }
        if date == start + len {
            return TieState::MadeUp;
        }
    }
    TieState::Fine
}

/// Two single people who may fall for each other: when it begins, and its own draw.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Romance {
    pub a: String,
    pub b: String,
    pub start: i64,
    pub draw: u64,
}

/// Days of a crush, then of courting; after that they are a couple (or, now and then, part).
pub const CRUSH_DAYS: i64 = 21;
pub const COURTING_DAYS: i64 = 40;
pub const PARTED_SHOWS: i64 = 30;

/// Who among the single grown-ups may fall for whom: pairs of a man and a woman of the same age (grown-ups or the
/// old), from different homes, matched by their own draw (the likeliest first) so a newcomer only changes the
/// pairs that are about them. About two in three of the pairs come to something, one by one over the first
/// months of the world.
pub fn romances(seed: u64, first_day: i64, people: &[&ResidentDef]) -> Vec<Romance> {
    let taken: BTreeSet<&str> = people.iter().filter_map(|r| r.partner.as_deref()).collect();
    let singles: Vec<&&ResidentDef> = people.iter().filter(|r| (r.age == "adult" || r.age == "elder") && r.partner.is_none() && !taken.contains(r.id.as_str())).collect();
    let mut cands: Vec<(u64, usize, usize)> = Vec::new();
    for (i, a) in singles.iter().enumerate() {
        for (j, b) in singles.iter().enumerate().skip(i + 1) {
            if a.gender == b.gender || a.age != b.age || a.home == b.home {
                continue;
            }
            let (_, _, key) = pair(&a.id, &b.id);
            cands.push((crate::rng::rand(seed, FEEL_TIES, key, 7), i, j));
        }
    }
    cands.sort_unstable();
    let mut used = BTreeSet::new();
    let mut out = Vec::new();
    for (draw, i, j) in cands {
        if used.contains(&i) || used.contains(&j) {
            continue;
        }
        used.insert(i);
        used.insert(j);
        if draw % 100 >= 65 {
            continue;
        }
        let (a, b, _) = pair(&singles[i].id, &singles[j].id);
        out.push(Romance { a, b, start: first_day + 2 + ((draw >> 20) % 150) as i64, draw });
    }
    out
}

/// Where a romance stands on a date (None before it begins or long after it ended).
pub fn romance_on(r: &Romance, date: i64) -> Option<(TieKind, i64)> {
    let d = date - r.start;
    if d < 0 {
        None
    } else if d < CRUSH_DAYS {
        Some((TieKind::Crush, d))
    } else if d < CRUSH_DAYS + COURTING_DAYS {
        Some((TieKind::Courting, d - CRUSH_DAYS))
    } else if r.draw % 4 == 0 {
        let e = d - CRUSH_DAYS - COURTING_DAYS;
        (e < PARTED_SHOWS).then_some((TieKind::Parted, e))
    } else {
        Some((TieKind::Sweethearts, d - CRUSH_DAYS - COURTING_DAYS))
    }
}

/// Whether a courting or sweetheart pair go out together this evening (both of them draw the same).
pub fn date_night(seed: u64, r: &Romance, kind: TieKind, date: i64) -> bool {
    let (_, _, key) = pair(&r.a, &r.b);
    let share = match kind {
        TieKind::Courting => 45,
        TieKind::Sweethearts => 30,
        _ => return false,
    };
    rand_below(seed, FEEL_TIES, key, date as u64 * 2 + 11, 100) < share
}

/// All the ties of the town on a date.
pub fn ties_on(seed: u64, first_day: i64, people: &[&ResidentDef], date: i64) -> Vec<Tie> {
    let mut out = Vec::new();
    let ids: BTreeSet<&str> = people.iter().map(|r| r.id.as_str()).collect();
    let mut seen: BTreeSet<(String, String)> = BTreeSet::new();
    let mut push = |a: &str, b: &str, kind: TieKind, admirer: Option<String>, days: i64, out: &mut Vec<Tie>| {
        let (x, y, key) = pair(a, b);
        if !seen.insert((x.clone(), y.clone())) {
            return;
        }
        let state = spat(seed, key, kind, date);
        out.push(Tie { a: x, b: y, kind, state, admirer, days });
    };
    // couples
    for r in people {
        if let Some(p) = r.partner.as_deref().filter(|p| ids.contains(p)) {
            push(&r.id, p, TieKind::Couple, None, 0, &mut out);
        }
    }
    // romances
    for rm in romances(seed, first_day, people) {
        if let Some((kind, days)) = romance_on(&rm, date) {
            let admirer = (kind == TieKind::Crush).then(|| if rm.draw & 1 == 0 { rm.a.clone() } else { rm.b.clone() });
            push(&rm.a, &rm.b, kind, admirer, days, &mut out);
        }
    }
    // families under one roof
    let mut homes: BTreeMap<&str, Vec<&ResidentDef>> = BTreeMap::new();
    for r in people {
        homes.entry(r.home.as_str()).or_default().push(r);
    }
    for list in homes.values() {
        for (i, a) in list.iter().enumerate() {
            for b in list.iter().skip(i + 1) {
                push(&a.id, &b.id, TieKind::Family, None, 0, &mut out);
            }
        }
    }
    // friends, colleagues
    for (i, a) in people.iter().enumerate() {
        for b in people.iter().skip(i + 1) {
            if crate::town::friends(seed, &a.id, &b.id) && (a.age == "child") == (b.age == "child") {
                push(&a.id, &b.id, TieKind::Friends, None, 0, &mut out);
            } else if a.job.is_some() && a.job.as_ref().map(|j| &j.0) == b.job.as_ref().map(|j| &j.0) {
                push(&a.id, &b.id, TieKind::Colleagues, None, 0, &mut out);
            }
        }
    }
    // the heads of next-door houses: good neighbours, or rivals
    let head = |home: &str| homes.get(home).and_then(|l| l.iter().find(|r| r.age != "child").copied());
    for home in homes.keys() {
        let Some(n) = house_number(home) else { continue };
        let next = format!("home_{}", n + 1);
        if let (Some(a), Some(b)) = (head(home), head(&next)) {
            let (_, _, key) = pair(&a.id, &b.id);
            let kind = if rand_below(seed, FEEL_TIES, key, 3, 100) < 30 { TieKind::Rivals } else { TieKind::Neighbours };
            push(&a.id, &b.id, kind, None, 0, &mut out);
        }
    }
    out
}

// ---- the ties, worked out once a day ------------------------------------------------------------------------

thread_local! {
    static TIES: RefCell<Option<((u64, i64, i64, u64), Rc<Vec<Tie>>)>> = const { RefCell::new(None) };
}

fn people_key(people: &[&ResidentDef]) -> u64 {
    people.iter().fold(0xcbf2_9ce4_8422_2325u64, |h, r| {
        let s = format!("{}|{}|{}|{:?}|{:?};", r.id, r.age, r.home, r.partner, r.job);
        s.bytes().fold(h, |h, b| (h ^ u64::from(b)).wrapping_mul(0x0000_0100_0000_01b3))
    })
}

/// The ties of a date, kept for the next ask of the same date.
pub fn ties_cached(seed: u64, first_day: i64, people: &[&ResidentDef], date: i64) -> Rc<Vec<Tie>> {
    let key = (seed, first_day, date, people_key(people));
    TIES.with(|c| {
        if let Some((k, t)) = c.borrow().as_ref() {
            if *k == key {
                return t.clone();
            }
        }
        let t = Rc::new(ties_on(seed, first_day, people, date));
        *c.borrow_mut() = Some((key, t.clone()));
        t
    })
}

// ---- moods ----------------------------------------------------------------------------------------------------

/// What there is to know about someone in a moment to say how they feel.
pub struct MoodInput<'a> {
    pub id: &'a str,
    pub age: &'a str,
    pub temper: u32,
    pub social: u32,
    pub activity: Activity,
    /// The simulation's own mood (company, a good meal, a fight, a fine).
    pub life_mood: i32,
    pub sky: Sky,
    pub season: Season,
    pub info: &'a DayInfo,
    pub birthday: bool,
    /// Minute of the day.
    pub minute: u32,
    /// Their ties today.
    pub ties: &'a [&'a Tie],
    /// How they are with the player.
    pub warmth: Warmth,
}

/// How someone feels now, and the reason (a word for what they say): `sick`, `night`, `birthday`, `love`,
/// `quarrel`, `made_up`, `parted`, `holiday`, `weather`, `work`, `company`, `day`.
pub fn mood_of(seed: u64, date: i64, m: &MoodInput) -> (Mood, &'static str) {
    if matches!(m.activity, Activity::Sick | Activity::Injured) {
        return (Mood::Unwell, "sick");
    }
    let hour = m.minute / 60;
    if m.activity == Activity::Sleep || hour < 5 {
        return (Mood::Sleepy, "night");
    }
    let mut score: i32 = m.life_mood.clamp(-30, 50) / 2;
    let mut why = "day";
    let mut best = 0i32;
    let note = |w: &'static str, v: i32, why: &mut &'static str, best: &mut i32| {
        if v.abs() > best.abs() {
            *best = v;
            *why = w;
        }
    };
    // the weather and the season
    let child = m.age == "child";
    let w = match m.sky {
        Sky::Clear => 6 + if m.season == Season::Summer { 3 } else { 0 },
        Sky::Cloudy => 0,
        Sky::Rain => -6,
        Sky::Storm => -10,
        Sky::Snow => {
            if child {
                9
            } else {
                -2
            }
        }
        Sky::Fog => -3,
    } - if m.season == Season::Winter && !child { 2 } else { 0 };
    score += w;
    note("weather", w, &mut why, &mut best);
    // the day
    let mut d = 0;
    if m.info.holiday.is_some_and(|h| h.festive) {
        d += 10;
    }
    if m.info.day_off {
        d += 4;
    }
    score += d;
    note("holiday", d, &mut why, &mut best);
    if m.birthday {
        score += 22;
        note("birthday", 22, &mut why, &mut best);
    }
    if m.activity == Activity::Work && m.temper > 55 {
        score -= 3;
        note("work", -3, &mut why, &mut best);
    }
    if m.life_mood > 25 {
        note("company", m.life_mood / 2, &mut why, &mut best);
    }
    // a swing of one's own today, wider for the hot-headed
    let span = 12 + (m.temper as i64 / 10);
    score += rand_below(seed, FEEL, stream_of(m.id), date as u64, (span * 2 + 1) as u64) as i32 - span as i32;
    // the people close to them
    let mut love = false;
    let mut cross = false;
    for t in m.ties {
        let close = matches!(t.kind, TieKind::Couple | TieKind::Family | TieKind::Friends | TieKind::Sweethearts | TieKind::Courting | TieKind::Rivals);
        match t.state {
            TieState::Quarrel if close => {
                score -= 16;
                cross = true;
                note("quarrel", -16, &mut why, &mut best);
            }
            TieState::MadeUp if close => {
                score += 12;
                note("made_up", 12, &mut why, &mut best);
            }
            _ => {}
        }
        match t.kind {
            TieKind::Crush if t.admirer.as_deref() == Some(m.id) => {
                score += 6;
                love = true;
                note("love", 15, &mut why, &mut best);
            }
            TieKind::Courting => {
                score += 12;
                love = true;
                note("love", 15, &mut why, &mut best);
            }
            TieKind::Sweethearts if t.days < 21 => {
                score += 10;
                love = true;
                note("love", 15, &mut why, &mut best);
            }
            TieKind::Parted if t.days < 10 => {
                score -= 14;
                note("parted", -20, &mut why, &mut best);
            }
            _ => {}
        }
    }
    if m.warmth >= Warmth::Dear {
        score += 3;
    }
    let evening = hour >= 21 || (m.age == "elder" && hour >= 20) || (child && hour >= 19);
    let mood = if love && !cross && score > -6 {
        Mood::InLove
    } else if cross && (m.temper > 45 || score < -4) {
        Mood::Cross
    } else if cross && score < 10 {
        Mood::Sad
    } else if score <= -12 {
        if m.temper > 60 {
            Mood::Cross
        } else {
            Mood::Sad
        }
    } else if evening && score < 18 {
        Mood::Tired
    } else if score >= 20 {
        Mood::Joyful
    } else if score >= 6 {
        Mood::Content
    } else if m.social < 30 && score < 0 {
        Mood::Tired
    } else {
        Mood::Calm
    };
    let why = match mood {
        Mood::InLove => "love",
        Mood::Tired if evening => "night",
        _ => why,
    };
    (mood, why)
}

// ---- the player ----------------------------------------------------------------------------------------------

/// Friendship that is not kept up fades a little (never below two fifths), and a promise not kept is remembered.
pub fn effective_points(rel: &Relation, today: u64, missed: u32) -> u32 {
    let mut p = i64::from(rel.points);
    if let Some(last) = rel.last {
        if today > last + 21 {
            let fade = ((today - last - 21) as i64 * 3).min(p * 3 / 5);
            p -= fade;
        }
    }
    p -= i64::from(missed) * 60;
    p.max(0) as u32
}

pub fn warmth_of(rel: Option<&Relation>, points: u32) -> Warmth {
    match rel {
        None => Warmth::Stranger,
        Some(r) if !r.met && points == 0 => Warmth::Stranger,
        _ if points < 150 => Warmth::Known,
        _ if points < 400 => Warmth::Warm,
        _ if points < 700 => Warmth::Close,
        _ => Warmth::Dear,
    }
}

/// Whether a close friend has a little something for the player today (now and then, not on a schedule).
pub fn kindness_today(seed: u64, id: &str, date: i64, warmth: Warmth) -> bool {
    let share = match warmth {
        Warmth::Dear => 40,
        Warmth::Close => 22,
        _ => return false,
    };
    let week = date.div_euclid(7);
    let s = stream_of(id);
    rand_below(seed, FEEL_KIND, s, week as u64 * 2, 100) < share && date.rem_euclid(7) == rand_below(seed, FEEL_KIND, s, week as u64 * 2 + 1, 7) as i64
}

/// One of two lists of the same length (Ukrainian, English), picked by the day: the same choice in either language.
fn pick_in<'a>(seed: u64, id: &str, tick: u64, l: Lang, uk: &[&'a str], en: &[&'a str]) -> &'a str {
    debug_assert_eq!(uk.len(), en.len());
    let i = rand_below(seed, FEEL, stream_of(id) ^ 0x5151, tick, uk.len() as u64) as usize;
    if l.en() { en[i] } else { uk[i] }
}

/// What someone says on seeing the player, by how close they are.
pub fn greeting(seed: u64, r: &ResidentDef, warmth: Warmth, player: Option<&str>, date: i64, mood: Mood, l: Lang) -> String {
    let f = r.gender == "f";
    let child = r.age == "child";
    let elder = r.age == "elder";
    let t = date as u64;
    let line = match warmth {
        Warmth::Stranger => {
            if child {
                pick_in(seed, &r.id, t, l, &["Привіт!", "А ти хто?", "Добрий день!"], &["Hi!", "Who are you?", "Hello!"]).to_string()
            } else {
                pick_in(seed, &r.id, t, l, &["Добрий день.", "День добрий.", "Доброго здоров'я."], &["Good day.", "Hello there.", "Good health to you."]).to_string()
            }
        }
        Warmth::Known => pick_in(seed, &r.id, t, l, &["О, це ви! Добрий день.", "Знову зустрілися — добрий день!", "А, сусіди! Як ся маєте?"], &["Oh, it's you! Good day.", "We meet again — hello!", "Ah, neighbour! How are you keeping?"]).to_string(),
        Warmth::Warm => pick_in(seed, &r.id, t, l, &["Привіт! Радий тебе бачити.", "О, привіт! Як твої справи?", "Привіт-привіт! Гарно виглядаєш."], &["Hi! Good to see you.", "Oh, hi! How are things?", "Hello, hello! You're looking well."])
            .replace("Радий", if f { "Рада" } else { "Радий" }),
        Warmth::Close => match player {
            Some(n) if !n.is_empty() => {
                format!("{}{}", pick_in(seed, &r.id, t, l, &["О, ", "Ой, ", "Гей, "], &["Oh, ", "Ooh, ", "Hey, "]), n)
                    + pick_in(seed, &r.id, t + 1, l, &["! Як ти?", "! Саме про тебе думав.", "! Заходь якось на чай."], &["! How are you?", "! I was just thinking of you.", "! Come round for tea sometime."]).replace("думав", if f { "думала" } else { "думав" }).as_str()
            }
            _ => pick_in(seed, &r.id, t, l, &["Привіт, друже! Як ти?", "О, кого я бачу! Заходь якось на чай."], &["Hello, friend! How are you?", "Well, look who it is! Come round for tea sometime."]).to_string(),
        },
        Warmth::Dear => {
            if elder {
                pick_in(seed, &r.id, t, l, &["Сонечко моє! Як же я рада тебе бачити!", "Дитино, ти поїло сьогодні? Заходь на пиріжки!", "Золотко наше прийшло!"], &["My little sunshine! How glad I am to see you!", "Have you eaten today, dear? Come in for some pies!", "Here comes our treasure!"]).replace("рада", if f { "рада" } else { "радий" })
            } else if child {
                pick_in(seed, &r.id, t, l, &["Ура, це ти! Пограєш зі мною?", "Ти мій найкращий дорослий друг!"], &["Yay, it's you! Will you play with me?", "You're my best grown-up friend!"]).to_string()
            } else if l.en() {
                match player {
                    Some(n) if !n.is_empty() => format!("{n}, my friend! I've missed you so."),
                    _ => "My dear friend! How glad I am.".to_string(),
                }
            } else {
                let friend = if f { "подруго" } else { "друже" };
                match player {
                    Some(n) if !n.is_empty() => format!("{n}, {friend} мій! Я так скучив.").replace("скучив", if f { "скучила" } else { "скучив" }),
                    _ => format!("Мій любий {friend}! Як же я рада.").replace("рада", if f { "рада" } else { "радий" }).replace("Мій любий подруго", "Моя люба подруго"),
                }
            }
        }
    };
    let extra = match mood {
        Mood::Sad if warmth >= Warmth::Warm => l.pick(" Щось мені сумно сьогодні…", " I'm feeling a bit low today…"),
        Mood::Cross if warmth >= Warmth::Warm => l.pick(" Не зважай, я сьогодні не в гуморі.", " Don't mind me, I'm out of sorts today."),
        Mood::InLove if warmth >= Warmth::Close => l.pick(" Ох, у мене таке на серці!", " Oh, my heart is so full!"),
        Mood::Joyful if warmth >= Warmth::Warm => l.pick(" Який день, га?", " What a day, eh?"),
        _ => "",
    };
    format!("{line}{extra}")
}

/// How the player stands with someone, told as in a diary.
pub fn bond_words(r: &ResidentDef, warmth: Warmth, faded: bool, missed: u32, disliked: bool, l: Lang) -> String {
    let f = r.gender == "f";
    if l.en() {
        let (he, him) = if f { ("she", "her") } else { ("he", "him") };
        let mut s = match warmth {
            Warmth::Stranger => "We haven't met yet.".to_string(),
            Warmth::Known => format!("Acquaintances: we say hello in the street, and {he} knows me by sight."),
            Warmth::Warm => "Always greets me warmly and asks how I'm doing.".to_string(),
            Warmth::Close => format!("A good friend: {he} invites me round and shares the news."),
            Warmth::Dear => format!("A kindred soul in Lypove: {he} waits for me and is glad of every meeting."),
        };
        if faded {
            s.push_str(&format!(" We haven't seen each other for a while — {he} misses me a little."));
        }
        if missed > 0 {
            s.push_str(&format!(" I promised {him} something and never came through."));
        }
        if disliked {
            s.push_str(" Still remembers that gift that went wrong.");
        }
        return s;
    }
    let g = |m: &'static str, w: &'static str| if f { w } else { m };
    let mut s = match warmth {
        Warmth::Stranger => "Ще не знайомі.".to_string(),
        Warmth::Known => format!("Знайомі: вітаємося на вулиці, {} мене впізнає.", g("він", "вона")),
        Warmth::Warm => "Завжди тепло вітається й питає, як справи.".to_string(),
        Warmth::Close => format!("Добрий друг: {} кличе в гості й ділиться новинами.", g("він", "вона")),
        Warmth::Dear => format!("Рідна душа в Липовому: {} чекає на мене й радіє кожній зустрічі.", g("він", "вона")),
    };
    if faded {
        s.push_str(&format!(" Давно не бачилися — {} трохи сумує.", g("він", "вона")));
    }
    if missed > 0 {
        s.push_str(&format!(" {} на обіцяне, та так і не {}.", g("Чекав", "Чекала"), g("дочекався", "дочекалася")));
    }
    if disliked {
        s.push_str(" Досі згадує той невдалий подарунок.");
    }
    s
}

fn first(name: &str) -> &str {
    name.split(' ').next().unwrap_or(name)
}

/// A secret shared with a close friend: about whom they like, who they fell out with, what weighs on them.
pub fn confidence(seed: u64, r: &ResidentDef, ties: &[&Tie], names: &BTreeMap<String, String>, date: i64, l: Lang) -> String {
    let f = r.gender == "f";
    let name = |id: &str| names.get(id).map(|n| first(n).to_string()).unwrap_or_default();
    for t in ties {
        let o = name(t.other(&r.id));
        match (t.kind, t.state, l.en()) {
            (TieKind::Crush, _, en) if t.admirer.as_deref() == Some(r.id.as_str()) => {
                return if en { format!("Just between us: I really like {o}. Don't tell anyone, all right?") } else { format!("Тільки між нами: мені дуже подобається {o}. Тільки нікому, добре?") };
            }
            (TieKind::Courting, _, true) => return format!("{o} and I have been going out on dates. I'm happier than I can say!"),
            (TieKind::Courting, _, false) => return format!("Я і {o} ходимо на побачення. Я {} — що й не сказати!", if f { "така щаслива" } else { "такий щасливий" }),
            (_, TieState::Quarrel, true) => return format!("{o} and I fell out… Silly thing, but it nags at me. I hope we make up."),
            (_, TieState::Quarrel, false) => return format!("Я і {o} посварилися… Дурниця, але гризе. Сподіваюся, помиримося."),
            (TieKind::Rivals, _, true) => return format!("{o} is showing off that garden again. Well, well — we'll see whose pumpkin is bigger!"),
            (TieKind::Rivals, _, false) => return format!("{o} знову хизується своїм городом. Ну-ну, побачимо, в кого гарбуз більший!"),
            (TieKind::Parted, _, true) => return format!("{o} and I have split up. I'll get over it. I'm glad you're here."),
            (TieKind::Parted, _, false) => return format!("Я і {o} розійшлися. Нічого, переживу. Добре, що ти є."),
            _ => {}
        }
    }
    let (pool, pool_en): (&[&str], &[&str]) = match r.age.as_str() {
        "elder" => (
            &["Знаєш, я в молодості танцювала на кожному весіллі в окрузі. Ох, які були часи!", "Мій дід закопав десь у саду скриньку. Так і не знайшли.", "Я іноді розмовляю з липами на площі. Вони все пам'ятають."],
            &["You know, when I was young I danced at every wedding for miles around. Oh, those were the days!", "My grandfather buried a little box somewhere in the garden. Nobody ever found it.", "Sometimes I talk to the lindens on the square. They remember everything."],
        ),
        "child" => (
            &["А я знаю, де в парку живе їжак! Тільки тобі скажу.", "Я боюся темряви, але нікому не кажи.", "Коли виросту, буду пілотом. Або пекарем."],
            &["I know where a hedgehog lives in the park! I'll only tell you.", "I'm scared of the dark, but don't tell anyone.", "When I grow up I'll be a pilot. Or a baker."],
        ),
        _ => (
            &["Я мрію колись відкрити свою справу. Може, маленьку кав'ярню біля озера.", "Інколи думаю поїхати до міста… але тут мій дім.", "Я пишу вірші. Ніхто не знає. Тепер ти знаєш.", "Мені сниться море. Ніколи його не бачив."],
            &["I dream of starting something of my own one day. Maybe a little café by the lake.", "Sometimes I think of moving to the city… but this is home.", "I write poems. Nobody knows. Now you do.", "I dream of the sea. I've never seen it."],
        ),
    };
    pick_in(seed, &r.id, date as u64 / 7, l, pool, pool_en).replace("бачив", if f { "бачила" } else { "бачив" }).replace("танцювала", if f { "танцювала" } else { "танцював" })
}

/// What the town says about the ties that changed in the last days: quarrels, making up, a new couple.
pub fn gossip(seed: u64, first_day: i64, people: &[&ResidentDef], date: i64, l: Lang) -> Vec<String> {
    let names: BTreeMap<&str, &str> = people.iter().map(|r| (r.id.as_str(), first(&r.name))).collect();
    let n = |id: &str| names.get(id).copied().unwrap_or("");
    let today = ties_cached(seed, first_day, people, date);
    let yesterday = ties_cached(seed, first_day, people, date - 1);
    let mut out = Vec::new();
    let reasons = ["через паркан", "через кота", "через футбол", "через борщ", "через позичену драбину", "через дурницю"];
    let reasons_en = ["over the fence", "over the cat", "over football", "over the borscht", "over a borrowed ladder", "over nothing at all"];
    let en = l.en();
    for t in today.iter() {
        let before = yesterday.iter().find(|y| y.a == t.a && y.b == t.b);
        let (a, b) = (n(&t.a), n(&t.b));
        let (_, _, key) = pair(&t.a, &t.b);
        let which = rand_below(seed, FEEL, key, date as u64, reasons.len() as u64) as usize;
        let reason = if en { reasons_en[which] } else { reasons[which] };
        if t.state == TieState::Quarrel && before.is_none_or(|y| y.state != TieState::Quarrel) && t.kind != TieKind::Colleagues {
            out.push(match (t.kind, en) {
                (TieKind::Rivals, false) => format!("{a} і {b} знову сперечаються, чий город кращий."),
                (TieKind::Couple | TieKind::Sweethearts, false) => format!("Кажуть, {a} і {b} посварилися {reason}. Милі сваряться — тільки тішаться."),
                (_, false) => format!("Кажуть, {a} і {b} посварилися {reason}."),
                (TieKind::Rivals, true) => format!("{a} and {b} are arguing again about whose garden is better."),
                (TieKind::Couple | TieKind::Sweethearts, true) => format!("They say {a} and {b} had a row {reason}. Lovers' quarrels never last."),
                (_, true) => format!("They say {a} and {b} had a row {reason}."),
            });
        }
        if t.state == TieState::MadeUp && t.kind != TieKind::Colleagues {
            out.push(if en { format!("{a} and {b} have made up — someone saw them hugging.") } else { format!("{a} і {b} помирилися — бачили, як обіймалися.") });
        }
        if t.kind == TieKind::Courting && t.days == 0 {
            out.push(if en { format!("Did you see {a} and {b} out walking together last night? Something's brewing!") } else { format!("Бачили, як {a} і {b} гуляли вдвох увечері? Ой, щось буде!") });
        }
        if t.kind == TieKind::Sweethearts && t.days == 0 {
            out.push(if en { format!("{a} and {b} are a couple now — all of Lypove is delighted!") } else { format!("{a} і {b} тепер пара — все Липове радіє!") });
        }
        if t.kind == TieKind::Sweethearts && t.days == 300 {
            out.push(if en { format!("They say {a} and {b} are thinking about a wedding!") } else { format!("Кажуть, {a} і {b} думають про весілля!") });
        }
        if t.kind == TieKind::Parted && t.days == 0 {
            out.push(if en { format!("{a} and {b} have split up. These things happen…") } else { format!("{a} і {b} розійшлися. Буває…") });
        }
    }
    out
}

// ---- the view -------------------------------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ResidentFeel {
    pub id: String,
    pub mood: Mood,
    pub why: &'static str,
    /// Who they are out with now (a date, or two who just made up): they keep together.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub with: Option<String>,
    /// Whom they are not speaking to today.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub cross: Vec<String>,
    /// Whom their heart is set on.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub love: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct WarmthView {
    pub id: String,
    pub name: String,
    pub level: Warmth,
    /// How the player stands with them, in words.
    pub words: String,
    /// What they say on seeing the player.
    pub greet: String,
    /// A secret they share (close friends only).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confide: Option<String>,
    /// They have a little something for the player today.
    pub gift: bool,
    pub faded: bool,
    /// Their people, as the player knows them (married to, friends with, not speaking to…).
    pub people: Vec<String>,
    /// How they are today, in a word.
    pub today: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct FeelingsView {
    pub residents: Vec<ResidentFeel>,
    /// The ties worth showing: romances, couples, rivals, and any quarrel or making up today.
    pub ties: Vec<Tie>,
    /// Everyone the player has met.
    pub warmth: Vec<WarmthView>,
    /// What people say about each other.
    pub gossip: Vec<String>,
}

pub fn mood_word(m: Mood, f: bool, l: Lang) -> &'static str {
    if l.en() {
        return match m {
            Mood::Joyful => "beaming with joy",
            Mood::Content => "in good spirits",
            Mood::Calm => "a quiet day",
            Mood::Tired => "tired",
            Mood::Sleepy => "asleep or nearly so",
            Mood::Sad => "feeling sad",
            Mood::Cross => "out of sorts",
            Mood::InLove => "in love",
            Mood::Unwell => "feeling unwell",
        };
    }
    match (m, f) {
        (Mood::Joyful, false) => "сяє від радості",
        (Mood::Joyful, true) => "сяє від радості",
        (Mood::Content, _) => "у доброму гуморі",
        (Mood::Calm, _) => "спокійний день",
        (Mood::Tired, false) => "втомився",
        (Mood::Tired, true) => "втомилася",
        (Mood::Sleepy, _) => "спить або от-от засне",
        (Mood::Sad, _) => "сумує",
        (Mood::Cross, _) => "не в гуморі",
        (Mood::InLove, false) => "закоханий",
        (Mood::InLove, true) => "закохана",
        (Mood::Unwell, _) => "нездужає",
    }
}

fn tie_words(t: &Tie, me: &ResidentDef, other: &str, f_other: bool, warmth: Warmth, l: Lang) -> Option<String> {
    // the other one's name stays as it is (no cases to get wrong): "Олена Ткач — подруга"
    let what = match (t.kind, t.state) {
        (k, TieState::Quarrel) if k != TieKind::Colleagues && k != TieKind::Neighbours => l.pick("сьогодні не розмовляють", "not speaking today"),
        (TieKind::Couple, _) => {
            if f_other {
                l.pick("дружина", "wife")
            } else {
                l.pick("чоловік", "husband")
            }
        }
        (TieKind::Sweethearts, _) => l.pick("кохана людина", "sweetheart"),
        (TieKind::Courting, _) => l.pick("побачення вечорами", "evening dates"),
        (TieKind::Crush, _) if warmth >= Warmth::Close && t.admirer.as_deref() == Some(me.id.as_str()) => l.pick("таємне кохання", "a secret love"),
        (TieKind::Parted, _) => l.pick("нещодавно розійшлися", "recently split up"),
        (TieKind::Rivals, _) => l.pick("вічне змагання, чий город кращий", "a never-ending contest over whose garden is better"),
        (TieKind::Friends, _) => {
            if f_other {
                l.pick("подруга", "friend")
            } else {
                l.pick("друг", "friend")
            }
        }
        _ => return None,
    };
    Some(format!("{other} — {what}"))
}

use crate::core::{Core, CoreError};
use crate::event::EventKind;
use crate::storage::Storage;
use crate::time::WorldTime;

impl<S: Storage> Core<S> {
    /// Promises to someone that ran out (a quest of theirs taken and not done in time), in the last two months.
    fn missed_by(&self, now: WorldTime) -> BTreeMap<String, u32> {
        let day = now.day();
        let mut out: BTreeMap<String, u32> = BTreeMap::new();
        for (key, p) in &self.state().quests {
            if p.done {
                continue;
            }
            let Some(q) = self.quest_by_key(key) else { continue };
            if let Some(d) = q.deadline(p.started) {
                if day > d && day <= d + 60 {
                    *out.entry(q.giver.clone()).or_default() += 1;
                }
            }
        }
        out
    }

    /// How warm someone is with the player now.
    pub fn warmth(&self, now: WorldTime, id: &str) -> Warmth {
        let rel = self.state().relations.get(id);
        let missed = self.missed_by(now).get(id).copied().unwrap_or(0);
        let pts = rel.map_or(0, |r| effective_points(r, now.day(), missed));
        warmth_of(rel, pts)
    }

    fn ties_now(&self, now: WorldTime) -> Rc<Vec<Tie>> {
        let date = self.calendar().date(now);
        let first = self.calendar().first_day;
        let seed = self.meta().seed;
        self.with_town(now, |people, _| {
            let refs: Vec<&ResidentDef> = people.iter().collect();
            ties_cached(seed, first, &refs, date)
        })
    }

    /// How the town feels now: everyone's mood, the ties worth showing, how warm people are with the player,
    /// and the gossip.
    pub fn feelings_view(&self, now: WorldTime) -> FeelingsView {
        let lang = self.lang();
        let life = self.life_view(now);
        let seed = self.meta().seed;
        let date = self.calendar().date(now);
        let first = self.calendar().first_day;
        let sky = self.weather(now);
        let season = self.calendar().season(now);
        let info = crate::holidays::day_info(date);
        let minute = (now.0 % MINUTES_PER_DAY) as u32;
        let ties = self.ties_now(now);
        let missed = self.missed_by(now);
        let st = self.state();
        let player = st.player_name.clone();
        let people = self.town_people(now);
        let names: BTreeMap<String, String> = people.iter().map(|r| (r.id.clone(), r.name.clone())).collect();
        let by_id: BTreeMap<&str, &ResidentDef> = people.iter().map(|r| (r.id.as_str(), r)).collect();
        let site_of: BTreeMap<&str, &str> = life.residents.iter().map(|r| (r.id.as_str(), r.site.as_str())).collect();
        let mut mine: BTreeMap<&str, Vec<&Tie>> = BTreeMap::new();
        for t in ties.iter() {
            mine.entry(t.a.as_str()).or_default().push(t);
            mine.entry(t.b.as_str()).or_default().push(t);
        }
        let warmth_of_id = |id: &str| {
            let rel = st.relations.get(id);
            let pts = rel.map_or(0, |r| effective_points(r, now.day(), missed.get(id).copied().unwrap_or(0)));
            (warmth_of(rel, pts), rel.is_some_and(|r| r.last.is_some_and(|l| now.day() > l + 21 && r.points >= 150)))
        };
        let empty: Vec<&Tie> = Vec::new();
        let mut residents = Vec::new();
        let mut moods: BTreeMap<String, Mood> = BTreeMap::new();
        for r in &life.residents {
            let Some(def) = by_id.get(r.id.as_str()) else { continue };
            let my = mine.get(r.id.as_str()).unwrap_or(&empty);
            let (warmth, _) = warmth_of_id(&r.id);
            let input = MoodInput {
                id: &r.id,
                age: &def.age,
                temper: def.temper,
                social: def.social,
                activity: r.activity,
                life_mood: r.mood,
                sky,
                season,
                info: &info,
                birthday: crate::town::is_birthday(seed, &r.id, date),
                minute,
                ties: my,
                warmth,
            };
            let (mood, why) = mood_of(seed, date, &input);
            moods.insert(r.id.clone(), mood);
            let here = site_of.get(r.id.as_str());
            let together = |t: &&&Tie| site_of.get(t.other(&r.id)) == here && here.is_some();
            let with = my
                .iter()
                .find(|t| together(t) && (matches!(t.kind, TieKind::Courting | TieKind::Sweethearts) || (t.state == TieState::MadeUp && t.kind != TieKind::Colleagues)))
                .map(|t| t.other(&r.id).to_string());
            let cross = my.iter().filter(|t| t.state == TieState::Quarrel && t.kind != TieKind::Colleagues).map(|t| t.other(&r.id).to_string()).collect();
            let love = my
                .iter()
                .find(|t| matches!(t.kind, TieKind::Courting | TieKind::Sweethearts | TieKind::Couple) || (t.kind == TieKind::Crush && t.admirer.as_deref() == Some(r.id.as_str())))
                .map(|t| t.other(&r.id).to_string());
            residents.push(ResidentFeel { id: r.id.clone(), mood, why, with, cross, love });
        }
        let shown: Vec<Tie> = ties.iter().filter(|t| t.state != TieState::Fine || matches!(t.kind, TieKind::Couple | TieKind::Crush | TieKind::Courting | TieKind::Sweethearts | TieKind::Parted | TieKind::Rivals)).cloned().collect();
        let mut warmth = Vec::new();
        for (id, rel) in &st.relations {
            let Some(def) = by_id.get(id.as_str()) else { continue };
            if !rel.met && rel.points == 0 {
                continue;
            }
            let (level, faded) = warmth_of_id(id);
            let m = moods.get(id).copied().unwrap_or(Mood::Calm);
            let my = mine.get(id.as_str()).unwrap_or(&empty);
            let disliked = rel.tastes.values().any(|t| *t < 0);
            let n_missed = missed.get(id).copied().unwrap_or(0);
            // the people closest to them first; their friends the player learns of as they become friends too
            let rank = |t: &Tie| match (t.state, t.kind) {
                (TieState::Quarrel, _) => 0,
                (_, TieKind::Couple | TieKind::Sweethearts | TieKind::Courting | TieKind::Crush) => 1,
                (_, TieKind::Parted | TieKind::Rivals) => 2,
                _ => 3,
            };
            let mut mine_sorted: Vec<&&Tie> = my.iter().filter(|t| level >= Warmth::Warm || rank(t) <= 1).collect();
            mine_sorted.sort_by_key(|t| (rank(t), t.other(id).to_string()));
            let ppl: Vec<String> = mine_sorted
                .into_iter()
                .take(4)
                .filter_map(|t| {
                    let o = t.other(id);
                    let on = names.get(o).map(|x| x.as_str()).unwrap_or("");
                    tie_words(t, def, on, by_id.get(o).is_some_and(|d| d.gender == "f"), level, lang)
                })
                .collect();
            warmth.push(WarmthView {
                id: id.clone(),
                name: def.name.clone(),
                level,
                words: bond_words(def, level, faded, n_missed, disliked, lang),
                greet: greeting(seed, def, level, player.as_deref(), date, m, lang),
                confide: (level >= Warmth::Close).then(|| confidence(seed, def, my, &names, date, lang)),
                gift: kindness_today(seed, id, date, level) && !st.kindness.contains(&format!("{id}:{}", now.day())),
                faded,
                people: ppl,
                today: mood_word(m, def.gender == "f", lang).to_string(),
            });
        }
        let gossip = self.with_town(now, |people, _| {
            let refs: Vec<&ResidentDef> = people.iter().collect();
            let mut g = gossip(seed, first, &refs, date, lang);
            g.extend(gossip(seed, first, &refs, date - 1, lang));
            g
        });
        FeelingsView { residents, ties: shown, warmth, gossip }
    }

    /// A word with a resident of the town (the story's people have their own, in `Talk`): the first of the day
    /// warms them a little.
    pub(crate) fn plan_talk_resident(&self, now: WorldTime, who: &str) -> Result<Vec<EventKind>, CoreError> {
        if !self.with_town(now, |people, _| people.iter().any(|r| r.id == who)) {
            return Err(CoreError::UnknownNpc(who.to_string()));
        }
        if self.location() == "home" {
            return Err(CoreError::NotHere);
        }
        let rel = self.state().relations.get(who).cloned().unwrap_or_default();
        let today = now.day();
        let count = if rel.talk_day.0 == today && rel.talks > 0 { rel.talk_day.1 } else { 0 };
        if count >= crate::npc::TALKS_PER_DAY {
            return Err(CoreError::TooSoon);
        }
        let delta = if count > 0 { 0 } else { crate::npc::TALK_POINTS };
        Ok(vec![EventKind::NpcTalked { npc: who.to_string(), day: today, delta }])
    }

    /// Takes the little something a close friend has for the player today.
    pub(crate) fn plan_accept_gift(&self, now: WorldTime, who: &str) -> Result<Vec<EventKind>, CoreError> {
        let date = self.calendar().date(now);
        let def = self.with_town(now, |people, _| people.iter().find(|r| r.id == who).cloned()).ok_or_else(|| CoreError::UnknownNpc(who.to_string()))?;
        if self.location() == "home" {
            return Err(CoreError::NotHere);
        }
        let day = now.day();
        if self.state().kindness.contains(&format!("{who}:{day}")) {
            return Err(CoreError::AlreadyDone);
        }
        let level = self.warmth(now, who);
        if !kindness_today(self.meta().seed, who, date, level) {
            return Err(CoreError::NotToday);
        }
        // something of what they love themselves: a sweet, a flower, a fruit, a dish
        let (a, b, _) = crate::town::tastes(self.meta().seed, &def.id);
        let content = self.content();
        let small = |k: &'static str| content.items.values().filter(move |d| d.carry && !d.key && d.tags.iter().any(|t| t == k)).map(|d| d.id.clone());
        let mut options: Vec<String> = small(a).chain(small(b)).collect();
        if options.is_empty() {
            options = ["sweet", "flower", "fruit", "dish"].into_iter().flat_map(small).collect();
        }
        options.sort();
        options.dedup();
        let item = options.get(rand_below(self.meta().seed, FEEL_KIND, stream_of(who), day * 3 + 2, options.len().max(1) as u64) as usize).cloned().ok_or(CoreError::NoGift)?;
        let mut events = vec![EventKind::ResidentGave { who: who.to_string(), day, item: item.clone() }];
        events.extend(self.overflow(&[item], 0));
        Ok(events)
    }
}

/// Courting and sweetheart pairs going out tonight: (the other one, from, to) for someone, with where to go
/// left to the caller.
pub fn evening_out(seed: u64, first_day: i64, people: &[&ResidentDef], id: &str, date: i64) -> Option<String> {
    let me = people.iter().find(|r| r.id == id)?;
    if me.partner.is_some() || !(me.age == "adult" || me.age == "elder") {
        return None;
    }
    let rs = ROMANCES.with(|c| {
        let key = (seed, first_day, people_key(people));
        if let Some((k, v)) = c.borrow().as_ref() {
            if *k == key {
                return v.clone();
            }
        }
        let v = Rc::new(romances(seed, first_day, people));
        *c.borrow_mut() = Some((key, v.clone()));
        v
    });
    let r = rs.iter().find(|r| r.a == id || r.b == id)?;
    let (kind, _) = romance_on(r, date)?;
    date_night(seed, r, kind, date).then(|| if r.a == id { r.b.clone() } else { r.a.clone() })
}

thread_local! {
    static ROMANCES: RefCell<Option<((u64, i64, u64), Rc<Vec<Romance>>)>> = const { RefCell::new(None) };
}
