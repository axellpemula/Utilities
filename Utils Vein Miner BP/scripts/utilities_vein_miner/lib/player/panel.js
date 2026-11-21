/**
 * Model of the Vein Miner settings panel.
 *
 * The panel is rendered by `functions/configUI.js` on top of a plain
 * `ActionFormData` (long form). The resource pack re-skins that form with the
 * custom window in `Utils Vein Miner RP/ui/uvm_settings.json`; the pack is
 * optional, and without it the very same form is drawn by the vanilla long
 * form renderer.
 *
 * Contract with the resource pack - everything below is duplicated there, so
 * `npm run validate` compares the two:
 *   - `PANEL_TAG` is put in front of the form title. The UI strips it and uses
 *     its presence to decide between the custom window and the vanilla form
 *     (`ui/_global_variables.json` -> `$uvm_panel_tag`).
 *   - `ROW_ON` / `ROW_OFF` are invisible markers put in front of a row that
 *     toggles a setting. The UI shows a toggle pill for those rows
 *     (`ui/uvm_settings.json` -> `uvm_settings.row_face`) and a chevron for
 *     the rest.
 * Both markers only use colour/style codes followed by a reset - they draw
 * nothing - so the text stays readable when the resource pack is not installed.
 *
 * This module is free of `@minecraft/server` imports so the layout and the
 * click handling can be unit tested (`tests/panel.test.js`).
 */
import {
    DEFAULT_CONFIG,
    EDGE_SIZE_MAX,
    EDGE_SIZE_MIN,
    FUNCTION_LIST,
    MAX_SIZE_MAX,
    MAX_SIZE_MIN,
    MAX_SIZE_STEP,
    TURN_OFF_LIST,
    isFunctionType,
    normalizeEdgeSize,
    normalizeMaxSize,
    normalizeTurnOff
} from "./options";

/** Invisible prefix that tells the resource pack "this long form is ours". */
export const PANEL_TAG = "§r§l§r";
/** Invisible prefix for a row that switches a setting on. */
export const ROW_ON = "§2§l§r";
/** Invisible prefix for a row that switches a setting off. */
export const ROW_OFF = "§8§l§r";

/** Every page the panel can show. */
export const PANEL_PAGES = Object.freeze([
    "main",
    "function",
    "turnOff",
    "maxSize",
    "edgeSize",
    "activation",
    "tool",
    "advanced",
    "deleteBlocks",
    "neverMine"
]);

/** Max Size is a slider in the vanilla panel; here it is a short list of steps. */
export const MAX_SIZE_CHOICES = Object.freeze([16, 32, 48, 64, 96, 128, 256, 512, 1024]);

/** @type {readonly number[]} */
export const EDGE_SIZE_CHOICES = Object.freeze([1, 2, 3, 4, 5]);

