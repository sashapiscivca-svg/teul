//! The pieces of teul, one for each place and thing that plays. Each is written as its chords and melodies and
//! arranged for a few acoustic instruments: soft, warm, with room to breathe, nothing that grates when it loops.

use crate::score::{drum, gm, progression, Piece, Span};

/// Every piece, by its mood (the name the game asks for).
pub fn all() -> Vec<Piece> {
    let mut out = vec![home(), village(), forest(), night(), cave(), fields(), farm(), race(), radio(), vinyl(), musicbox()];
    out.extend(crate::places::all());
    for p in &mut out {
        p.make_way();
    }
    out
}

fn bars(n: u32, meter: f64) -> f64 {
    n as f64 * meter
}

/// «Вдома»: F major, a slow warm afternoon. Piano and nylon guitar, strings, a flute; celesta here and there.
pub fn home() -> Piece {
    let mut p = Piece::new("home", 72.0, 4);
    let m = p.meter;
    let piano = p.part(gm::PIANO, 96, 58, 50);
    let guitar = p.part(gm::NYLON, 92, 74, 40);
    let strings = p.part(gm::SLOW_STRINGS, 62, 50, 70);
    let flute = p.part(gm::FLUTE, 92, 70, 60);
    let bass = p.part(gm::UPRIGHT, 76, 60, 30);
    let cel = p.part(gm::CELESTA, 70, 84, 80);
    let clar = p.part(gm::CLARINET, 88, 50, 60);
    p.lay_back(flute, 12.0);
    p.lay_back(clar, 12.0);

    let intro = progression("Fmaj7 | Bbmaj7 | Fmaj7/A | C9sus4", m);
    let a = progression("Fmaj7 | Em7 A7 | Dm9 | C/E | Bbmaj7 | Am7 | Gm9 | C9sus4 C7", m);
    let b = progression("Bbmaj7 | C/Bb | Am7 D7 | Gm9 | Bbmaj7 | Am7 | Gm9 | Gm7 C7", m);
    let mel_a = "c'4 a8 g8 a2 | g8 a8 g8 e8 c#4 e4 | f4. e8 d4 e8 f8 | g2. r4 | d'4 c'8 bb8 a4 f4 | e4 g8 a8 c'2 | bb4. a8 g4 f4 | g2 e4 r4";
    let mel_a2 = "c'4 a8 g8 a2 | g8 a8 g8 e8 c#4 e4 | f4. e8 d4 e8 f8 | g2. r4 | d'4 c'8 bb8 a4 f4 | e4 g8 a8 c'2 | bb4. a8 g4 e4 | f2. r4";
    let mel_b = "f'2 d'4 c'4 | e'2. g4 | c'4 a4 f#4 a4 | bb2 a4 g4 | d'4. c'8 bb4 d'4 | c'2 e'4 c'4 | bb4 a4 g4 bb4 | a2 g4 e4";

    // intro: the piano alone, broken chords; the strings come in under it
    let mut at = 0.0;
    p.arp(piano, &intro, at, 0.5, &[0, 1, 2, 3, 4, 3, 2, 1], 1.2, 44, 55, 76);
    p.pad(strings, &intro[2..], at, 34, 53, 72, 4);
    p.sprinkle(cel, &intro, at, 1.0, 0.25, 40, 84, 96, 11);
    at += bars(4, m);
    // A: the guitar picks, the piano sings the tune
    p.pick(guitar, &a, at, 50);
    p.bass(bass, &a, at, "two", 52);
    p.sing(piano, &a, mel_a, at, 58, 12);
    at += bars(8, m);
    // A2: the flute takes it, the piano breaks the chords under it
    p.arp(piano, &a, at, 0.5, &[0, 2, 3, 4, 1, 3, 2, 4], 1.0, 40, 55, 76);
    p.pad(strings, &a, at, 34, 53, 76, 4);
    p.bass(bass, &a, at, "two", 52);
    p.sing(flute, &a, mel_a2, at, 64, 12);
    p.sprinkle(cel, &a, at, 2.0, 0.2, 38, 84, 96, 12);
    at += bars(8, m);
    // B: the clarinet, the guitar, strings holding the floor
    p.pick(guitar, &b, at, 48);
    p.pad(strings, &b, at, 36, 52, 76, 4);
    p.bass(bass, &b, at, "root", 50);
    p.sing(clar, &b, mel_b, at, 62, 0);
    at += bars(8, m);
    // A3: the piano alone again, softer, with the strings
    p.arp(piano, &a, at, 0.5, &[0, 1, 2, 3, 4, 3, 2, 1], 1.2, 38, 55, 76);
    p.sing(piano, &a, mel_a2, at, 52, 12);
    p.pad(strings, &a, at, 30, 53, 76, 4);
    at += bars(8, m);
    let end = progression("Bbmaj7 | Fmaj7", m);
    p.arp(piano, &end, at, 0.5, &[0, 1, 2, 3, 4, 3, 2, 1], 1.5, 34, 55, 76);
    p.pad(strings, &end, at, 30, 53, 72, 4);
    p.sprinkle(cel, &end, at, 1.0, 0.5, 34, 84, 96, 13);
    p.rest(2);
    p
}

