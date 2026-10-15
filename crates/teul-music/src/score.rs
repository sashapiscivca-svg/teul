//! A piece as parts (instruments on channels) and notes in beats, and the ways players play a chord
//! progression: held pads, block chords, broken chords, finger-picking, bass lines, written melodies,
//! sprinkles of bells, brushes. All deterministic: the same piece is the same notes every time.

use crate::theory::{chord, melody, voice_lead, Chord};

/// General MIDI programs used here (GeneralUser GS).
pub mod gm {
    pub const PIANO: u8 = 0;
    pub const BRIGHT_PIANO: u8 = 1;
    pub const EPIANO: u8 = 4;
    pub const CELESTA: u8 = 8;
    pub const GLOCKENSPIEL: u8 = 9;
    pub const MUSIC_BOX: u8 = 10;
    pub const VIBRAPHONE: u8 = 11;
    pub const MARIMBA: u8 = 12;
    pub const ACCORDION: u8 = 21;
    pub const NYLON: u8 = 24;
    pub const STEEL: u8 = 25;
    pub const UPRIGHT: u8 = 32;
    pub const FINGER_BASS: u8 = 33;
    pub const VIOLIN: u8 = 40;
    pub const CELLO: u8 = 42;
    pub const PIZZICATO: u8 = 45;
    pub const HARP: u8 = 46;
    pub const TIMPANI: u8 = 47;
    pub const STRINGS: u8 = 48;
    pub const SLOW_STRINGS: u8 = 49;
    pub const CHOIR: u8 = 52;
    pub const TRUMPET: u8 = 56;
    pub const MUTED_TRUMPET: u8 = 59;
    pub const HORN: u8 = 60;
    pub const OBOE: u8 = 68;
    pub const BASSOON: u8 = 70;
    pub const CLARINET: u8 = 71;
    pub const PICCOLO: u8 = 72;
    pub const FLUTE: u8 = 73;
    pub const RECORDER: u8 = 74;
    pub const PAN_FLUTE: u8 = 75;
    pub const WHISTLE: u8 = 78;
    pub const OCARINA: u8 = 79;
    pub const WARM_PAD: u8 = 89;
    pub const HALO_PAD: u8 = 94;
    pub const KALIMBA: u8 = 108;
    /// Drum kits (channel 10): standard, brushes, orchestral.
    pub const KIT_STANDARD: u8 = 0;
    pub const KIT_BRUSH: u8 = 40;
    pub const KIT_ORCHESTRA: u8 = 48;
}

/// Drum keys (GM).
pub mod drum {
    pub const KICK: u8 = 36;
    pub const SIDE_STICK: u8 = 37;
    pub const SNARE: u8 = 38;
    pub const BRUSH_SWIRL: u8 = 40;
    pub const HAT: u8 = 42;
    pub const PEDAL_HAT: u8 = 44;
    pub const RIDE: u8 = 51;
    pub const TAMBOURINE: u8 = 54;
    pub const RIDE_BELL: u8 = 53;
    pub const SHAKER: u8 = 70;
    pub const WOOD_HI: u8 = 76;
    pub const WOOD_LO: u8 = 77;
    pub const TRIANGLE: u8 = 81;
    pub const MARK_TREE: u8 = 80;
}

/// An instrument of the piece on its MIDI channel.
#[derive(Clone, Debug)]
pub struct Part {
    pub channel: u8,
    pub program: u8,
    pub volume: u8,
    pub pan: u8,
    pub reverb: u8,
    pub chorus: u8,
    /// Played a little behind the beat (a melody that sings), in milliseconds.
    pub lay_back: f64,
}

/// One note: a key on a channel, its loudness, when (in beats from the start) and for how long.
#[derive(Clone, Debug, PartialEq)]
pub struct Note {
    pub channel: u8,
    pub key: u8,
    pub vel: u8,
    pub at: f64,
    pub len: f64,
    /// A note of the tune (the accompaniment makes way for it).
    pub lead: bool,
    /// A held note of a pad (it makes way for the moving parts).
    pub held: bool,
}

/// A chord of a progression, where it starts and how long it lasts (beats).
#[derive(Clone, Debug)]
pub struct Span {
    pub chord: Chord,
    pub at: f64,
    pub len: f64,
}

