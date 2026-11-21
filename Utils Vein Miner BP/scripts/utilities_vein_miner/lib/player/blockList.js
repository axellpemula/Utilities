import { worksOnlyOres } from "../../variables";

/**
 * A per-player list of block ids, stored as a JSON array in a dynamic
 * property. Shared by "Delete Blocks" (mine without drops) and "Never Mine".
 */
export class BlockList {
    /**
     * @param {string} key dynamic property name
     * @param {string[]} choices block ids offered in the panel
     */
    constructor(key, choices) {
        this.key = key;
        this.allBlocks = choices;
        /** @type {Map<string, Set<string>>} */
        this.cache = new Map();
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @returns {Set<string>}
     */
    get(player) {
        const cached = this.cache.get(player.id);
        if (cached) return cached;
        const blocks = this.read(player);
        this.cache.set(player.id, blocks);
        return blocks;
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @returns {Set<string>}
     */
    read(player) {
        let stored;
        try {
            stored = player.getDynamicProperty(this.key);
        }
        catch {
            return new Set();
        }
        if (typeof stored !== "string") return new Set();
        try {
            const parsed = JSON.parse(stored);
            // A corrupt or hand edited value must not silently enable
            // "delete every block" - fall back to "not configured".
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.filter(value => typeof value === "string"));
        }
        catch {
            return new Set();
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {Iterable<string>} value
     */
    set(player, value) {
        const blocks = new Set(value);
        this.cache.set(player.id, blocks);
        try {
            player.setDynamicProperty(this.key, JSON.stringify([...blocks]));
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] failed to save ${this.key} for ${player.id}: ${error}`);
        }
    }

    /**
     * @param {import("@minecraft/server").Player | string} player
     */
    clear(player) {
        this.cache.delete(typeof player === "string" ? player : player.id);
    }
}

/**
 * Puts the blocks a player is most likely to look for first, the rest follows
 * in catalog order, so the list can never drift away from the ids the vein
 * miner actually accepts.
 *
 * @param {string[]} priority block names, without the `minecraft:` namespace
 * @param {Iterable<string>} [ids] the full catalog
 * @returns {string[]}
 */
export function buildBlockChoices(priority, ids = worksOnlyOres) {
    const all = [...ids];
    const first = priority.map(name => `minecraft:${name}`).filter(id => all.includes(id));
    return [...first, ...all.filter(id => !first.includes(id))];
}
