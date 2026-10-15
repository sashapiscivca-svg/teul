use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{Command, Core, CoreError, NewWorld};
use teul_core::storage::MemoryStorage;
use teul_core::time::WorldTime;

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

fn count(c: &Content, loc: &str, f: impl Fn(&str) -> bool) -> usize {
    c.locations[loc].props.iter().filter(|p| f(&p.item)).count()
}

#[test]
fn the_forest_is_bigger_and_has_a_cave_in_its_rocky_hill() {
    let c = base();
    let f = &c.locations["forest"];
    assert!(f.w * f.h >= 120 * 90, "{}x{}", f.w, f.h);
    assert!(count(&c, "forest", |i| i.starts_with("tree_")) >= 900);
    assert!(f.exits.iter().any(|e| e.to == "cave"));
    let cave = &c.locations["cave"];
    assert!(cave.underground);
    assert_eq!(cave.wall.as_deref(), Some("wall.rock"));
    // a cave is shaped by its rock: much of its rectangle is not floor at all
    let solid = cave.tiles.iter().flat_map(|r| r.chars()).filter(|&ch| cave.legend[&ch.to_string()] == "void").count();
    assert!(solid * 3 > (cave.w * cave.h) as usize, "the cave is a hollow in rock");
    assert!(count(&c, "cave", |i| i == "crystal") >= 4 && count(&c, "cave", |i| i == "glow_mushroom") >= 4);
    assert!(c.spots.values().any(|s| s.id.starts_with("cave.")), "something to find in the cave");
}

#[test]
fn the_farm_has_its_buildings_pens_and_animals() {
    let c = base();
    for item in ["barn", "silo", "cowshed", "chicken_coop", "tractor", "haystack", "trough"] {
        assert!(count(&c, "farm", |i| i == item) >= 1, "no {item} on the farm");
    }
    assert!(count(&c, "farm", |i| i == "farm_fence") >= 60, "pens are fenced");
    let kinds: std::collections::BTreeSet<_> = c.locations["farm"].animals.iter().map(|a| a.kind.as_str()).collect();
    for k in ["cow", "pig", "sheep", "chicken", "horse", "goose"] {
        assert!(kinds.contains(k), "no {k}s on the farm");
    }
    assert_eq!(c.site_location["farm"], "farm", "the farm's work is on the farm");
}

#[test]
fn the_racecourse_has_a_railed_track_and_stands() {
    let c = base();
    let h = &c.locations["hippodrome"];
    let track = h.tiles.iter().flat_map(|r| r.chars()).filter(|&ch| h.legend[&ch.to_string()] == "floor.dirt").count();
    assert!(track >= 250, "the track: {track} cells");
    assert!(count(&c, "hippodrome", |i| i == "rail_fence") >= 150);
    for item in ["grandstand", "judges_tower", "finish_post"] {
        assert_eq!(count(&c, "hippodrome", |i| i == item), 1, "{item}");
    }
    // a stable yard: a row of stables, and horses in the paddocks and on the infield
    assert!(count(&c, "hippodrome", |i| i == "stable") >= 4, "the stables");
    assert!(h.animals.iter().filter(|a| a.kind == "horse").map(|a| a.count).sum::<u32>() >= 12, "the horses");
    assert!((0..6).all(|i| c.items.contains_key(&format!("horse_rider_{i}"))));
}

#[test]
fn a_taxi_ride_costs_its_fare_and_needs_the_coins() {
    let content = Arc::new(base());
    assert!(content.taxi.len() >= 7);
    for loc in ["village", "fields", "hippodrome", "farm", "forest", "dump"] {
        assert!(content.taxi.values().any(|t| t.location == loc), "no taxi to the {loc}");
    }
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 2, epoch_unix_secs: 0 }, content.clone()).unwrap();
    // the taxi leaves from where the player is
    assert_eq!(core.apply_all(WorldTime(5), Command::TakeTaxi { to: "taxi.church".into(), from: "village".into(), x: 36, y: 24, fare: None }).err(), Some(CoreError::NotHere));
    core.apply_all(WorldTime(6), Command::Travel { to: "village".into() }).unwrap();
    // a ride across the village (a ride into a locked place is refused: the hippodrome wants a pass)
    assert!(matches!(core.apply_all(WorldTime(7), Command::TakeTaxi { to: "taxi.hippodrome".into(), from: "village".into(), x: 36, y: 24, fare: None }), Err(CoreError::Locked(_))));
    let ride = || Command::TakeTaxi { to: "taxi.church".into(), from: "village".into(), x: 36, y: 24, fare: None };
    let dest = teul_core::core::taxi_destinations(&content).into_iter().find(|d| d.id == "taxi.church").unwrap();
    let fare = teul_core::core::taxi_fare(&content, ("village", 36, 24), &dest).unwrap();
    let before = core.wallet().coins;
    core.apply_all(WorldTime(10), ride()).unwrap();
    assert_eq!(core.wallet().coins, before - u64::from(fare));
    assert!(core.apply_all(WorldTime(11), Command::TakeTaxi { to: "taxi.nowhere".into(), from: "village".into(), x: 0, y: 0, fare: None }).is_err());
    let mut t = 12;
    while core.apply_all(WorldTime(t), Command::Acquire { item: "stool".into() }).is_ok() {
        t += 1;
    }
    while core.wallet().coins >= u64::from(fare) {
        t += 1;
        core.apply_all(WorldTime(t), ride()).unwrap();
    }
    assert!(matches!(core.apply_all(WorldTime(t + 1), ride()), Err(CoreError::Locked(_))));
}