/// Reads a progression, one bar between bars: "Fmaj7 | Em7 A7 | Dm9 | C/E" (chords in a bar share it evenly;
/// "%" repeats the bar before, "-" holds the chord before through the bar).
pub fn progression(text: &str, meter: f64) -> Vec<Span> {
    let mut out: Vec<Span> = Vec::new();
    let mut last_bar: Vec<String> = Vec::new();
    for (b, bar) in text.split('|').enumerate() {
        let mut names: Vec<String> = bar.split_whitespace().map(String::from).collect();
        if names == ["%"] {
            names = last_bar.clone();
        }
        let at0 = b as f64 * meter;
        if names == ["-"] {
            if let Some(s) = out.last_mut() {
                s.len += meter;
            }
            continue;
        }
        let each = meter / names.len() as f64;
        for (i, n) in names.iter().enumerate() {
            out.push(Span { chord: chord(n), at: at0 + i as f64 * each, len: each });
        }
        last_bar = names;
    }
    out
}

pub struct Piece {
    pub name: String,
    pub tempo: f64,
    pub meter: f64,
    pub parts: Vec<Part>,
    pub notes: Vec<Note>,
    /// Bars of the whole piece, rests at the end included.
    pub bars: u32,
    /// The last bars slow down this much (1.0 none; 1.15 = 15 % slower by the end).
    pub ritardando: f64,
    /// Wrong notes found while writing (a melody against its chords, a melody of the wrong length).
    pub warnings: Vec<String>,
}

/// A tiny deterministic hash for humanising.
pub fn hash(a: u64, b: u64) -> f64 {
    let mut x = a.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ b.wrapping_mul(0xC2B2_AE3D_27D4_EB4F);
    x ^= x >> 31;
    x = x.wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x ^= x >> 27;
    (x >> 11) as f64 / (1u64 << 53) as f64
}

impl Piece {
    pub fn new(name: &str, tempo: f64, meter: u32) -> Self {
        Piece { name: name.into(), tempo, meter: meter as f64, parts: Vec::new(), notes: Vec::new(), bars: 0, ritardando: 1.08, warnings: Vec::new() }
    }

    /// Adds an instrument; returns its channel. Channel 9 (the tenth) is kept for drums.
    pub fn part(&mut self, program: u8, volume: u8, pan: u8, reverb: u8) -> u8 {
        let mut ch = self.parts.len() as u8;
        if ch >= 9 {
            ch += 1;
        }
        self.parts.push(Part { channel: ch, program, volume, pan, reverb, chorus: 0, lay_back: 0.0 });
        ch
    }

    /// The drum kit on channel 10.
    pub fn drums(&mut self, kit: u8, volume: u8, reverb: u8) -> u8 {
        self.parts.push(Part { channel: 9, program: kit, volume, pan: 64, reverb, chorus: 0, lay_back: 0.0 });
        9
    }

    pub fn lay_back(&mut self, ch: u8, ms: f64) {
        if let Some(p) = self.parts.iter_mut().find(|p| p.channel == ch) {
            p.lay_back = ms;
        }
    }

    pub fn chorus(&mut self, ch: u8, amount: u8) {
        if let Some(p) = self.parts.iter_mut().find(|p| p.channel == ch) {
            p.chorus = amount;
        }
    }

    fn push(&mut self, channel: u8, key: u8, vel: u8, at: f64, len: f64) {
        if len <= 0.0 {
            return;
        }
        self.notes.push(Note { channel, key, vel: vel.clamp(1, 127), at, len, lead: false, held: false });
        let end_bar = ((at + len) / self.meter).ceil() as u32;
        self.bars = self.bars.max(end_bar);
    }

