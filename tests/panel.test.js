import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    CHOICE_RANGES,
    EDGE_SIZE_CHOICES,
    MAX_SIZE_CHOICES,
    PANEL_PAGES,
    PANEL_TAG,
    ROW_OFF,
    ROW_ON,
    TOGGLE_SETTINGS,
    applySetting,
    buildPanel,
    flatten,
    normalizePage
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/panel.js";
import {
    DEFAULT_CONFIG,
    FUNCTION_LIST,
    TURN_OFF_LIST,
    sanitizeConfig
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/options.js";

const GLOBAL_VARIABLES = fileURLToPath(new URL("../Utils Vein Miner RP/ui/_global_variables.json", import.meta.url));

/** @returns {ReturnType<typeof sanitizeConfig>} */
function config(overrides = {}) {
    return { ...DEFAULT_CONFIG, ...overrides };
}

test("every page builds with a title and one action per button", () => {
    for (const page of PANEL_PAGES) {
        const view = buildPanel(page, config(), { blocks: ["minecraft:stone"] });
        assert.match(view.title, /^ui\.utilities_vein_miner:config\./, `${page} needs a title key`);

        const buttons = view.elements.filter(element => element.type === "button");
        assert.equal(view.actions.length, buttons.length, `${page}: one action per button`);
        assert.ok(buttons.length > 0, `${page} must have buttons`);

        for (const button of buttons) {
            assert.ok(flatten(button.text).length > 0, `${page}: a button has no text`);
        }
        for (const action of view.actions) {
            assert.ok(
                /^(page\|[a-zA-Z]+|toggle\|[a-zA-Z]+|set\|[a-zA-Z]+\|[\w.]+|block\|[a-zA-Z]+\|minecraft:[a-z_]+|tool\|(mark|save|clear)|reset|close)$/.test(action),
                `${page}: unexpected action "${action}"`
            );
        }
    }
});

test("the panel reaches every configurable setting", () => {
    const actions = new Set();
    for (const page of PANEL_PAGES)
        for (const action of buildPanel(page, config(), { blocks: [] }).actions) actions.add(action);

    for (const [key] of TOGGLE_SETTINGS)
        assert.ok(actions.has(`toggle|${key}`), `${key} has no toggle row`);
    assert.ok(actions.has("toggle|showWhenSneaking"), "the sneaking tag has no toggle row");

    for (const page of ["function", "turnOff", "maxSize", "edgeSize", "activation", "tool", "deleteBlocks", "neverMine"])
        assert.ok(actions.has(`page|${page}`), `the ${page} page is unreachable`);

    assert.ok(actions.has("close"), "there is no way to close the panel");
    assert.ok(actions.has("reset"), "there is no way to restore the defaults");
});

test("toggle rows carry the marker the resource pack draws a pill for", () => {
    /** Text of the button that triggers `action`, in button order. */
    const rowText = (view, action) =>
        flatten(view.elements.filter(element => element.type === "button")[view.actions.indexOf(action)].text);

    const on = buildPanel("main", config({ showSelection: true }), { sneaking: false });
    const off = buildPanel("main", config({ showSelection: false }), { sneaking: false });

    assert.ok(rowText(on, "toggle|showSelection").startsWith(ROW_ON), "an enabled setting must use the ON marker");
    assert.ok(rowText(off, "toggle|showSelection").startsWith(ROW_OFF), "a disabled setting must use the OFF marker");
    assert.ok(rowText(on, "toggle|showSelection").includes("config.on"), "the state is spelled out for the vanilla form");
    assert.ok(rowText(off, "toggle|showSelection").includes("config.off"), "the state is spelled out for the vanilla form");

    for (const marker of [ROW_ON, ROW_OFF]) assert.ok(marker.startsWith("\u00a7"), "the markers must be formatting codes");
});

test("value rows show the current value and link to their page", () => {
    const view = buildPanel("main", config({ functionType: "escape_tunnel", maxSize: 128, edgeSize: 4 }), {});
    const text = view.elements.filter(element => element.type === "button").map(button => flatten(button.text)).join("\n");

    assert.ok(text.includes("config.function_type.escape_tunnel"), "the current function is shown");
    assert.ok(text.includes("128"), "max size is shown");
    assert.ok(text.includes("4"), "edge thickness is shown");
});

test("choice pages mark the current value and keep schema order", () => {
    const functions = buildPanel("function", config({ functionType: "3x3_tunnel" }), {});
    assert.equal(functions.actions.length, FUNCTION_LIST.length + 1, "one row per function plus Back");
    const selected = functions.elements
        .filter(element => element.type === "button")
        .filter(button => flatten(button.text).startsWith("§a> "));
    assert.equal(selected.length, 1, "exactly one choice is marked");
    assert.ok(flatten(selected[0].text).includes("config.function_type.3x3_tunnel"));

    const turnOff = buildPanel("turnOff", config({ turnOff: 2 }), {});
    assert.equal(turnOff.actions.length, TURN_OFF_LIST.length + 1);
    assert.ok(flatten(turnOff.elements.filter(element => element.type === "button")[2].text).startsWith("§a> "));
});

test("the delete blocks page lists every block with its state", () => {
    const view = buildPanel("deleteBlocks", config(), {
        blocks: ["minecraft:stone", "minecraft:dirt"],
        deleteBlocks: new Set(["minecraft:dirt"])
    });

    assert.deepEqual(view.actions, ["block|deleteBlocks|minecraft:stone", "block|deleteBlocks|minecraft:dirt", "page|main"]);

    const rows = view.elements.filter(element => element.type === "button").map(button => flatten(button.text));
    assert.ok(rows[0].startsWith(ROW_OFF), "an unselected block is not deleted");
    assert.ok(rows[1].startsWith(ROW_ON), "a selected block is deleted");
    assert.ok(rows[0].includes("tile.stone.stone.name"), "the vanilla block name is used");
});

test("choose lists stay on the schema grid", () => {
    for (const size of MAX_SIZE_CHOICES) {
        assert.ok(size >= CHOICE_RANGES.maxSize.min && size <= CHOICE_RANGES.maxSize.max, `${size} is out of range`);
        assert.equal(size % CHOICE_RANGES.maxSize.step, 0, `${size} is not on the ${CHOICE_RANGES.maxSize.step} grid`);
    }
    assert.ok(MAX_SIZE_CHOICES.includes(DEFAULT_CONFIG.maxSize), "the default must be one of the choices");
    assert.deepEqual([...EDGE_SIZE_CHOICES], [1, 2, 3, 4, 5]);
    assert.ok(EDGE_SIZE_CHOICES.includes(DEFAULT_CONFIG.edgeSize), "the default must be one of the choices");
});

test("applySetting only writes known fields and clamps values", () => {
    const settings = config();

    assert.equal(applySetting(settings, "toggle|showSelection"), true);
    assert.equal(settings.showSelection, true);
    assert.equal(applySetting(settings, "toggle|showSelection"), true);
    assert.equal(settings.showSelection, false);

    for (const bogus of ["toggle|notAField", "toggle|toString", "set|functionType|nope", "set|turnOff|9", "set|turnOff|x", "set|unknown|1", "block|minecraft:stone", "page|main"]) {
        assert.equal(applySetting(settings, bogus), false, `"${bogus}" must be rejected`);
    }
    assert.deepEqual(settings, config(), "a rejected action must not touch the config");

    assert.equal(applySetting(settings, "set|functionType|escape_tunnel"), true);
    assert.equal(settings.functionType, "escape_tunnel");

    assert.equal(applySetting(settings, "set|maxSize|5000"), true);
    assert.equal(settings.maxSize, 1024, "out of range sizes clamp to the maximum");

    assert.equal(applySetting(settings, "set|maxSize|100"), true);
    assert.equal(settings.maxSize, 96, "sizes snap to the 16 grid");

    assert.equal(applySetting(settings, "set|edgeSize|9"), true);
    assert.equal(settings.edgeSize, 5);

    assert.equal(applySetting(settings, "set|turnOff|3"), true);
    assert.equal(settings.turnOff, 3);
});

test("unknown pages fall back to the main page", () => {
    assert.equal(normalizePage("advanced"), "advanced");
    assert.equal(normalizePage("nope"), "main");
    assert.equal(normalizePage(undefined), "main");
});

test("the panel markers match the resource pack variables", () => {
    const variables = JSON.parse(readFileSync(GLOBAL_VARIABLES, "utf8"));
    assert.equal(variables.$uvm_panel_tag, PANEL_TAG, "ui/_global_variables.json $uvm_panel_tag drifted from panel.js");
    assert.equal(variables.$uvm_row_on, ROW_ON, "ui/_global_variables.json $uvm_row_on drifted from panel.js");
    assert.equal(variables.$uvm_row_off, ROW_OFF, "ui/_global_variables.json $uvm_row_off drifted from panel.js");
});

test("flatten turns form messages into readable text", () => {
    assert.equal(flatten({ rawtext: [{ text: "a" }, { translate: "k" }, { text: "b" }] }), "a[k]b");
    assert.equal(flatten("plain"), "plain");
    assert.equal(flatten(undefined), "");
});

test("the activation page exposes both switches and the tool mark", () => {
    const view = buildPanel("activation", config(), { itemMarked: false });
    const labels = view.elements.filter(element => element.type === "button").map(button => flatten(button.text));

    assert.ok(view.actions.includes("toggle|requireSneak"));
    assert.ok(view.actions.includes("toggle|markedToolsOnly"));
    assert.ok(view.actions.includes("tool|mark"));
    assert.ok(labels.some(label => label.includes("config.mark_tool") && label.includes("config.not_marked")));

    const marked = buildPanel("activation", config(), { itemMarked: true });
    assert.ok(
        marked.elements.filter(element => element.type === "button").some(button => flatten(button.text).includes("config.marked")),
        "a marked tool says so"
    );
});

test("the main page shows how vein mining is activated", () => {
    const sneak = buildPanel("main", config({ requireSneak: true }), {});
    const always = buildPanel("main", config({ requireSneak: false }), {});
    const row = view => flatten(
        view.elements.filter(element => element.type === "button")[view.actions.indexOf("page|activation")]
            .text
    );

    assert.ok(row(sneak).includes("config.activation.sneak"));
    assert.ok(row(always).includes("config.activation.always"));
});

test("the max size page hides choices above the world cap", () => {
    const view = buildPanel("maxSize", config({ maxSize: 32 }), { maxSizeCap: 64 });
    const sizes = view.actions.filter(action => action.startsWith("set|maxSize|")).map(action => Number(action.split("|")[2]));

    assert.ok(sizes.length > 0);
    assert.ok(sizes.every(size => size <= 64), `every offered size must respect the cap, got ${sizes}`);
    assert.ok(!sizes.includes(128), "a size above the cap is not offered");
    assert.ok(
        view.elements.some(element => element.type === "label"),
        "the page explains why the list is short"
    );

    const unlimited = buildPanel("maxSize", config(), {});
    assert.ok(unlimited.actions.includes("set|maxSize|1024"), "without a cap the full list is offered");

    // The sizes are plain numbers, not translation keys.
    const labels = unlimited.elements.filter(element => element.type === "button").map(button => flatten(button.text));
    const rows = labels.filter(label => label.startsWith("§8 ") || label.startsWith("§a> "));
    assert.equal(rows.length, MAX_SIZE_CHOICES.length, "one row per size");
    for (const row of rows) {
        assert.ok(/^§[8a][> ] +\d+$/.test(row), `a size row must read like "  32", got ${JSON.stringify(row)}`);
    }
});

test("the never mine page is its own list", () => {
    const view = buildPanel("neverMine", config(), {
        neverMineChoices: ["minecraft:stone", "minecraft:stone_bricks"],
        neverMine: new Set(["minecraft:stone_bricks"])
    });

    assert.deepEqual(view.actions, [
        "block|neverMine|minecraft:stone",
        "block|neverMine|minecraft:stone_bricks",
        "page|main"
    ]);
    const rows = view.elements.filter(element => element.type === "button").map(button => flatten(button.text));
    assert.ok(rows[0].startsWith(ROW_OFF));
    assert.ok(rows[1].startsWith(ROW_ON));
});

test("the tool page shows the stored profile and offers save / clear", () => {
    const empty = buildPanel("tool", config(), {});
    assert.ok(empty.actions.includes("toggle|toolProfile"));
    assert.ok(empty.actions.includes("tool|save"));
    assert.ok(empty.actions.includes("tool|clear"));
    const emptyLabels = empty.elements.map(element => element.text).map(flatten);
    assert.ok(emptyLabels.some(label => label.includes("config.this_tool.none")), "an empty tool says so");

    const profiled = buildPanel("tool", config(), { toolProfile: { functionType: "3x3_tunnel", maxSize: 128 } });
    const labels = profiled.elements.map(element => element.text).map(flatten);
    assert.ok(labels.some(label => label.includes("config.function_type.3x3_tunnel")), "the function is shown");
    assert.ok(labels.some(label => label.includes("128")), "the size is shown");
    assert.ok(!labels.some(label => label.includes("config.this_tool.none")));
});

test("the main page links to the new pages", () => {
    const view = buildPanel("main", config({ toolProfile: true }), {
        toolProfile: { functionType: "all", maxSize: 64 },
        neverMine: new Set(["minecraft:stone"])
    });
    assert.ok(view.actions.includes("page|tool"));
    assert.ok(view.actions.includes("page|neverMine"));

    const rows = view.elements.filter(element => element.type === "button").map(button => flatten(button.text));
    const toolRow = rows[view.actions.indexOf("page|tool")];
    const neverRow = rows[view.actions.indexOf("page|neverMine")];
    assert.ok(toolRow.includes("config.function_type.all"), "the tool row shows its function");
    assert.ok(neverRow.includes("1"), "the never mine row counts the protected blocks");
});