#[test]
fn the_cave_is_inside_the_mountain_and_the_forest_has_a_fire_lookout() {
    let c = base();
    let f = &c.locations["forest"];
    let m = f.props.iter().find(|p| p.item == "mountain").expect("a mountain");
    let mouth = f.props.iter().find(|p| p.item == "cave_mouth").unwrap();
    // the mouth stands at the foot of the mountain's face, inside its width
    assert!(mouth.x >= m.x && mouth.x + 3 <= m.x + 14 && mouth.y == m.y + 10, "the cave opens in the mountain");
    assert!(f.exits.iter().any(|e| e.to == "cave" && e.y == mouth.y + 2));
    assert_eq!(count(&c, "forest", |i| i == "fire_lookout"), 1);
}

#[test]
fn a_vineyard_with_a_winery_and_a_new_street_with_a_vet_a_gym_and_a_bar() {
    let c = base();
    assert!(count(&c, "vineyard", |i| i == "grapevine") >= 400);
    for site in ["winery_site", "vet_site", "gym_site", "bar_site"] {
        assert!(c.sites.contains_key(site), "{site}");
        assert!(c.locations.values().any(|l| l.inside.as_deref() == Some(site)), "{site} has no inside");
    }
    assert_eq!(c.site_location["winery_site"], "vineyard");
    assert!(c.residents.values().any(|r| r.job.as_ref().is_some_and(|(_, role)| role == "bartender")));
    assert!(count(&c, "village", |i| i == "bike_stand") >= 2, "bicycles to hire");
    assert!(c.items.contains_key("cyclist") && c.items.contains_key("bicycle"));
    assert!(c.taxi.values().any(|t| t.location == "vineyard"));
}


#[test]
fn the_taxi_goes_anywhere_and_charges_by_how_far() {
    use teul_core::core::{taxi_destinations, taxi_fare};
    let c = base();
    let all = taxi_destinations(&c);
    // each place once: a stand by a building stands for its door (the site's own stop is dropped then)
    let find = |site: &str| -> &teul_core::core::TaxiDest {
        let s = &c.sites[site];
        let loc = &c.site_location[site];
        all.iter()
            .find(|d| d.id == format!("site:{site}") || (d.location == *loc && (d.name == s.name || (d.x - s.x).abs() + (d.y - s.y).abs() <= 4)))
            .unwrap_or_else(|| panic!("the taxi cannot go to {site}"))
    };
    for site in ["church_site", "hostel_site", "bread_factory_site", "winery_site", "creamery_site", "cemetery_site"] {
        find(site);
    }
    assert!(all.iter().any(|d| d.id == "taxi.cave"));
    assert!(!all.iter().any(|d| d.id.starts_with("site:home")), "nobody's home is a taxi stop");
    let fare = |from: (&str, i32, i32), to: &teul_core::core::TaxiDest| taxi_fare(&c, from, to).unwrap();
    let stand = |id: &str| all.iter().find(|d| d.id == id).unwrap();
    // from the square: the church across the street costs little, the racecourse beyond the field more, the
    // vineyard beyond the farm more still than the farm
    let square = ("village", 36, 24);
    assert!(fare(square, find("church_site")) < fare(square, stand("taxi.hippodrome")));
    assert!(fare(square, stand("taxi.farm")) < fare(square, find("winery_site")));
    // from anywhere to anywhere
    for from in ["village", "forest", "fields", "hippodrome", "farm", "vineyard", "dump", "cemetery", "cave"] {
        for d in &all {
            assert!(taxi_fare(&c, (from, 1, 1), d).is_some_and(|f| f <= 40), "no ride from {from} to {}", d.id);
        }
    }
}

#[test]
fn the_cemetery_fills_over_the_years() {
    let c = base();
    let graves = |day: u32| c.locations["cemetery"].props.iter().filter(|p| p.item.starts_with("grave_") && p.min_day <= day).count();
    assert!(graves(0) >= 20, "old graves from the start");
    assert!(graves(60) > graves(0) && graves(365) > graves(60), "{} {} {}", graves(0), graves(60), graves(365));
}
