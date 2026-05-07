import { resolve, join } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { APP_CONFIG, validateAppConfig } from "../shared/config/appConfig.js";
import { GAME_CONFIG, validateConfig } from "../shared/config/gameConfig.js";
import { validateShopCatalog } from "../shared/config/shopCatalog.js";
import { validateTankClassConfig } from "../shared/config/tankClassConfig.js";
import { AccountStore } from "./src/accountStore.js";
import { checkStorageWritable, runAccountBackup } from "./src/accountBackups.js";
import { AuthService } from "./src/authService.js";
import { seedDeveloperAdminAccount } from "./src/developerAdmin.js";
import { createHttpRouter } from "./src/httpRouter.js";
import { NetworkHub } from "./src/networkHub.js";
import { RoomManager } from "./src/roomManager.js";
import { loadRuntimeConfig, validateRuntimeConfig } from "./src/runtimeConfig.js";
import { createServerHealth } from "./src/serverHealth.js";
import { ShopService } from "./src/shopService.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "..");
const clientDir = join(rootDir, "client");
const sharedDir = join(rootDir, "shared");
const runtime = loadRuntimeConfig(process.env, { rootDir });
const health = createServerHealth({ nodeEnv: runtime.nodeEnv });

const configIssues = [
  ...validateConfig(GAME_CONFIG),
  ...validateAppConfig(APP_CONFIG),
  ...validateShopCatalog(),
  ...validateTankClassConfig(),
  ...validateRuntimeConfig(runtime)
];

if (configIssues.length > 0) {
  throw new Error(`Invalid config: ${configIssues.join(" ")}`);
}

try {
  checkStorageWritable(runtime.storage.accountStorePath);
  health.markStorageReady();
} catch (error) {
  health.markStorageError(error);
  throw error;
}

const accountStore = new AccountStore({ filePath: runtime.storage.accountStorePath });
seedDeveloperAdminAccount({ store: accountStore, nodeEnv: runtime.nodeEnv });
const authService = new AuthService({ store: accountStore, runtime });
const shopService = new ShopService({ store: accountStore });
const roomManager = new RoomManager({ config: GAME_CONFIG, appConfig: APP_CONFIG, accountStore });

const httpServer = createServer(createHttpRouter({
  clientDir,
  sharedDir,
  roomManager,
  authService,
  shopService,
  accountStore,
  config: GAME_CONFIG,
  appConfig: APP_CONFIG,
  runtime,
  health
}));

const network = new NetworkHub({ httpServer, roomManager, authService, config: GAME_CONFIG, runtime });
const tickMs = 1000 / GAME_CONFIG.server.tickRate;
const snapshotMs = 1000 / GAME_CONFIG.server.snapshotRate;
let shuttingDown = false;

const tickTimer = setInterval(() => {
  roomManager.stepAll(1 / GAME_CONFIG.server.tickRate);
  network.flushEvents();
}, tickMs);

const snapshotTimer = setInterval(() => {
  network.broadcastSnapshots();
}, snapshotMs);

const backupTimer = setInterval(() => {
  try {
    runAccountBackup(accountStore.filePath, { maxFiles: runtime.backups.maxFiles });
  } catch (error) {
    console.warn(`Account backup failed: ${error.message}`);
  }
}, runtime.backups.intervalMs);
backupTimer.unref?.();

httpServer.listen(runtime.port, () => {
  health.markReady();
  console.log(`Tank arena running at http://localhost:${runtime.port}`);
});

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

function shutdown(reason) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  health.markDraining();
  clearInterval(tickTimer);
  clearInterval(snapshotTimer);
  clearInterval(backupTimer);
  network.stop();

  const forceTimer = setTimeout(() => {
    console.error(`Forced shutdown after ${runtime.shutdownGraceMs}ms (${reason}).`);
    process.exit(1);
  }, runtime.shutdownGraceMs);
  forceTimer.unref?.();

  httpServer.close(() => {
    clearTimeout(forceTimer);
    console.log(`Tank arena stopped (${reason}).`);
    process.exit(0);
  });
}