const KEY = Object.freeze({
    title: "ui.utilities_vein_miner:config.title",
    on: "ui.utilities_vein_miner:config.on",
    off: "ui.utilities_vein_miner:config.off",
    back: "ui.utilities_vein_miner:config.back",
    done: "ui.utilities_vein_miner:config.done",
    more: "ui.utilities_vein_miner:config.more",
    reset: "ui.utilities_vein_miner:config.reset",
    turnOffShort: "ui.utilities_vein_miner:config.turn_off_short",
    functionType: "ui.utilities_vein_miner:config.function_type",
    turnOff: "ui.utilities_vein_miner:config.turn_off",
    maxSize: "ui.utilities_vein_miner:config.max_size",
    thickEdges: "ui.utilities_vein_miner:config.thick_edges",
    advanced: "ui.utilities_vein_miner:config.advanced",
    deleteBlocks: "ui.utilities_vein_miner:config.delete_blocks",
    deleteBlocksHint: "ui.utilities_vein_miner:config.delete_blocks.hint",
    sectionMining: "ui.utilities_vein_miner:config.section.mining",
    sectionAppearance: "ui.utilities_vein_miner:config.section.appearance",
    sectionAdvanced: "ui.utilities_vein_miner:config.section.advanced",
    showSelection: "ui.utilities_vein_miner:config.show_selection",
    showWhenSneaking: "ui.utilities_vein_miner:config.show_when_sneaking",
    showInfo: "ui.utilities_vein_miner:config.show_info",
    quick: "ui.utilities_vein_miner:config.quick_settings",
    cancelNoDrop: "ui.utilities_vein_miner:config.cancel_no_drop",
    cancelOpenItem: "ui.utilities_vein_miner:config.cancel_open_item",
    autoAll: "ui.utilities_vein_miner:config.auto_all",
    onlyOre: "ui.utilities_vein_miner:config.only_ore",
    onlyLog: "ui.utilities_vein_miner:config.only_log",
    accuracy: "ui.utilities_vein_miner:config.accuracy",
    connectedDiagonals: "ui.utilities_vein_miner:config.connected_diagonals",
    activation: "ui.utilities_vein_miner:config.activation",
    activationSneak: "ui.utilities_vein_miner:config.activation.sneak",
    activationAlways: "ui.utilities_vein_miner:config.activation.always",
    requireSneak: "ui.utilities_vein_miner:config.require_sneak",
    markedToolsOnly: "ui.utilities_vein_miner:config.marked_tools_only",
    markTool: "ui.utilities_vein_miner:config.mark_tool",
    marked: "ui.utilities_vein_miner:config.marked",
    notMarked: "ui.utilities_vein_miner:config.not_marked",
    protectTool: "ui.utilities_vein_miner:config.protect_tool",
    sectionActivation: "ui.utilities_vein_miner:config.section.activation",
    maxSizeCap: "ui.utilities_vein_miner:config.max_size.cap",
    thisTool: "ui.utilities_vein_miner:config.this_tool",
    toolProfile: "ui.utilities_vein_miner:config.tool_profile",
    toolProfileHint: "ui.utilities_vein_miner:config.tool_profile.hint",
    toolFunction: "ui.utilities_vein_miner:config.this_tool.function",
    toolSize: "ui.utilities_vein_miner:config.this_tool.size",
    toolNone: "ui.utilities_vein_miner:config.this_tool.none",
    toolSave: "ui.utilities_vein_miner:config.this_tool.save",
    toolClear: "ui.utilities_vein_miner:config.this_tool.clear",
    neverMine: "ui.utilities_vein_miner:config.never_mine",
    neverMineHint: "ui.utilities_vein_miner:config.never_mine.hint"
});

/**
 * Settings that are a plain on/off switch, in panel order: `[config key,
 * language key]`. `showWhenSneaking` is not here - it is a player tag, not a
 * config field, and is handled by the caller.
 */
export const TOGGLE_SETTINGS = Object.freeze([
    ["showSelection", KEY.showSelection],
    ["accuracy", KEY.accuracy],
    ["requireSneak", KEY.requireSneak],
    ["markedToolsOnly", KEY.markedToolsOnly],
    ["protectTool", KEY.protectTool],
    ["toolProfile", KEY.toolProfile],
    ["showInfo", KEY.showInfo],
    ["quick", KEY.quick],
    ["cancelNoDrop", KEY.cancelNoDrop],
    ["autoAll", KEY.autoAll],
    ["cancelOpenItem", KEY.cancelOpenItem],
    ["onlyOre", KEY.onlyOre],
    ["onlyLog", KEY.onlyLog],
    ["connectedDiagonals", KEY.connectedDiagonals]
]);

/** Toggles on the "More Settings" page. */
const ADVANCED_TOGGLES = new Set([
    "protectTool",
    "showInfo",
    "quick",
    "cancelNoDrop",
    "autoAll",
    "cancelOpenItem",
    "onlyOre",
    "onlyLog",
    "connectedDiagonals"
]);

/** Toggles on the "Activation" page. */
const ACTIVATION_TOGGLES = new Set(["requireSneak", "markedToolsOnly"]);

/** Toggles on the "This Tool" page. */
const TOOL_TOGGLES = new Set(["toolProfile"]);

/**
 * @param {string} key
 * @returns {{ translate: string }}
 */
const translate = key => ({ translate: key });

/**
 * @param {string} text
 * @returns {{ text: string }}
 */
const text = value => ({ text: value });

/**
 * @param {...(({ text: string } | { translate: string }) | string)} parts
 * @returns {{ rawtext: Array<{ text?: string, translate?: string }> }}
 */
