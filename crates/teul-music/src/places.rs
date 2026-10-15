//! More of teul's music: the hours of the day and the seasons in the town, the places with a sound of their own
//! (the café, the church, the temple, the old forest circle), the four rift worlds and the town inside out, the
//! town's feasts and the rain. Written and arranged like the first pieces (pieces.rs): chords, melodies that sit
//! on their chords, a few acoustic instruments each, room to breathe at the end of every loop.

use crate::score::{drum, gm, progression, Piece};

/// More General MIDI programs (beyond score::gm) used here.
mod more {
    pub const HARPSICHORD: u8 = 6;
    pub const XYLOPHONE: u8 = 13;
    pub const TUBULAR_BELLS: u8 = 14;
    pub const CHURCH_ORGAN: u8 = 19;
    pub const TROMBONE: u8 = 57;
    pub const TUBA: u8 = 58;
    pub const SHAKUHACHI: u8 = 77;
    pub const SITAR: u8 = 104;
    pub const SHAMISEN: u8 = 106;
    pub const KOTO: u8 = 107;
    pub const FIDDLE: u8 = 110;
    pub const TAIKO: u8 = 116;
    pub const CHOIR_OOH: u8 = 53;
    pub const STEEL: u8 = 25;
    pub const BANJO: u8 = 105;
}

/// More drum keys (beyond score::drum).
mod hit {
    pub const LOW_TOM: u8 = 45;
    pub const MID_TOM: u8 = 47;
    pub const FLOOR_TOM: u8 = 41;
    pub const CHINA: u8 = 52;
    pub const CRASH: u8 = 49;
    pub const CLAVES: u8 = 75;
}

fn bars(n: u32, meter: f64) -> f64 {
    n as f64 * meter
}

/// Every new piece, by its mood.
pub fn all() -> Vec<Piece> {
    vec![
        morning(),
        evening(),
        spring(),
        summer(),
        autumn(),
        winter(),
        rain(),
        home_evening(),
        cafe(),
        church(),
        temple(),
        grove(),
        rift_spring(),
        rift_summer(),
        rift_autumn(),
        mirror(),
        lunar(),
        townday(),
        halloween(),
        winterlights(),
        midsummer(),
    ]
}

/// «Ранок у Липовому»: G major, the town waking. Harp, a flute, pizzicato, a glockenspiel, strings.
pub fn morning() -> Piece {
    let mut p = Piece::new("morning", 88.0, 4);
    let m = p.meter;
    let harp = p.part(gm::HARP, 92, 52, 60);
    let flute = p.part(gm::FLUTE, 88, 74, 60);
    let clar = p.part(gm::CLARINET, 84, 56, 55);
    let pizz = p.part(gm::PIZZICATO, 74, 44, 50);
    let glock = p.part(gm::GLOCKENSPIEL, 54, 86, 60);
    let strings = p.part(gm::SLOW_STRINGS, 56, 60, 70);
    let bass = p.part(gm::UPRIGHT, 70, 62, 25);
    p.lay_back(flute, 10.0);

    let intro = progression("Gmaj7 | Cmaj7 | Gmaj7 | D7sus4", m);
    let a = progression("G | D/F# | Em7 | Cmaj7 | G/B | Am7 | Cadd9 | D7sus4 D7", m);
    let b = progression("Cmaj7 | Bm7 | Am7 | D7 | Cmaj7 | Bm7 E7 | Am7 | D7sus4 D7", m);
    let mel_a = "b4 d'4 g'4 d'4 | f#'4 e'8 d'8 a4 d'4 | e'4 g'8 f#'8 e'4 b4 | c'2 e'4 g'4 | d'4 b8 c'8 d'4 g'4 | c'4 a8 b8 c'4 e'4 | d'4 e'8 d'8 c'4 g4 | a2 f#4 r4";
    let mel_b = "e'2 g'4 e'4 | d'2 f#'4 d'4 | c'4 b8 a8 e'4 c'4 | f#'2 d'2 | g'4 e'8 d'8 c'4 b4 | d'2 g#'2 | a'4 g'8 e'8 c'4 a4 | a2 d'4 r4";
    let order: &[usize] = &[0, 1, 2, 3, 4, 3, 2, 1];

    let mut at = 0.0;
    p.arp(harp, &intro, at, 0.5, order, 1.6, 42, 55, 79);
    p.sprinkle(glock, &intro, at, 1.0, 0.3, 36, 79, 91, 61);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, flute, 0, 62u8), (&b, mel_b, clar, -12, 60), (&a, mel_a, flute, 12, 56)] {
        p.arp(harp, prog, at, 0.5, order, 1.4, 40, 55, 79);
        p.pad(strings, prog, at, 30, 53, 74, 4);
        p.bass(bass, prog, at, "two", 48);
        p.block(pizz, prog, at, &[1.0, 3.0], 0.35, 40, 55, 72, 3);
        if ch != clar {
            p.sprinkle(glock, prog, at, 2.0, 0.3, 34, 79, 91, 62);
        }
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Cadd9 | G", m);
    p.arp(harp, &end, at, 0.5, order, 2.0, 36, 55, 79);
    p.pad(strings, &end, at, 28, 53, 74, 4);
    p.rest(2);
    p
}

/// «Вечір»: E-flat major, the lamps coming on. Nylon guitar, a cello, a clarinet, a soft pad.
pub fn evening() -> Piece {
    let mut p = Piece::new("evening", 70.0, 4);
    let m = p.meter;
    p.ritardando = 1.12;
    let guitar = p.part(gm::NYLON, 92, 60, 45);
    let cello = p.part(gm::CELLO, 84, 46, 60);
    let clar = p.part(gm::CLARINET, 84, 70, 55);
    let pad = p.part(gm::WARM_PAD, 46, 64, 80);
    let bass = p.part(gm::UPRIGHT, 70, 60, 25);
    p.lay_back(cello, 12.0);
    p.lay_back(clar, 12.0);

    let intro = progression("Ebmaj7 | Abmaj7 | Ebmaj7/G | Bb7sus4", m);
    let a = progression("Ebmaj7 | Cm7 | Abmaj7 | Bb7sus4 Bb7 | Gm7 | Cm7 | Fm7 | Bb7", m);
    let b = progression("Abmaj7 | Gm7 | Fm7 | Ebmaj7 | Abmaj7 | Gm7 C7 | Fm7 | Bb7sus4 Bb7", m);
    let mel_a = "g4 bb4 d'4 bb4 | c'4 eb'8 d'8 c'4 g4 | ab4 c'4 eb'2 | f'2 d'2 | d'4 bb8 g8 f4 g4 | eb4 g4 c'4 bb4 | ab4 c'8 bb8 ab4 f4 | bb2. r4";
    let mel_b = "c'2 eb'4 c'4 | bb2 d'4 bb4 | ab4 c'8 ab8 f4 ab4 | g2. r4 | eb'4 c'8 ab8 eb'4 c'4 | d'2 e'2 | f'4 eb'8 c'8 ab4 c'4 | bb2 ab2";

    let mut at = 0.0;
    p.pick(guitar, &intro, at, 46);
    p.pad(pad, &intro, at, 34, 51, 70, 4);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, clar, 0, 60u8), (&b, mel_b, cello, -12, 64), (&a, mel_a, guitar, 12, 54)] {
        p.pick(guitar, prog, at, 44);
        p.pad(pad, prog, at, 32, 51, 70, 4);
        p.bass(bass, prog, at, "two", 46);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Abmaj7 | Ebmaj7", m);
    p.pick(guitar, &end, at, 40);
    p.pad(pad, &end, at, 30, 51, 70, 4);
    p.rest(2);
    p
}

