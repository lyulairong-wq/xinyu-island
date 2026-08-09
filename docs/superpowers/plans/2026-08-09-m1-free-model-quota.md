# M1 Free Model and Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a configurable local Qwen3/Ollama free-generation path with safe fallback, daily quota enforcement, idempotent usage records, and versioned safety regressions.

**Architecture:** Keep `packages/ai` responsible for Provider contracts and OpenAI-compatible transport. Add an API-side model gateway to choose primary and fallback providers, enforce generation limits before persistence, and report sanitized outcomes. Keep quota state and idempotency in PostgreSQL; keep the two-request local-model limit process-local for this single-node M1 deployment.

**Tech Stack:** Next.js, NestJS, TypeScript, Vitest, Prisma/PostgreSQL, Ollama-compatible OpenAI API, `@xinyu/ai`, `@xinyu/safety`.

## Global Constraints

- Use local quantified `Qwen3-8B` through Ollama for M1; do not add a paid Provider or secrets to Git.
- `FREE_TOKEN_LIMIT=6000`, Beijing daily reset, 2,000-character input, 512-token output, one active generation per user, two process-local active model generations, and three-second post-completion cooldown are configuration values.
- Call `packages/safety` before every Provider invocation and evaluate final generated text before persistence; never expose internal prompts, Provider keys, or raw provider error bodies.
- Provider order is configured primary → local fallback → Mock. A failed or repeated request must not create duplicate `TokenUsageRecord` rows.
- Preserve historical migrations; create a new Prisma migration for every schema change.
- M1 has no payment, recharge, subscription, formal chat UI, final persona, or final legal copy.

---

## File Structure

- Create `apps/api/src/model-gateway/model-gateway.service.ts` — Provider selection, health checks, local semaphore, sanitized fallback results.
- Create `apps/api/src/model-gateway/model-gateway.service.spec.ts` — gateway success, timeout, empty response, and fallback cases.
- Create `apps/api/src/model-gateway/model-gateway.module.ts` — exports `ModelGatewayService` to chat.
- Create `apps/api/src/model-gateway/model-limits.ts` — one source of truth for limits and Beijing reset helpers.
- Modify `packages/ai/src/index.ts` — request output cap, provider identity, result usage metadata, timeout classification, and optional API key header.
- Modify `packages/ai/src/index.spec.ts` — OpenAI-compatible request payload, timeout and empty response coverage.
- Modify `packages/config/src/index.ts` and its tests — validate model endpoint, model name, limits, timeout and optional API-key environment variables.
- Modify `apps/api/prisma/schema.prisma` and add a timestamped migration — persist generation request id, status, provider, timestamps and unique usage linkage.
- Modify `apps/api/src/usage/usage.service.ts` and `usage.service.spec.ts` — daily quota, reserve/finalize/release, duplicate-request protection and cooldown.
- Modify `apps/api/src/chat/dto/send-message.dto.ts`, `chat.service.ts`, and `chat.service.spec.ts` — validate request id/length, use the gateway, preflight quota, final-output safety check, and persist a single result.
- Modify `packages/safety/src/index.ts` and `index.spec.ts`; create `packages/safety/src/regression-cases.ts` — versioned 40-case safety corpus and assertions.
- Create `docs/M1_模型额度与安全验证记录.md` — commands run, local-model evidence, PostgreSQL verification, safety result, known limits and third-party Provider deferral.

### Task 1: Define and test model configuration

**Files:**
- Modify: `packages/config/src/index.ts`
- Create: `packages/config/src/index.spec.ts`

**Interfaces:**
- Produces `freeModel: { baseUrl: string; model: string; apiKey?: string; timeoutMs: number; maxOutputTokens: number; maxInputCharacters: number; freeDailyLimit: number; userCooldownMs: number }` on `AppConfig`.

- [ ] **Step 1: Write failing configuration tests** for defaults `6000`, `2000`, `512`, `3000`, reject malformed URL, non-positive limits, and incomplete endpoint/model pairs.
- [ ] **Step 2: Run** `npm.cmd run test --workspace @xinyu/config` **and confirm the new assertions fail.**
- [ ] **Step 3: Implement strict parsing** of `FREE_MODEL_BASE_URL`, `FREE_MODEL_NAME`, `FREE_MODEL_API_KEY`, `FREE_MODEL_TIMEOUT_MS`, `FREE_TOKEN_LIMIT`, `FREE_MAX_INPUT_CHARS`, `FREE_MAX_OUTPUT_TOKENS`, and `FREE_USER_COOLDOWN_MS`; do not log their values.
- [ ] **Step 4: Re-run** `npm.cmd run test --workspace @xinyu/config` **and confirm it passes.**
- [ ] **Step 5: Commit** `feat: validate M1 model limits`.

