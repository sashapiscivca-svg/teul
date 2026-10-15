//! teul's music. Pieces are written here as chords, melodies and the way each instrument plays them, then
//! rendered offline with a General MIDI SoundFont through rustysynth (a SoundFont synthesizer in pure Rust)
//! and encoded to Opus for the game to stream. Nothing here runs in the game itself.

pub mod pieces;
pub mod places;
pub mod render;
pub mod score;
pub mod sprites;
pub mod theory;
