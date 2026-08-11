# M1 Chinese Chat Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the China-mainland launch language boundary in `ChatService` so pure-English user input and assistant output cannot enter or leave a persisted chat.

**Architecture:** Keep `evaluateMessage` language-agnostic. Add one narrowly scoped Chinese-character predicate in `ChatService`, apply it before the first user-message persistence, and apply it at every final assistant-output persistence path. Non-Chinese provider results must follow the existing safe provider-failure/Mock fallback when possible and otherwise use an explicit stable rejection; they must never be persisted.

**Tech Stack:** NestJS, TypeScript, Vitest, Prisma test harness.

## Global Constraints

- First release serves Mainland China Chinese users; a user message must contain at least one Han character.
- Mixed Chinese with digits or Latin abbreviations remains valid.
- Do not change the generic semantics of `evaluateMessage` for normal English entertainment text.
- A rejected pure-English input must happen before provider invocation and before user-message persistence.
- A provider result without Han characters must not be persisted; preserve current safe Mock/provider-failure behavior where it is already available.
- No UI, persona, or product-scope change.

---

### Task 1: ChatService language-boundary regression tests and implementation

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/chat/chat.service.spec.ts`
- Modify: `docs/M1_模型额度与安全验证记录.md`

**Interfaces:**
- Produces a private `ChatService` language-boundary helper used by input validation and final generated-message handling.
- Reuses stable `BadRequestException` response codes and existing gateway/Mock fallback behavior.

- [ ] **Step 1: Write failing API regressions**

Add parameterized cases for every pure-English dangerous sentence reported in the final review and one ordinary pure-English entertainment sentence. Assert each rejects before `message.create`, reservation, or `gateway.generate`. Add mixed Chinese/Latin safe input and mixed Chinese high-risk input cases to prove normal allow/block behavior. Add free and token output cases that return pure English from the provider/Mock and assert no assistant message is persisted; add mixed Chinese output acceptance.

- [ ] **Step 2: Run the targeted test file to verify RED**

Run: `npm.cmd run test:api -- chat.service`

Expected: the new pure-English input and output cases fail because the current service accepts them.

- [ ] **Step 3: Implement the minimal service-layer boundary**

Add a Unicode Han predicate (`/\p{Script=Han}/u`) to `ChatService`. Reject user input after trim and before safety evaluation with a stable `GENERATION_CHINESE_REQUIRED` code. Validate assistant output on every path before persistence; when the free gateway result is pure English, attempt/retain the established safe degraded Mock fallback only if it has Han text, otherwise reject with a stable output code and release any free reservation. Token single/group paths must also never persist pure-English Mock output.

- [ ] **Step 4: Run targeted tests to verify GREEN**

Run: `npm.cmd run test:api -- chat.service`

Expected: all chat tests pass, including input, output, group, token/free, and safety regressions.

- [ ] **Step 5: Update verification documentation**

Record the Chinese-first language boundary, the stable input/output behavior, and that generic `evaluateMessage` remains unchanged for ordinary English entertainment content.

- [ ] **Step 6: Run final verification and commit**

Run: `npm.cmd run test:api -- chat.service` and `npm.cmd run verify`

Commit: `fix: enforce Chinese-only M1 chat boundary`