/// «Липове»: G major, a morning in the village. Guitar and pizzicato, a clarinet, an accordion, soft brushes.
pub fn village() -> Piece {
    let mut p = Piece::new("village", 100.0, 4);
    let m = p.meter;
    let guitar = p.part(gm::NYLON, 96, 76, 35);
    let pizz = p.part(gm::PIZZICATO, 84, 48, 45);
    let clar = p.part(gm::CLARINET, 92, 58, 50);
    let acc = p.part(gm::ACCORDION, 70, 66, 45);
    let bass = p.part(gm::UPRIGHT, 74, 60, 25);
    let glock = p.part(gm::GLOCKENSPIEL, 58, 86, 60);
    let flute = p.part(gm::FLUTE, 86, 70, 55);
    let kit = p.drums(gm::KIT_BRUSH, 56, 30);
    p.lay_back(clar, 10.0);

    let intro = progression("G | Cadd9 | G/B | D7sus4", m);
    let a = progression("G | Em7 | Cmaj7 | D7sus4 D7 | G/B | Cadd9 | Am7 | D7", m);
    // the same, coming home at the end of the phrase
    let a2 = progression("G | Em7 | Cmaj7 | D7sus4 D7 | G/B | Cadd9 | Am7 D7 | G", m);
    let b = progression("Am7 | D7 | Bm7 | Em7 | Cmaj7 | Bm7 E7 | Am7 | D7sus4 D7", m);
    let mel_a = "d4 g8 a8 b4 a8 g8 | e4 g8 b8 d'4 b4 | c'4 b8 a8 g4 e4 | d4 g4 f#4 a4 | b4 d'8 b8 g4 b4 | c'4 d'8 e'8 d'4 c'4 | a4 c'8 b8 a4 g4 | f#2 a4 r4";
    let mel_a2 = "d4 g8 a8 b4 a8 g8 | e4 g8 b8 d'4 b4 | c'4 b8 a8 g4 e4 | d4 g4 f#4 a4 | b4 d'8 b8 g4 b4 | c'4 d'8 e'8 d'4 c'4 | a4 c'8 b8 a4 f#4 | g2. r4";
    let mel_b = "e'4 c'4 a4 c'4 | d'2 c'4 a4 | b4 d'8 c'8 b4 a4 | g2 e4 g4 | e'4 d'8 c'8 b4 g4 | a4 b4 g#4 b4 | c'2 a4 e4 | g2 f#4 a4";
    let brush: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 44), (drum::BRUSH_SWIRL, &[1.0, 3.0], 40), (drum::HAT, &[0.5, 1.5, 2.5, 3.5], 28)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 44), (drum::BRUSH_SWIRL, &[1.0, 3.0, 3.5], 42), (drum::HAT, &[0.5, 1.5, 2.5], 28)];

    let mut at = 0.0;
    p.pick(guitar, &intro, at, 52);
    p.sprinkle(glock, &intro, at, 1.0, 0.3, 40, 79, 91, 21);
    at += bars(4, m);
    for (i, (prog, mel)) in [(&a, mel_a), (&a2, mel_a2)].into_iter().enumerate() {
        p.pick(guitar, prog, at, 50);
        p.bass(bass, prog, at, "two", 56);
        p.groove(kit, at, 8, brush, fill);
        if i == 1 {
            p.block(pizz, prog, at, &[1.0, 3.0], 0.4, 48, 55, 72, 3);
            p.sprinkle(glock, prog, at, 2.0, 0.35, 38, 79, 91, 22);
        }
        p.sing(clar, prog, mel, at, 66, 0);
        at += bars(8, m);
    }
    // B: the accordion sings, as at a village feast
    p.pick(guitar, &b, at, 48);
    p.bass(bass, &b, at, "two", 54);
    p.groove(kit, at, 8, brush, fill);
    p.sing(acc, &b, mel_b, at, 58, 0);
    at += bars(8, m);
    p.pick(guitar, &a2, at, 50);
    p.bass(bass, &a2, at, "two", 56);
    p.groove(kit, at, 8, brush, fill);
    p.sing(flute, &a2, mel_a2, at, 60, 12);
    at += bars(8, m);
    // B2: no tune, just the pizzicato and the bells, a breath
    p.block(pizz, &b, at, &[0.0, 1.5, 3.0], 0.4, 46, 55, 74, 3);
    p.pick(guitar, &b, at, 44);
    p.bass(bass, &b, at, "root", 50);
    p.sprinkle(glock, &b, at, 1.0, 0.3, 36, 79, 91, 23);
    at += bars(8, m);
    p.pick(guitar, &a2, at, 50);
    p.bass(bass, &a2, at, "two", 56);
    p.groove(kit, at, 8, brush, fill);
    p.sing(clar, &a2, mel_a2, at, 62, 0);
    at += bars(8, m);
    let end = progression("Cadd9 | G", m);
    p.pick(guitar, &end, at, 42);
    p.bass(bass, &end, at, "root", 48);
    p.rest(2);
    p
}

