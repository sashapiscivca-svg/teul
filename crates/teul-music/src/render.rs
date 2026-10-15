//! Plays a piece through a SoundFont (rustysynth) into stereo samples, as a person would play it: notes a hair
//! early or late, the last bars slowing down, the room's reverb ringing out at the end.

use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::Arc;

use rustysynth::{SoundFont, Synthesizer, SynthesizerSettings};

use crate::score::{hash, Piece};

pub const RATE: i32 = 44_100;

/// Seconds from the start for each beat position, slowing toward the end of the written music.
pub struct Clock {
    step: f64,
    table: Vec<f64>,
}

impl Clock {
    pub fn of(piece: &Piece, written_beats: f64) -> Clock {
        let step = 1.0 / 64.0;
        let spb = 60.0 / piece.tempo;
        let n = ((written_beats + piece.meter * 8.0) / step) as usize + 2;
        let slow_from = (written_beats - piece.meter * 2.0).max(0.0);
        let mut table = Vec::with_capacity(n);
        let mut t = 0.0;
        for i in 0..n {
            table.push(t);
            let b = i as f64 * step;
            let k = if b < slow_from { 1.0 } else { 1.0 + (piece.ritardando - 1.0) * ((b - slow_from) / (written_beats - slow_from).max(1.0)).min(1.0) };
            t += step * spb * k;
        }
        Clock { step, table }
    }

    pub fn seconds(&self, beat: f64) -> f64 {
        let i = (beat / self.step).floor().max(0.0) as usize;
        let i = i.min(self.table.len() - 2);
        let frac = beat / self.step - i as f64;
        self.table[i] + (self.table[i + 1] - self.table[i]) * frac
    }
}

#[derive(Clone, Copy)]
struct Ev {
    frame: usize,
    on: bool,
    channel: u8,
    key: u8,
    vel: u8,
}

/// When every note starts and stops, in samples, humanised.
fn events(piece: &Piece) -> (Vec<Ev>, usize) {
    let written = piece.notes.iter().map(|n| n.at + n.len).fold(0.0, f64::max);
    let clock = Clock::of(piece, written);
    let mut out = Vec::with_capacity(piece.notes.len() * 2);
    for (i, n) in piece.notes.iter().enumerate() {
        let lay = piece.parts.iter().find(|p| p.channel == n.channel).map_or(0.0, |p| p.lay_back) / 1000.0;
        // a few milliseconds either way; the downbeats of the bass and drums stay tighter
        let spread = if n.channel == 9 { 0.004 } else { 0.009 };
        let jitter = (hash(i as u64, n.key as u64 * 131 + n.channel as u64) - 0.5) * 2.0 * spread;
        let start = (clock.seconds(n.at) + jitter + lay).max(0.0);
        let end = clock.seconds(n.at + n.len) + lay;
        let vel_wobble = ((hash(n.key as u64, i as u64 + 7) - 0.5) * 8.0) as i32;
        let vel = (n.vel as i32 + vel_wobble).clamp(1, 127) as u8;
        out.push(Ev { frame: (start * RATE as f64) as usize, on: true, channel: n.channel, key: n.key, vel });
        out.push(Ev { frame: (end.max(start + 0.03) * RATE as f64) as usize, on: false, channel: n.channel, key: n.key, vel: 0 });
    }
    // offs before ons at the same frame, so a repeated note is struck again
    out.sort_by_key(|e| (e.frame, e.on as u8));
    let bars_end = clock.seconds(piece.bars as f64 * piece.meter);
    // the rest bars already leave room for the reverb to ring out; a little more and the loop starts again
    let total = ((bars_end.max(clock.seconds(written) + 2.5) + 1.5) * RATE as f64) as usize;
    (out, total)
}