/// «Весна»: D major, bright and quick. A flute, a clarinet, pizzicato, a nylon guitar, a glockenspiel, brushes.
pub fn spring() -> Piece {
    let mut p = Piece::new("spring", 104.0, 4);
    let m = p.meter;
    let guitar = p.part(gm::NYLON, 90, 72, 35);
    let flute = p.part(gm::FLUTE, 88, 60, 55);
    let clar = p.part(gm::CLARINET, 84, 54, 50);
    let pizz = p.part(gm::PIZZICATO, 76, 46, 45);
    let glock = p.part(gm::GLOCKENSPIEL, 54, 86, 55);
    let bass = p.part(gm::UPRIGHT, 70, 60, 25);
    let kit = p.drums(gm::KIT_BRUSH, 50, 30);

    let intro = progression("D | G | D | A7sus4", m);
    let a = progression("D | A/C# | Bm7 | Gmaj7 | D/F# | Em7 | G A | D", m);
    let b = progression("G | A | F#m7 | Bm7 | Em7 | A7 | Gmaj7 | A7sus4 A7", m);
    let mel_a = "a4 d'8 e'8 f#'4 d'4 | e'4 c#'8 d'8 e'4 a4 | f#'4 d'8 c#'8 b4 d'4 | d'2 b4 r4 | a4 f#8 g8 a4 d'4 | g'4 f#'8 e'8 d'4 b4 | b2 c#'2 | d'2. r4";
    let mel_b = "b4 d'8 g'8 b'4 g'4 | a'2 e'4 c#'4 | c#'4 e'8 f#'8 a'4 e'4 | d'2 b2 | e'4 g'8 f#'8 e'4 b4 | c#'2 g'2 | f#'4 d'4 b4 d'4 | e'2 c#'2";
    let brush: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 40), (drum::BRUSH_SWIRL, &[1.0, 3.0], 36), (drum::SHAKER, &[0.5, 1.5, 2.5, 3.5], 26)];

    let mut at = 0.0;
    p.pick(guitar, &intro, at, 48);
    p.sprinkle(glock, &intro, at, 1.0, 0.35, 38, 79, 91, 71);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, flute, 0, 62u8), (&b, mel_b, clar, -12, 60), (&a, mel_a, flute, 0, 58), (&b, mel_b, flute, 0, 58)] {
        p.pick(guitar, prog, at, 46);
        p.bass(bass, prog, at, "two", 50);
        p.block(pizz, prog, at, &[1.0, 3.0], 0.3, 40, 55, 72, 3);
        p.groove(kit, at, 8, brush, &[]);
        p.sprinkle(glock, prog, at, 2.0, 0.25, 34, 79, 91, 72);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("G A | D", m);
    p.pick(guitar, &end, at, 42);
    p.bass(bass, &end, at, "root", 46);
    p.rest(2);
    p
}

/// «Літо»: C major, a warm lazy afternoon by the lake. Steel guitar, an accordion, a fiddle, a banjo, a shaker.
pub fn summer() -> Piece {
    let mut p = Piece::new("summer", 112.0, 4);
    let m = p.meter;
    let guitar = p.part(more::STEEL, 84, 44, 35);
    let acc = p.part(gm::ACCORDION, 66, 72, 40);
    let fiddle = p.part(gm::VIOLIN, 84, 58, 45);
    let banjo = p.part(more::BANJO, 66, 82, 30);
    let bass = p.part(gm::UPRIGHT, 70, 60, 20);
    let kit = p.drums(gm::KIT_BRUSH, 52, 25);
    p.lay_back(fiddle, 8.0);

    let intro = progression("C | F | C | G", m);
    let a = progression("C | Am | F | G | C | Em7 | F G | C", m);
    let b = progression("F | G | Em | Am | Dm7 | G | Em7 A7 | Dm7 G7", m);
    let mel_a = "e'4 g'8 e'8 c'4 g4 | a4 c'8 e'8 a'4 e'4 | f'4 a'8 f'8 c'4 a4 | g'2 d'4 b4 | e'4 g'4 c'4 e'4 | d'4 e'8 d'8 b4 g4 | a2 b2 | c'2. r4";
    let mel_b = "c'2 a4 f4 | b2 d'4 g4 | g'2 e'4 b4 | a'2 e'4 c'4 | d'4 f'8 e'8 d'4 a4 | g4 b4 d'4 f'4 | g'2 c#'2 | f'2 d'2";
    let groove: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 42), (drum::SIDE_STICK, &[1.0, 3.0], 34), (drum::SHAKER, &[0.5, 1.5, 2.5, 3.5], 28)];

    let mut at = 0.0;
    p.block(guitar, &intro, at, &[0.0, 1.0, 2.0, 3.0], 0.5, 40, 52, 67, 4);
    at += bars(4, m);
    for (i, (prog, mel, ch, tr, vel)) in [(&a, mel_a, fiddle, 0, 62u8), (&b, mel_b, acc, 0, 58), (&a, mel_a, fiddle, 0, 60), (&b, mel_b, fiddle, 0, 58)].into_iter().enumerate() {
        p.block(guitar, prog, at, &[0.0, 1.0, 2.0, 3.0], 0.5, 40, 52, 67, 4);
        p.bass(bass, prog, at, "two", 52);
        p.groove(kit, at, 8, groove, &[]);
        if i % 2 == 0 {
            p.arp(banjo, prog, at, 0.5, &[1, 2, 3, 2], 0.6, 36, 60, 76);
        }
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("F G | C", m);
    p.block(guitar, &end, at, &[0.0], 2.0, 40, 52, 67, 4);
    p.bass(bass, &end, at, "root", 48);
    p.rest(1);
    p
}

