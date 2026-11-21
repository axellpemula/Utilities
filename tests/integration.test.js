/**
 * Integration tests: the real pack modules, loaded against the mock
 * `@minecraft/server` (see tests/support/loader.mjs).
 *
 * These catch the class of bug the unit tests cannot: broken wiring between
 * modules, regressions in loop control flow and event handling.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { system, world, Player } from "./support/mock-server.mjs";
import { forms, formResponses, resetForms } from "./support/mock-server-ui.mjs";
import { createBlock, createDimension, createItemStack, createPickaxe, createPlayer, flushPromises } from "./support/testbed.mjs";
import { PANEL_TAG, ROW_ON, flatten } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/panel.js";
import { DEFAULT_CONFIG } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/options.js";

const SCRIPT_ROOT = new URL("../Utils Vein Miner BP/scripts/utilities_vein_miner/", import.meta.url);
const load = specifier => import(new URL(specifier, SCRIPT_ROOT).href);

// Dimensions the entry point sweeps for stale markers on load.
const overworld = createDimension("overworld");
createDimension("nether");
createDimension("the_end");

const intervalHandle = ticks => system.intervals.find(handle => handle.ticks === ticks);

test("the entry point loads and subscribes to every event it needs", async () => {
    await load("main.js");

    assert.equal(system.beforeEvents.startup.handlers.length, 1, "/uvm:veinminer registration");
    assert.ok(world.beforeEvents.playerBreakBlock.handlers.length >= 1);
    assert.ok(world.beforeEvents.playerLeave.handlers.length >= 1);
    for (const name of ["playerSpawn", "itemUse", "entityHitBlock"])
        assert.ok(world.afterEvents[name].handlers.length >= 1, `${name} must be handled`);
    assert.ok(system.intervals.some(handle => handle.ticks === 5), "preview interval");
    assert.ok(system.intervals.some(handle => handle.ticks === 200), "inactivity interval");
});

test("settings are per player and mutating a default never leaks", async () => {
    const { apiConfig } = await load("lib/player/config.js");
    const configKey = "utilities_vein_miner:config_info";

    const playerA = createPlayer({ id: "config-a", dimension: overworld });
    const playerB = createPlayer({ id: "config-b", dimension: overworld });

    const config = apiConfig.get(playerA);
    config.functionType = "off";
    apiConfig.set(playerA, config);

    assert.equal(apiConfig.get(playerA).functionType, "off");
    assert.equal(apiConfig.get(playerB).functionType, "all", "player B must keep the default");

    const playerC = createPlayer({ id: "config-c", dimension: overworld });
    assert.equal(apiConfig.get(playerC).functionType, "all");

    // Corrupt / hand edited dynamic properties fall back to defaults.
    playerC.setDynamicProperty(configKey, "{not json");
    apiConfig.clear("config-c");
    assert.equal(apiConfig.get(playerC).maxSize, 64);

    // Out of range values are clamped to what the UI can represent.
    playerC.setDynamicProperty(configKey, JSON.stringify({ maxSize: 99999, edgeSize: 42, functionType: "nonsense" }));
    apiConfig.clear("config-c");
    const sanitized = apiConfig.get(playerC);
    assert.equal(sanitized.maxSize, 1024);
    assert.equal(sanitized.edgeSize, 5);
    assert.equal(sanitized.functionType, "all");
});

test("a vein break clears the blocks, drops the loot once and awards experience", async () => {
    const { breakFunctions } = await load("functions/break.js");
    const dimension = createDimension("break-dim");
    const player = createPlayer({ id: "breaker", dimension });
    const blocks = [0, 1, 2].map(index => createBlock(dimension, {
        x: index,
        y: 70,
        z: 0,
        typeId: "minecraft:diamond_ore",
        loot: [{ typeId: "minecraft:diamond", amount: 1 }]
    }));

    const item = createItemStack("minecraft:iron_pickaxe");
    const positions = blocks.map(block => ({ x: block.x, y: block.y, z: block.z }));
    for (const _ of breakFunctions.breakAll(player, "minecraft:diamond_ore", positions, { x: 0.5, y: 70.5, z: 0.5 }, item)) { /* drain */ }

    assert.deepEqual(blocks.map(block => block.typeId), ["minecraft:air", "minecraft:air", "minecraft:air"]);
    const diamonds = dimension.items.filter(item => item.typeId === "minecraft:diamond");
    assert.equal(diamonds.reduce((total, stack) => total + stack.amount, 0), 3, "one drop per block");
    assert.ok(dimension.entities.some(entity => entity.typeId === "minecraft:xp_orb"), "diamond ore must award experience");
});