/// «Шепітливий ліс»: D dorian, among the trees. Harp, a flute, a cello, a warm pad, a kalimba.
pub fn forest() -> Piece {
    let mut p = Piece::new("forest", 76.0, 4);
    let m = p.meter;
    let harp = p.part(gm::HARP, 96, 54, 70);
    let flute = p.part(gm::FLUTE, 90, 72, 75);
    let cello = p.part(gm::CELLO, 84, 46, 65);
    let pad = p.part(gm::WARM_PAD, 52, 64, 80);
    let kal = p.part(gm::KALIMBA, 66, 82, 70);
    p.lay_back(flute, 14.0);
    p.lay_back(cello, 14.0);

    let intro = progression("Dm9 | G6 | Dm9 | G6", m);
    let a = progression("Dm9 | C/E | Fmaj7 | G6 | Dm9 | Am7 | Gadd9/B | Asus4 A7", m);
    let b = progression("Fmaj7 | C/E | Dm9 | Bbmaj7 | Fmaj7/A | Gm7 | Asus4 | A7", m);
    let mel_a = "a4 d'8 e'8 f'4 e'4 | g4. e8 c'4 g4 | a2 c'4 e'4 | d'2 b4 r4 | a4 f8 e8 d4 e4 | c4. e8 g4 a4 | b2 a4 d'4 | e'2 c#'2";
    let mel_b = "c'2 a4 c'4 | e'2 d'4 c'4 | d'4. e'8 f'4 a4 | d'1 | c'4 a4 f4 a4 | bb2 d'4 f'4 | e'2 d'2 | c#'1";
    let harp_order: &[usize] = &[0, 1, 2, 3, 4, 3, 2, 1];

    let mut at = 0.0;
    p.arp(harp, &intro, at, 0.5, harp_order, 2.0, 44, 57, 79);
    p.pad(pad, &intro, at, 40, 50, 69, 4);
    at += bars(4, m);
    p.arp(harp, &a, at, 0.5, harp_order, 2.0, 42, 57, 79);
    p.pad(pad, &a, at, 38, 50, 69, 4);
    p.sing(flute, &a, mel_a, at, 64, 0);
    at += bars(8, m);
    p.arp(harp, &a, at, 0.5, &[0, 2, 4, 3, 1, 3, 4, 2], 2.0, 40, 57, 79);
    p.pad(pad, &a, at, 38, 50, 69, 4);
    p.sing(flute, &a, mel_a, at, 62, 0);
    p.sprinkle(kal, &a, at, 1.0, 0.3, 44, 74, 86, 31);
    at += bars(8, m);
    p.arp(harp, &b, at, 1.0, &[0, 2, 3, 4], 2.5, 40, 57, 79);
    p.pad(pad, &b, at, 40, 50, 69, 4);
    p.sing(cello, &b, mel_b, at, 66, -12);
    at += bars(8, m);
    p.arp(harp, &a, at, 0.5, harp_order, 2.0, 38, 57, 79);
    p.pad(pad, &a, at, 34, 50, 69, 4);
    p.sing(flute, &a, mel_a, at, 56, 12);
    p.sprinkle(kal, &a, at, 2.0, 0.25, 40, 74, 86, 32);
    at += bars(8, m);
    let end = progression("Dm9 | -", m);
    p.arp(harp, &end, at, 0.5, harp_order, 3.0, 34, 57, 79);
    p.pad(pad, &end, at, 34, 50, 69, 4);
    p.rest(2);
    p
}

