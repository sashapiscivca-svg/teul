use teul_core::holidays::rift_day;
use teul_core::sky::{next_date, rift_world, sky_view, stories, RIFT_WORLDS};
use teul_core::time::{days_from_civil, Calendar, WorldTime, MINUTES_PER_DAY};

fn d(y: i64, m: u32, day: u32) -> i64 {
    days_from_civil(y, m, day)
}

/// A calendar whose first world day is 2020-01-01, and the world time of a date and minute in it.
fn cal() -> Calendar {
    Calendar { first_day: d(2020, 1, 1) }
}
fn at(date: i64, minute: u64) -> WorldTime {
    WorldTime((date - cal().first_day) as u64 * MINUTES_PER_DAY + minute)
}

#[test]
fn each_rift_day_opens_its_own_world() {
    assert_eq!(rift_world(d(2026, 3, 20)), Some("rift_spring"));
    assert_eq!(rift_world(d(2026, 6, 21)), Some("rift_summer"));
    assert_eq!(rift_world(d(2026, 9, 23)), Some("rift_autumn"));
    assert_eq!(rift_world(d(2026, 12, 21)), Some("rift_winter"));
    assert_eq!(rift_world(d(2026, 12, 22)), None);
    // every rift day has exactly one world, and the four come in a year
    let year: Vec<_> = (d(2031, 1, 1)..d(2032, 1, 1)).filter_map(rift_world).collect();
    assert_eq!(year, RIFT_WORLDS.to_vec());
    for day in d(2025, 1, 1)..d(2027, 1, 1) {
        assert_eq!(rift_day(day), rift_world(day).is_some());
    }
}

#[test]
fn the_eclipse_of_august_2026_darkens_the_evening() {
    let day = d(2026, 8, 12);
    let v = sky_view(7, cal(), at(day, 20 * 60 + 5));
    let e = v.eclipse.expect("an eclipse that day");
    assert!(e.cover > 0 && e.now == e.cover, "{e:?}");
    assert!(e.start < e.peak && e.peak < e.end);
    // before it the sun is whole, and on another day there is none
    assert_eq!(sky_view(7, cal(), at(day, 12 * 60)).eclipse.unwrap().now, 0);
    assert!(sky_view(7, cal(), at(day + 1, 20 * 60)).eclipse.is_none());
    // the same for every world: it is the real sky
    assert_eq!(sky_view(99, cal(), at(day, 20 * 60 + 5)).eclipse, Some(e));
}

#[test]
fn the_perseids_peak_on_the_night_of_12_august() {
    let v = sky_view(3, cal(), at(d(2026, 8, 12), 23 * 60));
    let m = v.meteors.expect("the Perseids");
    assert_eq!(m.id, "perseids");
    assert_eq!(m.rate, 3);
    assert!(m.dark);
    // after midnight it is still the same night
    let after = sky_view(3, cal(), at(d(2026, 8, 13), 2 * 60)).meteors.unwrap();
    assert_eq!((after.id.as_str(), after.rate), ("perseids", 3));
    // the night before and after: fewer
    assert_eq!(sky_view(3, cal(), at(d(2026, 8, 11), 23 * 60)).meteors.unwrap().rate, 2);
    // the day is no night
    assert!(!sky_view(3, cal(), at(d(2026, 8, 12), 14 * 60)).meteors.unwrap().dark);
    assert!(sky_view(3, cal(), at(d(2026, 7, 1), 23 * 60)).meteors.is_none());
    assert_eq!(sky_view(3, cal(), at(d(2026, 12, 14), 22 * 60)).meteors.unwrap().id, "geminids");
}

#[test]
fn comets_are_rare_seeded_and_come_and_go() {
    for seed in [1u64, 2, 3, 42, 777] {
        let mut comets = 0;
        let mut d0 = d(2030, 1, 1);
        let end = d(2060, 1, 1);
        while let Some(first) = next_date(seed, "comet", d0, end - d0) {
            comets += 1;
            let c = sky_view(seed, cal(), at(first, 22 * 60)).comet.unwrap();
            assert_eq!(c.day, 0);
            assert!((12..22).contains(&c.days));
            assert!(c.name.starts_with("Комета "));
            // brightest in the middle
            let mid = sky_view(seed, cal(), at(first + i64::from(c.days / 2), 22 * 60)).comet.unwrap();
            assert!(mid.bright >= c.bright);
            assert!(sky_view(seed, cal(), at(first + i64::from(c.days), 22 * 60)).comet.is_none() || next_date(seed, "comet", first + i64::from(c.days), 1).is_some());
            d0 = first + i64::from(c.days);
        }
        // about three a decade: over thirty years, a handful, never one every year
        assert!((2..=20).contains(&comets), "seed {seed}: {comets} comets in 30 years");
    }
    // the same seed, the same comet
    assert_eq!(next_date(5, "comet", d(2026, 1, 1), 4000), next_date(5, "comet", d(2026, 1, 1), 4000));
}

#[test]
fn the_visitors_take_a_cow_rarely_and_it_comes_back() {
    let mut nights = 0;
    for seed in 0..200u64 {
        let Some(a) = next_date(seed, "aliens", d(2027, 1, 1), 365) else { continue };
        nights += 1;
        let (_, m, _) = teul_core::time::civil_from_days(a);
        assert!((6..=10).contains(&m), "the cows sleep out: {m}");
        // before: lights; then the beam; the cow is gone after it
        assert_eq!(sky_view(seed, cal(), at(a, 80)).aliens.unwrap().phase, 1);
        assert_eq!(sky_view(seed, cal(), at(a, 115)).aliens.unwrap().phase, 2);
        assert!(!sky_view(seed, cal(), at(a, 100)).cow_missing);
        assert!(sky_view(seed, cal(), at(a, 200)).cow_missing);
        assert!(sky_view(seed, cal(), at(a, 200)).aliens.is_none());
        assert!(sky_view(seed, cal(), at(a + 1, 600)).crop_circle);
        assert!(sky_view(seed, cal(), at(a + 6, 600)).cow_missing);
        let back = sky_view(seed, cal(), at(a + 7, 7 * 60));
        assert!(!back.cow_missing && back.cow_back);
        assert!(!sky_view(seed, cal(), at(a + 10, 600)).crop_circle);
        // the paper tells it the next morning, and when the cow is back
        assert!(stories(seed, a).iter().any(|s| s.id.starts_with("sky.aliens") && s.weight == 10));
        assert!(stories(seed, a + 7).iter().any(|s| s.id.starts_with("sky.cow_back")));
    }
    // about one year in four — rare, but it does happen
    assert!((25..=80).contains(&nights), "{nights} of 200 worlds had visitors in 2027");
}

#[test]
fn the_paper_tells_the_sky_briefly() {
    let eclipse = stories(1, d(2026, 8, 12));
    let e = eclipse.iter().find(|s| s.id.starts_with("sky.eclipse.")).expect("the eclipse story");
    assert!(e.headline.contains("20:05"), "{}", e.headline);
    assert!(stories(1, d(2026, 8, 11)).iter().any(|s| s.id.starts_with("sky.eclipse_soon")));
    let rift = stories(1, d(2026, 12, 21));
    assert!(rift.iter().any(|s| s.id.starts_with("sky.rift") && s.photo.place == "square"));
    for s in rift.iter().chain(eclipse.iter()) {
        assert!(s.text.chars().count() < 140, "short: {}", s.text);
    }
}
