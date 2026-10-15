//! «Липовий вісник»'s stories and where they come from.
//!
//! A story is a headline, a line or two, and a photo hint: where the photo is taken (a location, a spot on it,
//! things and people that should be in the frame, the hour). The client renders the photo from the real scene and
//! prints it in the paper's grainy duotone. Stories come from *providers*: plain functions of the world and the
//! day, listed in [`providers`]. A new part of the world adds its stories by writing one such function and adding
//! it to that list — the paper sorts them by weight, takes the front page and a few more.
//!
//! ```ignore
//! fn my_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> { ... }
//! // in providers(): vec![..., my_stories::<S>]
//! ```

use serde::Serialize;

use crate::core::Core;
use crate::economy::PaperStory;
use crate::storage::Storage;
use crate::time::{WorldTime, MINUTES_PER_DAY};

/// Where a story's photo is taken. Everything but the place is optional.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct PhotoHint {
    /// A location id (`village`, `fields`, `church_in`…); "home" for the player's own home.
    pub place: String,
    /// The spot the camera looks at (a cell of that location); none: the first of `props`, else the middle.
    pub at: Option<(i32, i32)>,
    /// Things that should be in the frame (item ids): the camera finds the first on the map; any that are not
    /// there are stood near the spot for the picture (placards, a stall, a cake).
    pub props: Vec<String>,
    /// Residents (ids) standing in the frame.
    pub people: Vec<String>,
    /// The minute of the day the photo is taken at (the light); none: midday.
    pub minute: Option<u32>,
    /// A wide shot towards the horizon (what is far off: the plant's cranes).
    pub far: bool,
}

impl PhotoHint {
    pub fn at(place: &str) -> Self {
        PhotoHint { place: place.to_string(), ..Default::default() }
    }
    pub fn with(mut self, props: &[&str]) -> Self {
        self.props.extend(props.iter().map(|s| s.to_string()));
        self
    }
    pub fn spot(mut self, x: i32, y: i32) -> Self {
        self.at = Some((x, y));
        self
    }
    pub fn people(mut self, ids: &[String]) -> Self {
        self.people.extend(ids.iter().cloned());
        self
    }
    pub fn hour(mut self, minute: u32) -> Self {
        self.minute = Some(minute);
        self
    }
    pub fn far(mut self) -> Self {
        self.far = true;
        self
    }
}

/// One story of a day's paper.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Story {
    /// Stable within the day (for the client's photo cache): e.g. "npp:announced", "life:Fire:1234".
    pub id: String,
    /// The world day of the paper it belongs to.
    pub day: u64,
    /// How much it matters for the front page (higher first): births/deaths 12, a wedding 11, a fire 9, a feast 8…
    pub weight: u32,
    pub headline: String,
    /// One or two short sentences.
    pub text: String,
    pub photo: Option<PhotoHint>,
}

impl Story {
    pub fn new(id: impl Into<String>, day: u64, weight: u32, headline: impl Into<String>, text: impl Into<String>) -> Self {
        Story { id: id.into(), day, weight, headline: headline.into(), text: text.into(), photo: None }
    }
    pub fn photo(mut self, p: PhotoHint) -> Self {
        self.photo = Some(p);
        self
    }
    pub fn into_paper(self) -> PaperStory {
        PaperStory { title: self.headline, text: self.text, photo: self.photo, id: self.id }
    }
}

/// A source of stories: the world and the paper's moment (the day's first minute or later) → that day's stories.
pub type StoryProvider<S> = fn(&Core<S>, WorldTime) -> Vec<Story>;

/// Every source of the paper's stories. Add new ones here.
pub fn providers<S: Storage>() -> Vec<StoryProvider<S>> {
    vec![life_stories::<S>, town_stories::<S>, holiday_stories::<S>, npp_stories::<S>, driver_stories::<S>, sky_stories::<S>]
}

/// The player on the road: a licence, a fine, a night in the cell (drive.rs), from the day before.
fn driver_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let day = now.day();
    core.driver_stories(day)
        .into_iter()
        .enumerate()
        .map(|(k, s)| {
            let place = if s.photo.ends_with("_site") || s.photo.is_empty() { "village".to_string() } else { s.photo.clone() };
            Story::new(format!("drive:{day}:{k}"), day, s.weight, s.headline, s.text).photo(PhotoHint::at(&place))
        })
        .collect()
}

