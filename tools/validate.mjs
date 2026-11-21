#!/usr/bin/env node
/**
 * Static checks for the Utils Vein Miner packs.
 *
 * `npm run validate` - fails on anything that would break the add-on in game
 * or that standard tooling cannot read:
 *   - JSON files that are not strict JSON (Bedrock / most editors are lenient,
 *     which hides real syntax errors)
 *   - script syntax errors
 *   - relative imports that do not resolve, or circular imports
 *   - manifest UUID / version / dependency mismatches
 *   - missing or drifting translations
 *   - function types that have no shape implementation
 *   - resource pack UI files that are not registered, texture references that
 *     do not resolve, broken nine-slice descriptors, and settings panel markers
 *     that drifted between the script and the UI
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BP_DIR = "Utils Vein Miner BP";
const RP_DIR = "Utils Vein Miner RP";
const SCRIPT_ROOT = join(BP_DIR, "scripts");
const LOCALES = ["en_US", "pt_BR", "id_ID"];

const errors = [];
const failures = [];

function fail(message) {
    failures.push(message);
}

function check(condition, message) {
    if (!condition) fail(message);
}

function walk(dir, predicate) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...walk(full, predicate));
        else if (predicate(full)) found.push(full);
    }
    return found;
}

/* ------------------------------------------------------------------ JSON -- */

const jsonFiles = [...walk(BP_DIR, f => extname(f) === ".json"), ...walk(RP_DIR, f => extname(f) === ".json")];
for (const file of jsonFiles) {
    const source = readFileSync(join(ROOT, file), "utf8");
    try {
        JSON.parse(source);
    }
    catch (error) {
        fail(`${file}: not strict JSON (${error.message})`);
    }
}

/* ------------------------------------------------------------------ JS ---- */

const jsFiles = walk(SCRIPT_ROOT, f => extname(f) === ".js");

for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ["--check", join(ROOT, file)], { encoding: "utf8" });
    if (result.status !== 0) fail(`${file}: syntax error\n${result.stderr}`);
}

