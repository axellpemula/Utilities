import { system, world } from "@minecraft/server";
import { positionKey } from "../lib/util/position";

const ENTITY_ID = "utilities_vein_miner:selected_block";
const OWNER_TAG_PREFIX = "utilities_vein_miner_owner:";
const DIMENSIONS = ["overworld", "nether", "the_end"];

/**
 * Players that currently have edge markers in the world.
 *
 * Needed because markers used to be cleaned up only for players carrying the
 * `alwaysShowEdges` tag: for everybody else they stayed behind after the
 * player stopped sneaking, disabled the panel option or left the world.
 * @type {Map<string, {player: import("@minecraft/server").Player, dimension: import("@minecraft/server").Dimension}>}
 */
export const previewOwners = new Map();

/**
 * @param {string} playerId
 * @returns {string}
 */
export function ownerTag(playerId) {
    return `${OWNER_TAG_PREFIX}${playerId}`;
}

export const borderFunctions = new class BorderFunctions {
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {{x: number, y: number, z: number}[]} blocks
     * @param {boolean} [accuracy]
     * @param {number} [edgeType] 1..5
     */
    *show(player, blocks, accuracy = false, edgeType) {
        if (!player?.isValid || !blocks?.length) return;
        const first = blocks[0];
        if (!first) return;
        const centerBlock = player.dimension.getBlock(first);
        if (!centerBlock || centerBlock.typeId === "minecraft:air") return;

        const scanFaces = new Set();
        for (const pos of blocks)
            scanFaces.add(positionKey(pos.x, pos.y, pos.z));

        const scannedBlocks = new Map();
        for (const pos of blocks) {
            const x = pos.x, y = pos.y, z = pos.z;
            const blockKey = positionKey(x, y, z);
            const block = scannedBlocks.get(blockKey) ?? { block: pos, face: new Set(), expression: "" };
            for (const offset of facesList) {
                const nx = x + offset.x;
                const ny = y + offset.y;
                const nz = z + offset.z;
                const neighborKey = positionKey(nx, ny, nz);
                if (!scanFaces.has(neighborKey)) continue;
                const face = offset.face;
                const oppositeFace = offset.opposite;
                const neighborBlock = scannedBlocks.get(neighborKey) ?? { block: { x: nx, y: ny, z: nz }, face: new Set(), expression: "" };
                if (face && oppositeFace) {
                    block.face.add(face);
                    block.expression += `v.${face}=true;`;
                    neighborBlock.face.add(oppositeFace);
                }
                scannedBlocks.set(neighborKey, neighborBlock);
            }
            scannedBlocks.set(blockKey, block);
        }

        previewOwners.set(player.id, { player, dimension: player.dimension });

        const accuracyTest = accuracy ? accuracyTestList[1] : accuracyTestList[0];
        let spawned = 0;
        for (const [, { block, face, expression }] of scannedBlocks) {
            if (face.has("north") && face.has("south") && face.has("east") && face.has("west") && face.has("up") && face.has("down"))
                continue;
            if (!accuracyTest(face)) continue;
            if (spawned++ % 8 == 0) yield;
            try {
                const entity = player.dimension.spawnEntity(ENTITY_ID, { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 });
                entity.addTag(ownerTag(player.id));
                system.runTimeout(() => {
                    if (entity.isValid && player.isValid)
                        entity.playAnimation("animation.utilities_vein_miner.selected_block.edges", {
                            players: [player],
                            nextState: "none",
                            stopExpression: `v.show = true; v.type = ${edgeType - 1}; ${expression}`
                        });
                }, 2);
            }
            catch {
                // Client entity missing (resource pack not applied) or chunk unloaded.
            }
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     */
    *remove(player) {
        if (!player) return;
        let dimension;
        try {
            dimension = player.dimension;
        }
        catch {
            dimension = previewOwners.get(player.id)?.dimension;
        }
        yield* this.removeByOwner(dimension, player.id);
    }

    /**
     * Removes every marker owned by `ownerId`, even after the player left.
     * @param {import("@minecraft/server").Dimension | undefined} dimension
     * @param {string} ownerId
     */
    *removeByOwner(dimension, ownerId) {
        previewOwners.delete(ownerId);
        if (!dimension) return;
        let edges = [];
        try {
            edges = dimension.getEntities({ type: ENTITY_ID, tags: [ownerTag(ownerId)] });
        }
        catch {
            return;
        }
        for (const entity of edges) {
            try {
                entity.remove();
            }
            catch {
                // Already removed by another job.
            }
            yield;
        }
    }

    /**
     * Startup sweep: markers are persisted entities, so a crash or a player
     * leaving mid-preview used to leave them in the save forever.
     */
    *removeAll() {
        for (const dimensionId of DIMENSIONS) {
            let dimension;
            try {
                dimension = world.getDimension(dimensionId);
            }
            catch {
                continue;
            }
            let edges = [];
            try {
                edges = dimension.getEntities({ type: ENTITY_ID });
            }
            catch {
                continue;
            }
            for (const entity of edges) {
                try {
                    entity.remove();
                }
                catch {
                    // Ignore.
                }
                yield;
            }
        }
        previewOwners.clear();
    }
};

/**
 * Only the 18 offsets that carry face information are used; the previous list
 * repeated the same four corner offsets twice and included four offsets whose
 * opposite (negative X) corner was missing, all of which were ignored anyway.
 */
const facesList = [
    { x: 0, y: 0, z: -1, face: "north", opposite: "south" },
    { x: 0, y: 0, z: 1, face: "south", opposite: "north" },
    { x: 1, y: 0, z: 0, face: "east", opposite: "west" },
    { x: -1, y: 0, z: 0, face: "west", opposite: "east" },
    { x: 0, y: 1, z: 0, face: "up", opposite: "down" },
    { x: 0, y: -1, z: 0, face: "down", opposite: "up" },
    { x: 0, y: -1, z: -1, face: "bn", opposite: "ts" },
    { x: 0, y: -1, z: 1, face: "bs", opposite: "tn" },
    { x: 1, y: -1, z: 0, face: "be", opposite: "tw" },
    { x: -1, y: -1, z: 0, face: "bw", opposite: "te" },
    { x: 0, y: 1, z: -1, face: "tn", opposite: "bs" },
    { x: 0, y: 1, z: 1, face: "ts", opposite: "bn" },
    { x: 1, y: 1, z: 0, face: "te", opposite: "bw" },
    { x: -1, y: 1, z: 0, face: "tw", opposite: "be" },
    { x: -1, y: 0, z: -1, face: "nw", opposite: "se" },
    { x: -1, y: 0, z: 1, face: "sw", opposite: "ne" },
    { x: 1, y: 0, z: -1, face: "ne", opposite: "sw" },
    { x: 1, y: 0, z: 1, face: "se", opposite: "nw" }
];

/**
 * Mirrors `pre_animation` in
 * `Utils Vein Miner RP/entity/utilities_vein_miner/selected_block.entity.json`.
 * Keep both in sync when changing edge visibility.
 */
const accuracyTestList = [
    (face) => {
        return !((face.has("north") && face.has("south") && face.has("east") && face.has("west")) ||
            (face.has("north") && face.has("south") && face.has("up") && face.has("down")) ||
            (face.has("east") && face.has("west") && face.has("up") && face.has("down")));
    },
    (face) => {
        return ((!face.has("north") && !face.has("east")) || (!face.has("north") && face.has("east") && face.has("ne")) || (face.has("north") && !face.has("east") && face.has("ne")) ||
            (!face.has("north") && !face.has("west")) || (!face.has("north") && face.has("west") && face.has("nw")) || (face.has("north") && !face.has("west") && face.has("nw")) ||
            (!face.has("north") && !face.has("down")) || (face.has("down") && face.has("bn") && !face.has("north")) || (!face.has("down") && face.has("bn") && face.has("north")) ||
            (!face.has("north") && !face.has("up")) || (face.has("up") && face.has("tn") && !face.has("north")) || (!face.has("up") && face.has("tn") && face.has("north")) ||
            (!face.has("south") && !face.has("east")) || (!face.has("south") && face.has("east") && face.has("se")) || (face.has("south") && !face.has("east") && face.has("se")) ||
            (!face.has("south") && !face.has("west")) || (!face.has("south") && face.has("west") && face.has("sw")) || (face.has("south") && !face.has("west") && face.has("sw")) ||
            (!face.has("south") && !face.has("down")) || (face.has("down") && face.has("bs") && !face.has("south")) || (!face.has("down") && face.has("bs") && face.has("south")) ||
            (!face.has("south") && !face.has("up")) || (face.has("up") && face.has("ts") && !face.has("south")) || (!face.has("up") && face.has("ts") && face.has("south")) ||
            (!face.has("down") && !face.has("east")) || (face.has("down") && face.has("be") && !face.has("east")) || (!face.has("down") && face.has("be")) ||
            (!face.has("down") && !face.has("west")) || (face.has("down") && face.has("bw") && !face.has("west")) || (!face.has("down") && face.has("bw")) ||
            (!face.has("up") && !face.has("east")) || (face.has("up") && face.has("te") && !face.has("east")) || (!face.has("up") && face.has("te")) ||
            (!face.has("up") && !face.has("west")) || (face.has("up") && face.has("tw") && !face.has("west")) || (!face.has("up") && face.has("tw")));
    }
];
