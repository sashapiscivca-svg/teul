# Third-party material

Teul's own code is under the GNU AGPL-3.0-or-later ([LICENSE](LICENSE)) and its original content under CC BY-NC-ND 4.0 ([LICENSE-ASSETS.md](LICENSE-ASSETS.md)). This file lists what comes from others, with its licence. Every runtime dependency below is under a licence compatible with the AGPL-3.0 (MIT, Apache-2.0, BSD-3-Clause, ISC, 0BSD, Unlicense, Unicode-3.0, and OFL-1.1 for the fonts, which stay separate works).

## Fonts (bundled into the game)

The game ships three fonts from the [Fontsource](https://fontsource.org) packages. They are licensed under the SIL Open Font License, Version 1.1, whose full text follows the copyright lines.

- **Nunito** — Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)
- **Pixelify Sans** — Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)
- **Tiny5** — Copyright 2022-2024 The Tiny5 Project Authors (https://github.com/Gissio/font_tiny5)

```text
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Music: GeneralUser GS SoundFont (used to record the music, not shipped)

The pieces in `app/public/music/*.ogg` are written in `crates/teul-music` and recorded with the GeneralUser GS v2.0.3 SoundFont by S. Christian Collins (https://www.schristiancollins.com), downloaded by `scripts/build-music.sh` into `.cache/` (sha256 9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe). The SoundFont itself is not part of the game. Its licence (verbatim, from `documentation/LICENSE.txt`):

```text
*** GeneralUser GS v2.0.3 ***
***      License v2.0     ***

** License of the complete work **
You may use GeneralUser GS without restriction for your own music creation,
private or commercial. This SoundFont bank is provided to the community free of
charge. Please feel free to use it in your software projects, and to modify the
SoundFont bank or its packaging to suit your needs.

** License of contained samples **
GeneralUser GS inherits the usage rights of the samples contained within, all of
which allow full use in music production, including the ability to make profit
from musical recordings created with GeneralUser GS.
```

The full text, including the author's note on sample provenance, is in the downloaded package.

The seven records in `app/public/music/rec/` are new arrangements of melodies in the public domain: Mykola Leontovych's «Shchedryk» (the melody only, without the copyrighted English lyrics of “Carol of the Bells”), Pachelbel's Canon, Beethoven's «Für Elise», the «Moonlight» Sonata and the «Ode to Joy», “Greensleeves” and “Silent Night”.

## rustysynth (a build tool, not shipped)

rustysynth 1.3 by Nobuaki Tanaka — MIT licence (https://github.com/sinshu/rustysynth). `crates/teul-music` uses it to render the music offline; it is not compiled into the game.

## npm packages in the game

The production dependencies of `app/` (from `app/package-lock.json`, entries not marked `dev`), with the licence from each package's `package.json`. Development tools (Vite, Vitest, TypeScript, the Capacitor CLI and their dependencies) build the game but are not part of it.

| Package | Version | Licence | Source | Used for |
|---|---|---|---|---|
| `@aparajita/capacitor-secure-storage` | 8.0.1 | MIT | https://github.com/aparajita/capacitor-secure-storage | the key store of the device (Android Keystore) for the world's secrets |
| `@capacitor/core` | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | the Android shell's bridge |
| `@capacitor/android` | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | the Android shell |
| `@capacitor/ios` | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | peer dependency of the secure storage plugin (no iOS build is made) |
| `@capacitor/app` | 8.1.2 | MIT | https://github.com/ionic-team/capacitor-plugins | the back button and app state on Android |
| `@capacitor/filesystem` | 8.1.4 | MIT | https://github.com/ionic-team/capacitor-filesystem | saving photos and backups on Android |
| `@capacitor/keyboard` | 8.0.6 | MIT | https://github.com/ionic-team/capacitor-keyboard | peer dependency of the secure storage plugin |
| `@capacitor/share` | 8.0.3 | MIT | https://github.com/ionic-team/capacitor-plugins | the Android share sheet (a photo from the album, a backup file) |
| `@capacitor/synapse` | 1.0.4 | ISC | https://github.com/ionic-team/capacitor | dependency of @capacitor/core |
| `@fontsource/nunito` | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files | the Nunito font (see below) |
| `@fontsource/pixelify-sans` | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files | the Pixelify Sans font (see below) |
| `@fontsource/tiny5` | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files | the Tiny5 font (see below) |
| `tslib` | 2.8.1 | 0BSD | https://github.com/microsoft/tslib | TypeScript runtime helpers |

## Rust crates compiled into the core

The crates compiled into `teul-wasm` (the core as WebAssembly) for `wasm32-unknown-unknown`, from `cargo tree -p teul-wasm --target wasm32-unknown-unknown -e normal` (licence fields from each crate's manifest). Procedural macros run only while compiling and are marked. `teul-core` also has an optional `sqlite` feature (rusqlite with a bundled SQLite: MIT, SQLite is in the public domain) that the game does not use.

| Crate | Version | Licence |
|---|---|---|
| `block-buffer` | 0.10.4 | MIT OR Apache-2.0 |
| `bumpalo` | 3.20.3 | MIT OR Apache-2.0 |
| `cfg-if` | 1.0.5 | MIT OR Apache-2.0 |
| `crypto-common` | 0.1.7 | MIT OR Apache-2.0 |
| `curve25519-dalek` | 4.1.3 | BSD-3-Clause |
| `digest` | 0.10.7 | MIT OR Apache-2.0 |
| `ed25519` | 2.2.3 | Apache-2.0 OR MIT |
| `ed25519-dalek` | 2.2.0 | BSD-3-Clause |
| `generic-array` | 0.14.7 | MIT |
| `itoa` | 1.0.18 | MIT OR Apache-2.0 |
| `memchr` | 2.8.3 | Unlicense OR MIT |
| `once_cell` | 1.21.4 | MIT OR Apache-2.0 |
| `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 (compile time only) |
| `quote` | 1.0.47 | MIT OR Apache-2.0 |
| `serde` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_core` | 1.0.229 | MIT OR Apache-2.0 |
| `serde_derive` | 1.0.229 | MIT OR Apache-2.0 (compile time only) |
| `serde_json` | 1.0.151 | MIT OR Apache-2.0 |
| `sha2` | 0.10.9 | MIT OR Apache-2.0 |
| `signature` | 2.2.0 | Apache-2.0 OR MIT |
| `subtle` | 2.6.1 | BSD-3-Clause |
| `syn` | 3.0.7 | MIT OR Apache-2.0 |
| `typenum` | 1.20.1 | MIT OR Apache-2.0 |
| `unicode-ident` | 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| `wasm-bindgen` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-bindgen-macro` | 0.2.129 | MIT OR Apache-2.0 (compile time only) |
| `wasm-bindgen-macro-support` | 0.2.129 | MIT OR Apache-2.0 |
| `wasm-bindgen-shared` | 0.2.129 | MIT OR Apache-2.0 |
| `zmij` | 1.0.23 | MIT |

The dalek crates (`ed25519-dalek`, `curve25519-dalek`, `subtle`) sign the world's snapshots.

## The desktop build (Tauri)

`desktop/src-tauri` wraps the built web game in Tauri v2 (`tauri` 2.12.3, `keyring` 3.6.3 and their dependencies, 502 packages in `desktop/src-tauri/Cargo.lock`). Tauri and most of its dependencies are MIT or Apache-2.0; a few (for example `cssparser`, `selectors` and `option-ext`) are MPL-2.0, which is compatible with the AGPL-3.0 through its secondary-licence clause. The full list could not be checked offline when this file was written (part of the crates were not in the local cache); before publishing a desktop release, run `cargo about generate` or `cargo deny check licenses` in `desktop/src-tauri` and attach the result to the release.