test("creative vein mining removes blocks without spawning drops", async () => {
    const { breakFunctions } = await load("functions/break.js");
    const dimension = createDimension("creative-dim");
    const player = createPlayer({ id: "creative", dimension, gameMode: "creative" });
    const blocks = [0, 1].map(index => createBlock(dimension, {
        x: index,
        y: 60,
        z: 0,
        typeId: "minecraft:diamond_ore",
        loot: [{ typeId: "minecraft:diamond", amount: 1 }]
    }));

    for (const _ of breakFunctions.breakAll(player, "minecraft:diamond_ore", blocks.map(b => ({ x: b.x, y: b.y, z: b.z })), { x: 0.5, y: 60.5, z: 0.5 }, createItemStack("minecraft:diamond_pickaxe"))) { /* drain */ }

    assert.deepEqual(blocks.map(block => block.typeId), ["minecraft:air", "minecraft:air"]);
    assert.equal(dimension.items.length, 0, "creative must not spawn item drops");
    assert.equal(dimension.entities.length, 0, "creative must not spawn experience orbs");
});

test("a block without loot no longer aborts the preview for other players", async () => {
    const { playersList } = await load("events/runInterval.js");
    const { apiConfig } = await load("lib/player/config.js");
    const dimension = createDimension("interval-dim");
    const queried = [];

    const watching = (id, typeId, loot) => {
        const player = createPlayer({ id, dimension, sneaking: true });
        const config = apiConfig.get(player);
        config.showSelection = true;
        apiConfig.set(player, config);
        player.getBlockFromViewDirection = () => {
            queried.push(id);
            return { block: createBlock(dimension, { x: 0, y: 80, z: 0, typeId, loot }), face: "Up" };
        };
        playersList.add(player);
        return player;
    };

    playersList.clear();
    watching("player-no-loot", "minecraft:stone", []);
    watching("player-with-loot", "minecraft:diamond_ore", [{ typeId: "minecraft:diamond", amount: 1 }]);

    intervalHandle(5).callback();

    assert.deepEqual(queried.sort(), ["player-no-loot", "player-with-loot"], "both players must be processed");
    playersList.clear();
});

test("preview markers are tracked per player and removed when they stop sneaking", async () => {
    const { borderFunctions, previewOwners } = await load("functions/preview.js");
    const { playersList } = await load("events/runInterval.js");
    playersList.clear();

    const dimension = createDimension("preview-dim");
    const player = createPlayer({ id: "viewer", dimension, sneaking: true });
    const blocks = [
        createBlock(dimension, { x: 0, y: 64, z: 0 }),
        createBlock(dimension, { x: 1, y: 64, z: 0 })
    ].map(block => ({ x: block.x, y: block.y, z: block.z }));

    for (const _ of borderFunctions.show(player, blocks, false, 3)) { /* drain */ }

    assert.equal(dimension.entities.length, 2, "one marker per exposed block");
    assert.ok(previewOwners.has("viewer"));

    player.isSneaking = false;
    intervalHandle(5).callback();

    assert.equal(dimension.entities.length, 0, "markers must be removed");
    assert.ok(!previewOwners.has("viewer"));
});

