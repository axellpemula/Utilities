import { EquipmentSlot, GameMode, ItemComponentTypes } from "@minecraft/server";
import { apiEquippable } from "../player/equippable";
import { apiWarn } from "../player/warn";
import { effectiveBlocks, remainingForUse, rollDamage } from "./durabilityMath";

export const apiDurability = new class ApiDurability {
    /**
     * Durability points left, or how many blocks the tool can still break when
     * `allowEnchant` is set.
     *
     * The Unbreaking bonus used to be `remaining + remaining / (1 / (level + 1))`
     * i.e. `remaining * (level + 2)`: 3x at Unbreaking I (should be 2x) and 5x
     * at III (should be 4x), so vein mining was allowed to run past the point
     * the tool should have broken.
     * @param {import("@minecraft/server").ItemStack} [item]
     * @param {boolean} [allowEnchant]
     * @param {number} [reserve] durability points to keep ("Protect My Tool")
     * @returns {number} Infinity for items without durability
     */
    getDurability(item, allowEnchant = false, reserve = 0) {
        const durability = item?.getComponent(ItemComponentTypes.Durability);
        if (!durability) return Infinity;
        const remaining = remainingForUse(durability.maxDurability - durability.damage, reserve);
        if (allowEnchant) return effectiveBlocks(remaining, this.getUnbreakingLevel(item));
        return remaining;
    }

    /**
     * @param {import("@minecraft/server").ItemStack} [item]
     * @returns {number}
     */
    getUnbreakingLevel(item) {
        return item?.getComponent(ItemComponentTypes.Enchantable)?.getEnchantment("unbreaking")?.level ?? 0;
    }

    /**
     * Applies durability damage for `damage` blocks.
     * @param {import("@minecraft/server").Player} player
     * @param {import("@minecraft/server").ItemStack} item
     * @param {number} [damage] number of blocks mined
     * @param {boolean} [noBreak] keep the tool in hand even at 0 durability so a
     * vein cannot break it halfway through
     * @param {number} [reserve] durability points that must survive ("Protect My
     * Tool"), so the pickaxe never ends a vein one hit away from breaking
     * @returns {boolean} false when the tool is no longer the held item
     */
    remove(player, item, damage = 1, noBreak = false, reserve = 0) {
        if (!item) return true;
        if (player.getGameMode() === GameMode.Creative) return true;
        if (apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand)?.typeId !== item.typeId) return false;

        const durability = item.getComponent(ItemComponentTypes.Durability);
        if (!durability) return true;

        const applied = rollDamage(damage, this.getUnbreakingLevel(item));
        const ceiling = Math.max(durability.maxDurability - Math.max(reserve, 0), 0);
        if (applied > 0)
            durability.damage = Math.min(durability.damage + applied, ceiling);

        if (durability.damage >= durability.maxDurability && !noBreak) {
            apiWarn.notify(player, "", { sound: "utilities_vein_miner.warn.break" });
            apiEquippable.setItem(player, undefined, EquipmentSlot.Mainhand);
            return true;
        }

        // Re-setting the stack is what makes the damage visible to the client.
        apiEquippable.setItem(player, item, EquipmentSlot.Mainhand);
        return true;
    }
};
