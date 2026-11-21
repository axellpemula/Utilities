import { system } from "@minecraft/server";
import { veinShapeGetStairs } from "./minerShape/getStairs";
import { veinShapeGetTunnel } from "./minerShape/getTunnel";
import { veinShapeGetAll } from "./minerShape/getAll";
export function getBlocks(info, customType) {
    const { config } = info;
    const execute = minerFunctionManager[customType ?? config.functionType];
    if (execute)
        return execute(info);
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
export function getOffsetType(info) {
    if (info.config.connectedDiagonals)
        return preOffsets26;
    return preOffsets6;
}
const preOffsets6 = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
];
const preOffsets26 = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
    [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
    [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
    [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
    [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
];