/// «Нічне Липове»: D-flat major, a lullaby in three. Soft piano, celesta, vibraphone, slow strings.
pub fn night() -> Piece {
    let mut p = Piece::new("night", 66.0, 3);
    let m = p.meter;
    p.ritardando = 1.18;
    let piano = p.part(gm::PIANO, 88, 56, 70);
    let cel = p.part(gm::CELESTA, 86, 74, 80);
    let vib = p.part(gm::VIBRAPHONE, 80, 66, 80);
    let strings = p.part(gm::SLOW_STRINGS, 58, 50, 85);
    p.lay_back(cel, 10.0);

    let intro = progression("Dbmaj7 | Gbmaj7 | Dbmaj7 | Absus4", m);
    let a = progression("Dbmaj7 | Bbm9 | Gbmaj7 | Absus4 | Dbmaj7/F | Bbm7 | Ebm9 | Ab7", m);
    let b = progression("Gbmaj7 | Fm7 | Ebm7 | Dbmaj7 | Gbmaj7 | Fm7 | Ebm9 | Absus4", m);
    let mel_a = "f4 ab4 c'4 | db'2 c'4 | bb4. ab8 f4 | eb2. | f4 ab4 db'4 | f'2 db'4 | gb4 f4 eb4 | c'2.";
    let mel_b = "bb4 db'4 f'4 | eb'2 c'4 | db'4 bb4 gb4 | ab2. | bb4 db'4 f'4 | ab'2 f'4 | gb'4 f'4 eb'4 | eb'2.";
    let waltz = |p: &mut Piece, prog: &[Span], at: f64, vel: u8| {
        p.bass(piano, prog, at, "waltz", vel + 4);
        p.block(piano, prog, at, &[1.0, 2.0], 0.9, vel - 6, 56, 72, 3);
    };

    let mut at = 0.0;
    p.arp(piano, &intro, at, 1.0, &[0, 2, 3], 2.0, 40, 56, 75);
    p.pad(strings, &intro, at, 32, 53, 72, 4);
    at += bars(4, m);
    for (k, (prog, mel, ch, tr, vel)) in [(&a, mel_a, cel, 12, 56u8), (&b, mel_b, vib, 0, 60), (&a, mel_a, piano, 12, 50), (&b, mel_b, cel, 0, 52), (&a, mel_a, cel, 12, 48)].into_iter().enumerate() {
        waltz(&mut p, prog, at, 44 - (k as u8) * 2);
        p.pad(strings, prog, at, 30, 53, 72, 4);
        p.sing(ch, prog, mel, at, vel, tr);
        at += bars(8, m);
    }
    let end = progression("Dbmaj7 | -", m);
    p.arp(piano, &end, at, 1.0, &[0, 2, 3, 4, 3, 2], 3.0, 32, 56, 75);
    p.pad(strings, &end, at, 28, 53, 72, 4);
    p.rest(2);
    p
}

/// «Печера»: E minor, slow and deep. A choir far away, a warm pad, drops of glockenspiel and harp, a cello.
pub fn cave() -> Piece {
    let mut p = Piece::new("cave", 52.0, 4);
    let m = p.meter;
    p.ritardando = 1.0;
    let choir = p.part(gm::CHOIR, 56, 52, 110);
    let pad = p.part(gm::WARM_PAD, 50, 70, 110);
    let glock = p.part(gm::GLOCKENSPIEL, 60, 80, 120);
    let harp = p.part(gm::HARP, 76, 40, 110);
    let cello = p.part(gm::CELLO, 78, 56, 100);
    let kal = p.part(gm::KALIMBA, 60, 88, 110);

    let intro = progression("Em9 | Cmaj7 | Em9 | B7sus4", m);
    let a = progression("Em9 | Cmaj7 | Am9 | B7sus4 | Em9 | Fmaj7 | Dadd9/F# | B7", m);
    let b = progression("Cmaj7 | G/B | Am7 | Em/G | Fmaj7#11 | Em9 | Dadd9 | B7sus4", m);
    let drops = "r2 b4 f#'4 | e'2 r2 | r4 c'4 b4 r4 | r1 | g'2 f#'4 r4 | e'2 r2 | r4 a4 e'4 r4 | d#'1";
    let mel_b = "g2 e2 | d2 b,2 | c2 e2 | b,1 | a2 c2 | b,2 f#2 | a,2 e2 | e2 f#2";

    let mut at = 0.0;
    p.pad(pad, &intro, at, 40, 48, 67, 4);
    p.pad(choir, &intro[2..], at, 30, 52, 67, 3);
    at += bars(4, m);
    p.pad(pad, &a, at, 38, 48, 67, 4);
    p.sing(glock, &a, drops, at, 46, 0);
    p.arp(harp, &a, at, 2.0, &[0, 3], 3.0, 34, 52, 72);
    at += bars(8, m);
    p.pad(choir, &b, at, 32, 52, 67, 3);
    p.pad(pad, &b, at, 34, 48, 67, 4);
    p.sing(cello, &b, mel_b, at, 58, 0);
    at += bars(8, m);
    p.pad(pad, &a, at, 36, 48, 67, 4);
    p.sing(kal, &a, drops, at, 48, 0);
    p.arp(harp, &a, at, 2.0, &[0, 2], 3.0, 32, 52, 72);
    at += bars(8, m);
    let end = progression("Em9 | -", m);
    p.pad(pad, &end, at, 32, 48, 67, 4);
    p.pad(choir, &end, at, 26, 52, 67, 3);
    p.rest(2);
    p
}

