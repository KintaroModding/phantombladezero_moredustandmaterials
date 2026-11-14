# More Dust and Materials

More Dust and upgrade materials from enemies, loot piles and chests, x2 as installed, any multiplier from 1 to 10, set live: separate multipliers for Dust and for Blackstone and Amber fragments, optional camp rewards. A PBZModLoader mod; settings in a text file in its folder, or on its Mods Menu page.

A [PBZModLoader](https://github.com/KintaroModding/phantombladezero_pbzmodloader) mod for Phantom Blade Zero (Unreal Engine
5.7), made with game version `CL-302256_JKS-17280` and PBZModLoader 2.1.0. This README is for developers.
What the mod does, how to install it and its compatibility are in [openmods.md](openmods.md), the mod page on
[openmods](https://openmods.nexus).

## How it works

The game runs much of its logic in JavaScript (Puerts). PBZModLoader loads every folder in
`ProjectPBZ/PBZModLoader/mods/` that has a `main.js`, through the game's own module system, after the game's
`MainStart`; `require("ue")`, `require("puerts")` and `require("Library/TsHelper")` are the game's modules, and
`puerts.argv.getByName("GameInstance")` gives the game instance. Before a reload (Alt+F5) the loader awaits the mod's
`stop()`, which must give back everything the mod changed.

The logic is the author's earlier Mods Menu script 2.5.0, unchanged except where a comment says "1.0 (port)". A poll
every second reads the settings every 2 s and, in a world with any multiplier above 1, puts Puerts mixins
(`puerts.blueprint.mixin`) on three Blueprint classes, once per class:

- **Dust:** the game pays loot Dust as Dust x clamp(1 + `MindDustAdditiveMultiplier`, 1, 100). The overrides of
  `BP_NPCLootComp` "Loot Items" (enemy deaths), `BP_Rubbish` `TryToAddDust` (loot piles) and `BP_Chest` "Pickup Items"
  (chests) pay that amount times `DustMultiplier` (or `Multiplier` while it is Same). Boss and tutorial enemies, the
  110 loot rows that quest, dialogue, inscription and item data name, and rows that hold a medicine pay stock.
- **Upgrade materials:** `BP_Rubbish` "Not Has AnyValidItem" and `BP_Chest` "Pickup Items" scale the rolled name ->
  amount map before the backpack gets it: the 32 upgrade materials (times `Multiplier`) and the 2 fragments (times
  `FragmentMultiplier`). Single items round up or down at random, so they average out.
- **Camp rewards:** `MobGroupScript_AddItemAfterCombat` is not overridden. While `FragmentMultiplier` is above 1 (or
  `CampRewards` is on), a once-a-frame check sees a camp reward when `PBZGameSystem.CompleteAddItemMobDomainNames` grows,
  and tops up its fragments (and, with `CampRewards`, the Dust and materials of 17 known camps) through the backpack.

A mixin cannot be taken off again; the overrides read the settings from `globalThis.__moreDustAndMaterials.state`, so at
1 (and after `stop()`) they pay the game's own amounts.

The port (1.0):

- **Settings file:** next to `main.js`, or with Mods Menu's page the file the page saves. The source wrote no file;
  the shipped `phantombladezero_moredustandmaterials.txt` holds the defaults, and a missing file means the same.
- **stop():** the source's own `shared.stop()`: its timers end and its settings go to stock (every multiplier 1). A
  copy that starts later takes over the state and the mixins already on the classes.
- **Names:** the state key and the page say "More Dust and Materials", so the earlier Mods Menu script, if still
  installed, never shares them.

1.1 (the user's choice): the mod starts at x2 (`Multiplier=2`, Dust follows it; fragments stay x1, as the source kept
them out unless raised). The source started at x1. `stop()` still goes to x1: `STOCK` is apart from the x2
`DEFAULTS`.

`tests/test_mod.js` runs the script in Node.js against a small stand-in game (20 checks).

- **Settings file:** `phantombladezero_moredustandmaterials.txt` next to `main.js` (`__dirname`, the mod's folder as a full path), read every
  2 s with `EasyCsv.LoadStringFromLocalFile` and written with the defaults when missing. The shipped file is exactly the
  script's default text (`tests/test_mod.js` checks it).
- **Mods Menu, optional:** PBZModLoader starts its mods after Mods Menu's, so a running Mods Menu (0.9.0 or later) has
  its registry object in `globalThis.PBZModsMenu` by then. Only when it has the features `settingsPath` and
  `store.saved`, the mod pushes its page (id `phantombladezero_moredustandmaterials`, `store: "saved"`) and reads the file the page saves
  (`PBZModsMenu.settingsPath(id)`, in Mods Menu's Saved folder): a registered page cannot save anywhere else.
- **Log:** `console.log` lines that start with `[PBZMOD]` and the game's warnings reach `ProjectPBZ/PBZModLoader/loader.log`.

## Check and deploy

Requirements: Windows PowerShell 5.1 and [Node.js](https://nodejs.org/) (for `node --check` and the offline test).

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1             # node --check, tests\test_mod.js
powershell -ExecutionPolicy Bypass -File .\build.ps1 -Deploy     # the checks, then deploy.ps1
powershell -ExecutionPolicy Bypass -File .\deploy.ps1            # copy src\phantombladezero_moredustandmaterials to the game
```

`deploy.ps1` mirrors `src\phantombladezero_moredustandmaterials\` to `<game folder>\ProjectPBZ\PBZModLoader\mods\phantombladezero_moredustandmaterials\`. The
settings file that is already there is the tester's and stays; `-ResetConfig` copies the shipped one. The game folder
comes from `gameDir` in `_tools\gamedata\phantombladezero\game.json`, else `$env:UE5_GAMES_DIR\PBZ`; `-GameDir` or
`-ModsDir` override it. It stops when PBZModLoader is not installed (its start file
`ProjectPBZ\Content\JavaScript\PBZModLoader\bootstrap.js` is missing).

The GitHub release zip holds the mod folder at `ProjectPBZ/PBZModLoader/mods/phantombladezero_moredustandmaterials/`, so players unpack it
into the game folder.

Versioning: every change raises the second number in `mod.json` and `main.js` (1.0 -> 1.1): `python scripts\bump_version.py`.

## Project layout

```
src/phantombladezero_moredustandmaterials/   The mod folder: main.js and the shipped settings file
tests/test_mod.js     Offline test of main.js (Node.js, stand-ins for the game)
docs/                 Cover and screenshots
scripts/              bump_version.py, check_openmods.py, publish.ps1
build.ps1, deploy.ps1 Checks; copy into the game
mod.json              Name, version, game, kind pbzmodloader, modsPath
```

## License

MIT, see [LICENSE](LICENSE).
