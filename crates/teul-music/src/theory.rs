//! A little music theory: chords from their symbols, voicings that glide from one chord to the next, and
//! melodies written as note names with lengths.

/// A chord: its root (pitch class), its tones as intervals above the root (may pass the octave: 14 is a 9th),
/// and the pitch class in the bass (the root unless it is written as a slash chord).
#[derive(Clone, Debug, PartialEq)]
pub struct Chord {
    pub root: u8,
    pub tones: Vec<u8>,
    pub bass: u8,
}

impl Chord {
    /// Whether a MIDI key is one of the chord's notes (in any octave).
    pub fn has(&self, key: u8) -> bool {
        self.tones.iter().any(|t| (self.root as i32 + *t as i32 - key as i32).rem_euclid(12) == 0)
    }

    /// The chord's pitch classes.
    pub fn classes(&self) -> Vec<u8> {
        let mut out: Vec<u8> = self.tones.iter().map(|t| (self.root + t) % 12).collect();
        out.dedup();
        out
    }

    /// The fifth above the root if the chord has one (else the root), for bass lines.
    pub fn fifth(&self) -> u8 {
        if self.tones.contains(&7) {
            (self.root + 7) % 12
        } else if self.tones.contains(&6) {
            (self.root + 6) % 12
        } else {
            self.root
        }
    }
}

fn pitch_class(name: &str) -> (u8, usize) {
    let mut chars = name.chars();
    let letter = chars.next().expect("a note name");
    let base: i32 = match letter.to_ascii_uppercase() {
        'C' => 0,
        'D' => 2,
        'E' => 4,
        'F' => 5,
        'G' => 7,
        'A' => 9,
        'B' => 11,
        other => panic!("not a note: {other}"),
    };
    let mut used = 1;
    let mut pc = base;
    let rest: Vec<char> = name[1..].chars().collect();
    let mut i = 0;
    while i < rest.len() {
        match rest[i] {
            '#' => pc += 1,
            'b' if i + 1 < rest.len() || name.len() == 2 => {
                // "b" after a letter is a flat only when it is not the start of the quality (there is none like that)
                pc -= 1
            }
            _ => break,
        }
        used += 1;
        i += 1;
    }
    (pc.rem_euclid(12) as u8, used)
}

/// Reads a chord symbol: C, Cm, C7, Cmaj7, Cm7, C9, Cmaj9, Cm9, C6, Cm6, Cadd9, Csus2, Csus4, C7sus4, C9sus4,
/// C13, Cdim, Cm7b5, C7b9, Cmaj7#11, with an optional /bass.
pub fn chord(symbol: &str) -> Chord {
    let (main, slash) = match symbol.split_once('/') {
        Some((m, b)) => (m, Some(b)),
        None => (symbol, None),
    };
    // the root: a letter and its accidentals; a "b" right after the letter is a flat
    let bytes: Vec<char> = main.chars().collect();
    let mut n = 1;
    let mut pc: i32 = pitch_class(&bytes[0].to_string()).0 as i32;
    while n < bytes.len() && (bytes[n] == '#' || bytes[n] == 'b') {
        pc += if bytes[n] == '#' { 1 } else { -1 };
        n += 1;
    }
    let root = pc.rem_euclid(12) as u8;
    let quality: String = bytes[n..].iter().collect();
    let tones: Vec<u8> = match quality.as_str() {
        "" | "maj" => vec![0, 4, 7],
        "m" | "min" => vec![0, 3, 7],
        "7" => vec![0, 4, 7, 10],
        "maj7" => vec![0, 4, 7, 11],
        "m7" => vec![0, 3, 7, 10],
        "mmaj7" => vec![0, 3, 7, 11],
        "9" => vec![0, 4, 7, 10, 14],
        "maj9" => vec![0, 4, 7, 11, 14],
        "m9" => vec![0, 3, 7, 10, 14],
        "m11" => vec![0, 3, 7, 10, 14, 17],
        "6" => vec![0, 4, 7, 9],
        "m6" => vec![0, 3, 7, 9],
        "69" => vec![0, 4, 7, 9, 14],
        "add9" => vec![0, 4, 7, 14],
        "madd9" => vec![0, 3, 7, 14],
        "sus2" => vec![0, 2, 7],
        "sus4" => vec![0, 5, 7],
        "7sus4" => vec![0, 5, 7, 10],
        "9sus4" => vec![0, 5, 7, 10, 14],
        "13" => vec![0, 4, 7, 10, 14, 21],
        "dim" => vec![0, 3, 6],
        "dim7" => vec![0, 3, 6, 9],
        "m7b5" => vec![0, 3, 6, 10],
        "7b9" => vec![0, 4, 7, 10, 13],
        "maj7#11" => vec![0, 4, 7, 11, 18],
        "aug" => vec![0, 4, 8],
        other => panic!("unknown chord quality '{other}' in {symbol}"),
    };
    let bass = match slash {
        Some(b) => {
            let chars: Vec<char> = b.chars().collect();
            let mut p: i32 = pitch_class(&chars[0].to_string()).0 as i32;
            for c in &chars[1..] {
                p += if *c == '#' { 1 } else if *c == 'b' { -1 } else { 0 };
            }
            p.rem_euclid(12) as u8
        }
        None => root,
    };
    Chord { root, tones, bass }
}