/// The sky's own news: an eclipse, a meteor night, a comet, the visitors and their cow, the rifts (sky.rs).
fn sky_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let day = now.day();
    let date = core.calendar().date(now);
    crate::sky::stories_in(core.meta().seed, date, core.lang())
        .into_iter()
        .map(|s| Story::new(s.id, day, s.weight, s.headline, s.text).photo(PhotoHint::at(&s.photo.place).hour(s.photo.minute)))
        .collect()
}

/// All of a day's stories, the weightiest first (ties: in the providers' order).
pub fn stories_of<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let mut all: Vec<Story> = providers::<S>().into_iter().flat_map(|p| p(core, now)).collect();
    all.sort_by(|a, b| b.weight.cmp(&a.weight));
    all
}

/// The door of a site of the village (by its id), for a photo of what happened there.
fn site_spot<S: Storage>(core: &Core<S>, site: &str) -> Option<(i32, i32)> {
    core.content().sites.get(site).map(|s| (s.x, s.y))
}

/// The first site of a kind (the church, the hospital, the square).
fn kind_spot<S: Storage>(core: &Core<S>, kind: &str) -> Option<(i32, i32)> {
    core.content().sites.values().find(|s| s.kind == kind).map(|s| (s.x, s.y))
}

/// Yesterday's happenings in town (fires, thefts, quarrels, parties…), each at its place.
fn life_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let day = now.day();
    if day == 0 || core.content().residents.is_empty() {
        return Vec::new();
    }
    let life = core.life_view(WorldTime(day * MINUTES_PER_DAY));
    let from = (day - 1) * MINUTES_PER_DAY;
    life.news
        .iter()
        .filter(|n| n.minute >= from && n.minute < day * MINUTES_PER_DAY)
        .map(|n| {
            let mut photo = PhotoHint::at("village").hour((n.minute % MINUTES_PER_DAY) as u32);
            photo.at = site_spot(core, &n.site);
            if matches!(n.kind, crate::life::IncidentKind::DumpFull | crate::life::IncidentKind::DumpCleared) {
                photo = PhotoHint::at("dump");
            }
            Story::new(format!("life:{:?}:{}", n.kind, n.minute), day, crate::economy::news_weight(n.kind), crate::economy::news_title(n.kind, core.lang()), n.text.clone()).photo(photo)
        })
        .collect()
}

/// The town's own news (who was born, came, left; a wedding; what was built; a shop opened).
fn town_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let day = now.day();
    let (stories, _, _) = core.town_paper(now);
    stories
        .into_iter()
        .enumerate()
        .map(|(i, (w, s))| {
            // by the story's kind (in its id), never by its words
            let photo = match s.id.as_str() {
                "wedding" => PhotoHint { at: kind_spot(core, "church"), ..PhotoHint::at("village").with(&["church"]) },
                "born" => PhotoHint::at("hospital_in"),
                "passed" => PhotoHint::at("cemetery").hour(17 * 60),
                "arrived" => PhotoHint::at("village").with(&["sign_for_sale"]),
                "left" => PhotoHint::at("village").with(&["bus_stop"]),
                "built" => PhotoHint::at("village").with(&["town_hall"]),
                "opened" => PhotoHint::at("village").with(&["fountain"]),
                _ => PhotoHint::at("village").with(&["fountain"]),
            };
            Story::new(format!("town:{i}"), day, w, s.title, s.text).photo(photo)
        })
        .collect()
}

/// A celebration: the days of getting ready, the day itself, the clean-up — each with a photo.
fn holiday_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    use crate::festival::{festival_at, prep_story, Phase};
    let day = now.day();
    let date = core.calendar().date(now);
    let mut out = Vec::new();
    let today = crate::holidays::holiday(date).filter(|h| h.festive);
    if let Some((headline, text, place, props, minute)) = today.and_then(|h| feast_story(h.id)) {
        let (headline, text) = if core.lang().en() { today.and_then(|h| feast_words_en(h.id)).unwrap_or((headline, text)) } else { (headline, text) };
        let mut photo = PhotoHint::at(place).with(props);
        if let Some(m) = minute {
            photo = photo.hour(m);
        }
        out.push(Story::new(format!("feast:{}", today.map(|h| h.id).unwrap_or_default()), day, 8, headline, text).photo(photo));
    }
    match festival_at(date) {
        // every other day of the getting ready, and always the day before
        Some(f) if f.phase == Phase::Prep && (f.days_left % 2 == 1 || f.days_left == 1) => {
            if let Some((headline, text)) = prep_story(f.id, core.lang()) {
                let props: &[&str] = feast_story(f.id).map(|s| s.3).unwrap_or(&[]);
                out.push(Story::new(format!("prep:{}:{}", f.id, f.days_left), day, 6, headline, text).photo(PhotoHint::at("village").with(&["stage_frame"]).with(props)));
            }
        }
        Some(f) if f.phase == Phase::After => {
            out.push(
                if core.lang().en() {
                    Story::new(format!("after:{}", f.id), day, 5, format!("After the feast: {}", crate::holidays::name_in(f.id, core.lang())), "Street sweepers and volunteers were cleaning the square from first light. Thank you to everyone who came!")
                } else {
                    Story::new(format!("after:{}", f.id), day, 5, format!("Після свята: {}", f.name), "Двірники й волонтери прибирали площу з самого ранку. Дякуємо всім, хто прийшов!")
                }
                    .photo(PhotoHint::at("village").with(&["rubbish_bags", "fountain"]).hour(8 * 60)),
            );
        }
        _ => {}
    }
    out
}

