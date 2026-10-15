// The taxi priced like the ride-hailing apps: by the road and the minutes, with a pickup charge far from the
// stand, dearer when cars are scarce (rain, snow, the rush hours, the night, a feast, the races) and a touch
// cheaper on a quiet clear midday; the same on every device; old rides in the log still replay as they were.

use std::sync::Arc;

use teul_core::content::Content;
use teul_core::core::{taxi_destinations, taxi_fare, Command, Core, CoreError, NewWorld, TaxiDest};
use teul_core::daily::Sky;
use teul_core::ride::{quote, road_tiles, Demand};
use teul_core::storage::MemoryStorage;
use teul_core::time::WorldTime;

fn base() -> Content {
    Content::from_packs(&[include_str!("../../../content/base/pack.json")]).expect("the base pack is valid")
}

fn day(sky: Sky, hour: u32) -> Demand {
    Demand { sky, air: 120, minute: hour * 60 + 10, day_off: false, festival: None, holiday: None }
}

fn dest(c: &Content, id: &str) -> TaxiDest {
    taxi_destinations(c).into_iter().find(|d| d.id == id).unwrap()
}

const SQUARE: (&str, i32, i32) = ("village", 44, 22);

#[test]
fn rain_snow_and_storms_make_it_dearer() {
    let c = base();
    let to = dest(&c, "taxi.hostel");
    let fare = |d: &Demand| quote(&c, d, SQUARE, &to).unwrap();
    let cloudy = fare(&day(Sky::Cloudy, 13));
    let rain = fare(&day(Sky::Rain, 13));
    let snow = fare(&day(Sky::Snow, 13));
    let storm = fare(&day(Sky::Storm, 13));
    assert!(rain.fare > cloudy.fare, "{rain:?} vs {cloudy:?}");
    assert!(snow.fare > rain.fare && storm.fare > snow.fare);
    assert!(rain.why.starts_with("Дощ"), "{}", rain.why);
    assert_eq!(rain.trend, 1);
    assert!(rain.eta > cloudy.eta, "fewer cars: longer to wait");
    // a hard frost on top
    let frost = fare(&Demand { air: -120, ..day(Sky::Snow, 13) });
    assert!(frost.fare > snow.fare);
}

#[test]
fn the_rush_hours_and_the_night_cost_more_a_clear_midday_less() {
    let c = base();
    let to = dest(&c, "taxi.hostel");
    let q = |d: Demand| quote(&c, &d, SQUARE, &to).unwrap();
    let noon = q(day(Sky::Cloudy, 13));
    let morning = q(day(Sky::Cloudy, 8));
    let evening = q(day(Sky::Cloudy, 18));
    let night = q(day(Sky::Cloudy, 23));
    let small_hours = q(day(Sky::Cloudy, 2));
    assert!(morning.fare > noon.fare && morning.why.contains("пік"), "{morning:?}");
    assert!(evening.fare > noon.fare && evening.why.contains("додому"));
    assert!(night.fare > noon.fare && night.why.starts_with("Ніч"));
    assert_eq!(small_hours.fare, night.fare);
    // no rush on a day off
    assert_eq!(q(Demand { day_off: true, ..day(Sky::Cloudy, 8) }).fare, noon.fare);
    // a clear quiet midday: cars to spare
    let clear = q(day(Sky::Clear, 13));
    assert!(clear.fare < noon.fare, "{clear:?} vs {noon:?}");
    assert_eq!(clear.trend, -1);
    assert!(clear.why.contains("нижча"));
    assert_eq!(noon.trend, 0);
    assert!(noon.why.is_empty());
}

#[test]
fn feasts_and_the_races_bring_crowds() {
    let c = base();
    let to = dest(&c, "taxi.hostel");
    let plain = quote(&c, &day(Sky::Cloudy, 13), SQUARE, &to).unwrap();
    let feast = quote(&c, &Demand { festival: Some("Свято врожаю".into()), ..day(Sky::Cloudy, 13) }, SQUARE, &to).unwrap();
    assert!(feast.fare > plain.fare && feast.why.starts_with("Свято врожаю"));
    let hol = quote(&c, &Demand { holiday: Some("День Незалежності".into()), ..day(Sky::Cloudy, 13) }, SQUARE, &to).unwrap();
    assert!(hol.fare > plain.fare);
    // the racecourse while the races are on, and not after them
    let field = ("fields", 59, 26);
    let races = dest(&c, "taxi.hippodrome");
    let on = quote(&c, &day(Sky::Cloudy, 14), field, &races).unwrap();
    let off = quote(&c, &day(Sky::Cloudy, 21), field, &races).unwrap();
    assert!(on.why.contains("Перегони"), "{on:?}");
    assert!(!off.why.contains("Перегони"));
}

#[test]
fn far_from_the_stand_the_pickup_costs_more() {
    let c = base();
    let d = day(Sky::Cloudy, 13);
    // a short ride in the town and one as short deep in the forest
    let town_to = TaxiDest { id: "t".into(), name: "t".into(), location: "village".into(), x: 44, y: 42 };
    let forest_to = TaxiDest { id: "f".into(), name: "f".into(), location: "forest".into(), x: 100, y: 60 };
    let town = quote(&c, &d, SQUARE, &town_to).unwrap();
    let forest = quote(&c, &d, ("forest", 100, 40), &forest_to).unwrap();
    assert_eq!(town.tiles, forest.tiles);
    assert!(forest.fare > town.fare + 3, "{forest:?} vs {town:?}");
    assert!(forest.eta > town.eta);
    assert!(forest.why.starts_with("Далеко"), "{}", forest.why);
    // the road goes through the ways out between the maps
    assert!(road_tiles(&c, ("village", 44, 22), ("forest", 47, 89)).unwrap() > road_tiles(&c, ("village", 44, 22), ("village", 14, 1)).unwrap());
    assert!(road_tiles(&c, ("cafe_in", 5, 7), ("village", 10, 27)).is_some(), "from inside a building, out its door");
}