/// A voicing of `count` notes within [lo, hi] that moves as little as it can from `prev`: the 3rd and 7th
/// (and colours) kept, the root left to the bass when there is a choice.
pub fn voice_lead(c: &Chord, prev: Option<&[u8]>, lo: u8, hi: u8, count: usize) -> Vec<u8> {
    // the notes worth having, most important first: 3rd/sus, 7th/6th, colours (9, 11, 13), 5th, root
    let mut wanted: Vec<u8> = Vec::new();
    let order = |t: u8| -> u8 {
        match t % 12 {
            3 | 4 | 5 | 2 if t < 12 => 0,
            10 | 11 | 9 => 1,
            _ if t >= 12 => 2,
            7 | 6 | 8 => 3,
            _ => 4,
        }
    };
    let mut tones = c.tones.clone();
    // a chord with a 7th or 6th leaves its root to the bass and takes the 9th instead (a warm, open voicing),
    // unless the 9th would rub (a diminished chord)
    let seventh = tones.iter().any(|t| matches!(t % 12, 9 | 10 | 11) && *t < 12);
    let dim = tones.contains(&6) && !tones.contains(&7);
    if seventh && count >= 4 && !dim {
        tones.retain(|t| *t != 0);
        if !tones.iter().any(|t| t % 12 == 2 || t % 12 == 1) {
            tones.push(14);
        }
    }
    tones.sort_by_key(|t| order(*t));
    for t in tones {
        let pc = (c.root + t) % 12;
        if !wanted.contains(&pc) {
            wanted.push(pc);
        }
    }
    wanted.truncate(count.max(1));
    while wanted.len() < count {
        // double the most important note
        let again = wanted[wanted.len() % wanted.len().max(1)];
        wanted.push(again);
    }
    // every way of putting each pitch class in the range, then the cheapest from prev (or the most central)
    let options: Vec<Vec<u8>> = wanted.iter().map(|pc| (lo..=hi).filter(|k| k % 12 == *pc).collect()).collect();
    let mut best: Option<(i32, Vec<u8>)> = None;
    let mut pick = vec![0usize; options.len()];
    'outer: loop {
        let mut v: Vec<u8> = pick.iter().enumerate().map(|(i, j)| options[i][*j]).collect();
        v.sort_unstable();
        if v.windows(2).all(|w| w[1] > w[0]) {
            // what the ear minds, as a price: rubbing pairs anywhere in the chord, a spread wider than a hand,
            // mud low down; then how far the voices move from the last chord (or from the middle)
            let mut cost: i32 = 0;
            for i in 0..v.len() {
                for j in i + 1..v.len() {
                    match v[j] - v[i] {
                        1 => cost += 16,
                        13 => cost += 10,
                        2 if v[i] < 60 => cost += 4,
                        _ => {}
                    }
                }
            }
            if v[v.len() - 1] - v[0] > 19 {
                cost += 20;
            }
            cost += match prev {
                Some(p) if p.len() == v.len() => p.iter().zip(&v).map(|(a, b)| (*a as i32 - *b as i32).abs()).sum::<i32>(),
                Some(p) => {
                    let pm = p.iter().map(|k| *k as i32).sum::<i32>() / p.len().max(1) as i32;
                    let vm = v.iter().map(|k| *k as i32).sum::<i32>() / v.len() as i32;
                    (pm - vm).abs() * 2
                }
                None => {
                    let mid = (lo as i32 + hi as i32) / 2;
                    let vm = v.iter().map(|k| *k as i32).sum::<i32>() / v.len() as i32;
                    (mid - vm).abs()
                }
            };
            if best.as_ref().map_or(true, |(b, _)| cost < *b) {
                best = Some((cost, v));
            }
        }
        // next combination
        let mut i = 0;
        loop {
            if i == pick.len() {
                break 'outer;
            }
            pick[i] += 1;
            if pick[i] < options[i].len() {
                break;
            }
            pick[i] = 0;
            i += 1;
        }
    }
    best.map(|(_, v)| v).unwrap_or_else(|| wanted.iter().map(|pc| lo + (pc + 12 - lo % 12) % 12).collect())
}

/// One note (or rest) of a written melody.
#[derive(Clone, Debug, PartialEq)]
pub struct MelodyNote {
    pub key: Option<u8>,
    pub beats: f64,
}

/// Reads a melody: note names (c d e f g a b, with # or b), ' up and , down an octave from the octave of
/// middle C, then a length (1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 3 a half-note triplet's third,
/// 6 a quarter triplet's third, 12 an eighth triplet's third), dots lengthen by half; "r" is a rest; "|" is ignored.
pub fn melody(text: &str) -> Vec<MelodyNote> {
    let mut out = Vec::new();
    for word in text.split_whitespace() {
        if word == "|" {
            continue;
        }
        let chars: Vec<char> = word.chars().collect();
        let mut i = 1;
        let key = if chars[0] == 'r' {
            None
        } else {
            let base: i32 = match chars[0] {
                'c' => 0,
                'd' => 2,
                'e' => 4,
                'f' => 5,
                'g' => 7,
                'a' => 9,
                'b' => 11,
                other => panic!("not a note: {other} in {word}"),
            };
            let mut k = 60 + base;
            while i < chars.len() {
                match chars[i] {
                    '#' => k += 1,
                    'b' => k -= 1,
                    '\'' => k += 12,
                    ',' => k -= 12,
                    _ => break,
                }
                i += 1;
            }
            Some(k as u8)
        };
        let digits: String = chars[i..].iter().take_while(|c| c.is_ascii_digit()).collect();
        i += digits.len();
        let d: u32 = digits.parse().unwrap_or(4);
        let mut beats = match d {
            1 => 4.0,
            2 => 2.0,
            3 => 4.0 / 3.0,
            4 => 1.0,
            6 => 2.0 / 3.0,
            8 => 0.5,
            12 => 1.0 / 3.0,
            16 => 0.25,
            other => panic!("unknown length {other} in {word}"),
        };
        let mut add = beats / 2.0;
        while i < chars.len() && chars[i] == '.' {
            beats += add;
            add /= 2.0;
            i += 1;
        }
        out.push(MelodyNote { key, beats });
    }
    out
}
