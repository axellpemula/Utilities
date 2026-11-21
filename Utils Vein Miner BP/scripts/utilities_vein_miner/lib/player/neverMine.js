import { BlockList } from "./blockList";

/**
 * Blocks a player never wants vein mined: the crafted look-alikes of the
 * natural blocks a vein run eats through, plus the common building blocks that
 * share a wall with a vein.
 */
const NEVER_MINE_CHOICES = [
    // Crafted stone family - the usual "I broke my house" blocks.
    "minecraft:stone",
    "minecraft:cobblestone",
    "minecraft:stone_bricks",
    "minecraft:mossy_stone_bricks",
    "minecraft:cracked_stone_bricks",
    "minecraft:chiseled_stone_bricks",
    "minecraft:smooth_stone",
    "minecraft:bricks",
    "minecraft:polished_andesite",
    "minecraft:polished_diorite",
    "minecraft:polished_granite",
    // Deepslate family.
    "minecraft:deepslate",
    "minecraft:cobbled_deepslate",
    "minecraft:polished_deepslate",
    "minecraft:deepslate_bricks",
    "minecraft:deepslate_tiles",
    "minecraft:tuff",
    "minecraft:tuff_bricks",
    // Nether / quartz family.
    "minecraft:netherrack",
    "minecraft:nether_bricks",
    "minecraft:blackstone",
    "minecraft:polished_blackstone_bricks",
    "minecraft:quartz_block",
    "minecraft:quartz_bricks",
    "minecraft:smooth_quartz",
    // Ocean / mud.
    "minecraft:prismarine",
    "minecraft:prismarine_bricks",
    "minecraft:dark_prismarine",
    "minecraft:mud_bricks",
    // Terrain a builder still cares about.
    "minecraft:dirt",
    "minecraft:gravel",
    "minecraft:andesite",
    "minecraft:diorite",
    "minecraft:granite"
];

/** Blocks this player never wants mined, whatever the shape says. */
export const apiNeverMine = new BlockList("utilities_vein_miner:never_mine", [...NEVER_MINE_CHOICES]);