#[test]
fn the_price_follows_the_road_and_is_the_same_everywhere() {
    let c = base();
    let d = day(Sky::Rain, 18);
    let near = quote(&c, &d, SQUARE, &dest(&c, "taxi.church")).unwrap();
    let far = quote(&c, &d, SQUARE, &dest(&c, "taxi.vineyard")).unwrap();
    assert!(far.fare > near.fare && far.minutes > near.minutes);
    for to in taxi_destinations(&c) {
        let a = quote(&c, &d, SQUARE, &to).unwrap();
        let b = quote(&c, &d.clone(), SQUARE, &to.clone()).unwrap();
        assert_eq!(a, b);
        assert!(a.fare >= 5 && a.fare < 120 && a.eta >= 1 && a.eta <= 25, "{} {a:?}", to.id);
    }
}

#[test]
fn the_core_charges_the_price_shown_and_old_rides_replay_as_they_were() {
    let content = Arc::new(base());
    let mut core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 7, epoch_unix_secs: 0 }, content.clone()).unwrap();
    core.apply_all(WorldTime(600), Command::Travel { to: "village".into() }).unwrap();
    let to = core.taxi_dests(WorldTime(601)).into_iter().find(|d| d.id == "taxi.church").unwrap();
    // a ride logged before the taxi priced by demand: the old fare
    let old = taxi_fare(&content, ("village", 36, 24), &to).unwrap();
    let before = core.wallet().coins;
    core.apply_all(WorldTime(601), Command::TakeTaxi { to: "taxi.church".into(), from: "village".into(), x: 36, y: 24, fare: None }).unwrap();
    assert_eq!(core.wallet().coins, before - u64::from(old));
    // a ride now: the price shown is the price charged; a stale one is refused with the price now
    core.apply_all(WorldTime(602), Command::Travel { to: "village".into() }).unwrap();
    let q = core.taxi_quote(WorldTime(603), ("village", 36, 24), &to).unwrap();
    let wrong = core.apply_all(WorldTime(603), Command::TakeTaxi { to: "taxi.church".into(), from: "village".into(), x: 36, y: 24, fare: Some(q.fare + 1) });
    assert_eq!(wrong.err(), Some(CoreError::FareChanged { fare: q.fare }));
    let before = core.wallet().coins;
    core.apply_all(WorldTime(603), Command::TakeTaxi { to: "taxi.church".into(), from: "village".into(), x: 36, y: 24, fare: Some(q.fare) }).unwrap();
    assert_eq!(core.wallet().coins, before - u64::from(q.fare));
    let coins = core.wallet().coins;
    // the log replays to the same purse
    let again = Core::open_with(core.into_storage(), 1, content).unwrap();
    assert_eq!(again.wallet().coins, coins);
    assert_eq!(again.integrity().tampered, 0);
}

#[test]
fn rainy_minutes_cost_more_than_clear_ones_in_the_world() {
    let content = Arc::new(base());
    let core = Core::create_with(MemoryStorage::new(), 1, NewWorld { seed: 3, epoch_unix_secs: 0 }, content.clone()).unwrap();
    let to = dest(&content, "taxi.hostel");
    let at = |sky: Sky| (0..400u64).map(|d| WorldTime(d * 1440 + 13 * 60 + 5)).find(|t| core.weather(*t) == sky && core.taxi_demand(*t).holiday.is_none() && core.taxi_demand(*t).festival.is_none() && core.taxi_demand(*t).air > -80).unwrap();
    let rain = core.taxi_quote(at(Sky::Rain), SQUARE, &to).unwrap();
    let clear = core.taxi_quote(at(Sky::Clear), SQUARE, &to).unwrap();
    assert!(rain.fare > clear.fare, "{rain:?} vs {clear:?}");
}

#[test]
fn the_reasons_speak_english_in_english_and_the_fare_stays_the_same() {
    let uk = base();
    let en = Content::from_packs_in(&[include_str!("../../../content/base/pack.json")], Some(include_str!("../../../content/base/en.json"))).expect("the English overlay fits");
    let cyr = |s: &str| s.chars().any(|c| ('\u{0400}'..='\u{04ff}').contains(&c));
    let demands = [
        day(Sky::Rain, 13), day(Sky::Snow, 13), day(Sky::Storm, 13), day(Sky::Fog, 13), day(Sky::Cloudy, 8), day(Sky::Cloudy, 18),
        day(Sky::Cloudy, 23), day(Sky::Clear, 12), Demand { air: -120, ..day(Sky::Cloudy, 13) },
        Demand { festival: Some("Lypove Day".into()), ..day(Sky::Cloudy, 13) }, Demand { holiday: Some("Christmas".into()), ..day(Sky::Cloudy, 13) },
    ];
    for id in ["taxi.hostel", "taxi.hippodrome", "taxi.forest"] {
        let (Some(a), Some(b)) = (taxi_destinations(&uk).into_iter().find(|d| d.id == id), taxi_destinations(&en).into_iter().find(|d| d.id == id)) else { continue };
        for d in &demands {
            let (qu, qe) = (quote(&uk, d, SQUARE, &a).unwrap(), quote(&en, d, SQUARE, &b).unwrap());
            assert_eq!((qu.fare, qu.eta, qu.minutes, qu.trend), (qe.fare, qe.eta, qe.minutes, qe.trend));
            assert!(!cyr(&qe.why), "{}", qe.why);
            assert_eq!(qu.why.is_empty(), qe.why.is_empty());
        }
    }
}
