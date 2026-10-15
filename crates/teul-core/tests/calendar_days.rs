use teul_core::holidays::{day_info, easter, Weekday};
use teul_core::time::days_from_civil;

fn d(y: i64, m: u32, day: u32) -> i64 {
    days_from_civil(y, m, day)
}

#[test]
fn weekdays_are_the_real_ones() {
    assert_eq!(day_info(d(2026, 10, 10)).weekday, Weekday::Sat);
    assert_eq!(day_info(d(2026, 10, 12)).weekday, Weekday::Mon);
    assert_eq!(day_info(d(1970, 1, 1)).weekday, Weekday::Thu);
    assert!(day_info(d(2026, 10, 11)).weekend);
    assert!(!day_info(d(2026, 10, 13)).weekend);
}

#[test]
fn easter_is_computed_every_year() {
    assert_eq!(easter(2024), d(2024, 3, 31));
    assert_eq!(easter(2025), d(2025, 4, 20));
    assert_eq!(easter(2026), d(2026, 4, 5));
    assert_eq!(easter(2027), d(2027, 3, 28));
    let e = day_info(d(2026, 4, 5));
    assert_eq!(e.holiday.map(|h| h.id), Some("easter"));
    // Trinity, seven weeks on
    assert_eq!(day_info(d(2026, 5, 24)).holiday.map(|h| h.id), Some("trinity"));
}

#[test]
fn fixed_holidays_have_their_days_and_names() {
    for (y, m, day, id) in [
        (2026, 1, 1, "new_year"),
        (2026, 12, 25, "christmas"),
        (2026, 8, 24, "independence"),
        (2026, 6, 28, "constitution"),
        (2026, 12, 6, "st_nicholas"),
        (2026, 6, 24, "kupala"),
        (2026, 10, 1, "defenders"),
    ] {
        let info = day_info(d(y, m, day));
        let h = info.holiday.unwrap_or_else(|| panic!("{y}-{m}-{day} should be {id}"));
        assert_eq!(h.id, id);
        assert!(!h.name.is_empty());
    }
    assert!(day_info(d(2026, 10, 9)).holiday.is_none());
}

#[test]
fn days_off_and_school() {
    // a working Tuesday in October: school is on
    let tue = day_info(d(2026, 10, 13));
    assert!(tue.school && !tue.day_off);
    // Christmas: a day off, no school (winter break)
    let xmas = day_info(d(2026, 12, 25));
    assert!(xmas.day_off && !xmas.school);
    // summer: no school
    assert!(!day_info(d(2026, 7, 15)).school);
    // the first of September on a Tuesday: the first school day
    assert!(day_info(d(2026, 9, 1)).school);
    // weekends never have school
    assert!(!day_info(d(2026, 10, 10)).school);
    // the autumn break (last week of October)
    assert!(!day_info(d(2026, 10, 28)).school);
}

#[test]
fn the_rift_opens_on_the_equinoxes_and_solstices_in_kyiv_time() {
    use teul_core::holidays::rift_day;
    for (y, m, day) in [(2026, 3, 20), (2026, 6, 21), (2026, 9, 23), (2026, 12, 21), (2024, 6, 20), (2027, 12, 22), (2025, 9, 22)] {
        assert!(rift_day(d(y, m, day)), "{y}-{m}-{day} is a rift day");
        assert!(day_info(d(y, m, day)).rift);
    }
    for (y, m, day) in [(2026, 3, 21), (2026, 9, 22), (2026, 12, 22), (2027, 12, 21)] {
        assert!(!rift_day(d(y, m, day)), "{y}-{m}-{day} is not");
    }
    // their names and dates are known to the calendar (for quests)
    use teul_core::holidays::{date_of, ids, name_of};
    assert_eq!(date_of("winter_solstice", 2026), Some(d(2026, 12, 21)));
    assert_eq!(date_of("autumn_equinox", 2026), Some(d(2026, 9, 23)));
    assert!(ids().contains(&"spring_equinox"));
    assert_eq!(name_of("summer_solstice"), "Літнє сонцестояння");
    // exactly four a year
    let n = (d(2030, 1, 1)..d(2031, 1, 1)).filter(|x| rift_day(*x)).count();
    assert_eq!(n, 4);
}

#[test]
fn every_month_the_town_celebrates_something() {
    use teul_core::festival::{festival_at, Phase};
    for y in 2024..=2040 {
        for m in 1..=12u32 {
            let first = d(y, m, 1);
            let next = if m == 12 { d(y + 1, 1, 1) } else { d(y, m + 1, 1) };
            // a big celebration of the town's own in each month (not the rift days, which are another story)
            let big: Vec<&str> = (first..next).filter_map(|x| festival_at(x).filter(|f| f.phase == Phase::Day).map(|f| f.id)).collect();
            assert!(!big.is_empty(), "{y}-{m} has no big celebration");
        }
    }
}

