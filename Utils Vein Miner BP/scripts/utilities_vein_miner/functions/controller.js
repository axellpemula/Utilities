import { system } from "@minecraft/server";
import { apiDurability } from "../lib/item/durability";
import { apiWarn } from "../lib/player/warn";
import { apiBlock } from "../lib/block/apiBlock";
import { borderFunctions } from "./preview";
import { breakFunctions } from "./break";

/**
 * Applies the chosen shape result: preview it, or mine it.
 * @param {any} info
 * @param {{x: number, y: number, z: number}[]} blocks
 */
export function functionController(info, blocks) {
    if (!blocks?.length) return;
    const config = info.config;
    const type = info.type;
    const allowed = dropNeverMine(info, blocks);
    if (!allowed.length) return;
    const minBlocks = config.functionType == "all" ? 2 : type == "break" ? 1 : 2;
    if (allowed.length < minBlocks) return;

    const { player, item, blockIds, origin } = info;
    const center = { x: origin.x + 0.5, y: origin.y + 0.5, z: origin.z + 0.5 };

    if (item && type == "break") {
        // `blocks` always contains the origin. Vanilla already consumed one
        // durability for it unless the break event was cancelled.
        const charged = Math.max(allowed.length - (info.originDamaged ? 1 : 0), 0);
        const reserve = config.protectTool ? 1 : 0;
        if (!apiDurability.remove(player, item, charged, true, reserve)) return;
        // "Protect My Tool" stops the vein before the pickaxe dies; say so, or
        // the shorter vein looks like a bug.
        if (reserve > 0 && apiDurability.getDurability(item) <= reserve)
            apiWarn.notify(player, "warning.utilities_vein_miner:tool_guard", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
    }

    if (type == "preview") {
        config.showInfo && apiWarn.notify(player, { translate: "warning.utilities_vein_miner:will_break", with: [String(allowed.length)] }, { type: "action_bar" });
        config.showSelection && system.runJob(borderFunctions.show(player, allowed, config.accuracy, config.edgeSize));
        return;
    }

    breakFunctions.breakBlocks({
        player,
        config,
        positions: allowed,
        item,
        blockIds,
        origin: center,
    });
}

/**
 * Drops the blocks this player never wants mined ("Never Mine").
 *
 * Shapes plan block positions, so the ids have to be looked up again; doing it
 * here means every shape, the preview and the durability charge all agree on
 * what will actually be mined.
 * @param {any} info
 * @param {{x: number, y: number, z: number}[]} blocks
 * @returns {{x: number, y: number, z: number}[]}
 */
function dropNeverMine(info, blocks) {
    const list = info.neverMine;
    if (!list || list.size === 0) return blocks;
    const dimension = info.origin?.dimension;
    if (!dimension) return blocks;
    const kept = [];
    for (const position of blocks) {
        const block = dimension.getBlock(position);
        if (block && list.has(apiBlock.formatId(block.typeId)[0] ?? "")) continue;
        kept.push(position);
    }
    return kept;
}
