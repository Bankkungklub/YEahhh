# Tank Arena

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Bankkungklub/YEahhh)

A browser tank arena inspired by diep.io: large map, WebSocket multiplayer, public/custom rooms, bots, shooting, command drones, shapes, XP, upgrades, cosmetic accounts, shop inventory, leaderboard, minimap, death/respawn, and debug tools.

The current arena is `9000x9000` with a large center `Alpha Pentagon`. It has `1400 HP`, grants `4200 XP` through contribution-based shared rewards, and respawns every `45s`. Timed Alpha Sector events now spawn elite objectives around the arena so players have smaller risk/reward fights away from center.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`. Use two browser tabs to test multiplayer on the same machine. Other machines on the LAN can connect to the host machine's IP address on port `3000`.

Set a different port when needed:

```bash
$env:PORT=3001; npm start
```

## Public Beta Server

The game can run as a single public beta Node server behind HTTPS on any host that supports WebSockets. The client, API, WebSocket rooms, shop/auth, and authoritative simulation stay in one process for this release. Do not run multiple Node instances against the same JSON account file.

Recommended production environment:

```bash
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://your-domain.example
ALLOWED_ORIGINS=https://your-domain.example
TRUST_PROXY=1
ACCOUNT_STORE_PATH=/data/accounts.json
SESSION_COOKIE_SECURE=auto
DEBUG_ENDPOINTS=false
MAX_WS_CLIENTS=160
WS_HEARTBEAT_MS=25000
WS_HEARTBEAT_TIMEOUT_MS=10000
WS_MESSAGE_RATE_LIMIT=90
ACCOUNT_BACKUP_INTERVAL_MS=21600000
ACCOUNT_BACKUP_MAX_FILES=12
SHUTDOWN_GRACE_MS=8000
```

Production boot fails if no public origin is configured. Account data is still JSON-backed, but `ACCOUNT_STORE_PATH` can point at a persistent volume such as `/data/accounts.json`. The server probes that path on startup, writes atomic JSON saves, creates bounded `.bak` backups, exposes `/healthz` and `/readyz`, rejects explicit bad-origin API/WebSocket requests, sends secure cookies in production, closes stale/spam WebSocket clients, and drains on `SIGTERM`.

For Render, this repo includes `render.yaml`. It defines a single `starter` Node web service in Singapore with a `/data` persistent disk. Render provides `RENDER_EXTERNAL_URL` automatically, and the server uses that URL as the default allowed public origin.

Public beta limits:

- One Node process only; no clustering or multi-region room sharing yet.
- Render Free web services cannot attach persistent disks, so use a paid instance type for this JSON-backed public beta.
- Use HTTPS in front of the server so secure cookies work.
- Keep `/debug/*` disabled in production unless you are doing a private diagnosis.
- Back up the persistent volume before changing hosts or storage paths.

## Login, Shop, And Rooms

- `Log In`: register/login/logout with server-owned accounts and HttpOnly session cookies.
- `Shop`: browse cosmetics, buy with earned coins, and equip tank body colors, outlines, and badges.
- `Play`: quick-joins the public FFA room.
- `Custom Games`: create/list/join custom rooms on the same Node server.
- `Menu`: shows local matchmaking and current room status.

Accounts are stored in `server/data/accounts.json` for local development. Passwords are salted and hashed with Node `crypto.scrypt`; plaintext passwords are never stored. This is production-shaped local auth, not a cloud account service.

Developer seed account for local development:

- Username: `Admin`
- Password: `123456@@##$$`
- Role: `developer`
- This account is seeded only outside `NODE_ENV=production`.
- When logged in and inside the arena, a `DEV LEVEL` panel appears. It can set the active admin tank to level `1..60`; the server resets XP/upgrades, refunds the legal upgrade budget, refreshes class choices, and fully heals the alive tank.

## Controls

- Move: `WASD` or arrow keys
- Aim: mouse
- Shoot: hold mouse button or `Space`
- Tank tree: `T`
- Hide/show stat upgrades: `U`; upgrade buttons show current/max level plus a before/after stat preview, and the collapsed control reads `SHOW UPGRADES +N` so it is clear that points are still available.
- Audio settings: `Menu`
- Mobile/touch: left thumb moves, right thumb aims/fires, and the `LOCK` button toggles continuous fire using the last aim direction.
- Mobile combat HUD uses explicit safe zones: class cards lift above the thumb-control lane, fire lock stays below class cards, and cards clamp to two fact chips on phone widths.
- Control branch: `Overseer`, `Overlord`, `Necromancer`, and `Hive Lord` use fire input to command drones. Hold fire/right stick to send drones toward your aim point; release to recall them into orbit.
- Weapon identity rules are class-specific: `Streamliner` emits five straight forward shots as a timed stream, `Gunner` / `Auto Gunner` / `Sprayer` now use short rapid-spray cadence windows, while trap classes place armed defenses instead of normal bullets.
- Class cards show config-derived weapon fact chips such as `7 shots`, `120ms spray`, `drone 10`, `trap blocks`, `850ms steer`, or `heavy shell` so tank choices are readable during live play.
- Debug overlay: `F3`
- First-match hints teach controls, farming, stat upgrades, class cards/tree tiers, the center Alpha objective, and the half-level death penalty. They are UI-only and can be dismissed with `Skip` or `Escape`.
- The live HUD now derives one compact action priority: death, class choice, stat upgrades, Alpha urgency, danger, Alpha contest, or farming. This does not replace existing HUD panels; it only clarifies the next useful action.
- Sector events can also appear in the action pill, minimap, and F3 debug as `SHARD`, `VOLATILE`, `BULWARK`, or `BEACON` objectives with HP percent and expiry time.
- High-level bots can become `Rival`, `Threat`, or `Bounty` targets. Nearby bounty bots can appear in the action pill as `BOUNTY NEAR`, `RIVAL LOW`, or `REVENGE TARGET`; killing a bounty bot pays one bounded bonus reward and then clears that bot's rival state.

## Tank Evolution Tree

- When a class tier is available, Diep-style upgrade cards appear in-game above the HP/XP bar. Click a card or press `1`-`4` to choose; press `Escape` or `HIDE` to collapse that tier into a `CLASS +N` pill.
- Press `T` or the in-game `TREE` button to view the class diagram.
- Level `1` starts as `Basic`.
- Level `15` unlocks `Twin`, `Sniper`, `Machine Gun`, and `Flank Guard`.
- Level `30` unlocks the next branch for the selected class.
- Level `45` unlocks the final branch for the selected level 30 class.
- Level `60` unlocks ultimate forms for selected level 45 parents.
- Every level `30` branch now has level `45` final choices:
  `Tri-Angle -> Booster/Fighter`, `Hunter -> Predator/Streamliner`,
  `Destroyer -> Annihilator/Hybrid`, `Gunner -> Auto Gunner/Sprayer`,
  `Machine Gun -> Firework Tank -> Starburst`, `Sniper -> Trapper -> Minefield`,
  and `Flank Guard -> Rammer -> Spike`.
- The first level `60` ultimate set is: `Starburst -> Missile Command`, `Sprayer -> Stormcaller`, `Annihilator -> Siege Core`, `Necromancer -> Hive Lord`, `Minefield -> Aegis Bastion`, and `Fighter -> Comet`.
- HUD panels follow a visibility contract: stat upgrades, class cards, TREE, and developer tools hide while dead; opening the full TREE/modal suspends class cards so the two upgrade UIs never fight each other.
- Class selection is server-authoritative. The client can request a class, but the server validates level and branch rules.
- Class choices change the active combat loadout only; control branch classes swap normal projectiles for server-authoritative drone loadouts. They do not affect account coins, shop cosmetics, login, rooms, or XP formulas.
- Tank silhouettes now come from the shared class config. Icons and live tanks use the same `body/ring/core/accent/barrel style` schema, so sniper, heavy, rocket, trap, body, gunner, spread, and control branches are visually readable instead of repeated circles with rectangular barrels.
- Class balance metadata lives beside the class config. Tests calculate focused DPS, total DPS, mobility, survivability, burst score, projectile count, and role budgets so visual identity changes do not accidentally create overpowered classes.

## Tests

```bash
npm test
```

The automated tests cover config/progression formulas, stat upgrade previews, level `60` class activation, class identity metadata, weapon fact chips, mobile combat safe zones, touch fire-lock reset behavior, faster balance pacing, half-level death penalty, full tank class activation, weapon/projectile patterns, delayed rapid cadence for Streamliner/Stormcaller/Gunner/Auto Gunner/Sprayer, limited-turn missiles, trap projectile blocking, command drone config/lifecycle/combat/balance, Alpha Sector event objectives/rewards/expiry, combat readability damage causes, contact collision, bot personalities, bot rival/bounty rewards and anti-farm caps, spatial hash queries, circle collision helpers, spawn safety fallbacks, bot governance, auth, shop purchases/equips, coin economy, room matchmaking, collapsible upgrade UI state, first-match onboarding, and client audio event/config rules.

Browser smoke tests are available for runtime UI/gameplay regressions:

```bash
npm run test:browser
```

The Playwright smoke harness starts a local server on `http://127.0.0.1:3101`, boots the real browser client, joins the arena, logs in as the local developer Admin account, sets level `60`, selects `Flank Guard -> Tri-Angle -> Fighter -> Comet`, opens the TREE modal, toggles F3 debug, and checks a `390x720` mobile flow with synthetic twin-stick drag, right-stick fire, fire lock, developer level class cards, mobile fact-chip clamping, and class-card overlap guards. Console errors and page errors fail the smoke run. Use `npm run test:all` when you want both the Node unit suite and browser smoke suite.

## Development Notes

- Core game constants live in `shared/config/gameConfig.js`.
- Public beta runtime hardening lives in `server/src/runtimeConfig.js`, `server/src/serverHealth.js`, and `server/src/accountBackups.js`. These modules own env parsing, production origin/cookie/storage settings, health/readiness snapshots, storage write probes, and bounded JSON backup rotation.
- Faster leveling/reward pacing lives in `shared/config/balanceConfig.js`.
- Center map objective tuning lives in `shared/config/worldContentConfig.js`.
- Alpha Sector event tuning lives in `shared/config/eventObjectiveConfig.js`; pure spawn pacing, contribution split, expiry, and debug summary helpers live in `shared/sim/eventObjectives.js`.
- Command drone tuning lives in `shared/config/droneConfig.js`; pure drone command/motion/conversion helpers live in `shared/sim/drones.js`, and drone balance summaries live in `shared/sim/droneBalance.js`.
- Bot personality weights, rival/bounty thresholds, reward caps, and revenge targeting tuning live in `shared/config/botProfileConfig.js`; pure rival helpers live in `shared/sim/botRivals.js`.
- App/auth/shop/matchmaking constants live in `shared/config/appConfig.js`.
- Cosmetic catalog items live in `shared/config/shopCatalog.js`.
- Tank class tree definitions live in `shared/config/tankClassConfig.js`. Shot configs support optional `delayMs` values for timed bursts; normal shots default to `0`, so existing same-frame salvos stay backward-compatible.
- Tank class identity metadata lives in `shared/config/tankClassIdentityConfig.js`, with validation/view helpers in `shared/sim/tankClassIdentity.js`. Every active class has a short role label, weapon line, strength, weakness, feel tags, and feedback profile so cards, visuals, audio, and tests stay aligned.
- Config-derived weapon fact chips live in `shared/sim/tankWeaponFacts.js`. The helper summarizes shot count, burst window, spread width, projectile kind, drone caps, trap blocking, missile steering, heavy shells, body-contact identity, and the current `Hybrid` shell-escort limitation without duplicating gameplay numbers in UI copy.
- Tank class role/budget summaries live in `shared/sim/tankClassBalance.js`.
- Tank class physics/recoil summaries live in `shared/sim/classPhysicsAudit.js`; directional shot recoil math lives in `shared/sim/tankRecoil.js`.
- Combat-feel tuning for recoil, projectile threat visuals, traps/rockets, and contact damage lives in `shared/config/combatFeelConfig.js`.
- Combat feedback labels/colors and damage indicator tuning live in `shared/config/combatFeedbackConfig.js`; normalized damage/death cause mapping lives in `shared/sim/damageSources.js`.
- Tank class validation, unlock logic, and class stat modifiers live in `shared/sim/tankClasses.js`.
- Projectile behavior helpers live in `shared/sim/projectileBehaviors.js`, including rocket spark bursts, limited-turn missile steering, trap arming/hit budget, and armed-trap projectile blocking.
- Tank/object contact pushback and body-damage formulas live in `shared/sim/contactCollision.js`.
- Class upgrade card/tree view-model helpers live in `shared/sim/classUpgradeViewModel.js`. Upgrade cards now show identity metadata directly: role label, weapon behavior, strength, config-derived weapon fact chips, and a compact weakness/counterplay line.
- Stat upgrade before/after preview helpers live in `shared/sim/upgradePreview.js`; the HUD uses them to show real HP, regen, damage, speed, reload, movement, and drone-specific rebuild/contact-damage effects without changing gameplay formulas.
- HUD safe-zone and visibility helpers live in `client/src/ui/hudVisibility.js` and `client/src/ui/hudLayout.js`; tune spacing in `client/src/ui/hudLayoutConfig.js`. Mobile layout reserves separate boxes for class cards, the lower touch-control lane, fire lock, bottom HP/XP, minimap, and action pill.
- Mobile twin-stick state lives in `client/src/input/touchControls.js` with tuning in `client/src/input/touchControlsConfig.js`. The server input payload is unchanged: left stick writes movement, right stick writes aim/fire, and fire lock reuses the last valid aim angle. Deactivating gameplay through death/menu/modal clears active touches and fire lock.
- Server authority lives in `server/src/serverGame.js`.
- Center objective lifecycle and shared XP rewards live in `server/src/centerObjectiveSystem.js`.
- Sector event objective lifecycle lives in `server/src/eventObjectiveSystem.js`. It creates elite shape entities, tracks contributors, pays the `80%` shared / `20%` last-hit split, expires unfinished events without reward, and emits Volatile Triangle neutral sparks.
- Command drone lifecycle lives in `server/src/droneSystem.js`. It rebuilds missing base drones, moves drones through orbit/attack/return states from existing aim/fire input, applies drone contact damage, lets projectiles/traps/sparks/rockets destroy drones, cleans drones on death/class change/disconnect, and handles Necromancer/Hive Lord normal-shape conversion.
- Account persistence lives in `server/src/accountStore.js`.
- Account storage is production-beta safe only for one process with a persistent volume. `ACCOUNT_STORE_PATH` overrides the local `server/data/accounts.json` path; backups are stored beside that file in an `.backups` directory and pruned by `ACCOUNT_BACKUP_MAX_FILES`.
- Public/custom rooms are managed by `server/src/roomManager.js`.
- WebSocket hardening lives in `server/src/networkHub.js`: origin allowlist, max connected clients, heartbeat ping/pong, stale socket closure, per-client message-rate guard, and shutdown closure. Client protocol and gameplay payloads are unchanged.
- Health and readiness routes live in `server/src/httpRouter.js`: `/healthz` reports process/storage readiness without secrets, and `/readyz` returns `503` while booting or draining.
- Client rendering is Canvas-only and lives in `client/src/render/canvasRenderer.js`; the active gameplay style is bright arcade/pixel-inspired.
- Snapshot-derived muzzle flashes and impact bursts live in `client/src/game/combatEffects.js`; they are visual-only.
- Collapsible stat upgrade panel state lives in `client/src/ui/upgradePanelState.js` and persists in `localStorage`; pulse timing is time-based so the collapsed state does not get stuck.
- Client audio lives in `client/src/audio/*`; it is visual/snapshot-derived, client-only, and never changes server authority, damage, XP, movement, bot AI, rooms, login, or shop. Fire SFX reuse existing assets but apply feedback-profile gain/pitch/cooldown tuning for rapid, storm, heavy, rocket, missile, trap, drone, booster, and body identities.
- Audio assets live in `client/assets/audio`. The BGM is OpenGameArt `Chill (Loopable)` under CC0, the fire laser is OpenGameArt `Laser_shooting_sx` under CC0, and supporting short SFX are local generated WAVs.
- Browser autoplay rules apply: music/SFX unlock only after a click, key press, tap, or Play action. `Menu` exposes master/music/SFX volume, mute, and on/off toggles; settings persist in `localStorage` under `tankArena.audio.v1`.
- First-match onboarding lives in `client/src/game/onboarding.js`. It stores only `{ version, completed, dismissed }` in `localStorage`, derives runtime milestones from snapshots/death events, hides behind menu/modal/death rules, and does not modify XP, damage, bots, rooms, accounts, or class selection authority.
- Browser regression smoke tests live under `tests/browser`. They are intentionally flow-level checks, not balance tests: they protect boot, join, Admin level tooling, class-card tiering, TREE/F3 runtime behavior, mobile viewport boot/touch overlay, and console/page-error regressions.
- Adaptive render quality lives in `client/src/render/renderQuality.js`; it drops decorative clouds/trails/effect cap first when FPS is low and caps trail cost in projectile-heavy fights.
- Alpha objective metrics are debug-only observability. F3/debug expose Alpha lifetime, kill count, contributor peaks, human/bot damage split, reward totals, killer kind, and recent kill samples without changing Alpha HP, XP, respawn, or bot targeting.
- Alpha Sector events are config-driven timed elite objectives:
  - `Alpha Shard`: `460 HP`, `760 XP`, `14` coins, safer shared fragment.
  - `Volatile Triangle`: `210 HP`, `520 XP`, `10` coins, emits `8` neutral spark projectiles on death.
  - `Bulwark Square`: `820 HP`, `1450 XP`, `29` coins, takes `0.85x` incoming damage and has higher contact danger.
  - `Beacon Pentagon`: `680 HP`, `1700 XP`, `34` coins, late-midgame high-value sector objective.
  - Events unlock by highest human level or match age, spawn `1800-4200 px` from center, keep at most `1` active before level `30` and `2` at level `30+`, and cap recent debug samples at `8`.
- HUD action priority lives in `client/src/ui/hudActionPriority.js`; it chooses one short action pill while keeping existing panels visible. Sector events sit below death/class/upgrade/Alpha-critical/danger states and above the default farm prompt.
- Bot rival/bounty state is server-owned. A bot must be at least level `15` and earn pressure through kill streaks, score, or recent conflict before it becomes visible as a rival. Bounty rewards are capped at `4-18` coins plus bounded XP/score, are claimable only once per bot life, and use a `2 claims / 90s` per-player anti-farm window.
- Command drones are server-authoritative bounded entities:
  - `Overseer`: `2` drones, `26 HP`, `9` contact damage, `1800 ms` base rebuild.
  - `Overlord`: `4` drones, `30 HP`, `10` contact damage, `1650 ms` base rebuild.
  - `Necromancer`: `4` base drones and up to `8` total swarm drones; converted drones use `18 HP`, `7` contact damage, and expire after `18000 ms`.
  - `Hive Lord`: level `60`, `5` base drones and up to `10` total swarm drones; converted drones use `18 HP`, `7.5` contact damage, and expire after `16000 ms`.
  - Necromancer/Hive Lord conversion only applies to normal square/triangle/pentagon shape kills, never Alpha, sector events, tanks, or drones. Necromancer square/triangle/pentagon chances are `35%`, `65%`, and `100%`, while Hive Lord uses `38%`, `68%`, and `100%`; pentagons spawn `2`.
  - Drone kills grant no XP/coins/score; kills caused by drones credit the owner through normal shape/tank reward flow. The room global cap is `180` active drones.
- Level `60` ultimate tanks:
  - `Missile Command`: `Starburst` child, fires three limited-turn missile rockets that steer for `850 ms` and burst into `8` sparks.
  - `Stormcaller`: `Sprayer` child, fires an `8`-shot delayed storm burst over `175 ms`.
  - `Siege Core`: `Annihilator` child, fires one enormous slow shell with heavy recoil.
  - `Hive Lord`: `Necromancer` child, raises a larger `10`-drone temporary swarm.
  - `Aegis Bastion`: `Minefield` child, places a five-trap bullet-blocking wall.
  - `Comet`: `Fighter` child, uses six bullet/booster barrels and existing recoil for forward thrust.
- Audio mix priority is config-driven in `client/src/audio/audioConfig.js`. Death, level-up, Alpha destroy, tank destroy, and upgrade-ready events outrank repeated fire/hit spam, and Alpha destroy keeps a minimum audible gain even when it happens far from the player.
- Server-side spatial hashing lives in `shared/sim/spatialHash.js` and is used for bot target queries and projectile collision broad phase.
- The client never decides damage, XP, deaths, or positions; it sends input and renders server snapshots.
- Desktop movement uses visual local prediction: WASD input moves the local tank immediately on the client, then reconciles against server snapshots using `lastInputSeq`. Small corrections shift the prediction baseline and decay a visual offset so the tank does not wobble every snapshot. Server authority still decides real position, hits, XP, deaths, and collisions.
- Fast arcade risk pacing uses three starter upgrade points, XP multipliers of `0.22` for levels `1-14`, `0.36` for `15-29`, `0.55` for `30-45`, and the base curve for the new `46-60` ultimate chase. Shape XP is square `35`, triangle `80`, pentagon `220`, and alpha pentagon `4200`.
- Death penalty is server-authoritative: player and bot deaths reduce level to `ceil(level * 0.5)`, reset current XP, halve score, reset upgrades, refund the legal upgrade budget for the new level, downgrade class to the deepest valid previous branch, and expire the victim's old projectiles.
- Player damage events are server-authored and local-only. They identify bullet, rocket, spark, trap, drone, tank contact, shape contact, Alpha contact, or unknown damage; contact damage events are rate-limited so body collision does not spam the network, while death events always include the final killing cause.
- Shooting uses Diep-style barrel-tip projectile spawning, directional authoritative recoil, local recoil prediction, barrel kick, projectile trails, rocket spark bursts, armed traps, and impact flashes. Rear booster barrels push `Tri-Angle`, `Booster`, and `Fighter` forward; radial/flank classes mostly cancel recoil; heavy cannons kick backward harder. `Streamliner` uses delayed shot timing (`0/45/90/135/180 ms`) to read as a straight rapid stream rather than a same-frame spread. `Gunner`, `Auto Gunner`, and `Sprayer` preserve their old shot counts/damage sums but emit over `84 ms`, `96 ms`, and `120 ms` windows so rapid branches read as sprays instead of static clumps. Projectile threat language is config-driven: rockets use stronger outlines/trails and shockwave impacts, sparks render as shard-like fragments, traps pulse with armed warning rings, rapid/precision/spread/booster bullet profiles use modest trail/core differences, and heavy shells read through larger bullet radius/outline. Projectile snapshots also carry compact `ownerClassId`, `feedbackProfile`, and `ageMs` metadata so the client can make `Missile Command`, `Stormcaller`, `Siege Core`, `Aegis Bastion`, and similar identities more readable while falling back to kind-based rendering if metadata is absent. Armed hostile traps block bullet, spark, and rocket projectiles, consuming their trap hit budget; unarmed traps and own traps do not block. Low render quality removes decorative trails/effects first, never bullets/traps/tanks.
- Contact collision prevents tanks from simply passing through shapes and tanks: overlaps push entities apart and apply body damage. `Rammer` and `Spike` trade weak shots for higher body damage, HP/resistance, and speed.

## Remaining v1 Limits

- Auth and matchmaking are local-server implementations; no email verification, password reset, payment provider, or cloud region orchestration yet.
- JSON snapshots are simple and debuggable, not bandwidth-optimized.
- Bot AI is finite-state and profile-driven. Current profiles are Rookie, Farmer, Duelist, Sniper, and Pro; they differ by reaction time, aim jitter, retreat threshold, target memory, panic/revenge behavior, aim lead, greed, target stickiness, class preference, and upgrade priority. Rival/bounty behavior adds lightweight memorable targets, not full narrative enemies or new bot classes.
