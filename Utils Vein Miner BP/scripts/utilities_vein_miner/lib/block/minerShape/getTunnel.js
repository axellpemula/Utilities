import { system } from "@minecraft/server";
import { functionController } from "../../../functions/controller";
import { DEFAULT_FACE_DIRECTIONS, isInsideTunnel, tunnelBounds, tunnelSpace } from "../directions";
import { apiDurability } from "../../item/durability";
import { positionKey } from "../../util/position";
import { apiBlock } from "../apiBlock";
import { getOffsetType } from "../offsets";

export const veinShapeGetTunnel = new class VeinShapeGetTunnel {
    /**
     * @param {any} info
     * @param {number} sideRange
     * @param {number} heightRange
     * @param {number} [depthRange] undefined = unlimited
     */
    getBlocks(info, sideRange, heightRange, depthRange) {
        const { blockIds, blockFace, origin, item, config } = info;
        const bounds = tunnelBounds(sideRange, heightRange, depthRange);
        const direction = DEFAULT_FACE_DIRECTIONS[apiBlock.getFaceDirectionIndex(blockFace)];
        if (!direction) return;
        const isVertical = direction.y !== 0;

        const durability = apiDurability.getDurability(item, true, config?.protectTool ? 1 : 0);
        const maxSize = durability === Infinity || durability > config.maxSize ? config.maxSize : durability;
        if (maxSize < 1) return;

        const preOffsets = getOffsetType(info);
        const approved = [];
        const queue = [{ x: origin.x, y: origin.y, z: origin.z }];
        const visited = new Set([positionKey(origin.x, origin.y, origin.z)]);
        let index = 0;

        system.runJob(function* BFS() {
            while (index < queue.length && approved.length < maxSize) {
                const center = queue[index++];
                yield;
                if (!center) continue;
                const space = tunnelSpace({
                    x: center.x - origin.x,
                    y: center.y - origin.y,
                    z: center.z - origin.z
                }, direction);
                if (!isInsideTunnel(space, bounds, isVertical)) continue;
                approved.push(center);
                for (const offset of preOffsets) {
                    if (approved.length >= maxSize) break;
                    const x = center.x + offset[0];
                    const y = center.y + offset[1];
                    const z = center.z + offset[2];
                    const key = positionKey(x, y, z);
                    if (visited.has(key)) continue;
                    visited.add(key);
                    const block = origin.dimension.getBlock({ x, y, z });
                    if (!block) continue;
                    if (!blockIds.includes(block.typeId)) continue;
                    queue.push({ x, y, z });
                }
            }
            functionController(info, approved.slice(0, maxSize));
        }());
    }
};