#[test]
fn the_church_and_the_state_days_are_quiet_facts() {
    for (y, m, day, id) in [(2026, 12, 25, "christmas"), (2026, 4, 5, "easter"), (2026, 8, 24, "independence"), (2026, 1, 6, "epiphany")] {
        let h = day_info(d(y, m, day)).holiday.unwrap();
        assert_eq!(h.id, id);
        assert!(!h.festive, "{id} is not one of the town's celebrations");
    }
}

#[test]
fn the_lunar_new_year_is_on_its_real_day() {
    use teul_core::holidays::{date_of, lunar_new_year};
    assert_eq!(lunar_new_year(2026), d(2026, 2, 17));
    assert_eq!(lunar_new_year(2027), d(2027, 2, 6));
    assert_eq!(lunar_new_year(2034), d(2034, 2, 19));
    assert_eq!(date_of("lunar_new_year", 2025), Some(d(2025, 1, 29)));
    assert_eq!(day_info(d(2026, 2, 17)).holiday.map(|h| h.id), Some("lunar_new_year"));
    for y in 2020..=2060 {
        let (_, m, day) = teul_core::time::civil_from_days(lunar_new_year(y));
        assert!((m == 1 && day >= 21) || (m == 2 && day <= 20), "{y}: {m}-{day}");
    }
}

#[test]
fn a_celebration_is_got_ready_for_held_and_cleared_up() {
    use teul_core::festival::{festival_at, Phase};
    // the town's day, Saturday 11 July 2026: a week of getting ready
    let f = festival_at(d(2026, 7, 4)).unwrap();
    assert_eq!((f.id, f.phase, f.days_left), ("town_day", Phase::Prep, 7));
    let g = festival_at(d(2026, 7, 10)).unwrap();
    assert_eq!((g.phase, g.days_left), (Phase::Prep, 1));
    assert!(g.ready > f.ready);
    assert_eq!(festival_at(d(2026, 7, 11)).unwrap().phase, Phase::Day);
    assert_eq!(festival_at(d(2026, 7, 12)).unwrap().phase, Phase::After);
    assert!(festival_at(d(2026, 7, 20)).is_none());
    // the New Year: the night and the day after, then the clean-up on the second
    assert_eq!(festival_at(d(2027, 1, 1)).unwrap().phase, Phase::Day);
    assert_eq!(festival_at(d(2027, 1, 2)).map(|f| (f.id, f.phase)), Some(("new_year_eve", Phase::After)));
    assert_eq!(festival_at(d(2026, 12, 28)).map(|f| (f.id, f.phase)), Some(("new_year_eve", Phase::Prep)));
}

#[test]
fn the_new_feasts_fall_on_their_days() {
    use teul_core::holidays::{date_of, holiday};
    assert_eq!(date_of("spring_carnival", 2026), Some(d(2026, 3, 28)));
    assert_eq!(date_of("flower_festival", 2026), Some(d(2026, 5, 16)));
    assert_eq!(date_of("mothers_day", 2026), Some(d(2026, 5, 10)));
    assert_eq!(date_of("town_day", 2026), Some(d(2026, 7, 11)));
    assert_eq!(date_of("town_day", 2027), Some(d(2027, 7, 10)));
    assert_eq!(date_of("summer_end", 2026), Some(d(2026, 8, 29)));
    assert_eq!(date_of("harvest_fair", 2026), Some(d(2026, 9, 19)));
    assert_eq!(date_of("winter_lights", 2026), Some(d(2026, 12, 12)));
    assert_eq!(holiday(d(2026, 7, 11)).map(|h| h.name), Some("День Липового"));
    assert_eq!(holiday(d(2026, 11, 11)).map(|h| h.id), Some("lantern_night"));
    assert_eq!(holiday(d(2026, 4, 22)).map(|h| h.id), Some("earth_day"));
}

#[test]
fn the_last_bell_rings_on_the_last_friday_of_may() {
    use teul_core::holidays::date_of;
    assert_eq!(date_of("last_bell", 2026), Some(d(2026, 5, 29)));
    assert_eq!(date_of("last_bell", 2027), Some(d(2027, 5, 28)));
    assert!(day_info(d(2026, 5, 29)).school);
}

#[test]
fn the_full_moon_comes_on_its_real_nights_in_kyiv_time() {
    use teul_core::holidays::full_moon;
    for (y, m, day) in [(2024, 12, 15), (2025, 9, 7), (2025, 10, 7), (2025, 11, 5), (2026, 2, 2), (2026, 10, 26), (2026, 12, 24)] {
        assert!(full_moon(d(y, m, day)), "{y}-{m}-{day} is a full moon");
        assert!(day_info(d(y, m, day)).full_moon);
    }
    for (y, m, day) in [(2025, 10, 8), (2026, 10, 11), (2026, 2, 1)] {
        assert!(!full_moon(d(y, m, day)), "{y}-{m}-{day} is not");
    }
    // twelve or thirteen a year, about a moon apart; and still there beyond the table
    for y in [2026, 2040, 2075] {
        let n = (d(y, 1, 1)..d(y + 1, 1, 1)).filter(|x| full_moon(*x)).count();
        assert!(n == 12 || n == 13, "{y}: {n}");
    }
}