    /// The accompaniment makes way for the tune, as an arranger would: a held note of a pad, a picked or
    /// broken chord that rubs a semitone (or a minor ninth) against a tune note sounding with it for half a beat
    /// or more is left out.
    pub fn make_way(&mut self) {
        let rubs = |n: &Note, m: &Note, min: f64| {
            let overlap = (n.at + n.len).min(m.at + m.len) - n.at.max(m.at);
            let d = (n.key as i32 - m.key as i32).abs();
            overlap >= min && (d == 1 || d == 13 || d == 25)
        };
        let leads: Vec<Note> = self.notes.iter().filter(|n| n.lead).cloned().collect();
        self.notes.retain(|n| n.lead || n.channel == 9 || !leads.iter().any(|m| rubs(n, m, 0.5)));
        // then the held pads make way for whatever moves
        let moving: Vec<Note> = self.notes.iter().filter(|n| !n.held && n.channel != 9).cloned().collect();
        self.notes.retain(|n| !n.held || !moving.iter().any(|m| rubs(n, m, 1.0)));
    }

    /// Ends the piece with `rest` bars of silence after everything written (for the loop to breathe).
    pub fn rest(&mut self, bars: u32) {
        self.bars += bars;
    }

    // ---- ways to play a progression ------------------------------------------------------------------

    /// Held chords, voice-led, each lasting its span (a string section, a pad, an organ).
    pub fn pad(&mut self, ch: u8, prog: &[Span], at: f64, vel: u8, lo: u8, hi: u8, voices: usize) {
        let mut prev: Option<Vec<u8>> = None;
        for s in prog {
            let v = voice_lead(&s.chord, prev.as_deref(), lo, hi, voices);
            for (i, k) in v.iter().enumerate() {
                let swell = (hash(s.at.to_bits(), *k as u64 + i as u64) * 8.0) as u8;
                self.push(ch, *k, vel.saturating_sub(4) + swell, at + s.at, s.len + 0.05);
                if let Some(last) = self.notes.last_mut() {
                    last.held = true;
                }
            }
            prev = Some(v);
        }
    }

    /// Chords struck at the given offsets of each span (beats from its start), each held `hold` beats.
    pub fn block(&mut self, ch: u8, prog: &[Span], at: f64, hits: &[f64], hold: f64, vel: u8, lo: u8, hi: u8, voices: usize) {
        let mut prev: Option<Vec<u8>> = None;
        for s in prog {
            let v = voice_lead(&s.chord, prev.as_deref(), lo, hi, voices);
            for (h, off) in hits.iter().enumerate() {
                if *off >= s.len {
                    continue;
                }
                let accent = if h == 0 { 6 } else { 0 };
                for (i, k) in v.iter().enumerate() {
                    // a hand rolls a chord a little, bottom to top
                    let roll = i as f64 * 0.012;
                    self.push(ch, *k, vel + accent - (i as u8 % 2) * 3, at + s.at + off + roll, hold.min(s.len - off));
                }
            }
            prev = Some(v);
        }
    }

    /// A broken chord: the voicing walked through in `order` (indices into bass + voicing), one note per
    /// `step` beats, each ringing `ring` beats. Index 0 is the bass note an octave or two below.
    pub fn arp(&mut self, ch: u8, prog: &[Span], at: f64, step: f64, order: &[usize], ring: f64, vel: u8, lo: u8, hi: u8) {
        let mut prev: Option<Vec<u8>> = None;
        for s in prog {
            let v = voice_lead(&s.chord, prev.as_deref(), lo, hi, 4);
            let bass = low_note(s.chord.bass, lo.saturating_sub(12).max(36));
            let mut notes = vec![bass];
            notes.extend(v.iter().copied());
            let steps = (s.len / step).round() as usize;
            for i in 0..steps {
                let idx = order[i % order.len()];
                let k = notes[idx.min(notes.len() - 1)];
                let beat_vel = if i == 0 { vel + 8 } else if (i as f64 * step).fract() == 0.0 { vel + 2 } else { vel - 4 };
                // a broken chord rings, but not into the next chord
                let len = if idx == 0 { s.len - i as f64 * step } else { ring.min(s.len - i as f64 * step) };
                self.push(ch, k, beat_vel, at + s.at + i as f64 * step, len);
            }
            prev = Some(v);
        }
    }

