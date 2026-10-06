# SpireForge

> A modern card editor for Slay the Spire 2 — build cards in a standalone GUI, preview live, package & install in one click, publish to the Steam Workshop

[中文](README.md) | English

![Game version](https://img.shields.io/badge/Game%20version-v0.111.0-blue) ![Runtime](https://img.shields.io/badge/Runtime-0.1.9-green)

![Editor main window](docs/screenshot.png)

## Download & Use

Grab the latest `SpireForge-*-win64.zip` from [Releases](../../releases), unzip, then:

1. Double-click `editor.exe` (single file, frontend embedded; needs WebView2 Runtime — preinstalled on Win10/11);
2. On first launch, pick your game root folder (auto-detected on the welcome page);
3. **Copy the bundled `SpireForgeRuntime` folder into the game's `mods` directory** (required dependency, one time only);
4. Create a pack → create or import cards → "Publish / Install" → restart the game.

> The editor auto-installs/updates the Runtime prerequisite on startup — manual copying is only needed for source builds.

## Quick Start (build from source)

```bash
# 1. Build & launch the editor
cd editor && pnpm install && pnpm tauri dev

# 2. First run
#    - The welcome page auto-detects the game directory (pick it manually if not)
#    - Create a pack project → create cards → "Publish / Install"

# 3. Install the Runtime (pack prerequisite, one time)
cd runtime && dotnet build -c Release
#    Copy .godot/mono/temp/bin/Release/SpireForgeRuntime.dll + SpireForgeRuntime.json
#    into <game>/mods/SpireForgeRuntime/
```

## Features

- **Modern dark UI** (Tauri 2 + React + Tailwind) — standalone desktop app, the game doesn't need to be running
- **All card types**: Attack / Skill / Power / Curse / Status / Quest
- **Custom costs**: X-cost, 0-cost, and -1 (unplayable)
- **Built-in game effects**: deal damage, gain Block, draw, gain Energy, restore HP (data-driven, easy to extend)
- **Animations & audio**: played damage uses the vanilla attack choreography (lunge + hit VFX + SFX), plus a Play-VFX effect;
  the VFX/SFX catalogs show which vanilla card or monster uses each entry — search by card or monster name
- **Advanced effects**: summon enemies (auto placement), spawn cards, delayed effects (my turn / enemy turn / both), and more
- **Modify vanilla cards**: built-in catalog of 577 vanilla cards — import any of them as an override and change cost / values / text / behavior
- **Lifecycle hooks**: when drawn / discarded / exhausted / at combat start / end of turn in hand — same effect system
- **Custom effect API**: `custom` effects + the `SfEffects` registry — other mods can reference Runtime.dll to extend anything
- **Batch import**: import multi-card JSON containers; open `.pck` packs directly (unpack other users' packs and edit them)
- **Third-party character pools**: read from the game, import a config JSON, or add manually to put cards in other character mods' pools
- **Custom art**: PNG/JPEG/WebP upload with the official 250×190 crop guide
- **Bilingual UI**: `{Damage}` placeholders, BBCode coloring, upgraded-value comparison
- **One-click install**: package a PCK and write it into the game's mods folder from the editor
- **No-compilation packs**: packs are pure data (JSON+PNG); game updates only need a Runtime update
- **One-click Workshop publishing**: the official ModUploader v0.2.0 is bundled and auto-extracted on first use

## Layout

| Directory | Purpose |
|---|---|
| `editor/` | Tauri 2 editor (React+TS frontend / Rust backend) |
| `runtime/` | In-game interpreter mod (C#/.NET 9) — reads pack JSON and creates cards dynamically |
| `docs/` | **Six handover documents** (start with [HANDOVER.md](docs/HANDOVER.md)) |
| `tools/` | pcktool (PCK CLI), publish-test (packaging tests), test assets |

## Documentation

- [HANDOVER.md](docs/HANDOVER.md) — project status, five-minute tour, roadmap, gotcha log
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — four-component architecture, registration timing, PCK format
- [SCHEMA.md](docs/SCHEMA.md) — card JSON field-by-field reference
- [CUSTOM-POOLS.md](docs/CUSTOM-POOLS.md) — third-party character pool import, dependencies & compatibility limits
- [RUNTIME-MOD.md](docs/RUNTIME-MOD.md) — Runtime design + game-update adaptation workflow
- [BUILD.md](docs/BUILD.md) — environment requirements, build steps, test matrix

## How It Works

```
Editor (build cards) → pack = mods/<Id>/<Id>.json + <Id>.pck (JSON+PNG+localization)
                      ↓ mounted by the game's built-in loader
Runtime mod scans pack JSON → Reflection.Emit one type per card → registers into ModelDb + pools
                      ↓ when played in-game
OnPlay executes the effect list via the game's Cmd APIs (await)
```

**Why packs survive game updates**: the game identifies cards by "type name → ModelId" derivation;
the Runtime generates dynamic types for your data, so when the game API changes only the Runtime
needs updating — published packs keep working.

## License & Acknowledgments

This project is open source under the [MIT](LICENSE) license (free; the Spire Codex derived content
may only be used non-commercially — see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)).
This is a community tool, not affiliated with Mega Crit. Game assets are © Mega Crit.
The bundled ModUploader comes from [MegaCrit/sts2-mod-uploader](https://github.com/Megacrit/sts2-mod-uploader) (MIT).
The vanilla card / power / monster catalogs and icons come from [spire-codex](https://github.com/ptrlrd/spire-codex)
(PolyForm Noncommercial — see the third-party notices).
Research benefited from community projects such as BaseLib (Alchyr), RitsuLib (BAKAOLC), and fresh-milkshake/Modding-Tutorial.