/// «Осінь»: A minor, leaves on the wet road. Nylon guitar, a cello, an oboe, an upright bass.
pub fn autumn() -> Piece {
    let mut p = Piece::new("autumn", 80.0, 4);
    let m = p.meter;
    let guitar = p.part(gm::NYLON, 94, 66, 45);
    let cello = p.part(gm::CELLO, 84, 46, 60);
    let oboe = p.part(gm::OBOE, 80, 58, 55);
    let strings = p.part(gm::SLOW_STRINGS, 50, 52, 70);
    let bass = p.part(gm::UPRIGHT, 70, 60, 25);
    p.lay_back(oboe, 12.0);

    let intro = progression("Am | Fmaj7 | Am | E7sus4", m);
    let a = progression("Am | Dm7 | G | Cmaj7 | Fmaj7 | Dm7 | E7sus4 | E7", m);
    let b = progression("Fmaj7 | G | Em7 | Am | Dm7 | G | Cmaj7 | E7", m);
    let mel_a = "c'4 e'8 d'8 c'4 a4 | f'4 a'8 g'8 f'4 d'4 | d'4 b8 c'8 d'4 g'4 | e'2 b4 c'4 | a'4 g'8 f'8 e'4 c'4 | d'4 f'8 e'8 d'4 a4 | b4 a4 e4 a4 | g#2. r4";
    let mel_b = "c'2 a4 f4 | d'2 b4 g4 | e'2 g'4 e'4 | c'2 a2 | f'4 e'8 d'8 c'4 a4 | b2 d'2 | e'4 d'8 c'8 b4 g4 | g#2 b2";

    let mut at = 0.0;
    p.pick(guitar, &intro, at, 48);
    p.pad(strings, &intro, at, 28, 52, 72, 4);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, oboe, 0, 60u8), (&b, mel_b, cello, -12, 64), (&a, mel_a, guitar, 0, 56), (&b, mel_b, oboe, 0, 58)] {
        p.pick(guitar, prog, at, 46);
        p.bass(bass, prog, at, "two", 48);
        p.pad(strings, prog, at, 28, 52, 72, 4);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("E7sus4 | Am", m);
    p.pick(guitar, &end, at, 40);
    p.pad(strings, &end, at, 26, 52, 72, 4);
    p.rest(2);
    p
}

/// «Зима»: D major in three, snow on the square. Celesta, a harp, a flute, strings, a glockenspiel.
pub fn winter() -> Piece {
    let mut p = Piece::new("winter", 92.0, 3);
    let m = p.meter;
    p.ritardando = 1.15;
    let cel = p.part(gm::CELESTA, 84, 72, 75);
    let harp = p.part(gm::HARP, 90, 50, 70);
    let flute = p.part(gm::FLUTE, 84, 64, 70);
    let strings = p.part(gm::SLOW_STRINGS, 56, 56, 80);
    let glock = p.part(gm::GLOCKENSPIEL, 50, 88, 70);

    let intro = progression("D | G | D | A", m);
    let a = progression("D | Bm | G | A | D | Em | A7 | D", m);
    let b = progression("G | D | Em | A | G | D | A7 | D", m);
    let mel_a = "f#'4 a'4 d'4 | d'2 b4 | b4 d'4 g'4 | a'2 e'4 | f#'4 e'4 d'4 | e'2 b4 | c#'4 e'4 g'4 | d'2.";
    let mel_b = "g'2 b'4 | a'2 f#'4 | g'4 e'4 b4 | c#'2 e'4 | d'4 g'4 b'4 | a'2 f#'4 | e'4 g'4 c#'4 | d'2.";

    let mut at = 0.0;
    p.arp(harp, &intro, at, 1.0, &[0, 2, 3], 2.0, 40, 55, 79);
    p.pad(strings, &intro, at, 30, 53, 74, 4);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, cel, 0, 56u8), (&b, mel_b, flute, 0, 58), (&a, mel_a, flute, 0, 56), (&b, mel_b, cel, 0, 52), (&a, mel_a, cel, 0, 50)] {
        p.arp(harp, prog, at, 1.0, &[0, 2, 3], 2.0, 38, 55, 79);
        p.pad(strings, prog, at, 28, 53, 74, 4);
        p.sprinkle(glock, prog, at, 1.0, 0.2, 32, 79, 91, 81);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("G | D", m);
    p.arp(harp, &end, at, 1.0, &[0, 2, 3, 4], 3.0, 34, 55, 79);
    p.pad(strings, &end, at, 26, 53, 74, 4);
    p.rest(2);
    p
}

/// «Дощ»: A minor, a piano by the window in the rain. Piano, slow strings, a cello.
pub fn rain() -> Piece {
    let mut p = Piece::new("rain", 62.0, 4);
    let m = p.meter;
    p.ritardando = 1.15;
    let piano = p.part(gm::PIANO, 90, 58, 75);
    let strings = p.part(gm::SLOW_STRINGS, 54, 52, 85);
    let cello = p.part(gm::CELLO, 78, 46, 70);
    p.lay_back(cello, 14.0);

    let a = progression("Am9 | Fmaj7 | Cmaj7 | G6 | Am9 | Fmaj7 | Dm9 | Esus4 E7", m);
    let b = progression("Fmaj7 | G6 | Em7 | Am9 | Dm9 | G6 | Cmaj7 | Esus4 E7", m);
    let mel_a = "e'2 c'4 b4 | a2 c'2 | b2 g4 e4 | d'2 b2 | c'4 b8 a8 e'4 c'4 | f'2 e'2 | d'4 e'8 f'8 a'4 f'4 | b2 g#2";
    let mel_b = "a'2 f'4 e'4 | d'2 b4 g4 | g'2 e'4 b4 | a'2 e'2 | f'2 a'4 f'4 | e'2 d'2 | c'2 e'4 g'4 | e'2 d'2";
    let order: &[usize] = &[0, 1, 2, 3, 2, 1, 2, 3];

    let mut at = 0.0;
    p.arp(piano, &a[..4], at, 0.5, order, 1.4, 38, 50, 74);
    p.pad(strings, &a[..4], at, 28, 52, 72, 4);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, piano, 0, 56u8), (&b, mel_b, cello, -12, 60), (&a, mel_a, piano, 0, 50)] {
        p.arp(piano, prog, at, 0.5, order, 1.4, 34, 50, 70);
        p.pad(strings, prog, at, 26, 52, 72, 4);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Fmaj7 | Am9", m);
    p.arp(piano, &end, at, 0.5, order, 2.0, 30, 50, 74);
    p.pad(strings, &end, at, 26, 52, 72, 4);
    p.rest(2);
    p
}