    /// Finger-picking (a nylon guitar): the thumb on the bass (root, then fifth), the fingers on the upper notes
    /// between the beats.
    pub fn pick(&mut self, ch: u8, prog: &[Span], at: f64, vel: u8) {
        let mut prev: Option<Vec<u8>> = None;
        for s in prog {
            let v = voice_lead(&s.chord, prev.as_deref(), 55, 71, 3);
            let root = low_note(s.chord.bass, 40);
            let fifth = low_note(s.chord.fifth(), 43);
            let beats = s.len.round() as usize;
            for b in 0..beats {
                let thumb = if b % 2 == 0 { root } else { fifth };
                self.push(ch, thumb, vel + 4, at + s.at + b as f64, 1.4);
                // fingers: "and" of the beat, alternating middle and top, a pinch on the downbeat of the bar
                if b == 0 {
                    self.push(ch, v[2], vel - 2, at + s.at, 1.2);
                }
                let f = if b % 2 == 0 { v[1] } else { v[2] };
                self.push(ch, f, vel - 6, at + s.at + b as f64 + 0.5, 0.9);
                if b % 2 == 1 {
                    self.push(ch, v[0], vel - 8, at + s.at + b as f64 + 0.75, 0.6);
                }
            }
            prev = Some(v);
        }
    }

    /// A bass line: "root" (the root held), "two" (root and fifth), "walk" (quarters walking to the next
    /// chord), "waltz" (the root on one), "pulse" (eighths).
    pub fn bass(&mut self, ch: u8, prog: &[Span], at: f64, style: &str, vel: u8) {
        for (n, s) in prog.iter().enumerate() {
            let root = low_note(s.chord.bass, 33);
            let fifth = low_note(s.chord.fifth(), 33);
            let fifth = if fifth < root { fifth + 12 } else { fifth };
            let next = prog.get(n + 1).map(|x| low_note(x.chord.bass, 33)).unwrap_or(root);
            match style {
                "root" => self.push(ch, root, vel, at + s.at, s.len - 0.1),
                "two" => {
                    let half = s.len / 2.0;
                    self.push(ch, root, vel + 4, at + s.at, half - 0.1);
                    if half >= 1.0 {
                        self.push(ch, fifth, vel - 4, at + s.at + half, half - 0.1);
                    }
                }
                "waltz" => {
                    self.push(ch, root, vel + 4, at + s.at, 1.6);
                    if s.len >= 6.0 {
                        self.push(ch, fifth, vel - 4, at + s.at + 3.0, 1.6);
                    }
                }
                "pulse" => {
                    let steps = (s.len / 0.5) as usize;
                    for i in 0..steps {
                        let k = if i % 4 == 3 { fifth } else { root };
                        self.push(ch, k, if i % 2 == 0 { vel } else { vel - 10 }, at + s.at + i as f64 * 0.5, 0.42);
                    }
                }
                _ => {
                    // walking: root, chord tone, chord tone, approach to the next root from a step away
                    let beats = s.len.round() as usize;
                    let tones = s.chord.classes();
                    for b in 0..beats {
                        let k = if b == 0 {
                            root
                        } else if b + 1 == beats {
                            let up = next as i32 - 1;
                            let down = next as i32 + 2;
                            if hash(s.at.to_bits(), 7) < 0.5 && up >= 28 { up as u8 } else { down.min(55) as u8 }
                        } else {
                            let pc = tones[(b * 2) % tones.len()];
                            let mut k = low_note(pc, root.saturating_sub(2));
                            if k > root + 12 {
                                k -= 12;
                            }
                            k
                        };
                        self.push(ch, k, vel - (b as u8 % 2) * 6, at + s.at + b as f64, 0.92);
                    }
                }
            }
        }
    }

    /// A written melody from `at` (beats); phrases breathe: a little louder toward their middle.
    pub fn melody(&mut self, ch: u8, text: &str, at: f64, vel: u8, transpose: i32) {
        let notes = melody(text);
        let total: f64 = notes.iter().map(|n| n.beats).sum();
        let mut t = 0.0;
        for n in notes {
            if let Some(k) = n.key {
                let arc = (std::f64::consts::PI * (t / total.max(1.0))).sin();
                let v = vel as f64 + arc * 10.0 - 5.0 + if n.beats >= 2.0 { 3.0 } else { 0.0 };
                let k = (k as i32 + transpose).clamp(21, 108) as u8;
                // legato for a singing line, a touch of space for short notes
                let len = if n.beats <= 0.5 { n.beats * 0.85 } else { n.beats * 0.97 };
                self.push(ch, k, v as u8, at + t, len);
                if let Some(last) = self.notes.last_mut() {
                    last.lead = true;
                }
            }
            t += n.beats;
        }
    }

