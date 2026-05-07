# Diep.io-Style Tank Arena System Design

## Problem Understanding

This project implements a playable online browser tank arena. The server is authoritative over movement, shooting, collisions, XP, upgrades, death, respawn, bots, shape spawning, and leaderboard state. The browser sends input only and renders snapshots.

Existing project findings before implementation:

- The folder was empty.
- There was no `package.json`, source code, README, tests, or git repository.
- Node.js and npm were available locally.

## Architecture Decision

Use vanilla JavaScript ES modules, Node.js, Canvas, and WebSocket via `ws`.

Reason:

- Canvas primitives are enough for the v1 tank/shape style.
- Server authority is simpler to review when gameplay rules are first-party code.
- One dependency keeps setup small and avoids framework-specific architecture before the game rules are proven.

## File Responsibilities

- `shared/config/gameConfig.js`: core world, tank, projectile, bot population, network, and debug constants.
- `shared/config/balanceConfig.js`: faster level pacing bands, starter upgrade points, and XP reward tuning.
- `shared/config/worldContentConfig.js`: center Alpha Pentagon tuning, spawn exclusion radii, UI copy, and bot center-target weights.
- `shared/config/eventObjectiveConfig.js`: Alpha Sector event timing, active caps, objective stats, reward split, bot-interest tuning, and UI colors.
- `shared/config/droneConfig.js`: control-branch drone caps, loadouts, rebuild timing, contact damage, Necromancer conversion chances, render colors, and debug/balance budgets.
- `shared/config/botProfileConfig.js`: bot personality profiles, spawn weights, reaction/aim/targeting values, class preferences, upgrade priorities, and rival/bounty tuning.
- `shared/config/combatFeelConfig.js`: shooting recoil, muzzle timing, projectile visual kinds, rocket/trap behavior, and contact damage tuning.
- `shared/config/combatFeedbackConfig.js`: damage-cause labels/colors, damage direction timing, high-impact toast threshold, and contact-event rate limiting.
- `shared/config/appConfig.js`: auth, API, storage, economy, shop, and matchmaking constants.
- `shared/config/shopCatalog.js`: cosmetic shop item definitions.
- `shared/config/tankClassConfig.js`: tank evolution tree, unlock levels, weapon pattern config, shared tank visual schema, and class role/budget metadata.
- `shared/config/tankClassIdentityConfig.js`: per-class player-facing identity metadata and allowed feedback profiles.
- `shared/sim/progression.js`: XP, level, score, upgrade point, and upgrade logic.
- `shared/sim/upgradePreview.js`: pure stat upgrade before/after previews, including drone-specific damage/rebuild interpretation for control classes.
- `shared/sim/classUpgradeViewModel.js`: pure class-upgrade prompt state, keyboard shortcut mapping, and branch-ordered tree grouping.
- `shared/sim/tankClassBalance.js`: pure focused-DPS, total-DPS, mobility, survivability, burst, role-budget, and visual-signature helpers.
- `shared/sim/tankWeaponFacts.js`: pure config-derived weapon fact summaries used by class cards, TREE titles, and tests.
- `shared/sim/tankRecoil.js`: pure directional recoil impulse, recoil clamping, and decay helpers shared by server and local prediction.
- `shared/sim/classPhysicsAudit.js`: pure class physics summaries and coherence checks for booster, radial, heavy, trap, and body class recoil roles.
- `shared/sim/damageSources.js`: pure projectile/contact damage cause normalization and player-facing cause formatting.
- `shared/sim/centerObjective.js`: world-center helpers, blocked-zone checks, contribution tracking, and shared reward calculation.
- `shared/sim/eventObjectives.js`: pure sector-event director math, objective records, contribution tracking, reward split, expiry, snapshots, and debug summaries.
- `shared/sim/drones.js`: pure drone entity creation, command targeting, orbit/attack/return motion, hit cooldowns, owner counts, snapshots, and Necromancer conversion checks.
- `shared/sim/droneBalance.js`: pure drone DPS/rebuild pressure summaries and budget validation for control branch loadouts.
- `shared/sim/botProfiles.js`: profile selection, fallback, application, and profile debug counts.
- `shared/sim/botRivals.js`: pure rival tier, revenge target, bounty reward, anti-farm, snapshot, and debug helpers.
- `shared/sim/spatialHash.js`: per-tick broad-phase hash for nearby AI and projectile collision candidates.
- `shared/sim/projectileBehaviors.js`: rocket detonation, spark creation, trap arming/hit budget, armed-trap projectile blocking, and projectile kind debug counts.
- `shared/sim/contactCollision.js`: pure tank/shape and tank/tank pushback plus body-damage formulas.
- `shared/sim/tankClasses.js`: class graph validation, branch unlock checks, class selection, weapon patterns, drone loadout lookup, and class stat modifiers.
- `shared/sim/tankClassIdentity.js`: class identity validation, class-card identity view models, projectile feedback profile fallback, and semantic class identity summaries.
- `shared/sim/economy.js`: persistent coin reward formulas and match soft cap.
- `shared/sim/cosmetics.js`: default inventory, equipped item validation, and loadout resolution.
- `shared/sim/collision.js`: circle collision and deterministic hit selection.
- `shared/sim/entityFactory.js`: tank, projectile, and shape entity schemas.
- `server/src/serverGame.js`: fixed-step authoritative simulation.
- `server/src/centerObjectiveSystem.js`: Alpha Pentagon lifecycle, damage contribution tracking, shared XP/coin awards, respawn, and debug snapshots.
- `server/src/eventObjectiveSystem.js`: timed sector event spawning, elite objective shape creation, contribution reward payout, expiry cleanup, Volatile Triangle spark bursts, and debug snapshots.
- `server/src/droneSystem.js`: server-authoritative drone rebuild, command movement, contact damage, projectile-vs-drone damage, owner cleanup, Necromancer shape conversion, snapshots, and debug counts.
- `server/src/accountStore.js`: JSON-backed account/session/inventory persistence.
- `server/src/runtimeConfig.js`: public beta env parsing and validation for port, public origins, proxy trust, secure cookies, persistent account path, WebSocket caps, backup interval, and shutdown grace.
- `server/src/serverHealth.js`: boot/ready/draining state and secret-free `/healthz`/`/readyz` snapshots.
- `server/src/accountBackups.js`: persistent storage write probe and bounded account JSON backup rotation.
- `server/src/authService.js`: username/password auth, password hashing, sessions, cookies, and rate limits.
- `server/src/shopService.js`: cosmetic catalog, purchase, and equip rules.
- `server/src/roomManager.js`: public quickplay room and custom room lifecycle.
- `server/src/roomSession.js`: one room plus its `ServerGame` instance and clients.
- `server/src/httpRouter.js`: static files, API routes, production origin checks, health/readiness routes, auth cookies, and debug endpoints.
- `server/src/networkHub.js`: WebSocket session handling, room-scoped message routing, origin allowlist, heartbeat ping/pong, max client guard, message-rate guard, and shutdown socket closure.
- `server/src/botController.js`: bot population, AI states, bot upgrade spending, and bot level governance.
- `server/src/spawnSystem.js`: safe spawn selection and weighted shape type selection.
- `client/src/main.js`: browser bootstrap and frame/input loop.
- `client/src/input/inputController.js`: keyboard, mouse, and server-input payload normalization.
- `client/src/input/touchControls.js`: mobile twin-stick touch state, movement vector, aim/fire, fire lock, and overlay view model.
- `client/src/input/touchControlsConfig.js`: touch-control radius, dead zone, side split, mobile breakpoint, and overlay fade tuning.
- `client/src/render/canvasRenderer.js`: world, tanks, drones, bullets, shapes, and minimap rendering.
- `client/src/render/arcadeWorldTheme.js`: bright arcade world color tokens.
- `client/src/render/renderQuality.js`: adaptive quality mode for decorative render cost.
- `client/src/render/tankClassIcons.js`: DOM/CSS tank icons for the evolution tree using the same class visual schema as the canvas tank renderer.
- `client/src/game/combatEffects.js`: snapshot-derived muzzle flashes and impact bursts.
- `client/src/game/onboarding.js`: client-only first-match guidance state, prompt priority, snapshot/death milestones, and persisted completion/dismissal.
- `client/src/audio/audioConfig.js`: audio asset manifest, SFX gain/pitch tuning, event rate limits, and CC0 source metadata.
- `client/src/audio/audioEngine.js`: browser audio unlock, `AudioContext` lifecycle, persisted settings application, music/SFX routing, and debug state.
- `client/src/audio/audioEvents.js`: pure snapshot/effect-to-audio event derivation and per-bucket rate limiting.
- `client/src/audio/sfxPlayer.js`: decoded SFX buffers, fallback tones, pitch variation, and voice budgeting.
- `client/src/audio/musicPlayer.js`: looping chill background music and screen-based volume fades.
- `client/src/ui/hud.js`: menu, HUD bars, stat upgrades, class upgrade cards, leaderboard, death screen, and debug overlay.
- `client/src/ui/upgradePanelState.js`: persisted collapsible stat-upgrade panel state and `U` hotkey logic.
- `client/src/ui/classUpgradePanel.js`: Diep-style class upgrade cards with click and `1`-`4` shortcuts.
- `client/src/ui/evolutionTreePanel.js`: in-game tank evolution diagram with branch-ordered columns.
- `client/src/ui/hudVisibility.js`: pure HUD visibility state for alive/dead/modal states.
- `client/src/ui/hudActionPriority.js`: pure "what matters now" action priority model for death, class choice, stat upgrades, Alpha urgency, combat danger, bot rival/bounty alerts, objective contest, and farming.
- `client/src/ui/hudLayout.js`: pure HUD safe-zone calculation used by CSS variables and layout tests.
- `client/src/ui/hudLayoutConfig.js`: HUD spacing, z-index, upgrade-panel, and class-card UI tuning.
- `client/src/ui/menuConfig.js`: menu copy, labels, control chips, and status text.
- `client/src/ui/menuViewModel.js`: pure menu state derivation for button, status, and saved-name behavior.
- `playwright.config.js`: browser smoke-test configuration that starts the real server on port `3101`.
- `tests/browser/smoke.spec.js`: runtime gameplay smoke coverage for boot, join, Admin level tooling, class-card tiering, TREE, F3, and mobile viewport join/touch overlay.
- `tests/browser/helpers/gameSmoke.js`: shared Playwright helpers for local API calls, stable UI waits, and console/page-error collection.

