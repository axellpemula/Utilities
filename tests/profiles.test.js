import { test } from "node:test";
import assert from "node:assert/strict";

import {
    TOOL_PROFILE,
    applyToolProfile,
    normalizeToolProfile,
    readToolProfile
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/item/toolProfile.js";
import {
    PRESETS,
    PRESET_LIST,
    applyPreset,
    normalizePresetName
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/presets.js";
import { DEFAULT_CONFIG, sanitizeConfig } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/options.js";

/** An item that stores dynamic properties like an `ItemStack`. */
function tool(properties = {}) {
    const store = new Map(Object.entries(properties));
    return {
        getDynamicProperty: key => store.get(key),
        setDynamicProperty: (key, value) => store.set(key, value),
        _store: store
    };
}

test("a stored tool profile is normalised field by field", () => {
    assert.equal(normalizeToolProfile(undefined), undefined);
    assert.equal(normalizeToolProfile("junk"), undefined);
    assert.equal(normalizeToolProfile({}), undefined);
    assert.equal(normalizeToolProfile({ functionType: "nonsense" }), undefined);
    assert.deepEqual(normalizeToolProfile({ functionType: "all" }), { functionType: "all" });
    assert.deepEqual(normalizeToolProfile({ maxSize: 5000 }), { maxSize: 1024 });
    assert.deepEqual(normalizeToolProfile({ maxSize: 100 }), { maxSize: 96 });
    assert.deepEqual(normalizeToolProfile({ functionType: "3x3_tunnel", maxSize: 128, extra: 1 }), { functionType: "3x3_tunnel", maxSize: 128 });
});

test("reading a profile survives a missing, corrupt or foreign property", () => {
    assert.equal(readToolProfile(undefined), undefined);
    assert.equal(readToolProfile({}), undefined);
    assert.equal(readToolProfile(tool()), undefined);
    assert.equal(readToolProfile(tool({ [TOOL_PROFILE]: "{not json" })), undefined);
    assert.equal(readToolProfile(tool({ [TOOL_PROFILE]: JSON.stringify({ maxSize: 32 }) })).maxSize, 32);
    assert.equal(readToolProfile({ getDynamicProperty() { throw new Error("invalid entity"); } }), undefined);
});

test("a tool profile only applies when the setting is on", () => {
    const item = tool({ [TOOL_PROFILE]: JSON.stringify({ functionType: "escape_tunnel", maxSize: 32 }) });
    const config = sanitizeConfig({ functionType: "all", maxSize: 256, showInfo: true });

    assert.equal(applyToolProfile(config, item), config, "off: the very same object comes back");

    const merged = applyToolProfile({ ...config, toolProfile: true }, item);
    assert.equal(merged.functionType, "escape_tunnel");
    assert.equal(merged.maxSize, 32);
    assert.equal(merged.showInfo, true, "everything else stays the player's");

    const unprofiled = { ...config, toolProfile: true };
    assert.equal(applyToolProfile(unprofiled, tool()), unprofiled, "no profile, no copy");
});

test("presets only touch the fields they name", () => {
    const base = sanitizeConfig({ edgeSize: 5, showInfo: false, functionType: "1x1_tunnel", maxSize: 16 });

    const miner = applyPreset(base, "miner");
    assert.equal(miner.functionType, "all");
    assert.equal(miner.onlyOre, true);
    assert.equal(miner.maxSize, 256);
    assert.equal(miner.edgeSize, 5, "an unrelated setting is kept");
    assert.equal(miner.showInfo, false);

    const builder = applyPreset(base, "builder");
    assert.equal(builder.functionType, "3x3_tunnel_small");
    assert.equal(builder.protectTool, true);

    const lumberjack = applyPreset(base, "lumberjack");
    assert.equal(lumberjack.onlyLog, true);
    assert.equal(lumberjack.onlyOre, false);

    assert.equal(applyPreset(base, "off").functionType, "off");
    assert.equal(base.functionType, "1x1_tunnel", "the input is never mutated");
});

test("unknown presets are rejected instead of wiping a configuration", () => {
    assert.equal(applyPreset(DEFAULT_CONFIG, "nonsense"), undefined);
    assert.equal(applyPreset(DEFAULT_CONFIG, ""), undefined);
    assert.equal(normalizePresetName("miner"), "miner");
    assert.equal(normalizePresetName("MINER"), undefined);
    assert.deepEqual([...PRESET_LIST], Object.keys(PRESETS));
    for (const name of PRESET_LIST) {
        const applied = applyPreset(DEFAULT_CONFIG, name);
        assert.deepEqual(Object.keys(applied).sort(), Object.keys(DEFAULT_CONFIG).sort(), `${name} stays a complete config`);
    }
});
