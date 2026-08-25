import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dbPort = Number(process.env.E2E_DB_PORT ?? 15433);
const apiPort = Number(process.env.E2E_API_PORT ?? 4100);
const webPort = Number(process.env.E2E_WEB_PORT ?? 3100);
const containerName = `xinyu-e2e-postgres-${process.pid}-${Date.now()}`;
const databaseUrl = `postgresql://xinyu_e2e:xinyu_e2e@127.0.0.1:${dbPort}/xinyu_e2e?schema=public`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const localChrome = process.platform === "win32"
  ? resolve(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe")
  : "";
const environment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  E2E_DATABASE_URL: databaseUrl,
  API_PORT: String(apiPort),
  E2E_API_PORT: String(apiPort),
  E2E_WEB_PORT: String(webPort),
  JWT_SECRET: "xinyu-e2e-only-secret-that-is-long-enough",
  WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}/api/v1`,
  FREE_MODEL_BASE_URL: "",
  FREE_MODEL_NAME: "",
  ...(existsSync(localChrome) ? { PLAYWRIGHT_CHROME_EXECUTABLE: localChrome } : {})
};

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: environment,
      stdio: "inherit",
      shell: process.platform === "win32" && command.endsWith(".cmd"),
      ...options
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function start(command, args, cwd = root) {
  return spawn(command, args, {
    cwd,
    env: environment,
    stdio: "inherit",
    shell: false
  });
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await run("docker", ["exec", containerName, "pg_isready", "-U", "xinyu_e2e", "-d", "xinyu_e2e"], { stdio: "ignore" });
      return;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    }
  }
  throw new Error("Timed out waiting for the isolated E2E PostgreSQL database");
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be binding its local port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // A just-exited child does not need additional cleanup.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function cleanup() {
  await Promise.all([stopProcess(webProcess), stopProcess(apiProcess)]);
  try {
    await run("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  } catch {
    // The container may not have been created; there is nothing to clean up.
  }
}

let apiProcess;
let webProcess;

try {
  await run("docker", [
    "run", "--detach", "--rm", "--name", containerName,
    "--label", "xinyu.e2e=true",
    "--publish", `127.0.0.1:${dbPort}:5432`,
    "--env", "POSTGRES_USER=xinyu_e2e",
    "--env", "POSTGRES_PASSWORD=xinyu_e2e",
    "--env", "POSTGRES_DB=xinyu_e2e",
    "postgres:16-alpine"
  ]);
  await waitForDatabase();
  await run(npm, ["run", "db:generate"]);
  await run(npx, ["prisma", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]);
  await run(npm, ["run", "build"]);
  apiProcess = start("node", ["apps/api/dist/main.js"]);
  await waitForHttp(`http://127.0.0.1:${apiPort}/api/v1/health/ready`);
  webProcess = start("node", [resolve(root, "node_modules/next/dist/bin/next"), "start", "-p", String(webPort)], resolve(root, "apps/web"));
  await waitForHttp(`http://127.0.0.1:${webPort}`);
  await run("node", ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
} finally {
  await cleanup();
}
