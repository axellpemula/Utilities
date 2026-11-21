import { system, ItemStack, ItemComponentTypes } from "@minecraft/server";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { lootManager } from "../events/runInterval";
import { apiBlock } from "../lib/block/apiBlock";
import { borderFunctions } from "./preview";
import { apiWarn } from "../lib/player/warn";
export const breakFunctions = new class BreakFunctions {
    breakBlocks(info) {
        const { player, config, positions, origin, blockIds, item } = info;
        config.showInfo && apiWarn.notify(player, { translate: "warning.utilities_vein_miner:breaking", with: [String(positions.length)] }, { type: "action_bar" });
        system.runJob(this.breakAll(player, blockIds[0] ?? "", positions, origin, item));
    }
    *breakAll(player, id, positions, origin, item) {
        const loots = [];
        const deleteBlocks = apiDeleteBlocks.get(player).has(id);
        const hasSilkTouch = item?.getComponent(ItemComponentTypes.Enchantable)?.hasEnchantment("minecraft:silk_touch") ?? false;
        const blockXp = player.dimension.getBlock(positions[1] ?? origin);
        const [min, max] = apiBlock.getXpRange(blockXp);
        for (const pos of positions) {
            const block = player.dimension.getBlock(pos);
            if (!block || !block.isValid)
                continue;
            const loot = lootManager.generateLootFromBlock(block, item);
            block.setType("minecraft:air");
            if (!deleteBlocks) {
                loots.push(...(loot ?? []));
                if (!hasSilkTouch && max != 0) {
                    const random = Math.floor(Math.random() * (max - min + 1) + min);
                    for (let i = 0; i < random; i++)
                        block.dimension.spawnEntity("minecraft:xp_orb", origin);
                }
            }
            yield;
        }
        if (deleteBlocks)
            return this.removeBorder(player);
        const lootsFiltered = loots.reduce((acc, value) => {
            acc[value.typeId] = (acc[value.typeId] ?? 0) + value.amount;
            return acc;
        }, {});
        for (const [key, value] of Object.entries(lootsFiltered)) {
            const executions = Math.floor(value / 64);
            for (let i = 0; i < executions; i++) {
                player.dimension.spawnItem(new ItemStack(key, 64), origin);
                yield;
            }
            if (value % 64 != 0)
                player.dimension.spawnItem(new ItemStack(key, value % 64), origin);
        }
        player.dimension.getEntitiesAtBlockLocation(origin).forEach(item => { if (teleportOnBreak.includes(item.typeId))
            item.teleport(origin); });
        this.removeBorder(player);
    }
    removeBorder(player) {
        system.runJob(borderFunctions.remove(player));
    }
};
const teleportOnBreak = ["minecraft:item", "minecraft:xp_orb"];
