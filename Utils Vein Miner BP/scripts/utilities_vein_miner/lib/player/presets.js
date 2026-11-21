import { sanitizeConfig } from "./options";

/**
 * Ready made bundles of settings, applied with `/uvm:veinminer_preset`.
 *
 * A preset only touches the fields it names; everything else keeps whatever the
 * player already chose.
 * @type {Readonly<Record<string, Record<string, any>>>}
 */
export const PRESETS = Object.freeze({
    /** Ore hunting: connected veins only, every ore, plenty of blocks. */
    miner: Object.freeze({
        functionType: "all",
        onlyOre: true,
        onlyLog: false,
        autoAll: true,
        maxSize: 256,
        protectTool: true,
        showSelection: true
    }),
    /** Careful digging in a build: small tunnel, preview on, tool protected. */
    builder: Object.freeze({
        functionType: "3x3_tunnel_small",
        onlyOre: false,
        onlyLog: false,
        showSelection: true,
        protectTool: true,
        cancelNoDrop: true,
        maxSize: 64
    }),
    /** Tree felling: logs only, whole canopy trunk, big cap. */
    lumberjack: Object.freeze({
        functionType: "all",
        onlyOre: false,
        onlyLog: true,
        autoAll: false,
        maxSize: 512,
        showSelection: true
    }),
    /** Back to plain mining without the add-on doing anything. */
    off: Object.freeze({
        functionType: "off"
    })
});

/** @type {readonly string[]} */
export const PRESET_LIST = Object.freeze(Object.keys(PRESETS));

/**
 * @param {string} name
 * @returns {string | undefined} a valid preset name
 */
export function normalizePresetName(name) {
    return typeof name === "string" && PRESET_LIST.includes(name) ? name : undefined;
}

/**
 * @param {any} config the player's current configuration
 * @param {string} name
 * @returns {any} a new, sanitized configuration, or undefined for an unknown preset
 */
export function applyPreset(config, name) {
    const preset = PRESETS[normalizePresetName(name) ?? ""];
    if (!preset) return undefined;
    return sanitizeConfig({ ...config, ...preset });
}