test("leaving the world releases per-player state", async () => {
    const { apiConfig } = await load("lib/player/config.js");
    const { apiDeleteBlocks } = await load("lib/player/deleteBlocks.js");
    const { TimerTurnOff, setTurnOff } = await load("functions/turnOffTimer.js");

    const player = createPlayer({ id: "leaver", dimension: overworld });
    const config = apiConfig.get(player);
    config.maxSize = 32;
    apiConfig.set(player, config);
    apiDeleteBlocks.set(player, ["minecraft:stone"]);
    setTurnOff(player, 1);

    world.beforeEvents.playerLeave.fire({ player });

    assert.ok(!TimerTurnOff.has("leaver"), "inactivity timer must be dropped");
    // The cached objects are gone; reading again comes from the dynamic property.
    assert.equal(apiConfig.get(player).maxSize, 32);
    assert.deepEqual([...apiDeleteBlocks.get(player)], ["minecraft:stone"]);
});

test("the settings panel opens as a tagged long form with every section", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const player = createPlayer({ id: "panel-open", dimension: overworld });

    resetForms();
    configPanel.open(player);

    const form = forms.at(-1);
    assert.equal(form.constructor.name, "ActionFormData", "the panel must be a long form");
    assert.ok(flatten(form.titleText).startsWith(PANEL_TAG), "the title must carry the tag the resource pack looks for");
    assert.ok(flatten(form.titleText).includes("config.title"));

    const labels = form.buttons.map(button => flatten(button.text)).join("\n");
    for (const key of ["config.function_type", "config.turn_off_short", "config.max_size", "config.show_selection", "config.show_when_sneaking", "config.accuracy", "config.thick_edges", "config.more", "config.delete_blocks", "config.done"])
        assert.ok(labels.includes(key), `the main page is missing "${key}"`);
    assert.ok(!labels.includes("config.cancel_no_drop"), "rarely used settings belong on the advanced page");
});

test("the advanced page shows every remaining toggle and the reset row", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const player = createPlayer({ id: "panel-advanced", dimension: overworld });

    resetForms();
    // Each queued function is the answer to one screen, in the order the panel
    // shows them: main -> advanced.
    formResponses.push(view => ({ canceled: false, selection: view.indexOf("config.more") }));
    configPanel.open(player);
    await flushPromises();

    const advanced = forms.at(-1);
    assert.equal(forms.length, 2, "the advanced page must open");
    const labels = advanced.buttons.map(button => flatten(button.text)).join("\n");
    for (const key of ["config.show_info", "config.quick_settings", "config.cancel_no_drop", "config.cancel_open_item", "config.auto_all", "config.only_ore", "config.only_log", "config.connected_diagonals", "config.protect_tool", "config.show_when_sneaking", "config.reset"])
        assert.ok(labels.includes(key), `the advanced page is missing "${key}"`);
});

test("clicking a toggle saves it and re-opens the page with the new state", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { apiConfig } = await load("lib/player/config.js");
    const player = createPlayer({ id: "panel-toggle", dimension: overworld });

    resetForms();
    formResponses.push(view => ({ canceled: false, selection: view.indexOf("config.show_selection") }));
    configPanel.open(player);
    await flushPromises();

    assert.equal(apiConfig.get(player).showSelection, true, "the toggle must be saved immediately");
    assert.equal(forms.length, 2, "the panel re-opens on the same page");
    assert.ok(forms.at(-1).buttons.some(button => flatten(button.text).startsWith(ROW_ON)), "the row shows the new state");
});

test("the sneaking row adds the player tag and shows the new state", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { ALWAYS_SHOW_TAG } = await load("events/runInterval.js");
    const player = createPlayer({ id: "panel-sneak", dimension: overworld });

    resetForms();
    formResponses.push(view => ({ canceled: false, selection: view.indexOf("config.show_when_sneaking") }));
    configPanel.open(player);
    await flushPromises();

    assert.equal(player.hasTag(ALWAYS_SHOW_TAG), true, "the tag is what keeps the outline visible");
    const row = forms.at(-1).buttons.find(button => JSON.stringify(button.text).includes("config.show_when_sneaking"));
    assert.ok(row, "the row is still on the page");
    assert.ok(flatten(row.text).includes("config.on"), "the row reports the new state");
});

