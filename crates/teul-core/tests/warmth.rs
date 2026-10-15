use teul_core::daily::Sky;
use teul_core::time::days_from_civil;
use teul_core::warmth::{air, clothes_warmth, comfort, day_mean, frozen, ComfortIn, Near, Shelter};

fn d(y: i64, m: u32, day: u32) -> i64 {
    days_from_civil(y, m, day)
}

fn outfit(pairs: &[(&str, &str)]) -> i32 {
    clothes_warmth(|k| pairs.iter().find(|(x, _)| *x == k).map(|(_, v)| v.to_string()))
}

fn base(air_out: i32, clothes: i32, shelter: Shelter) -> ComfortIn {
    ComfortIn { air_out, sky: Sky::Cloudy, minute: 720, month: 1, shelter, clothes, dry_kept: false, shaded: false, hot_ago: None, near: Near::default(), ice: false }
}

#[test]
fn the_air_follows_the_year_and_the_day() {
    for seed in [1, 7, 42, 99] {
        let jan: i32 = (0..31).map(|k| day_mean(seed, d(2027, 1, 1) + k)).sum::<i32>() / 31;
        let jul: i32 = (0..31).map(|k| day_mean(seed, d(2027, 7, 1) + k)).sum::<i32>() / 31;
        assert!(jan < 20, "January is cold ({jan})");
        assert!(jul > 150, "July is warm ({jul})");
        // the same everywhere
        assert_eq!(air(seed, d(2026, 10, 11), 600, Sky::Clear), air(seed, d(2026, 10, 11), 600, Sky::Clear));
        // the afternoon is warmer than the dawn
        assert!(air(seed, d(2027, 5, 10), 900, Sky::Clear) > air(seed, d(2027, 5, 10), 300, Sky::Clear));
        // snow falls only near a frost
        assert!(air(seed, d(2027, 1, 10), 900, Sky::Snow) <= 10);
    }
}

#[test]
fn the_lakes_freeze_in_a_frosty_winter_and_thaw_in_spring() {
    let seeds: Vec<u64> = (1..=24).collect();
    let midwinter = seeds.iter().filter(|s| frozen(**s, d(2027, 1, 25))).count();
    assert!(midwinter >= 20, "late January is iced in most years ({midwinter}/24)");
    for s in &seeds {
        assert!(!frozen(*s, d(2026, 11, 3)), "not in early November");
        assert!(!frozen(*s, d(2027, 4, 20)), "not in late April");
        assert!(!frozen(*s, d(2027, 7, 1)));
    }
    // the ice holds through a run of days, not on and off
    let s = seeds.iter().copied().find(|s| frozen(*s, d(2027, 1, 25))).unwrap();
    let mut flips = 0;
    let mut was = frozen(s, d(2026, 11, 1));
    for k in d(2026, 11, 1)..d(2027, 4, 1) {
        let now = frozen(s, k);
        flips += usize::from(now != was);
        was = now;
    }
    assert!(flips <= 6, "freezes and thaws a few times at most ({flips})");
}

#[test]
fn clothes_keep_one_warm() {
    let summer = outfit(&[("look.top", "0"), ("look.bottom", "1"), ("look.shoe", "2")]);
    let winter = outfit(&[("look.top", "11"), ("look.bottom", "0"), ("look.shoe", "3"), ("look.acc", "8"), ("look.mitt", "1")]);
    assert!(winter > summer + 12);
    // a t-shirt at a frost: freezing; a down coat, a hat, mittens and felt boots: fine
    assert!(comfort(&base(-60, summer, Shelter::Outdoors)).feel <= -2);
    assert_eq!(comfort(&base(-60, winter, Shelter::Outdoors)).feel, 0);
    assert!(comfort(&base(-60, winter, Shelter::Outdoors)).breath);
    // at a hard frost even the down coat is not enough
    assert!(comfort(&base(-220, winter, Shelter::Outdoors)).feel < 0);
}

#[test]
fn home_warms_while_the_gas_is_on() {
    let jumper = outfit(&[("look.top", "7"), ("look.bottom", "0"), ("look.shoe", "0")]);
    assert_eq!(comfort(&base(-80, jumper, Shelter::Home { heated: true })).feel, 0);
    assert!(comfort(&base(-80, jumper, Shelter::Home { heated: false })).feel < 0, "a cold house when the gas is cut off");
    let mut by_stove = base(-80, jumper, Shelter::Home { heated: false });
    by_stove.near.heat = true;
    let v = comfort(&by_stove);
    assert!(v.hearth && v.feel >= 0);
    // indoors one is never too warm in a coat (it is opened)
    let coat = outfit(&[("look.top", "12"), ("look.bottom", "0"), ("look.shoe", "3")]);
    assert_eq!(comfort(&base(-80, coat, Shelter::Indoors)).feel, 0);
}

#[test]
fn rain_wets_and_the_sun_bakes() {
    let tee = outfit(&[("look.top", "0"), ("look.bottom", "1"), ("look.shoe", "2")]);
    let mut rain = base(120, tee, Shelter::Outdoors);
    rain.sky = Sky::Rain;
    assert!(comfort(&rain).wet);
    rain.dry_kept = true;
    assert!(!comfort(&rain).wet);
    let mut noon = base(300, tee, Shelter::Outdoors);
    noon.sky = Sky::Clear;
    noon.month = 7;
    let hot = comfort(&noon);
    assert!(hot.sun && hot.feel >= 2);
    noon.shaded = true;
    assert!(comfort(&noon).feel < hot.feel, "a hat helps");
    // just out of the water
    let mut swim = base(240, tee, Shelter::Outdoors);
    swim.near.swum_ago = Some(5);
    assert!(comfort(&swim).wet);
    // dry again in a few minutes, sooner indoors or by a fire
    swim.near.swum_ago = Some(10);
    assert!(!comfort(&swim).wet);
    swim.near.swum_ago = Some(5);
    swim.near.heat = true;
    assert!(!comfort(&swim).wet);
    let mut inside = base(240, tee, Shelter::Indoors);
    inside.near.swum_ago = Some(2);
    assert!(comfort(&inside).wet);
    inside.near.swum_ago = Some(3);
    assert!(!comfort(&inside).wet);
    // a hot cocoa warms for a while
    let mut cocoa = base(-20, tee, Shelter::Outdoors);
    let cold = comfort(&cocoa).feel;
    cocoa.hot_ago = Some(5);
    assert!(comfort(&cocoa).feel > cold);
}