### Task 2: Upgrade the shared Provider contract

**Files:**
- Modify: `packages/ai/src/index.ts`
- Create: `packages/ai/src/index.spec.ts`

**Interfaces:**
- `GenerationRequest` gains `maxOutputTokens: number`.
- `GenerationEvent` gains optional `provider`, `inputTokens`, and `outputTokens`; failure codes are stable `TIMEOUT`, `UNAVAILABLE`, or `EMPTY_RESPONSE`.
- `OpenAiCompatibleProvider(baseUrl, model, options)` sends `max_tokens`, optional bearer key, and never returns raw response body in `errorCode`.

- [ ] **Step 1: Write failing tests** using a mocked `fetch` for `max_tokens: 512`, a 200 empty choice, a non-2xx response, and an aborted timeout.
- [ ] **Step 2: Run** `npm.cmd run test:ai` **and confirm failure.**
- [ ] **Step 3: Implement the minimal typed contract and transport changes.** Keep `MockAiProvider` deterministic and identify it as `mock`.
- [ ] **Step 4: Run** `npm.cmd run test:ai` **and confirm pass.**
- [ ] **Step 5: Commit** `feat: harden AI provider contract`.

### Task 3: Create the API model gateway and fallback path

**Files:**
- Create: `apps/api/src/model-gateway/model-limits.ts`
- Create: `apps/api/src/model-gateway/model-gateway.service.ts`
- Create: `apps/api/src/model-gateway/model-gateway.module.ts`
- Create: `apps/api/src/model-gateway/model-gateway.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `ModelGatewayService.generate(input): Promise<{ text: string; provider: "primary" | "local" | "mock"; degraded: boolean; inputTokens: number; outputTokens: number }>`.
- The service holds a two-permit in-memory semaphore around non-Mock generation and releases it in `finally`.

- [ ] **Step 1: Write failing gateway tests** for primary success, primary timeout then local success, primary/local failure then Mock success, empty text fallback, and semaphore release after an error.
- [ ] **Step 2: Run** `npm.cmd run test:api -- model-gateway` **and confirm failure.**
- [ ] **Step 3: Implement provider construction from `AppConfig`, `healthCheck`, primary → local → Mock ordering, and sanitized outcome metrics.** The local Provider is Ollama/OpenAI-compatible; no UI response text is finalized here.
- [ ] **Step 4: Run** `npm.cmd run test:api -- model-gateway` **and confirm pass.**
- [ ] **Step 5: Commit** `feat: add model gateway fallback`.

### Task 4: Persist idempotent generation accounting

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260809130000_add_generation_request/migration.sql`
- Modify: `apps/api/src/usage/usage.service.ts`
- Modify: `apps/api/src/usage/usage.service.spec.ts`

**Interfaces:**
- Add `GenerationRequest` with `id`, `userId`, `conversationId`, client `requestId`, `mode`, `status`, `provider`, `reservedTokens`, `completedAt`, and unique `(userId, requestId)`.
- Add nullable unique `generationRequestId` to `TokenUsageRecord`.
- `UsageService.reserveFree(userId, requestId, estimate)`, `finalizeFree(reservation, actual)`, and `releaseFree(reservation)` execute atomically and return stable error codes `FREE_QUOTA_EXCEEDED`, `FREE_COOLDOWN_ACTIVE`, and `FREE_GENERATION_IN_PROGRESS`.

- [ ] **Step 1: Write failing tests** for 6,000 daily limit, Beijing reset boundary, duplicate request id, concurrent reservation, cooldown after completion, and failed Provider release.
- [ ] **Step 2: Run** `npm.cmd run test:api -- usage.service` **and confirm failure.**
- [ ] **Step 3: Add the migration and implement transaction-based reservation/finalization.** Use exact token estimates until a Provider reports usage; record source as `estimated` or `provider`.
- [ ] **Step 4: Run** `npm.cmd run db:generate` and `npm.cmd run test:api -- usage.service`; confirm pass.
- [ ] **Step 5: Commit** `feat: enforce daily free generation quota`.

