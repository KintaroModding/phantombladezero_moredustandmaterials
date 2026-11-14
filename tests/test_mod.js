// Offline test of the mod, run by build.ps1: node tests/test_mod.js
// It loads src/phantombladezero_moredustandmaterials/main.js as PBZModLoader does (a module whose __dirname is the mod's
// folder) with stand-ins for the modules the game gives it (ue, puerts with its blueprint.mixin) and a small game: the
// loot pile, chest and enemy loot classes, the player, the backpack and the combat loot table, an optional running Mods
// Menu and the settings file. It drives the mod's poll and the clock by hand, calls the loot pile's Dust override the
// way the game would, and checks the overrides, stop() and a second copy after it (PBZModLoader's reload).
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");

const FOLDER = path.join(__dirname, "..", "src", "phantombladezero_moredustandmaterials");
const SCRIPT = path.join(FOLDER, "main.js");
const SETTINGS = path.join(FOLDER, "phantombladezero_moredustandmaterials.txt");
const SETTINGS_PATH = FOLDER.replace(/[\\/]+$/, "") + "/phantombladezero_moredustandmaterials.txt";
const MENU_PATH = "C:/Game/ProjectPBZ/Saved/PBZModsMenu/Settings/phantombladezero_moredustandmaterials.txt";
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mod.json"), "utf8")).version;
const PILE = "/Game/PBZContent/Blueprint/Item/Device/BP_Rubbish.BP_Rubbish_C";
const CHEST = "/Game/PBZContent/Blueprint/Item/Device/BP_Chest.BP_Chest_C";
const ENEMY = "/Game/PBZContent/Blueprint/Component/BP_NPCLootComp.BP_NPCLootComp_C";

let failed = 0;
function check(name, ok) {
    console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
    if (!ok) {
        failed++;
    }
}

function modsMenu(world, missing = []) {
    return {
        api: { has: (feature) => !missing.includes(feature) },
        push(...mods) { world.pushed.push(...mods); return world.pushed.length; },
        settingsPath: (id) => (world.pushed.some((m) => m.id == id) ? MENU_PATH : undefined),
    };
}

// The game: the overrides Puerts put on the classes stay with it across copies of the mod.
function newGame() {
    return { mixins: new Map(), loads: 0, dust: [], props: [], inWorld: true };
}

