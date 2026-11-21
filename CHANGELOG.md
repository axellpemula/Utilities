# Changelog

All notable changes to Utils Vein Miner are documented here.
The repository history starts at v5.5, so entries before that are not recorded.

## 5.10.0

Third feature release: Bahasa Indonesia, two read-only commands for support, and a screenshot
gallery generated from the shipped textures.

### Added

- **Indonesian (`id_ID`)** translation with full key parity. The validator now checks three locales
  (`en_US`, `pt_BR`, `id_ID`) and fails on any key that exists in one but not the others
  (`RP/texts/id_ID.lang`, `BP/texts/id_ID.lang`).
- **`/uvm:veinminer_stats`** prints a two line summary of the caller's settings (function, size,
  edges, turn-off, both block lists, activation) and **`/uvm:veinminer_world`** prints the world
  cap and default function. Both are read only and available to every player, so support can ask
  for one command instead of walking through the panel (`events/customCommand.js`).
- **`npm run ui` now also writes a gallery**: `docs/panel-main.png`, `panel-activation.png`,
  `panel-tool.png`, `panel-never-mine.png`, rendered from the same textures the pack ships
  (`tools/gen_ui_textures.py`, `MockPage`).

### Notes

- Preview cost was reviewed rather than capped: the shape plan is bounded by Max Size (<= 1024),
  every shape yields per block, unloaded positions are skipped while breaking, and the outline is
  off by default - so there is no new guard rail to add.

## 5.9.0

Second feature release: protection against friendly fire on your own builds, and per-tool behaviour.

### Added

- **Never Mine.** A list of blocks that are left untouched, even in the middle of a vein (crafted
  stone family, deepslate, nether, prismarine, mud bricks, common terrain). The panel row counts the
  protected blocks; `/uvm:veinminer` shares the new block-list page with Delete Blocks
  (`lib/player/neverMine.js`, `lib/player/blockList.js`, `functions/controller.js`). Filtering
  happens in the controller, so every shape, the preview and the durability charge agree.
- **This Tool** (per tool profiles). *Save My Settings To This Tool* copies the current function and
  Max Size onto the held item (`utilities_vein_miner:tool_profile`), *Clear* removes it, and **Use
  Tool Profiles** turns the overrides on. One pickaxe can dig veins while another digs tunnels; all
  other settings stay attached to the player (`lib/item/toolProfile.js`).
- **`/uvm:veinminer_preset`** with `miner`, `builder`, `lumberjack` and `off` bundles. A preset only
  touches the fields it names, and an unknown name is rejected instead of wiping a configuration
  (`lib/player/presets.js`).

### Changed

- Delete Blocks and Never Mine share one block-list page (`block|<list>|<id>` actions), and
  **Reset to Defaults** now empties both lists.
- The main page gained *This Tool* and *Never Mine* rows.

## 5.8.0

Feature release: three long requested controls. No migration is needed - the new fields are merged
over the defaults, so existing saved settings keep working.

### Added

- **Activation switch.** `Require Sneaking` (default on) can be turned off, and vein mining then
  works while just holding a pickaxe - no sneak needed. `Only Marked Tools` narrows activation down
  to pickaxes marked from the panel (`Mark Held Tool`, stored as the item's
  `utilities_vein_miner:marked_tool` dynamic property), so a builder can keep vein mining on one
  tool. Sneaking still works as before, the sneak + right-click panel shortcut is unchanged, and
  without "Require Sneaking" a shovel can never start a vein
  (`lib/player/activation.js`, `events/{breakBlock,hitBlock,runInterval}.js`).
- **Protect My Tool.** Vein mining keeps the last durability point: the shape is planned around
  `remaining - 1` and the final point is never charged, so a vein can no longer leave the pickaxe
  one hit away from breaking. The player is warned when the guard stops the run
  (`lib/item/durability.js`, `lib/item/durabilityMath.js`, shapes, `functions/controller.js`).
- **World defaults and limits** for realms/servers, stored on the world:
  - `/uvm:veinminer_maxsize <blocks>` (operators) caps everyone's Max Size; `0` removes the cap.
  - `/uvm:veinminer_default <function>` sets what players without a saved configuration start with.
  The cap is applied whenever a configuration is read *or* written, and the Max Size page hides
  sizes above it (`lib/player/worldConfig.js`, `lib/player/options.js`, `events/customCommand.js`).
- New panel page **Activation** (sneak/always, marked tools, mark held tool) and a
  **Protect My Tool** toggle on the advanced page; **Reset to Defaults** now returns to the world
  defaults when an operator set them.

## 5.7.0

Feature release. The settings panel is now a **custom window** instead of the plain Bedrock form,
and every change applies immediately. No migration is needed: the stored schema
(`utilities_vein_miner:config_info`), the delete-blocks property, the `/uvm:veinminer` command, the
language keys and the sneak + right-click shortcut are unchanged.

### Added

- **Custom settings panel.** `RP/ui/uvm_settings.json` draws the panel in its own copper-on-slate
  window - title bar, section headers, rows with toggle pills and chevrons, scrollbar - using
  textures generated by `tools/gen_ui_textures.py` (preview: `docs/settings-panel-preview.png`).
  `RP/ui/server_form.json` routes only long forms whose title carries the panel tag to the custom
  window, so vanilla forms and other add-ons keep the vanilla renderer
  (`ui/_ui_defs.json`, `ui/_global_variables.json`, `ui/uvm_settings.json`, `ui/server_form.json`,
  `textures/ui/utilities_vein_miner/`).