/// «Вечір удома»: A-flat major, the lamp on, tea. Electric piano, an upright bass, a vibraphone, soft strings.
pub fn home_evening() -> Piece {
    let mut p = Piece::new("home_evening", 66.0, 4);
    let m = p.meter;
    p.ritardando = 1.1;
    let ep = p.part(gm::EPIANO, 88, 56, 55);
    let bass = p.part(gm::UPRIGHT, 70, 60, 25);
    let vib = p.part(gm::VIBRAPHONE, 80, 72, 65);
    let strings = p.part(gm::SLOW_STRINGS, 48, 50, 80);
    p.chorus(ep, 30);
    p.lay_back(vib, 16.0);

    let intro = progression("Abmaj7 | Dbmaj7 | Abmaj7 | Eb7sus4", m);
    let a = progression("Abmaj7 | Fm7 | Dbmaj7 | Eb7sus4 | Cm7 | Fm7 | Bbm7 | Eb7", m);
    let mel_a = "c'4 eb'8 g'8 ab'4 g'4 | ab'4 f'8 eb'8 c'4 ab4 | f'2 c'4 db'4 | bb2 ab2 | g4 bb8 c'8 eb'4 c'4 | c'2 ab4 f4 | db'4 f'8 db'8 bb4 ab4 | g2. r4";

    let mut at = 0.0;
    p.block(ep, &intro, at, &[0.0, 2.5], 1.4, 40, 55, 74, 4);
    p.pad(strings, &intro, at, 26, 52, 72, 4);
    at += bars(4, m);
    for (ch, tr, vel) in [(vib, 0, 58u8), (ep, 12, 54), (vib, 0, 54)] {
        p.block(ep, &a, at, &[0.0, 2.5], 1.4, 38, 55, 74, 4);
        p.bass(bass, &a, at, "two", 46);
        p.pad(strings, &a, at, 24, 52, 72, 4);
        p.sing(ch, &a, mel_a, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Dbmaj7 | Abmaj7", m);
    p.block(ep, &end, at, &[0.0], 6.0, 34, 55, 74, 4);
    p.bass(bass, &end, at, "root", 42);
    p.rest(2);
    p
}

/// «Кав'ярня «Липа»»: F major, a jazz trio in the corner. Piano, an upright bass walking, brushes, a vibraphone,
/// a muted trumpet.
pub fn cafe() -> Piece {
    let mut p = Piece::new("cafe", 120.0, 4);
    let m = p.meter;
    let piano = p.part(gm::PIANO, 88, 54, 45);
    let bass = p.part(gm::UPRIGHT, 74, 60, 20);
    let vib = p.part(gm::VIBRAPHONE, 80, 74, 50);
    let tpt = p.part(gm::MUTED_TRUMPET, 72, 64, 50);
    let kit = p.drums(gm::KIT_BRUSH, 56, 30);
    p.lay_back(vib, 14.0);
    p.lay_back(tpt, 18.0);

    let intro = progression("Fmaj7 | Dm7 | Gm7 | C7", m);
    let a = progression("Fmaj7 | D7 | Gm7 | C7 | Am7 | D7 | Gm7 C7 | Fmaj7", m);
    let b = progression("Bbmaj7 | Bbm7 Eb7 | Am7 | D7 | Gm7 | C7 | Fmaj7 D7 | Gm7 C7", m);
    let mel_a = "a4 c'8 e'8 f'4 e'4 | f#'4 d'8 c'8 a4 f#4 | bb4 d'4 f'4 d'4 | e'2 g4 bb4 | c'4 e'8 g'8 a'4 g'4 | f#'2 d'4 c'4 | bb4 a4 g4 e4 | f2. r4";
    let mel_b = "d'4 f'8 a'8 bb'4 a'4 | db'2 g'2 | e'4 c'8 a8 g4 a4 | f#2 a2 | g4 bb4 d'4 f'4 | e'2 c'2 | a4 c'4 f#'4 d'4 | g2 e2";
    let swing: &[(u8, &[f64], u8)] = &[(drum::RIDE, &[0.0, 1.0, 1.67, 2.0, 3.0, 3.67], 34), (drum::PEDAL_HAT, &[1.0, 3.0], 30), (drum::KICK, &[0.0], 22)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::RIDE, &[0.0, 1.0, 1.67, 2.0], 34), (drum::BRUSH_SWIRL, &[2.67, 3.0, 3.67], 36)];

    let mut at = 0.0;
    p.block(piano, &intro, at, &[0.0, 1.67, 3.0], 0.8, 42, 55, 74, 4);
    p.bass(bass, &intro, at, "walk", 54);
    p.groove(kit, at, 4, swing, &[]);
    at += bars(4, m);
    for (prog, mel, ch, tr) in [(&a, mel_a, piano, 12), (&a, mel_a, tpt, 0), (&b, mel_b, vib, 0), (&a, mel_a, vib, 0)] {
        p.block(piano, prog, at, &[0.0, 1.67, 3.0], 0.8, 40, 55, 74, 4);
        p.bass(bass, prog, at, "walk", 54);
        p.groove(kit, at, 8, swing, fill);
        p.sing(ch, prog, mel, at, 60, tr);
        at += bars(8, m);
    }
    let end = progression("Gm7 C7 | Fmaj7", m);
    p.block(piano, &end, at, &[0.0, 2.0], 1.8, 36, 55, 74, 4);
    p.bass(bass, &end, at, "root", 48);
    p.rest(1);
    p
}

/// «Костел»: D major, a hymn on the organ with the choir far back under it.
pub fn church() -> Piece {
    let mut p = Piece::new("church", 60.0, 4);
    let m = p.meter;
    p.ritardando = 1.2;
    let organ = p.part(more::CHURCH_ORGAN, 80, 64, 110);
    let melody = p.part(more::CHURCH_ORGAN, 74, 60, 110);
    let choir = p.part(gm::CHOIR, 50, 56, 120);

    let intro = progression("D | G | D/F# | A", m);
    let a = progression("D | A/C# | Bm | F#m/A | G | D/F# | Em7 A7 | D", m);
    let b = progression("G | D | Em | Bm | G | A | Bm7 E7 | A", m);
    let mel_a = "f#2 a2 | a2 e2 | f#2 d2 | c#2 f#2 | d2 b,2 | a,2 d2 | e2 c#2 | d1";
    let mel_b = "b2 d'2 | a2 f#2 | g2 e2 | f#2 d2 | b2 g2 | a2 c#'2 | d'2 b2 | a1";

    let mut at = 0.0;
    p.pad(organ, &intro, at, 40, 45, 69, 4);
    at += bars(4, m);
    for (prog, mel, choir_on) in [(&a, mel_a, false), (&b, mel_b, true), (&a, mel_a, true), (&a, mel_a, false)] {
        p.pad(organ, prog, at, 38, 45, 66, 4);
        if choir_on {
            p.pad(choir, prog, at, 30, 52, 69, 3);
        }
        p.sing(melody, prog, mel, at, 56, 12);
        at += bars(8, m);
    }
    let end = progression("G | D", m);
    p.pad(organ, &end, at, 34, 45, 69, 4);
    p.pad(choir, &end, at, 26, 52, 69, 3);
    p.rest(2);
    p
}

/// «Храм Тихого Лотоса»: D major pentatonic, very slow. A koto, a shakuhachi, a pan flute, a halo pad, bells.
pub fn temple() -> Piece {
    let mut p = Piece::new("temple", 56.0, 4);
    let m = p.meter;
    p.ritardando = 1.1;
    let koto = p.part(more::KOTO, 90, 50, 80);
    let shaku = p.part(more::SHAKUHACHI, 84, 70, 90);
    let pan = p.part(gm::PAN_FLUTE, 76, 64, 90);
    let pad = p.part(gm::HALO_PAD, 46, 64, 100);
    let bells = p.part(more::TUBULAR_BELLS, 48, 76, 110);
    p.lay_back(shaku, 20.0);

    let intro = progression("Dadd9 | Gmaj7 | Dadd9 | Asus4", m);
    let a = progression("Dadd9 | Bm7 | Gmaj7 | Asus4 | Dadd9 | Em7 | Gmaj7 | Asus4", m);
    let mel = "a2 f#4 e4 | d'2 b4 a4 | b2 d'2 | e'2 d'2 | f#'2 e'4 d'4 | b2 e'2 | d'2 b4 a4 | a1";

    let mut at = 0.0;
    p.arp(koto, &intro, at, 1.0, &[0, 2, 3, 4], 3.0, 40, 50, 74);
    p.pad(pad, &intro, at, 32, 50, 69, 4);
    p.sprinkle(bells, &intro, at, 4.0, 0.5, 34, 62, 74, 91);
    at += bars(4, m);
    for (ch, tr, vel, order) in [(shaku, 0, 60u8, &[0usize, 2, 3, 4][..]), (pan, 12, 54, &[0, 3, 2, 4][..]), (koto, 12, 52, &[0, 2][..])] {
        p.arp(koto, &a, at, 1.0, order, 3.0, 36, 50, 74);
        p.pad(pad, &a, at, 30, 50, 69, 4);
        p.sprinkle(bells, &a, at, 4.0, 0.35, 30, 62, 74, 92);
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Gmaj7 | Dadd9", m);
    p.arp(koto, &end, at, 1.0, &[0, 2, 3, 4], 4.0, 32, 50, 74);
    p.pad(pad, &end, at, 28, 50, 69, 4);
    p.rest(2);
    p
}

/// «Старе коло»: D minor, the full moon in the forest. Taiko and toms, a choir holding a drone, a pan flute, low
/// strings, timpani on the roots.
pub fn grove() -> Piece {
    let mut p = Piece::new("grove", 92.0, 4);
    let m = p.meter;
    p.ritardando = 1.0;
    let choir = p.part(more::CHOIR_OOH, 52, 60, 110);
    let pan = p.part(gm::PAN_FLUTE, 82, 70, 80);
    let strings = p.part(gm::STRINGS, 56, 48, 80);
    let timp = p.part(gm::TIMPANI, 62, 60, 70);
    let taiko = p.part(more::TAIKO, 64, 54, 60);
    let kit = p.drums(gm::KIT_STANDARD, 50, 50);

    let intro = progression("Dm | - | C | Dm", m);
    let a = progression("Dm | C | Dm | Am | Dm | C | Bb | A", m);
    let mel = "d4 f4 a4 f4 | e4 g4 c'4 g4 | f4 a8 g8 f4 d4 | e2 c4 e4 | a4 d'4 a4 f4 | g4 e4 c4 e4 | f2 d2 | e1";
    let beat: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 1.5, 2.0], 50), (hit::LOW_TOM, &[3.0, 3.5], 44), (hit::FLOOR_TOM, &[1.0], 36)];
    let roll: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 50), (hit::LOW_TOM, &[2.5, 3.0], 46), (hit::MID_TOM, &[3.25, 3.5, 3.75], 44)];

    let mut at = 0.0;
    p.pad(choir, &intro, at, 32, 50, 65, 3);
    p.groove(kit, at, 4, beat, &[]);
    p.bass(timp, &intro, at, "root", 46);
    at += bars(4, m);
    for (i, (ch, tr, vel)) in [(pan, 0, 60u8), (pan, 12, 56), (strings, 0, 50), (pan, 12, 54)].into_iter().enumerate() {
        p.pad(choir, &a, at, 30, 50, 65, 3);
        if ch != strings {
            p.pad(strings, &a, at, 26, 38, 55, 2);
        }
        p.groove(kit, at, 8, beat, roll);
        p.bass(timp, &a, at, "root", 44);
        if i % 2 == 1 {
            p.block(taiko, &a, at, &[0.0, 2.0], 0.6, 46, 36, 52, 1);
        }
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Bb A | Dm", m);
    p.pad(choir, &end, at, 28, 50, 65, 3);
    p.bass(timp, &end, at, "root", 44);
    p.rest(2);
    p
}