/// Renders a piece to interleaved stereo f32 at RATE.
pub fn render(piece: &Piece, font: &Arc<SoundFont>) -> Vec<f32> {
    let mut settings = SynthesizerSettings::new(RATE);
    settings.enable_reverb_and_chorus = true;
    settings.maximum_polyphony = 96;
    let mut synth = Synthesizer::new(font, &settings).expect("a synthesizer");
    synth.set_master_volume(0.5);
    for p in &piece.parts {
        let ch = p.channel as i32;
        if p.channel == 9 {
            synth.process_midi_message(ch, 0xB0, 0x00, 128);
        } else {
            synth.process_midi_message(ch, 0xB0, 0x00, 0);
        }
        synth.process_midi_message(ch, 0xC0, p.program as i32, 0);
        synth.process_midi_message(ch, 0xB0, 7, p.volume as i32);
        synth.process_midi_message(ch, 0xB0, 10, p.pan as i32);
        synth.process_midi_message(ch, 0xB0, 91, p.reverb as i32);
        synth.process_midi_message(ch, 0xB0, 93, p.chorus as i32);
        synth.process_midi_message(ch, 0xB0, 11, 127);
    }
    let (evs, total) = events(piece);
    let block = 64usize;
    let mut left = vec![0f32; block];
    let mut right = vec![0f32; block];
    let mut out = Vec::with_capacity(total * 2);
    let mut next = 0;
    let mut frame = 0;
    while frame < total {
        while next < evs.len() && evs[next].frame <= frame {
            let e = evs[next];
            if e.on {
                synth.note_on(e.channel as i32, e.key as i32, e.vel as i32);
            } else {
                synth.note_off(e.channel as i32, e.key as i32);
            }
            next += 1;
        }
        synth.render(&mut left, &mut right);
        for i in 0..block {
            out.push(left[i]);
            out.push(right[i]);
        }
        frame += block;
    }
    out
}

/// Peak and RMS (dBFS) of interleaved samples.
pub fn levels(samples: &[f32]) -> (f64, f64) {
    let mut peak = 0f64;
    let mut sum = 0f64;
    for s in samples {
        let a = s.abs() as f64;
        peak = peak.max(a);
        sum += a * a;
    }
    let rms = (sum / samples.len().max(1) as f64).sqrt();
    (20.0 * peak.max(1e-9).log10(), 20.0 * rms.max(1e-9).log10())
}

/// Writes interleaved stereo f32 as a 16-bit WAV (scaled by `gain`, soft-limited so nothing clips).
pub fn write_wav(path: &Path, samples: &[f32], gain: f32) -> std::io::Result<()> {
    let mut f = File::create(path)?;
    let data_len = (samples.len() * 2) as u32;
    f.write_all(b"RIFF")?;
    f.write_all(&(36 + data_len).to_le_bytes())?;
    f.write_all(b"WAVEfmt ")?;
    f.write_all(&16u32.to_le_bytes())?;
    f.write_all(&1u16.to_le_bytes())?;
    f.write_all(&2u16.to_le_bytes())?;
    f.write_all(&(RATE as u32).to_le_bytes())?;
    f.write_all(&(RATE as u32 * 4).to_le_bytes())?;
    f.write_all(&4u16.to_le_bytes())?;
    f.write_all(&16u16.to_le_bytes())?;
    f.write_all(b"data")?;
    f.write_all(&data_len.to_le_bytes())?;
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for s in samples {
        let x = (s * gain).clamp(-4.0, 4.0);
        // gentle saturation above -3 dB instead of clipping
        let y = if x.abs() < 0.7 { x } else { x.signum() * (0.7 + 0.3 * ((x.abs() - 0.7) / 0.3).tanh()) };
        bytes.extend_from_slice(&((y * 32767.0) as i16).to_le_bytes());
    }
    f.write_all(&bytes)?;
    Ok(())
}

pub fn load_font(path: &Path) -> Arc<SoundFont> {
    let mut file = File::open(path).expect("the soundfont file");
    Arc::new(SoundFont::new(&mut file).expect("a valid soundfont"))
}
