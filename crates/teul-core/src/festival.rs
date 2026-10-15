//! The town's big celebrations as they really go: a few days of getting ready (stalls and a stage put up, garlands
//! hung day by day, posters, people shopping, cooking and rehearsing, children making lanterns), the day itself
//! (or two) at full scale, and the clean-up the morning after. All from the real calendar, the same for everyone.

use serde::Serialize;

use crate::holidays::{date_of, name_of};
use crate::time::civil_from_days;

/// The big ones: (holiday id, days of getting ready, days it lasts).
pub const BIG: &[(&str, u8, u8)] = &[
    ("lunar_new_year", 5, 1),
    ("valentine", 3, 1),
    ("womens_day", 2, 1),
    ("spring_carnival", 4, 1),
    ("earth_day", 3, 1),
    ("flower_festival", 5, 1),
    ("childrens_day", 3, 1),
    ("kupala", 4, 1),
    ("town_day", 7, 1),
    ("summer_end", 4, 1),
    ("harvest_fair", 5, 1),
    ("halloween", 6, 1),
    ("lantern_night", 5, 1),
    ("winter_lights", 6, 1),
    // the New Year's night and the day after it
    ("new_year_eve", 7, 2),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    /// Getting ready: `days_left` to the day.
    Prep,
    /// The day itself.
    Day,
    /// The morning after: clearing up.
    After,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct FestivalView {
    pub id: &'static str,
    pub name: &'static str,
    pub phase: Phase,
    /// Days to the day (getting ready), 0 on it and after it.
    pub days_left: u8,
    /// How far the getting ready has gone, in thousandths (1000 on the day).
    pub ready: u16,
}

/// The celebration a day belongs to, if any: the one being held, else the one just over (its clean-up), else the
/// nearest one being got ready for.
pub fn festival_at(day: i64) -> Option<FestivalView> {
    let (y, _, _) = civil_from_days(day);
    let mut best: Option<(i64, FestivalView)> = None;
    for year in [y - 1, y, y + 1] {
        for &(id, prep, len) in BIG {
            let Some(first) = date_of(id, year) else { continue };
            let last = first + i64::from(len) - 1;
            let (rank, view) = if day >= first && day <= last {
                (0, FestivalView { id, name: name_of(id), phase: Phase::Day, days_left: 0, ready: 1000 })
            } else if day == last + 1 {
                (1, FestivalView { id, name: name_of(id), phase: Phase::After, days_left: 0, ready: 1000 })
            } else if day < first && first - day <= i64::from(prep) {
                let left = (first - day) as u8;
                let ready = ((u32::from(prep) + 1 - u32::from(left)) * 1000 / (u32::from(prep) + 1)) as u16;
                (2 + i64::from(left), FestivalView { id, name: name_of(id), phase: Phase::Prep, days_left: left, ready })
            } else {
                continue;
            };
            if best.as_ref().is_none_or(|(r, _)| rank < *r) {
                best = Some((rank, view));
            }
        }
    }
    best.map(|(_, v)| v)
}

/// What the paper writes while the town gets ready: (headline, a line).
pub fn prep_story(id: &str, l: crate::content::Lang) -> Option<(&'static str, &'static str)> {
    if l.en() {
        return prep_story_en(id);
    }
    Some(match id {
        "lunar_new_year" => ("Липове чекає Дракона", "Червоні ліхтарики вже на вулиці, у пекарні вчаться ліпити кунжутні кульки. Танцюристи репетирують з драконом."),
        "valentine" => ("Серця по всьому місту", "У «Півонії» замовили втричі більше тюльпанів, на площі збирають арку з сердець."),
        "womens_day" => ("Квіти вже в дорозі", "Квіткова ятка біля ратуші відкриється раніше, а в «Липі» печуть торти."),
        "spring_carnival" => ("Карнавал близько", "Шиють маски й костюми, на площі ставлять сцену. Зиму проводжатимуть з музикою."),
        "earth_day" => ("Толока на День Землі", "Ратуша роздає граблі й мішки, у розсаднику чекають саджанці лип."),
        "flower_festival" => ("Місто в квітах", "Городники несуть розсаду на площу, вздовж головної вулиці вже стоять ятки."),
        "childrens_day" => ("Свято для малечі", "Готують кульки, крейду й морозиво. Вчителі репетирують ляльковий театр."),
        "kupala" => ("Вогнища до ночі середини літа", "Біля річки складають хмиз, дівчата вчаться плести вінки з польових квітів."),
        "town_day" => ("Липове готується до свого дня", "На площі будують сцену, протягують гірлянди, а оркестр репетирує щовечора."),
        "summer_end" => ("Кіно під зорями", "На площі натягують великий екран. Голосування за фільм — у бібліотеці."),
        "harvest_fair" => ("Ярмарок урожаю скоро", "Фермери возять гарбузи й мед, будують ятки вздовж вулиці."),
        "halloween" => ("Гарбузів не вистачає", "Діти вирізають ліхтарі, у крамниці «Льон» розкупили фарбу для костюмів."),
        "lantern_night" => ("Ліхтарики сохнуть на вікнах", "Діти клеять паперові ліхтарики в школі й бібліотеці. Хода — одинадцятого увечері."),
        "winter_lights" => ("Місто вдягає вогні", "Електрики щодня вішають нові гірлянди, на площі ставлять ялинку й ятки з какао."),
        "new_year_eve" => ("Новий рік на порозі", "Ялинка на площі, черги в пекарні, на ратуші — салют, що чекає опівночі."),
        _ => return None,
    })
}

fn prep_story_en(id: &str) -> Option<(&'static str, &'static str)> {
    Some(match id {
        "lunar_new_year" => ("Lypove awaits the Dragon", "Red lanterns are already up along the street, and the bakery is learning to roll sesame balls. The dancers are rehearsing with the dragon."),
        "valentine" => ("Hearts all over town", "“Pivonia” has ordered three times the usual tulips, and an arch of hearts is going up on the square."),
        "womens_day" => ("Flowers on their way", "The flower stall by the town hall will open early, and “Lypa” is baking cakes."),
        "spring_carnival" => ("Carnival is coming", "Masks and costumes are being sewn and a stage is going up on the square. Winter will be seen off with music."),
        "earth_day" => ("Earth Day clean-up", "The town hall is handing out rakes and bags, and the nursery has linden saplings waiting."),
        "flower_festival" => ("A town in bloom", "Gardeners are carrying seedlings to the square, and stalls already line the main street."),
        "childrens_day" => ("A day for the little ones", "Balloons, chalk and ice cream are being got ready. The teachers are rehearsing a puppet show."),
        "kupala" => ("Bonfires till midsummer night", "Brushwood is piling up by the river, and girls are learning to weave wreaths of wildflowers."),
        "town_day" => ("Lypove gets ready for its day", "A stage is going up on the square, garlands are being strung, and the band rehearses every evening."),
        "summer_end" => ("Cinema under the stars", "A big screen is being stretched across the square. Vote for the film at the library."),
        "harvest_fair" => ("The harvest fair is near", "Farmers are bringing in pumpkins and honey and building stalls along the street."),
        "halloween" => ("Not enough pumpkins", "Children are carving lanterns, and the paint for costumes has sold out at “Lon”."),
        "lantern_night" => ("Lanterns drying in the windows", "Children are gluing paper lanterns at school and in the library. The procession is on the eleventh, in the evening."),
        "winter_lights" => ("The town puts on its lights", "Electricians hang new garlands every day, and a tree and cocoa stalls are going up on the square."),
        "new_year_eve" => ("The New Year is at the door", "A tree on the square, queues at the bakery, and fireworks on the town hall waiting for midnight."),
        _ => return None,
    })
}

impl<S: crate::storage::Storage> crate::core::Core<S> {
    /// The celebration the day of `now` belongs to (getting ready, the day, the clean-up).
    pub fn festival_view(&self, now: crate::time::WorldTime) -> Option<FestivalView> {
        festival_at(self.calendar().date(now)).map(|f| FestivalView { name: crate::holidays::name_in(f.id, self.lang()), ..f })
    }
}