/// «Затонула оранжерея» (весняний розлом): C lydian, a glasshouse under water. Celesta, a harp, a flute, a warm
/// pad.
pub fn rift_spring() -> Piece {
    let mut p = Piece::new("rift_spring", 70.0, 4);
    let m = p.meter;
    let cel = p.part(gm::CELESTA, 84, 72, 100);
    let harp = p.part(gm::HARP, 88, 50, 100);
    let flute = p.part(gm::FLUTE, 80, 64, 100);
    let pad = p.part(gm::WARM_PAD, 50, 60, 110);
    p.lay_back(flute, 16.0);

    let intro = progression("Cmaj7#11 | D/C | Cmaj7#11 | D/C", m);
    let a = progression("Cmaj7#11 | D/C | Em7 | Am7 | Fmaj7 | G6 | Cmaj7#11 | D/C", m);
    let mel = "e'4 f#'4 g'2 | a'2 f#'2 | g'4 e'4 b2 | c'2 e'2 | a'4 g'8 f'8 e'4 c'4 | d'2 b2 | f#'2 e'2 | d'1";

    let mut at = 0.0;
    p.arp(harp, &intro, at, 0.5, &[0, 2, 4, 3, 1, 3, 4, 2], 2.0, 40, 55, 81);
    p.pad(pad, &intro, at, 34, 50, 69, 4);
    at += bars(4, m);
    for (ch, tr, vel) in [(cel, 0, 58u8), (flute, 0, 58), (cel, 12, 50)] {
        p.arp(harp, &a, at, 0.5, &[0, 2, 4, 3, 1, 3, 4, 2], 2.0, 36, 55, 81);
        p.pad(pad, &a, at, 32, 50, 69, 4);
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Fmaj7 | Cmaj7#11", m);
    p.arp(harp, &end, at, 0.5, &[0, 2, 4, 3], 3.0, 32, 55, 81);
    p.pad(pad, &end, at, 28, 50, 69, 4);
    p.rest(2);
    p
}

/// «Соляне море» (літній розлом): D hijaz, a mirage over white salt. A shamisen, a sitar drone, a shakuhachi, a pad,
/// a frame drum and finger cymbals.
pub fn rift_summer() -> Piece {
    let mut p = Piece::new("rift_summer", 84.0, 4);
    let m = p.meter;
    let sham = p.part(more::SHAMISEN, 82, 50, 70);
    let sitar = p.part(more::SITAR, 60, 74, 80);
    let shaku = p.part(more::SHAKUHACHI, 82, 62, 90);
    let pad = p.part(gm::WARM_PAD, 46, 64, 100);
    let kit = p.drums(gm::KIT_STANDARD, 46, 50);
    p.lay_back(shaku, 16.0);

    let intro = progression("D | Eb | D | -", m);
    let a = progression("D | Eb | D | Gm | D | Eb | Cm | D", m);
    let mel = "d'4 eb'8 f#'8 a'4 f#'4 | g'4 f#'8 eb'8 bb4 g4 | f#'2 d'2 | bb4 a8 g8 d'4 bb4 | a4 bb8 a8 f#4 d4 | eb4 g4 bb4 g4 | c'4 bb8 a8 g4 eb4 | d2. r4";
    let beat: &[(u8, &[f64], u8)] = &[(hit::LOW_TOM, &[0.0, 1.5], 40), (drum::TAMBOURINE, &[1.0, 3.0], 26), (drum::TRIANGLE, &[2.5], 24)];

    let mut at = 0.0;
    p.pad(pad, &intro, at, 32, 50, 66, 3);
    p.arp(sham, &intro, at, 0.5, &[0, 2, 1, 2], 0.6, 40, 50, 69);
    at += bars(4, m);
    for (ch, tr, vel) in [(shaku, 0, 60u8), (sitar, -12, 56), (shaku, 0, 56)] {
        p.pad(pad, &a, at, 30, 50, 66, 3);
        p.arp(sham, &a, at, 0.5, &[0, 2, 1, 2], 0.6, 38, 50, 69);
        p.groove(kit, at, 8, beat, &[]);
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Eb | D", m);
    p.pad(pad, &end, at, 28, 50, 66, 3);
    p.arp(sham, &end, at, 1.0, &[0, 2, 1], 1.0, 34, 50, 69);
    p.rest(2);
    p
}

/// «Годинниковий сад» (осінній розлом): A minor, a garden that ticks. A music box, pizzicato, a marimba, a
/// bassoon, wood blocks for the clocks.
pub fn rift_autumn() -> Piece {
    let mut p = Piece::new("rift_autumn", 100.0, 4);
    let m = p.meter;
    let mbox = p.part(gm::MUSIC_BOX, 86, 70, 70);
    let pizz = p.part(gm::PIZZICATO, 78, 46, 50);
    let marimba = p.part(gm::MARIMBA, 80, 56, 55);
    let bassoon = p.part(gm::BASSOON, 78, 52, 55);
    let kit = p.drums(gm::KIT_STANDARD, 46, 30);

    let intro = progression("Am | F | C | E", m);
    let a = progression("Am | F | C | E | Am | Dm | E | Am", m);
    let mel = "a4 c'4 e'4 c'4 | f'4 a'4 c'4 a4 | e'4 g'4 c'4 g4 | g#4 b4 e'4 b4 | c'4 b4 a4 e4 | f4 a4 d'4 a4 | b4 g#4 e4 g#4 | a2. r4";
    let tick: &[(u8, &[f64], u8)] = &[(drum::WOOD_HI, &[0.0, 1.0, 2.0, 3.0], 34), (drum::WOOD_LO, &[0.5, 1.5, 2.5, 3.5], 28), (hit::CLAVES, &[3.75], 24)];

    let mut at = 0.0;
    p.arp(marimba, &intro, at, 0.5, &[0, 1, 2, 1], 0.4, 40, 55, 76);
    p.groove(kit, at, 4, tick, &[]);
    at += bars(4, m);
    for (ch, tr, vel) in [(mbox, 0, 58u8), (bassoon, -12, 62), (mbox, 12, 52)] {
        p.arp(marimba, &a, at, 0.5, &[0, 1, 2, 1], 0.4, 36, 55, 76);
        p.block(pizz, &a, at, &[0.0, 2.0], 0.4, 40, 48, 64, 2);
        p.groove(kit, at, 8, tick, &[]);
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("E | Am", m);
    p.arp(marimba, &end, at, 0.5, &[0, 1, 2, 3], 1.0, 34, 55, 76);
    p.rest(2);
    p
}

/// «Липове навиворіт» (зимовий розлом): E-flat minor in three, the town turned inside out. A halo pad, a celesta,
/// a vibraphone, a music box, a distant choir.
pub fn mirror() -> Piece {
    let mut p = Piece::new("mirror", 58.0, 3);
    let m = p.meter;
    p.ritardando = 1.25;
    let pad = p.part(gm::HALO_PAD, 50, 64, 120);
    let cel = p.part(gm::CELESTA, 78, 76, 110);
    let vib = p.part(gm::VIBRAPHONE, 72, 50, 110);
    let mbox = p.part(gm::MUSIC_BOX, 70, 84, 120);
    let choir = p.part(gm::CHOIR, 40, 58, 127);

    let intro = progression("Ebm | Cbmaj7 | Ebm | Bbsus4", m);
    let a = progression("Ebm | Cbmaj7 | Ebm | Bbsus4 | Abm | Ebm | Cbmaj7 | Bb7", m);
    let mel = "gb4 bb4 eb'4 | eb'2 bb4 | gb'2 eb'4 | f'2. | eb'4 cb'4 ab4 | bb2 gb4 | bb4 gb4 eb4 | d2.";

    let mut at = 0.0;
    p.pad(pad, &intro, at, 32, 50, 66, 4);
    p.arp(vib, &intro, at, 1.0, &[0, 2, 3], 2.5, 34, 55, 74);
    at += bars(4, m);
    for (ch, tr, vel) in [(cel, 0, 54u8), (mbox, 12, 50), (vib, 0, 52), (cel, 12, 46)] {
        p.pad(pad, &a, at, 30, 50, 66, 4);
        p.arp(vib, &a, at, 1.0, &[0, 2, 3], 2.5, 30, 55, 74);
        if ch == vib {
            p.pad(choir, &a, at, 26, 55, 70, 3);
        }
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Cbmaj7 | Ebm", m);
    p.pad(pad, &end, at, 26, 50, 66, 4);
    p.pad(choir, &end, at, 22, 55, 70, 3);
    p.rest(2);
    p
}

/// «Місячний Новий рік»: G pentatonic, the dragon down the main street. A koto, a fiddle like an erhu, a piccolo
/// like a dizi, pizzicato, timpani, toms and the china cymbal for the gongs.
pub fn lunar() -> Piece {
    let mut p = Piece::new("lunar", 116.0, 4);
    let m = p.meter;
    let koto = p.part(more::KOTO, 88, 50, 50);
    let erhu = p.part(gm::VIOLIN, 84, 64, 55);
    let dizi = p.part(gm::PICCOLO, 66, 74, 55);
    let pizz = p.part(gm::PIZZICATO, 74, 44, 45);
    let timp = p.part(gm::TIMPANI, 60, 60, 50);
    let kit = p.drums(gm::KIT_STANDARD, 52, 35);
    p.lay_back(erhu, 10.0);

    let intro = progression("G | Em | C | D", m);
    let a = progression("G | Em | C | D | G | Em | Am7 D | G", m);
    let mel = "d'4 e'8 d'8 b4 g4 | e'4 g'8 e'8 b4 g4 | e'4 d'8 e'8 g'4 e'4 | a'4 g'8 e'8 d'4 a4 | b'4 a'8 g'8 d'4 g'4 | g'4 e'8 d'8 e'4 b4 | e'2 d'2 | g'2. r4";
    let drums: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 48), (hit::MID_TOM, &[1.0, 1.5, 3.0], 40), (drum::HAT, &[0.5, 2.5], 26)];
    let gong: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 48), (hit::LOW_TOM, &[2.5, 3.0, 3.5], 44), (hit::CHINA, &[0.0], 50)];

    let mut at = 0.0;
    p.groove(kit, at, 4, drums, gong);
    p.bass(timp, &intro, at, "root", 50);
    p.arp(koto, &intro, at, 0.5, &[0, 1, 2, 3], 0.8, 42, 55, 79);
    at += bars(4, m);
    for (ch, tr, vel) in [(erhu, 0, 64u8), (dizi, 0, 56), (koto, 0, 60), (erhu, 0, 62)] {
        p.arp(koto, &a, at, 0.5, &[0, 1, 2, 3], 0.8, 38, 55, 79);
        p.block(pizz, &a, at, &[0.0, 1.0, 2.0, 3.0], 0.3, 38, 48, 64, 2);
        p.groove(kit, at, 8, drums, gong);
        p.bass(timp, &a, at, "root", 46);
        p.sing(ch, &a, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("D | G", m);
    p.bass(timp, &end, at, "root", 54);
    p.arp(koto, &end, at, 0.5, &[0, 1, 2, 3, 4], 2.0, 40, 55, 79);
    p.rest(1);
    p
}

/// «День Липового»: B-flat major, the town band on the square. A trumpet, a clarinet, a trombone, a tuba, a
/// glockenspiel, the snare and the bass drum of a march.
pub fn townday() -> Piece {
    let mut p = Piece::new("townday", 112.0, 4);
    let m = p.meter;
    let tpt = p.part(gm::TRUMPET, 80, 66, 45);
    let clar = p.part(gm::CLARINET, 78, 54, 45);
    let bone = p.part(more::TROMBONE, 74, 46, 45);
    let tuba = p.part(more::TUBA, 80, 60, 35);
    let glock = p.part(gm::GLOCKENSPIEL, 50, 84, 50);
    let kit = p.drums(gm::KIT_STANDARD, 54, 30);

    let intro = progression("Bb | F7 | Bb | F7", m);
    let a = progression("Bb | Eb | F7 | Bb | Gm | Cm7 | F7 | Bb", m);
    let b = progression("Eb | Bb | F7 | Bb | Eb | Bb/D | C7 | F7", m);
    let mel_a = "f4 bb4 d'4 bb4 | g4 bb4 eb'4 bb4 | a4 c'4 eb'4 c'4 | d'2 bb2 | bb4 d'8 c'8 bb4 g4 | c'4 eb'8 d'8 c'4 g4 | a4 f4 c'4 eb'4 | d'2. r4";
    let mel_b = "g'2 eb'2 | f'2 d'2 | c'4 eb'4 f'4 a4 | bb2. r4 | eb'4 g'4 bb'4 g'4 | f'2 d'2 | e'4 g'4 bb4 c'4 | a2 f2";
    let march: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 50), (drum::SNARE, &[1.0, 3.0, 3.5], 38)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 50), (drum::SNARE, &[2.5, 2.75, 3.0, 3.25, 3.5], 40), (hit::CRASH, &[0.0], 34)];

    let mut at = 0.0;
    p.bass(tuba, &intro, at, "two", 56);
    p.block(bone, &intro, at, &[1.0, 3.0], 0.4, 44, 48, 64, 3);
    p.groove(kit, at, 4, march, fill);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, tpt, 0, 66u8), (&b, mel_b, clar, 0, 62), (&a, mel_a, tpt, 0, 64), (&b, mel_b, tpt, -12, 62), (&a, mel_a, clar, 12, 58)] {
        p.bass(tuba, prog, at, "two", 54);
        p.block(bone, prog, at, &[1.0, 3.0], 0.4, 42, 48, 64, 3);
        p.groove(kit, at, 8, march, fill);
        p.sprinkle(glock, prog, at, 2.0, 0.3, 34, 79, 91, 111);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("F7 | Bb", m);
    p.bass(tuba, &end, at, "root", 56);
    p.block(bone, &end, at, &[0.0], 2.0, 46, 48, 64, 3);
    p.block(tpt, &end, at, &[0.0], 2.0, 40, 62, 77, 3);
    p.rest(1);
    p
}

