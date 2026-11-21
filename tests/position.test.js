import { test } from "node:test";
import assert from "node:assert/strict";
import { positionKey, positionKeyOf, OFFSETS_6, OFFSETS_26 } from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/util/position.js";

test("positionKey is unique for the coordinates the old bit packing aliased", () => {
    // These pairs all collided with `(x << 20) ^ (y << 10) ^ z`.
    const collisions = [
        [[0, -1, 0], [0, 0, -1024]],
        [[0, 0, 0], [4096, 0, 0]],
        [[0, 0, 0], [8192, 0, 0]],
        [[0, 64, 0], [0, 0, 65536]]
    ];
    for (const [[x1, y1, z1], [x2, y2, z2]] of collisions)
        assert.notEqual(positionKey(x1, y1, z1), positionKey(x2, y2, z2));
});

test("positionKey keeps negative coordinates distinct", () => {
    const seen = new Set();
    for (let x = -2; x <= 2; x++)
        for (let y = -2; y <= 2; y++)
            for (let z = -2; z <= 2; z++)
                seen.add(positionKey(x, y, z));
    assert.equal(seen.size, 5 * 5 * 5);
});

test("positionKeyOf matches positionKey", () => {
    assert.equal(positionKeyOf({ x: 1, y: -60, z: 3 }), positionKey(1, -60, 3));
});

test("OFFSETS_6 has the six face neighbours and no duplicates", () => {
    assert.equal(OFFSETS_6.length, 6);
    assert.equal(new Set(OFFSETS_6.map(([x, y, z]) => positionKey(x, y, z))).size, 6);
    for (const offset of OFFSETS_6)
        assert.equal(Math.abs(offset[0]) + Math.abs(offset[1]) + Math.abs(offset[2]), 1);
});

test("OFFSETS_26 contains every neighbour but the origin exactly once", () => {
    assert.equal(OFFSETS_26.length, 26);
    assert.equal(new Set(OFFSETS_26.map(([x, y, z]) => positionKey(x, y, z))).size, 26);
    assert.ok(!OFFSETS_26.some(([x, y, z]) => x === 0 && y === 0 && z === 0));
    for (const [x, y, z] of OFFSETS_26) {
        assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1 && Math.abs(z) <= 1);
    }
    // The 6 axis offsets must be part of the 26 neighbourhood.
    for (const offset of OFFSETS_6)
        assert.ok(OFFSETS_26.some(([x, y, z]) => x === offset[0] && y === offset[1] && z === offset[2]));
});
