import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkStorageWritable, createAccountBackup, pruneAccountBackups, runAccountBackup } from "../server/src/accountBackups.js";

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "tank-backups-"));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("storage writable probe creates the target directory", () => {
  const fixture = createTempDir();
  try {
    const filePath = join(fixture.dir, "nested", "accounts.json");
    assert.equal(checkStorageWritable(filePath), true);
  } finally {
    fixture.cleanup();
  }
});

test("account backups are created and pruned to fixed retention", () => {
  const fixture = createTempDir();
  try {
    const filePath = join(fixture.dir, "accounts.json");
    writeFileSync(filePath, "{}\n", "utf8");

    const first = createAccountBackup(filePath, { now: () => 1000 });
    const second = runAccountBackup(filePath, { now: () => 2000, maxFiles: 1 });

    assert.ok(first);
    assert.ok(second);
    assert.equal(existsSync(second), true);
    assert.equal(existsSync(first), false);

    const removed = pruneAccountBackups(filePath, { maxFiles: 1 });
    assert.deepEqual(removed, []);
  } finally {
    fixture.cleanup();
  }
});
