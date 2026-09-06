import { access, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../packages/config/dist/index.js";

const REQUIRED_EVIDENCE = [
  "legal-review.md",
  "compliance-plan.md",
  "cloud-budget-proof.md",
  "backup-restore-drill.md",
  "operations-owner.md"
];

function fail(message) {
  throw new Error(`External beta preflight failed: ${message}`);
}

function assertNoExampleValue(name, value) {
  if (!value || /replace-with|example\.com|changeme/i.test(value)) {
    fail(`${name} must be set to a protected production value`);
  }
}

async function assertEvidence(evidenceDirectory) {
  if (!evidenceDirectory || !isAbsolute(evidenceDirectory)) {
    fail("BETA_RELEASE_EVIDENCE_DIR must be an absolute protected directory");
  }

  for (const name of REQUIRED_EVIDENCE) {
    const target = resolve(evidenceDirectory, name);
    if (!target.startsWith(`${resolve(evidenceDirectory)}${process.platform === "win32" ? "\\" : "/"}`)) {
      fail("release evidence path is invalid");
    }
    try {
      await access(target);
      const metadata = await stat(target);
      if (!metadata.isFile() || metadata.size === 0) fail(`required evidence is missing or empty: ${name}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("External beta preflight failed:")) throw error;
      fail(`required evidence is missing or unreadable: ${name}`);
    }
  }
}

export async function runExternalBetaPreflight(env = process.env) {
  assertNoExampleValue("JWT_SECRET", env.JWT_SECRET);
  assertNoExampleValue("FREE_MODEL_API_KEY", env.FREE_MODEL_API_KEY);
  await assertEvidence(env.BETA_RELEASE_EVIDENCE_DIR);
  const config = loadConfig(env);
  if (!config.beta.registrationEnabled) {
    throw new Error("External beta preflight failed: registration must be enabled before launch");
  }
  if (!config.beta.generationEnabled) {
    throw new Error("External beta preflight failed: generation must be enabled before launch");
  }
  return "External beta preflight passed: configuration and named release evidence are present.";
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runExternalBetaPreflight().then((message) => {
    console.log(message);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "External beta preflight failed");
    process.exitCode = 1;
  });
}
