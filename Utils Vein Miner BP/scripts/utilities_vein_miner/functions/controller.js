import { system } from "@minecraft/server";
import { apiDurability } from "../lib/item/durability";
import { apiWarn } from "../lib/player/warn";
import { borderFunctions } from "./preview";
import { breakFunctions } from "./break";
export function functionController(info, blocks) {
    const config = info.config;
    const type = info.type;
    if (blocks.length < (config.functionType == "all" ? 2 : type == "break" ? 1 : 2))
        return;
    const { player, item, blockIds, origin } = info;
    const center = { x: origin.x + 0.5, y: origin.y + 0.5, z: origin.z + 0.5 };
    if (item && type == "break")
        if (!apiDurability.remove(player, item, blocks.length, true))
            return;
    if (type == "preview") {
        config.showInfo && apiWarn.notify(player, { translate: "warning.utilities_vein_miner:will_break", with: [String(blocks.length)] }, { type: "action_bar" });
        config.showSelection && system.runJob(borderFunctions.show(player, blocks, config.accuracy, config.edgeSize));
        return;
    }
    breakFunctions.breakBlocks({
        player,
        config,
        positions: blocks,
        item,
        blockIds,
        origin: center,
    });
}