### Task 5: Integrate the gateway into chat safely

**Files:**
- Modify: `apps/api/src/chat/dto/send-message.dto.ts`
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/chat/chat.service.spec.ts`

**Interfaces:**
- `SendMessageDto` gains UUID `requestId`; content max is read from the M1 limit source, not a hard-coded `4000`.
- Chat flow: ownership/quote validation → input safety → quota reservation → persist user message → gateway generation → final-output safety → persist assistant message → finalize one usage record.

- [ ] **Step 1: Write failing chat tests** for input too long, same request id submitted twice, quota rejection without Provider invocation, cooldown rejection, primary degradation, and final-output safety rejection before assistant persistence.
- [ ] **Step 2: Run** `npm.cmd run test:api -- chat.service` **and confirm failure.**
- [ ] **Step 3: Replace direct `AiProvider` construction in `ChatService` with `ModelGatewayService` and reservation lifecycle.** Preserve ownership, quote and memory isolation behavior.
- [ ] **Step 4: Run** `npm.cmd run test:api -- chat.service` **and confirm pass.**
- [ ] **Step 5: Commit** `feat: apply M1 model quota to chat`.

### Task 6: Build the versioned safety regression corpus

**Files:**
- Create: `packages/safety/src/regression-cases.ts`
- Modify: `packages/safety/src/index.ts`
- Modify: `packages/safety/src/index.spec.ts`

**Interfaces:**
- `SafetyRegressionCase { id: string; category: string; input: string; expected: SafetyAction; forbiddenPatterns: RegExp[] }`.
- Export at least 40 cases: eight for each confirmed category. Tests evaluate inputs and representative provider/Mock final outputs without using real user data.

- [ ] **Step 1: Write the 40-case table and failing table-driven tests** for expected action, ordinary entertainment non-blocking, forbidden output patterns, prompt-injection rejection, memory isolation requests, and fallback safety.
- [ ] **Step 2: Run** `npm.cmd run test:safety` **and confirm failure.**
- [ ] **Step 3: Extend the safety policy only as required for the corpus, returning stable categories and safe transformation/block decisions.** Do not embed full system prompts in fixtures.
- [ ] **Step 4: Run** `npm.cmd run test:safety` **and confirm pass.**
- [ ] **Step 5: Commit** `test: add M1 safety regression corpus`.

### Task 7: Run real local-model and PostgreSQL verification

**Files:**
- Create: `docs/M1_模型额度与安全验证记录.md`

- [ ] **Step 1: Start PostgreSQL with** `docker compose up -d postgres` **and apply migrations with the configured development database.**
- [ ] **Step 2: Start local Ollama Qwen3-8B and configure only local environment values in untracked `.env`.** Verify `/v1/chat/completions` health without recording keys or prompts.
- [ ] **Step 3: Execute API verification** for continuous Chinese generation, one-user concurrency, global two-generation cap, cooldown, 6,000-token exhaustion, provider timeout fallback, duplicate request id, and one usage row per completion.
- [ ] **Step 4: Run** `npm.cmd run test:api`, `npm.cmd run test:ai`, `npm.cmd run test:safety`, and `npm.cmd run verify`; record command outcomes and known limitations in the verification record.
- [ ] **Step 5: Check migration state** using `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma` with the development `DATABASE_URL` and record only pass/fail status.
- [ ] **Step 6: Commit** `docs: record M1 model quota verification`.

## Self-Review

- **Spec coverage:** Tasks 1–3 implement B1; Tasks 4–5 implement B2; Task 6 implements B3; Task 7 supplies the required PostgreSQL and local-model evidence. Third-party Provider selection remains explicitly deferred.
- **Placeholder scan:** No task delegates unspecified behavior; the planned migration name is fixed as `20260809130000_add_generation_request` and must not rewrite prior migrations.
- **Type consistency:** `ModelGatewayService.generate`, `UsageService.reserveFree/finalizeFree/releaseFree`, `GenerationRequest`, and `TokenUsageRecord.generationRequestId` are defined before their consuming tasks.

## Execution Handoff

Plan complete. Execute it on a new `feature/m1-free-model-quota` worktree, one task at a time, with review and verification before every commit and merge.