function raw(...parts) {
    return { rawtext: parts.map(part => (typeof part === "string" ? text(part) : part)) };
}

/**
 * Plain text of a form message - used by the tests and by the debug log.
 * @param {unknown} message
 * @returns {string}
 */
export function flatten(message) {
    if (message == null) return "";
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.map(flatten).join("");
    const value = /** @type {{ rawtext?: unknown, text?: unknown, translate?: unknown }} */ (message);
    if (Array.isArray(value.rawtext)) return value.rawtext.map(flatten).join("");
    if (typeof value.text === "string") return value.text;
    if (typeof value.translate === "string") return `[${value.translate}]`;
    return "";
}

/**
 * @param {string} languageKey
 * @param {boolean} value
 * @returns {{ rawtext: Array<{ text?: string, translate?: string }> }}
 */
function toggleRow(languageKey, value) {
    return raw(
        value ? ROW_ON : ROW_OFF,
        translate(languageKey),
        text("  "),
        text(value ? "§a" : "§c"),
        translate(value ? KEY.on : KEY.off)
    );
}

/**
 * `Name   value` with the value highlighted.
 * @param {string} languageKey
 * @param {{ text: string } | { translate: string }} value
 */
function valueRow(languageKey, value) {
    return raw(translate(languageKey), text("  "), text("§e"), value);
}

/**
 * `Name  123` - for rows whose value is a plain number.
 * @param {string} languageKey
 * @param {number} value
 */
function numberRow(languageKey, value) {
    return raw(translate(languageKey), text("  "), text(`§e${value}`));
}

/**
 * A row of a choice page, with the current value marked.
 * @param {boolean} selected
 * @param {{ text: string } | { translate: string }} label
 */
function choiceRow(selected, label) {
    return raw(text(selected ? "§a> " : "§8  "), label);
}

/**
 * @param {string} id
 * @returns {string} the translation key of a function type's label
 */
export function functionTypeLabel(id) {
    return `ui.utilities_vein_miner:config.function_type.${id}`;
}

/**
 * @param {number} index
 * @returns {string} the translation key of a turn-off option's label
 */
export function turnOffLabel(index) {
    return `ui.utilities_vein_miner:config.turn_off.${TURN_OFF_LIST[index]}`;
}

/**
 * @param {string} id
 * @returns {string} the vanilla block name key used by the delete-blocks page
 */
export function blockLabel(id) {
    const special = {
        "minecraft:stone": "stone.stone",
        "minecraft:andesite": "stone.andesite",
        "minecraft:diorite": "stone.diorite",
        "minecraft:granite": "stone.granite"
    }[id];
    return `tile.${special ?? id.replace("minecraft:", "")}.name`;
}

/**
 * Builds one page of the panel.
 *
 * `actions[i]` is the action of the i-th *button* of the page - buttons,
 * headers, labels and dividers share one collection in the form, but
 * `ActionFormData.show()` only reports the index among the buttons.
 *
 * @param {string} page one of `PANEL_PAGES`
 * @param {typeof DEFAULT_CONFIG} config
 * @param {{
 *   sneaking?: boolean,
 *   deleteBlocks?: Iterable<string>,
 *   blocks?: Iterable<string>,
 *   itemMarked?: boolean,
 *   maxSizeCap?: number,
 *   neverMine?: Iterable<string>,
 *   neverMineChoices?: string[],
 *   toolProfile?: { functionType?: string, maxSize?: number }
 * }} [context]
 * @returns {{
 *   title: string,
 *   elements: Array<{ type: "button" | "header" | "label" | "divider", text?: unknown }>,
 *   actions: string[]
 * }}
 */