## State Model

Server state:

```js
RoomManager = {
  rooms: Map<string, RoomSession>
}

RoomSession = {
  id,
  name,
  type,
  regionId,
  maxPlayers,
  clients: Map<string, Client>,
  game: ServerGame
}

ServerGame = {
  tick,
  timeMs,
  tanks,
  projectiles,
  drones,
  shapes,
  centerObjective,
  eventObjectives,
  pendingEvents,
  pendingWeaponShots,
  clientToPlayer
}
```

Account state:

```js
Account = {
  id,
  username,
  passwordHash,
  salt,
  coins,
  inventory,
  equipped
}
```

Public beta runtime state:

```js
RuntimeConfig = {
  nodeEnv,
  production,
  port,
  publicBaseUrl,
  allowedOrigins,
  trustProxy,
  debugEndpointsEnabled,
  sessionCookieSecure,
  storage: { accountStorePath },
  websocket: {
    maxClients,
    heartbeatMs,
    heartbeatTimeoutMs,
    messageRateLimit
  },
  backups: {
    intervalMs,
    maxFiles
  },
  shutdownGraceMs
}

ServerHealth = {
  startedAtMs,
  ready,
  draining,
  storageReady,
  storageError,
  nodeEnv,
  version
}
```

Public beta server lifecycle:

- `booting`: configs validate and `ACCOUNT_STORE_PATH` is probed for write access.
- `ready`: HTTP, API, WebSocket, rooms, and account store are available; `/readyz` returns `200`.
- `draining`: `SIGTERM`/`SIGINT` clears simulation timers, closes WebSockets, stops accepting new HTTP work, and `/readyz` returns `503`.
- `stopped`: HTTP server closes or the shutdown grace timer forces exit.

Tank class state:

```js
TankClass = {
  id,
  name,
  unlockLevel,
  parentId,
  children,
  weaponPattern,
  active,
  statModifiers
}

Tank = {
  classId,
  classHistory,
  classUnlockChoices
}
```

Tank states:

- `alive`: accepts input, moves, fires, takes damage, regenerates.
- `dead`: cannot move/fire, waits for respawn.
- Respawn returns to `alive` at a safe spawn with full HP.

Touch-control states:

- `gameplayActive`: accepts touch starts/moves and can produce server input.
- Inactive gameplay: clears move/aim touches, fire lock, firing state, and overlay fade state so death/menu/modal cannot leave a stuck mobile fire input.
- Fire lock remains client-side input state only. It sends the same `fire: true` payload as holding the right stick and never changes server protocol.

Projectile states:

- `active`: moves and can hit tanks or shapes.
- `expired`: removed after TTL, world exit, or hit.
- Projectile kinds: `bullet`, `rocket`, `spark`, and `trap`.
- Traps transition from moving/unarmed to stopped/armed after `250 ms`, then expire by TTL or hit budget.
- Armed hostile traps can block `bullet`, `spark`, and `rocket` projectiles. Blocking consumes one trap hit; bullets/sparks expire, and rockets detonate once at the block point. Unarmed traps and same-owner traps do not block.

Damage feedback states:

- Server `damage` event: sent only to the damaged player, with amount, normalized cause, source name/kind/position, target position, and time.
- Server `death` event: includes the final killing `deathCause` even if repeated contact damage events were rate-limited.
- Client effects: local `damageDirection` arrow and a compact high-impact cause toast when damage crosses the configured HP-ratio threshold.

Alpha metrics state:

```js
centerObjective.metrics = {
  spawnedAtMs,
  lastLifeMs,
  kills,
  totalDamage,
  humanDamage,
  botDamage,
  contributorsPeak,
  lastContributors,
  lastHumanDamage,
  lastBotDamage,
  lastRewardXp,
  lastRewardCoins,
  lastKillerKind,
  recentKills
}
```

These metrics are debug-only. They are reset when Alpha spawns, updated on Alpha damage, finalized on Alpha death, and exposed through F3/debug snapshots without changing Alpha balance.

Alpha Sector event state:

```js
eventObjectives = {
  enabled,
  nextSpawnAtMs,
  serial,
  active: Map<eventId, {
    id,
    typeId,
    shapeId,
    spawnedAtMs,
    expiresAtMs,
    maxHp,
    rewardXp,
    scoreReward,
    coinReward,
    contributors: Map<tankId, damage>,
    totalDamage,
    humanDamage,
    botDamage,
    contributorsPeak,
    lastHitterId,
    state
  }>,
  paidShapeIds,
  metrics: {
    spawned,
    completed,
    expired,
    totalDamage,
    humanDamage,
    botDamage,
    totalRewardXp,
    totalRewardCoins,
    totalLifetimeMs,
    recentSamples
  }
}
```

Sector events are server-only state plus bounded snapshot summaries. They do not persist to accounts and do not change Alpha HP, Alpha reward, XP formulas, room rules, or server tick rate.

UI states:

- `menu`
- `connecting`
- `playing`
- `dead`

## Config Schema

`GAME_CONFIG` owns:

- `world`: dimensions, grid, spawn safety.
- `server`: port, tick rate, snapshot rate, player cap, respawn and disconnect timers.
- `network`: message size, input rate, interpolation delay.
- `tank`: radius, base HP/speed, invulnerability, regen constants.
- `projectile`: radius, TTL, speed, damage, reload.
- `upgrades`: max upgrade level, max player level, display labels.
- `xp`: XP curve and kill/shape rewards.
- `shapes`: target population and weighted type definitions.
- `bots`: population formula, target ranges, reaction timing, governance rules, names.
- `debug`: debug endpoint policy.

`WORLD_CONTENT_CONFIG` owns:

- `version`: current world-content tuning id.
- `centerObjective`: enabled state, `alphaPentagon` position, HP, XP, coin reward, respawn time, spawn exclusion radii, contribution reward ratios, bot target weights, and HUD/minimap copy.

`EVENT_OBJECTIVE_CONFIG` owns:

- `version`: current Alpha Sector event tuning id.
- `director`: first spawn gate (`75s` or highest human level `8`), cooldown range (`95s -> 65s`), active caps (`1` early, `2` at level `30+`), spawn radius, spawn attempts, player/shape safety radii, retry time, and recent-sample cap.
- `rewards`: contribution minimum `4%`, shared reward ratio `0.8`, last-hit ratio `0.2`, and XP/HP validation bounds.
- `bot`: event interest range `1600 px`, human-proximity dampener radius `900 px`, and dampener `0.72`.
- `objectives`: `alphaShard`, `volatileTriangle`, `bulwarkSquare`, and `beaconPentagon` stats, unlock gates, reward values, contact/incoming damage multipliers, bot interest, optional death burst, and UI colors.