/// «Пшеничне поле»: C major, open sky. Guitar, an oboe, an accordion, strings, a flute.
pub fn fields() -> Piece {
    let mut p = Piece::new("fields", 84.0, 4);
    let m = p.meter;
    let guitar = p.part(gm::NYLON, 94, 70, 40);
    let oboe = p.part(gm::OBOE, 84, 56, 55);
    let acc = p.part(gm::ACCORDION, 66, 64, 50);
    let strings = p.part(gm::STRINGS, 58, 50, 70);
    let bass = p.part(gm::UPRIGHT, 72, 60, 30);
    let flute = p.part(gm::FLUTE, 86, 74, 60);
    let kit = p.drums(gm::KIT_BRUSH, 52, 30);
    p.lay_back(oboe, 12.0);

    let intro = progression("C | Fadd9 | C | Gsus4", m);
    let a = progression("C | G/B | Am7 | Fmaj7 | C/E | Fadd9 | Dm7 | Gsus4 G", m);
    let b = progression("Am | Em | F | C | Dm7 | G | Em7 Am7 | Dm7 G7", m);
    let mel_a = "e4 g8 a8 g4 e4 | d4 b,4 d4 g4 | c4 e8 g8 a4 g4 | a2. r4 | g4 e'8 d'8 c'4 g4 | a4 c'8 a8 g4 f4 | f4 e4 d4 f4 | c4 d4 b,2";
    let mel_a2 = "e4 g8 a8 g4 e4 | d4 b,4 d4 g4 | c4 e8 g8 a4 g4 | a2. r4 | g4 e'8 d'8 c'4 g4 | a4 c'8 a8 g4 f4 | f4 e4 d4 b,4 | c2. r4";
    let mel_b = "c'2 b4 a4 | g2 e4 g4 | a4 c'4 f'4 e'4 | e'2 d'4 c'4 | d'4 c'4 a4 f4 | g2 b4 d'4 | e'4 d'4 c'4 b4 | a4 f4 g4 b4";
    let shaker: &[(u8, &[f64], u8)] = &[(drum::SHAKER, &[0.5, 1.5, 2.5, 3.5], 30), (drum::KICK, &[0.0], 36)];

    let mut at = 0.0;
    p.pick(guitar, &intro, at, 50);
    p.pad(strings, &intro[2..], at, 30, 53, 72, 4);
    at += bars(4, m);
    let plan: [(&[Span], &str, u8, i32, &str); 6] = [
        (&a, mel_a, oboe, 0, "two"),
        (&a, mel_a2, oboe, 0, "two"),
        (&b, mel_b, acc, 0, "root"),
        (&a, mel_a2, flute, 12, "two"),
        (&b, mel_b, strings, 0, "root"),
        (&a, mel_a2, oboe, 0, "two"),
    ];
    for (i, (prog, mel, ch, tr, style)) in plan.into_iter().enumerate() {
        p.pick(guitar, prog, at, 48);
        p.bass(bass, prog, at, style, 52);
        if ch != strings {
            p.pad(strings, prog, at, 28, 53, 72, 4);
        }
        if i == 1 || i == 3 {
            p.groove(kit, at, 8, shaker, &[]);
        }
        p.sing(ch, prog, mel, at, if ch == strings { 52 } else { 62 }, tr);
        at += bars(8, m);
    }
    let end = progression("Fadd9 | C", m);
    p.pick(guitar, &end, at, 42);
    p.pad(strings, &end, at, 28, 53, 72, 4);
    p.rest(2);
    p
}

