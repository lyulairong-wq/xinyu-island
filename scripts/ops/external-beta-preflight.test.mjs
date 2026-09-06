import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runExternalBetaPreflight } from "./external-beta-preflight.mjs";

const evidenceNames = ["legal-review.md", "compliance-plan.md", "cloud-budget-proof.md", "backup-restore-drill.md", "operations-owner.md"];

async function createEvidenceDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "xinyu-m7-evidence-"));
  await Promise.all(evidenceNames.map((name) => writeFile(join(directory, name), "operator supplied evidence\n", "utf8")));
  return directory;
}

function validEnvironment(evidenceDirectory) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://xinyu:secret@postgres.internal/xinyu?sslmode=require",
    JWT_SECRET: "a-secure-production-secret-that-is-longer-than-32-characters",
    WEB_ORIGIN: "https://beta.xinyu.example",
    FREE_MODEL_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    FREE_MODEL_NAME: "qwen3.6-flash-2026-04-16",
    FREE_MODEL_API_KEY: "secure-server-side-key",
    FREE_TOKEN_LIMIT: "3000",
    BETA_REQUIRE_INVITE_CODE: "true",
    BETA_REQUIRE_ADULT: "true",
    BETA_ALLOW_MOCK_FALLBACK: "false",
    BETA_TOKEN_MODE_ENABLED: "false",
    BETA_APPS_ENABLED: "false",
    BETA_FEEDBACK_ENABLED: "true",
    BETA_PROJECT_TOKEN_LIMIT: "20000000",
    BETA_RELEASE_EVIDENCE_DIR: evidenceDirectory
  };
}

test("accepts a locked configuration with all named evidence", async () => {
  const evidenceDirectory = await createEvidenceDirectory();
  await assert.doesNotReject(() => runExternalBetaPreflight(validEnvironment(evidenceDirectory)));
});

test("rejects missing evidence and does not treat configuration alone as a release approval", async () => {
  const environment = validEnvironment("C:\\missing-xinyu-evidence");
  await assert.rejects(() => runExternalBetaPreflight(environment), /evidence/i);
});

test("rejects placeholder production secrets", async () => {
  const evidenceDirectory = await createEvidenceDirectory();
  await assert.rejects(
    () => runExternalBetaPreflight({ ...validEnvironment(evidenceDirectory), FREE_MODEL_API_KEY: "replace-with-a-key" }),
    /FREE_MODEL_API_KEY/
  );
});

test("rejects a paused configuration before an external beta launch", async () => {
  const evidenceDirectory = await createEvidenceDirectory();
  await assert.rejects(
    () => runExternalBetaPreflight({ ...validEnvironment(evidenceDirectory), BETA_GENERATION_ENABLED: "false" }),
    /generation must be enabled/
  );
});