test("picking a function on the function page stores it and goes back", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { apiConfig } = await load("lib/player/config.js");
    const player = createPlayer({ id: "panel-function", dimension: overworld });

    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.function_type") }),
        view => ({ canceled: false, selection: view.indexOf("config.function_type.escape_tunnel") }),
        view => ({ canceled: false, selection: view.indexOf("config.back") })
    );
    configPanel.open(player);
    await flushPromises();

    assert.equal(apiConfig.get(player).functionType, "escape_tunnel");
    assert.equal(forms.length, 4, "main -> function -> function -> main");
    assert.ok(flatten(forms.at(-1).titleText).includes("config.title"), "Back returns to the main page");
});

test("the delete blocks page toggles a block and stays open", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { apiDeleteBlocks } = await load("lib/player/deleteBlocks.js");
    const player = createPlayer({ id: "panel-blocks", dimension: overworld });

    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.delete_blocks") }),
        () => ({ canceled: false, selection: 0 })
    );
    configPanel.open(player);
    await flushPromises();

    assert.deepEqual([...apiDeleteBlocks.get(player)], ["minecraft:stone"], "the first block row is stone");
    assert.equal(forms.length, 3, "main -> blocks -> blocks");
    assert.ok(flatten(forms.at(-1).titleText).includes("config.delete_blocks"));
});

test("Reset to Defaults restores the shipped settings", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { apiConfig } = await load("lib/player/config.js");
    const player = createPlayer({ id: "panel-reset", dimension: overworld });

    const config = apiConfig.get(player);
    config.functionType = "3x3_tunnel";
    config.maxSize = 512;
    config.quick = true;
    apiConfig.set(player, config);

    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.more") }),
        view => ({ canceled: false, selection: view.indexOf("config.reset") })
    );
    configPanel.open(player);
    await flushPromises();

    const saved = apiConfig.get(player);
    assert.equal(saved.functionType, DEFAULT_CONFIG.functionType);
    assert.equal(saved.maxSize, DEFAULT_CONFIG.maxSize);
    assert.equal(saved.quick, DEFAULT_CONFIG.quick);
});

test("/uvm:veinminer sets a valid function and rejects unknown values", async () => {
    await load("main.js");
    const { apiConfig } = await load("lib/player/config.js");
    const { FUNCTION_LIST } = await load("lib/player/options.js");

    const registry = {
        enums: {},
        commands: [],
        registerEnum(name, values) { this.enums[name] = values; },
        registerCommand(definition, handler) { this.commands.push({ definition, handler }); }
    };
    system.beforeEvents.startup.fire({ customCommandRegistry: registry });

    const command = registry.commands.find(entry => entry.definition.name === "uvm:veinminer");
    assert.ok(command, "/uvm:veinminer must be registered");
    assert.deepEqual(registry.enums["uvm:functions"], [...FUNCTION_LIST]);

    const player = createPlayer({ id: "command-user", dimension: overworld });
    const result = command.handler({ sourceEntity: player }, "escape_tunnel");
    assert.equal(result.status, 0);
    assert.equal(apiConfig.get(player).functionType, "escape_tunnel");

    const rejected = command.handler({ sourceEntity: player }, "not_a_function");
    assert.equal(rejected.status, 1);
    assert.equal(apiConfig.get(player).functionType, "escape_tunnel", "an invalid value must not be stored");

    assert.equal(command.handler({ sourceEntity: {} }, "all").status, 1, "non-players are rejected");
});

