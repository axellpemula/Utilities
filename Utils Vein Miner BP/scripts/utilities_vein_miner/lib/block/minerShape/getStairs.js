import { system } from "@minecraft/server";
import { functionController } from "../../../functions/controller";
import { DEFAULT_FACE_DIRECTIONS, stairsDirectionIndex } from "../directions";
import { apiDurability } from "../../item/durability";

export const veinShapeGetStairs = new class VeinShapeGetStairs {
    /**
     * Staircase/shaft shape (escape + mining tunnels).
     * @param {any} info
     * @param {boolean} [up] true = escape upwards, false = mine downwards
     */
    getBlocks(info, up = true) {
        const { player, blockIds, origin, item, config, type } = info;
        const direction = DEFAULT_FACE_DIRECTIONS[stairsDirectionIndex(player.getRotation().y)];
        if (!direction) return;
        const directionVertical = up ? 1 : -1;

        const durability = apiDurability.getDurability(item, true, config?.protectTool ? 1 : 0);
        const maxSize = durability === Infinity || durability > config.maxSize ? config.maxSize : durability;
        if (maxSize < 1) return;

        const blocks = [];
        system.runJob(function* stairs() {
            let i = type == "preview" ? 0 : 1;
            if (type == "break")
                blocks.push({ x: origin.x, y: origin.y, z: origin.z });
            while (blocks.length < maxSize) {
                yield;
                const x = origin.x + (direction.x * i);
                const y = origin.y + (directionVertical * i);
                const z = origin.z + (direction.z * i);
                i++;
                try {
                    const block = origin.dimension.getBlock({ x, y, z });
                    if (!block) break;
                    if (!blockIds.includes(block.typeId)) break;
                    blocks.push({ x, y, z });
                }
                catch {
                    // Out of world height / unloaded chunk.
                    break;
                }
            }
            functionController(info, blocks);
        }());
    }
};
