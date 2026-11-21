import { BlockList, buildBlockChoices } from "./blockList";

/**
 * Blocks offered in the "Delete Blocks" panel, best first.
 * Derived from `worksOnlyOres` so the list can no longer drift away from the
 * blocks the vein miner actually accepts (it used to hardcode 8 of 28).
 */
const DELETE_PRIORITY = ["stone", "deepslate", "andesite", "diorite", "granite", "tuff", "dirt", "gravel", "netherrack"];

/** Blocks that are mined without dropping loot, to keep inventories clean. */
export const apiDeleteBlocks = new BlockList(
    "utilities_vein_miner:delete_blocks",
    buildBlockChoices(DELETE_PRIORITY)
);