/// «Гелловін»: D minor in three, a crooked little waltz. A harpsichord, pizzicato, a bassoon, a celesta, a xylophone.
pub fn halloween() -> Piece {
    let mut p = Piece::new("halloween", 108.0, 3);
    let m = p.meter;
    p.ritardando = 1.2;
    let hpsi = p.part(more::HARPSICHORD, 74, 56, 60);
    let pizz = p.part(gm::PIZZICATO, 82, 46, 55);
    let bassoon = p.part(gm::BASSOON, 82, 52, 55);
    let cel = p.part(gm::CELESTA, 70, 76, 70);
    let xylo = p.part(more::XYLOPHONE, 60, 84, 55);

    let intro = progression("Dm | A7 | Dm | A7", m);
    let a = progression("Dm | A7 | Dm | Gm | Dm | Bb | A7 | Dm", m);
    let b = progression("Gm | Dm | Bb | A7 | Gm | Dm | A7 | Dm", m);
    let mel_a = "d4 f4 a4 | c#'2 a4 | d'4 a4 f4 | g2 bb4 | a4 f4 d4 | f2 d4 | e4 g4 c#4 | d2.";
    let mel_b = "bb4 a4 g4 | f2 d4 | d'4 bb4 f4 | e2 c#4 | g4 bb4 d'4 | a2 f4 | e4 c#4 e4 | d2.";

    let mut at = 0.0;
    p.bass(pizz, &intro, at, "waltz", 50);
    p.block(hpsi, &intro, at, &[1.0, 2.0], 0.4, 40, 57, 72, 3);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, bassoon, 0, 64u8), (&b, mel_b, cel, 12, 56), (&a, mel_a, xylo, 12, 52), (&b, mel_b, bassoon, 0, 62), (&a, mel_a, cel, 12, 52)] {
        p.bass(pizz, prog, at, "waltz", 48);
        p.block(hpsi, prog, at, &[1.0, 2.0], 0.4, 38, 57, 72, 3);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("A7 | Dm", m);
    p.bass(pizz, &end, at, "root", 48);
    p.block(hpsi, &end, at, &[0.0], 2.5, 36, 57, 72, 3);
    p.rest(2);
    p
}

