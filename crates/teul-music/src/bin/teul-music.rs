//! Renders teul's pieces to WAV with a SoundFont.
//! Usage: teul-music <soundfont.sf2> <out-dir> [mood ...]
//!        teul-music <soundfont.sf2> <out-dir> --sprites          (the instruments the hero plays)
//!        teul-music <soundfont.sf2> <out-dir> --records <records.json>

use std::path::PathBuf;

use teul_music::{pieces, render, sprites};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: teul-music <soundfont.sf2> <out-dir> [mood ... | --sprites | --records <records.json>]");
        std::process::exit(2);
    }
    let font = render::load_font(&PathBuf::from(&args[1]));
    let out = PathBuf::from(&args[2]);
    std::fs::create_dir_all(&out).expect("the output folder");
    if args.get(3).map(String::as_str) == Some("--sprites") {
        for kit in &sprites::KITS {
            let mono = sprites::sprite(kit, &font);
            let peak = mono.iter().fold(0f32, |m, s| m.max(s.abs())).max(1e-6);
            let stereo: Vec<f32> = mono.iter().flat_map(|s| [*s, *s]).collect();
            let path = out.join(format!("{}.wav", kit.name));
            render::write_wav(&path, &stereo, 0.5 / peak).expect("writing the wav");
            println!("{:<10} {:>3} notes  {:>5.1} s", kit.name, sprites::keys(kit).len(), mono.len() as f64 / render::RATE as f64);
        }
        return;
    }
    if args.get(3).map(String::as_str) == Some("--records") {
        let json = std::fs::read_to_string(args.get(4).expect("the records score")).expect("reading records.json");
        for piece in sprites::records(&json) {
            let samples = render::render(&piece, &font);
            let (peak, _) = render::levels(&samples);
            let gain = 10f32.powf(((-6.0 - peak) / 20.0).min(12.0) as f32);
            render::write_wav(&out.join(format!("{}.wav", piece.name)), &samples, gain).expect("writing the wav");
            println!("{:<18} {:>6.1} s  notes {}", piece.name, samples.len() as f64 / 2.0 / render::RATE as f64, piece.notes.len());
        }
        return;
    }
    let only: Vec<&String> = args[3..].iter().collect();
    for piece in pieces::all() {
        if !only.is_empty() && !only.iter().any(|m| **m == piece.name) {
            continue;
        }
        let samples = render::render(&piece, &font);
        let (peak, rms) = render::levels(&samples);
        // a fixed gain so the loudest piece has headroom; the encoder normalises loudness afterwards
        let gain = 10f32.powf(((-6.0 - peak) / 20.0).min(12.0) as f32);
        let path = out.join(format!("{}.wav", piece.name));
        render::write_wav(&path, &samples, gain).expect("writing the wav");
        println!("{:<9} {:>6.1} s  peak {:>6.1} dBFS  rms {:>6.1} dBFS  notes {}", piece.name, samples.len() as f64 / 2.0 / render::RATE as f64, peak, rms, piece.notes.len());
    }
}
