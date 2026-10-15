#![allow(dead_code)]
use teul_core::content::Content;

pub const PACK: &str = include_str!("pack.json");

pub fn content() -> Content {
    Content::from_packs(&[PACK]).expect("the test pack is valid")
}

pub const ECONOMY: &str = include_str!("economy.json");

/// The base test pack and a small world with a pocket, places to use, help and a locked cave.
pub fn economy() -> Content {
    Content::from_packs(&[PACK, ECONOMY]).expect("the economy pack is valid")
}

/// 2026-10-10, local midnight in Kyiv: world day 0 is an autumn Saturday.
pub const AUTUMN_EPOCH: i64 = 20_736 * 86_400 - 3 * 3_600;

pub const HOME: &str = include_str!("home.json");

/// The base test pack and a home with a fridge, a stove, a bath and the utility bills.
pub fn home() -> Content {
    Content::from_packs(&[PACK, HOME]).expect("the home pack is valid")
}

pub const WORK: &str = include_str!("work.json");

/// The base and home test packs and a café to work at, plots and plants, an easel and a piano.
pub fn work() -> Content {
    Content::from_packs(&[PACK, HOME, WORK]).expect("the work pack is valid")
}

pub const STYLE: &str = include_str!("style.json");

/// The home pack and clothes, a salon, homes to rent or buy, and a plot to rent.
pub fn style() -> Content {
    Content::from_packs(&[PACK, HOME, STYLE]).expect("the style pack is valid")
}

pub const CRAFT: &str = include_str!("craft.json");

/// The home pack and materials, tools, a workbench, things that age and what can be made.
pub fn craft() -> Content {
    Content::from_packs(&[PACK, HOME, CRAFT]).expect("the craft pack is valid")
}

pub const MEDIA: &str = include_str!("media.json");

/// The work pack with a carried violin, sheet music and two pieces.
pub fn media() -> Content {
    Content::from_packs(&[PACK, HOME, WORK, MEDIA]).expect("the media pack is valid")
}