/// «Зимові вогні»: F major, lights switched on on the square. Celesta, a glockenspiel, a harp, strings, a choir, a
/// flute, sleigh bells (a tambourine and a triangle).
pub fn winterlights() -> Piece {
    let mut p = Piece::new("winterlights", 96.0, 4);
    let m = p.meter;
    let cel = p.part(gm::CELESTA, 82, 72, 70);
    let glock = p.part(gm::GLOCKENSPIEL, 54, 86, 70);
    let harp = p.part(gm::HARP, 86, 50, 70);
    let strings = p.part(gm::STRINGS, 58, 56, 80);
    let choir = p.part(gm::CHOIR, 44, 58, 100);
    let flute = p.part(gm::FLUTE, 82, 66, 70);
    let kit = p.drums(gm::KIT_STANDARD, 46, 40);

    let intro = progression("F | Bbmaj7 | F | C7", m);
    let a = progression("F | Dm7 | Bbmaj7 | C7 | F/A | Bbmaj7 | Gm7 C7 | F", m);
    let b = progression("Bbmaj7 | Am7 | Gm7 | F | Bbmaj7 | Am7 D7 | Gm7 | C7sus4 C7", m);
    let mel_a = "c'4 f'8 g'8 a'4 f'4 | f'4 d'8 e'8 f'4 a4 | d'4 f'8 d'8 bb4 a4 | g2 e2 | a4 c'4 f'4 c'4 | d'2 f'2 | bb2 g2 | f2. r4";
    let mel_b = "f'2 d'4 bb4 | e'2 c'4 a4 | d'4 bb8 a8 g4 bb4 | a2. r4 | f'4 d'8 c'8 bb4 d'4 | c'2 f#'2 | g'4 f'8 d'8 bb4 g4 | f'2 e'2";
    let bells: &[(u8, &[f64], u8)] = &[(drum::TAMBOURINE, &[0.5, 1.5, 2.5, 3.5], 26), (drum::TRIANGLE, &[0.0], 22)];

    let mut at = 0.0;
    p.arp(harp, &intro, at, 0.5, &[0, 1, 2, 3, 4, 3, 2, 1], 1.4, 40, 55, 79);
    p.sprinkle(glock, &intro, at, 1.0, 0.35, 36, 79, 91, 121);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, cel, 0, 58u8), (&b, mel_b, flute, 0, 58), (&a, mel_a, cel, 12, 52), (&b, mel_b, flute, 0, 56)] {
        p.arp(harp, prog, at, 0.5, &[0, 1, 2, 3, 4, 3, 2, 1], 1.4, 36, 55, 79);
        p.pad(strings, prog, at, 30, 53, 74, 4);
        if ch == flute {
            p.pad(choir, prog, at, 26, 55, 70, 3);
        }
        p.groove(kit, at, 8, bells, &[]);
        p.sprinkle(glock, prog, at, 2.0, 0.3, 32, 79, 91, 122);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("C7 | F", m);
    p.arp(harp, &end, at, 0.5, &[0, 1, 2, 3, 4], 2.0, 34, 55, 79);
    p.pad(strings, &end, at, 28, 53, 74, 4);
    p.rest(2);
    p
}

