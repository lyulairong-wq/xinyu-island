import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function fail(message) {
  throw new Error(`PostgreSQL restore failed: ${message}`);
}

function isolatedDatabaseName(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") throw new Error();
    const database = parsed.pathname.replace(/^\//, "");
    if (!/(^|[-_])(restore|drill|isolated)([-_]|$)/i.test(database)) throw new Error();
    return parsed.toString();
  } catch {
    fail("RESTORE_DATABASE_URL must target an explicitly isolated restore/drill database");
  }
}

function absoluteFile(name, value) {
  if (!value || !isAbsolute(value)) fail(`${name} must be an absolute path`);
  return resolve(value);
}

export function validateRestoreEnvironment(env) {
  if (env.RESTORE_CONFIRMATION !== "RESTORE_TO_ISOLATED_DATABASE") fail("RESTORE_CONFIRMATION is required");
  const databaseUrl = isolatedDatabaseName(env.RESTORE_DATABASE_URL);
  const backupFile = absoluteFile("BACKUP_FILE", env.BACKUP_FILE);
  if (!backupFile.endsWith(".dump.enc")) fail("BACKUP_FILE must be an encrypted .dump.enc backup");
  return { databaseUrl, backupFile, passphraseFile: absoluteFile("BACKUP_PASSPHRASE_FILE", env.BACKUP_PASSPHRASE_FILE) };
}

export async function restoreEncryptedBackup(env = process.env) {
  const { databaseUrl, backupFile, passphraseFile } = validateRestoreEnvironment(env);
  await Promise.all([access(backupFile), access(passphraseFile)]);
  const decrypt = spawn("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-pass", `file:${passphraseFile}`, "-in", backupFile], { stdio: ["ignore", "pipe", "pipe"] });
  const restore = spawn("pg_restore", ["--dbname", databaseUrl, "--clean", "--if-exists", "--no-owner", "--no-privileges"], { stdio: ["pipe", "ignore", "pipe"] });
  decrypt.stdout.pipe(restore.stdin);
  await Promise.all([
    new Promise((resolveProcess, reject) => decrypt.on("error", reject).on("close", (code) => code === 0 ? resolveProcess(undefined) : reject(new Error(`openssl exited with ${code}`)))),
    new Promise((resolveProcess, reject) => restore.on("error", reject).on("close", (code) => code === 0 ? resolveProcess(undefined) : reject(new Error(`pg_restore exited with ${code}`))))
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  restoreEncryptedBackup().then(() => console.log("Encrypted backup restored to isolated database.")).catch((error) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL restore failed");
    process.exitCode = 1;
  });
}
