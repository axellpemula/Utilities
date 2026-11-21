import { world, system, BlockComponentTypes, EquipmentSlot } from "@minecraft/server";
import { worksOnlyLogs, worksOnlyOres } from "../variables";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { apiEquippable } from "../lib/player/equippable";
import { setTurnOff } from "../functions/turnOffTimer";
import { getBlocks, resolveCustomType } from "../lib/block/selectArea";
import { apiBlock } from "../lib/block/apiBlock";
import { apiConfig } from "../lib/player/config";
import { isMiningActive } from "../lib/player/activation";
import { apiNeverMine } from "../lib/player/neverMine";
import { applyToolProfile } from "../lib/item/toolProfile";

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const { player, block } = ev;
    // Cheapest checks first: this runs on every block break for every player.
    const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
    // A tool profile (This Tool) can change the function or the size.
    const config = applyToolProfile(apiConfig.get(player), item);
    if (config.functionType == "off")
        return;
    // Sneaking always activates. With "Require Sneaking" off the held tool has
    // to be a pickaxe, and "Only Marked Tools" narrows it to marked ones.
    if (!isMiningActive(player, config, item))
        return;
    if (block.hasTag("bedrock_awakening:script_no_break"))
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

    if (apiDeleteBlocks.get(player).has(blockIds[0] ?? "")) {
        const durability = item?.getComponent("durability");
        if ((durability?.damage ?? 0) + 1 >= (durability?.maxDurability ?? 0))
            return;
        ev.cancel = true;
        system.run(() => { block.setType("minecraft:air"); });
    }

    if (config.turnOff != 0)
        setTurnOff(player, config.turnOff);

    getBlocks({
        type: "break",
        player,
        block,
        blockIds,
        blockFace: player.getBlockFromViewDirection({ maxDistance: 10 })?.face ?? "Up",
        origin: block,
        config,
        item,
        neverMine,
        // Vanilla already consumed one durability for the origin block when the
        // event was not cancelled.
        originDamaged: ev.cancel !== true,
    }, resolveCustomType(config, blockIds[0]));
});