/// «Ніч літнього сонцестояння»: D mixolydian, a folk jig in three by the bonfires. A fiddle, an accordion, a
/// flute, a guitar, a hand drum.
pub fn midsummer() -> Piece {
    let mut p = Piece::new("midsummer", 132.0, 3);
    let m = p.meter;
    let fiddle = p.part(more::FIDDLE, 84, 60, 45);
    let acc = p.part(gm::ACCORDION, 64, 72, 40);
    let flute = p.part(gm::FLUTE, 84, 66, 50);
    let guitar = p.part(gm::STEEL, 78, 42, 35);
    let bass = p.part(gm::UPRIGHT, 70, 60, 20);
    let kit = p.drums(gm::KIT_STANDARD, 46, 30);
    p.lay_back(fiddle, 6.0);

    let intro = progression("D | C | D | A", m);
    let a = progression("D | C | D | A | D | C | G | D", m);
    let b = progression("G | D | C | D | G | D | A | D", m);
    let mel_a = "d'4 f#'4 a'4 | g'4 e'4 c'4 | f#'4 d'4 a4 | e'2 c#'4 | a4 d'4 f#'4 | e'4 c'4 g4 | b4 d'4 g'4 | a'2.";
    let mel_b = "b'4 g'4 d'4 | a'4 f#'4 d'4 | g'4 e'4 c'4 | f#'2 d'4 | d'4 g'4 b'4 | a'4 f#'4 d'4 | c#'4 e'4 a'4 | d'2.";
    let drum: &[(u8, &[f64], u8)] = &[(hit::LOW_TOM, &[0.0], 44), (hit::MID_TOM, &[1.0, 2.0], 34)];

    let mut at = 0.0;
    p.block(guitar, &intro, at, &[0.0, 1.0, 2.0], 0.5, 40, 52, 67, 3);
    p.groove(kit, at, 4, drum, &[]);
    at += bars(4, m);
    for (prog, mel, ch, tr, vel) in [(&a, mel_a, fiddle, 0, 64u8), (&a, mel_a, flute, 0, 58), (&b, mel_b, fiddle, 0, 62), (&b, mel_b, acc, -12, 56), (&a, mel_a, fiddle, 0, 62), (&b, mel_b, fiddle, 0, 62)] {
        p.block(guitar, prog, at, &[0.0, 1.0, 2.0], 0.5, 38, 52, 67, 3);
        p.bass(bass, prog, at, "waltz", 48);
        p.groove(kit, at, 8, drum, &[]);
        if ch != acc {
            p.block(acc, prog, at, &[1.0, 2.0], 0.5, 34, 55, 70, 3);
        }
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("A | D", m);
    p.block(guitar, &end, at, &[0.0], 2.0, 38, 52, 67, 3);
    p.bass(bass, &end, at, "root", 46);
    p.rest(1);
    p
}