- **`lib/player/panel.js`** - a pure, unit tested model of the panel (pages, rows, state markers,
  click handling). The panel is one tap per setting instead of one form per change, with pages for
  functions, turn-off timer, max size, edge thickness, advanced toggles and delete blocks, plus
  **Reset to Defaults**.
- `tools/gen_ui_textures.py` and `npm run ui`: regenerate every window texture and the preview
  without third party modules.
- Static UI checks in `tools/validate.mjs`: unregistered `ui/*.json` files, unresolvable texture
  references, broken nine-slice descriptors, `@namespace.control` references that point at nothing,
  and panel markers that drifted between the script and the resource pack.

### Changed

- The panel saves each click immediately; **Done** only closes it. Closing with `Esc` no longer
  claims the settings were undone (`warning.utilities_vein_miner:config_canceled` now reads
  "Settings Panel Closed").
- Max Size uses a short list of steps (16 - 1024) instead of a slider, and the function, turn-off
  and edge-thickness pickers are their own pages.
- Requires Minecraft 1.21.110+ as before; no script module version changed.

## 5.6.0

Bug fix release. No configuration migration is needed: saved settings are merged over the defaults,
so every player keeps their current selection.

### Fixed

- **Edge preview leaked for almost every player.** Markers were only cleaned up for players with
  the `alwaysShowEdges` tag, and the entity's 3 second despawn timer does not run in unloaded
  chunks, so markers could stay behind after you stopped sneaking, disabled the option, or left.
  Previews are now tracked per player, removed on leave, swept on world load, and the marker
  lifetime was raised to 30 seconds so a preview no longer disappears while you hold still
  (`functions/preview.js`, `events/runInterval.js`, `events/playerLeave.js`, `main.js`,
  `entities/utilities_vein_miner/selected_block.json`).
- **One player could freeze the preview for everyone.** Two early exits inside the player loop in
  `events/runInterval.js` used `return` instead of `continue`.
- **Players inherited each other's settings.** `apiConfig.get()` returned the shared
  `defaultConfig` object, so the first player to change a setting changed it for everybody who had
  not saved a config yet (`lib/player/config.js`).
- **"No Open Panel With Pickaxe" never worked.** There was no toggle for it and the Delete Blocks
  toggle wrote its value; the setting is now in the advanced form and is honoured by
  `events/itemUse.js`.
- **A corrupt dynamic property disabled the add-on for that player.** Config and delete-block
  reads are now parsed defensively and fall back per field (`lib/player/config.js`,
  `lib/player/deleteBlocks.js`).
- **Unbreaking was over-counted.** The durability bonus was `remaining * (level + 2)` (3x at
  Unbreaking I, 5x at III); it is now `remaining * (level + 1)` with per-block damage rolls
  (`lib/item/durabilityMath.js`, `lib/item/durability.js`).
- **Vein mining charged one durability too many** for the origin block when vanilla had already
  damaged the tool (`functions/controller.js`, `events/breakBlock.js`).
- **Position keys collided.** `(x << 20) ^ (y << 10) ^ z` aliased e.g. `(4096,0,0)` onto `(0,0,0)`,
  so the flood fill could skip real blocks and the preview could report false neighbours
  (`lib/util/position.js`).
- **Experience was calculated from one arbitrary neighbour** and could be skipped entirely if that
  block was already broken; each block now uses its own experience table. The no-op item teleport
  that could abort the break job was removed (`functions/break.js`).
- **Inactivity timers kept invalid players** and threw every 10 seconds; all per-player state is now
  released on leave (`functions/turnOffTimer.js`, `events/playerLeave.js`).
- **The last block found could be dropped** when a shape reached the size limit
  (`lib/block/minerShape/getAll.js`, `getTunnel.js`).
- **Staircase tunnels picked the wrong direction** at exactly 45/135/315 degrees
  (`lib/block/directions.js`).
- **Non-player entities** (arrows, mobs) triggered config lookups in `events/hitBlock.js`.
- `world.getLootTableManager()` is resolved lazily instead of through a mutable export inside a
  circular import (`lib/loot/loot.js`).

### Changed

- The Delete Blocks panel is derived from the ore/stone block list instead of a hardcoded subset
  (8 → 28 choices, same default of "none").
- Opening the settings panel no longer resets a pending inactivity turn-off.
- The resource pack no longer declares a dependency back on the behaviour pack (circular pack
  dependency).
- Removed `capabilities: ["pbr"]` from the resource pack manifest; the pack no longer risks being
  filtered out on devices without the deferred rendering pipeline.
- Creative mode no longer spawns item and experience entities while vein mining (vanilla creative
  drops nothing); the blocks are still removed.
- Preview spawn pacing yields more often to stay inside the script watchdog budget.
- Opening the panel is refused when `cancelOpenItem` is enabled.

### Internal

- Removed dead code: `apiDurability.generateUnbreakingChange`, `apiEquippable.getItem/getItems`,
  `Variables.maxTunnel*`, duplicated preview corner offsets, unused translation keys.
- Renamed `events/customCammand.js` → `events/customCommand.js`,
  `apiBlock.getFaceDregress` → `apiBlock.getFaceDirectionIndex`.
- Split the shape/config/durability math into dependency-free modules so it can be unit tested.
- Added `npm test` (34 tests), `npm run validate` (JSON, import graph, manifests, translations),
  `npm run build` (`.mcaddon` packager) and a GitHub Actions workflow.
- Manifests, lang files and both packs are now strict JSON / consistent at 5.6.0.
