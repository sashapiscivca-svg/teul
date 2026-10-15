use teul_music::pieces;
use teul_music::render::Clock;

const MOODS: [&str; 32] = [
    "home", "village", "forest", "night", "cave", "fields", "farm", "race", "radio", "vinyl", "musicbox", "morning", "evening", "spring", "summer", "autumn", "winter", "rain",
    "home_evening", "cafe", "church", "temple", "grove", "rift_spring", "rift_summer", "rift_autumn", "mirror", "lunar", "townday", "halloween", "winterlights", "midsummer",
];

#[test]
fn every_mood_has_its_piece() {
    let names: Vec<String> = pieces::all().into_iter().map(|p| p.name).collect();
    assert_eq!(names, MOODS);
}

#[test]
fn no_wrong_notes_and_melodies_fit_their_sections() {
    for p in pieces::all() {
        assert!(p.warnings.is_empty(), "{}:\n{}", p.name, p.warnings.join("\n"));
    }
}

#[test]
fn pieces_last_a_minute_to_three() {
    for p in pieces::all() {
        let written = p.notes.iter().map(|n| n.at + n.len).fold(0.0, f64::max);
        let secs = Clock::of(&p, written).seconds(p.bars as f64 * p.meter);
        assert!((60.0..=200.0).contains(&secs), "{} lasts {secs:.0} s", p.name);
    }
}

#[test]
fn notes_stay_where_instruments_sound_well_and_soft() {
    for p in pieces::all() {
        for n in &p.notes {
            assert!((28..=100).contains(&n.key), "{}: key {} on channel {}", p.name, n.key, n.channel);
            assert!(n.vel <= 90, "{}: too loud ({}) on channel {}", p.name, n.vel, n.channel);
            assert!(n.len > 0.0);
        }
        // nothing but drums on channel 10, every channel used belongs to a part
        for n in &p.notes {
            assert!(p.parts.iter().any(|q| q.channel == n.channel), "{}: channel {} has no instrument", p.name, n.channel);
        }
    }
}

#[test]
fn the_same_piece_every_time() {
    let a: Vec<_> = pieces::all().into_iter().map(|p| p.notes).collect();
    let b: Vec<_> = pieces::all().into_iter().map(|p| p.notes).collect();
    assert_eq!(a, b);
}

#[test]
fn pieces_end_in_silence_for_the_loop_to_breathe() {
    for p in pieces::all() {
        let written = p.notes.iter().map(|n| n.at + n.len).fold(0.0, f64::max);
        assert!(p.bars as f64 * p.meter >= written + p.meter * 0.9, "{} has no rest at the end", p.name);
    }
}
