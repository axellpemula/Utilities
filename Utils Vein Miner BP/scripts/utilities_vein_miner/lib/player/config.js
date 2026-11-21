import { sanitizeConfig } from "./options";
import { apiWorldConfig } from "./worldConfig";

const CONFIG_KEY = "utilities_vein_miner:config_info";

/** @type {Map<string, ReturnType<typeof sanitizeConfig>>} */
const configCache = new Map();

// A new world default or Max Size cap applies to every cached configuration,
// so drop them all instead of waiting for the players to rejoin.
apiWorldConfig.onChange(() => configCache.clear());

export const apiConfig = new class ApiConfig {
    /**
     * Cached, per player configuration object.
     *
     * Always returns a fresh copy of the defaults for players without a saved
     * config - it used to return the module level `defaultConfig` object
     * itself, so the first player to use `/uvm:veinminer <type>` (or the
     * settings panel) mutated the defaults for everybody.
     * @param {import("@minecraft/server").Player} player
     * @returns {ReturnType<typeof sanitizeConfig>}
     */
    get(player) {
        const cached = configCache.get(player.id);
        if (cached) return cached;
        const config = sanitizeConfig(this.read(player), apiWorldConfig.get());
        configCache.set(player.id, config);
        return config;
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @returns {unknown} the raw stored value, or undefined when unset/corrupt
     */
    read(player) {
        try {
            const stored = player.getDynamicProperty(CONFIG_KEY);
            if (typeof stored !== "string") return undefined;
            return JSON.parse(stored);
        }
        catch {
            return undefined;
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {unknown} config
     * @returns {ReturnType<typeof sanitizeConfig>} the sanitised config that was stored
     */
    set(player, config) {
        // The world cap is applied on the way in too, so a player can never
        // store a size the operator forbade.
        const clean = sanitizeConfig(config, apiWorldConfig.get());
        configCache.set(player.id, clean);
        try {
            player.setDynamicProperty(CONFIG_KEY, JSON.stringify(clean));
        }
        catch (error) {
            // Do not let a rejected write (read-only context, oversized value)
            // break the interaction that triggered it, but leave a trace.
            console.warn(`[utilities_vein_miner] failed to save config for ${player.id}: ${error}`);
        }
        return clean;
    }

    /**
     * @param {import("@minecraft/server").Player | string} player
     */
    clear(player) {
        configCache.delete(typeof player === "string" ? player : player.id);
    }

    /**
     * Drops every cached configuration, e.g. after the world defaults or the
     * Max Size cap changed. The next read re-applies them.
     */
    clearAll() {
        configCache.clear();
    }
};