/// «Ферма»: A major, a folk tune with a fiddle, banjo, guitar, accordion and a little wood block.
pub fn farm() -> Piece {
    let mut p = Piece::new("farm", 108.0, 4);
    let m = p.meter;
    let fiddle = p.part(gm::VIOLIN, 88, 56, 45);
    let banjo = p.part(105, 74, 80, 30);
    let guitar = p.part(gm::STEEL, 80, 40, 35);
    let acc = p.part(gm::ACCORDION, 66, 70, 40);
    let bass = p.part(gm::UPRIGHT, 70, 60, 20);
    let kit = p.drums(gm::KIT_BRUSH, 52, 25);
    p.lay_back(fiddle, 6.0);

    let intro = progression("A | D | A | E", m);
    let a = progression("A | D | A | E | A | D | A E | A", m);
    let b = progression("D | A | E | A | D | A | Bm7 E7 | A", m);
    let mel_a = "e4 a8 b8 c#'4 a4 | d'4 f#'8 e'8 d'4 a4 | c#'4 e'8 c#'8 a4 c#'4 | b2 g#4 e4 | e4 a8 b8 c#'4 e'4 | f#'4 e'8 d'8 a4 d'4 | c#'4 a4 b4 g#4 | a2 r2";
    let mel_b = "f#2 a4 f#4 | e2 c#4 e4 | g#4 b4 e'4 b4 | c#'2 a2 | d'4 c#'8 b8 a4 f#4 | e4 a4 c#'4 e'4 | d'4 b4 g#4 b4 | a2. r4";
    let groove: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 46), (drum::SIDE_STICK, &[1.0, 3.0], 38), (drum::SHAKER, &[0.5, 1.5, 2.5, 3.5], 28)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::KICK, &[0.0, 2.0], 46), (drum::WOOD_HI, &[1.0, 2.5, 3.0, 3.5], 40)];

    let mut at = 0.0;
    p.arp(banjo, &intro, at, 0.5, &[1, 2, 3, 2], 0.6, 46, 60, 76);
    p.block(guitar, &intro, at, &[0.0, 1.0, 2.0, 3.0], 0.5, 40, 52, 67, 4);
    at += bars(4, m);
    let plan: [(&[Span], &str, u8, i32); 5] = [(&a, mel_a, fiddle, 0), (&b, mel_b, acc, 0), (&a, mel_a, fiddle, 0), (&b, mel_b, fiddle, 12), (&a, mel_a, fiddle, 0)];
    for (i, (prog, mel, ch, tr)) in plan.into_iter().enumerate() {
        p.block(guitar, prog, at, &[0.0, 1.0, 2.0, 3.0], 0.5, 40, 52, 67, 4);
        p.bass(bass, prog, at, "two", 56);
        p.groove(kit, at, 8, groove, fill);
        if i % 2 == 0 {
            p.arp(banjo, prog, at, 0.5, &[1, 2, 3, 2], 0.6, 40, 60, 76);
        }
        p.sing(ch, prog, mel, at, 64, tr);
        at += bars(8, m);
    }
    let end = progression("D E | A", m);
    p.block(guitar, &end, at, &[0.0], 2.0, 40, 52, 67, 4);
    p.bass(bass, &end, at, "root", 52);
    p.rest(1);
    p
}

/// «Іподром»: D major, the race. Pizzicato strings galloping, a horn, a trumpet, timpani, wood blocks.
pub fn race() -> Piece {
    let mut p = Piece::new("race", 132.0, 4);
    let m = p.meter;
    p.ritardando = 1.04;
    let pizz = p.part(gm::PIZZICATO, 84, 48, 40);
    let horn = p.part(gm::HORN, 92, 60, 55);
    let trumpet = p.part(gm::TRUMPET, 70, 70, 55);
    let strings = p.part(gm::STRINGS, 74, 56, 60);
    let timp = p.part(gm::TIMPANI, 62, 64, 50);
    let glock = p.part(gm::GLOCKENSPIEL, 54, 84, 50);
    let bass = p.part(gm::FINGER_BASS, 64, 60, 15);
    let kit = p.drums(gm::KIT_STANDARD, 46, 25);

    let intro = progression("D | D | A | A", m);
    let a = progression("D | G | A | D | Bm | G | Em7 A7 | D", m);
    let b = progression("G | A | F#m | Bm | G | A | D/F# G | A7", m);
    let mel_a = "a4 d'8 e'8 f#'4 d'4 | g'4 f#'8 e'8 d'4 b4 | c#'4 e'8 c#'8 a4 c#'4 | d'2 a2 | f#'4 e'8 d'8 b4 d'4 | g'4. f#'8 e'4 d'4 | e'4 g'4 e'4 c#'4 | d'2. r4";
    let mel_b = "b2 d'4 g'4 | e'2 c#'4 a4 | c#'2 f#'4 e'4 | d'2 b2 | b4 d'4 g'4 b'4 | a'2 e'4 c#'4 | d'4 f#'4 g'4 b4 | c#'2 e'2";
    let gallop: &[(u8, &[f64], u8)] = &[(drum::WOOD_LO, &[0.0, 0.75, 1.0, 2.0, 2.75, 3.0], 40), (drum::HAT, &[0.5, 1.5, 2.5, 3.5], 26)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::WOOD_LO, &[0.0, 0.75, 1.0, 2.0], 40), (drum::SNARE, &[3.0, 3.5], 36)];

    let mut at = 0.0;
    p.bass(pizz, &intro, at, "pulse", 48);
    p.groove(kit, at, 4, gallop, &[]);
    p.bass(timp, &progression("D | - | A | -", m), at, "root", 52);
    at += bars(4, m);
    let plan: [(&[Span], &str, u8, i32); 6] = [(&a, mel_a, horn, -12), (&a, mel_a, horn, -12), (&b, mel_b, strings, 0), (&a, mel_a, trumpet, -12), (&b, mel_b, horn, -12), (&a, mel_a, strings, 0)];
    for (i, (prog, mel, ch, tr)) in plan.into_iter().enumerate() {
        p.block(pizz, prog, at, &[0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5], 0.3, 40, 57, 74, 3);
        p.bass(bass, prog, at, "two", 54);
        p.groove(kit, at, 8, gallop, fill);
        if i == 1 || i == 5 {
            p.sprinkle(glock, prog, at, 1.0, 0.35, 40, 79, 91, 51 + i as u64);
        }
        if ch != strings {
            p.pad(strings, prog, at, 34, 55, 74, 3);
        }
        p.sing(ch, prog, mel, at, 66, tr);
        at += bars(8, m);
    }
    let end = progression("G A | D", m);
    p.block(pizz, &end, at, &[0.0, 2.0], 0.4, 46, 57, 74, 3);
    p.bass(timp, &end, at, "root", 60);
    p.pad(strings, &end, at, 44, 55, 74, 4);
    p.rest(1);
    p
}

