/**
 * Node module hooks so the pack's modules can be imported unchanged:
 *  - `@minecraft/server` / `@minecraft/server-ui` resolve to the mocks
 *  - extensionless relative imports (`from "../variables"`, the Bedrock
 *    convention) resolve to `<specifier>.js`
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MOCKS = {
    "@minecraft/server": new URL("./mock-server.mjs", import.meta.url).href,
    "@minecraft/server-ui": new URL("./mock-server-ui.mjs", import.meta.url).href
};

export async function resolve(specifier, context, nextResolve) {
    if (MOCKS[specifier]) return { url: MOCKS[specifier], shortCircuit: true };

    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
        const hasExtension = /\.(?:m|c)?js$/.test(specifier);
        if (!hasExtension) {
            const candidate = new URL(`${specifier}.js`, context.parentURL);
            if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
        }
    }

    return nextResolve(specifier, context);
}
