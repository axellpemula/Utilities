import { system } from "@minecraft/server";
import { functionController } from "../../../functions/controller";
import { apiDurability } from "../../item/durability";
import { positionKey } from "../../util/position";
import { getOffsetType } from "../offsets";

export const veinShapeGetAll = new class VeinShapeGetAll {
    /**
     * Breadth first flood fill over connected blocks of the same id.
     * @param {any} info
     */
    getBlocks(info) {
        const { blockIds, origin, config } = info;
        const durability = apiDurability.getDurability(info.item, true, info.config?.protectTool ? 1 : 0);
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
                approved.push(center);
                for (const offset of preOffsets) {
                    // The cap used to be checked after queueing the newly found
                    // block, which always dropped the last valid block.
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
