import { world, Player } from "@minecraft/server";
import { setTurnOff } from "../functions/turnOffTimer";
import { configPanel } from "../functions/configUI";
import { apiConfig } from "../lib/player/config";
import { apiWarn } from "../lib/player/warn";
import { FUNCTION_LIST } from "../lib/player/options";
import { lastBlockRegistered } from "./runInterval";

world.afterEvents.itemUse.subscribe(({ source: entity, itemStack: item }) => {
    if (!(entity instanceof Player))
        return;
    const player = entity;
    if (!player.isSneaking)
        return;
    if (!item?.getTags().includes("minecraft:is_pickaxe"))
        return;

    const config = apiConfig.get(player);
    const lookingAtBlock = player.getBlockFromViewDirection({ maxDistance: 7, includePassableBlocks: false });
    if (lookingAtBlock) {
        if (config.quick)
            quickSettings(player);
        return;
    }
    // "No Open Panel With Pickaxe": sneak + right-click while holding a pickaxe
    // no longer opens the settings panel.
    if (config.cancelOpenItem)
        return;
    configPanel.open(player);
});

/**
 * @param {import("@minecraft/server").Player} player
 */
function quickSettings(player) {
    lastBlockRegistered.delete(player.id);
    const config = apiConfig.get(player);
    const currentIndex = FUNCTION_LIST.indexOf(config.functionType);
    const nextType = FUNCTION_LIST[(currentIndex + 1) % FUNCTION_LIST.length];
    config.functionType = nextType;
    const saved = apiConfig.set(player, config);
    if (saved.functionType != "off")
        setTurnOff(player, saved.turnOff);
    apiWarn.notify(player, { "rawtext": [{ "translate": "warning.utilities_vein_miner:quick_setting" }, { "translate": `ui.utilities_vein_miner:config.function_type.${saved.functionType}` }] }, { sound: "utilities_vein_miner.warn.orb" });
}
