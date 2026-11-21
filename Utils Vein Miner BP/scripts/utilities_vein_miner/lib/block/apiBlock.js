import { GameMode } from "@minecraft/server";
import { apiDeleteBlocks } from "../player/deleteBlocks";
import { blocksWithExperience, canDropNone } from "../../variables";
import { generateLoot } from "../loot/loot";
import { faceDirectionIndex } from "./directions";

/** Experience ranges resolved from block tags at runtime. */
/** @type {Map<string, [number, number]>} */
const xpCache = new Map();

const XP_TAG_PREFIX = "bedrock_awakening:experience_drop:";

export const apiBlock = new class ApiBlock {
    /**
     * Lit blocks (redstone ore) and legacy ids map to the id their neighbours
     * and the delete-blocks list use.
     * @param {string} id
     * @returns {string[]}
     */
    formatId(id) {
        if (id === "minecraft:unlit_redstone_torch" || id === "unlit_redstone_torch")
            return ["minecraft:redstone_torch", id];
        if (id.includes("lit_"))
            return [id.replace("lit_", ""), id];
        return [id];
    }

    /**
     * @param {import("@minecraft/server").BlockFace} [face]
     * @returns {number} index into `DEFAULT_FACE_DIRECTIONS`
     */
    getFaceDirectionIndex(face) {
        return faceDirectionIndex(face);
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {import("@minecraft/server").Block} block
     * @param {import("@minecraft/server").ItemStack} [item]
     * @param {boolean} [cancel] when true, blocks without drops are rejected
     * @returns {boolean}
     */
    isValidDrop(player, block, item, cancel = true) {
        if (player.getGameMode() === GameMode.Creative)
            return true;
        if (apiDeleteBlocks.get(player).has(block.typeId))
            return true;
        if (canDropNone.has(block.typeId))
            return true;
        if (block.getTags().includes("bedrock_awakening:block_has_chance_drop"))
            return true;
        const loot = generateLoot(block, item);
        return !cancel || loot.length > 0;
    }

    /**
     * @param {import("@minecraft/server").Block} [block]
     * @returns {[number, number]} inclusive min/max experience
     */
    getXpRange(block) {
        if (!block || !block.isValid) return [0, 0];
        const typeId = block.typeId;
        const known = blocksWithExperience[typeId];
        if (known) return [known[0], known[1]];
        const cached = xpCache.get(typeId);
        if (cached) return cached;
        let tags;
        try {
            tags = block.getTags();
        }
        catch {
            return [0, 0];
        }
        const tag = tags.find(value => value.startsWith(XP_TAG_PREFIX));
        if (!tag) return [0, 0];
        const [min, max] = tag.replace(XP_TAG_PREFIX, "").split("-").map(Number);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 0];
        // Cached separately so the read-only `blocksWithExperience` table stays
        // a pure configuration file.
        xpCache.set(typeId, [min, max]);
        return [min, max];
    }
};
