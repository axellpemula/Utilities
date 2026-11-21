import { apiConfig } from "./config";
import { apiWarn } from "./warn";
import { TURN_OFF_INTERVALS } from "./options";

/**
 * Inactivity timer for one player.
 *
 * It no longer imports `functions/turnOffTimer` (that was a circular import);
 * `update()` reports whether the entry should stay in the map.
 */
export class TurnOffManager {
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {number} timerIndex index into `TURN_OFF_INTERVALS`
     */
    constructor(player, timerIndex) {
        this.player = player;
        this.time = TURN_OFF_INTERVALS[timerIndex] ?? TURN_OFF_INTERVALS[1];
    }

    /**
     * @returns {boolean} false when this entry is finished and must be dropped
     */
    update() {
        // The player may have left the world; touching an invalid entity throws.
        if (!this.player?.isValid) return false;
        if (this.time <= 0) {
            try {
                const config = apiConfig.get(this.player);
                config.functionType = "off";
                apiConfig.set(this.player, config);
                apiWarn.notify(this.player, "warning.utilities_vein_miner:turned_off", { type: "action_bar" });
            }
            catch (error) {
                console.warn(`[utilities_vein_miner] failed to turn off vein miner: ${error}`);
            }
            return false;
        }
        this.time--;
        return true;
    }
}