/// A celebration's headline and line in English.
fn feast_words_en(id: &str) -> Option<(&'static str, &'static str)> {
    Some(match id {
        "new_year" => ("Happy New Year, Lypove!", "Fireworks over the town hall and dancing round the tree till morning."),
        "lunar_new_year" => ("The Dragon came down the main street", "Twenty dancers carried a red dragon, and firecrackers popped until evening. Sesame balls and rice cakes at the stalls."),
        "valentine" => ("Hearts on the square", "An arch of hearts by the fountain, and “Pivonia” has run out of tulips."),
        "womens_day" => ("Flowers for everyone", "Mimosa and tulips by the town hall. The longest queue is at the flower stall."),
        "spring_carnival" => ("The carnival saw winter off", "Masks, drums and confetti. The straw Winter was solemnly sent into retirement."),
        "april_fools" => ("The fountain is running cocoa", "Or so the postman says. Don't believe anyone today — not even the Herald."),
        "earth_day" => ("Earth Day clean-up", "Half the town came out with rakes: they cleaned the park and planted lindens along the river."),
        "mothers_day" => ("Mother's Day", "Children drew cards for their mums, and there's a tulip stall by the town hall."),
        "flower_festival" => ("Flower Festival", "The main street is full of tulips and lilac. The best flower bed belongs to the lady in the little blue house."),
        "last_bell" => ("The Last Bell", "The school leavers walked from the school to the square. The teachers cried — for joy."),
        "childrens_day" => ("Children's Day", "Balloons, ice cream and chalk drawings all over the square."),
        "kupala" => ("Midsummer Night", "Bonfires by the river, wreaths on the water and music until dawn."),
        "town_day" => ("Lypove Day", "The lindens on the square are in bloom and the air smells of honey. A stage, a fair, and fireworks at midnight."),
        "summer_end" => ("Goodbye, Summer", "Cinema under the stars on the square: blankets, popcorn and applause for the credits."),
        "knowledge_day" => ("The First of September", "First-graders with bouquets bigger than themselves."),
        "harvest_fair" => ("Harvest Fair", "Giant pumpkins, honey, cider and a contest for the biggest marrow."),
        "halloween" => ("Pumpkins on the porches", "Children went from house to house for sweets. The scariest costume was Tymko's."),
        "lantern_night" => ("Lantern Night", "Children walked with paper lanterns from the school to the square, and the bakery handed out crescent rolls."),
        "winter_lights" => ("The winter lights are on", "A thousand bulbs on the square, cocoa with cinnamon and a skating rink by the fountain."),
        "new_year_eve" => ("New Year's Eve", "The tree is lit and the salad is ready. At midnight — out to the square for the fireworks!"),
        _ => return None,
    })
}

