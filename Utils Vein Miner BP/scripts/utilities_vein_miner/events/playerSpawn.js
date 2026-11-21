import { world } from "@minecraft/server";
import { playersList, ALWAYS_SHOW_TAG } from "./runInterval";

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (!player?.isValid) return;
    // Checked on every spawn (join and respawn) instead of only on
    // `initialSpawn`, so a player who joins while the world is already running
    // is tracked too.
    if (player.hasTag(ALWAYS_SHOW_TAG))
        playersList.add(player);
    else
        playersList.delete(player);
});