`DRONE_CONFIG` owns:

- `globalDroneCap`: room-wide active drone cap, currently `180`.
- `maxContactPairsPerTick`: drone contact-damage work cap, currently `260`.
- `projectileVsDroneMultiplier`: projectile, trap, rocket, and spark damage scaling against drones.
- `loadouts`: `overseer`, `overlord`, and `necromancer` drone caps, HP, radius, movement speed, turn rate, rebuild time, command distance, leash distance, orbit radius/speed, contact cooldown, body damage, render colors, and Necromancer conversion rules.
- `balance.uptimeFactors`: conservative expected live uptime used by drone DPS budget tests.
- `render`: shared command-line and outline colors used by the client renderer.

`APP_CONFIG` owns:

- `auth`: username/password/session limits and hashing constants.
- `api`: max JSON body size.
- `storage`: dev account file path and corrupt-file recovery policy.
- `economy`: coin rewards and match soft cap.
- `shop`: default coins, default items, equipped slot rules.
- `matchmaking`: local region, room limits, inactive-room TTL, and room labels.

`TANK_CLASS_CONFIG` owns:

- `levels`: `[1, 15, 30, 45, 60]`.
- `maxSelectableLevel`: currently `60`.
- `classes`: class graph used by server validation and client tree UI.
- `weaponPatterns`: barrel/projectile patterns used by authoritative projectile spawning. Each shot can optionally define `delayMs` (`0..260`) for timed bursts; omitted delays default to same-frame spawning.
- `droneLoadoutId`: optional control-branch loadout id. Only classes with a drone loadout may use `weaponPattern: "none"`.
- Active classes: every configured class in the level `1/15/30/45/60` tree.
- Level 30/45/60 classes are selectable when the tank is on the required parent branch.
- `icon`: shared visual identity schema used by the live canvas renderer and TREE/card mini-icons:
  - `body`: `circle | square | diamond | triangle | hex | spike`
  - `bodyScale`: visual-only scale multiplier; it does not change collision radius.
  - `ring`: `none | thin | heavy | dashed`
  - `core`: `none | dot | diamond | star`
  - `accents`: visual-only `sidePod`, `spike`, `shield`, or `rocketFin` geometry.
  - `barrels[].style`: `standard | long | heavy | mini | trap | rocket`.
- `balanceRole` and `balanceBudget`: role metadata used by `shared/sim/tankClassBalance.js` tests. Budgets are expressed as ratios against Basic focused/total DPS.

`TANK_CLASS_IDENTITY_CONFIG` owns:

- `roleLabel`, `weaponLine`, `strengthLine`, and `weaknessLine` for every active class.
- `feelTags`: compact semantic tags used by tests and future tuning notes.
- `feedbackProfile`: reusable class feel profile. Allowed values are `standard`, `rapid`, `precision`, `spread`, `storm`, `heavy`, `rocket`, `missile`, `trap`, `drone`, `booster`, and `body`.
- Mobile-safe copy limits: role `18`, weapon `48`, strength `52`, and weakness `52` characters.
- Semantic contracts: drone classes use `drone`, trap classes use `trap`, `Missile Command` uses `missile`, `Stormcaller` uses `storm`, `Siege Core` uses `heavy`, `Comet` uses `booster`, and `Streamliner` stays a rapid straight-stream identity.
- Class cards read these fields through `shared/sim/tankClassIdentity.js`; authoritative combat still reads weapon patterns and drone loadouts from the existing tank class config.

`tankWeaponFacts` derives compact mechanical facts from the same authoritative config:

- Pattern facts: shot count, burst window, spread width, forward-shot ratio, damage multiplier sum, primary projectile kind, and primary projectile behavior.
- Special facts: drone cap/base count/conversion, trap blocking, missile steering window, heavy shell identity, booster recoil identity, body-contact identity, and the current `Hybrid` shell-escort limitation.
- UI limits: class cards may render up to three chips on desktop and CSS hides chips after the first two on mobile. Each chip is capped at `18` characters.
- Rapid cadence contracts: `Gunner` uses `0/28/56/84 ms`, `Auto Gunner` uses `0/24/48/72/96 ms`, `Sprayer` uses `0/20/40/60/80/100/120 ms`, and `Streamliner` remains `0/45/90/135/180 ms`.
- The helper is read-only. It never changes weapon timing, damage, server authority, or save data.

`COMBAT_FEEL_CONFIG` owns:

- Directional recoil impulse: base `34 px/s`, cap `160 px/s`, decay `8x/s`, per-kind multipliers, and square-root multi-shot normalization.
- Muzzle timing: `90 ms` flash, `7 px` barrel kick, and barrel-tip spawn padding.
- Projectile threat visuals for `bullet`, `rocket`, `spark`, and `trap`, including fill/core colors, outline weight, trail alpha, pulse color, warning-ring behavior, and impact style.
- Rocket/starburst/missile spark counts, TTL, and limited-turn missile steering values.
- Trap arm time, TTL, hit budget, per-target hit cooldown, projectile-blocking toggle, and blockable projectile kinds.
- Contact collision push strengths, body-damage DPS, spawn-invulnerability rules, and alpha contact multiplier.

`COMBAT_FEEDBACK_CONFIG` owns:

- Damage cause labels and colors for `bullet`, `rocket`, `spark`, `trap`, `drone`, `tankContact`, `shapeContact`, `alphaContact`, and `unknown`.
- Local damage direction indicator TTL, high-impact toast threshold, and contact damage event coalescing window.

`AUDIO_CONFIG` owns:

- Asset paths for music/SFX under `client/assets/audio`.
- CC0 source metadata for external audio assets.
- Default master/music/SFX volume.
- SFX per-role gain, pitch range, priority, and rate-limit bucket.
- Fire feedback-profile tuning for class identity: gain multiplier, pitch multiplier, and cooldown for rapid, storm, heavy, rocket, missile, trap, drone, booster, body, and standard firing.
- Event caps for fire, hit, destroy, UI, and level sounds.

## Gameplay Loop

Each active room steps at `30 Hz`.

Per room tick:

1. Maintain the center Alpha Pentagon objective.
2. Maintain Alpha Sector event objectives: expire old events, spawn eligible elite shapes, and keep active count capped.
3. Maintain normal shape count, excluding Alpha and sector-event shapes from the normal pool.
4. Maintain bot population.
5. Build a tank/shape spatial hash.
6. Apply bot governance and update profile-driven bot intents using nearby spatial candidates, including event objectives.
7. Apply tank input, class-adjusted movement, recoil drift, and immediate projectile spawns for non-drone classes whose cooldown is ready.
8. Process queued delayed weapon shots. Queued shots are server-only, cancel on owner death/disconnect/class change, and use the same projectile factory/recoil path as immediate shots.
9. Rebuild, command, and move active drones for drone-loadout classes. Drone classes skip regular projectile spawning; holding fire changes drone mode from orbit/return to attack.
10. Rebuild the spatial hash and resolve tank contact collision against shapes/tanks.
11. Resolve drone contact damage against enemy tanks and shapes with per-target cooldowns and a per-tick pair cap.
12. Move projectiles, steer limited-turn missiles during their steering window, arm/stop traps, detonate expired rockets/missiles, and expire old/out-of-world bullets.
13. Rebuild the spatial hash for post-movement collision candidates.
14. Resolve projectile/trap/spark collisions deterministically with spatial broad phase plus circle checks. Armed hostile traps can intercept blockable projectiles before drone/tank/shape hit checks; drones are then checked as hittable combat entities before tanks/shapes so they can screen the controller.
15. Apply XP, level-ups, upgrades-derived stat refreshes, deaths, event rewards, center rewards, and Necromancer normal-shape conversion.
16. Award account coins for logged-in human players.
17. Clean expired projectiles, expired drones, dead drones, and disconnected players.

Snapshots are broadcast at `15 Hz` only to clients in the same room.

Class progression loop:

