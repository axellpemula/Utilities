import { world, system, BlockComponentTypes, EquipmentSlot, Player } from "@minecraft/server";
import { worksOnlyLogs, worksOnlyOres } from "../variables";
import { apiEquippable } from "../lib/player/equippable";
import { borderFunctions, previewOwners } from "../functions/preview";
import { setTurnOff } from "../functions/turnOffTimer";
import { getBlocks, resolveCustomType } from "../lib/block/selectArea";
import { apiBlock } from "../lib/block/apiBlock";
import { apiConfig } from "../lib/player/config";
import { isMiningActive } from "../lib/player/activation";
import { apiNeverMine } from "../lib/player/neverMine";
import { applyToolProfile } from "../lib/item/toolProfile";

world.afterEvents.entityHitBlock.subscribe(({ damagingEntity, hitBlock: block, blockFace }) => {
    // entityHitBlock also fires for arrows and mobs; only players can vein mine.
    if (!(damagingEntity instanceof Player))
        return;
    const player = damagingEntity;
    const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
    const config = applyToolProfile(apiConfig.get(player), item);
    if (!isMiningActive(player, config, item))
        return;
    if (config.showSelection && previewOwners.has(player.id))
        system.runJob(borderFunctions.remove(player));
    if (config.functionType == "off")
        return;
    if (block.hasTag("bedrock_awakening:script_no_break"))
        return;
    if (block.typeId == "minecraft:air")
        return;
    if (block.typeId == "minecraft:bedrock")
        return;
    if (block.getComponent(BlockComponentTypes.Inventory))
        return;

    const blockIds = apiBlock.formatId(block.typeId);
    const neverMine = apiNeverMine.get(player);
    if (neverMine.has(blockIds[0] ?? ""))
        return;
    if (config.onlyOre || config.onlyLog) {
        const id = blockIds[0];
        const isOre = (id && worksOnlyOres.has(id)) || block.hasTag("bedrock_awakening:ore");
        const isLog = (id && worksOnlyLogs.has(id)) || block.hasTag("bedrock_awakening:log") || block.hasTag("log");
        if (!(config.onlyOre && isOre) && !(config.onlyLog && isLog))
            return;
    }

    if (!apiBlock.isValidDrop(player, block, item, config.cancelNoDrop))
        return;

    if (config.turnOff != 0)
        setTurnOff(player, config.turnOff);

    getBlocks({
        type: "preview",
        player,
        block,
        blockIds,
        blockFace,
        origin: block,
        config,
        item,
        neverMine,
    }, resolveCustomType(config, blockIds[0]));
});