export function buildPanel(page, config, context = {}) {
    /** @type {Array<{ type: "button" | "header" | "label" | "divider", text?: unknown }>} */
    const elements = [];
    /** @type {string[]} */
    const actions = [];

    const header = languageKey => elements.push({ type: "header", text: languageKey });
    const label = message => elements.push({ type: "label", text: message });
    const divider = () => elements.push({ type: "divider" });
    const button = (message, action) => {
        elements.push({ type: "button", text: message });
        actions.push(action);
    };
    const back = () => button(raw(translate(KEY.back)), "page|main");
    /**
     * One page of block toggles, shared by "Delete Blocks" and "Never Mine".
     * @param {string} list storage name used in the action
     * @param {string} title
     * @param {string} hint
     * @param {Iterable<string>} [selected]
     * @param {string[]} [choices]
     */
    const listPage = (list, title, hint, selected, choices) => {
        const chosen = new Set(selected ?? []);
        header(title);
        label(raw(text("§7"), translate(hint)));
        for (const id of choices ?? [])
            button(toggleRow(blockLabel(id), chosen.has(id)), `block|${list}|${id}`);
        divider();
        back();
    };

    switch (page) {
        case "function": {
            header(KEY.functionType);
            for (const id of FUNCTION_LIST)
                button(choiceRow(config.functionType === id, translate(functionTypeLabel(id))), `set|functionType|${id}`);
            divider();
            back();
            return { title: KEY.functionType, elements, actions };
        }
        case "turnOff": {
            header(KEY.turnOff);
            for (let index = 0; index < TURN_OFF_LIST.length; index++)
                button(choiceRow(config.turnOff === index, translate(turnOffLabel(index))), `set|turnOff|${index}`);
            divider();
            back();
            return { title: KEY.turnOffShort, elements, actions };
        }
        case "maxSize": {
            const cap = typeof context.maxSizeCap === "number" ? context.maxSizeCap : undefined;
            header(KEY.maxSize);
            if (cap !== undefined)
                label(raw(text("§7"), { translate: KEY.maxSizeCap, with: [String(cap)] }));
            for (const size of MAX_SIZE_CHOICES) {
                if (cap !== undefined && size > cap) continue;
                button(choiceRow(config.maxSize === size, text(String(size))), `set|maxSize|${size}`);
            }
            divider();
            back();
            return { title: KEY.maxSize, elements, actions };
        }
        case "edgeSize": {
            header(KEY.thickEdges);
            for (const size of EDGE_SIZE_CHOICES)
                button(choiceRow(config.edgeSize === size, text(String(size))), `set|edgeSize|${size}`);
            divider();
            back();
            return { title: KEY.thickEdges, elements, actions };
        }
        case "activation": {
            header(KEY.sectionActivation);
            for (const [key, languageKey] of TOGGLE_SETTINGS) {
                if (!ACTIVATION_TOGGLES.has(key)) continue;
                button(toggleRow(languageKey, config[key] === true), `toggle|${key}`);
            }
            button(valueRow(KEY.markTool, translate(context.itemMarked ? KEY.marked : KEY.notMarked)), "tool|mark");
            divider();
            back();
            return { title: KEY.activation, elements, actions };
        }
        case "advanced": {
            header(KEY.sectionAdvanced);
            for (const [key, languageKey] of TOGGLE_SETTINGS) {
                if (!ADVANCED_TOGGLES.has(key)) continue; // main / activation page
                button(toggleRow(languageKey, config[key] === true), `toggle|${key}`);
            }
            divider();
            button(toggleRow(KEY.showWhenSneaking, context.sneaking === true), "toggle|showWhenSneaking");
            divider();
            button(raw(translate(KEY.reset)), "reset");
            back();
            return { title: KEY.advanced, elements, actions };
        }
        case "deleteBlocks": {
            listPage("deleteBlocks", KEY.deleteBlocks, KEY.deleteBlocksHint, context.deleteBlocks, context.blocks);
            return { title: KEY.deleteBlocks, elements, actions };
        }
        case "neverMine": {
            listPage("neverMine", KEY.neverMine, KEY.neverMineHint, context.neverMine, context.neverMineChoices);
            return { title: KEY.neverMine, elements, actions };
        }
        case "tool": {
            const profile = context.toolProfile;
            header(KEY.thisTool);
            label(raw(text("§7"), translate(KEY.toolProfileHint)));
            for (const [key, languageKey] of TOGGLE_SETTINGS) {
                if (!TOOL_TOGGLES.has(key)) continue;
                button(toggleRow(languageKey, config[key] === true), `toggle|${key}`);
            }
            label(raw(
                text("§7"), translate(KEY.toolFunction), text(" "),
                profile?.functionType ? translate(functionTypeLabel(profile.functionType)) : translate(KEY.toolNone)
            ));
            label(raw(
                text("§7"), translate(KEY.toolSize), text(" "),
                typeof profile?.maxSize === "number" ? text(String(profile.maxSize)) : translate(KEY.toolNone)
            ));
            button(valueRow(KEY.toolSave, text("")), "tool|save");
            button(valueRow(KEY.toolClear, text("")), "tool|clear");
            divider();
            back();
            return { title: KEY.thisTool, elements, actions };
        }
        case "main":
        default: {
            header(KEY.sectionMining);
            button(valueRow(KEY.functionType, translate(functionTypeLabel(config.functionType))), "page|function");
            button(valueRow(KEY.turnOffShort, translate(turnOffLabel(config.turnOff))), "page|turnOff");
            button(numberRow(KEY.maxSize, config.maxSize), "page|maxSize");
            button(valueRow(KEY.activation, translate(config.requireSneak === false ? KEY.activationAlways : KEY.activationSneak)), "page|activation");
            divider();
            header(KEY.sectionAppearance);
            button(toggleRow(KEY.showSelection, config.showSelection === true), "toggle|showSelection");
            button(toggleRow(KEY.showWhenSneaking, context.sneaking === true), "toggle|showWhenSneaking");
            button(toggleRow(KEY.accuracy, config.accuracy === true), "toggle|accuracy");
            button(numberRow(KEY.thickEdges, config.edgeSize), "page|edgeSize");
            divider();
            header(KEY.sectionAdvanced);
            button(raw(translate(KEY.more), text(" §7>")), "page|advanced");
            button(valueRow(KEY.thisTool, context.toolProfile?.functionType
                ? translate(functionTypeLabel(context.toolProfile.functionType))
                : translate(KEY.toolNone)), "page|tool");
            button(valueRow(KEY.neverMine, text(String(new Set(context.neverMine ?? []).size))), "page|neverMine");
            button(valueRow(KEY.deleteBlocks, text(String(new Set(context.deleteBlocks ?? []).size))), "page|deleteBlocks");
            divider();
            button(raw(translate(KEY.done)), "close");
            return { title: KEY.title, elements, actions };
        }
    }
}

