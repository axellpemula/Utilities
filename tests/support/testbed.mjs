/**
 * Fake players / blocks / dimensions built on the mock API, so integration
 * tests can drive the real pack code.
 */
import { Player, world } from "./mock-server.mjs";
import { positionKey } from "../../Utils Vein Miner BP/scripts/utilities_vein_miner/lib/util/position.js";

/**
 * @param {string} id
 * @returns {{id: string, _blocks: Map<string, any>, entities: any[], items: any[]}}
 */
export function createDimension(id = "overworld") {
    const blocks = new Map();
    const entities = [];
    const items = [];

    const dimension = {
        id,
        _blocks: blocks,
        entities,
        items,
        getBlock(location) {
            if (!location) return undefined;
            return blocks.get(positionKey(Math.floor(location.x), Math.floor(location.y), Math.floor(location.z)));
        },
        spawnEntity(typeId, location) {
            const entity = {
                typeId,
                location,
                tags: new Set(),
                isValid: true,
                addTag(tag) { this.tags.add(tag); },
                hasTag(tag) { return this.tags.has(tag); },
                playAnimation() {},
                remove() {
                    this.isValid = false;
                    const index = entities.indexOf(this);
                    if (index >= 0) entities.splice(index, 1);
                }
            };
            entities.push(entity);
            return entity;
        },
        spawnItem(stack, location) {
            items.push({ typeId: stack.typeId, amount: stack.amount, location });
        },
        spawnParticle() {},
        getEntities(query = {}) {
            return entities.filter(entity =>
                (!query.type || entity.typeId === query.type) &&
                (!query.tags || query.tags.every(tag => entity.hasTag(tag))));
        },
        getEntitiesAtBlockLocation() {
            return [];
        }
    };

    world._dimensions.set(id, dimension);
    return dimension;
}

/**
 * @param {{id?: string, dimension: any, sneaking?: boolean, tags?: string[], item?: any}} options
 */
export function createPlayer({ id = "player", dimension, sneaking = false, tags = [], item, gameMode = "survival" } = {}) {
    const player = new Player();
    const properties = new Map();
    const tagSet = new Set(tags);

    Object.assign(player, {
        id,
        isValid: true,
        isSneaking: sneaking,
        dimension,
        location: { x: 0.5, y: 64, z: 0.5 },
        _properties: properties,
        _tags: tagSet,
        _mainhand: item,
        hasTag(tag) { return tagSet.has(tag); },
        addTag(tag) { tagSet.add(tag); },
        removeTag(tag) { tagSet.delete(tag); },
        getDynamicProperty(key) { return properties.get(key); },
        setDynamicProperty(key, value) { properties.set(key, value); },
        getComponent(type) {
            if (type !== "equippable") return undefined;
            return {
                getEquipment: slot => (slot === "Mainhand" ? player._mainhand : undefined),
                setEquipment: (slot, value) => { if (slot === "Mainhand") player._mainhand = value; }
            };
        },
        getGameMode() { return gameMode; },
        getRotation() { return { x: 0, y: 0 }; },
        getBlockFromViewDirection() { return undefined; },
        messages: [],
        sendMessage(message) { this.messages.push(message); },
        onScreenDisplay: { setActionBar() {}, setTitle() {} }
    });

    return player;
}

/**
 * @param {any} dimension
 * @param {{x?: number, y?: number, z?: number, typeId?: string, tags?: string[], loot?: any[]}} options
 */
export function createBlock(dimension, { x = 0, y = 64, z = 0, typeId = "minecraft:stone", tags = [], loot = [] } = {}) {
    const block = {
        x,
        y,
        z,
        location: { x, y, z },
        typeId,
        tags,
        loot,
        isValid: true,
        dimension,
        getTags() { return block.tags; },
        hasTag(tag) { return block.tags.includes(tag); },
        getComponent() { return undefined; },
        setType(nextTypeId) { block.typeId = nextTypeId; }
    };
    dimension._blocks.set(positionKey(x, y, z), block);
    return block;
}

/**
 * A fake `ItemStack`: tags (for `minecraft:is_pickaxe`) and item dynamic
 * properties (the tool mark), plus an optional durability component.
 *
 * @param {string} typeId
 * @param {number} [amount]
 * @param {{tags?: string[], durability?: {damage: number, maxDurability: number}, unbreaking?: number}} [options]
 */
export function createItemStack(typeId, amount = 1, options = {}) {
    const properties = new Map();
    const stack = {
        typeId,
        amount,
        _properties: properties,
        getTags() { return options.tags ?? []; },
        hasTag(tag) { return (options.tags ?? []).includes(tag); },
        getDynamicProperty(key) { return properties.get(key); },
        setDynamicProperty(key, value) {
            if (value === undefined) properties.delete(key);
            else properties.set(key, value);
        },
        getComponent(type) {
            if (type === "durability") {
                if (!options.durability) return undefined;
                return {
                    get damage() { return options.durability.damage; },
                    set damage(value) { options.durability.damage = value; },
                    get maxDurability() { return options.durability.maxDurability; }
                };
            }
            if (type === "enchantable") {
                if (!options.unbreaking) return undefined;
                return { getEnchantment: id => (id === "unbreaking" ? { level: options.unbreaking } : undefined) };
            }
            return undefined;
        }
    };
    return stack;
}

/** A pickaxe the pack accepts, optionally with durability and a mark. */
export function createPickaxe(options = {}) {
    return createItemStack("minecraft:iron_pickaxe", 1, { tags: ["minecraft:is_pickaxe"], ...options });
}

/** Waits for `ModalFormData.show().then(...)` handlers to run. */
export function flushPromises() {
    return new Promise(resolve => setImmediate(resolve));
}
