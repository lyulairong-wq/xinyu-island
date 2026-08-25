# Task 3 Report: Safe Skill Sessions, Card Persistence, and Explicit Memory Opt-In

## Delivered scope

- Added `POST /chat/conversations/:conversationId/skill-sessions` with a validated `StartSkillSessionDto` covering the five approved `SkillCode` values, the current `free | token` mode, UUID request IDs, optional skill inputs, and an optional group target.
- Added `SkillSessionService` ownership and eligibility gates before generation:
  - the conversation lookup is scoped by `userId` and `conversationId`;
  - a single conversation can use only its active contact;
  - a group requires an explicit `targetContactId`;
  - the target must be a group member and must have the selected skill mounted;
  - one request contains and runs exactly one skill.
- Added catalog-driven Chinese structured generation context. The service uses the approved skill definition, fixed disclaimer, and no-precision rule while avoiding Latin skill codes in generated user context.
- Reused the M1 `ChatGenerationCoordinator` as the only generation, quota, idempotency, Provider, output-policy, and message-persistence path. The skill service does not reserve, charge, finalize, or persist generated messages itself.
- Extended the coordinator with a `skill` purpose and optional assistant metadata. Metadata is written only with the assistant message inside the existing free/token settlement transaction, after all generated output passes `GenerationPolicy`.
- Persisted `{ skillCard }` only in the assistant message `metadata`; the user message has no card metadata. Cards use catalog-owned title, summary, actions, and fixed disclaimer and therefore do not copy topic, answers, birth date, birth period, selected number, or other raw skill input.
- Added input-insufficient fallback behavior. A missing required input returns `{ state: "fallback", fallback: "ordinary_chat", missingInputs, mode, chargedTokens: 0 }` without invoking generation or quota APIs.
- Added `POST /chat/conversations/:conversationId/skill-sessions/:contactId/memories` as a separate explicit action. It verifies that the target belongs to the owned conversation and delegates the user-selected fact to the existing `ContactsService.createMemory` path. Skill start never calls memory creation automatically.
- Added the skill-specific stable rejection code `GENERATION_SAFETY_REJECTED` while retaining the existing Chinese-only and output-rejection codes for their respective boundaries.
- Extended the shared safety policy to reject medication-stop decisions such as `该不该自行停药`, while retaining an allow control for standalone safety refusals.
- Extracted the existing M1 contact/memory prompt builder from `ChatService` so ordinary chat and skill sessions use the same sanitization, untrusted-context encoding, memory isolation, and professional-boundary prompt.
- Registered `SkillsModule` through `ChatModule` and `AppModule`; a real Nest application-context smoke check confirmed all providers resolve.
- Fixed the Task 1 `@xinyu/contracts` ESM runtime entrypoint (`./skills.js`) and added a package runtime-import check. This was required because the new API module imports the shared skill contracts at runtime and Node could not previously resolve the extensionless emitted re-export.

## API behavior and stable errors

| Situation | Result |
| --- | --- |
| Approved, mounted single-contact skill with complete input | One user message, one assistant message, one `SkillCard`, and the coordinator's existing mode/usage response |
| Group without `targetContactId` | `SKILL_GROUP_TARGET_REQUIRED` |
| Target outside the conversation | `SKILL_CONTACT_NOT_ELIGIBLE` |
| Approved skill not mounted on the selected contact | `SKILL_NOT_MOUNTED` |
| Missing catalog-required input | Ordinary-chat fallback, zero charge, no persisted messages/card |
| High-risk skill input | `GENERATION_SAFETY_REJECTED`, no quota reservation, Provider call, message, or card |
| Unsafe generated output | Existing `GENERATION_OUTPUT_REJECTED`; no assistant message/card is settled |
| Repeated request ID | Existing M1 idempotency rejection; no second Provider call, settlement, message pair, or usage path |
| Explicit memory action | Existing contact-memory creation with `source: user_explicit` after conversation-target validation |

## TDD evidence

1. Added the skill-session service/DTO tests before production files existed.
   - Command: `npm.cmd run test:api -- --run src/skills/skill-session.service.spec.ts`
   - Observed RED: suite import failed with `Cannot find module './dto/start-skill-session.dto'`.
