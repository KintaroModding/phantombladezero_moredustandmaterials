# More Dust and Materials

More Dust and upgrade materials from enemies, loot piles and chests, 1 to 10 times, with separate Dust and fragment multipliers. A PBZModLoader mod.

## What it does

More Dust and upgrade materials from loot: x2 as installed, any multiplier from 1 to 10, set live:

- **Dust** from enemies, loot piles and chests (its own multiplier, or the same as the materials).
- **Upgrade materials** from loot piles and chests.
- **Blackstone and Amber fragments** from loot piles, chests and the rewards for clearing a group of enemies (their own
  multiplier). Four make a Blackstone or an Amber, which raise your stats for good.
- **Optional:** the Dust and materials of those camp rewards too.

Bosses, quest and story rewards stay as they are. Single items round up or down at random, so they average out.

It is a PBZModLoader mod: a script in the game's own script engine. It replaces no game file. What you pick up goes
into your save as usual; the mod itself writes nothing there. As installed, Dust and upgrade materials are x2; fragments
stay as in the game until you raise their multiplier.

## Screenshots

![More Dust and Materials](docs/cover.webp)

## How to install

1. Install [PBZModLoader](https://github.com/KintaroModding/phantombladezero_pbzmodloader) 2.1.0 or later.
2. Download the zip of the latest release on GitHub (`phantombladezero_moredustandmaterials_<version>.zip`).
3. Unpack it into the game folder (the folder that holds `ProjectPBZ`). It adds the folder
   `ProjectPBZ\PBZModLoader\mods\phantombladezero_moredustandmaterials\` with `main.js` and the settings file.
4. Start the game.

To check that it runs: `ProjectPBZ\PBZModLoader\loader.log` has the line
`[PBZMOD] [More Dust and Materials] <version> started; settings: ...`.

To update the mod, replace `main.js` with the one of the new release; keep your settings file (a setting that it does
not have keeps its default). To remove the mod, delete the folder `ProjectPBZ\PBZModLoader\mods\phantombladezero_moredustandmaterials\`.

## How to use

Nothing to do: loot as usual. To change the multipliers, use the Mods Menu page or the settings file below.

## Settings

The settings are in `ProjectPBZ\PBZModLoader\mods\phantombladezero_moredustandmaterials\phantombladezero_moredustandmaterials.txt`. Open it with a text editor,
change a value and save: the mod reads the file every 2 seconds, so the game uses it without a restart. Without the
file the mod writes it with the defaults below. Keys are not case-sensitive; `;` or `#` starts a comment.

**With Mods Menu** (0.9.0 or later) in the game, the mod adds its page to Mods Menu's tab in the game's settings, and
the page's settings are the ones that count: Mods Menu keeps them in its own file in the game's `Saved` folder, and
the file in the mod's folder is not read then.

| Setting | Default | What it does |
|---|---|---|
| `Multiplier` | `2` | Upgrade materials from loot piles and chests, 1 to 10 (1 = the game's amount, 2 doubles it) |
| `DustMultiplier` | `Same` | Dust from enemies, loot piles and chests: `Same` (as `Multiplier`) or 1 to 10 |
| `FragmentMultiplier` | `1` | Blackstone and Amber fragments from loot piles, chests and camp rewards, 1 to 10 |
| `CampRewards` | `Off` | `On`: the Dust and upgrade materials for clearing a group of enemies follow the multipliers too |
| `MaterialsOnly` | `Off` | `On`: Dust stays as it is (the same as `DustMultiplier=1`; for older settings files) |
| `DustOnly` | `Off` | `On`: upgrade materials stay as they are (for older settings files) |

## Compatibility

- Game version: Steam build 26367565 (`CL-302256_JKS-17280`).
- Needs PBZModLoader 2.1.0 or later. Mods Menu is optional.
- Phantom Tuner has its own Dust and material multipliers (`RewardDust`, `RewardMaterials`). Both can run together:
  their multipliers then multiply (x2 here and x2 there give x4). Nothing loops or grows by itself. Use the one you
  prefer, or set the other to 1.
- [Cheaper Upgrades](https://github.com/KintaroModding/phantombladezero_cheaperupgrades) and
  [Infinite Merchant Stock](https://github.com/KintaroModding/phantombladezero_infinitemerchantstock) change other
  things (upgrade costs, shop stock) and work together with this one.
- Another mod that overrides the same loot pile, chest or enemy loot functions: only one of them works.

## Known issues

- None known.

## How to build

There is nothing to build: `src\phantombladezero_moredustandmaterials\` is the mod folder (`main.js` and the settings file).
`tests\test_mod.js` runs the script outside the game with Node.js and stand-ins for the game: `node tests\test_mod.js`.
`README.md` has the details.

## Credits

Made by Kintaro. MIT license: you may use, change and share this mod. PBZModLoader is made by LKF, its fork by
KintaroModding. Phantom Blade Zero and its files belong to their makers.