test("the pickaxe shortcut honours 'No Open Panel With Pickaxe'", async () => {
    await load("events/itemUse.js");
    const { apiConfig } = await load("lib/player/config.js");
    const player = createPlayer({ id: "shortcut", dimension: overworld });
    player.isSneaking = true;
    player.getBlockFromViewDirection = () => undefined; // looking at air
    const pickaxe = { typeId: "minecraft:iron_pickaxe", getTags: () => ["minecraft:is_pickaxe"] };

    const config = apiConfig.get(player);
    config.cancelOpenItem = true;
    apiConfig.set(player, config);
    resetForms();
    world.afterEvents.itemUse.fire({ source: player, itemStack: pickaxe });
    await flushPromises();
    assert.equal(forms.length, 0, "the panel must stay closed");

    const allowed = apiConfig.get(player);
    allowed.cancelOpenItem = false;
    apiConfig.set(player, allowed);
    world.afterEvents.itemUse.fire({ source: player, itemStack: pickaxe });
    await flushPromises();
    assert.equal(forms.length, 1, "the panel must open");
});

test("only real players trigger vein mining from entityHitBlock", async () => {
    await load("events/hitBlock.js");
    const { apiConfig } = await load("lib/player/config.js");
    const dimension = createDimension("hit-dim");
    const block = createBlock(dimension, { x: 0, y: 64, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }] });

    let touched = false;
    const fakeEntity = { id: "arrow", isValid: true, isSneaking: false, get id() { touched = true; return "arrow"; } };
    assert.ok(!(fakeEntity instanceof Player));

    world.afterEvents.entityHitBlock.fire({ damagingEntity: fakeEntity, hitBlock: block, blockFace: "Up" });
    assert.equal(touched, false, "a projectile must not reach the config lookup");

    const player = createPlayer({ id: "hitter", dimension, sneaking: true });
    const config = apiConfig.get(player);
    config.showSelection = true;
    apiConfig.set(player, config);
    assert.doesNotThrow(() => world.afterEvents.entityHitBlock.fire({ damagingEntity: player, hitBlock: block, blockFace: "Up" }));
});

test("the operator commands set the world cap and the default function", async () => {
    await load("main.js");
    const { apiWorldConfig } = await load("lib/player/worldConfig.js");
    const { apiConfig } = await load("lib/player/config.js");

    const registry = {
        enums: {},
        commands: [],
        registerEnum(name, values) { this.enums[name] = values; },
        registerCommand(definition, handler) { this.commands.push({ definition, handler }); }
    };
    system.beforeEvents.startup.fire({ customCommandRegistry: registry });

    const limit = registry.commands.find(entry => entry.definition.name === "uvm:veinminer_maxsize");
    const preset = registry.commands.find(entry => entry.definition.name === "uvm:veinminer_default");
    assert.ok(limit, "the Max Size cap command must be registered");
    assert.ok(preset, "the default function command must be registered");

    const player = createPlayer({ id: "world-limit", dimension: overworld });
    assert.equal(apiConfig.get(player).maxSize, 64);

    assert.equal(limit.handler({}, 128).status, 0);
    assert.equal(apiWorldConfig.get().maxSizeCap, 128);
    assert.equal(apiWorldConfig.maxSizeCap, 128, "the panel reads the cap through this getter");
    assert.equal(apiConfig.get(player).maxSize, 64, "a size below the cap is untouched");

    const config = apiConfig.get(player);
    config.maxSize = 1024;
    assert.equal(apiConfig.set(player, config).maxSize, 128, "the cap applies when the player saves too");

    // The Max Size page must not offer a size above the cap.
    const { configPanel } = await load("functions/configUI.js");
    resetForms();
    formResponses.push(view => ({ canceled: false, selection: view.indexOf("config.max_size") }));
    configPanel.open(player);
    await flushPromises();
    const sizePage = forms.at(-1);
    // "§8  16" -> 16: drop the formatting codes, then read the trailing number.
    const offered = sizePage.buttons
        .map(button => Number(flatten(button.text).replace(/§./g, "").trim().split(/\s+/).pop()))
        .filter(size => Number.isFinite(size));
    assert.ok(offered.length > 0, "the size page must offer something");
    assert.ok(offered.every(size => size <= 128), `sizes above the cap must be hidden, got ${offered}`);

    assert.equal(limit.handler({}, -5).status, 1, "a negative cap is rejected");
    assert.equal(limit.handler({}, 0).status, 0);
    assert.equal(apiWorldConfig.get().maxSizeCap, undefined, "0 removes the cap");

    assert.equal(preset.handler({}, "3x3_tunnel").status, 0);
    const fresh = createPlayer({ id: "world-default", dimension: overworld });
    assert.equal(apiConfig.get(fresh).functionType, "3x3_tunnel", "new players start with the world default");
    assert.equal(preset.handler({}, "not_a_function").status, 1);

    apiWorldConfig.clear();
});