/// Each celebration's story: (headline, a line, where the photo is taken, what is in it, the hour).
#[allow(clippy::type_complexity)]
pub fn feast_story(id: &str) -> Option<(&'static str, &'static str, &'static str, &'static [&'static str], Option<u32>)> {
    Some(match id {
        "new_year" => ("З Новим роком, Липове!", "Салют над ратушею, танці біля ялинки до ранку.", "village", &["festive_tree"], Some(17 * 60)),
        "lunar_new_year" => ("Дракон пройшов головною вулицею", "Двадцять танцюристів несли червоного дракона, хлопавки тріщали до вечора. У ятках — кунжутні кульки й рисові пиріжки.", "village", &["dragon_head", "red_lanterns"], Some(13 * 60)),
        "valentine" => ("Серця на площі", "Арка з сердець біля фонтана, у «Півонії» скінчилися тюльпани.", "village", &["heart_arch"], None),
        "womens_day" => ("Квіти для всіх", "Біля ратуші — мімоза й тюльпани. Найдовша черга — до квіткової ятки.", "village", &["flower_stand"], None),
        "spring_carnival" => ("Карнавал провів зиму", "Маски, барабани й конфеті. Солом'яну зиму урочисто відправили на пенсію.", "village", &["town_stage", "bunting", "balloons"], Some(15 * 60)),
        "april_fools" => ("Фонтан пустив какао", "Принаймні так сказав листоноша. Не вірте сьогодні нікому — навіть «Віснику».", "village", &["fountain", "balloons"], None),
        "earth_day" => ("Толока на День Землі", "Пів міста з граблями: прибрали парк і посадили липи вздовж річки.", "village", &["toloka_heap", "sapling"], None),
        "mothers_day" => ("День матері", "Діти намалювали мамам листівки, біля ратуші — ятка з тюльпанами.", "village", &["flower_stand"], None),
        "flower_festival" => ("Фестиваль квітів", "Головна вулиця в тюльпанах і бузку. Найкращий квітник — у пані з синього будиночка.", "village", &["flower_arch", "flower_stand"], None),
        "last_bell" => ("Останній дзвоник", "Випускники пройшли від школи до площі. Учителі плакали — від щастя.", "village", &["school", "bunting"], Some(10 * 60)),
        "childrens_day" => ("День захисту дітей", "Повітряні кульки, морозиво й крейдяні малюнки на всій площі.", "village", &["balloons", "bunting"], None),
        "kupala" => ("Ніч середини літа", "Вогнища біля річки, вінки на воді й музика до світанку.", "village", &["kupala_fire"], Some(21 * 60 + 30)),
        "town_day" => ("День Липового", "Липи на площі цвітуть, пахне медом. Сцена, ярмарок, а опівночі — салют.", "village", &["town_stage", "bunting"], Some(18 * 60)),
        "summer_end" => ("Прощавай, літо", "Кіно під зорями на площі: пледи, попкорн і оплески титрам.", "village", &["cinema_screen"], Some(21 * 60)),
        "knowledge_day" => ("Перше вересня", "Першокласники з букетами більшими за них самих.", "village", &["school", "bunting"], Some(9 * 60)),
        "harvest_fair" => ("Ярмарок урожаю", "Гарбузи-велетні, мед, сидр і конкурс на найбільший кабачок.", "village", &["harvest_stall", "bunting"], None),
        "halloween" => ("Гарбузи на ґанках", "Діти ходили від хати до хати за цукерками. Найстрашніший костюм — у Тимка.", "village", &["pumpkin_lantern"], Some(19 * 60)),
        "lantern_night" => ("Ніч ліхтариків", "Діти пройшли з паперовими ліхтариками від школи до площі, а в пекарні роздавали рогалики.", "village", &["lantern_post"], Some(17 * 60 + 30)),
        "winter_lights" => ("Засвітилися зимові вогні", "Тисяча лампочок на площі, какао з корицею й ковзанка біля фонтана.", "village", &["garland_arch", "festive_tree"], Some(17 * 60 + 30)),
        "new_year_eve" => ("Новорічна ніч", "Ялинка світиться, олів'є готове. Опівночі — на площу, салют!", "village", &["festive_tree", "garland_arch"], Some(22 * 60)),
        _ => return None,
    })
}

/// The plant's story: its news on the day a step begins, and the building on the horizon.
fn npp_stories<S: Storage>(core: &Core<S>, now: WorldTime) -> Vec<Story> {
    let day = now.day();
    let date = core.calendar().date(now);
    let Some(v) = crate::npp::npp_at(date) else { return Vec::new() };
    // told on its first day, and on the next (the paper is read the morning after)
    if date - v.since > 1 {
        return Vec::new();
    }
    let Some((headline, text)) = crate::npp::npp_story_in(v.id, core.lang()) else { return Vec::new() };
    let photo = match v.id {
        "hearing" | "debate" => PhotoHint::at("townhall_in").hour(18 * 60 + 30),
        "protest" => PhotoHint::at("village").with(&["protest_placards", "fountain"]),
        "rumour" => PhotoHint::at("fields").with(&["drill_rig"]),
        "announced" | "approved" => PhotoHint::at("village").with(&["town_hall"]),
        "workers" => PhotoHint::at("village").with(&["hostel"]),
        _ => PhotoHint::at("fields").far().hour(if v.id == "cranes" { 19 * 60 + 30 } else { 13 * 60 }),
    };
    let weight = if date == v.since { 10 } else { 7 };
    vec![Story::new(format!("npp:{}", v.id), day, weight, headline, text).photo(photo)]
}
