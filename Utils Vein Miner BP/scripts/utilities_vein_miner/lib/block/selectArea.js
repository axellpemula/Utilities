import { system } from "@minecraft/server";
import { autoEnableAll } from "../../variables";
import { veinShapeGetStairs } from "./minerShape/getStairs";
import { veinShapeGetTunnel } from "./minerShape/getTunnel";
import { veinShapeGetAll } from "./minerShape/getAll";

/**
 * @param {any} info
 * @param {"all" | string} [customType] overrides `config.functionType`
 */
export function getBlocks(info, customType) {
    const { config } = info;
    const execute = minerFunctionManager[customType ?? config.functionType];
    if (execute) return execute(info);
}

/**
 * "Auto Function All": ores (and the other listed blocks) always use the
 * connected-vein shape, whatever the configured function is.
 *
 * Extracted because the same nested ternary used to be copy pasted in
 * `events/breakBlock.js`, `events/hitBlock.js` and `events/runInterval.js`.
 * @param {{autoAll: boolean}} config
 * @param {string | undefined} blockId
 * @returns {"all" | undefined}
 */
export function resolveCustomType(config, blockId) {
    if (!config.autoAll) return undefined;
    return autoEnableAll.includes(blockId ?? "") ? "all" : undefined;
}

const minerFunctionManager = new class MinerFunctionManager {
    "all"(info) {
        system.run(() => { veinShapeGetAll.getBlocks(info); });
    }
    "1x1_tunnel"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 1, 1); });
    }
    "1x2_tunnel"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 1, 2); });
    }
    "1x3_tunnel"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 1, 3); });
    }
    "3x2_tunnel"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 3, 2); });
    }
    "3x2_tunnel_small"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 3, 2, 1); });
    }
    "3x3_tunnel"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 3, 3); });
    }
    "3x3_tunnel_small"(info) {
        system.run(() => { veinShapeGetTunnel.getBlocks(info, 3, 3, 1); });
    }
    "escape_tunnel"(info) {
        system.run(() => { veinShapeGetStairs.getBlocks(info); });
    }
    "mining_tunnel"(info) {
        system.run(() => { veinShapeGetStairs.getBlocks(info, false); });
    }
};