// One fresh load of the script. options.keepState: the mod's state on globalThis stays (a second copy in one game).
function boot(options = {}) {
    const game = options.game || newGame();
    if (!options.keepState) {
        delete globalThis.__moreDustAndMaterials;
    }
    const world = { game, now: 1000000, files: new Map(), warnings: [], logs: [], pushed: [], timer: undefined,
        interval: undefined, cleared: [], loadError: undefined, mixinCalls: 0 };
    for (const [file, text] of Object.entries(options.files || {})) {
        world.files.set(file, text);
    }
    const gameInstance = { path: "/Engine/Transient.GameInstance" };
    const pawn = { path: "/Game/Maps/Level.Level:PersistentLevel.BP_Player_C_0" };
    const backpack = {
        AddDustNum(n) { game.dust.push(n); },
        AddPropsByMap(map) { game.props.push(map); },
    };
    const classes = { [PILE]: { path: PILE }, [CHEST]: { path: CHEST }, [ENEMY]: { path: ENEMY } };
    const ue = {
        Class: { Load: (p) => { game.loads++; return classes[p] || null; } },
        KismetSystemLibrary: {
            IsValid: (o) => !!o && o.valid !== false,
            ConvertToAbsolutePath: (p) => p,
            GetObjectName: (o) => String(o && o.path || "").split(/[./]/).pop(),
            Conv_SoftClassPathToSoftClassRef: () => ({}),
            MakeSoftClassPath: () => ({}),
        },
        GameplayStatics: { GetPlayerCharacter: () => (game.inWorld ? pawn : null) },
        BlueprintPathsLibrary: { FileExists: (p) => world.files.has(p) },
        EasyCsv: { LoadStringFromLocalFile(p, out) { out[0] = world.files.get(p); return true; } },
        PBZBlueprintFunctionLibrary: { GetAttributeFromCharacter: () => 0, MakeAttribute: () => ({}) },
        BasicAttributeSet: { StaticClass: () => "BasicAttributeSet" },
        PBZBackPackSubsystem: { StaticClass: () => "PBZBackPackSubsystem" },
        SubsystemBlueprintLibrary: { GetWorldSubsystem: (ctx, cls) => (cls == "PBZBackPackSubsystem" ? backpack : undefined) },
        LootTotalData: class { constructor() { this.LootDust = 0; } },
        PBZCharacter_NPC: { GetCombatLootData(level, cls, row, out) { out[0] = { LootDust: 100 }; return true; } },
    };
    const puerts = {
        $ref: (value) => [value],
        $unref: (box) => box[0],
        argv: { getByName: (name) => (name == "GameInstance" && !options.noGameInstance ? gameInstance : undefined) },
        blueprint: {
            tojs: (cls) => cls,
            mixin(cls, methods) { world.mixinCalls++; game.mixins.set(cls.path, methods); },
        },
    };
    const stubs = { "ue": ue, "puerts": puerts, "Library/TsHelper": { default: {} } };
    const load = Module._load;
    Module._load = function (request, parent, isMain) {
        if (Object.prototype.hasOwnProperty.call(stubs, request)) {
            return stubs[request];
        }
        return load.call(this, request, parent, isMain);
    };
    const realNow = Date.now, realWarn = console.warn, realLog = console.log;
    const enter = () => {
        Date.now = () => world.now;
        console.warn = (message) => world.warnings.push(String(message));
        console.log = (message) => world.logs.push(String(message));
    };
    const leave = () => {
        Date.now = realNow;
        console.warn = realWarn;
        console.log = realLog;
    };
    let nextTimer = 0;
    world.timers = new Map();
    globalThis.setInterval = (fn, ms) => {
        const id = ++nextTimer;
        world.timers.set(id, { fn, ms });
        if (ms == 1000) { world.timer = fn; world.interval = ms; world.timerId = id; }
        return id;
    };
    globalThis.clearInterval = (id) => { world.cleared.push(id); world.timers.delete(id); };
    globalThis.PBZModsMenu = options.menu === "array" ? [] : options.menu ? modsMenu(world, options.menuMissing) : undefined;
    world.menuGlobal = globalThis.PBZModsMenu;
    delete require.cache[require.resolve(SCRIPT)];
    enter();
    try {
        world.exports = require(SCRIPT);
    }
    catch (e) {
        world.loadError = e;
    }
    finally {
        Module._load = load;
        leave();
    }
    world.poll = (ms = 1000) => {
        world.now += ms;
        enter();
        try {
            world.timer();
        }
        finally {
            leave();
        }
    };
    world.polls = (count) => { for (let i = 0; i < count; i++) world.poll(); };
    world.stop = () => {
        enter();
        try {
            world.exports.stop();
        }
        finally {
            leave();
        }
    };
    // the game picks up a loot pile's Dust: its override's TryToAddDust; the Dust paid, or undefined without the override
    world.pileDust = () => {
        const methods = game.mixins.get(PILE);
        if (!methods) return undefined;
        const before = game.dust.length;
        enter();
        try {
            methods.prototype.TryToAddDust.call({ "Loot Item ID": "Row_Test", LootLevel: 1 });
        }
        finally {
            leave();
        }
        return game.dust.length > before ? game.dust[game.dust.length - 1] : undefined;
    };
    return world;
}

// The module as PBZModLoader loads it, without Mods Menu.
{
    const text = fs.readFileSync(SCRIPT, "utf8");
    check("the source's Mods Menu start list and its throwing stop() are gone",
        !text.includes("__PBZLoaderEntries") && !text.includes("Restart the game to update"));
    const w = boot();
    check("no error at load; stop() exported; one 1 s poll", !w.loadError && typeof w.exports.stop == "function"
        && w.interval == 1000);
    check("one start line for loader.log, naming the settings file in the mod's folder",
        w.logs.length == 1 && w.logs[0] == `[PBZMOD] [More Dust and Materials] ${VERSION} started; settings: ${SETTINGS_PATH}`);
    check("no Mods Menu: no page pushed anywhere", globalThis.PBZModsMenu === undefined && w.pushed.length == 0);
    w.polls(5);
    check("1.1: no settings file: x2, the three loot classes get their override, a loot pile pays 200 for 100",
        w.mixinCalls == 3 && w.pileDust() == 200);
    const shipped = boot({ files: { [SETTINGS_PATH]: fs.readFileSync(SETTINGS, "utf8") } });
    shipped.polls(5);
    check("1.1: the shipped settings file (CRLF) is the same x2",
        fs.readFileSync(SETTINGS, "utf8").includes("\r\n") && shipped.mixinCalls == 3 && shipped.pileDust() == 200
        && shipped.warnings.length == 0);
    const one = boot({ files: { [SETTINGS_PATH]: "Multiplier=1\r\n" } });
    one.polls(5);
    check("Multiplier=1 (every multiplier 1): no class loaded, no override", one.game.loads == 0 && one.mixinCalls == 0);
}