1. Player gains XP and reaches class unlock levels.
2. Server refreshes `classUnlockChoices` from the current class branch.
3. Client shows Diep-style class cards when choices exist; `T` or `TREE` opens the full diagram.
4. Client sends `selectClass` with a class id from a card, shortcut, or tree node.
5. Server validates level, parent branch, and active status.
6. Server updates `classId`; the next shots use that class weapon pattern, or the drone system uses the class `droneLoadoutId` when the pattern is `none`.

## Balance Formulas

Tank stats:

- `maxHp = 100 + maxHealthLevel * 18`
- `moveSpeed = min(330, 245 * (1 + moveSpeedLevel * 0.045))`
- `bulletDamage = 12 * (1 + bulletDamageLevel * 0.16)`
- `bulletSpeed = 680 * (1 + bulletSpeedLevel * 0.07)`
- `reloadMs = max(140, 430 * 0.88 ** reloadLevel)`
- `regenDelayMs = max(2000, 6000 - regenLevel * 500)`
- `regenPerSecond = 1 + regenLevel * 1.5`

Level pacing:

- Base curve stays readable: `baseXp = floor(60 + 35 * level ** 1.7)`
- Level `1-14`: `xpForNextLevel = floor(baseXp * 0.22)`
- Level `15-29`: `xpForNextLevel = floor(baseXp * 0.36)`
- Level `30-45`: `xpForNextLevel = floor(baseXp * 0.55)`
- Level `46-60`: no multiplier band is applied, so the base curve becomes the late ultimate chase.
- New tanks start with `3` upgrade points.
- Upgrade point: every level from `2` through `28`, then every third level after.

XP rewards:

- Square XP: `35`
- Triangle XP: `80`
- Pentagon XP: `220`
- Alpha Pentagon XP: `4200`
- Bot kill XP: `260 + victimLevel * 36`
- Player kill XP: `340 + victimLevel * 48`

Death penalty:

- Applies to both players and bots.
- `newLevel = max(1, ceil(oldLevel * 0.5))`
- `newXp = 0`
- `newScore = floor(oldScore * 0.5)`
- Upgrades reset to zero.
- Refunded upgrade points equal `starterUpgradePoints + sum(upgradePointsForLevel(2..newLevel))`.
- Class downgrades to the deepest class already in the tank's branch history whose unlock level is legal at the new level.
- Killer XP/coin rewards use the victim's pre-death level.
- Victim-owned projectiles expire on death so old high-tier shots cannot score after downgrade.

## World Content And Center Objective

- Arena size is `9000x9000` with `150 px` grid spacing.
- Normal shape target count is `360`; the center Alpha Pentagon is separate from the normal spawn budget.
- Spawn selection rejects candidates inside the center objective exclusion radius, so players, bots, and normal shapes do not appear on top of the Alpha Pentagon.
- Center Alpha Pentagon:
  - Position: world center, currently `(4500, 4500)`.
  - Radius: `115`.
  - HP: `1400`.
  - XP/score pool: `4200`.
  - Coin pool: `80`.
  - Respawn: `45000 ms`.
- Reward formula:
  - `damageShare = contributorDamage / totalContributorDamage`
  - `sharedXp = floor(4200 * 0.85 * damageShare)`
  - `lastHitBonusXp = floor(4200 * 0.15)` for the killing contributor only.
  - `sharedCoins = floor(80 * damageShare)` for logged-in human players, still filtered through the match coin cap.
- Contributors below `5%` damage share are ignored unless they got the last hit.
- Bots can damage and gain XP from the objective, but bot governance still caps long-running bot level inflation.

Bot governance:

- Level cap with no connected humans: `3`
- Level cap with humans: `min(8, highestHumanLevel + 2)`
- Governance interval: `1000 ms`
- Lifecycle recycle age: `360000 ms`
- Recycle delay near humans: bots within `1800 px` of an alive connected human are marked `pendingRecycle` instead of disappearing.
- Score decay starts after `180000 ms` and removes `15%` score per minute.
- Recycled bots keep their name/color/id but reset level, XP, score, upgrades, HP, AI target, and owned projectiles.

Bot rivals and bounties:

- A bot can only become a visible rival at level `15+`.
- Rival pressure is derived from existing combat state: one tank kill creates a `Rival`, score at `1400+` creates a `Threat`, and either a `2`-kill streak or `2600+` score creates a `Bounty`.
- Recent damage from a player sets a temporary revenge target for `9000 ms` and adds a small target-score bias through the normal bot target scoring path.
- Bounty rewards are bounded and server-authoritative: `4-18` bonus coins, `90-420` bonus XP, and `140-520` bonus score. The normal tank-kill reward still applies first.
- A bounty can be claimed once per bot life; bot death, respawn/recycle, and successful claim clear the rival state.
- Anti-farm guard: each player can claim at most `2` bounty bonuses per `90000 ms` window. Extra bot kills still grant normal tank-kill rewards but no bounty bonus.
- Snapshots expose only lightweight public rival data: id, name, tier, position, HP ratio, level, score, kill streak, bounded reward preview, and current/revenge tank target ids. Debug reports finite rival counts and recent claim count.

Bot personalities:

- `Rookie`: `40%` spawn weight, `420 ms` reaction, `0.34 rad` aim jitter, retreats at `50%` HP, high mistake chance, short memory, and prefers safer spread/control branches.
- `Farmer`: `22%`, `270 ms`, `0.18 rad`, high `farmBias = 1.85`, high greed/alpha bias, prefers shape farming and machine-gun branches.
- `Duelist`: `18%`, `150 ms`, `0.08 rad`, aggression `0.92`, high revenge bias, sticks to wounded targets, and prefers focused combat branches.
- `Sniper`: `10%`, `220 ms`, `0.045 rad`, longer preferred range `1.70x`, strong aim lead, prefers Assassin/Stalker branches.
- `Pro`: `10%`, `115 ms`, `0.035 rad`, low mistake chance, strong target stickiness, strong aim lead, but still imperfect fire discipline.
- Enemy score: `aggression * (900 / max(240, distance)) + (1 - enemyHpRatio) * aggression + revengeBonus + rivalRevengeBonus + levelOpportunityBonus + humanFocusBonus - dangerPenalty`
- Shape score: `farmBias * centerWeight * alphaContestBias * (shapeXp / max(200, distance))`
- Target switch: `nextScore >= currentScore * targetSwitchHysteresis` or current target commitment expires.
- Aim lead: `targetPosition + targetVelocity * (distance / projectileSpeed) * aimLeadStrength`
- Panic check: recent damage above `panicDamageRatio` sets `panicUntilMs`; retreat logic treats panic as a temporary retreat state.

Persistent coins:

- Shape coins: `floor(shapeXp / 8)`
- Bot kill coins: `8 + floor(victimLevel * 1.5)`
- Bounty bot bonus coins: `4-18`, paid once per bounty bot life and still filtered through the match coin cap.
- Player kill coins: `12 + victimLevel * 2`
- First `400` match coins are awarded at `100%`.
- Coins beyond `400` in the same match are awarded at `25%`.
- Guests can see match coin earnings, but only logged-in accounts persist coins.
- Coins only buy cosmetics and never change combat stats.

Class modifiers:

- `finalDamage = upgradeDamage * class.damageMultiplier * projectile.damageMultiplier`
- `finalBulletSpeed = upgradeBulletSpeed * class.bulletSpeedMultiplier * projectile.speedMultiplier`
- `finalReloadMs = upgradeReloadMs * class.reloadMultiplier`
- `bodyDamagePerSecond = (baseTankBodyDps + speedRatio * 24) * class.bodyDamage * dt`
- `incomingContactDamage = rawContactDamage * class.bodyResistance`
- Class balance report:
  - `totalShotDamage = sum(projectile.damageMultiplier) * classAdjustedBulletDamage`
  - `forwardShotDamage = sum(projectile.damageMultiplier where abs(angleOffset) <= 0.55) * classAdjustedBulletDamage`
  - `totalDps = totalShotDamage / (reloadMs / 1000)`
  - `focusedDps = forwardShotDamage / (reloadMs / 1000)`
  - `mobilityScore = moveSpeed / baseMoveSpeed`
  - `survivabilityScore = maxHp * bodyResistance / baseHp`
  - `burstScore = maxProjectileDamage / baseDamage`
  - Role budget tests compare focused/total DPS ratios against the configured class role. Body, trap, and rocket classes intentionally allow lower direct DPS because their utility budget is contact damage, trap control, or delayed explosion value.