2. Added coordinator metadata and skill-policy tests before implementation.
   - Command: `npm.cmd run test:api -- --run src/chat/chat-generation-coordinator.spec.ts src/chat/generation-policy.spec.ts`
   - Observed RED: metadata was absent from the assistant write and `assertSkillContent` did not exist; 2 failed, 15 passed.
3. Added controller-contract tests before adding the endpoints.
   - Command: `npm.cmd run test:api -- --run src/chat/chat.controller.spec.ts`
   - Observed RED: `startSkillSession` and `rememberSkillFact` were both missing; 2 failed.
4. Added the medication-stop safety regression before changing the shared policy.
   - Command: `npm.cmd run test:safety -- --run src/index.spec.ts`
   - Observed RED: `该不该自行停药` returned `allow`; 1 failed, 303 passed.
5. During review, added a safe-refusal control before narrowing the new safety rule.
   - Command: `npm.cmd run test:safety -- --run src/index.spec.ts`
   - Observed RED: `我不能替你决定是否停药。` returned `block`; 1 failed, 304 passed.
6. Added the contracts runtime-import assertion before fixing the ESM re-export.
   - Command: `npm.cmd run test --workspace @xinyu/contracts`
   - Observed RED: Node raised `ERR_MODULE_NOT_FOUND` for `packages/contracts/dist/skills`.
7. Implemented the minimum code for each failing behavior and reran the focused suites.
   - Focused API green: 4 files, 28 tests.
   - Final focused safety green: 1 file, 305 tests.
   - Contracts runtime import and package test green.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd run test:api -- --run src/skills/skill-session.service.spec.ts src/chat/chat.controller.spec.ts src/chat/chat-generation-coordinator.spec.ts src/chat/generation-policy.spec.ts` | Passed: 4 files, 28 tests |
| `npm.cmd run test:api` | Passed: 16 files, 134 tests |
| `npm.cmd run test:safety` | Passed before final review: 304 tests; final repository verification passed 305 tests after the refusal control |
| `npm.cmd run test --workspace @xinyu/contracts` | Passed; build plus Node ESM runtime import assertion |
| `npm.cmd run typecheck --workspace @xinyu/api` | Passed |
| Nest application-context smoke check against built `AppModule` | Passed; context created and closed successfully |
| `npm.cmd run verify` | Passed: all workspace typechecks, API 134 tests, Web 12 tests, AI 6 tests, Config 13 tests, Contracts runtime check, Safety 305 tests, and all production builds |
| `git diff --check` | Passed |

`npm.cmd run verify` emitted the existing Next.js warning that the workspace root was inferred while both the main checkout and worktree have lockfiles. The build still completed successfully.

## Requirements and safety audit

- **One skill per turn:** represented by one `skill` field and one selected contact passed to the coordinator.
- **Group explicit target:** required server-side and checked against owned conversation membership.
- **No raw sensitive card metadata:** cards are assembled only from approved catalog definition fields; dedicated ziwei coverage verifies birth date and period are absent.
- **No automatic memory save:** generation tests assert no memory call; memory creation exists only behind the separate explicit endpoint.
- **Safety reject means no card:** skill input policy runs before reservation/write/Provider work; output policy runs before assistant metadata persistence.
- **No duplicate billing path:** only coordinator and `UsageService` perform reservation/finalization; repeated request coverage verifies one Provider call and one settlement.
- **No UI/payment changes:** no Web files, account balance semantics, payment behavior, dependencies, schema, or migrations changed.

## Review outcome

- Requirements review found no remaining Critical or Important issues.
- A safety false-positive risk discovered during review was fixed with its own red/green control.
- A runtime contract import failure discovered during the Nest wiring smoke check was fixed and permanently covered by the contracts package test.

## Known limitations and follow-up

- No live PostgreSQL HTTP exercise was run in this task. The service uses the existing Prisma schema and adds no migration; ownership, message metadata, memory delegation, quota settlement, and idempotency were verified through focused API tests, full API regression, and Nest provider construction. A later integration task should include the planned real PostgreSQL API path.
- Free mode still follows M1's existing completed/retry contract (`FREE_GENERATION_IN_PROGRESS` for the duplicate free request path), while Token mode retains its existing completed-request conflict code. Both prevent duplicate generation and billing rather than replaying a stored response body.
- Skill cards intentionally use catalog-owned generic summaries instead of model text so generated content cannot reintroduce raw birth or answer input into metadata. The full interpretation remains the assistant message content.
