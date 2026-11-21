import { EntityComponentTypes, EquipmentSlot } from "@minecraft/server";

export const apiEquippable = new class ApiEquippable {
    /**
     * @param {import("@minecraft/server").Entity} entity
     * @param {EquipmentSlot} slot
     * @returns {import("@minecraft/server").ItemStack | undefined}
     */
    getItemSlot(entity, slot) {
        const equippable = entity.getComponent(EntityComponentTypes.Equippable);
        if (!equippable) return undefined;
        return equippable.getEquipment(slot);
    }

    /**
     * @param {import("@minecraft/server").Entity} entity
     * @param {import("@minecraft/server").ItemStack | undefined} item
     * @param {EquipmentSlot} slot
     */
    setItem(entity, item, slot) {
        const equippable = entity.getComponent(EntityComponentTypes.Equippable);
        if (!equippable) return;
        equippable.setEquipment(slot, item);
    }
};
