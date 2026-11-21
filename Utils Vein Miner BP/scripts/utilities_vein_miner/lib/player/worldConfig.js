import { world } from "@minecraft/server";
import { normalizeWorldConfig } from "./options";

const WORLD_KEY = "utilities_vein_miner:world_config";

/**
 * World wide defaults and limits (operator settings).
 *
 * Stored on the world so a realm/server keeps them across sessions and every
 * player is clamped the same way. Read once and cached; call `refresh()` after
 * writing through another path.
 *
 * @see normalizeWorldConfig for the accepted shape
 */
export const apiWorldConfig = new class ApiWorldConfig {
    constructor() {
        /** @type {import("./options").WorldConfig | undefined} */
        this.cache = undefined;
        /** @type {((value: import("./options").WorldConfig) => void)[]} */
        this.listeners = [];
    }

    /**
     * @returns {import("./options").WorldConfig}
     */
    read() {
        try {
            const stored = world.getDynamicProperty(WORLD_KEY);
            if (typeof stored !== "string") return {};
            return normalizeWorldConfig(JSON.parse(stored));
        }
        catch {
            // A corrupt or hand edited world property must never lock players out.
            return {};
        }
    }

    /**
     * @returns {import("./options").WorldConfig}
     */
    get() {
        if (this.cache === undefined) this.cache = this.read();
        return this.cache;
    }

    /**
     * The Max Size every player is clamped to, or undefined when unlimited.
     * @returns {number | undefined}
     */
    get maxSizeCap() {
        return this.get().maxSizeCap;
    }

    /**
     * Merges `patch` into the stored settings (`undefined` clears a field) and
     * tells everyone who cached a derived value about it.
     * @param {import("./options").WorldConfig} patch
     * @returns {import("./options").WorldConfig}
     */
    set(patch) {
        const merged = { ...this.read(), ...patch };
        for (const key of Object.keys(merged))
            if (merged[key] === undefined) delete merged[key];
        const next = normalizeWorldConfig(merged);
        this.cache = next;
        try {
            world.setDynamicProperty(WORLD_KEY, JSON.stringify(next));
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] failed to save world settings: ${error}`);
        }
        this.notify();
        return next;
    }

    clear() {
        this.cache = undefined;
        try {
            world.setDynamicProperty(WORLD_KEY, undefined);
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] failed to clear world settings: ${error}`);
        }
        this.notify();
    }

    /**
     * @param {(value: import("./options").WorldConfig) => void} listener
     */
    onChange(listener) {
        this.listeners.push(listener);
    }

    notify() {
        const value = this.get();
        for (const listener of this.listeners) {
            try {
                listener(value);
            }
            catch (error) {
                console.warn(`[utilities_vein_miner] world settings listener failed: ${error}`);
            }
        }
    }
};
