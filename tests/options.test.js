import { test } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_CONFIG,
    FUNCTION_LIST,
    TURN_OFF_LIST,
    isFunctionType,
    normalizeMaxSize,
    normalizeEdgeSize,
    normalizeTurnOff,
    normalizeFunctionType,
    functionTypeFromIndex,
    normalizeWorldConfig,
    sanitizeConfig
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/player/options.js";

test("defaults are frozen so they cannot be mutated by a caller", () => {
    assert.ok(Object.isFrozen(DEFAULT_CONFIG));
    assert.throws(() => { DEFAULT_CONFIG.functionType = "off"; }, TypeError);
});

test("sanitizeConfig always returns a new, complete config", () => {
    for (const input of [undefined, null, "garbage", 42, [], {}, { maxSize: "big" }]) {
        const config = sanitizeConfig(input);
        assert.notEqual(config, DEFAULT_CONFIG, "must not hand out the shared default object");
        assert.deepEqual(Object.keys(config).sort(), Object.keys(DEFAULT_CONFIG).sort());
        assert.equal(typeof config.showSelection, "boolean");
        assert.equal(typeof config.functionType, "string");
    }
});

test("mutating a sanitized config does not leak into the defaults", () => {
    const first = sanitizeConfig(undefined);
    first.functionType = "off";
    first.maxSize = 32;
    const second = sanitizeConfig(undefined);
    assert.equal(second.functionType, DEFAULT_CONFIG.functionType);
    assert.equal(second.maxSize, DEFAULT_CONFIG.maxSize);
});

test("a partial (older schema) config keeps its known fields", () => {
    const config = sanitizeConfig({ functionType: "3x3_tunnel", maxSize: 128 });
    assert.equal(config.functionType, "3x3_tunnel");
    assert.equal(config.maxSize, 128);
    assert.equal(config.edgeSize, DEFAULT_CONFIG.edgeSize);
});

test("wrong types fall back per field instead of discarding everything", () => {
    const config = sanitizeConfig({ maxSize: "64", showSelection: true, onlyOre: 1, edgeSize: null });
    assert.equal(config.showSelection, true);
    assert.equal(config.maxSize, DEFAULT_CONFIG.maxSize);
    assert.equal(config.onlyOre, DEFAULT_CONFIG.onlyOre);
    assert.equal(config.edgeSize, DEFAULT_CONFIG.edgeSize);
});

test("unknown function types fall back to the default", () => {
    assert.equal(sanitizeConfig({ functionType: "nope" }).functionType, DEFAULT_CONFIG.functionType);
    assert.ok(isFunctionType(sanitizeConfig({ functionType: "escape_tunnel" }).functionType));
});

test("normalizeFunctionType accepts a name or a dropdown index", () => {
    assert.equal(normalizeFunctionType("mining_tunnel"), "mining_tunnel");
    assert.equal(normalizeFunctionType(1), "all");
    assert.equal(normalizeFunctionType(-1), DEFAULT_CONFIG.functionType);
    assert.equal(normalizeFunctionType(999), DEFAULT_CONFIG.functionType);
    assert.equal(functionTypeFromIndex(0), "off");
    assert.equal(functionTypeFromIndex(FUNCTION_LIST.length), DEFAULT_CONFIG.functionType);
});

test("maxSize is clamped and aligned to the 16 block slider step", () => {
    assert.equal(normalizeMaxSize(64), 64);
    assert.equal(normalizeMaxSize(0), 16);
    assert.equal(normalizeMaxSize(-500), 16);
    assert.equal(normalizeMaxSize(5000), 1024);
    assert.equal(normalizeMaxSize(100), 96);
    assert.equal(normalizeMaxSize(103), 96);
    assert.equal(normalizeMaxSize(104), 112);
    assert.equal(normalizeMaxSize(105), 112);
    assert.equal(normalizeMaxSize(Number.NaN), DEFAULT_CONFIG.maxSize);
});

test("edgeSize stays inside the geometry array", () => {
    // The render controller indexes `Array.models[v.type]` with edgeSize - 1,
    // so anything outside 1..5 would select a missing geometry.
    assert.equal(normalizeEdgeSize(0), 1);
    assert.equal(normalizeEdgeSize(1), 1);
    assert.equal(normalizeEdgeSize(5), 5);
    assert.equal(normalizeEdgeSize(9), 5);
    assert.equal(normalizeEdgeSize(2.6), 3);
});

test("turnOff stays a valid TURN_OFF_LIST index", () => {
    assert.equal(normalizeTurnOff(0), 0);
    assert.equal(normalizeTurnOff(TURN_OFF_LIST.length), TURN_OFF_LIST.length - 1);
    assert.equal(normalizeTurnOff(-4), 0);
    assert.equal(normalizeTurnOff(2.4), 2);
});

test("every function type in the list resolves to a string", () => {
    for (const value of FUNCTION_LIST)
        assert.ok(isFunctionType(value), `${value} should be a valid function type`);
    assert.ok(FUNCTION_LIST.includes("off"));
    assert.equal(TURN_OFF_LIST.length, 5);
});

test("a world Max Size cap wins over a saved config", () => {
    const saved = sanitizeConfig({ maxSize: 1024 });
    assert.equal(saved.maxSize, 1024);

    const capped = sanitizeConfig({ maxSize: 1024 }, { maxSizeCap: 128 });
    assert.equal(capped.maxSize, 128, "the cap is applied on read");

    // ... and a cap that is not on the 16 step is normalised first.
    assert.equal(sanitizeConfig({ maxSize: 1024 }, { maxSizeCap: 100 }).maxSize, 96);
    assert.equal(sanitizeConfig({}, { maxSizeCap: 5 }).maxSize, 16, "never below the minimum");
    assert.equal(sanitizeConfig({ maxSize: 32 }, { maxSizeCap: 512 }).maxSize, 32, "a larger cap changes nothing");
    assert.equal(sanitizeConfig({ maxSize: 32 }, {}).maxSize, 32, "no cap, no change");
});

test("a world default function is the base a saved config overrides", () => {
    assert.equal(sanitizeConfig({}, { defaultFunction: "3x3_tunnel" }).functionType, "3x3_tunnel");
    assert.equal(sanitizeConfig({ functionType: "escape_tunnel" }, { defaultFunction: "3x3_tunnel" }).functionType, "escape_tunnel");
    assert.equal(sanitizeConfig({}, { defaultFunction: "not_a_function" }).functionType, DEFAULT_CONFIG.functionType);
    assert.equal(sanitizeConfig({}, {}).functionType, DEFAULT_CONFIG.functionType);
});

test("normalizeWorldConfig keeps only valid fields", () => {
    assert.deepEqual(normalizeWorldConfig(undefined), {});
    assert.deepEqual(normalizeWorldConfig("junk"), {});
    assert.deepEqual(normalizeWorldConfig({ maxSizeCap: "big", defaultFunction: 7 }), {});
    assert.deepEqual(normalizeWorldConfig({ maxSizeCap: 5000 }), { maxSizeCap: 1024 });
    assert.deepEqual(normalizeWorldConfig({ maxSizeCap: 100 }), { maxSizeCap: 96 });
    assert.deepEqual(normalizeWorldConfig({ defaultFunction: "escape_tunnel" }), { defaultFunction: "escape_tunnel" });
    assert.deepEqual(normalizeWorldConfig({ maxSizeCap: 64, defaultFunction: "all", extra: true }), { maxSizeCap: 64, defaultFunction: "all" });
});
