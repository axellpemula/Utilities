import { world } from "@minecraft/server";

/**
 * Single access point for the loot table manager.
 *
 * It used to live on `events/runInterval.js` as an exported `let` that became
 * valid only after a `system.run()` callback, while `functions/break.js`
 * imported it through a circular import chain. Anything that ran first got
 * `undefined.generateLootFromBlock(...)`.
 */

/** @type {import("@minecraft/server").LootTableManager | undefined} */
let manager;

/** @returns {import("@minecraft/server").LootTableManager | undefined} */
export function getLootManager() {
    if (manager) return manager;
    try {
        manager = world.getLootTableManager();
    }
    catch {
        manager = undefined;
    }
    return manager;
}

/**
 * Loot for a block, never throwing (an invalid block, an unloaded chunk or a
 * block without a loot table used to abort the whole break job).
 * @param {import("@minecraft/server").Block} block
 * @param {import("@minecraft/server").ItemStack} [item]
 * @returns {import("@minecraft/server").ItemStack[]}
 */
export function generateLoot(block, item) {
    const lootManager = getLootManager();
    if (!lootManager || !block || !block.isValid) return [];
    try {
        return lootManager.generateLootFromBlock(block, item) ?? [];
    }
    catch {
        return [];
    }
}

/**
 * Type ids already seen to produce loot. Only positive results are cached: a
 * roll based drop (leaves) can legitimately return nothing, and caching that
 * would permanently hide the preview for that block type.
 * @type {Set<string>}
 */
const lootableTypes = new Set();

/**
 * True when breaking `block` would drop something. Used by the edge preview so
 * it does not simulate a loot table every 5 ticks for the same block types.
 * @param {import("@minecraft/server").Block} block
 * @param {import("@minecraft/server").ItemStack} [item]
 * @returns {boolean}
 */
export function hasAnyLoot(block, item) {
    if (!block || !block.isValid) return false;
    const typeId = block.typeId;
    if (!typeId || typeId === "minecraft:air") return false;
    if (lootableTypes.has(typeId)) return true;
    const loot = generateLoot(block, item);
    if (loot.length > 0) lootableTypes.add(typeId);
    return loot.length > 0;
}
