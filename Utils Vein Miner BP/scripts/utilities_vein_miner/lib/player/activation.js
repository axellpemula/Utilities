/**
 * When vein mining may run.
 *
 * Kept free of engine imports (only plain objects and the item object the
 * caller already holds) so the rules can be unit tested.
 */

/** Dynamic property that marks an item as a Vein Miner tool. */
export const TOOL_MARK = "utilities_vein_miner:marked_tool";

/**
 * @param {unknown} item an `ItemStack`
 * @returns {boolean}
 */
export function isMarkedTool(item) {
    try {
        // `getDynamicProperty` returns undefined for an unmarked item and throws
        // for an item the engine no longer tracks.
        return /** @type {any} */ (item)?.getDynamicProperty?.(TOOL_MARK) === true;
    }
    catch {
        return false;
    }
}

/**
 * @param {unknown} item an `ItemStack`
 * @returns {boolean}
 */
export function isPickaxe(item) {
    try {
        return /** @type {any} */ (item)?.getTags?.().includes("minecraft:is_pickaxe") === true;
    }
    catch {
        return false;
    }
}

/**
 * Whether vein mining (and its preview) is active for this player right now.
 *
 * - Sneaking always works, exactly like before this setting existed.
 * - With "Require Sneaking" off the tool has to be a pickaxe, so digging dirt
 *   with a shovel never starts a vein.
 * - With "Only Marked Tools" on, the held tool must carry `TOOL_MARK`.
 *
 * @param {{ isSneaking?: boolean }} player
 * @param {{ requireSneak?: boolean, markedToolsOnly?: boolean }} config
 * @param {unknown} item the item in the main hand, if any
 * @returns {boolean}
 */
export function isMiningActive(player, config, item) {
    if (!config) return false;
    if (config.markedToolsOnly && !isMarkedTool(item)) return false;
    if (player?.isSneaking === true) return true;
    if (config.requireSneak !== false) return false;
    return isPickaxe(item);
}
