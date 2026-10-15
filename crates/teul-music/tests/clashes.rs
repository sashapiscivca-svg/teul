use teul_music::pieces;

/// Two notes a semitone apart (or a minor ninth) sounding together for a beat or more rub,
/// unless one of them is the melody's own passing note: a piece may have only a few.
#[test]
fn no_long_semitone_rubs() {
    for p in pieces::all() {
        let notes: Vec<_> = p.notes.iter().filter(|n| n.channel != 9).collect();
        let mut rubs = Vec::new();
        for (i, a) in notes.iter().enumerate() {
            for b in &notes[i + 1..] {
                let start = a.at.max(b.at);
                let end = (a.at + a.len).min(b.at + b.len);
                if end - start < 1.0 {
                    continue;
                }
                let d = (a.key as i32 - b.key as i32).abs();
                if d == 1 || d == 13 {
                    rubs.push(format!("{}@{:.1} ch{} {} vs ch{} {}", p.name, start, a.channel, a.key, b.channel, b.key));
                }
            }
        }
        let beats = p.bars as f64 * p.meter;
        assert!(rubs.len() as f64 <= beats / 40.0, "{}: {} rubs\n{}", p.name, rubs.len(), rubs.iter().take(20).cloned().collect::<Vec<_>>().join("\n"));
    }
}
