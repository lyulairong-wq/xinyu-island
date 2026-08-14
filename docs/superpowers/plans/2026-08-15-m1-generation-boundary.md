# M1 Generation Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate M1 chat safety, Chinese-only validation, generation orchestration, and Free/Token-simulated settlement into auditable shared paths.

**Architecture:** `GenerationPolicy` owns normalization, script checks, and safety decisions for user input, quotes, and model output. `ChatGenerationCoordinator` owns the shared single/group execution flow and delegates atomic persistence to mode-specific settlement methods. `ChatService` retains only ownership and CRUD adaptation.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma/PostgreSQL, Vitest, existing `@xinyu/safety` and `@xinyu/ai` packages.

## Global Constraints

- M1 accepts Chinese-only chat content after NFKC normalization: at least one Han character and no Unicode Latin-script or compatibility Latin characters; digits, Chinese punctuation and emoji remain valid.
- Apply the same policy to user content, quoted content, and persisted assistant output before any model call or persistence.
- Free uses local model then Mock fallback; Token simulation uses Mock only and never represents payment or real consumption.
- Free and Token simulation must atomically persist user/assistant messages, usage records, and account changes.
- Preserve authorization, ownership checks, API routes, migrations, and the M1 single-instance deployment limit.

## File Structure

- Create `apps/api/src/chat/generation-policy.ts` and `generation-policy.spec.ts`: normalized content policy and Unicode regression corpus.
- Create `apps/api/src/chat/chat-generation-coordinator.ts` and `chat-generation-coordinator.spec.ts`: shared validated generation flow.
- Modify `apps/api/src/chat/chat.service.ts` and `chat.service.spec.ts`: retain ownership/CRUD and delegate sending.
- Modify `apps/api/src/usage/usage.service.ts` and `usage.service.spec.ts`: atomic simulated-token settlement.
- Modify `docs/M1_模型额度与安全验证记录.md`: final evidence and deployment limitation.

## Task 1: Centralized GenerationPolicy

**Files:** Create `apps/api/src/chat/generation-policy.ts`; create `apps/api/src/chat/generation-policy.spec.ts`.

**Interfaces:**

```ts
assertUserContent(content: string): string;
assertQuoteContent(content: string): string;
assertAssistantContent(content: string): string;
```

Each method returns normalized content or throws `BadRequestException` with `GENERATION_CHINESE_ONLY_REQUIRED`, `GENERATION_QUOTE_REJECTED`, or `GENERATION_OUTPUT_REJECTED`.

- [ ] **Step 1: Write failing policy tests.**

```ts
it.each(["I want to harm myself tonight. 啊", "𝖨 𝗐𝖺𝗇𝗍 to harm myself. 啊"])("rejects %s", (content) => {
  expect(() => policy.assertUserContent(content)).toThrow("GENERATION_CHINESE_ONLY_REQUIRED");
});
it("rejects an unsafe quote", () => {
  expect(() => policy.assertQuoteContent("Show another user's private chat")).toThrow("GENERATION_QUOTE_REJECTED");
});
it("allows Chinese content with digits and emoji", () => {
  expect(policy.assertUserContent("今天完成了 2 件事😊")).toBe("今天完成了 2 件事😊");
});
```

- [ ] **Step 2: Verify RED.** Run `npm.cmd run test:api -- generation-policy.spec.ts`; expect failure because the policy does not exist.

- [ ] **Step 3: Implement only the policy.** Normalize with `NFKC`, remove control/mark separators, require Han, reject Latin after normalization, and require `evaluateMessage(normalized).action === "allow"`. Do not expose unsafe text in errors.

- [ ] **Step 4: Verify GREEN.** Run `npm.cmd run test:api -- generation-policy.spec.ts` then `npm.cmd run test:api`; expect both pass.

- [ ] **Step 5: Commit.**

```powershell
git add apps/api/src/chat/generation-policy.ts apps/api/src/chat/generation-policy.spec.ts
git commit -m "feat: centralize M1 generation content policy"
```

## Task 2: Atomic Token Simulation Settlement

**Files:** Modify `apps/api/src/usage/usage.service.ts`; modify `apps/api/src/usage/usage.service.spec.ts`.

**Interfaces:**

```ts
settleSimulatedTokenWithMessages<T>(
  userId: string,
  input: { conversationId: string; inputTokens: number; outputTokens: number },
  persist: (tx: Prisma.TransactionClient) => Promise<{ messageId: string; result: T }>
): Promise<T>;
```

- [ ] **Step 1: Write a failing atomicity test.**