- `basic`: one balanced barrel.
- `twin`: two forward barrels with lower per-bullet damage and slightly slower reload.
- `sniper`: stronger and faster bullet with slower reload.
- `machineGun`: faster reload with lower damage and speed.
- `flankGuard`: front and rear barrels with lower per-bullet damage.
- `tripleShot`, `pentaShot`, and `triplet`: forward multi-shot branches with lower per-bullet damage.
- `quadTank`, `octoTank`, and `tripleTwin`: area-control spread branches capped at 8 projectiles per shot.
- `triAngle`: forward pressure with rear angled booster fire and a small move-speed modifier; it now upgrades to `booster` or `fighter`.
- `assassin`, `stalker`, `hunter`, `predator`, and `streamliner`: long-range sniper branches with increased bullet speed/TTL or stacked forward pressure. `Streamliner` is explicitly a timed straight stream: five forward shots at `0/45/90/135/180 ms`, no lateral spread.
- `overseer`, `overlord`, and `necromancer`: true control branch classes. They use `weaponPattern: "none"` plus `droneLoadoutId`; firing commands server-authoritative drones instead of spawning normal bullets.
- `destroyer`, `annihilator`, and `hybrid`: heavy cannon branches with high burst, larger projectile radius, and slow reload.
- `gunner`, `autoGunner`, and `sprayer`: rapid-fire small-bullet branches. They now keep their old projectile counts and damage sums but emit as short timed sprays over `84 ms`, `96 ms`, and `120 ms` so the firing cadence matches the rapid role.
- `fireworkTank` and `starburst`: Machine Gun branch rocket classes. Rockets deal direct damage and detonate into capped spark projectiles.
- `trapper` and `minefield`: Sniper branch trap classes. Traps move slowly, stop/arm after `250 ms`, then damage contacts and block hostile bullets/sparks/rockets until TTL or hit budget expires.
- `rammer` and `spike`: Flank Guard branch body-damage classes. They have weaker shots but higher speed, HP/resistance, and contact damage.
- Level `60` ultimates are level-only capstones for selected level `45` parents:
  - `Missile Command`: `Starburst` child with three limited-turn missile rockets. Missile behavior steers for `850 ms` at `1.65 rad/s`, acquires hostile tanks within `680 px` and a `0.9 rad` cone, then uses rocket-style spark detonation.
  - `Stormcaller`: `Sprayer` child with eight low-damage bullets emitted over `175 ms` using delayed shot config.
  - `Siege Core`: `Annihilator` child with one massive slow shell, larger radius, slower reload, and heavy recoil.
  - `Hive Lord`: `Necromancer` child with drone-only offense, `5` base drones, and a `10` drone swarm cap.
  - `Aegis Bastion`: `Minefield` child with a five-trap defensive wall using the existing armed trap projectile-blocking rules.
  - `Comet`: `Fighter` child with six front/side/rear booster bullets and existing recoil for forward pressure.

## Command Drone Control Branch

The command drone update turns the existing Sniper control branch into a distinct server-authoritative minion playstyle without changing input protocol or adding new classes.

Class loadouts:

- `Overseer`: level `30`, `2` base drones, `12 px` radius, `26 HP`, `9` contact damage, `360 px/s`, `360 ms` contact cooldown, `1800 ms` base rebuild, `760 px` command distance.
- `Overlord`: level `45`, `4` base drones, `13 px` radius, `30 HP`, `10` contact damage, `380 px/s`, `360 ms` contact cooldown, `1650 ms` base rebuild, `850 px` command distance.
- `Necromancer`: level `45`, `4` base drones, `8` max swarm cap, `10 px` radius, `18 HP`, `7` contact damage, `330 px/s`, `380 ms` contact cooldown, `2200 ms` base rebuild, `780 px` command distance.
- `Hive Lord`: level `60`, `5` base drones, `10` max swarm cap, `10 px` radius, `18 HP`, `7.5` contact damage, `335 px/s`, `380 ms` contact cooldown, `2400 ms` base rebuild, `820 px` command distance.

Command rules:

- Drone classes use `weaponPattern: "none"` and do not spawn normal projectiles.
- Existing input is reused. Holding fire makes drones attack the aim-projected command point; releasing fire recalls them to orbit.
- Command target: `owner + aimVector * loadout.commandDistance`.
- Drone motion blends toward desired velocity with `velocity = lerp(currentVelocity, desiredVelocity, turnRate * dt)` and clamps to loadout move speed.
- Drones expire on owner death, disconnect, or class change and are removed during cleanup.

Combat rules:

- Drones are hittable combat entities with HP. Projectiles, traps, rockets, and sparks can destroy them.
- Drone contact damage uses a per-target cooldown and never damages the owner.
- Spawn-invulnerable tanks cannot be damaged by drones.
- Drone kills grant `0 XP`, `0 coins`, and `0 score`.
- Shape/tank kills caused by drones credit the owner through normal reward flow.
- The room-wide active drone cap is `180`; player rebuilds can replace a bot drone when the cap is full.

Necromancer and Hive Lord conversion:

- Only normal square/triangle/pentagon shape kills can convert. Alpha, sector events, drones, and tanks never convert.
- Necromancer conversion chances: square `35%`, triangle `65%`, pentagon `100%`.
- Hive Lord conversion chances: square `38%`, triangle `68%`, pentagon `100%`.
- Pentagons spawn `2` temporary swarm drones; other normal shapes spawn `1`.
- Necromancer converted drones count toward the `8` cap and expire after `18000 ms`; Hive Lord converted drones count toward the `10` cap and expire after `16000 ms`.

Drone balance model:

- `rawDroneDps = maxDrones * bodyDamage / (hitCooldownMs / 1000)`.
- `effectiveDroneDps = rawDroneDps * uptimeFactor`.
- Starting uptime factors are `0.45` for Overseer/Overlord, `0.35` for Necromancer, and `0.32` for Hive Lord.
- Config tests keep effective drone DPS in the `12..72` budget range.

## Combat Feel And Contact Collision

The combat-feel pass keeps server authority intact while making firing and collisions read closer to Diep.io.

- Projectiles spawn from barrel tips using tank radius, projectile radius, configured barrel length, lateral offset, and muzzle padding.
- Each trigger sums recoil from its actual shot angles. Front cannons kick backward, rear booster shots push forward, radial/flank patterns mostly cancel, traps/body-class shots stay mild, and heavy shells kick harder. Recoil decays every tick and is clamped so it cannot fling the tank across the arena.
- Local prediction applies the same recoil math for the local player when firing so recoil-heavy classes feel responsive instead of waiting for the next server snapshot.
- Snapshot projectile metadata includes `kind`, `behavior`, `ownerClassId`, `feedbackProfile`, `ageMs`, `spawnX`, `spawnY`, `prevX`, `prevY`, visual colors, and `armed` for traps. Clients fall back to kind-based rendering/audio if class identity metadata is missing. Feedback profiles refine visuals without new assets: rapid bullets get slimmer bright trails, precision shots get sharper trails/cores, spread shots use softer trails to reduce fan clutter, booster shots get subtle thrust-colored trails, missile/rocket/heavy/trap keep their existing stronger threat language.
- Client effects derive muzzle flashes for newly seen projectiles and impact bursts for projectiles missing from the next snapshot. Effects never decide hits.
- Rocket behavior:
  - `fireworkTank`: one rocket, `6` sparks on hit/TTL.
  - `starburst`: one rocket, `10` sparks on hit/TTL.
  - `missileCommand`: three missile rockets, each steering for up to `850 ms` before continuing unguided and bursting into `8` sparks.
  - Sparks use short TTL and reduced damage to cap projectile floods.
- Trap behavior:
  - `trapper`: one slow trap.
  - `minefield`: three slow traps.
  - Traps arm after `250 ms`, have `8500 ms` TTL, and expire after `3` damaging touches or projectile blocks.
  - Armed hostile traps block `bullet`, `spark`, and `rocket` projectiles. Bullets/sparks expire; rockets use the existing detonation path once at the block position. Same-owner projectiles and unarmed traps are ignored.
- Contact collision:
  - Alive tanks are pushed out of overlapping shapes/tanks.
  - Shape contact damages both the tank and shape unless spawn invulnerability blocks it.
  - Tank/tank contact applies mutual body damage with class resistance modifiers.
  - Center Alpha contact damage uses a `0.45x` multiplier so the center objective is not instant death.
  - Contact kills flow through existing XP/death-penalty logic.