    /// A melody over its section: checked to be as long as the section, and to sound a chord tone (or a
    /// gentle colour) on every strong beat; anything else is written down in `warnings`.
    pub fn sing(&mut self, ch: u8, prog: &[Span], text: &str, at: f64, vel: u8, transpose: i32) {
        let notes = melody(text);
        let total: f64 = notes.iter().map(|n| n.beats).sum();
        let span_end = prog.last().map_or(0.0, |s| s.at + s.len);
        if (total - span_end).abs() > 1e-6 {
            self.warnings.push(format!("{}: a melody of {total} beats over {span_end} beats of chords: {text}", self.name));
        }
        let strong = if self.meter == 3.0 { vec![0.0] } else { vec![0.0, 2.0] };
        let mut t = 0.0;
        for n in &notes {
            if let Some(k) = n.key {
                let in_bar = t % self.meter;
                if strong.iter().any(|b| (in_bar - b).abs() < 1e-6) {
                    if let Some(s) = prog.iter().find(|s| t >= s.at - 1e-6 && t < s.at + s.len - 1e-6) {
                        if !fits(&s.chord, (k as i32 + transpose) as u8) {
                            self.warnings.push(format!("{}: {} on a strong beat at {t} over {:?}", self.name, k, s.chord));
                        }
                    }
                }
            }
            t += n.beats;
        }
        self.melody(ch, text, at, vel, transpose);
    }

    /// Bells now and then: a high chord tone on some off-beats (celesta, glockenspiel, kalimba).
    pub fn sprinkle(&mut self, ch: u8, prog: &[Span], at: f64, every: f64, chance: f64, vel: u8, lo: u8, hi: u8, seed: u64) {
        for s in prog {
            let steps = (s.len / every) as usize;
            for i in 0..steps {
                let when = s.at + i as f64 * every;
                if hash(seed, when.to_bits()) > chance {
                    continue;
                }
                let classes = s.chord.classes();
                let pc = classes[(hash(seed + 1, when.to_bits()) * classes.len() as f64) as usize % classes.len()];
                let k = (lo..=hi).filter(|k| k % 12 == pc).nth((hash(seed + 2, when.to_bits()) * 2.0) as usize).unwrap_or(lo);
                self.push(ch, k, vel, at + when, 1.5);
            }
        }
    }

    /// Drums from a pattern of one bar: (key, beat offsets, velocity), repeated over `bars` bars from `at`;
    /// every fourth bar may vary (`fill`).
    pub fn groove(&mut self, ch: u8, at: f64, bars: u32, pattern: &[(u8, &[f64], u8)], fill: &[(u8, &[f64], u8)]) {
        for b in 0..bars {
            let use_fill = !fill.is_empty() && b % 4 == 3;
            let p = if use_fill { fill } else { pattern };
            for (key, offs, vel) in p {
                for o in offs.iter() {
                    let wobble = (hash(b as u64 * 31 + *key as u64, o.to_bits()) * 10.0) as u8;
                    self.push(ch, *key, vel.saturating_sub(5) + wobble, at + b as f64 * self.meter + o, 0.25);
                }
            }
        }
    }
}

/// Whether a melody note sits well on a chord: a chord tone, or a colour that does not rub (the 9th; the 11th
/// on minor and suspended chords; the 6th/13th on major and dominant chords).
pub fn fits(c: &Chord, key: u8) -> bool {
    if c.has(key) {
        return true;
    }
    let iv = (key as i32 - c.root as i32).rem_euclid(12) as u8;
    let minor = c.tones.contains(&3);
    let sus = c.tones.contains(&5) && !c.tones.contains(&4);
    let dim = c.tones.contains(&6) && !c.tones.contains(&7);
    match iv {
        2 => !dim,
        5 => minor || sus,
        9 => !minor && !dim,
        _ => false,
    }
}

/// The lowest key of a pitch class at or above `from`.
pub fn low_note(pc: u8, from: u8) -> u8 {
    let mut k = from;
    while k % 12 != pc {
        k += 1;
    }
    k
}