/// «Липове FM»: a lo-fi jazz tune for the radio. Electric piano, upright bass walking, brushes, vibraphone,
/// a muted trumpet.
pub fn radio() -> Piece {
    let mut p = Piece::new("radio", 82.0, 4);
    let m = p.meter;
    p.ritardando = 1.05;
    let ep = p.part(gm::EPIANO, 88, 54, 50);
    let bass = p.part(gm::UPRIGHT, 72, 60, 20);
    let vib = p.part(gm::VIBRAPHONE, 84, 72, 55);
    let tpt = p.part(gm::MUTED_TRUMPET, 76, 64, 55);
    let kit = p.drums(gm::KIT_BRUSH, 58, 30);
    p.chorus(ep, 40);
    p.lay_back(vib, 18.0);
    p.lay_back(tpt, 22.0);

    let intro = progression("Cm9 | F13 | Bbmaj9 | Gm9", m);
    let a = progression("Cm9 | F13 | Bbmaj9 | Gm9 | Cm9 | F7b9 | Bbmaj7 Gm7 | Dm7b5 G7b9", m);
    let b = progression("Ebmaj7 | Ebm7 Ab7 | Dm7 | G7b9 | Cm9 | F13 | Bbmaj7 | Dm7b5 G7b9", m);
    let mel_a = "g4 bb8 d'8 eb'4 d'4 | c'4 a8 g8 eb4 d4 | d'2 c'4 a4 | bb4 a8 g8 f4 d4 | eb'4 d'8 c'8 bb4 g4 | a4 gb4 eb4 c4 | d'4 f'4 d'4 bb4 | ab4 f4 g4 b4";
    let mel_b = "g2 bb4 d'4 | db'4 bb4 c'4 gb4 | f2 a4 c'4 | b2 ab4 f4 | g4 eb4 d4 c4 | a2 d'4 c'4 | d'2. r4 | c'4 ab4 b4 d'4";
    let swing: &[(u8, &[f64], u8)] = &[(drum::RIDE, &[0.0, 1.0, 1.67, 2.0, 3.0, 3.67], 34), (drum::PEDAL_HAT, &[1.0, 3.0], 30), (drum::KICK, &[0.0], 22)];
    let fill: &[(u8, &[f64], u8)] = &[(drum::RIDE, &[0.0, 1.0, 1.67, 2.0], 34), (drum::BRUSH_SWIRL, &[2.67, 3.0, 3.67], 36)];

    let mut at = 0.0;
    p.block(ep, &intro, at, &[0.0, 1.67, 3.0], 0.9, 44, 55, 74, 4);
    p.bass(bass, &intro, at, "walk", 56);
    p.groove(kit, at, 4, swing, &[]);
    at += bars(4, m);
    let plan: [(&[Span], &str, u8, i32); 6] = [(&a, mel_a, vib, 0), (&a, mel_a, ep, 12), (&b, mel_b, tpt, 0), (&a, mel_a, vib, 0), (&b, mel_b, vib, 0), (&a, mel_a, tpt, 0)];
    for (prog, mel, ch, tr) in plan {
        p.block(ep, prog, at, &[0.0, 1.67, 3.0], 0.9, 42, 55, 74, 4);
        p.bass(bass, prog, at, "walk", 56);
        p.groove(kit, at, 8, swing, fill);
        p.sing(ch, prog, mel, at, 62, tr);
        at += bars(8, m);
    }
    let end = progression("Bbmaj9 | -", m);
    p.block(ep, &end, at, &[0.0], 6.0, 38, 55, 74, 4);
    p.bass(bass, &end, at, "root", 50);
    p.rest(1);
    p
}