## Login, Shop, And Matchmaking

- `Log In` registers/logs in local server accounts with salted `scrypt` password hashes and HttpOnly `ta_session` cookies.
- Local development seeds a developer account outside production: username `Admin`, password `123456@@##$$`, role `developer`. The password is not stored as plaintext; the config stores the scrypt salt/hash pair.
- `Shop` sells cosmetic-only body colors, outlines, and badges from `shared/config/shopCatalog.js`.
- `Play` calls quickplay matchmaking and joins a public room by id over WebSocket.
- `Custom Games` creates/lists/joins custom rooms on the same Node server.
- Each room owns an isolated `ServerGame`; tanks, bullets, shapes, bots, leaderboard, and snapshots do not cross rooms.
- Equipped cosmetics are validated server-side and serialized on tank snapshots.

Developer level tool:

- Visible only to accounts with `role: "developer"`.
- Client calls `POST /api/developer/level { level }`.
- Server rejects non-developer accounts with `403`.
- Requested level is clamped to `1..60`.
- The tool affects only player tanks whose `accountId` matches the logged-in developer account.
- Server sets `tank.level`, resets current XP, resets upgrades to zero, refunds the legal upgrade budget, downgrades class if needed, refreshes unlock choices/stats, and heals alive tanks to full HP.
- It does not grant coins, inventory, kills, score, or authority to edit other players.

## Tank Evolution Tree

The evolution tree is a client-visible diagram backed by server-owned class state.

- Class upgrade cards appear automatically when `classUnlockChoices` is non-empty. Cards are selectable by click/tap or `1`-`4`.
- Class upgrade cards include identity metadata: role pill, weapon behavior, strength line, config-derived weapon fact chips, and compact weakness line. Desktop cards show up to three chips; mobile hides chips after the first two and hides the weakness line first to keep cards tappable at `390x720`.
- Mobile safe zones are computed in `hudLayout.js` instead of guessed in CSS. At phone widths, class cards use a compact height, move above the lower thumb-control lane, and avoid the bottom HP/XP bars and fire-lock button. The touch-control lane reserves left/right boxes under class cards; fire lock stays in that lower lane.
- Class upgrade cards are suspended while a modal or full TREE is open and are hidden while dead.
- Card layout uses safe-zone CSS variables so cards sit above the bottom HP/XP bar and away from the minimap/side docks.
- Pressing `Escape` or the card header `HIDE` button collapses the current tier into `CLASS +N`; a new tier or new class path auto-expands again.
- `TREE` opens the full diagram.
- `T` opens the full diagram during gameplay.
- Columns show `LEVEL 1`, `LEVEL 15`, `LEVEL 30`, `LEVEL 45`, and `LEVEL 60`.
- Node states: `selected`, `path`, `available`, `locked`, and `unreachable`.
- Available nodes are clickable only when the server snapshot says the class is available.
- The server is the only authority allowed to change `tank.classId`.
- Level 30/45/60 nodes are playable; the server rejects early unlocks and sibling branch jumps.
- Every level 30 branch now has at least one level 45 final form. Existing dead-end branches were completed with `Booster`, `Fighter`, `Predator`, `Streamliner`, `Annihilator`, `Hybrid`, `Auto Gunner`, and `Sprayer`.
- Additional Lv30/45 branches add non-repetitive play styles without increasing Lv15 choice overload:
  - `Machine Gun -> Firework Tank -> Starburst`
  - `Sniper -> Trapper -> Minefield`
  - `Flank Guard -> Rammer -> Spike`
- Level 60 ultimate branches are currently focused on six parents:
  - `Starburst -> Missile Command`
  - `Sprayer -> Stormcaller`
  - `Annihilator -> Siege Core`
  - `Necromancer -> Hive Lord`
  - `Minefield -> Aegis Bastion`
  - `Fighter -> Comet`
- Class silhouettes are role-authored in config rather than hand-coded per renderer. Sniper classes use slim bodies and long barrels, heavy classes use square/hex bodies and heavy barrels, rocket classes use fins and rocket barrels, trap classes use diamond cores and trap barrels, body classes use diamond/spike silhouettes, and control classes use rings/radial pods.
- The stat upgrade panel can be collapsed with `U`; the collapsed pill reads `SHOW UPGRADES +N`, displays available upgrade points, and pulses for `1600ms` after points increase.
- Expanded stat upgrade buttons show current/max level plus one concrete next-point preview. Bullet classes show HP, regen, projectile damage/speed, reload, and movement before/after values. Control classes show drone contact-damage and rebuild-time previews, while bullet speed is marked as having no direct drone effect.
- Death state hides stat upgrades, TREE, developer tools, and class cards so the death modal is the only interactive upgrade-related surface.

## Edge Cases

- Malformed WebSocket messages return an error and do not mutate gameplay.
- Duplicate joins reuse the same client session.
- Dead tanks cannot move, fire, or upgrade.
- Owner bullets cannot damage their owner.
- Spawn invulnerability prevents immediate spawn deaths.
- Disconnected players are removed after `10000 ms`.
- If safe spawn attempts fail, spawn falls back to the farthest map corner candidate.
- Projectiles expire on TTL or world exit.
- Rockets detonate once on hit or TTL; spark counts are capped by config.
- Traps are visible, arm before damage, and expire by TTL or hit budget.
- Tank contact collision is pushback plus damage; spawn-invulnerable tanks are pushed but do not deal/take contact damage by default.
- Config validation fails fast on invalid tick/snapshot rates or invalid shape definitions.
- Over-cap bots recycle only when far from alive connected humans.
- Pending bot recycle is cleared if the bot is no longer over cap or expired.
- Recycled bots expire their old bullets so stale high-level shots cannot score after reset.
- Bot rival state clears on bot death/recycle and bounty rewards are paid before the normal death penalty mutates the victim's level/score.
- Sector events do not spawn without alive human players, retry after `10000 ms` if no safe spawn point exists, expire without rewards, and guard paid shape ids so projectile/contact cleanup cannot double-pay.
- Volatile Triangle spark bursts are neutral projectile damage against tanks only; they set `hitsShapes: false` so they cannot chain-clear other objective or normal shapes.

## Debug Tools

- Browser `F3` overlay: FPS, frame time, render time, HUD time, adaptive render quality, RTT, screen state, HUD visibility/layout state, room step timing, server tick, snapshot age, snapshot buffer size, interpolation mode, visible entity counts, total entity counts, bot profile counts, bot behavior counts, class counts, bot class counts, class upgrade state, class visual signature/role/DPS ratios, upgrade panel collapsed state, projectile kind counts, trap block count, contact pair/damage counters, server spatial/collision counters, local tank summary, death penalty summary, and client audio state.
- F3 and room debug also include `centerObjective`, `eventObjectives`, `shapeCounts`, and `balanceVersion` so map-object state and reward tuning can be verified without guessing.
- `centerObjective.metrics` reports Alpha lifetime, kill count, contributor peaks, human/bot damage split, reward totals, killer kind, and recent kill samples.
- `eventObjectives` reports active sector objectives, spawn/completion/expiry counts, average completed lifetime, human/bot damage split, reward totals, completion rate, and the last `8` event samples.
- `botRivals` reports bounded rival/threat/bounty counts and recent bounty claims. It never exposes account ids, sessions, or persistence secrets.
- `hudAction` reports the currently selected HUD priority action, including id, label, tone, target, urgency, and visibility. Bounty/revenge alerts are lower priority than death/class/upgrade/Alpha-critical/danger and higher priority than sector-objective/farm prompts.
- Server endpoint: `GET /debug/state` outside production.
- Server endpoint: `GET /debug/rooms` outside production, including each room's `stepMs.lastMs`, `stepMs.avgMs`, `stepMs.maxMs`, and sample count.
- Server endpoint: `GET /debug/accounts` outside production, redacted counts only.
- README manual test checklist.
- Node tests for formulas, Alpha Sector event objective lifecycle/rewards/expiry, command drone config/lifecycle/combat/conversion/balance, projectile behavior, contact collision, spawn safety, HUD visibility/layout, renderer quality guards, collapsible upgrade UI, client feedback, onboarding, menu view models, bot governance, auth, shop, economy, and matchmaking.
- Class tests cover graph validation, level 15/30/45/60 unlock rules, protocol parsing, full-tree activation, class identity metadata, config-derived weapon fact chips, class visual signatures, class balance invariants, weapon projectile counts, delayed Streamliner/Stormcaller/Gunner/Auto Gunner/Sprayer timing/cleanup, limited-turn missiles, trap projectile blocking, and no-shot validation for drone classes.
- Mobile tests cover finite touch movement/aim/fire, fire-lock reset when gameplay deactivates, small-phone safe-zone separation, mobile card chip clamping, and a browser smoke path that dispatches real touch events into the canvas before checking class-card overlap.
- Playwright browser smoke tests run the real browser client against a local server on `127.0.0.1:3101`. They fail on console errors, page errors, failed join/HUD boot, broken developer level tooling, broken class-card tier flow, TREE/F3 runtime crashes, and mobile viewport join crashes.

