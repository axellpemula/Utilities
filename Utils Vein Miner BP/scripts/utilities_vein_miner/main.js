import { system } from "@minecraft/server";
import { borderFunctions } from "./functions/preview";
import "./functions/turnOffTimer";
import "./events/index";

// Edge markers are ordinary entities and persist in the save. Sweep any that
// survived a crash or a player leaving mid-preview before anyone sees them.
system.run(() => {
    system.runJob(borderFunctions.removeAll());
});
