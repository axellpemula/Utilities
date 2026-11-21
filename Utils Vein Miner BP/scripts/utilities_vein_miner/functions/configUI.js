import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { system, EquipmentSlot } from "@minecraft/server";
import { apiConfig } from "../lib/player/config";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { apiNeverMine } from "../lib/player/neverMine";
import { TOOL_PROFILE, readToolProfile } from "../lib/item/toolProfile";
import { apiEquippable } from "../lib/player/equippable";
import { sanitizeConfig } from "../lib/player/options";
import { apiWorldConfig } from "../lib/player/worldConfig";
import { TOOL_MARK, isMarkedTool } from "../lib/player/activation";
import {
    PANEL_PAGES,
    PANEL_TAG,
    applySetting,
    buildPanel,
    normalizePage
} from "../lib/player/panel";
import { apiWarn } from "../lib/player/warn";
import { ALWAYS_SHOW_TAG, playersList } from "../events/runInterval";
import { setTurnOff } from "./turnOffTimer";
import { borderFunctions, previewOwners } from "./preview";

/** Re-opens a form this many times before giving up on `UserBusy`. */
const BUSY_RETRIES = 20;

/**
 * The settings panel.
 *
 * Every page is a long form built by `lib/player/panel.js` and shown through
 * `ActionFormData`. Nothing here needs the resource pack: without it the vanilla
 * long form renders the same rows. With it, `ui/server_form.json` recognises
 * `PANEL_TAG` in the title and draws the custom window from
 * `ui/uvm_settings.json` instead.
 */
