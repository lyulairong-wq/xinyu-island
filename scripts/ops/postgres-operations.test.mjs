import assert from "node:assert/strict";
import test from "node:test";
import { validateBackupEnvironment } from "./postgres-backup.mjs";
import { validateRestoreEnvironment } from "./postgres-restore.mjs";

test("backup requires a production PostgreSQL URL and absolute protected paths", () => {
  assert.doesNotThrow(() => validateBackupEnvironment({
    NODE_ENV: "production",
    BACKUP_DATABASE_URL: "postgresql://backup:secret@postgres.internal/xinyu",
    BACKUP_DIR: process.platform === "win32" ? "C:\\secure\\backups" : "/secure/backups",
    BACKUP_PASSPHRASE_FILE: process.platform === "win32" ? "C:\\secure\\backup.pass" : "/secure/backup.pass"
  }));
  assert.throws(() => validateBackupEnvironment({ NODE_ENV: "development" }), /NODE_ENV/);
  assert.throws(() => validateBackupEnvironment({ NODE_ENV: "production", BACKUP_DATABASE_URL: "mysql://x", BACKUP_DIR: "/secure", BACKUP_PASSPHRASE_FILE: "/secure/key" }), /PostgreSQL/);
});

test("restore requires an explicit confirmation and isolated target database", () => {
  const base = {
    RESTORE_CONFIRMATION: "RESTORE_TO_ISOLATED_DATABASE",
    RESTORE_DATABASE_URL: "postgresql://restore:secret@postgres.internal/xinyu_restore_drill",
    BACKUP_FILE: process.platform === "win32" ? "C:\\secure\\xinyu.dump.enc" : "/secure/xinyu.dump.enc",
    BACKUP_PASSPHRASE_FILE: process.platform === "win32" ? "C:\\secure\\backup.pass" : "/secure/backup.pass"
  };
  assert.doesNotThrow(() => validateRestoreEnvironment(base));
  assert.throws(() => validateRestoreEnvironment({ ...base, RESTORE_CONFIRMATION: "yes" }), /RESTORE_CONFIRMATION/);
  assert.throws(() => validateRestoreEnvironment({ ...base, RESTORE_DATABASE_URL: "postgresql://restore:secret@postgres.internal/xinyu" }), /isolated/);
  assert.throws(() => validateRestoreEnvironment({ ...base, BACKUP_FILE: "/secure/xinyu.dump" }), /dump\.enc/);
});