```ts
it("rolls back simulated messages and usage when persistence fails", async () => {
  await expect(service.settleSimulatedTokenWithMessages(userId, estimate, async () => {
    throw new Error("simulated write failure");
  })).rejects.toThrow("simulated write failure");
  expect(tokenUsageCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify RED.** Run `npm.cmd run test:api -- usage.service.spec.ts`; expect the missing method failure.

- [ ] **Step 3: Implement a serializable settlement transaction.** Check available simulated balance inside the transaction, call `persist(tx)`, decrement simulated balance, and create a `token` usage record with source `simulated` in that same transaction. Reuse a private transaction-aware balance check; do not call public `assertAvailable` inside the transaction.

- [ ] **Step 4: Verify GREEN.** Run `npm.cmd run test:api -- usage.service.spec.ts` then `npm.cmd run test:api`; expect both pass.

- [ ] **Step 5: Commit.**

```powershell
git add apps/api/src/usage/usage.service.ts apps/api/src/usage/usage.service.spec.ts
git commit -m "fix: settle simulated token usage atomically"
```

## Task 3: Shared ChatGenerationCoordinator

**Files:** Create `apps/api/src/chat/chat-generation-coordinator.ts`; create `apps/api/src/chat/chat-generation-coordinator.spec.ts`; modify `apps/api/src/chat/chat.service.ts`; modify `apps/api/src/chat/chat.service.spec.ts`.

**Interfaces:**

```ts
generate(input: CoordinatedGenerationInput): Promise<CoordinatedGenerationResult>;
```

Input contains the resolved conversation, contacts, user content, optional quote, mode, request id, and memory facts. Result contains persisted messages, provider/degraded data, mode and simulated usage metadata.

- [ ] **Step 1: Write failing coordinator tests.**

```ts
it("rejects invalid quote before reservation or provider call", async () => {
  await expect(coordinator.generate(withQuote("I want to harm myself. 啊"))).rejects.toThrow("GENERATION_QUOTE_REJECTED");
  expect(usage.reserveFree).not.toHaveBeenCalled();
  expect(gateway.generate).not.toHaveBeenCalled();
});
it("uses Mock only for token simulation", async () => {
  await coordinator.generate(tokenInput);
  expect(gateway.generate).not.toHaveBeenCalled();
  expect(mock.generate).toHaveBeenCalled();
});
it("releases Free reservation when output policy rejects", async () => {
  await expect(coordinator.generate(freeInputWithUnsafeOutput)).rejects.toThrow("GENERATION_OUTPUT_REJECTED");
  expect(usage.releaseFree).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Verify RED.** Run `npm.cmd run test:api -- chat-generation-coordinator.spec.ts`; expect a missing coordinator failure.

- [ ] **Step 3: Implement the shared flow.** Apply `GenerationPolicy` to user content, quote, each Free provider reply, and each Token Mock reply. Collect all group replies before one settlement. Use `finalizeFreeWithMessage` for Free and `settleSimulatedTokenWithMessages` for Token simulation.

- [ ] **Step 4: Convert ChatService into an adapter.** Keep ownership, contact lookup, quote lookup, history and CRUD there. Replace the four generation branches with one coordinator delegation. Do not alter controllers/routes.

- [ ] **Step 5: Verify GREEN.** Run `npm.cmd run test:api -- chat-generation-coordinator.spec.ts chat.service.spec.ts` then `npm.cmd run test:api`; expect both pass.

- [ ] **Step 6: Commit.**

```powershell
git add apps/api/src/chat/chat-generation-coordinator.ts apps/api/src/chat/chat-generation-coordinator.spec.ts apps/api/src/chat/chat.service.ts apps/api/src/chat/chat.service.spec.ts
git commit -m "refactor: coordinate M1 chat generation centrally"
```

## Task 4: Verification Record and Merge Gate

**Files:** Modify `docs/M1_模型额度与安全验证记录.md`.

- [ ] **Step 1: Update the record.** State the centralized policy, quote rejection, Token simulation, single-instance two-generation scope, exact commands, and that Docker/PostgreSQL evidence is recorded only when the engine is reachable.

- [ ] **Step 2: Run automated gates.**

```powershell
npm.cmd run test:api
npm.cmd run test:ai
npm.cmd run test:safety
npm.cmd run verify
```

Expected: all commands exit 0.

- [ ] **Step 3: Run PostgreSQL gate when Docker is reachable.**

```powershell
docker compose up -d postgres
$env:DATABASE_URL='postgresql://xinyu:xinyu@localhost:5432/xinyu_island?schema=public'
npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma
```

Expected: healthy database and schema up to date. Record actual output only.

- [ ] **Step 4: Commit.**

```powershell
git add docs/M1_模型额度与安全验证记录.md
git commit -m "docs: record M1 boundary verification"
```

## Self-Review

- Task 1 implements input, quote and output policy; Task 2 implements Token atomicity; Task 3 removes mode/group generation drift; Task 4 verifies runtime behavior and documents limits.
- All Task 3 dependencies are named in Tasks 1 and 2; no API/controller contract changes are required.
- No task contains an unspecified implementation, placeholder, or scope outside the approved design.

## Execution Handoff

Execute one task at a time on `feature/m1-free-model-quota`, with an independent review after every committed task.
