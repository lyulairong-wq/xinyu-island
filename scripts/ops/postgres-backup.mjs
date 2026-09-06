import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BACKUP_PREFIX = "xinyu-external-beta-";
const BACKUP_SUFFIX = ".dump.enc";
const RETENTION_COUNT = 7;

function fail(message) {
  throw new Error(`PostgreSQL backup failed: ${message}`);
}

function assertAbsolutePath(name, value) {
  if (!value || !isAbsolute(value)) fail(`${name} must be an absolute path`);
  return resolve(value);
}

function assertPostgresUrl(name, value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") throw new Error();
    return parsed;
  } catch {
    fail(`${name} must be a PostgreSQL connection URL`);
  }
}

export function validateBackupEnvironment(env) {
  if (env.NODE_ENV !== "production") fail("NODE_ENV must be production");
  const database = assertPostgresUrl("BACKUP_DATABASE_URL", env.BACKUP_DATABASE_URL);
  const directory = assertAbsolutePath("BACKUP_DIR", env.BACKUP_DIR);
  const passphraseFile = assertAbsolutePath("BACKUP_PASSPHRASE_FILE", env.BACKUP_PASSPHRASE_FILE);
  return { databaseUrl: database.toString(), directory, passphraseFile };
}

async function sha256(file) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("error", reject).on("data", (chunk) => hash.update(chunk)).on("end", () => resolveHash(hash.digest("hex")));
  });
}

async function pruneBackups(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const backups = await Promise.all(entries.filter((entry) => entry.isFile() && new RegExp(`^${BACKUP_PREFIX}\\d{8}T\\d{6}Z\\.dump\\.enc$`).test(entry.name)).map(async (entry) => ({
    path: join(directory, entry.name),
    metadata: await stat(join(directory, entry.name))
  })));
  backups.sort((left, right) => right.metadata.mtimeMs - left.metadata.mtimeMs);
  await Promise.all(backups.slice(RETENTION_COUNT).flatMap(({ path }) => [rm(path), rm(`${path}.sha256`, { force: true })]));
}

export async function createEncryptedBackup(env = process.env) {
  const { databaseUrl, directory, passphraseFile } = validateBackupEnvironment(env);
  await access(passphraseFile);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const output = join(directory, `${BACKUP_PREFIX}${timestamp}${BACKUP_SUFFIX}`);
  const dump = spawn("pg_dump", ["--dbname", databaseUrl, "--format=custom", "--no-owner", "--no-privileges", "--file=-"], { stdio: ["ignore", "pipe", "pipe"] });
  const encrypt = spawn("openssl", ["enc", "-aes-256-cbc", "-pbkdf2", "-iter", "600000", "-salt", "-pass", `file:${passphraseFile}`, "-out", output], { stdio: ["pipe", "ignore", "pipe"] });
  dump.stdout.pipe(encrypt.stdin);

  const [dumpResult, encryptResult] = await Promise.all([
    new Promise((resolveProcess, reject) => dump.on("error", reject).on("close", (code) => code === 0 ? resolveProcess(undefined) : reject(new Error(`pg_dump exited with ${code}`)))),
    new Promise((resolveProcess, reject) => encrypt.on("error", reject).on("close", (code) => code === 0 ? resolveProcess(undefined) : reject(new Error(`openssl exited with ${code}`))))
  ]);
  void dumpResult;
  void encryptResult;

  await writeFile(`${output}.sha256`, `${await sha256(output)}  ${basename(output)}\n`, { encoding: "utf8", mode: 0o600 });
  await pruneBackups(directory);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createEncryptedBackup().then((output) => console.log(`Encrypted backup written: ${output}`)).catch((error) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL backup failed");
    process.exitCode = 1;
  });
}
