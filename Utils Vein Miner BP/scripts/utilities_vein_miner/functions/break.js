import { system, ItemStack, ItemComponentTypes, GameMode } from "@minecraft/server";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { generateLoot } from "../lib/loot/loot";
import { apiBlock } from "../lib/block/apiBlock";
import { apiWarn } from "../lib/player/warn";
import { borderFunctions } from "./preview";

export const breakFunctions = new class BreakFunctions {
    /**
     * @param {any} info
     */
    breakBlocks(info) {
        const { player, config, positions, origin, blockIds, item } = info;
        if (!positions?.length) {
            system.runJob(borderFunctions.remove(player));
            return;
        }
        config.showInfo && apiWarn.notify(player, { translate: "warning.utilities_vein_miner:breaking", with: [String(positions.length)] }, { type: "action_bar" });
        system.runJob(this.breakAll(player, blockIds[0] ?? "", positions, origin, item));
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} id
     * @param {{x: number, y: number, z: number}[]} positions
     * @param {import("@minecraft/server").Vector3} origin block center
     * @param {import("@minecraft/server").ItemStack} [item]
     */
    *breakAll(player, id, positions, origin, item) {
        /** @type {import("@minecraft/server").ItemStack[]} */
        const loots = [];
        const deleteBlocks = apiDeleteBlocks.get(player).has(id);
        const hasSilkTouch = item?.getComponent(ItemComponentTypes.Enchantable)?.hasEnchantment("minecraft:silk_touch") ?? false;
        // Vanilla creative breaks drop nothing; spawning drops there only
        // creates item/XP entity spam.
        const spawnDrops = !deleteBlocks && player.getGameMode() !== GameMode.Creative;

        for (const pos of positions) {
            yield;
            if (!player.isValid) return;
            const block = player.dimension.getBlock(pos);
            if (!block || !block.isValid) continue;
            const loot = generateLoot(block, item);
            // Read experience before the block turns into air.
            const xpRange = apiBlock.getXpRange(block);
            block.setType("minecraft:air");
            if (deleteBlocks) continue;
            if (!spawnDrops) continue;
            loots.push(...loot);
            if (!hasSilkTouch) this.spawnExperience(player, xpRange, origin);
        }

        if (deleteBlocks) return this.removeBorder(player);

        const lootsFiltered = loots.reduce((acc, value) => {
            acc[value.typeId] = (acc[value.typeId] ?? 0) + value.amount;
            return acc;
        }, {});
        for (const [typeId, amount] of Object.entries(lootsFiltered)) {
            for (let remaining = amount; remaining > 0; remaining -= 64) {
                const size = Math.min(remaining, 64);
                try {
                    player.dimension.spawnItem(new ItemStack(typeId, size), origin);
                }
                catch {
                    // Unknown/unspawnable item id.
                }
                yield;
            }
        }
        this.removeBorder(player);
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {[number, number]} range inclusive min/max experience
     * @param {import("@minecraft/server").Vector3} origin
     */
    spawnExperience(player, range, origin) {
        const [min, max] = range;
        if (!max) return;
        const amount = Math.floor(Math.random() * (max - min + 1) + min);
        for (let i = 0; i < amount; i++) {
            try {
                player.dimension.spawnEntity("minecraft:xp_orb", origin);
            }
            catch {
                return;
            }
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     */
    removeBorder(player) {
        system.runJob(borderFunctions.remove(player));
    }
};
