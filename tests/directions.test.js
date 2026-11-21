import { test } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_FACE_DIRECTIONS,
    faceDirectionIndex,
    stairsDirectionIndex,
    tunnelBounds,
    tunnelSpace,
    isInsideTunnel
} from "../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/block/directions.js";

test("hitting a face tunnels away from the player", () => {
    // Standing north of a block (looking at its north face) means digging south.
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("North")], { x: 0, y: 0, z: 1 });
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("South")], { x: 0, y: 0, z: -1 });
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("East")], { x: -1, y: 0, z: 0 });
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("West")], { x: 1, y: 0, z: 0 });
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("Up")], { x: 0, y: -1, z: 0 });
    assert.deepEqual(DEFAULT_FACE_DIRECTIONS[faceDirectionIndex("Down")], { x: 0, y: 1, z: 0 });
});

test("unknown faces fall back to north instead of crashing", () => {
    assert.equal(faceDirectionIndex(undefined), 0);
    assert.equal(faceDirectionIndex("Sideways"), 0);
});

test("stairsDirectionIndex maps the four quadrants and stays in range", () => {
    // rotation.y is -180..180; +180 normalises to 0..360.
    // The original comparison chain sent exactly 45/135/315 degrees to "west".
    assert.equal(stairsDirectionIndex(0), 2);
    assert.equal(stairsDirectionIndex(-90), 1);
    assert.equal(stairsDirectionIndex(180), 0);
    assert.equal(stairsDirectionIndex(90), 3);
    for (let yaw = -180; yaw <= 180; yaw += 5) {
        const index = stairsDirectionIndex(yaw);
        assert.ok(index >= 0 && index <= 3, `yaw ${yaw} -> ${index}`);
        assert.ok(DEFAULT_FACE_DIRECTIONS[index]);
    }
});

test("stairsDirectionIndex returns a direction for the plain cardinals", () => {
    assert.equal(stairsDirectionIndex(0), 2);
    assert.equal(stairsDirectionIndex(90), 3);
    assert.equal(stairsDirectionIndex(180), 0);
    assert.equal(stairsDirectionIndex(270), 1);
});

test("tunnelBounds matches the configured shapes", () => {
    assert.deepEqual(tunnelBounds(1, 1), { maxWidth: 0, maxHeight: 0, maxDepth: Infinity, is1x2: false });
    assert.deepEqual(tunnelBounds(3, 3), { maxWidth: 1, maxHeight: 1, maxDepth: Infinity, is1x2: false });
    assert.deepEqual(tunnelBounds(3, 2), { maxWidth: 1, maxHeight: 1, maxDepth: Infinity, is1x2: true });
    assert.deepEqual(tunnelBounds(3, 2, 1), { maxWidth: 1, maxHeight: 1, maxDepth: 0, is1x2: true });
});

test("tunnelSpace projects onto the tunnel axis for horizontal faces", () => {
    for (const direction of DEFAULT_FACE_DIRECTIONS.slice(0, 4)) {
        // One block in front of the origin is exactly one block deep.
        const ahead = tunnelSpace({ x: direction.x, y: 0, z: direction.z }, direction);
        assert.equal(ahead.depth, 1);
        assert.equal(ahead.sideA, 0);
        assert.equal(ahead.sideB, 0);
        // One block behind the origin is negative depth (excluded).
        const behind = tunnelSpace({ x: -direction.x, y: 0, z: -direction.z }, direction);
        assert.equal(behind.depth, -1);
    }
});

test("tunnelSpace handles vertical directions", () => {
    const up = DEFAULT_FACE_DIRECTIONS[4];
    const space = tunnelSpace({ x: -1, y: 2, z: 3 }, up);
    assert.equal(space.depth, 2);
    assert.equal(space.sideA, -1);
    assert.equal(space.sideB, 3);
});

test("1x1 tunnels accept only the block in front", () => {
    const direction = DEFAULT_FACE_DIRECTIONS[0];
    const bounds = tunnelBounds(1, 1);
    const inside = (x, y, z) => isInsideTunnel(tunnelSpace({ x, y, z }, direction), bounds, false);
    assert.equal(inside(0, 0, -1), true);
    assert.equal(inside(1, 0, -1), false, "side block must be excluded");
    assert.equal(inside(0, 1, -1), false, "block above must be excluded");
    assert.equal(inside(0, 0, 1), false, "behind the origin must be excluded");
});

test("3x3 tunnels accept the full 3x3 cross section ahead", () => {
    const direction = DEFAULT_FACE_DIRECTIONS[0];
    const bounds = tunnelBounds(3, 3);
    const inside = (x, y, z) => isInsideTunnel(tunnelSpace({ x, y, z }, direction), bounds, false);
    for (const x of [-1, 0, 1])
        for (const y of [-1, 0, 1])
            assert.equal(inside(x, y, -1), true, `(${x},${y}) should be inside`);
    assert.equal(inside(2, 0, -1), false);
    assert.equal(inside(0, 2, -1), false);
});

test("1x2 tunnels stay below the eye line", () => {
    const direction = DEFAULT_FACE_DIRECTIONS[0];
    const bounds = tunnelBounds(3, 2);
    const inside = (x, y, z) => isInsideTunnel(tunnelSpace({ x, y, z }, direction), bounds, false);
    assert.equal(inside(0, 0, -1), true);
    assert.equal(inside(0, -1, -1), true);
    assert.equal(inside(0, 1, -1), false);
});

test("depth limited tunnels stop after the configured depth", () => {
    const direction = DEFAULT_FACE_DIRECTIONS[0];
    const bounds = tunnelBounds(3, 2, 1);
    assert.equal(isInsideTunnel(tunnelSpace({ x: 0, y: 0, z: -1 }, direction), bounds, false), false);
    assert.equal(isInsideTunnel(tunnelSpace({ x: 0, y: 0, z: 0 }, direction), bounds, false), true);
});

test("vertical tunnels use maxWidth on both horizontal axes", () => {
    const direction = DEFAULT_FACE_DIRECTIONS[4];
    const bounds = tunnelBounds(3, 3);
    assert.equal(isInsideTunnel(tunnelSpace({ x: 1, y: 1, z: 1 }, direction), bounds, true), true);
    assert.equal(isInsideTunnel(tunnelSpace({ x: 2, y: 1, z: 0 }, direction), bounds, true), false);
});