export const configPanel = new class ConfigPanel {
    /**
     * @param {import("@minecraft/server").Player} player
     */
    open(player) {
        if (!player?.isValid) return;
        this.show(player, "main");
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} page
     * @param {number} [attempt] retries used after a `UserBusy` rejection
     */
    show(player, page, attempt = 0) {
        const current = normalizePage(page);
        const view = buildPanel(current, apiConfig.get(player), this.context(player));
        const form = new ActionFormData().title({ rawtext: [{ text: PANEL_TAG }, { translate: view.title }] });
        for (const element of view.elements) {
            if (element.type === "header") form.header(element.text);
            else if (element.type === "label") form.label(element.text);
            else if (element.type === "divider") form.divider();
            else form.button(element.text);
        }
        form.show(player)
            .then(response => this.handleResponse(player, current, view, response, attempt))
            .catch(error => this.handleError(player, error));
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @returns {{ sneaking: boolean, itemMarked: boolean, maxSizeCap?: number, toolProfile?: { functionType?: string, maxSize?: number }, deleteBlocks: Set<string>, blocks: string[], neverMine: Set<string>, neverMineChoices: string[] }}
     */
    context(player) {
        let sneaking = false;
        let item;
        try {
            sneaking = player.hasTag(ALWAYS_SHOW_TAG);
            item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
        }
        catch {
            // An invalid entity is handled by the next click; the panel can
            // still be drawn from the cached configuration.
        }
        return {
            sneaking,
            itemMarked: isMarkedTool(item),
            maxSizeCap: apiWorldConfig.maxSizeCap,
            toolProfile: readToolProfile(item),
            deleteBlocks: apiDeleteBlocks.get(player),
            blocks: apiDeleteBlocks.allBlocks,
            neverMine: apiNeverMine.get(player),
            neverMineChoices: apiNeverMine.allBlocks
        };
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} page
     * @param {ReturnType<typeof buildPanel>} view
     * @param {{ canceled?: boolean, selection?: number, cancelationReason?: string }} response
     * @param {number} attempt
     */
    handleResponse(player, page, view, response, attempt) {
        if (!player?.isValid) return;

        if (response.canceled || typeof response.selection !== "number") {
            // Closing and re-opening a form in the same tick can be rejected
            // with "user busy"; retry instead of silently dropping the panel.
            if (response.cancelationReason === FormCancelationReason.UserBusy && attempt < BUSY_RETRIES) {
                system.runTimeout(() => this.show(player, page, attempt + 1), 2);
                return;
            }
            this.notifyCanceled(player);
            return;
        }

        const action = view.actions[response.selection];
        if (typeof action !== "string") return;

        const next = this.apply(player, action, page);
        if (next === null) return;
        // The form was closed the moment the player clicked: showing the next
        // one on the next tick avoids the engine's one-form-at-a-time guard.
        system.run(() => this.show(player, next));
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} action
     * @param {string} page the page the action was clicked on
     * @returns {string | null} the page to show next, or null to close the panel
     */
    apply(player, action, page) {
        const [kind, key, value] = action.split("|");

        if (kind === "close") {
            apiWarn.notify(player, "warning.utilities_vein_miner:config_complete", { type: "action_bar", sound: "utilities_vein_miner.warn.break_amethyst" });
            return null;
        }
        if (kind === "page") return PANEL_PAGES.includes(key) ? key : page;
        if (kind === "reset") {
            this.reset(player);
            return "main";
        }
        if (kind === "block") {
            this.toggleBlock(player, key, value);
            return page;
        }
        if (kind === "tool") {
            if (key === "save") this.saveToolProfile(player);
            else if (key === "clear") this.clearToolProfile(player);
            else this.toggleToolMark(player);
            return page;
        }
        if (kind === "toggle" && action === "toggle|showWhenSneaking") {
            this.toggleSneaking(player);
            return page;
        }
        this.write(player, action);
        return page;
    }

    /**
     * Applies a `toggle|`/`set|` action, saves it and runs the side effects the
     * setting has outside of the form.
     * @param {import("@minecraft/server").Player} player
     * @param {string} action
     */
    write(player, action) {
        const config = apiConfig.get(player);
        const before = { ...config };
        if (!applySetting(config, action)) return;
        const saved = apiConfig.set(player, config);

        if (before.showSelection && !saved.showSelection && previewOwners.has(player.id))
            system.runJob(borderFunctions.remove(player));
        if (!before.quick && saved.quick)
            apiWarn.notify(player, "warning.utilities_vein_miner:quick_setting_enabled");
        // Only touch the inactivity timer when it actually changed, so opening
        // the panel no longer resets a pending turn-off.
        if (saved.turnOff !== before.turnOff || (before.functionType === "off" && saved.functionType !== "off"))
            setTurnOff(player, saved.turnOff);
    }

    /**
     * @param {import("@minecraft/server").Player} player
     */
    toggleSneaking(player) {
        try {
            if (player.hasTag(ALWAYS_SHOW_TAG)) {
                player.removeTag(ALWAYS_SHOW_TAG);
                playersList.delete(player);
                // The outline is only kept alive while the player sneaks or
                // carries the tag, so drop it now instead of waiting for the
                // entity's despawn timer.
                if (!player.isSneaking && previewOwners.has(player.id))
                    system.runJob(borderFunctions.remove(player));
            }
            else {
                player.addTag(ALWAYS_SHOW_TAG);
                playersList.add(player);
            }
        }
        catch (error) {
            this.handleError(player, error);
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} id block type id
     */
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} list "deleteBlocks" or "neverMine"
     * @param {string} id
     */
    toggleBlock(player, list, id) {
        const blocks = list === "neverMine" ? apiNeverMine : list === "deleteBlocks" ? apiDeleteBlocks : undefined;
        if (!blocks || !blocks.allBlocks.includes(id)) return;
        const selected = new Set(blocks.get(player));
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        blocks.set(player, selected);
    }

    /**
     * Copies the player's current function and Max Size onto the held tool, so
     * one pickaxe can dig veins while another digs tunnels.
     * @param {import("@minecraft/server").Player} player
     */
    saveToolProfile(player) {
        try {
            const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
            if (!item) {
                apiWarn.notify(player, "warning.utilities_vein_miner:tool_missing", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
                return;
            }
            const config = apiConfig.get(player);
            item.setDynamicProperty(TOOL_PROFILE, JSON.stringify({ functionType: config.functionType, maxSize: config.maxSize }));
            apiEquippable.setItem(player, item, EquipmentSlot.Mainhand);
            apiWarn.notify(player, "warning.utilities_vein_miner:tool_profile_saved", { type: "action_bar", sound: "utilities_vein_miner.warn.break_amethyst" });
        }
        catch (error) {
            this.handleError(player, error);
        }
    }

    /**
     * @param {import("@minecraft/server").Player} player
     */
    clearToolProfile(player) {
        try {
            const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
            if (!item) {
                apiWarn.notify(player, "warning.utilities_vein_miner:tool_missing", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
                return;
            }
            item.setDynamicProperty(TOOL_PROFILE, undefined);
            apiEquippable.setItem(player, item, EquipmentSlot.Mainhand);
            apiWarn.notify(player, "warning.utilities_vein_miner:tool_profile_cleared", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
        }
        catch (error) {
            this.handleError(player, error);
        }
    }

    /**
     * Marks or unmarks the held tool, so "Only Marked Tools" can be used to
     * keep vein mining on one pickaxe only.
     * @param {import("@minecraft/server").Player} player
     */
    toggleToolMark(player) {
        try {
            const item = apiEquippable.getItemSlot(player, EquipmentSlot.Mainhand);
            if (!item) {
                apiWarn.notify(player, "warning.utilities_vein_miner:tool_missing", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
                return;
            }
            const marked = isMarkedTool(item);
            item.setDynamicProperty(TOOL_MARK, marked ? undefined : true);
            apiEquippable.setItem(player, item, EquipmentSlot.Mainhand);
            apiWarn.notify(
                player,
                marked ? "warning.utilities_vein_miner:tool_unmarked" : "warning.utilities_vein_miner:tool_marked",
                { type: "action_bar", sound: "utilities_vein_miner.warn.break_amethyst" }
            );
        }
        catch (error) {
            this.handleError(player, error);
        }
    }

    /**
     * Back to the world defaults (or the shipped ones), including the player
     * tag and the timer.
     * @param {import("@minecraft/server").Player} player
     */
    reset(player) {
        const config = apiConfig.get(player);
        const clean = sanitizeConfig({}, apiWorldConfig.get());
        for (const key of Object.keys(clean)) config[key] = clean[key];
        apiConfig.set(player, config);

        try {
            if (player.hasTag(ALWAYS_SHOW_TAG)) {
                player.removeTag(ALWAYS_SHOW_TAG);
                playersList.delete(player);
                // The outline is only kept alive while the player sneaks or
                // carries the tag, so drop it now instead of waiting for the
                // entity's despawn timer.
                if (!player.isSneaking && previewOwners.has(player.id))
                    system.runJob(borderFunctions.remove(player));
            }
        }
        catch {
            // ignore: the tag is cosmetic
        }
        apiDeleteBlocks.set(player, []);
        apiNeverMine.set(player, []);
        setTurnOff(player, clean.turnOff);
        if (previewOwners.has(player.id))
            system.runJob(borderFunctions.remove(player));
        apiWarn.notify(player, "warning.utilities_vein_miner:config_reset", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
    }

    /**
     * @param {import("@minecraft/server").Player} player
     */
    notifyCanceled(player) {
        apiWarn.notify(player, "warning.utilities_vein_miner:config_canceled", { type: "action_bar", sound: "utilities_vein_miner.warn.break" });
    }

    /**
     * @param {import("@minecraft/server").Player} player
     * @param {unknown} error
     */
    handleError(player, error) {
        // Forms reject when the player is busy/left; an unhandled rejection used
        // to surface as a silent failure.
        console.warn(`[utilities_vein_miner] settings panel error for ${player?.id}: ${error}`);
    }
};