test("with Require Sneaking off a standing player still mines the vein", async () => {
    await load("main.js");
    const { apiConfig } = await load("lib/player/config.js");
    const dimension = createDimension("activation-dim");
    const player = createPlayer({ id: "activation", dimension, item: createPickaxe() });
    player.getBlockFromViewDirection = () => undefined;

    const origin = createBlock(dimension, { x: 0, y: 70, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }] });
    const neighbours = [1, 2].map(index => createBlock(dimension, {
        x: index, y: 70, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }]
    }));

    // Default: standing still does nothing.
    world.beforeEvents.playerBreakBlock.fire({ player, block: origin });
    await flushPromises();
    assert.deepEqual(neighbours.map(block => block.typeId), ["minecraft:diamond_ore", "minecraft:diamond_ore"]);

    const config = apiConfig.get(player);
    config.requireSneak = false;
    apiConfig.set(player, config);

    world.beforeEvents.playerBreakBlock.fire({ player, block: origin });
    await flushPromises();
    assert.deepEqual(neighbours.map(block => block.typeId), ["minecraft:air", "minecraft:air"], "the vein is mined without sneaking");
});

test("an unmarked tool cannot mine when Only Marked Tools is on", async () => {
    await load("main.js");
    const { apiConfig } = await load("lib/player/config.js");
    const { TOOL_MARK } = await load("lib/player/activation.js");
    const { configPanel } = await load("functions/configUI.js");
    const dimension = createDimension("mark-dim");
    const pickaxe = createPickaxe();
    const player = createPlayer({ id: "mark", dimension, sneaking: true, item: pickaxe });
    player.getBlockFromViewDirection = () => undefined;

    const config = apiConfig.get(player);
    config.markedToolsOnly = true;
    apiConfig.set(player, config);

    const origin = createBlock(dimension, { x: 0, y: 70, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }] });
    const neighbour = createBlock(dimension, { x: 1, y: 70, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }] });

    world.beforeEvents.playerBreakBlock.fire({ player, block: origin });
    await flushPromises();
    assert.equal(neighbour.typeId, "minecraft:diamond_ore", "an unmarked pickaxe is ignored");

    // Mark it from the panel: main -> activation -> mark held tool.
    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.activation") }),
        view => ({ canceled: false, selection: view.indexOf("config.mark_tool") })
    );
    configPanel.open(player);
    await flushPromises();
    assert.equal(pickaxe.getDynamicProperty(TOOL_MARK), true, "the held pickaxe is marked");
    assert.equal(player._mainhand, pickaxe, "the marked stack stays in the hand");

    world.beforeEvents.playerBreakBlock.fire({ player, block: origin });
    await flushPromises();
    assert.equal(neighbour.typeId, "minecraft:air", "a marked pickaxe mines");
});

