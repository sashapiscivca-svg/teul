//! What the shell needs to let the hero play: every instrument's notes recorded one by one into a "sprite" (a
//! note every three semitones, each in a slot of its own; the shell bends a note by up to a semitone and a half
//! to reach the ones between), and the records — pieces from `records.json` (scripts/scores.py) arranged for a
//! small band.

use std::sync::Arc;

use rustysynth::{SoundFont, Synthesizer, SynthesizerSettings};

use crate::render::RATE;
use crate::score::{Note, Part, Piece};

/// An instrument the hero plays, as the shell knows it (app/src/ui/media/sampler.ts keeps the same table).
pub struct Kit {
    pub name: &'static str,
    pub program: u8,
    /// The lowest and the highest recorded key (every third key between).
    pub low: u8,
    pub high: u8,
    /// Seconds a note is held, and the slot it rings out in.
    pub hold: f64,
    pub slot: f64,
}

pub const KITS: [Kit; 6] = [
    Kit { name: "piano", program: 0, low: 36, high: 96, hold: 1.6, slot: 2.4 },
    Kit { name: "guitar", program: 24, low: 40, high: 82, hold: 1.4, slot: 2.0 },
    Kit { name: "accordion", program: 21, low: 41, high: 89, hold: 1.7, slot: 2.0 },
    Kit { name: "violin", program: 40, low: 55, high: 97, hold: 1.8, slot: 2.1 },
    Kit { name: "bandura", program: 46, low: 40, high: 88, hold: 1.5, slot: 2.2 },
    Kit { name: "sopilka", program: 74, low: 60, high: 96, hold: 1.5, slot: 1.8 },
];

/// The keys recorded for a kit.
pub fn keys(kit: &Kit) -> Vec<u8> {
    (kit.low..=kit.high).step_by(3).collect()
}

/// Mono samples of a kit's sprite at RATE.
pub fn sprite(kit: &Kit, font: &Arc<SoundFont>) -> Vec<f32> {
    let mut settings = SynthesizerSettings::new(RATE);
    settings.enable_reverb_and_chorus = true;
    let mut synth = Synthesizer::new(font, &settings).expect("a synthesizer");
    synth.set_master_volume(0.6);
    synth.process_midi_message(0, 0xB0, 0x00, 0);
    synth.process_midi_message(0, 0xC0, kit.program as i32, 0);
    synth.process_midi_message(0, 0xB0, 7, 110);
    synth.process_midi_message(0, 0xB0, 91, 24);
    synth.process_midi_message(0, 0xB0, 93, 0);
    let slot = (kit.slot * RATE as f64) as usize;
    let hold = (kit.hold * RATE as f64) as usize;
    let block = 64usize;
    let mut left = vec![0f32; block];
    let mut right = vec![0f32; block];
    let mut out = Vec::new();
    for key in keys(kit) {
        // the note before is silenced completely, so nothing rings into the next slot
        synth.note_off_all(true);
        let mut f = 0;
        synth.note_on(0, key as i32, 100);
        while f < slot {
            if f >= hold && f < hold + block {
                synth.note_off(0, key as i32);
            }
            synth.render(&mut left, &mut right);
            for i in 0..block {
                if f + i < slot {
                    // a short fade at the end of the slot
                    let tail = (slot - (f + i)) as f32 / (0.08 * RATE as f32);
                    out.push((left[i] + right[i]) * 0.5 * tail.min(1.0));
                }
            }
            f += block;
        }
    }
    out
}

fn num(v: &serde_json::Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}

/// The records' pieces from scripts/scores.py.
pub fn records(json: &str) -> Vec<Piece> {
    let all: serde_json::Value = serde_json::from_str(json).expect("records.json");
    let mut out = Vec::new();
    for r in all.as_array().expect("a list of records") {
        let mut piece = Piece::new(r["name"].as_str().unwrap_or("record"), num(&r["tempo"]), num(&r["meter"]) as u32);
        piece.ritardando = 1.12;
        for (i, p) in r["parts"].as_array().expect("parts").iter().enumerate() {
            let ch = if i >= 9 { i as u8 + 1 } else { i as u8 };
            piece.parts.push(Part { channel: ch, program: num(&p["program"]) as u8, volume: num(&p["volume"]) as u8, pan: num(&p["pan"]) as u8, reverb: num(&p["reverb"]) as u8, chorus: 0, lay_back: if i == 0 { 12.0 } else { 0.0 } });
            for n in p["notes"].as_array().expect("notes") {
                let n = n.as_array().expect("a note");
                piece.notes.push(Note { channel: ch, key: num(&n[2]) as u8, vel: num(&n[3]) as u8, at: num(&n[0]), len: num(&n[1]), lead: i == 0, held: false });
            }
        }
        let end = piece.notes.iter().map(|n| n.at + n.len).fold(0.0, f64::max);
        piece.bars = (end / piece.meter).ceil() as u32 + 1;
        out.push(piece);
    }
    out
}
