import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveBlocks, rollDamage } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/item/durabilityMath.js";

test("unbreaking multiplies the usable durability by level + 1", () => {
    // The old formula was `remaining + remaining / (1 / (level + 1))`, i.e.
    // level + 2: 300 blocks at Unbreaking I and 500 at III.
    assert.equal(effectiveBlocks(100, 0), 100);
    assert.equal(effectiveBlocks(100, 1), 200);
    assert.equal(effectiveBlocks(100, 2), 300);
    assert.equal(effectiveBlocks(100, 3), 400);
});

test("items without durability report Infinity", () => {
    assert.equal(effectiveBlocks(Infinity), Infinity);
    assert.equal(effectiveBlocks(Infinity, 3), Infinity);
});

test("zero and negative remaining durability report nothing usable", () => {
    assert.equal(effectiveBlocks(0, 3), 0);
    assert.equal(effectiveBlocks(-5), 0);
    assert.equal(effectiveBlocks(Number.NaN), 0);
});

test("without unbreaking every block costs one point", () => {
    assert.equal(rollDamage(1, 0), 1);
    assert.equal(rollDamage(64, 0), 64);
    assert.equal(rollDamage(0, 0), 0);
});

test("unbreaking rolls per block instead of flooring to zero", () => {
    // Always consume: chance is 1 / (level + 1) to keep, so random() < 0.75 consumes at III.
    assert.equal(rollDamage(10, 3, () => 0), 10);
    // Never consume.
    assert.equal(rollDamage(10, 3, () => 0.99), 0);
    // One block, Unbreaking III: still a 75% chance to consume, never "floor to 0".
    const consumed = rollDamage(4, 3, (() => {
        const values = [0.1, 0.5, 0.9, 0.2];
        let index = 0;
        return () => values[index++ % values.length];
    })());
    assert.equal(consumed, 3);
});

test("rollDamage never damages more blocks than it was given", () => {
    for (const level of [0, 1, 2, 3, 4]) {
        for (const count of [0, 1, 5, 64]) {
            const damage = rollDamage(count, level);
            assert.ok(damage >= 0 && damage <= count, `level ${level} count ${count} -> ${damage}`);
        }
    }
});