## Bright Arcade Gameplay Style

Gameplay rendering is still Canvas-only and top-down, but the active style is brighter and chunkier.

- Background uses sky/grass arcade bands instead of the old dark gradient.
- Grid lines are green and low contrast so aiming remains readable.
- Tanks, shapes, and bullets use thicker outlines.
- Tank bodies use the configured class visual schema, so final classes are readable from silhouette: `triangle` mobility bodies, `hex` range/control bodies, `square` heavy/trap bodies, `diamond/spike` body-damage tanks, and class-specific rings/cores/accents.
- Bullets draw a short trail for readability.
- HUD panels use bright arcade buttons and thick borders.
- The center Alpha Pentagon uses the same chunky shape style with a larger label/HP bar and a minimap marker.
- Alpha Sector objectives use colored outer rings, always-visible HP bars, short labels, minimap markers, and Volatile low-HP warning pulses.
- Drones render above shapes and below tanks as small owner-colored arrow diamonds. Low quality keeps drone bodies/outlines and drops the local command line first.

## Smoothness Layer

The client renders a visual snapshot, not the raw latest server snapshot.

- Snapshot buffer length: `8`.
- Interpolation delay: `GAME_CONFIG.network.interpolationDelayMs`, currently `100 ms`.
- Tanks and projectiles interpolate position between bracketing snapshots.
- Tank angles interpolate using shortest-path angular interpolation.
- Shapes render from the latest snapshot because they are static except for HP/destruction.
- Local tank visual extrapolation is capped at `80 ms` and only affects rendering; server authority and collision remain unchanged.
- Canvas culls shapes, projectiles, tanks, and transient effects outside the camera bounds plus `160 px` padding.
- Full-health shape HP bars render only when the shape is within `320 px` of the local player; damaged shapes always show HP bars.
- HUD elements cache signatures so leaderboard, upgrade buttons, account label, bars, and debug text update only when their source values change.
- Room simulation timing is measured inside `RoomSession.step()` so `/debug/rooms` can separate server simulation cost from client render/HUD cost.
- Desktop local movement uses client-side visual prediction:
  - Input is sampled every animation frame for prediction.
  - Network inputs are sequenced and sent at `30 Hz`, with faster sends for movement/fire changes and a `100 ms` keepalive.
  - Server snapshots include `lastInputSeq` for human tanks.
  - Client drops acknowledged pending inputs, shifts the prediction baseline by `32%` of a correction, and decays a visual offset over `140 ms`.
  - Errors below `8 px` are ignored; errors above `160 px` snap to the server.
  - Prediction affects only local rendering and camera follow. Server state remains authoritative for collisions, damage, XP, death, and score.
- F3 debug includes prediction mode, pending input count, last acknowledged server seq, and prediction error.
- Combat screen shake is intentionally restrained: local XP gain does not shake the camera, and local damage shake is capped at `3 px` for `140 ms`.
- Adaptive quality changes only decorative rendering:
  - `high`: clouds, grass bands, projectile trails, effect cap `80`.
  - `medium`: no clouds, grass bands and trails still on, effect cap `52`, projectile trail budget `80`.
  - `low`: no clouds, no grass bands, no projectile trails, effect cap `32`.
- Quality downgrades after FPS stays below `54` or `44` for `2000 ms`, and recovers only after stable FPS above `56`/`60` for `4000 ms`.

## Bot Governance Layer

Bot governance keeps empty or long-running servers from producing runaway bot leaders before a human joins.

- `getBotLevelCap(game)` returns `3` with no connected humans, otherwise `min(8, highestHumanLevel + 2)`.
- `applyBotGovernance(game, bot)` runs at most once per bot every `1000 ms`.
- Bots over the current level cap recycle immediately only when farther than `1800 px` from every alive connected human.
- Bots near a human set `ai.pendingRecycle = true` and continue normal combat until they leave the danger radius or the cap no longer applies.
- Bots older than `360000 ms` recycle using the same distance rule.
- Bot score decays after `180000 ms` to keep leaderboard ownership from becoming permanent.
- The system does not modify human XP, level, score, upgrades, damage, movement, respawn, or leaderboard formulas.

## Bot Personality Layer

Bots now use profile-driven finite-state AI. Each spawned bot receives a stable profile id, visible label in its name, reaction timing, aim jitter, retreat threshold, target scoring, target memory, panic/revenge behavior, aim lead strength, mistake chance, class preference, and upgrade priority.

- `chooseBotProfile(rng)` uses configured weights and a deterministic roll.
- `recordBotDamageMemory(game, victimBot, projectile, appliedDamage)` stores recent attackers and triggers panic when the hit is large enough for that profile.
- `updateBotIntent(game, bot, spatialIndex)` scores nearby enemies and shapes instead of always choosing the nearest target.
- `chooseBotGoal(game, bot, enemy, shape, profile)` respects target stickiness so bots do not flicker between targets unless the new option beats hysteresis or the commitment timer expires.
- `applyAimLead(bot, target, projectileSpeed, profile)` is implemented inside combat/retreat aim calculation by leading target velocity according to each profile's `aimLeadStrength`.
- `applyBotMistake(game, bot, profile)` occasionally drops fire, over-aims, or reverses movement for lower-skill profiles.
- `autoSelectBotClass(bot, config, profile)` selects the first available class from the profile's preference list.
- `autoSpendBotUpgrades(bot, config, profile)` follows the profile's upgrade priority.
- Recycled bots preserve profile identity so a named bot does not suddenly change personality mid-session.
- Death penalty preserves bot profile identity but resets level/class/upgrades like a player death.

## Spatial Hash Layer

The server builds a disposable spatial hash each tick for alive tanks and shapes.

- Cell size: `360 px`.
- Bot target queries use `range + botRadius + 80 px`.
- Projectile collision broad phase uses `projectileRadius + maxCandidateRadius + 32 px`.
- Narrow phase still uses existing deterministic circle collision helpers.
- Debug counters track spatial cells, inserted entities, bot AI candidate checks, projectile spatial queries, collision candidates, and trap projectile blocks.

## Client Feedback Layer

The client derives visual-only feedback from consecutive server snapshots. It does not change server authority, balance, XP, damage, or movement.

- HP decreases create hit rings and floating damage text.
- Local score increases create XP text near the local tank.
- Local level gains create a short level toast and HUD pulse.
- New upgrade points pulse the upgrade panel.
- The upgrade panel has a persisted collapsed state; `U` toggles it and the collapsed pill pulses when new points arrive. Expanded upgrade rows use `shared/sim/upgradePreview.js` so the HUD mirrors the same formulas that server stats and drone rebuild/damage use.
- New projectiles create muzzle flashes from server `spawnX/spawnY`; expired projectiles create impact bursts at their last server position.
- Local damage and local rewards add a short capped screen shake.
- Effects expire by TTL and are capped at 80 active effects.

## Client Audio Layer

Audio is client-only and derived from the same snapshot/feedback information used by visual effects.