// Multiplier=2 and the overrides.
{
    const w = boot({ files: { [SETTINGS_PATH]: "Multiplier=2\r\n" } });
    w.poll();
    check("Multiplier=2: the three loot classes get their override once", w.mixinCalls == 3
        && [PILE, CHEST, ENEMY].every((p) => w.game.mixins.has(p)));
    w.polls(5);
    check("... and not again on later polls", w.mixinCalls == 3);
    check("a loot pile's Dust: 100 rolled, 200 paid", w.pileDust() == 200);
    w.files.set(SETTINGS_PATH, "Multiplier=2\r\nDustMultiplier=3\r\n");
    w.polls(2);
    check("DustMultiplier=3 (live): 300 paid", w.pileDust() == 300);
    const timerId = w.timerId;
    w.stop();
    check("stop(): the poll timer cleared, a line for loader.log, no warning", w.cleared.includes(timerId)
        && !w.timers.has(timerId) && w.logs[w.logs.length - 1] == "[PBZMOD] [More Dust and Materials] stopped"
        && w.warnings.length == 0);
    check("stop(): the override (it stays on the class) pays the game's own amount, 100", w.pileDust() == 100);
    const again = boot({ game: w.game, keepState: true, files: { [SETTINGS_PATH]: "Multiplier=2\r\n" } });
    again.poll();
    check("a second copy after stop() (the reload): no second override, and the one on the class pays x2 again (200)",
        !again.loadError && again.mixinCalls == 0 && again.pileDust() == 200);
    const outside = boot({ game: Object.assign(newGame(), { inWorld: false }), files: { [SETTINGS_PATH]: "Multiplier=2\r\n" } });
    outside.polls(3);
    check("at the title (no player): no class loaded", outside.game.loads == 0);
}

// Mods Menu: optional.
{
    const m = boot({ menu: true, files: { [MENU_PATH]: "Multiplier=3\r\n" } });
    const page = m.pushed[0];
    check("Mods Menu running: one page with the mod's id, version, file, store \"saved\" and name",
        m.pushed.length == 1 && page.id == "phantombladezero_moredustandmaterials" && page.version == VERSION
        && page.file == "phantombladezero_moredustandmaterials.txt" && page.store == "saved"
        && page.title.en == "More Dust and Materials" && page.settings.length >= 6
        && page.settings.find((s) => s.key == "Multiplier").default == 2);
    m.poll();
    check("... the mod reads the file the page saves (Multiplier=3 there: 300 paid)",
        m.logs[0] == `[PBZMOD] [More Dust and Materials] ${VERSION} started; settings: ${MENU_PATH} (Mods Menu's page)`
        && m.pileDust() == 300);
    const a = boot({ menu: "array", files: { [MENU_PATH]: "Multiplier=3\r\n" } });
    a.poll();
    check("Mods Menu not started yet (a plain array): nothing pushed, the mod's own file (none: x2, 200 paid)",
        a.menuGlobal.length == 0 && a.pileDust() == 200);
    const o = boot({ menu: true, menuMissing: ["store.saved"] });
    check("an older Mods Menu without store \"saved\": no page", o.pushed.length == 0);
}

// A failed start.
{
    const n = boot({ noGameInstance: true });
    check("no GameInstance: the load throws (PBZModLoader logs the mod as failed), no timer",
        !!n.loadError && n.timer === undefined);
}

process.exit(failed ? 1 : 0);