const importPattern = /(?:from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["'])/g;
const graph = new Map();

for (const file of jsFiles) {
    const source = readFileSync(join(ROOT, file), "utf8");
    const deps = [];
    for (const match of source.matchAll(importPattern)) {
        const spec = match[1] ?? match[2];
        let target = resolve(ROOT, dirname(file), spec);
        if (!existsSync(target) && existsSync(`${target}.js`)) target = `${target}.js`;
        if (!existsSync(target)) {
            fail(`${file}: unresolved import "${spec}"`);
            continue;
        }
        if (!target.startsWith(ROOT)) continue;
        deps.push(target);
    }
    graph.set(resolve(ROOT, file), deps);
}

const visitState = new Map();
function detectCycles(node, stack) {
    const state = visitState.get(node);
    if (state === "done") return;
    if (state === "visiting") {
        const cycle = [...stack.slice(stack.indexOf(node)), node].map(p => relative(ROOT, p)).join(" -> ");
        fail(`circular import: ${cycle}`);
        return;
    }
    visitState.set(node, "visiting");
    for (const dep of graph.get(node) ?? []) detectCycles(dep, [...stack, node]);
    visitState.set(node, "done");
}
for (const node of graph.keys()) detectCycles(node, []);

/* ------------------------------------------------------------- manifests -- */

const manifests = new Map();
for (const dir of [BP_DIR, RP_DIR]) {
    const path = `${dir}/manifest.json`;
    check(existsSync(join(ROOT, path)), `${path}: missing`);
    if (!existsSync(join(ROOT, path))) continue;
    try {
        manifests.set(dir, JSON.parse(readFileSync(join(ROOT, path), "utf8")));
    }
    catch {
        // already reported by the JSON check
    }
}

// Two passes: every pack uuid must be known before dependencies are checked,
// because a pack may depend on one that is listed later.
const uuidOwner = new Map();
const packByUuid = new Map();
for (const [dir, manifest] of manifests) {
    const ids = [manifest.header?.uuid, ...(manifest.modules ?? []).map(m => m.uuid)].filter(Boolean);
    for (const uuid of ids) packByUuid.set(uuid, dir);
}

for (const [dir, manifest] of manifests) {
    const header = manifest.header ?? {};
    check(Array.isArray(header.version) && header.version.length === 3, `${dir}/manifest.json: header.version must be [major, minor, patch]`);
    check(typeof header.uuid === "string", `${dir}/manifest.json: header.uuid missing`);
    check(header.description === "pack.description" || typeof header.description === "string", `${dir}/manifest.json: header.description must be a string`);

    const uuids = [header.uuid, ...(manifest.modules ?? []).map(m => m.uuid)].filter(Boolean);
    for (const uuid of uuids) {
        check(!uuidOwner.has(uuid), `${dir}/manifest.json: uuid ${uuid} already used by ${uuidOwner.get(uuid)}`);
        uuidOwner.set(uuid, dir);
    }

    for (const module of manifest.modules ?? []) {
        check(JSON.stringify(module.version) === JSON.stringify(header.version), `${dir}/manifest.json: module ${module.uuid} version ${JSON.stringify(module.version)} != header ${JSON.stringify(header.version)}`);
        if (module.type === "script") {
            const entry = join(dir, module.entry ?? "");
            check(!!module.entry && existsSync(join(ROOT, entry)), `${dir}/manifest.json: script entry "${module.entry}" does not exist`);
        }
    }

    for (const dependency of manifest.dependencies ?? []) {
        if (dependency.module_name) {
            check(typeof dependency.version === "string", `${dir}/manifest.json: module dependency ${dependency.module_name} needs a string version`);
            continue;
        }
        const dependencyDir = packByUuid.get(dependency.uuid);
        check(!!dependencyDir, `${dir}/manifest.json: dependency uuid ${dependency.uuid} does not match any pack in this repository`);
        const dependencyManifest = dependencyDir ? manifests.get(dependencyDir) : undefined;
        if (dependencyManifest) {
            check(
                JSON.stringify(dependency.version) === JSON.stringify(dependencyManifest.header.version),
                `${dir}/manifest.json: depends on ${dependencyDir} ${JSON.stringify(dependency.version)} but that pack is ${JSON.stringify(dependencyManifest.header.version)}`
            );
        }
    }
}

/* ------------------------------------------------------------------ lang -- */

function parseLang(path) {
    const entries = new Map();
    if (!existsSync(path)) return entries;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
        const separator = trimmed.indexOf("=");
        if (separator === -1) continue;
        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1);
        if (entries.has(key)) fail(`${relative(ROOT, path)}: duplicate translation key "${key}"`);
        entries.set(key, value);
    }
    return entries;
}

/** @type {Map<string, string>} */
const shippedKeys = new Map();
for (const dir of [BP_DIR, RP_DIR]) {
    const locales = new Map(LOCALES.map(locale => [locale, parseLang(join(ROOT, dir, "texts", `${locale}.lang`))]));
    for (const [locale, entries] of locales) {
        check(entries.size > 0, `${dir}/texts/${locale}.lang: empty or missing`);
        for (const key of entries.keys()) shippedKeys.set(key, locale);
    }
    const [reference, ...others] = [...locales.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [locale, entries] of others) {
        for (const key of reference[1].keys())
            check(entries.has(key), `${dir}/texts/${locale}.lang: missing "${key}" (present in ${reference[0]})`);
        for (const key of entries.keys())
            check(reference[1].has(key), `${dir}/texts/${reference[0]}.lang: missing "${key}" (present in ${locale})`);
    }
}

/* --------------------------------------------- translation key usage ----- */

const translationReference = /["'`]((?:ui|warning|commands)\.[A-Za-z0-9_:.\-]+)["'`]/g;
for (const file of jsFiles) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const match of source.matchAll(translationReference)) {
        const key = match[1];
        check(shippedKeys.has(key), `${file}: translation key "${key}" is not defined in any .lang file`);
    }
}

