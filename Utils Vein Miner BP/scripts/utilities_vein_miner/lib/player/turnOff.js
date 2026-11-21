import { TimerTurnOff } from "../../functions/turnOffTimer";
import { apiConfig } from "./config";
import { apiWarn } from "./warn";
export class TurnOffManager {
    constructor(player, timerIndex) {
        this.player = player;
        const executions = timeList[timerIndex];
        this.time = executions ?? 1;
    }
    update() {
        if (this.time == 0) {
            const config = apiConfig.get(this.player);
            config.functionType = "off";
            apiConfig.set(this.player, config);
            apiWarn.notify(this.player, "warning.utilities_vein_miner:turned_off", { type: "action_bar" });
            TimerTurnOff.delete(this.player.id);
            return;
        }
        this.time--;
    }
}
const timeList = [-1, 6, 12, 30, 60];
