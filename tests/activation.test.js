import { test } from "node:test";
import assert from "node:assert/strict";

import {
    TOOL_MARK,
    isMarkedTool,
    isMiningActive,
    isPickaxe
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/activation.js";
import { remainingForUse } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/item/durabilityMath.js";
import { DEFAULT_CONFIG } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/options.js";

/** @param {{marked?: boolean, tags?: string[]}} options */
const tool = ({ marked = false, tags = ["minecraft:is_pickaxe"] } = {}) => ({
    getTags: () => tags,
    getDynamicProperty: key => (marked && key === TOOL_MARK ? true : undefined)
});

const sneaking = { isSneaking: true };
const standing = { isSneaking: false };

test("sneaking always activates, whatever the tool", () => {
    for (const item of [tool(), tool({ tags: [] }), undefined]) {
        assert.equal(isMiningActive(sneaking, DEFAULT_CONFIG, item), true);
        assert.equal(isMiningActive(sneaking, { ...DEFAULT_CONFIG, requireSneak: false }, item), true);
    }
});

test("with Require Sneaking on, standing still never activates", () => {
    assert.equal(isMiningActive(standing, DEFAULT_CONFIG, tool()), false);
    assert.equal(isMiningActive(standing, { ...DEFAULT_CONFIG, requireSneak: true }, tool()), false);
});

test("with Require Sneaking off, only a pickaxe activates", () => {
    const config = { ...DEFAULT_CONFIG, requireSneak: false };
    assert.equal(isMiningActive(standing, config, tool()), true);
    assert.equal(isMiningActive(standing, config, tool({ tags: [] })), false, "a shovel must not start a vein");
    assert.equal(isMiningActive(standing, config, undefined), false, "an empty hand must not start a vein");
});

test("Only Marked Tools narrows every path down to marked items", () => {
    const marked = { ...DEFAULT_CONFIG, markedToolsOnly: true, requireSneak: false };
    assert.equal(isMiningActive(standing, marked, tool({ marked: true })), true);
    assert.equal(isMiningActive(standing, marked, tool()), false);
    assert.equal(isMiningActive(sneaking, marked, tool()), false, "sneaking does not bypass the mark");
    assert.equal(isMiningActive(sneaking, marked, tool({ marked: true })), true);
});

test("a broken item or a missing config never activates", () => {
    const throwing = {
        getTags() { throw new Error("invalid entity"); },
        getDynamicProperty() { throw new Error("invalid entity"); }
    };
    assert.equal(isMarkedTool(throwing), false);
    assert.equal(isPickaxe(throwing), false);
    assert.equal(isMiningActive(sneaking, { ...DEFAULT_CONFIG, markedToolsOnly: true }, throwing), false);
    assert.equal(isMiningActive(sneaking, undefined, tool()), false);
    assert.equal(isMarkedTool(undefined), false);
    assert.equal(isPickaxe(undefined), false);
});

test("Protect My Tool keeps its durability points back", () => {
    assert.equal(remainingForUse(10), 10);
    assert.equal(remainingForUse(10, 1), 9);
    assert.equal(remainingForUse(1, 1), 0, "the last point is not spendable");
    assert.equal(remainingForUse(0, 1), 0);
    assert.equal(remainingForUse(-4), 0);
    assert.equal(remainingForUse(Number.NaN), 0);
    assert.equal(remainingForUse(Infinity, 1), Infinity, "items without durability are unaffected");
    assert.equal(remainingForUse(5, -3), 5, "a negative reserve adds nothing");
});