/**
 * Applies a `toggle|key` or `set|key|value` action to a config object.
 *
 * The config is only touched when the action names a field that exists with
 * the right type, so a hand crafted or stale action can never write garbage
 * into the saved configuration.
 *
 * @param {typeof DEFAULT_CONFIG} config mutated in place
 * @param {string} action
 * @returns {boolean} whether something changed
 */
export function applySetting(config, action) {
    const [kind, key, value] = String(action).split("|");
    if (kind === "toggle") {
        const [setting] = TOGGLE_SETTINGS.find(([name]) => name === key) ?? [];
        if (!setting || typeof config[setting] !== "boolean") return false;
        config[setting] = !config[setting];
        return true;
    }
    if (kind !== "set") return false;

    if (key === "functionType") {
        if (!isFunctionType(value)) return false;
        config.functionType = value;
        return true;
    }
    if (key === "turnOff") {
        const index = Number(value);
        if (!Number.isInteger(index) || index < 0 || index >= TURN_OFF_LIST.length) return false;
        config.turnOff = normalizeTurnOff(index);
        return true;
    }
    if (key === "maxSize") {
        const size = Number(value);
        if (!Number.isFinite(size)) return false;
        config.maxSize = normalizeMaxSize(size);
        return true;
    }
    if (key === "edgeSize") {
        const size = Number(value);
        if (!Number.isFinite(size)) return false;
        config.edgeSize = normalizeEdgeSize(size);
        return true;
    }
    return false;
}

/**
 * The pages the panel can migrate to, checked against `PANEL_PAGES`.
 * @param {string} page
 * @returns {string}
 */
export function normalizePage(page) {
    return PANEL_PAGES.includes(page) ? page : "main";
}

/** Sanity of the choice lists against the schema, used by the tests. */
export const CHOICE_RANGES = Object.freeze({
    maxSize: { min: MAX_SIZE_MIN, max: MAX_SIZE_MAX, step: MAX_SIZE_STEP },
    edgeSize: { min: EDGE_SIZE_MIN, max: EDGE_SIZE_MAX, step: 1 }
});
