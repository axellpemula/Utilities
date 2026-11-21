import { system, world, EquipmentSlot } from "@minecraft/server";
import { worksOnlyLogs, worksOnlyOres } from "../variables";
import { borderFunctions, previewOwners } from "../functions/preview";
import { getBlocks, resolveCustomType } from "../lib/block/selectArea";
import { apiBlock } from "../lib/block/apiBlock";
import { apiConfig } from "../lib/player/config";
import { apiEquippable } from "../lib/player/equippable";
import { isMiningActive } from "../lib/player/activation";
import { apiNeverMine } from "../lib/player/neverMine";
import { applyToolProfile } from "../lib/item/toolProfile";
import { hasAnyLoot } from "../lib/loot/loot";
import { positionKey } from "../lib/util/position";

export const ALWAYS_SHOW_TAG = "utilities_vein_miner:alwaysShowEdges";

/** @type {Map<string, string>} */
export const lastBlockRegistered = new Map();
/** @type {Set<import("@minecraft/server").Player>} */
export const playersList = new Set();

system.runInterval(() => {
    // Markers must disappear for everyone, not only for tagged players: a
    // player who stops sneaking, disables the option or leaves used to keep
    // their edge entities forever.
    for (const [playerId, owner] of [...previewOwners]) {
        try {
            if (!owner.player.isValid) {
                system.runJob(borderFunctions.removeByOwner(owner.dimension, playerId));
                continue;
            }
            const ownerItem = apiEquippable.getItemSlot(owner.player, EquipmentSlot.Mainhand);
            const ownerConfig = applyToolProfile(apiConfig.get(owner.player), ownerItem);
            if (!isMiningActive(owner.player, ownerConfig, ownerItem))
                system.runJob(borderFunctions.remove(owner.player));
        }
        catch {
            previewOwners.delete(playerId);
        }
    }

    for (const player of playersList) {
        if (!player.isValid) {
            playersList.delete(player);
            continue;
        }
        const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
        const config = applyToolProfile(apiConfig.get(player), item);
        if (!isMiningActive(player, config, item)) {
            lastBlockRegistered.delete(player.id);
            continue;
        }
        if (config.showSelection == false)
            continue;
        if (config.functionType == "off") {
            if (previewOwners.has(player.id))
                system.runJob(borderFunctions.remove(player));
            continue;
        }
        const blockInfo = player.getBlockFromViewDirection({ maxDistance: 7 });
        if (!blockInfo)
            continue;
        const { block, face } = blockInfo;
        const blockKey = positionKey(block.x, block.y, block.z);
        if (lastBlockRegistered.get(player.id) === blockKey)
            continue;
        if (previewOwners.has(player.id))
            system.runJob(borderFunctions.remove(player));
        lastBlockRegistered.set(player.id, blockKey);

        // `continue`, not `return`: these early exits sit inside the player
        // loop, so one player looking at a block without loot used to skip the
        // preview refresh for everybody else that tick.
        if (!hasAnyLoot(block, item))
            continue;

        const blockIds = apiBlock.formatId(block.typeId);
        const neverMine = apiNeverMine.get(player);
        if (neverMine.has(blockIds[0] ?? ""))
            continue;
        if (config.onlyOre || config.onlyLog) {
            const id = blockIds[0];
            const isOre = (id && worksOnlyOres.has(id)) || block.hasTag("bedrock_awakening:ore");
            const isLog = (id && worksOnlyLogs.has(id)) || block.hasTag("bedrock_awakening:log") || block.hasTag("log");
            if (!(config.onlyOre && isOre) && !(config.onlyLog && isLog))
                continue;
        }

        getBlocks({
            type: "preview",
            player,
            block,
            blockIds,
            blockFace: face,
            origin: block,
            config,
            item,
            neverMine,
        }, resolveCustomType(config, blockIds[0]));
    }
}, 5);

system.run(() => {
    for (const player of world.getPlayers({ tags: [ALWAYS_SHOW_TAG] }))
        playersList.add(player);
});

/**
 * @param {string} playerId
 */
export function forgetPlayer(playerId) {
    lastBlockRegistered.delete(playerId);
    for (const player of playersList)
        if (player.id === playerId) playersList.delete(player);
}
