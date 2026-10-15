# Changelog

All notable changes to Teul are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/) for the game's saves: a new version always opens the saves of every older one.

## [1.1.0] — 2026-10-15

The first public release: **Lypove only**. Teul is now a fully offline, single-player game about the town of Lypove, its eight surrounding maps and its interiors. The source is published under the AGPL-3.0-or-later, the original content under CC BY-NC-ND 4.0.

### Removed

- **The network world**, cleanly — no feature flags, no dead code:
  - friends without a server: Nostr mailboxes, WebRTC games and voice, QR codes, postcards and parcels, guests, the device code and “About me” network identity, the network badge by the clock and the «People» tab of friends;
  - the lobby «Під Дубом» (Under the Oak) with its library, book worlds and dragon, and the green gate to it in the starting room;
  - the outer world beyond Lypove's edge: Obshyr (Обшир), Zlahoda (Злагода), Lanna Land (Ланна Земля), ruins, fields and regions, the war map «1918», the atlas, Zlahoda's stations and 65 locations, the realm purse with diamonds, the forge, mines, herds and horse riding.
- From the content pack: 65 locations (112 → 47), about 2,100 items (3,224 → 1,138) and 21 stations (227 → 206); the pack shrank from 21.3 MB to 4.4 MB.
- The npm dependencies that served only the network world: `nostr-tools`, `jsqr`, `qrcode-generator`, `@noble/*`.
- On Android: the `CAMERA`, `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions and the `teul://` invite links. On the desktop: network access in the content security policy.

### Changed

- The content security policy is offline on every platform.
- Documentation is in English with Ukrainian versions; internal design notes are no longer part of the repository.
- CI runs the core's tests on Linux, macOS and Windows, checks the content pack and builds the client; the web version is published on GitHub Pages.

### Save compatibility

Saves from 1.0.x open whole, including those that went beyond the edge or had friends:

- events and inputs of the removed features are read as *retired*: they are kept, so the log writes back unchanged and its chain still verifies, and the replay passes over them and over everything done out beyond the edge; they are counted as retired, never as tampering, and the player is where the way back home led;
- items that shipped in 1.0 and no longer exist (`portal_gate`, `bridge`, `planter_box`) are listed as retired in the pack; they leave the home and the inventory after loading;
- 1.x snapshots that held the friends' state are refused, and the world is rebuilt from the whole log instead, then snapshotted anew;
- the network keys, contacts and mailbox that 1.0 kept in the web storage are removed when the world opens, and restoring a 1.0 backup skips them.

## [1.0.x] — 2026

Released as Android APKs and desktop builds before the source was published.
