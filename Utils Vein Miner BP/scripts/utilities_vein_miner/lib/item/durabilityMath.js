/**
 * Pure durability math, kept free of imports so it can be unit tested.
 *
 * Vanilla Unbreaking gives a `1 / (level + 1)` chance to skip durability loss
 * per use, so a tool lasts `remaining * (level + 1)` uses on average.
 */

/**
 * @param {number} remaining durability points left
 * @param {number} [unbreakingLevel]
 * @returns {number} expected number of blocks this tool can still break
 */
export function effectiveBlocks(remaining, unbreakingLevel = 0) {
    if (remaining === Infinity) return Infinity;
    if (typeof remaining !== "number" || !Number.isFinite(remaining)) return 0;
    const level = Math.max(Math.floor(unbreakingLevel) || 0, 0);
    return Math.max(remaining, 0) * (level + 1);
}

/**
 * Rolls the durability actually consumed for `blockCount` blocks.
 *
 * The previous implementation used `Math.floor(count * 1 / (level + 1))`, which
 * always rounded a small vein's damage down to zero.
 * @param {number} blockCount
 * @param {number} [unbreakingLevel]
 * @param {() => number} [random] injectable RNG for tests
 * @returns {number} durability points to remove
 */
export function rollDamage(blockCount, unbreakingLevel = 0, random = Math.random) {
    const count = Math.max(Math.floor(blockCount) || 0, 0);
    const level = Math.max(Math.floor(unbreakingLevel) || 0, 0);
    if (level === 0) return count;
    const consumeChance = 1 - 1 / (level + 1);
    let damage = 0;
    for (let i = 0; i < count; i++)
        if (random() < consumeChance) damage++;
    return damage;
}

/**
 * Durability that may actually be spent, after keeping `reserve` points back
 * for "Protect My Tool".
 * @param {number} remaining durability points left
 * @param {number} [reserve]
 * @returns {number}
 */
export function remainingForUse(remaining, reserve = 0) {
    if (remaining === Infinity) return Infinity;
    if (typeof remaining !== "number" || !Number.isFinite(remaining)) return 0;
    const keep = Math.max(Math.floor(reserve) || 0, 0);
    return Math.max(remaining - keep, 0);
}