/* ------------------------------------------------------- function shapes -- */

const optionsSource = readFileSync(join(ROOT, SCRIPT_ROOT, "utilities_vein_miner/lib/player/options.js"), "utf8");
const functionListMatch = optionsSource.match(/FUNCTION_LIST\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
check(!!functionListMatch, "lib/player/options.js: FUNCTION_LIST not found");
if (functionListMatch) {
    const functionTypes = [...functionListMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const managerSource = readFileSync(join(ROOT, SCRIPT_ROOT, "utilities_vein_miner/lib/block/selectArea.js"), "utf8");
    for (const type of functionTypes) {
        if (type === "off") continue;
        check(managerSource.includes(`"${type}"(`), `lib/block/selectArea.js: no shape registered for function type "${type}"`);
    }
    for (const locale of LOCALES) {
        const entries = parseLang(join(ROOT, RP_DIR, "texts", `${locale}.lang`));
        for (const type of functionTypes)
            check(entries.has(`ui.utilities_vein_miner:config.function_type.${type}`), `${RP_DIR}/texts/${locale}.lang: missing dropdown label for "${type}"`);
    }
}

/* ------------------------------------------------------------------- UI -- */

// The settings window is JSON-UI plus a set of nine-slice textures. A typo in
// either one shows up in game as an invisible or missing control, so every
// reference is resolved here.

const UI_DIR = join(RP_DIR, "ui");
const uiFiles = existsSync(join(ROOT, UI_DIR)) ? walk(UI_DIR, file => extname(file) === ".json") : [];
check(uiFiles.length > 0, `${UI_DIR}: no UI files (the settings window needs ui/_ui_defs.json)`);

const uiDefsPath = join(UI_DIR, "_ui_defs.json");
// Files the game loads on its own: the registry itself, the shared variables,
// and overrides of a vanilla screen (a pack file with a vanilla name is merged
// into that screen, it must NOT be listed in _ui_defs.json).
const UI_REGISTRY = ["_ui_defs.json", "_global_variables.json"];
const UI_OVERRIDES = ["server_form.json"];
let registeredUi = [];
if (!existsSync(join(ROOT, uiDefsPath))) {
    fail(`${uiDefsPath}: missing`);
}
else {
    try {
        const defs = JSON.parse(readFileSync(join(ROOT, uiDefsPath), "utf8"));
        check(Array.isArray(defs.ui_defs), `${uiDefsPath}: "ui_defs" must be an array`);
        registeredUi = Array.isArray(defs.ui_defs) ? defs.ui_defs : [];
    }
    catch {
        // already reported by the JSON check
    }
}

for (const entry of registeredUi) {
    check(typeof entry === "string" && existsSync(join(ROOT, RP_DIR, entry)), `${uiDefsPath}: "${entry}" does not exist`);
}

for (const file of uiFiles) {
    const name = basename(file);
    const relativePath = relative(RP_DIR, file).split("\\").join("/");
    if (!UI_REGISTRY.includes(name) && !UI_OVERRIDES.includes(name)) {
        check(registeredUi.includes(relativePath), `${file}: not listed in ${uiDefsPath} (the game never loads it)`);
    }
    let parsed;
    try {
        parsed = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
    }
    catch {
        continue; // already reported by the JSON check
    }
    if (name !== "_global_variables.json" && name !== "_ui_defs.json") {
        check(typeof parsed.namespace === "string" && parsed.namespace.length > 0, `${file}: missing "namespace"`);
    }
}

/** width/height from the PNG header. */
function pngSize(file) {
    const buffer = readFileSync(join(ROOT, file));
    if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") return undefined;
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const texturePattern = /"(textures\/[^"$]+)"/g;
for (const file of uiFiles) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const match of source.matchAll(texturePattern)) {
        const texture = match[1];
        if (texture.endsWith(".json")) continue;
        check(existsSync(join(ROOT, RP_DIR, `${texture}.png`)), `${file}: texture "${texture}.png" does not exist`);
    }
}