- Background music uses the CC0 OpenGameArt `Chill (Loopable)` track as a looping chill arcade bed.
- The local fire SFX uses the CC0 OpenGameArt `Laser_shooting_sx` asset.
- Supporting hit, destroy, level-up, upgrade, death, UI, alpha-destroy, and sector-event SFX roles use short local generated WAV files or existing objective sounds.
- Browser autoplay is respected: audio starts only after a user gesture such as Play, click, tap, or keydown.
- `Menu` settings expose master, music, and SFX volume, mute, music enabled, and SFX enabled.
- Settings persist in `localStorage` under `tankArena.audio.v1`; blocked/corrupt storage falls back to defaults.
- SFX events are derived from snapshot deltas and visual effects: local projectile creation, hit damage text, target destruction, sector-event spawn/destroy, level toast, upgrade ready, death, and alpha destruction.
- High-projectile classes group fire sounds by snapshot so Octo/Penta/Triplet do not play one sound per bullet.
- Local fire events carry `feedbackProfile`, `gain`, `pitchScale`, and profile cooldown data. Existing SFX assets are reused; the profile only changes gain/pitch/cooldown so class identity improves without new audio files.
- SFX rate limits are bucketed by role: fire, hit, destroy, UI, and level.
- Mix priority is role-based: alpha destroy, level-up, and death are critical; tank destroy and upgrade-ready are high; repeated fire and hit spam are lower priority.
- Alpha destroy keeps a minimum event gain even when it happens far from the local tank so the center objective stays audible.
- Active SFX voices are capped at `18`; lower-priority voices can be skipped/stolen before level/death/alpha sounds.
- Missing SFX files fall back to a short generated tone so audio asset failures do not break gameplay.
- F3 debug includes audio lock/running state, mute/music/SFX toggles, active voice counts, asset load failures, event counts per second, and current music track.

## First-Match Onboarding Layer

The client tracks onboarding milestones from snapshots/death events and stores only `{ version, completed, dismissed }` in `localStorage` under `tankArena.onboarding.v1`.

- Prompts are UI-only and never alter server state or balance.
- Milestones cover join, movement, firing, XP gain, upgrade-point availability, first upgrade spent, class choice availability, first class selection, tree opening, Alpha objective availability, first death, death-penalty explanation, and final survival guidance.
- Prompt priority is controls -> farming -> stat upgrade -> class cards -> full tree -> Alpha objective -> death penalty -> survival.
- Prompts are hidden during menu/connecting and while modals are open. Normal prompts are suspended when class cards need the screen; the class-choice prompt is allowed because it explains the cards.
- Death screens can show only the death-penalty prompt, above the death overlay, so gameplay HUD controls do not compete with it.
- Players can dismiss onboarding with the prompt button or `Escape`.
- Old v1 saved completion is versioned; dismissed players stay dismissed, while non-dismissed completed state can receive the newer guidance.
- Storage failures are ignored so onboarding cannot break gameplay.

## Mobile-Friendly Menu Layer

The menu is a mobile-first arcade lobby overlay inspired by classic arena shooter menus. It does not change gameplay or server state.

- Static menu copy and control chips live in `client/src/ui/menuConfig.js`.
- Button label, disabled state, and status tone are derived by `client/src/ui/menuViewModel.js`.
- The menu keeps stable DOM ids for `joinForm`, `playerName`, `joinButton`, and `menuStatus`.
- The visual hierarchy is full-screen: decorative arena backdrop, corner action badges, chunky outlined title, mode/region tiles, name input, primary Play button, status, and control chips.
- Touch targets are at least 44 px high, name input uses 16 px text to avoid mobile zoom, and safe-area padding is respected.

## Mobile Twin-Stick Controls

Mobile/touch gameplay uses two independent virtual sticks without changing server authority:

- Left-side touches are assigned to movement for the lifetime of that touch, even if the thumb crosses the screen center.
- Right-side touches are assigned to aim/fire. While held, the client sends `fire: true` and aims at the right thumb position relative to the local tank.
- `LOCK` toggles continuous fire using the last valid aim angle. It resets on death, menu/modal states, respawn, or reconnect.
- Movement uses a dead zone and clamp from `touchControlsConfig.js`; the existing server sanitization and tank-motion code still normalize movement before simulation.
- The overlay is client-only, hides outside alive gameplay, respects mobile HUD safe zones, and is covered by pure touch-state tests plus the mobile browser smoke check.
- `hud.js` owns wiring only: saved name loading, submit handling, and view-model rendering.

## Testing Checklist

- Run `npm test`.
- Run `npm run test:browser` for the browser runtime smoke suite.
- Run `npm run test:all` before larger releases when both unit and browser smoke coverage are needed.
- Run `npm start`.
- Open `http://localhost:3000`.
- Join in two tabs and verify both tanks can move, aim, shoot, damage shapes, level up, spend upgrade points, die, and respawn.
- Reach a level 15/30/45/60 class, die, and verify the death screen reports the level halving and the respawned tank has a legal downgraded class plus refunded upgrade points.
- Register, log in, buy/equip a cosmetic, and verify the tank renders with the equipped loadout.
- For public beta, set `NODE_ENV=production`, `PUBLIC_BASE_URL`, `ALLOWED_ORIGINS`, and `ACCOUNT_STORE_PATH`, then verify `/healthz`, `/readyz`, secure cookies, quickplay join, account persistence after restart, and `.bak` backup retention.
- Create a custom room and verify another tab can join it.
- Verify public and custom rooms have isolated leaderboards.
- Leave the server with no humans and verify bots remain active but do not exceed the no-human governance cap.
- Reach level 15/30/45/60 or use the developer level tool, verify class upgrade cards appear, choose a full path such as `Flank Guard -> Tri-Angle -> Fighter -> Comet`, then press `T` to verify the full tree marks current/path/locked/wrong-branch nodes correctly.
- Click Play, verify background music starts after the gesture, fire/hit/level/death SFX play, and Menu audio sliders/mute persist after refresh.
- Toggle `F3` and verify debug metrics update.
- In `F3`, verify `eventObjectives.active`, completion/expiry counts, human/bot contribution split, and recent samples update after a sector event is destroyed or expires.
- In `F3`, verify `botBehavior` shows mode/target/panic/revenge counts while bots fight and farm.
- Resize desktop and narrow viewport and verify HUD panels remain readable.

## Definition Of Done

- One command starts a playable local/LAN arena after install.
- Multiplayer state is server-authoritative.
- Big map, bots, shapes, shooting, XP, upgrades, leaderboard, minimap, death, respawn, and debug overlay are present.
- Fast leveling and half-level death penalty are present, with class/upgrade downgrade rules enforced server-side.
- Tank evolution tree and server-authoritative class selection are present.
- Command drone behavior for `Overseer`, `Overlord`, and `Necromancer` is present, server-authoritative, capped, and test-covered.
- Login, cosmetic shop, persistent account inventory, quickplay, and custom rooms are present.
- Public beta runtime config, health/readiness, production cookie/origin hardening, WebSocket heartbeat/rate limits, persistent-volume account path, bounded account backups, and graceful shutdown are present.
- Client-side BGM/SFX, persisted audio settings, and audio debug are present without changing server authority.
- Config is separate from logic.
- `README.md` documents run/test/control instructions.
- Tests cover key formulas, bot governance, failure-prone helper systems, and real browser smoke flows.

## Self-Review

Likely bugs:

- JSON snapshots can become heavy with many entities and players.
- Snapshot interpolation can add up to `100 ms` of visual delay for remote entities.
- Local visual extrapolation can show a small correction if server state diverges after latency spikes.
- Multi-barrel and drone ultimate classes increase offensive entity count and may need stricter caps when Level 30/45/60 classes become active.
- Mobile twin-stick controls now cover independent movement and aim/fire. They still need real-device tuning for hand size, dead-zone comfort, and accidental fire-lock taps.

Missing edge cases:

- No reconnect-to-same-player token after browser refresh.
- No email verification, password reset, payment provider, or real cloud region orchestration.
- JSON account storage is suitable for one public beta process with a persistent volume, not multi-instance or high-traffic production.
- Login rate limits, room state, WebSocket clients, and account JSON writes are process-local.
- Spatial hash is now present, but JSON snapshots can still be the next performance bottleneck at higher entity/player counts.
- No persistent account or match history.

Maintainability issues:

- `serverGame.js` is the largest module because it owns the full v1 authority loop.
- Bot behavior is still finite-state, but now profile-driven instead of one shared style.
- Bot governance is intentionally conservative; it prevents runaway server history but does not yet make bot threat visually obvious.

What should be improved next:

- Add advanced drone formations, priority targeting, or drone-specific audio assets after live balance data confirms the base control branch is stable.
- Add password reset/email verification if accounts become internet-facing.
- Replace JSON account storage with SQLite/Postgres before multi-instance or larger public deployment.
- Add bot threat readability rings or nameplate color.
- Add deeper snapshot payload optimization if F3 shows render/network cost after this pass.
- Tune mobile twin-stick comfort on real devices and add deeper mobile combat smoke coverage if browser touch simulation is stable enough.
