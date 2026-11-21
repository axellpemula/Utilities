import { system, world, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus as Status, Player } from "@minecraft/server";
import { configPanel } from "../functions/configUI";
import { setTurnOff } from "../functions/turnOffTimer";
import { apiConfig } from "../lib/player/config";
import { apiWarn } from "../lib/player/warn";
import { FUNCTION_LIST, MAX_SIZE_MAX, MAX_SIZE_MIN, TURN_OFF_LIST, isFunctionType, normalizeMaxSize } from "../lib/player/options";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { apiNeverMine } from "../lib/player/neverMine";
import { apiWorldConfig } from "../lib/player/worldConfig";
import { PRESET_LIST, applyPreset } from "../lib/player/presets";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerEnum("uvm:functions", [...FUNCTION_LIST]);
    customCommandRegistry.registerEnum("uvm:presets", [...PRESET_LIST]);
    customCommandRegistry.registerCommand({
        name: "uvm:veinminer",
        description: "commands.utilities_vein_miner.settings_panel",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any,
        optionalParameters: [
            { type: CustomCommandParamType.Enum, name: "uvm:functions" }
        ]
    }, (origin, type) => {
        const player = origin.sourceEntity;
        if (!(player instanceof Player))
            return { status: Status.Failure };
        try {
            if (type != undefined) {
                // Never trust the argument: an unknown enum value would be
                // stored as the function type and disable vein mining.
                if (!isFunctionType(type))
                    return { status: Status.Failure };
                const config = apiConfig.get(player);
                config.functionType = type;
                const saved = apiConfig.set(player, config);
                if (saved.functionType != "off")
                    setTurnOff(player, saved.turnOff);
                system.run(() => apiWarn.notify(player, "warning.utilities_vein_miner:config_complete", { type: "action_bar", sound: "utilities_vein_miner.warn.break_amethyst" }));
                return { status: Status.Success };
            }
            system.run(() => configPanel.open(player));
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer failed: ${error}`);
            return { status: Status.Failure };
        }
    });

    customCommandRegistry.registerCommand({
        name: "uvm:veinminer_preset",
        description: "commands.utilities_vein_miner.preset",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [
            { type: CustomCommandParamType.Enum, name: "uvm:presets" }
        ]
    }, (origin, name) => {
        const player = origin.sourceEntity;
        if (!(player instanceof Player))
            return { status: Status.Failure };
        try {
            // Never trust the argument: an unknown preset must not wipe a config.
            const next = applyPreset(apiConfig.get(player), name);
            if (!next)
                return { status: Status.Failure };
            const saved = apiConfig.set(player, next);
            if (saved.functionType != "off")
                setTurnOff(player, saved.turnOff);
            system.run(() => apiWarn.notify(player, "warning.utilities_vein_miner:preset_applied", { type: "action_bar", sound: "utilities_vein_miner.warn.break_amethyst" }));
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer_preset failed: ${error}`);
            return { status: Status.Failure };
        }
    });

    // ---------------------------------------------------------------- world --
    // Operator settings. They are stored on the world, so a realm keeps them
    // and every player is clamped the same way.

    customCommandRegistry.registerCommand({
        name: "uvm:veinminer_maxsize",
        description: "commands.utilities_vein_miner.world_limit",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.GameDirectors,
        mandatoryParameters: [
            { type: CustomCommandParamType.Integer, name: "blocks" }
        ]
    }, (_origin, blocks) => {
        try {
            const value = Math.floor(Number(blocks));
            if (!Number.isFinite(value) || value < 0)
                return { status: Status.Failure };
            if (value === 0) {
                apiWorldConfig.set({ maxSizeCap: undefined });
                world.sendMessage({ translate: "warning.utilities_vein_miner:world_limit_off" });
                return { status: Status.Success };
            }
            // Out of range values are clamped instead of rejected: the operator
            // sees what was actually stored in the confirmation.
            const cap = normalizeMaxSize(Math.min(Math.max(value, MAX_SIZE_MIN), MAX_SIZE_MAX));
            apiWorldConfig.set({ maxSizeCap: cap });
            world.sendMessage({ translate: "warning.utilities_vein_miner:world_limit", with: [String(cap)] });
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer_maxsize failed: ${error}`);
            return { status: Status.Failure };
        }
    });

    customCommandRegistry.registerCommand({
        name: "uvm:veinminer_default",
        description: "commands.utilities_vein_miner.world_default",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.GameDirectors,
        mandatoryParameters: [
            { type: CustomCommandParamType.Enum, name: "uvm:functions" }
        ]
    }, (_origin, type) => {
        try {
            if (!isFunctionType(type))
                return { status: Status.Failure };
            apiWorldConfig.set({ defaultFunction: type });
            world.sendMessage({
                "rawtext": [
                    { "translate": "warning.utilities_vein_miner:world_default" },
                    { "translate": `ui.utilities_vein_miner:config.function_type.${type}` }
                ]
            });
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer_default failed: ${error}`);
            return { status: Status.Failure };
        }
    });

    // ---------------------------------------------------------------- info --
    // Read only summaries: support can ask a player to run one command instead
    // of walking them through the whole panel.

    customCommandRegistry.registerCommand({
        name: "uvm:veinminer_stats",
        description: "commands.utilities_vein_miner.stats",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any
    }, (origin) => {
        const player = origin.sourceEntity;
        if (!(player instanceof Player))
            return { status: Status.Failure };
        try {
            const config = apiConfig.get(player);
            player.sendMessage({
                translate: "warning.utilities_vein_miner:stats",
                with: [
                    config.functionType,
                    String(config.maxSize),
                    config.showSelection ? "ON" : "OFF",
                    TURN_OFF_LIST[config.turnOff] ?? "no"
                ]
            });
            player.sendMessage({
                translate: "warning.utilities_vein_miner:stats_lists",
                with: [
                    String(apiNeverMine.get(player).size),
                    String(apiDeleteBlocks.get(player).size),
                    config.requireSneak ? "sneak" : "always"
                ]
            });
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer_stats failed: ${error}`);
            return { status: Status.Failure };
        }
    });

    customCommandRegistry.registerCommand({
        name: "uvm:veinminer_world",
        description: "commands.utilities_vein_miner.world_status",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any
    }, () => {
        try {
            const worldConfig = apiWorldConfig.get();
            world.sendMessage({
                translate: "warning.utilities_vein_miner:stats_world",
                with: [
                    worldConfig.maxSizeCap !== undefined ? String(worldConfig.maxSizeCap) : "-",
                    worldConfig.defaultFunction ?? "-"
                ]
            });
            return { status: Status.Success };
        }
        catch (error) {
            console.warn(`[utilities_vein_miner] /uvm:veinminer_world failed: ${error}`);
            return { status: Status.Failure };
        }
    });
});
