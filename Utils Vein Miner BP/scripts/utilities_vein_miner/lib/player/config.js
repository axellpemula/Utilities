const configCache = new Map();
export const apiConfig = new class apiConfig {
    get(player) {
        const cacheConfig = configCache.get(player.id);
        if (cacheConfig)
            return cacheConfig;
        const dynamic = player.getDynamicProperty("utilities_vein_miner:config_info");
        if (typeof dynamic != "string")
            return defaultConfig;
        const config = JSON.parse(dynamic);
        if (!this.isValid(config))
            return defaultConfig;
        return config;
    }
    set(player, config) {
        configCache.set(player.id, config);
        player.setDynamicProperty("utilities_vein_miner:config_info", JSON.stringify(config));
    }
    clear(player) {
        configCache.delete(player.id);
    }
    isValid(obj) {
        return obj &&
            typeof obj == "object" &&
            typeof obj.showSelection == "boolean" &&
            typeof obj.functionType == "string" &&
            typeof obj.turnOff == "number" &&
            typeof obj.showInfo == "boolean" &&
            typeof obj.maxSize == "number" &&
            typeof obj.edgeSize == "number" &&
            typeof obj.cancelNoDrop == "boolean" &&
            typeof obj.autoAll == "boolean" &&
            typeof obj.onlyOre == "boolean" &&
            typeof obj.onlyLog == "boolean" &&
            typeof obj.accuracy == "boolean" &&
            typeof obj.cancelOpenItem == "boolean" &&
            typeof obj.connectedDiagonals == "boolean" &&
            typeof obj.quick == "boolean";
    }
};
export const defaultConfig = {
    showSelection: false,
    functionType: "all",
    turnOff: 0,
    showInfo: true,
    maxSize: 64,
    edgeSize: 3,
    quick: false,
    cancelNoDrop: true,
    autoAll: true,
    onlyOre: false,
    onlyLog: false,
    accuracy: false,
    cancelOpenItem: false,
    connectedDiagonals: true
};
