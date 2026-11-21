/**
 * Minimal stand-in for `@minecraft/server`.
 *
 * Only what the add-on touches is implemented. It is not a Bedrock emulator -
 * it exists so the pack's real modules can be imported and exercised in Node
 * (see tests/integration.test.js).
 */

export const EquipmentSlot = {
    Mainhand: "Mainhand",
    Offhand: "Offhand",
    Head: "Head",
    Chest: "Chest",
    Legs: "Legs",
    Feet: "Feet"
};

export const EntityComponentTypes = { Equippable: "equippable" };
export const ItemComponentTypes = { Durability: "durability", Enchantable: "enchantable" };
export const BlockComponentTypes = { Inventory: "inventory" };
export const GameMode = { Survival: "survival", Creative: "creative", Adventure: "adventure", Spectator: "spectator" };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1 };
export const CustomCommandParamType = { Enum: "Enum", Integer: "Integer", Boolean: "Boolean", String: "String" };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

/** Entity base class so `instanceof Player` checks behave like the real API. */
export class Player {}

export class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId;
        this.amount = amount;
    }
    getComponent() {
        return undefined;
    }
}

export function createEvent() {
    const handlers = [];
    return {
        handlers,
        subscribe(handler) {
            handlers.push(handler);
            return handler;
        },
        unsubscribe(handler) {
            const index = handlers.indexOf(handler);
            if (index >= 0) handlers.splice(index, 1);
        },
        fire(payload) {
            for (const handler of [...handlers]) handler(payload);
        }
    };
}

/** Runs generators passed to `system.runJob` to completion. */
function drain(generator) {
    let steps = 0;
    for (const _ of generator) {
        if (++steps > 200000) throw new Error("runJob: generator never finished");
    }
    return steps;
}

export const system = {
    intervals: [],
    timeouts: [],
    runs: [],
    jobs: 0,
    run(callback) {
        this.runs.push(callback);
        return callback();
    },
    runInterval(callback, ticks = 1) {
        const handle = { callback, ticks, cancelled: false };
        this.intervals.push(handle);
        return handle;
    },
    runTimeout(callback, ticks = 1) {
        const handle = { callback, ticks, cancelled: false };
        this.timeouts.push(handle);
        return handle;
    },
    runJob(generator) {
        this.jobs++;
        return drain(generator);
    },
    clearInterval(handle) {
        if (handle) handle.cancelled = true;
    },
    clearRun(handle) {
        if (handle) handle.cancelled = true;
    },
    beforeEvents: { startup: createEvent() }
};

/** @type {Map<string, any>} */
const dimensions = new Map();

/** Records every loot table request so tests can assert on caching. */
export const lootTableManager = {
    calls: 0,
    generateLootFromBlock(block, item) {
        this.calls++;
        return block?.loot ?? [];
    }
};

export const world = {
    _players: [],
    _dimensions: dimensions,
    afterEvents: {
        playerSpawn: createEvent(),
        playerLeave: createEvent(),
        itemUse: createEvent(),
        entityHitBlock: createEvent()
    },
    beforeEvents: {
        playerBreakBlock: createEvent(),
        playerLeave: createEvent()
    },
    getPlayers(options) {
        if (options?.tags?.length)
            return this._players.filter(player => options.tags.every(tag => player.hasTag(tag)));
        return [...this._players];
    },
    getAllPlayers() {
        return [...this._players];
    },
    getDimension(id) {
        const dimension = dimensions.get(id);
        if (!dimension) throw new Error(`dimension ${id} is not loaded`);
        return dimension;
    },
    getLootTableManager() {
        return lootTableManager;
    },
    /** World level dynamic properties (operator settings live here). */
    _dynamicProperties: new Map(),
    messages: [],
    getDynamicProperty(key) {
        return this._dynamicProperties.get(key);
    },
    setDynamicProperty(key, value) {
        if (value === undefined) this._dynamicProperties.delete(key);
        else this._dynamicProperties.set(key, value);
    },
    sendMessage(message) {
        this.messages.push(message);
    }
};
