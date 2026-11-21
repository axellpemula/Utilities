/**
 * Helpers for turning a block position into a stable, collision free key.
 *
 * The old implementation packed coordinates with
 * `(x << 20) ^ (y << 10) ^ z`, which is NOT injective:
 *   (4096, 0, 0)   -> 0
 *   (0, -1, 0)     -> -1024
 *   (0, 0, -1024)  -> -1024
 * JS bitwise operators also truncate to 32 bits, so far away coordinates alias
 * onto nearby ones. That made the BFS `visited` set skip real blocks and made
 * the preview scan report false neighbours.
 *
 * This module intentionally has no imports so it can be unit tested outside of
 * Minecraft.
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {string}
 */
export function positionKey(x, y, z) {
    return `${x},${y},${z}`;
}

/**
 * @param {{x: number, y: number, z: number}} location
 * @returns {string}
 */
export function positionKeyOf(location) {
    return positionKey(location.x, location.y, location.z);
}

/**
 * Offsets of the 6 face neighbours, in the order used by `defaultFaceDirection`.
 * @type {ReadonlyArray<ReadonlyArray<number>>}
 */
export const OFFSETS_6 = Object.freeze([
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
]);

/**
 * Offsets of the 26 surrounding blocks (used by "connected diagonals").
 * @type {ReadonlyArray<ReadonlyArray<number>>}
 */
export const OFFSETS_26 = Object.freeze([
    ...OFFSETS_6,
    [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
    [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
    [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
]);
