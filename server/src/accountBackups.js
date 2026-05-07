import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export function checkStorageWritable(filePath) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const probePath = join(dir, `.write-probe-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(probePath, "ok", "utf8");
  rmSync(probePath, { force: true });
  return true;
}

export function createAccountBackup(filePath, {
  now = () => Date.now(),
  backupDir = `${filePath}.backups`
} = {}) {
  if (!existsSync(filePath)) {
    return null;
  }
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `${basename(filePath)}.${now()}.bak`);
  copyFileSync(filePath, backupPath);
  return backupPath;
}

export function pruneAccountBackups(filePath, {
  maxFiles = 12,
  backupDir = `${filePath}.backups`
} = {}) {
  if (!existsSync(backupDir)) {
    return [];
  }
  const backups = readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".bak"))
    .map((entry) => ({
      name: entry.name,
      path: join(backupDir, entry.name),
      timestamp: readBackupTimestamp(entry.name)
    }))
    .sort((a, b) => b.timestamp - a.timestamp || b.name.localeCompare(a.name));
  const removed = [];
  for (const backup of backups.slice(Math.max(0, maxFiles))) {
    rmSync(backup.path, { force: true });
    removed.push(backup.path);
  }
  return removed;
}

export function runAccountBackup(filePath, options = {}) {
  const backupPath = createAccountBackup(filePath, options);
  pruneAccountBackups(filePath, options);
  return backupPath;
}

function readBackupTimestamp(name) {
  const match = /\.(\d+)\.bak$/.exec(name);
  return match ? Number(match[1]) : 0;
}