/// «Стара платівка»: an old waltz in E-flat, as from a gramophone. Piano, violin, clarinet, strings.
pub fn vinyl() -> Piece {
    let mut p = Piece::new("vinyl", 108.0, 3);
    let m = p.meter;
    p.ritardando = 1.15;
    let piano = p.part(gm::PIANO, 90, 56, 45);
    let violin = p.part(gm::VIOLIN, 86, 70, 55);
    let clar = p.part(gm::CLARINET, 86, 54, 55);
    let strings = p.part(gm::STRINGS, 56, 50, 60);
    p.lay_back(violin, 16.0);
    p.lay_back(clar, 16.0);

    let intro = progression("Ebmaj7 | Bb7 | Ebmaj7 | Bb7", m);
    let a = progression("Ebmaj7 | Cm7 | Fm7 | Bb7 | Gm7 | C7 | Fm7 | Bb7 | Ebmaj7 | Cm7 | Abmaj7 | Adim7 | Eb/Bb | Bb7 | Eb | Eb", m);
    let b = progression("Abmaj7 | Abmaj7 | Bbm7 | Eb7 | Abmaj7 | Fm7 | Bbm7 | Eb7 | Ab | Db | Cm7 | F7 | Bbm7 | Eb7 | Abmaj7 | Bb7", m);
    let mel_a = "g2 bb4 | eb'2. | ab4 g4 f4 | d'2 bb4 | bb4 d'4 f'4 | e'2 c'4 | f'4 ab'4 g'4 | f'2. | g'2 eb'4 | eb'2 c'4 | c'4 eb'4 ab'4 | gb'2 eb'4 | g'2 f'4 | ab'2 d'4 | eb'2. | r2.";
    let mel_b = "c'2 eb'4 | g'2. | f'4 db'4 bb4 | g2 db'4 | c'2. | ab4 c'4 f'4 | f'2 db'4 | eb'2. | c'4 eb'4 ab'4 | f'2 db'4 | eb'4 c'4 g4 | a2 c'4 | db'2 f'4 | g'2 db'4 | c'2. | d'2 r4";
    let waltz = |p: &mut Piece, prog: &[Span], at: f64, vel: u8| {
        p.bass(piano, prog, at, "waltz", vel + 6);
        p.block(piano, prog, at, &[1.0, 2.0], 0.6, vel - 4, 58, 74, 3);
    };

    let mut at = 0.0;
    waltz(&mut p, &intro, at, 46);
    at += bars(4, m);
    let plan: [(&[Span], &str, u8, i32); 4] = [(&a, mel_a, violin, 0), (&b, mel_b, clar, 0), (&a, mel_a, piano, 0), (&a, mel_a, violin, 0)];
    for (i, (prog, mel, ch, tr)) in plan.into_iter().enumerate() {
        waltz(&mut p, prog, at, 44);
        if i != 2 {
            p.pad(strings, prog, at, 30, 55, 72, 3);
        }
        p.sing(ch, prog, mel, at, 64, tr);
        at += bars(16, m);
    }
    let end = progression("Ab | Eb", m);
    waltz(&mut p, &end, at, 40);
    p.pad(strings, &end, at, 30, 55, 72, 3);
    p.rest(1);
    p
}

/// «Музична скринька»: a music box lullaby in C, twice, the second time higher.
pub fn musicbox() -> Piece {
    let mut p = Piece::new("musicbox", 80.0, 3);
    let m = p.meter;
    p.ritardando = 1.3;
    let mbox = p.part(gm::MUSIC_BOX, 100, 64, 60);
    let cel = p.part(gm::CELESTA, 50, 70, 70);

    let prog = progression("C | Am | F | G | C | Em | F | G | Am | Em | F | C | Dm7 | G7 | C | C", m);
    let mel = "e4 g4 c'4 | c'2 a4 | a4 g4 f4 | g2. | e4 g4 c'4 | b2 g4 | a4 c'4 a4 | d'2 b4 | c'4 e'4 c'4 | b2 g4 | a4 c'4 f'4 | e'2. | f'4 e'4 d'4 | d'4 b4 g4 | c'2. | r2.";

    let mut at = 0.0;
    for (pass, vel) in [60u8, 54].into_iter().enumerate() {
        // the second time the box plays its chords as broken triplets, a celesta doubling the tune softly
        let order: &[usize] = if pass == 0 { &[0, 2, 3] } else { &[0, 3, 2] };
        p.arp(mbox, &prog, at, 1.0, order, 1.5, if pass == 0 { 40 } else { 36 }, 60, 76);
        p.sing(mbox, &prog, mel, at, vel, 12);
        if pass == 1 {
            p.sing(cel, &prog, mel, at, 30, 12);
        }
        at += bars(16, m);
    }
    p.rest(2);
    p
}
