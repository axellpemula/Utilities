import { world, system } from "@minecraft/server";
import { apiConfig } from "../lib/player/config";
import { apiDeleteBlocks } from "../lib/player/deleteBlocks";
import { clearTurnOff } from "../functions/turnOffTimer";
import { borderFunctions, previewOwners } from "../functions/preview";
import { forgetPlayer } from "./runInterval";

world.beforeEvents.playerLeave.subscribe(({ player }) => {
    if (!player) return;
    const playerId = player.id;
    const owner = previewOwners.get(playerId);

    // Free per player state: these maps used to grow for the whole session and
    // inactivity timers kept touching players that were no longer valid.
    apiConfig.clear(playerId);
    apiDeleteBlocks.clear(playerId);
    clearTurnOff(playerId);
    forgetPlayer(playerId);

    // Edge markers are real entities; remove them after the read-only event.
    if (owner) system.runJob(borderFunctions.removeByOwner(owner.dimension, playerId));
});