test("Protect My Tool stops the vein before the pickaxe dies", async () => {
    await load("main.js");
    const { apiConfig } = await load("lib/player/config.js");
    const { apiDurability } = await load("lib/item/durability.js");
    const dimension = createDimension("guard-dim");
    const durability = { damage: 0, maxDurability: 4 };
    const pickaxe = createPickaxe({ durability });
    const player = createPlayer({ id: "guard", dimension, sneaking: true, item: pickaxe });
    player.getBlockFromViewDirection = () => undefined;
    player._mainhand = pickaxe;

    const config = apiConfig.get(player);
    config.protectTool = true;
    apiConfig.set(player, config);

    const blocks = [0, 1, 2, 3, 4].map(index => createBlock(dimension, {
        x: index, y: 70, z: 0, typeId: "minecraft:diamond_ore", loot: [{ typeId: "minecraft:diamond", amount: 1 }]
    }));
    player._mainhand = pickaxe;

    world.beforeEvents.playerBreakBlock.fire({ player, block: blocks[0] });
    await flushPromises();

    // 4 durability, one kept back: the shape may plan 3 blocks (origin + 2), so
    // the extra two ore blocks survive with the pickaxe still usable.
    assert.equal(durability.damage, 2, "only the two extra blocks were charged");
    // The origin is broken by the pack as well: 3 of 5 blocks go, the guarded
    // durability point keeps the last two in place.
    assert.deepEqual(blocks.map(block => block.typeId), ["minecraft:air", "minecraft:air", "minecraft:air", "minecraft:diamond_ore", "minecraft:diamond_ore"]);
    assert.equal(apiDurability.getDurability(pickaxe), 2, "the pickaxe still has durability left");
});

test("Never Mine blocks are skipped while the rest of the shape is mined", async () => {
    const { functionController } = await load("functions/controller.js");
    const { sanitizeConfig } = await load("lib/player/options.js");
    const dimension = createDimension("never-dim");
    const pickaxe = createPickaxe();
    const player = createPlayer({ id: "never", dimension, sneaking: true, item: pickaxe });
    const loot = [{ typeId: "minecraft:cobblestone", amount: 1 }];
    const blocks = [
        createBlock(dimension, { x: 0, y: 70, z: 0, typeId: "minecraft:stone", loot }),
        createBlock(dimension, { x: 1, y: 70, z: 0, typeId: "minecraft:dirt", loot }),
        createBlock(dimension, { x: 2, y: 70, z: 0, typeId: "minecraft:stone", loot })
    ];
    const positions = blocks.map(block => ({ x: block.x, y: block.y, z: block.z }));

    functionController({
        type: "break",
        player,
        config: sanitizeConfig({ functionType: "all" }),
        item: pickaxe,
        blockIds: ["minecraft:stone"],
        origin: blocks[0],
        originDamaged: true,
        neverMine: new Set(["minecraft:dirt"])
    }, positions);
    await flushPromises();

    assert.deepEqual(blocks.map(block => block.typeId), ["minecraft:air", "minecraft:dirt", "minecraft:air"]);
});

test("This Tool saves and clears the profile of the held pickaxe", async () => {
    await load("main.js");
    const { configPanel } = await load("functions/configUI.js");
    const { apiConfig } = await load("lib/player/config.js");
    const { readToolProfile } = await load("lib/item/toolProfile.js");
    const dimension = createDimension("profile-dim");
    const pickaxe = createPickaxe();
    const player = createPlayer({ id: "profile", dimension, item: pickaxe });

    const config = apiConfig.get(player);
    config.functionType = "3x3_tunnel";
    config.maxSize = 128;
    apiConfig.set(player, config);

    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.this_tool") }),
        view => ({ canceled: false, selection: view.indexOf("config.this_tool.save") })
    );
    configPanel.open(player);
    await flushPromises();

    assert.deepEqual(readToolProfile(pickaxe), { functionType: "3x3_tunnel", maxSize: 128 });
    assert.equal(player._mainhand, pickaxe, "the profiled stack stays in the hand");

    resetForms();
    formResponses.push(
        view => ({ canceled: false, selection: view.indexOf("config.this_tool") }),
        view => ({ canceled: false, selection: view.indexOf("config.this_tool.clear") })
    );
    configPanel.open(player);
    await flushPromises();
    assert.equal(readToolProfile(pickaxe), undefined, "clearing removes the profile");
});

