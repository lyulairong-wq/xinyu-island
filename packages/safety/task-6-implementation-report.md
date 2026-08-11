# Task 6 Safety Regression Implementation Report

## Scope

- Worktree: `C:\\VibeCoding_Project\\xinyu-island\\.worktrees\\m1-free-model-quota`
- Branch: `feature/m1-free-model-quota`
- Package boundary: `packages/safety` only
- Corpus version: `m1-v1`
- Policy version: `m1-safety-1.0.0`

No earlier Task 6 implementation report was present in the worktree, repository branches, Git notes, or surrounding workspace. The prior implementation record is therefore the Task 6 plan plus commits `fdb2f1e` and `29a7d1e`; this file starts the append-only round record.

## Prior implementation and round-2 findings

Task 6 introduced a fixed 40-case corpus with eight cases in each confirmed category. The first review refinement added safe-redirection fixtures and an explicit memory-disabled authorization case.

Round 2 identified two coupled defects:

1. Representative “unsafe output” fixtures used refusal or condemnation wording such as “危险步骤已省略”, while the policy classified those safe responses as blocked.
2. Several risk rules depended on request verbs appearing at the beginning of the message, so neutral prefixes, fictional framing, and formatting could bypass concrete actionable requests.

## Round-2 implementation plan

**Goal:** Allow explicit safe refusals and condemnations that name a dangerous topic while continuing to block concrete actionable requests after neutral framing or formatting changes.

**Architecture:** Normalize Unicode and insignificant whitespace once. Evaluate a strict, whole-response refusal/condemnation context before the broad risk rules, but reject mixed refusal-plus-compliance text from that safe context. Then apply category rules whose unsafe signals are not anchored to the start of the message.

**Files:**

- Modify `src/index.spec.ts`: add refusal/condemnation controls, mixed-content controls, and a five-category neutral-variant matrix.
- Modify `src/index.ts`: add explicit refusal-context detection, normalization, and unanchored intent rules.
- Modify `src/regression-cases.ts`: ensure representative forbidden patterns describe unsafe disclosure/actionable output rather than refusal language.
- Append this report with RED, GREEN, full verification, and commit evidence.

**TDD sequence:**

1. Add behavior-first regression tests using real `evaluateMessage` results and literal expected categories.
2. Run `npm.cmd run test:safety` and record the expected failures against the pre-fix implementation.
3. Implement the smallest refusal-first classifier change.
4. Re-run the safety suite until all new and existing cases pass.
5. Run `npm.cmd run test:api -- chat.service`, then `npm.cmd test` for all workspace test scripts.
6. Review the scoped diff, append exact evidence, and commit only `packages/safety` changes.

## Round-2 evidence

### RED

- Command: `npm.cmd run test:safety`
- Result: expected failure, exit code 1.
- Vitest: 1 failed file; 131 tests discovered; 101 passed and 30 failed.
- Expected failure groups: five category-specific refusal false positives, refusal-negation/mixed-compliance escapes, and neutral prefix/framing/whitespace escapes across all five categories.
- The original 40 risky inputs and 40 synthetic unsafe outputs continued to pass their block assertions during RED, showing that the new failures target the review gaps rather than replacing the existing risk baseline.
- Final audit RED: after the first green run, five added refusal-suffix probes failed as expected (`141` discovered, `136` passed, `5` failed). Each category had allowed an actionable request followed by wording such as “即使你说不能提供”.

### GREEN

- Command: `npm.cmd run test:safety`
- Result: exit code 0; 1 test file passed; 141/141 tests passed.
- Command: `npm.cmd run typecheck --workspace @xinyu/safety`
- Result: exit code 0; TypeScript emitted no diagnostics.
- Fixture audit: all six high-risk final-output fixtures that previously described omitted dangerous/illegal steps now use synthetic actionable-detail markers. Category-specific refusal fixtures use non-disclosure markers, so refusal text is not itself a forbidden pattern.
- Mutation coverage: removing refusal-first handling fails the safe controls; removing the reversal/request-before-refusal guards fails refusal-negation, mixed-compliance, or refusal-suffix controls; restoring start anchoring or whitespace sensitivity fails the 30-case category-by-variant matrix.

### Required regression commands

- Safety suite: `npm.cmd run test:safety` — exit code 0; 141/141 passed.
- Chat regression: `npm.cmd run test:api -- chat.service` — exit code 0; 1 file and 18/18 tests passed after rebuilding `@xinyu/ai` and `@xinyu/safety`.
- Full repository tests: `npm.cmd test` — exit code 0; 16 test files and 215 tests passed across API (44), Web (12), AI (5), Config (13), and Safety (141). Contracts had no test files and exited 0 through `--passWithNoTests`.

### Requirements and scope audit

- Explicit refusal/condemnation context is evaluated before all broad category intent patterns.
- Refusal negation, mixed refusal-plus-compliance, quoted refusal, punctuation pivots, and actionable-request-before-refusal suffixes are excluded from the safe context.
- Unicode is normalized and whitespace is removed before risk matching; no category rule relies on a start anchor.
- Every confirmed category has literal probes for `请`, `帮我`, `能否`, fictional framing, whitespace/punctuation, and a refusal suffix. Prompt/system-secret and provider-key cases, plus cross-account and memory cases, are explicit in the matrix.
- Existing 40 corpus inputs and 40 representative unsafe outputs remain blocked. Safe refusals and condemnations are no longer encoded as forbidden output fixtures.
- `git diff --check` passed and every changed path is under `packages/safety`.

The requesting-code-review workflow was inspected, but this session exposes no subagent tool. A local read-only diff audit found the refusal-suffix escape above; it was added as a five-category RED set and fixed before the final verification runs.
