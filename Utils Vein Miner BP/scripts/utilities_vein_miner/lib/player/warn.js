import { world, system } from "@minecraft/server";

export const apiWarn = new class ApiWarn {
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string | import("@minecraft/server").RawMessage | import("@minecraft/server").RawMessage[]} message
     * @param {{type?: string, sound?: string, volume?: number, delaySound?: number, particle?: {id: string, pos: import("@minecraft/server").Vector3, dimension?: string, map?: string}, delayParticle?: number}} [options]
     */
    notify(player, message, options) {
        if (!player?.isValid) return;
        const type = options?.type ?? "chat";
        const execute = notifyTypes[type];
        if (execute && message) {
            try {
                execute(player, message);
            }
            catch {
                // Never let a UI call (e.g. read-only context) abort game logic.
            }
        }
        if (options?.sound) {
            system.runTimeout(() => {
                if (!player.isValid) return;
                try {
                    player.playSound(options.sound, { volume: options.volume });
                }
                catch {
                    // Invalid sound id / player left.
                }
            }, options.delaySound ?? 0);
        }
        if (options?.particle) {
            system.runTimeout(() => {
                const particle = options.particle;
                if (!particle || !player.isValid) return;
                try {
                    const dimension = particle.dimension ? world.getDimension(particle.dimension) : player.dimension;
                    dimension.spawnParticle(particle.id, particle.pos, particle.map);
                }
                catch {
                    // Unloaded chunk or unknown particle.
                }
            }, options.delayParticle ?? 0);
        }
    }
};

const notifyTypes = new class NotifyTypes {
    "chat"(player, message) { player.sendMessage(typeof message == "string" ? { translate: message } : message); }
    "action_bar"(player, message) { player.onScreenDisplay.setActionBar(typeof message == "string" ? { translate: message } : message); }
    "title"(player, message) { player.onScreenDisplay.setTitle(typeof message == "string" ? { translate: message } : message); }
};
