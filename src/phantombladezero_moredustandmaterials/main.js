"use strict";
// More Dust and Materials for Phantom Blade Zero: a PBZModLoader mod
// (ProjectPBZ/PBZModLoader/mods/phantombladezero_moredustandmaterials/).
//
// The logic is the author's earlier Mods Menu script 2.5.0, unchanged except where a comment says "1.0 (port)"; its own
// version notes stay in the comments. The port to PBZModLoader, which loads this file after the game's MainStart:
// - Settings: phantombladezero_moredustandmaterials.txt in this mod's folder (__dirname). With Mods Menu (0.9.0 or
//   later) running, the mod adds its page there and reads the file that the page saves instead (pbzMoreDustPath): a
//   registered page cannot save anywhere else.
// - stop() (PBZModLoader's Alt+F5 reload) is the source's own shared.stop(): its timers end and its settings go to
//   stock (x1), so the Blueprint overrides (they cannot be taken off again) pay the game's own amounts. A copy that
//   starts later takes over the state on globalThis and the overrides already on (the source's second-load handling).
// - Log: a [PBZMOD] start and stop line for loader.log.
// 1.1: without a settings file (or a Multiplier line) the mod starts at x2 (the user's choice; the source started at
// x1); stop() still goes to x1 (STOCK). Every place says "1.1".
const PBZ_DM_VERSION = "1.1";
const PBZ_DM_ID = "phantombladezero_moredustandmaterials"; // the mod folder's name and Mods Menu's page id
const __dmUE = require("ue"), __dmHost = require("puerts");
if (!__dmUE.Class || typeof __dmUE.Class.Load !== "function" || !__dmUE.GameplayStatics || typeof __dmUE.GameplayStatics.GetPlayerCharacter !== "function" || !__dmUE.BlueprintPathsLibrary || typeof __dmUE.BlueprintPathsLibrary.FileExists !== "function" || !__dmUE.EasyCsv || typeof __dmUE.EasyCsv.LoadStringFromLocalFile !== "function" || !__dmHost.blueprint || typeof __dmHost.blueprint.tojs !== "function" || typeof __dmHost.blueprint.mixin !== "function") throw new Error("More Dust and Materials: runtime APIs of the game are missing");
let __pbzStandaloneReady = false;
const __pbzRuntime = require("ue"), __pbzHost = require("puerts");
if (!__pbzHost.argv || !__pbzHost.argv.getByName("GameInstance") || !__pbzRuntime.KismetSystemLibrary || typeof __pbzRuntime.KismetSystemLibrary.ConvertToAbsolutePath !== "function") throw new Error("More Dust and Materials: runtime APIs of the game are missing");
// 1.0 (port): Mods Menu is optional. PBZModLoader starts its mods after Mods Menu's, so a running Mods Menu (0.9.0 or
// later, with settingsPath and store "saved") has its registry in globalThis.PBZModsMenu by now: the page goes there, and
// the file it saves is the one this mod reads. Without it nothing is pushed: an array left for a Mods Menu that starts
// later would give a page that saves another file than the one this mod reads.
const pbzMoreDustMenu = { on: false };
function pbzMoreDustMenuWanted() {
    const mm = globalThis.PBZModsMenu;
    return !!(mm && typeof mm === "object" && !Array.isArray(mm) && typeof mm.push === "function"
        && typeof mm.settingsPath === "function" && mm.api && typeof mm.api.has === "function"
        && mm.api.has("settingsPath") && mm.api.has("store.saved"));
}
function pbzMoreDustPush(page) {
    try {
        globalThis.PBZModsMenu.push(page);
        pbzMoreDustMenu.on = typeof globalThis.PBZModsMenu.settingsPath(PBZ_DM_ID) === "string";
    }
    catch (e) {
        console.warn(`[More Dust and Materials] no Mods Menu page: ${e}`);
    }
}
// 1.0 (port): the settings file: the one Mods Menu's page saves, else `file` next to this main.js (__dirname is the
// mod's folder, a full path, as PBZModLoader loads the mod).
function pbzMoreDustPath(file) {
    if (pbzMoreDustMenu.on) {
        const path = globalThis.PBZModsMenu.settingsPath(PBZ_DM_ID);
        if (typeof path === "string" && path)
            return path;
    }
    return __pbzRuntime.KismetSystemLibrary.ConvertToAbsolutePath(String(__dirname).replace(/[\\/]+$/, "") + "/" + file);
}
// More Dust and Materials: begin. More Dust and upgrade materials from loot, at any multiplier from 1 to 10, set live.
// Settings (1.0 (port): see the head), re-read every 2 s and on a Mods Menu change:
// "Multiplier=2" (upgrade materials, and Dust while DustMultiplier is Same), "DustMultiplier=Same" (or 1 to 10),
// "FragmentMultiplier=1" (Blackstone and Amber fragments in piles and chests), and the 2.1 switches "MaterialsOnly=Off"
// (On: Dust stock) and "DustOnly=Off" (On: materials stock), still read so older files keep working.
// With every multiplier at 1 nothing below runs: no override, the game's own loot.
// Dust: the game pays loot Dust as Dust x clamp(1 + MindDustAdditiveMultiplier, 1, 100), the attribute the Treasure Basin
// accessory raises, in four blueprint functions. We override three and pay that amount x Multiplier:
// - BP_NPCLootComp "Loot Items" (enemy deaths), the stock function step by step. Boss variants and tutorial enemies
//   (class names with Boss, Teach or Tutor: the 6 enemies the source's 1.0 kept stock) are paid the stock amount.
// - BP_Rubbish TryToAddDust (loot piles) and BP_Chest "Pickup Items" (chests). The loot rows that quest, dialogue,
//   inscription and item data name (the 110 rows 1.0 kept stock) and the Dust of rows that hold a medicine are paid the
//   stock amount.
// The fourth, the LootItems flow node's PickupItems (quest and story rewards, the blueprint this file belongs to), is not
// touched and pays stock. Nothing changes the attribute, so the save and the Treasure Basin bonus stay as they are.
// Upgrade materials: a loot pile (BP_Rubbish) or chest (BP_Chest) rolls its loot-table row into a name -> amount map
// and then hands the map to the backpack. We override one blueprint function on each, between the roll and the grant:
// - BP_Rubbish "Not Has AnyValidItem": its Pickup calls it once, right after "Collect Items" rebuilt the map. We scale
//   the map, then answer the same four emptiness checks as the stock function.
// - BP_Chest "Pickup Items": the stock function step by step (Collect Items, Binde Delegate, AddPropsByMap, weapons,
//   medicines, accessories, Dust), with the map scaled before AddPropsByMap.
// Only loot-table piles and chests change (RubbishType 1), only the 32 upgrade materials and the 2 fragments, and never
// the kept rows.
// Camp rewards (2.4.0): clearing some groups of enemies pays a reward through MobGroupScript_AddItemAfterCombat "LootItems".
// 10 of the 42 placed Blackstone fragments come this way, every one in some areas, against 6 of 42 Amber (DT_MapItemData
// and the level cells, build 26367565, 2026-11-06), so Blackstone could look untouched while Amber went up.
// That function is not overridden: the game's own reward runs as it is, Dust, items and the camp's completion mark
// included. After its grants it marks the camp in PBZGameSystem.CompleteAddItemMobDomainNames (bytecode @714-804), the set
// the save keeps so a camp pays once. A frame in which that set grows is a camp reward, and the Blackstone and Amber
// fragments the backpack gained in that frame, less those our own pile, chest and enemy grants handed over in it, are
// what it paid; we then add (FragmentMultiplier - 1) x that through the backpack's AddPropsByMap. A camp the save already
// marks never grows the set, so a reload adds nothing. The check runs once a frame and only while FragmentMultiplier is
// above 1, or while CampRewards is On with a Dust or materials multiplier above 1; otherwise it is not running at all.
// Camp Dust and materials (2.5.0, CampRewards, Off by default): every camp reward row is fixed data, and the name the game
// marks a camp with is its own (<domain actor>+<script object>, GetSaveString), so a new name in the set says which camp paid
// and what. 17 camps pay Dust or an upgrade material (PBZ_DM_CAMPS, from a scan of the game's camp
// scripts, build 26367565). With CampRewards On we add (multiplier - 1) x the table amount once per new name, the materials in the
// same AddPropsByMap as the fragment top-up and the Dust with AddDustNum. The game pays camp Dust raw (LootItems @216, no
// Treasure Basin step), so the table amount is what it paid. A name the table lacks pays stock; a marked camp never pays.
(function pbzDropMultiplier() {
    const PBZ_DM_FILE = "phantombladezero_moredustandmaterials.txt"; // 1.0 (port): in this mod's folder, or Mods Menu's
    const PBZ_DM_MIN = 1;
    const PBZ_DM_MAX = 10;
    const PBZ_DM_POLL_MS = 1000;
    const PBZ_DM_FILE_EVERY = 2; // polls, so the file is read every 2 s
    const PBZ_DM_PILE = "/Game/PBZContent/Blueprint/Item/Device/BP_Rubbish.BP_Rubbish_C";
    const PBZ_DM_CHEST = "/Game/PBZContent/Blueprint/Item/Device/BP_Chest.BP_Chest_C";
    const PBZ_DM_ENEMY = "/Game/PBZContent/Blueprint/Component/BP_NPCLootComp.BP_NPCLootComp_C";
    const PBZ_DM_COIN = "/Game/PBZContent/UI/UINew/Upgrade/BP_ChangeCoinObject.BP_ChangeCoinObject_C";
    const PBZ_DM_CAMP_GRACE_MS = 5000; // after a world loads (the save fills the camp set and the backpack), add nothing
    const PBZ_DM_CAMP_MAX = 10; // more of one fragment in one frame is a load or a bulk grant, not a camp reward
    const PBZ_DM_PROBE = false; // the debug build sets this true: one log line per fragment that reaches the backpack
    const PBZ_DM_LOOT_TABLE = 1; // E_RubbishConfig: 0 Legacy (hand-placed Pickups list), 1 NewLootType (loot-table row)
    // enemies whose kill Dust stays stock, by class name: in DT_CombatLootDataTable (build 26266538) exactly the 4 boss
    // variants and 2 tutorial enemies match
    const PBZ_DM_KEEP_ENEMY = /boss|teach|tutor/i;
    // DT_InventoryData: ItemType Item, ItemDetailType Material, MaterialType weapon, Sha-Chi weapon, accessory or medicine
    // upgrade material (build 26266538)
    const PBZ_DM_MATERIALS = new Set(["Ac_Material_1", "Ac_Material_4", "Medi_Material_1", "Medi_Material_2", "Medi_Material_3",
        ...Array.from({ length: 27 }, (_, i) => "Weapon_Material_" + String(i + 1).padStart(2, "0"))]);
    // loot rows named by quest, dialogue, inscription and item data: stock amounts (drop-multiplier/work/keep-check.txt)
    const PBZ_DM_KEEP_ROWS = new Set([
        "DengDingShanDao.AC_BigHit", "DengDingShanDao.AC_MartialWeapon", "DengDingShanDao.Heishi.002",
        "DengDingShanDao.TU_09004", "DengDingShanDao.wmA.009", "DuanHunYa.Dust_G.001", "DuanHunYa.Dust_G.012",
        "DuanHunYa.Return.003", "FuJiZhiLin.004.Dust_Large", "FuJiZhiLin.AC_BreakDrink", "FuJiZhiLin.AC_HeavyAttackShachi",
        "FuJiZhiLin.AC_ResistPoison", "FuJiZhiLin.AC_Shachi", "FuJiZhiLin.AC_Stealth", "FuJiZhiLin.AC_Tang",
        "HouJie.001.A2_05002", "HouJie.001.A3_05001", "HouJie.001.K_03002", "HouJie.004.Dust_G", "HouJie.010.Dust_Small",
        "HuanShuShi.Dust_G.002", "HuanShuShi.Hupo.002", "LongZhu.AC_Counter", "LongZhu.AC_SwitchEndure",
        "LuJiacCun.001.AC_BreakRecover", "LuJiacCun.001.AC_BreakRegen", "LuJiacCun.001.AC_Control",
        "LuJiacCun.001.AC_ResistRanged", "LuJiaCun.001.Item_Piece_002", "LuJiaCun.001.K_05001", "LuJiaCun.002.Dust_Read",
        "LuJiaCun.008.Dust_Large", "LuJiaCun.019.Dust_Read", "LuJiaCun.020.Dust_Read", "MeiGuHu.AC_ShachiCool",
        "MeiGuHu.Investigate1", "MeiGuHu.Investigate2", "MeiGuHu.Investigate3", "MeiGuHu.Medicine_ShachiAttack",
        "MeiGuHu.Medicine_UltimateCharge", "MeiGuHu.R_11001", "MeiGuHu.R_11002", "MeiGuHu.R_11003", "MeiGuHu.R_12007",
        "MeiGuHu.R_12009", "MeiGuHu.R_12010", "MeiGuHu.R_12011", "MeiGuHu.R_12012", "MeiGuHu.R_12013", "MeiGuHu.R_12014",
        "MeiGuHu.R_12015", "MeiGuHu.R_12016", "MeiGuHu.R_12017", "MeiGuHu.R_12019", "MeiGuHu.R_12020", "MeiGuHu.Read01",
        "MeiGuHu.Read02", "MeiGuHu.TU_10001", "MeiGuHu.TU_10002", "MeiGuHu.TU_10003", "MeiGuHu.TU_11003",
        "MeiGuHu.TU_11006", "MeiGuHu.TU_11012", "MeiGuHu.WmA013", "PangZhen.AC_AnimMovement", "PangZhen.AC_Combo",
        "PangZhen.AC_DrinkCost", "PangZhen.AC_DrinkCost_1", "PangZhen.AC_DrinkCost_2", "PangZhen.AC_DrinkCost_3",
        "PangZhen.AC_DrinkCost_4", "PangZhen.AC_ShachiRegen", "PangZhen.AC_ShachiWeapon", "PangZhen.AC_ShachiWeapon_1",
        "PangZhen.AC_ShachiWeapon_2", "PangZhen.AC_UltimateBreak", "PangZhen.Dust_L.002", "Test", "Xigu.001.I_01010",
        "Xigu.004.Item_Piece_001", "Xigu.005.Item_Piece_002", "Xigu.AC_Attack", "Xigu.AC_Deflect", "Xigu.AC_Drink",
        "Xigu.AC_PerfectFrame", "Xigu.AC_ResistNonBreak", "Xigu.Dust.SuperSmall", "Xigu.R_01014",
        "XiMeng.001.AC_Electrified", "XiMeng.001.AC_EvadePhantom", "XiMeng.001.AC_MagicWeapon",
        "XiMeng.001.AC_MagicWeapon_1", "XiMeng.001.AC_MagicWeapon_2", "XiMeng.001.AC_MagicWeapon_3", "XiMeng.001.TU_18001",
        "XiMeng.001.TU_19001", "XiMeng.Dust_G.001", "Zhengdaodaying.AC_HeavyAttackDamage", "Zhengdaodaying.AC_LowShachi",
        "Zhengdaodaying.AC_PowerWeapon", "Zhengdaodaying.AC_PowerWeapon_1", "Zhengdaodaying.AC_PowerWeapon_2",
        "Zhengdaodaying.AC_PowerWeapon_3", "Zhengdaodaying.AC_PowerWeapon_4", "Zhengdaodaying.Dust_L.003",
        "Zhengdaodaying.Dust_R.006", "Zhengdaodaying.Dust_R.007", "Zhengdaodaying.Dust_R.008", "Zhengdaodaying.Dust_R.009",
        "Zhengdaodaying.Dust_R.010"]);
    // loot rows that hold a medicine: their only Dust is what the game pays for a medicine you already have (from the
    // second playthrough on), which 1.0 left stock. No such row has a Dust entry of its own (build 26266538).
    const PBZ_DM_MEDICINE_ROWS = new Set(["ErCijingLin.Medicine_AdditionalRecover", "FuJiZhiLin.001.Medicine03",
        "FuJiZhiLin.001.Medicine04", "HouJie.001.Medicine_Duration", "HouJie.001.Medicine_Recover", "HouJie.001.YouMIngGui",
        "HuanShuShi.Medicine_Ghost", "LuJiacCun.001.GuiShen", "LuJiacCun.001.JinJiHeJi", "MeiGuHu.Medicine_ShachiAttack",
        "MeiGuHu.Medicine_UltimateCharge", "XiMeng.001.Medicine_Element", "Xigu.001.Medicine02", "Xigu.001.Medicine16",
        "Zhengdaodaying.Medicine_Attack", "Zhengdaodaying.Medicine_Interrupt"]);
    // DT_InventoryData: the Blackstone fragment and the Killing Intent Amber fragment (4 make a Blackstone or an Amber,
    // IntegrationItemNum). Their loot rows are pile and chest rows like the materials' (build 26266538)
    const PBZ_DM_FRAGMENTS = new Set(["Item_Piece_001", "Item_Piece_002"]);
    // camp rewards that pay Dust or an upgrade material, by the name the game marks the camp with: build 26367565,
    // a scan of the game's camp scripts (over the 46 MobGroupScript_AddItemAfterCombat scripts in the
    // maps and DT_LevelLootDataTable; every row fixed: MinAmount = MaxAmount, Probability 1). Patch day reruns the scan;
    // a camp a patch adds pays stock until this table has it, never a wrong amount.
    const PBZ_DM_CAMPS = new Map([
        ["BP_MobDomain_C_UAID_74563CC57EE2514C02_1635239279+MobGroupScript_AddItemAfterCombat_C_0", { items: { Weapon_Material_05: 12 } }],
        ["PBZ_MobDomain_C_UAID_BCFCE704F7259AEB02_2027712776+MobGroupScript_AddItemAfterCombat_C_0", { items: { Weapon_Material_05: 12 } }],
        ["BP_MobDomain_C_UAID_BCFCE7058A8BF6AA02_1541108689+MobGroupScript_AddItemAfterCombat_C_0", { items: { Medi_Material_1: 1 } }],
        ["PBZ_MobDomain_C_UAID_60CF848A668963D602_1730791143+MobGroupScript_AddItemAfterCombat_C_0", { dust: 10380 }],
        ["PBZ_MobDomain_C_UAID_BCFCE704F725DEBC02_1748636541+MobGroupScript_AddItemAfterCombat_C_0", { items: { Weapon_Material_13: 6 } }],
        ["BP_MobDomain_C_UAID_60CF84809909C8DE02_1550114216+MobGroupScript_AddItemAfterCombat_C_0", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_E89C25A7512642AF02_1937602491+MobGroupScript_AddItemAfterCombat_C_1", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC028B202_1952326072+MobGroupScript_AddItemAfterCombat_C_0", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC02DB202_1619186979+MobGroupScript_AddItemAfterCombat_C_0", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC067B202_1829005614+MobGroupScript_AddItemAfterCombat_C_0", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC068B202_1282159796+MobGroupScript_AddItemAfterCombat_C_0", { dust: 1600 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC068B202_1506506802+MobGroupScript_AddItemAfterCombat_C_1", { dust: 8155 }],
        ["BP_MobDomain_C_UAID_EC9161CFEDC077B202_1313395519+MobGroupScript_AddItemAfterCombat_C_0", { dust: 4050 }],
        ["BP_MobDomain_C_UAID_BCFCE7058A8B997E02_1355431202+MobGroupScript_AddItemAfterCombat_C_0", { dust: 3201 }],
        ["BP_MobDomain_C_UAID_BCFCE7078B5A72B202_1610422595+MobGroupScript_AddItemAfterCombat_C_0", { dust: 3201 }],
        ["BP_MobDomain_C_UAID_BCFCE7078B5AE7B002_1590065540+MobGroupScript_AddItemAfterCombat_C_0", { dust: 3201 }],
        ["BP_MobDomain_C_UAID_BCFCE7058A8B5BA402_1889289694+MobGroupScript_AddItemAfterCombat_C_0", { dust: 435 }],
    ]);
    const pbzLog = (message) => { }; // the debug build swaps this line for a file logger; message() only runs there
    try {
        const UE = require("ue");
        const puerts = require("puerts");
        const gameInstance = puerts.argv.getByName("GameInstance");
        // one copy only: a second require stops the first (its timer)
        // 1.0 (port): its own name, so the earlier Mods Menu script, if still installed, never shares it
        const shared = globalThis.__moreDustAndMaterials ||= {};
        if (shared.stop)
            shared.stop();
        // settings live in shared, not in this closure: mixed overrides outlive a re-require and must see the new copy's
        // 1.1: STOCK is what stop() leaves, so the overrides (they stay on the classes) pay the game's amounts. DEFAULTS is
        // the setting without a file (the user, 2026-11-13: "start 2x"): materials x2 and Dust with them (Same); fragments
        // stay x1, as the source kept them out unless raised.
        const STOCK = { mult: 1, dust: null, frag: 1, materialsOnly: false, dustOnly: false, campRewards: false }; // dust null: Same as mult
        const DEFAULTS = { ...STOCK, mult: 2 };
        const state = shared.state = { ...DEFAULTS };
        let path, timer, campTimer, polls = 0, errors = 0, campErrors = 0, stopped = false;
        const mixed = shared.mixed ||= new Map(); // class path -> the class we mixed; mixins outlive a re-require
        const mixFailed = shared.mixFailed ||= new Set(); // class paths not mixed (missing or threw): not retried

        // n x m in whole units, rounded up with probability equal to the fraction, so the average is exactly n x m and
        // the result is never below n (m >= 1)
        const scaled = (n, m) => { const x = n * m, lo = Math.floor(x); return lo + (Math.random() < x - lo ? 1 : 0); };
        const keptRow = (row) => PBZ_DM_KEEP_ROWS.has(String(row));
        const stockDust = (row) => keptRow(row) || PBZ_DM_MEDICINE_ROWS.has(String(row)); // a row whose Dust stays stock
        // the multipliers in force: Dust (Materials Only wins, then DustMultiplier, else Multiplier) and materials (Dust Only wins)
        const dustMult = (s) => s.materialsOnly ? 1 : s.dust ?? s.mult;
        const matMult = (s) => s.dustOnly ? 1 : s.mult;
        // the camp check runs for fragments above 1, or for camp Dust and materials when CampRewards is On and either is above 1
        const campNeeded = (s) => s.frag != 1 || (s.campRewards && (dustMult(s) != 1 || matMult(s) != 1));
        if (PBZ_DM_PROBE)
            shared.camps = PBZ_DM_CAMPS; // a debug bench reads the table; nothing else in shared changes
        // a new name -> amount map with the upgrade materials and fragments scaled, or null when nothing changes
        function scaleMap(map, row) {
            const m = matMult(shared.state), f = shared.state.frag;
            if ((m == 1 && f == 1) || !map || keptRow(row))
                return null;
            const out = UE.NewMap(UE.BuiltinName, UE.BuiltinInt);
            let changed = false;
            for (let i = 0; i < map.GetMaxIndex(); i++) {
                if (!map.IsValidIndex(i))
                    continue;
                const id = map.GetKey(i), n = map.Get(id);
                const by = PBZ_DM_MATERIALS.has(String(id)) ? m : PBZ_DM_FRAGMENTS.has(String(id)) ? f : 1;
                const v = by != 1 && n > 0 ? scaled(n, by) : n;
                changed = changed || v != n;
                out.Add(id, v);
            }
            return changed ? out : null;
        }
        const pairs = (map) => { const s = []; for (let i = 0; map && i < map.GetMaxIndex(); i++) if (map.IsValidIndex(i)) s.push(map.GetKey(i) + " " + map.Get(map.GetKey(i))); return s.join(", "); };
        // the fragments a pile, chest or enemy grant of ours hands the backpack (stock amount plus our extra), per item, until
        // the camp check's next sample takes them off that frame's gain; in shared, as mixed overrides outlive a re-require
        function noteGrant(map) {
            try {
                const l = shared.ledger ||= {};
                for (let i = 0; i < map.GetMaxIndex(); i++)
                    if (map.IsValidIndex(i) && PBZ_DM_FRAGMENTS.has(String(map.GetKey(i))))
                        l[String(map.GetKey(i))] = (l[String(map.GetKey(i))] || 0) + map.Get(map.GetKey(i));
            }
            catch (e) {
                pbzLog(() => "grant note threw: " + e);
            }
        }
        // scales the map in the named property of a pile or chest when it holds a loot-table roll; never throws
        function scaleLoot(owner, prop, who) {
            try {
                if (owner.RubbishType != PBZ_DM_LOOT_TABLE)
                    return;
                const row = String(owner["Loot Item ID"]);
                const before = owner[prop];
                const out = scaleMap(before, row);
                pbzLog(() => who + " " + row + " x" + matMult(shared.state) + " fragments x" + shared.state.frag + ": " + pairs(before) + (out ? " -> " + pairs(out) : " (no change)"));
                if (PBZ_DM_PROBE)
                    shared.lastLoot = who + " " + row + ": " + pairs(before) + (out ? " -> " + pairs(out) : "");
                if (out)
                    owner[prop] = out; // assign a new map: right whether Puerts handed back a copy or a reference
                // shortcut: the pile's grant is stock code after this call, so its success cannot be seen here; if that stock grant
                // ever fails in the frame a camp is marked, the camp gives its stock reward without our top-up (nothing is lost)
                if (who == "pile")
                    noteGrant(out || before); // stock grants it in the same call (BP_Rubbish ubergraph @2926 -> @3241); the chest notes after its own grant
            }
            catch (e) {
                pbzLog(() => who + " scale threw: " + e);
            }
        }
        // the game's Dust pay for a rolled amount, as the blueprints compute it: Dust x clamp(1 + MindDustAdditiveMultiplier,
        // 1, 100), truncated. Times the Dust multiplier unless this loot stays stock.
        function dustPay(context, dust, keep) {
            const player = UE.GameplayStatics.GetPlayerCharacter(context, 0);
            const bonus = UE.PBZBlueprintFunctionLibrary.GetAttributeFromCharacter(player,
                UE.PBZBlueprintFunctionLibrary.MakeAttribute("MindDustAdditiveMultiplier", UE.BasicAttributeSet.StaticClass()));
            return Math.trunc(Math.min(100, Math.max(1, bonus + 1)) * dust * (keep ? 1 : dustMult(shared.state)));
        }
        const backpack = (context) => UE.SubsystemBlueprintLibrary.GetWorldSubsystem(context, UE.PBZBackPackSubsystem.StaticClass());
        // a name -> bool weapon map, granted as the stock blueprints do
        function grantWeapons(bp, weapons) {
            for (let i = 0; i < weapons.GetMaxIndex(); i++)
                if (weapons.IsValidIndex(i))
                    bp.AddWeaponItem(weapons.GetKey(i), weapons.Get(weapons.GetKey(i)), true, false, false);
        }
        class PileMixin {
            // stock (BP_Rubbish bytecode): Map_IsEmpty(PickupMap) and Map_IsEmpty(ReallyGetWeapons) and
            // Set_IsEmpty(ReallyMedicines) and Set_IsEmpty(ReallyAccessories)
            ["Not Has AnyValidItem"]() {
                scaleLoot(this, "PickupMap", "pile");
                return this.PickupMap.Num() == 0 && this.ReallyGetWeapons.Num() == 0 && this.ReallyMedicines.Num() == 0
                    && this.ReallyAccessories.Num() == 0;
            }
            // stock BP_Rubbish TryToAddDust (bytecode @0-581): the pile's row rolled again, its Dust paid
            TryToAddDust() {
                const row = this["Loot Item ID"];
                const out = puerts.$ref(new UE.LootTotalData());
                const KSL = UE.KismetSystemLibrary;
                if (!UE.PBZCharacter_NPC.GetCombatLootData(this.LootLevel, KSL.Conv_SoftClassPathToSoftClassRef(KSL.MakeSoftClassPath("")), row, out, false, this))
                    return;
                const dust = puerts.$unref(out).LootDust, n = dustPay(this, dust, stockDust(row));
                const bp = backpack(this);
                if (bp)
                    bp.AddDustNum(n);
                pbzLog(() => "pile Dust " + row + ": rolled " + dust + ", paid " + n);
            }
        }
        class ChestMixin {
            // stock BP_Chest "Pickup Items" (bytecode @0-1841), in the same order, with the map scaled before the grant
            ["Pickup Items"]() {
                this["Collect Items"]();
                this["Binde Delegate"]();
                const bp = backpack(this);
                if (!bp)
                    return; // stock calls every grant below on the backpack, so without one none of them happen
                scaleLoot(this, "PickupMaps", "chest");
                bp.AddPropsByMap(this.PickupMaps, true);
                noteGrant(this.PickupMaps); // only once the grant went through: a failed grant must not cost a camp its top-up
                grantWeapons(bp, this.ReallyGetWeapons);
                const medicines = this.ReallyMedicines;
                for (let i = 0; i < medicines.GetMaxIndex(); i++)
                    if (medicines.IsValidIndex(i))
                        bp.PushMedicineToInventory(medicines.Get(i), false, true);
                const accessories = this.ReallyAccessories;
                for (let i = 0; i < accessories.GetMaxIndex(); i++)
                    if (accessories.IsValidIndex(i))
                        bp.PushAccessoryToInventory(accessories.Get(i), false);
                const row = this["Loot Item ID"], dust = this["Get Dust"], n = dustPay(this, dust, stockDust(row));
                bp.AddDustNum(n);
                pbzLog(() => "chest Dust " + row + ": rolled " + dust + ", paid " + n);
            }
        }
        class EnemyMixin {
            // stock BP_NPCLootComp "Loot Items" (bytecode @0-2877) step by step: the enemy's loot roll, then Dust (a coin
            // object sent to the player as GameplayEvent.ChangeCoinNum), items, weapons, medicines, accessories
            ["Loot Items"](a, b) {
                // (ActorClass, NPCLevel) in the blueprint export; the types tell the two apart in either order
                const [actorClass, level] = typeof a == "number" ? [b, a] : [a, b];
                const out = puerts.$ref(new UE.LootTotalData());
                if (!UE.PBZCharacter_NPC.GetCombatLootDataForOwner(this.GetOwner(), Math.trunc(level),
                    UE.KismetSystemLibrary.Conv_ClassToSoftClassReference(actorClass), out))
                    return;
                const loot = puerts.$unref(out);
                try { // a Dust failure must not cost the item grants below
                    const player = UE.GameplayStatics.GetPlayerCharacter(this, 0);
                    if (loot.LootDust > 0 && UE.KismetSystemLibrary.IsValid(player)) {
                        const who = UE.KismetSystemLibrary.GetObjectName(actorClass);
                        // what the stock function and the game's own TsHelper.changeCoin build
                        const coin = UE.NewObject(UE.Class.Load(PBZ_DM_COIN), player);
                        coin.ChangeDustNum = dustPay(this, loot.LootDust, PBZ_DM_KEEP_ENEMY.test(who));
                        const event = new UE.GameplayEventData();
                        event.OptionalObject = coin;
                        const tag = new UE.GameplayTag();
                        tag.TagName = "GameplayEvent.ChangeCoinNum";
                        UE.AbilitySystemBlueprintLibrary.SendGameplayEventToActor(player, tag, event);
                        pbzLog(() => "enemy Dust " + who + " L" + Math.trunc(level) + ": rolled " + loot.LootDust + ", paid " + coin.ChangeDustNum);
                    }
                }
                catch (e) {
                    pbzLog(() => "enemy Dust threw: " + e);
                }
                const bp = backpack(this);
                if (!bp)
                    return; // stock calls every grant below on the backpack
                if (loot.LootItems.Num() > 0) {
                    bp.AddPropsByMap(loot.LootItems, true);
                    noteGrant(loot.LootItems); // after the grant: the last kill of a group lands in the frame its camp is marked
                }
                grantWeapons(bp, loot.LootWeapons);
                for (let i = 0; i < loot.Medicines.Num(); i++)
                    bp.PushMedicineToInventory(loot.Medicines.Get(i), false, true);
                for (let i = 0; i < loot.Accessories.Num(); i++)
                    bp.PushAccessoryToInventory(loot.Accessories.Get(i), false);
            }
        }
        // camp rewards: the owned and the ever-obtained count of each fragment (GetItemNumInfo; obtained never goes down,
        // owned drops when four combine into a Blackstone or an Amber)
        function fragmentCounts(bp) {
            const out = {};
            for (const id of PBZ_DM_FRAGMENTS) {
                const owned = puerts.$ref(0), got = puerts.$ref(0);
                bp.GetItemNumInfo(id, owned, got);
                out[id] = [puerts.$unref(owned), puerts.$unref(got)];
            }
            return out;
        }
        const newestName = (set) => { for (let i = set.GetMaxIndex() - 1; i >= 0; i--) if (set.IsValidIndex(i)) return String(set.Get(i)); return "?"; };
        // every name in the game's camp set; a TSet reuses freed slots, so new names are found by name, never by index
        const setNames = (set) => { const out = []; for (let i = 0; i < set.GetMaxIndex(); i++) if (set.IsValidIndex(i)) out.push(String(set.Get(i))); return out; };
        // debug build only: the Dust counter, for the debug line that shows what the game paid at a camp
        const dustNow = () => { try { return UE.PBZBlueprintFunctionLibrary.GetCurrentDust(gameInstance); } catch (e) { return "?"; } };
        // once a frame while campNeeded. Reads only; its writes are the top-up grants, so a failure here never reaches the
        // game's own reward or its mark (those already ran, in the game's LootItems).
        function campWatch() {
            try {
                if (!campNeeded(shared.state))
                    return stopCampWatch(); // nothing to top up: no camp code runs at all
                const player = UE.GameplayStatics.GetPlayerCharacter(gameInstance, 0);
                if (!player)
                    return;
                const gs = UE.SubsystemBlueprintLibrary.GetWorldSubsystem(player, UE.PBZGameSystem.StaticClass());
                const c = shared.camp;
                if (!c || c.gs !== gs || c.stale) { // a new world, or the check started again: take its counts and names, add nothing yet
                    const bp = backpack(player);
                    // the load grace starts with a new world only, not on a setting change in the same one
                    // every name this world's set has held while we watched: kept across a restart of the check, a failure and a
                    // shrink of the set, so a name that leaves and comes back in the same world is never paid again
                    if (gs && (!shared.campSeen || shared.campSeen.gs !== gs))
                        shared.campSeen = { gs, names: new Set() };
                    const names = gs ? shared.campSeen.names : undefined;
                    if (gs)
                        for (const n of setNames(gs.CompleteAddItemMobDomainNames))
                            names.add(n);
                    shared.camp = gs && bp ? { gs, bp, num: gs.CompleteAddItemMobDomainNames.Num(), names,
                        counts: fragmentCounts(bp), since: c && c.gs === gs ? c.since : Date.now(), dust: PBZ_DM_PROBE ? dustNow() : 0 } : undefined;
                    shared.ledger = {};
                    const w = shared.camp;
                    if (w)
                        pbzLog(() => "camp watch: world ready, " + w.num + " camps marked, fragments " + w.counts.Item_Piece_001[0] + "/" + w.counts.Item_Piece_002[0] + ", Dust " + w.dust);
                    return;
                }
                const set = gs.CompleteAddItemMobDomainNames, num = set.Num(), before = c.counts, counts = fragmentCounts(c.bp);
                const ours = shared.ledger || {}; // our own pile, chest and enemy grants since the last sample
                shared.ledger = {};
                const changed = num != c.num, grew = num > c.num, dust0 = c.dust;
                c.num = num;
                c.counts = counts;
                if (PBZ_DM_PROBE)
                    c.dust = dustNow();
                campErrors = 0;
                const grace = Date.now() - c.since < PBZ_DM_CAMP_GRACE_MS;
                // inside the load grace the names are read every frame, so one that replaces another at an unchanged count is
                // still seen there and never paid; after it, a count change is the signal (a name that replaced another in the
                // same frame is a real new mark, paid at the next change)
                if (!changed && !grace)
                    return;
                const fresh = setNames(set).filter((n) => !c.names.has(n));
                for (const n of fresh)
                    c.names.add(n); // seen once: inside the grace, at a shrink or paid, a name never pays later
                if (!grew || grace) // the set shrank (a new cycle) or the world is still loading: nothing is paid
                    return;
                const s = shared.state, map = UE.NewMap(UE.BuiltinName, UE.BuiltinInt), added = [];
                let dustExtra = 0;
                if (s.frag != 1) {
                    // what the game's reward paid this frame: owned up, or obtained up when the new fragments combined at once,
                    // less what our own pile, chest and enemy grants handed over in it.
                    // shortcut: a fragment from a source we do not grant (a quest reward) landing in the very frame a camp is
                    // marked counts as that camp's reward too, up to PBZ_DM_CAMP_MAX; tag that source if a bench or report shows it
                    const paid = [...PBZ_DM_FRAGMENTS].map((id) => [id, Math.max(counts[id][0] - before[id][0], counts[id][1] - before[id][1]) - (ours[id] || 0)]).filter(([, n]) => n > 0);
                    if (!paid.length)
                        pbzLog(() => "camp reward " + newestName(set) + ": no fragment this frame");
                    else if (paid.some(([, n]) => n > PBZ_DM_CAMP_MAX))
                        pbzLog(() => "camp reward " + newestName(set) + ": " + paid.join(" ") + ", too many for one camp, nothing added");
                    else {
                        const fragAdded = [];
                        for (const [id, n] of paid) {
                            const extra = scaled(n, s.frag) - n;
                            if (extra > 0) {
                                map.Add(id, extra);
                                fragAdded.push(id + " +" + extra);
                            }
                        }
                        pbzLog(() => "camp reward " + newestName(set) + ": " + paid.map(([id, n]) => id + " " + n).join(", ") + " from the game, x" + s.frag + (fragAdded.length ? ", adding " + fragAdded.join(", ") : ", nothing to add"));
                        added.push(...fragAdded);
                    }
                }
                // the table part: the Dust and materials of the camps the new names identify
                for (const name of fresh) {
                    const t = PBZ_DM_CAMPS.get(name);
                    if (!t) {
                        pbzLog(() => "camp table " + name + ": not a Dust or material camp");
                        continue;
                    }
                    if (!s.campRewards) {
                        pbzLog(() => "camp table " + name + ": Camp Rewards Off, nothing added");
                        continue;
                    }
                    if (t.dust) {
                        const m = dustMult(s), extra = scaled(t.dust, m) - t.dust;
                        pbzLog(() => "camp table " + name + ": Dust " + t.dust + " x" + m + " +" + extra);
                        dustExtra += extra;
                    }
                    for (const id of Object.keys(t.items || {})) {
                        const n = t.items[id], m = matMult(s), extra = scaled(n, m) - n;
                        pbzLog(() => "camp table " + name + ": " + id + " " + n + " x" + m + " +" + extra);
                        if (extra > 0) {
                            map.Add(id, (map.Get(id) || 0) + extra);
                            added.push(id + " +" + extra);
                        }
                    }
                }
                if (added.length) {
                    if (PBZ_DM_PROBE)
                        shared.lastLoot = "camp top-up " + added.join(", ");
                    c.bp.AddPropsByMap(map, true);
                    c.counts = fragmentCounts(c.bp); // our own grant is not the next frame's camp reward
                }
                if (dustExtra > 0)
                    c.bp.AddDustNum(dustExtra); // after the item grant: a failed Dust grant keeps the fragments paid
                if (PBZ_DM_PROBE) {
                    const at = c.dust;
                    c.dust = dustNow();
                    pbzLog(() => "camp Dust " + dust0 + " -> " + at + " -> " + c.dust);
                }
            }
            catch (e) {
                pbzLog(() => "camp watch threw: " + e);
                shared.camp = undefined; // start over from fresh counts and names; a failed top-up is not tried again
                if (++campErrors >= 20) {
                    shared.campFailed = true; // for the session: piles and chests still work
                    stopCampWatch();
                }
            }
        }
        function stopCampWatch() {
            if (campTimer !== undefined)
                clearInterval(campTimer);
            campTimer = undefined;
            if (shared.camp)
                shared.camp.stale = true; // counts are taken again on the next start; the world and its load grace are kept
        }
        // debug build only (PBZ_DM_PROBE): one line for every fragment added to the backpack, whatever gave it (pile,
        // chest, camp, quest or story reward), with the count after it and the last loot our overrides handed over.
        // Never lets the tick fail; a probe that throws once is not tried again.
        function probe() {
            try {
                const bp = backpack(gameInstance);
                if (!bp || shared.probed === bp || shared.probeFailed)
                    return;
                shared.onProps ||= (id, added, num) => {
                    try {
                        const s = String(id);
                        if (!added || !PBZ_DM_FRAGMENTS.has(s))
                            return;
                        const owned = puerts.$ref(0), got = puerts.$ref(0);
                        shared.probed.GetItemNumInfo(s, owned, got);
                        pbzLog(() => "fragment grant " + s + " +" + num + ", owned " + (puerts.$unref(owned) - num) + " -> " + puerts.$unref(owned)
                            + "; last loot of ours: " + (shared.lastLoot || "none"));
                        shared.lastLoot = undefined;
                    }
                    catch (e) {
                        pbzLog(() => "fragment line threw: " + e);
                    }
                };
                bp.UpdateProps.Remove(shared.onProps);
                bp.UpdateProps.Add(shared.onProps);
                shared.probed = bp;
                pbzLog(() => "fragment probe bound");
            }
            catch (e) {
                shared.probeFailed = true;
                pbzLog(() => "fragment probe threw: " + e);
            }
        }
        // mixes each class once; again only if a class was unloaded and loaded fresh. A class that is missing or whose
        // mixin threw is left stock for the session (its loot stays stock; the other classes still work).
        // shortcut: Class.Load loads a class the world does not hold yet (a one-off hitch); only reached at a multiplier
        // above 1, and piles, chests and enemies are in every open map. Switch to a find-only lookup if a hitch shows up.
        function mixAll() {
            for (const [path, methods] of [[PBZ_DM_PILE, PileMixin], [PBZ_DM_CHEST, ChestMixin], [PBZ_DM_ENEMY, EnemyMixin]]) {
                const old = mixed.get(path);
                if ((old && UE.KismetSystemLibrary.IsValid(old)) || mixFailed.has(path))
                    continue;
                try {
                    const cls = UE.Class.Load(path);
                    if (!cls)
                        throw new Error("class missing");
                    puerts.blueprint.mixin(puerts.blueprint.tojs(cls), methods, { objectTakeByNative: true, inherit: false, noMixinedWarning: true });
                    mixed.set(path, cls); // only after the mixin went on
                    pbzLog(() => "mixed " + path);
                }
                catch (e) {
                    mixFailed.add(path);
                    pbzLog(() => "not mixed, stays stock: " + path + ": " + e);
                }
            }
        }
        function load() {
            if (!UE.BlueprintPathsLibrary.FileExists(path)) // check first: EasyCsv logs an error for a missing file
                return undefined;
            const out = puerts.$ref("");
            return UE.EasyCsv.LoadStringFromLocalFile(path, out) ? puerts.$unref(out) : null;
        }
        // "Multiplier=2" (also "x2", "2,5"), clamped to 1..10, the same for DustMultiplier and FragmentMultiplier;
        // "DustMultiplier=Same"; "MaterialsOnly=On", "DustOnly=On". Unreadable values keep the last good one. No
        // DustMultiplier line (a 2.1 file) or an empty one is Same. "CampRewards=On"; no line (a file before 2.5.0) is Off.
        function parse(text) {
            const line = (key) => (new RegExp("^[ \\t]*" + key + "[ \\t]*=[ \\t]*([^\\r\\n;#]*)", "im").exec(text) || [])[1];
            const num = (key, last) => { const v = parseFloat(String(line(key) ?? "").replace(",", ".").replace(/^\s*x/i, "")); return Number.isFinite(v) ? Math.min(PBZ_DM_MAX, Math.max(PBZ_DM_MIN, v)) : last; };
            const flag = (key, last) => { const v = String(line(key) ?? "").trim(); return /^(on|true|1|yes)$/i.test(v) ? true : /^(off|false|0|no)$/i.test(v) ? false : last; };
            return {
                mult: num("Multiplier", state.mult),
                dust: /^\s*(same)?\s*$/i.test(line("DustMultiplier") ?? "") ? null : num("DustMultiplier", state.dust),
                frag: line("FragmentMultiplier") === undefined ? 1 : num("FragmentMultiplier", state.frag), // no line (a 2.1 file): 1
                materialsOnly: flag("MaterialsOnly", state.materialsOnly),
                dustOnly: flag("DustOnly", state.dustOnly),
                campRewards: line("CampRewards") === undefined ? false : flag("CampRewards", state.campRewards), // no line: Off
            };
        }
        function readSettings() {
            if (path === undefined)
                path = pbzMoreDustPath(PBZ_DM_FILE); // 1.0 (port)
            const text = load();
            if (text === null)
                return; // locked mid-save: next read
            const s = text === undefined ? DEFAULTS : parse(text);
            if (Object.keys(DEFAULTS).some((k) => s[k] !== state[k]))
                pbzLog(() => "settings: x" + s.mult + ", Dust " + (s.dust ?? "Same") + ", fragments x" + s.frag + ", camp rewards " + (s.campRewards ? "On" : "Off") + (s.materialsOnly ? ", materials only" : "")
                    + (s.dustOnly ? ", Dust only" : "") + " (in force: Dust x" + dustMult(s) + ", materials x" + matMult(s) + ")");
            Object.assign(state, s);
        }
        function tick() {
            try {
                if (!gameInstance || !UE.KismetSystemLibrary.IsValid(gameInstance))
                    return;
                if (polls++ % PBZ_DM_FILE_EVERY == 0)
                    readSettings();
                // in a world only, not at the title; once mixed the overrides stay, and at 1 they pay the stock amounts
                if ((dustMult(state) != 1 || matMult(state) != 1 || state.frag != 1) && UE.GameplayStatics.GetPlayerCharacter(gameInstance, 0))
                    mixAll();
                if (campNeeded(state) && campTimer === undefined && !shared.campFailed)
                    campTimer = setInterval(campWatch, 0); // once a frame: a camp's grants and its mark land in one frame
                if (PBZ_DM_PROBE)
                    probe();
                errors = 0;
            }
            catch (e) {
                pbzLog(() => "tick threw: " + e);
                if (++errors >= 20)
                    shared.stop();
            }
        }
        shared.stop = () => {
            clearInterval(timer);
            stopCampWatch();
            stopped = true;
            shared.stop = undefined;
            Object.assign(state, STOCK); // 1.1: STOCK, not the x2 DEFAULTS: mixed overrides now pay the stock amounts
            pbzLog(() => "stopped");
        };
        if (pbzMoreDustMenuWanted()) pbzMoreDustPush({ // 1.0 (port): only while Mods Menu runs
            id: PBZ_DM_ID, version: PBZ_DM_VERSION, file: PBZ_DM_FILE, store: "saved",
            title: { en: "More Dust and Materials", "zh-Hans": "掉落倍率", "zh-Hant": "掉落倍率" },
            description: { en: "More Dust from enemies, loot piles and chests, and more upgrade materials from loot piles and chests, each with its own multiplier. Fragments only if you raise Fragment Multiplier. Quest and story rewards, boss and tutorial enemies, keys and notes stay as they are.",
                "zh-Hans": "增加敌人、战利品堆和宝箱掉落的意识尘埃，以及战利品堆和宝箱中的升级材料，两者倍率可分别设置。碎片仅在调高碎片倍率后增加。任务和剧情奖励、首领和教学敌人、钥匙和字条保持原样。",
                "zh-Hant": "增加敵人、戰利品堆和寶箱掉落的意識塵埃，以及戰利品堆和寶箱中的升級材料，兩者倍率可分別設定。碎片僅在調高碎片倍率後增加。任務和劇情獎勵、首領和教學敵人、鑰匙和字條保持原樣。" },
            settings: [
                { key: "Multiplier", type: "number", min: PBZ_DM_MIN, max: PBZ_DM_MAX, step: 0.1, default: 2, // 1.1
                    label: { en: "Materials Multiplier", "zh-Hans": "升级材料倍率", "zh-Hant": "升級材料倍率" },
                    help: { en: "Upgrade materials from loot piles and chests. 1 is the game's own amount, 2 doubles it. Dust follows this too while Dust Multiplier is Same. Single items round up or down at random, so they average out.",
                        "zh-Hans": "战利品堆和宝箱中的升级材料。1 为原版数量，2 为双倍。意识尘埃倍率设为同上时，意识尘埃也按此倍率。单个物品随机向上或向下取整，平均下来与倍率一致。",
                        "zh-Hant": "戰利品堆和寶箱中的升級材料。1 為原版數量，2 為雙倍。意識塵埃倍率設為同上時，意識塵埃也按此倍率。單個物品隨機向上或向下取整，平均下來與倍率一致。" } },
                { key: "DustMultiplier", type: "choice", slider: true, default: "Same",
                    options: [{ value: "Same", label: { en: "Same", "zh-Hans": "同上", "zh-Hant": "同上" } },
                        ...Array.from({ length: 19 }, (_, i) => String(1 + i / 2))],
                    label: { en: "Dust Multiplier", "zh-Hans": "意识尘埃倍率", "zh-Hant": "意識塵埃倍率" },
                    help: { en: "Dust from enemies, loot piles and chests. Same: the Materials Multiplier above. 1 is the game's own Dust, 2 doubles it.",
                        "zh-Hans": "敌人、战利品堆和宝箱掉落的意识尘埃。同上：使用上方的升级材料倍率。1 为原版数量，2 为双倍。",
                        "zh-Hant": "敵人、戰利品堆和寶箱掉落的意識塵埃。同上：使用上方的升級材料倍率。1 為原版數量，2 為雙倍。" } },
                { key: "FragmentMultiplier", type: "number", min: PBZ_DM_MIN, max: PBZ_DM_MAX, step: 0.5, default: 1,
                    label: { en: "Fragment Multiplier", "zh-Hans": "碎片倍率", "zh-Hant": "碎片倍率" },
                    help: { en: "Blackstone and Amber fragments from loot piles, chests and the rewards for clearing a group of enemies. 1 keeps them as they are. Four make a Blackstone or an Amber, which raise your stats for good, so above 1 you get stronger sooner, and that stays in your save.",
                        "zh-Hans": "战利品堆、宝箱和清除一群敌人后的奖励中的黑石碎片和杀气琥珀碎片。1 为原版数量。四个碎片合成一个黑石或杀气琥珀，永久提升属性，所以倍率高于 1 时角色变强更快，且会保留在存档中。",
                        "zh-Hant": "戰利品堆、寶箱和清除一群敵人後的獎勵中的黑石碎片和殺氣琥珀碎片。1 為原版數量。四個碎片合成一個黑石或殺氣琥珀，永久提升屬性，所以倍率高於 1 時角色變強更快，且會保留在存檔中。" } },
                { key: "CampRewards", type: "toggle", default: false,
                    label: { en: "Camp Reward Materials and Dust", "zh-Hans": "清敌奖励的材料和尘埃", "zh-Hant": "清敵獎勵的材料和塵埃" },
                    help: { en: "On: the upgrade materials and Dust you get for clearing a group of enemies follow Materials Multiplier and Dust Multiplier. Off: they stay as they are. Fragments from these rewards follow Fragment Multiplier either way.",
                        "zh-Hans": "开启：清除一群敌人后的奖励中的升级材料和意识尘埃，也按升级材料倍率和意识尘埃倍率增加。关闭：保持原样。这些奖励中的碎片始终按碎片倍率计算。",
                        "zh-Hant": "開啟：清除一群敵人後的獎勵中的升級材料和意識塵埃，也按升級材料倍率和意識塵埃倍率增加。關閉：保持原樣。這些獎勵中的碎片始終按碎片倍率計算。" } },
                { key: "MaterialsOnly", type: "toggle", default: false,
                    label: { en: "Materials Only", "zh-Hans": "仅升级材料", "zh-Hant": "僅升級材料" },
                    help: { en: "On: Dust stays as it is, whatever Dust Multiplier says. The same as Dust Multiplier 1, kept for older settings files.",
                        "zh-Hans": "开启：无论意识尘埃倍率如何设置，意识尘埃都保持原样。与意识尘埃倍率设为 1 相同，为兼容旧设置文件而保留。",
                        "zh-Hant": "開啟：無論意識塵埃倍率如何設定，意識塵埃都保持原樣。與意識塵埃倍率設為 1 相同，為相容舊設定檔而保留。" } },
                { key: "DustOnly", type: "toggle", default: false,
                    label: { en: "Dust Only", "zh-Hans": "仅意识尘埃", "zh-Hant": "僅意識塵埃" },
                    help: { en: "On: upgrade materials stay as they are; Dust and fragments still follow their own multipliers. Kept for older settings files. With Materials Only also On, only fragments can change.",
                        "zh-Hans": "开启：升级材料保持原样，意识尘埃和碎片仍按各自倍率增加。为兼容旧设置文件而保留。若同时开启仅升级材料，则只有碎片可能增加。",
                        "zh-Hant": "開啟：升級材料保持原樣，意識塵埃和碎片仍按各自倍率增加。為相容舊設定檔而保留。若同時開啟僅升級材料，則只有碎片可能增加。" } },
            ],
            // rows a switch overrides: shown as the game's warning line under the row's help
            check: (v) => Object.assign({},
                v.MaterialsOnly && Number(String(v.DustMultiplier) == "Same" ? v.Multiplier : v.DustMultiplier) > 1 ? { DustMultiplier: { en: "Materials Only is On, so Dust stays as it is.",
                    "zh-Hans": "仅升级材料已开启，意识尘埃保持原样。", "zh-Hant": "僅升級材料已開啟，意識塵埃保持原樣。" } } : {},
                v.DustOnly ? { Multiplier: { en: "Dust Only is On, so upgrade materials stay as they are.",
                    "zh-Hans": "仅意识尘埃已开启，升级材料保持原样。", "zh-Hant": "僅意識塵埃已開啟，升級材料保持原樣。" } } : {},
                // the multipliers in force, as dustMult and matMult work them out from the row values
                v.CampRewards && Number(v.MaterialsOnly ? 1 : String(v.DustMultiplier) == "Same" ? v.Multiplier : v.DustMultiplier) <= 1
                    && Number(v.DustOnly ? 1 : v.Multiplier) <= 1 ? { CampRewards: { en: "Materials Multiplier and Dust Multiplier are both 1, so this changes nothing.",
                    "zh-Hans": "升级材料倍率和意识尘埃倍率均为 1，因此此项不会改变任何内容。", "zh-Hant": "升級材料倍率和意識塵埃倍率均為 1，因此此項不會改變任何內容。" } } : {}),
            onChange: () => { try { if (!stopped) readSettings(); } catch (e) { } },
        });
        timer = setInterval(tick, PBZ_DM_POLL_MS);
        pbzLog(() => "started");
        console.log(`[PBZMOD] [More Dust and Materials] ${PBZ_DM_VERSION} started; settings: ${pbzMoreDustPath(PBZ_DM_FILE)}`
            + (pbzMoreDustMenu.on ? " (Mods Menu's page)" : "")); // 1.0 (port)
        __pbzStandaloneReady = true;
    }
    catch (e) {
        pbzLog(() => "failed to start: " + e);
        console.warn(`[More Dust and Materials] not started: ${e}`);
        throw e;
    }
})();
// More Dust and Materials: end

if (!__pbzStandaloneReady) throw new Error("More Dust and Materials: not started (no GameInstance)");
// 1.0 (port): PBZModLoader awaits this before a reload (Alt+F5): the source's own stop (timers end, settings to stock,
// 1.1: x1, so the overrides pay the game's amounts).
exports.stop = function () {
    const shared = globalThis.__moreDustAndMaterials;
    if (shared && shared.stop)
        shared.stop();
    console.log("[PBZMOD] [More Dust and Materials] stopped");
};
