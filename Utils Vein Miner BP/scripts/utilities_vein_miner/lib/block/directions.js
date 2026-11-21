/**
 * Pure direction / tunnel geometry helpers.
 *
 * No imports on purpose: this is the trickiest math in the add-on and it is
 * covered by `tests/directions.test.js` outside of Minecraft.
 */

/**
 * Direction a tunnel advances into, indexed by the face the player is looking
 * at. Index order is north, east, south, west, up, down.
 * @type {ReadonlyArray<{x: number, y: number, z: number}>}
 */
export const DEFAULT_FACE_DIRECTIONS = Object.freeze([
    Object.freeze({ x: 0, y: 0, z: -1 }),
    Object.freeze({ x: 1, y: 0, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: 1 }),
    Object.freeze({ x: -1, y: 0, z: 0 }),
    Object.freeze({ x: 0, y: 1, z: 0 }),
    Object.freeze({ x: 0, y: -1, z: 0 })
]);

/**
 * Face -> index inside `DEFAULT_FACE_DIRECTIONS`.
 * Hitting the north face means the player stands north of the block, so the
 * tunnel advances south (index 2).
 */
const FACE_INDEX = Object.freeze({
    North: 2,
    East: 3,
    South: 0,
    West: 1,
    Up: 5,
    Down: 4
});

/**
 * @param {string} [face] `BlockFace` value, e.g. "North".
 * @returns {number} index into `DEFAULT_FACE_DIRECTIONS` (0 = north when unknown).
 */
export function faceDirectionIndex(face) {
    return FACE_INDEX[face] ?? 0;
}

/**
 * Yaw (degrees, -180..180 as returned by `Entity.getRotation().y`) -> tunnel
 * direction index for the stairs shapes.
 *
 * Boundaries used to fall through to the "west" bucket because of strict
 * comparisons; this normalises the angle first.
 * @param {number} yaw
 * @returns {number}
 */
export function stairsDirectionIndex(yaw) {
    const normalized = (((yaw + 180) % 360) + 360) % 360;
    return Math.floor(((normalized + 45) % 360) / 90);
}

/**
 * @param {number} sideRange
 * @param {number} heightRange
 * @param {number} [depthRange]
 * @returns {{maxWidth: number, maxHeight: number, maxDepth: number, is1x2: boolean}}
 */
export function tunnelBounds(sideRange, heightRange, depthRange) {
    return {
        maxWidth: Math.floor(sideRange / 2),
        maxHeight: Math.floor(heightRange / 2),
        maxDepth: depthRange ? depthRange - 1 : Infinity,
        is1x2: heightRange === 2
    };
}

/**
 * Project an offset from the tunnel origin onto the tunnel axis.
 * `depth` grows into the tunnel, `sideA` is horizontal, `sideB` is vertical.
 * @param {{x: number, y: number, z: number}} distance offset from the origin
 * @param {{x: number, y: number, z: number}} direction
 * @returns {{depth: number, sideA: number, sideB: number}}
 */
export function tunnelSpace(distance, direction) {
    if (direction.y !== 0) {
        return {
            depth: distance.y * direction.y,
            sideA: distance.x,
            sideB: distance.z
        };
    }
    return {
        depth: distance.x * direction.x + distance.z * direction.z,
        sideA: distance.x * direction.z - distance.z * direction.x,
        sideB: distance.y
    };
}

/**
 * @param {{depth: number, sideA: number, sideB: number}} space
 * @param {{maxWidth: number, maxHeight: number, maxDepth: number, is1x2: boolean}} bounds
 * @param {boolean} isVertical
 * @returns {boolean}
 */
export function isInsideTunnel(space, bounds, isVertical) {
    if (space.depth < 0 || space.depth > bounds.maxDepth) return false;
    if (Math.abs(space.sideA) > bounds.maxWidth) return false;
    if (isVertical) return Math.abs(space.sideB) <= bounds.maxWidth;
    if (Math.abs(space.sideB) > bounds.maxHeight) return false;
    // 1x2 tunnels stay below the eye line, so sideB === 1 is excluded.
    return !(bounds.is1x2 && space.sideB === 1);
}
