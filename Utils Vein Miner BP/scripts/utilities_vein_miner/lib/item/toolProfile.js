import { isFunctionType, normalizeMaxSize } from "../player/options";

/** Item dynamic property holding a per-tool override, JSON encoded. */
export const TOOL_PROFILE = "utilities_vein_miner:tool_profile";

/**
 * @typedef {{ functionType?: string, maxSize?: number }} ToolProfile
 */

/**
 * @param {unknown} raw
 * @returns {ToolProfile | undefined} undefined when nothing usable is stored
 */
export function normalizeToolProfile(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const source = /** @type {any} */ (raw);
    /** @type {ToolProfile} */
    const profile = {};
    if (isFunctionType(source.functionType)) profile.functionType = source.functionType;
    if (typeof source.maxSize === "number" && Number.isFinite(source.maxSize))
        profile.maxSize = normalizeMaxSize(source.maxSize);
    return Object.keys(profile).length ? profile : undefined;
}

/**
 * @param {unknown} item an `ItemStack`
 * @returns {ToolProfile | undefined}
 */
export function readToolProfile(item) {
    try {
        const stored = /** @type {any} */ (item)?.getDynamicProperty?.(TOOL_PROFILE);
        if (typeof stored !== "string") return undefined;
        return normalizeToolProfile(JSON.parse(stored));
    }
    catch {
        // Unreadable property or an item the engine no longer tracks.
        return undefined;
    }
}

/**
 * Merges a tool's own function/size over the player configuration.
 *
 * Only the two shape fields are taken from the tool: everything else (edges,
 * timers, filters) stays attached to the player.
 * @param {any} config
 * @param {unknown} item the item in the main hand
 * @returns {any} the config to use, or the same object when nothing applies
 */
export function applyToolProfile(config, item) {
    if (!config?.toolProfile) return config;
    const profile = readToolProfile(item);
    if (!profile) return config;
    return { ...config, ...profile };
}