// Nine-slice descriptor next to a texture: <name>.json describes <name>.png.
const uiTextureDir = join(RP_DIR, "textures", "ui");
check(existsSync(join(ROOT, uiTextureDir)), `${uiTextureDir}: missing (the settings window needs its textures)`);
const uiTextures = existsSync(join(ROOT, uiTextureDir)) ? walk(uiTextureDir, file => extname(file) === ".json") : [];
for (const file of uiTextures) {
    const descriptor = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
    const image = file.replace(/\.json$/, ".png");
    if (!existsSync(join(ROOT, image))) continue; // reported by the texture reference check when used

    const size = pngSize(image);
    const slices = descriptor.nineslice_size;
    check(Array.isArray(slices) && slices.length === 4 && slices.every(value => Number.isInteger(value) && value >= 0), `${file}: nineslice_size must be [left, top, right, bottom]`);
    check(Array.isArray(descriptor.base_size) && descriptor.base_size.length === 2, `${file}: base_size must be [width, height]`);
    if (size && Array.isArray(descriptor.base_size)) {
        check(descriptor.base_size[0] === size[0] && descriptor.base_size[1] === size[1], `${file}: base_size ${descriptor.base_size} != ${image} ${size}`);
        if (Array.isArray(slices)) {
            const [left, top, right, bottom] = slices;
            check(left + right < size[0], `${file}: left+right nineslice ${left + right} leaves no stretchable middle column in ${size[0]}px`);
            check(top + bottom < size[1], `${file}: top+bottom nineslice ${top + bottom} leaves no stretchable middle row in ${size[1]}px`);
        }
    }
}

// References inside our own namespaces (`@uvm_settings.row_button`) must point
// at a control that exists; vanilla namespaces are only partially overridden and
// are skipped.
for (const file of uiFiles) {
    const name = basename(file);
    if (UI_REGISTRY.includes(name)) continue;
    let parsed;
    try {
        parsed = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
    }
    catch {
        continue;
    }
    const namespace = parsed.namespace;
    if (typeof namespace !== "string" || !namespace.startsWith("uvm_")) continue;

    const defined = new Set(
        Object.keys(parsed).filter(key => key !== "namespace" && !key.includes("@") && !key.includes("|"))
    );
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const match of source.matchAll(new RegExp(`"@${namespace}\\.([A-Za-z0-9_]+)"`, "g"))) {
        check(defined.has(match[1]), `${file}: "@${namespace}.${match[1]}" is not a control in this file`);
    }
}

// The panel markers live in both the script and the UI; they must match or the
// custom window silently never matches a form.
const panelSource = readFileSync(join(ROOT, SCRIPT_ROOT, "utilities_vein_miner/lib/player/panel.js"), "utf8");
const globalVariablesPath = join(UI_DIR, "_global_variables.json");
if (existsSync(join(ROOT, globalVariablesPath))) {
    const globals = JSON.parse(readFileSync(join(ROOT, globalVariablesPath), "utf8"));
    const pairs = [
        ["PANEL_TAG", "$uvm_panel_tag"],
        ["ROW_ON", "$uvm_row_on"],
        ["ROW_OFF", "$uvm_row_off"]
    ];
    for (const [constant, variable] of pairs) {
        const match = panelSource.match(new RegExp(`export const ${constant} = "([^"]*)"`));
        check(!!match, `lib/player/panel.js: export const ${constant} not found`);
        if (match) check(globals[variable] === match[1], `${globalVariablesPath}: ${variable} ${JSON.stringify(globals[variable])} != ${constant} ${JSON.stringify(match[1])}`);
    }
}

/* ---------------------------------------------------------------- report -- */

for (const error of errors) console.error(`error: ${error}`);
if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problem(s) found:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}
console.log(`✓ validated ${jsonFiles.length} JSON files, ${jsFiles.length} scripts, ${manifests.size} manifests, ${shippedKeys.size} translation keys, ${uiFiles.length} UI files, ${uiTextures.length} nine-slice textures`);
