use teul_music::theory::{chord, melody, voice_lead, Chord};

#[test]
fn chords_are_read_from_their_symbols() {
    let c = chord("Cmaj7");
    assert_eq!(c.root, 0);
    assert_eq!(c.tones, vec![0, 4, 7, 11]);
    assert_eq!(c.bass, 0);
    assert_eq!(chord("Am9").tones, vec![0, 3, 7, 10, 14]);
    assert_eq!(chord("Am9").root, 9);
    assert_eq!(chord("F#m7b5").root, 6);
    assert_eq!(chord("F#m7b5").tones, vec![0, 3, 6, 10]);
    assert_eq!(chord("Bb13").tones, vec![0, 4, 7, 10, 14, 21]);
    assert_eq!(chord("Gsus4").tones, vec![0, 5, 7]);
    let slash = chord("C/E");
    assert_eq!(slash.root, 0);
    assert_eq!(slash.bass, 4);
    assert_eq!(chord("Dbadd9").tones, vec![0, 4, 7, 14]);
    assert_eq!(chord("Eb6").tones, vec![0, 4, 7, 9]);
}

#[test]
fn voices_move_as_little_as_they_can() {
    let a = voice_lead(&chord("Cmaj7"), None, 52, 74, 4);
    assert_eq!(a.len(), 4);
    assert!(a.iter().all(|&k| (52..=74).contains(&k)));
    let b = voice_lead(&chord("Fmaj7"), Some(&a), 52, 74, 4);
    let moved: i32 = a.iter().zip(&b).map(|(x, y)| (*x as i32 - *y as i32).abs()).sum();
    assert!(moved <= 6, "C to F should glide (moved {moved}): {a:?} -> {b:?}");
    // every note of the voicing belongs to the chord, or is its 9th: a 7th chord leaves the root to the bass
    // and takes the 9th instead (a rootless voicing)
    let f = chord("Fmaj7");
    for k in &b {
        let iv = (*k as i32 - f.root as i32).rem_euclid(12);
        assert!(f.has(*k) || iv == 2, "{k} not in F");
    }
    assert!(!b.iter().any(|k| k % 12 == 5), "the root F is the bass's: {b:?}");
}

#[test]
fn melodies_are_written_as_notes_and_lengths() {
    // c4 = middle C quarter, ' raises an octave, , lowers; dots lengthen; r is a rest
    let m = melody("c4 e8 g8 c'2. r4 b,8.");
    let keys: Vec<Option<u8>> = m.iter().map(|n| n.key).collect();
    assert_eq!(keys, vec![Some(60), Some(64), Some(67), Some(72), None, Some(59)]);
    let lens: Vec<f64> = m.iter().map(|n| n.beats).collect();
    assert_eq!(lens, vec![1.0, 0.5, 0.5, 3.0, 1.0, 0.75]);
    assert_eq!(melody("f#4 bb4")[0].key, Some(66));
    assert_eq!(melody("f#4 bb4")[1].key, Some(70));
    // bars may be marked with | for reading; they change nothing
    assert_eq!(melody("c4 c4 c4 c4 | d1").len(), 5);
}

#[test]
fn a_chord_names_its_notes_in_any_octave() {
    let c: Chord = chord("Am7");
    assert!(c.has(57) && c.has(60) && c.has(64) && c.has(67));
    assert!(!c.has(61));
}