test("/uvm:veinminer_preset applies a bundle and rejects unknown names", async () => {
    await load("main.js");
    const registry = {
        enums: {},
        commands: [],
        registerEnum(name, values) { this.enums[name] = values; },
        registerCommand(definition, handler) { this.commands.push({ definition, handler }); }
    };
    system.beforeEvents.startup.fire({ customCommandRegistry: registry });

    const preset = registry.commands.find(entry => entry.definition.name === "uvm:veinminer_preset");
    assert.ok(preset, "the preset command must be registered");
    assert.deepEqual(registry.enums["uvm:presets"], ["miner", "builder", "lumberjack", "off"]);

    const { apiConfig } = await load("lib/player/config.js");
    const apiConfigOf = target => apiConfig.get(target);

    const player = createPlayer({ id: "preset", dimension: overworld });
    assert.equal(preset.handler({ sourceEntity: player }, "miner").status, 0);
    const config = apiConfigOf(player);
    assert.equal(config.functionType, "all");
    assert.equal(config.onlyOre, true);
    assert.equal(config.maxSize, 256);

    assert.equal(preset.handler({ sourceEntity: player }, "builder").status, 0);
    const builder = apiConfigOf(player);
    assert.equal(builder.functionType, "3x3_tunnel_small");
    assert.equal(builder.protectTool, true);

    assert.equal(preset.handler({ sourceEntity: player }, "nonsense").status, 1);
    assert.equal(apiConfigOf(player).functionType, "3x3_tunnel_small", "a rejected preset changes nothing");
    assert.equal(preset.handler({ sourceEntity: {} }, "miner").status, 1, "non-players are rejected");
});

test("the info commands summarise the player and the world", async () => {
    await load("main.js");
    const { apiConfig } = await load("lib/player/config.js");
    const { apiWorldConfig } = await load("lib/player/worldConfig.js");
    const { apiNeverMine } = await load("lib/player/neverMine.js");

    const registry = {
        enums: {},
        commands: [],
        registerEnum(name, values) { this.enums[name] = values; },
        registerCommand(definition, handler) { this.commands.push({ definition, handler }); }
    };
    system.beforeEvents.startup.fire({ customCommandRegistry: registry });

    const stats = registry.commands.find(entry => entry.definition.name === "uvm:veinminer_stats");
    const status = registry.commands.find(entry => entry.definition.name === "uvm:veinminer_world");
    assert.ok(stats, "/uvm:veinminer_stats must be registered");
    assert.ok(status, "/uvm:veinminer_world must be registered");

    const player = createPlayer({ id: "stats", dimension: overworld });
    const config = apiConfig.get(player);
    config.functionType = "3x3_tunnel";
    config.maxSize = 128;
    config.showSelection = true;
    config.requireSneak = false;
    apiConfig.set(player, config);
    apiNeverMine.set(player, ["minecraft:stone_bricks", "minecraft:deepslate_bricks"]);

    assert.equal(stats.handler({ sourceEntity: player }).status, 0);
    assert.equal(player.messages.length, 2);
    assert.deepEqual(player.messages[0], {
        translate: "warning.utilities_vein_miner:stats",
        with: ["3x3_tunnel", "128", "ON", "no"]
    });
    assert.deepEqual(player.messages[1].with, ["2", "0", "always"]);

    const before = world.messages.length;
    assert.equal(status.handler({}).status, 0);
    assert.equal(world.messages.length, before + 1);
    assert.deepEqual(world.messages.at(-1).with, ["-", "-"]);

    apiWorldConfig.set({ maxSizeCap: 64, defaultFunction: "all" });
    assert.equal(status.handler({}).status, 0);
    assert.deepEqual(world.messages.at(-1).with, ["64", "all"]);
    apiWorldConfig.clear();

    assert.equal(stats.handler({ sourceEntity: {} }).status, 1, "non-players are rejected");
});
