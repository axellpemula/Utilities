import { system } from "@minecraft/server";
import { TurnOffManager } from "../lib/player/turnOff";
import { apiConfig } from "../lib/player/config";
import { normalizeTurnOff } from "../lib/player/options";

/** @type {Map<string, TurnOffManager>} */
export const TimerTurnOff = new Map();

system.runInterval(() => {
    for (const [playerId, timer] of TimerTurnOff) {
        let keep = false;
        try {
            keep = timer.update();
        }
        catch (error) {
            // A stale timer (player left, entity invalid) must never spam the
            // log every interval: drop it instead.
            console.warn(`[utilities_vein_miner] dropping inactivity timer ${playerId}: ${error}`);
        }
        if (!keep) TimerTurnOff.delete(playerId);
    }
}, 200);

/**
 * @param {import("@minecraft/server").Player} player
 * @param {number} [timerIndex] defaults to the player's configured value
 */
export function setTurnOff(player, timerIndex) {
    const index = normalizeTurnOff(timerIndex ?? apiConfig.get(player).turnOff);
    if (index === 0) {
        TimerTurnOff.delete(player.id);
        return;
    }
    TimerTurnOff.set(player.id, new TurnOffManager(player, index));
}

/**
 * @param {string} playerId
 */
export function clearTurnOff(playerId) {
    TimerTurnOff.delete(playerId);
}
