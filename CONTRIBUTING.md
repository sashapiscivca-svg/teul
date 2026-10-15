# Contributing to Teul

[Українською](CONTRIBUTING.uk.md)

Thank you for wanting to help. Bug reports, fixes, translations, tests and documentation are all welcome. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs:** open an issue with what you did, what you expected and what happened, the platform (browser, Android, desktop) and the version you installed. If a save is involved, say so — but do not attach a save or a backup publicly unless you are happy for others to see your world.
- **Larger changes** (a new system, a new place, a change to the rules of the world): open an issue first so we can agree on the idea before you spend time on it.
- **Security issues:** do not open a public issue; see [SECURITY.md](SECURITY.md).

## The rules of the codebase

- **Determinism.** Everything that decides an outcome lives in the core (`crates/teul-core`), which reads no clock and uses no `f32`/`f64`. The client only asks and draws.
- **Saves never break.** A new version must open every older save. Never rename or remove `Command`/`EventKind` variants, their fields (add new ones with `#[serde(default)]`) or content ids; retire or alias them instead. See [docs/architecture.md](docs/architecture.md#save-integrity-and-compatibility). Golden saves in `crates/teul-core/tests/fixtures` are never rewritten.
- **Content is generated.** Edit the generators in `scripts/`, then run `python3 scripts/gen_base_content.py` and commit `content/base/pack.json` and `content/base/en.json` with your change. Every player-facing string has Ukrainian and English text (`app/src/lang/*.ts`, `scripts/lang/en/`); `python3 scripts/lang_en.py --strict` must pass.
- **Style.** Code, comments and commit messages are in English; follow the style of the surrounding code. Markdown is never hard-wrapped: one paragraph or list item per line.
- **Tests.** Add or update tests with your change. Before opening a pull request, run `scripts/check.sh` (it runs what your change touched) or `scripts/check.sh --full`; see [docs/testing.md](docs/testing.md) and the build steps in the [README](README.md#build-run-and-test).

## Pull requests

- Keep a pull request to one topic, with commits that each make sense on their own and messages that say why.
- CI must pass (the core's tests on three systems, the content check and the client build).
- Describe what you changed and how you checked it; screenshots help for anything visible.

## Sign-off and licence of contributions

Teul's code is licensed under the [GNU AGPL-3.0-or-later](LICENSE) and its original content under [CC BY-NC-ND 4.0](LICENSE-ASSETS.md). To keep the project able to offer the code under other terms as well, contributions come with two things:

1. **Developer Certificate of Origin.** Every commit must be signed off (`git commit -s`), which adds a `Signed-off-by: Your Name <you@example.com>` line. By signing off you certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/): that you wrote the contribution or otherwise have the right to submit it under the project's licences.
2. **Licence grant.** By submitting a contribution you agree that it may be distributed by the project under the AGPL-3.0-or-later (or, for content, under CC BY-NC-ND 4.0), and you grant the copyright holder of Teul a perpetual, worldwide, non-exclusive, royalty-free, irrevocable licence to use, modify, sublicense and relicense your contribution under other terms, including commercial ones. You keep the copyright in your contribution.

If you cannot agree to this — for example, because your employer owns your work — please say so in the pull request before it is merged.

The names «Teul» and «Lypove» and the icon are covered by [TRADEMARKS.md](TRADEMARKS.md), not by these licences.
