if (!process.env.FREE_MODEL_BASE_URL?.trim() || !process.env.FREE_MODEL_NAME?.trim()) {
  throw new Error("Set FREE_MODEL_BASE_URL and FREE_MODEL_NAME before running the real-model E2E check");
}

process.env.E2E_REQUIRE_REAL_MODEL = "1";
await import("./run.mjs");
