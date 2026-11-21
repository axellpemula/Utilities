/**
 * Configuration schema, option lists and validation/normalisation helpers.
 *
 * Kept free of `@minecraft/server` imports (and of any relative imports) so the
 * validation rules can be unit tested in `tests/options.test.js`.
 */

/** @type {readonly string[]} */
export const FUNCTION_LIST = Object.freeze([
    "off",
    "all",
    "1x1_tunnel",
    "1x2_tunnel",
    "1x3_tunnel",
    "3x2_tunnel",
    "3x2_tunnel_small",
    "3x3_tunnel",
    "3x3_tunnel_small",
    "mining_tunnel",
    "escape_tunnel"
]);

/** @type {readonly string[]} */
export const TURN_OFF_LIST = Object.freeze(["no", "1_minute", "2_minute", "5_minute", "10_minute"]);

/**
 * Inactivity intervals in "update ticks". The timer is polled every 200 ticks
 * (10 s), so index 1 -> 6 * 10 s = 1 minute.
 * @type {readonly number[]}
 */
export const TURN_OFF_INTERVALS = Object.freeze([-1, 6, 12, 30, 60]);

export const MAX_SIZE_MIN = 16;
export const MAX_SIZE_MAX = 1024;
export const MAX_SIZE_STEP = 16;
export const EDGE_SIZE_MIN = 1;
export const EDGE_SIZE_MAX = 5;

/**
 * Defaults for every player that has not saved a configuration yet.
 * Frozen: `apiConfig.get()` must hand out per player copies, never this object.
 */
export const DEFAULT_CONFIG = Object.freeze({
    showSelection: false,
    functionType: "all",
    turnOff: 0,
    showInfo: true,
    maxSize: 64,
    edgeSize: 3,
    quick: false,
    cancelNoDrop: true,
    autoAll: true,
    onlyOre: false,
    onlyLog: false,
    accuracy: false,
    cancelOpenItem: false,
    connectedDiagonals: true,
    // Activation
    requireSneak: true,
    markedToolsOnly: false,
    // Safety
    protectTool: false,
    // Per tool overrides (stored on the item, see lib/item/toolProfile.js)
    toolProfile: false
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFunctionType(value) {
    return typeof value === "string" && FUNCTION_LIST.includes(value);
}

/**
 * @param {number} index
 * @returns {string} a valid function type (falls back to the default).
 */
export function functionTypeFromIndex(index) {
    const value = Number.isInteger(index) ? FUNCTION_LIST[index] : undefined;
    return isFunctionType(value) ? value : DEFAULT_CONFIG.functionType;
}

/**
 * Accepts either a function type name or a dropdown index.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeFunctionType(value) {
    if (isFunctionType(value)) return value;
    if (typeof value === "number") return functionTypeFromIndex(value);
    return DEFAULT_CONFIG.functionType;
}

/**
 * @param {number} value
 * @returns {number} aligned to the slider (min 16, max 1024, step 16).
 */
export function normalizeMaxSize(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.maxSize;
    const stepped = Math.round(value / MAX_SIZE_STEP) * MAX_SIZE_STEP;
    return Math.min(Math.max(stepped, MAX_SIZE_MIN), MAX_SIZE_MAX);
}

/**
 * @param {number} value
 * @returns {number} 1..5
 */
export function normalizeEdgeSize(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.edgeSize;
    return Math.min(Math.max(Math.round(value), EDGE_SIZE_MIN), EDGE_SIZE_MAX);
}

/**
 * @param {number} value
 * @returns {number} index into `TURN_OFF_LIST`
 */
export function normalizeTurnOff(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_CONFIG.turnOff;
    return Math.min(Math.max(Math.round(value), 0), TURN_OFF_LIST.length - 1);
}

/**
 * World wide defaults and limits, set by an operator through
 * `/uvm:veinminer_limit` and `/uvm:veinminer_default`.
 *
 * Either field may be missing: `maxSizeCap` clamps every player's Max Size,
 * `defaultFunction` is what a player without a saved configuration starts with.
 * @typedef {{ maxSizeCap?: number, defaultFunction?: string }} WorldConfig
 */

/**
 * @param {unknown} raw
 * @returns {WorldConfig} only the fields that are valid
 */
export function normalizeWorldConfig(raw) {
    /** @type {WorldConfig} */
    const result = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    const source = /** @type {any} */ (raw);
    if (typeof source.maxSizeCap === "number" && Number.isFinite(source.maxSizeCap))
        result.maxSizeCap = normalizeMaxSize(source.maxSizeCap);
    if (isFunctionType(source.defaultFunction))
        result.defaultFunction = source.defaultFunction;
    return result;
}

/**
 * Turns anything (corrupt JSON, an older schema, a hand edited dynamic
 * property) into a complete, in range configuration object.
 *
 * Unknown/invalid fields fall back to their default instead of discarding the
 * whole saved configuration, so adding a field in a later release no longer
 * resets every player's settings.
 * @param {unknown} raw
 * @param {WorldConfig} [world] world defaults / limits, see `normalizeWorldConfig`
 * @returns {typeof DEFAULT_CONFIG}
 */
export function sanitizeConfig(raw, world) {
    const limits = normalizeWorldConfig(world);
    const result = { ...DEFAULT_CONFIG };
    // The world default is only the starting point: a saved value still wins.
    if (limits.defaultFunction) result.functionType = limits.defaultFunction;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        if (limits.maxSizeCap !== undefined) result.maxSize = Math.min(result.maxSize, limits.maxSizeCap);
        return result;
    }

    for (const key of Object.keys(DEFAULT_CONFIG)) {
        const fallback = DEFAULT_CONFIG[key];
        const value = raw[key];
        if (typeof value === typeof fallback) result[key] = value;
    }

    result.functionType = normalizeFunctionType(result.functionType);
    result.maxSize = normalizeMaxSize(result.maxSize);
    result.edgeSize = normalizeEdgeSize(result.edgeSize);
    result.turnOff = normalizeTurnOff(result.turnOff);
    // A world cap always wins, even over a value the player picked earlier.
    if (limits.maxSizeCap !== undefined)
        result.maxSize = Math.min(result.maxSize, limits.maxSizeCap);
    return result;
}
