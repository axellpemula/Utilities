export const apiDeleteBlocks = new class ApiDeleteBlocks {
    constructor() {
        this.allBlocks = ["minecraft:stone", "minecraft:dirt", "minecraft:gravel", "minecraft:deepslate", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff"];
    }
    get(player) {
        const dynamic = player.getDynamicProperty("utilities_vein_miner:delete_blocks");
        if (typeof dynamic != "string")
            return new Set();
        const array = JSON.parse(dynamic);
        if (this.isValid(array))
            return new Set(array);
        return new Set(this.allBlocks);
    }
    set(player, value) {
        player.setDynamicProperty("utilities_vein_miner:delete_blocks", JSON.stringify(value));
    }
    isValid(arr) {
        return arr.every(value => typeof value === "string");
    }
};
