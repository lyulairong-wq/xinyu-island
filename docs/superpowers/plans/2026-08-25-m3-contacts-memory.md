# M3 Contacts and Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete isolated, user-controlled private AI contact and per-contact memory management for the closed-beta MVP.

**Architecture:** Keep contact ownership and deletion semantics in `ContactsService`; retain immutable conversation snapshots so edits do not alter history. Reuse the approved skill catalog and existing memory injection gate. The web layer remains a thin client over authenticated APIs.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js/React, Vitest, Playwright.

**Spec:** `docs/M3_联系人与记忆需求决策.md`

## Global Constraints

- Long-term memory is isolated by user × AI contact and defaults off.
- Only explicit, non-sensitive user facts can be saved; no automatic extraction or cross-contact sharing.
- Only approved skill codes may be attached to private contacts; 1–3 skills and one primary skill.
- Do not change final visual design, official-AI configuration, payment, or public-release behavior.
- Migration files are append-only and all merge checks require `npm.cmd run verify`.

---

### Task 1: Snapshot conversations and default-memory API

**Files:** schema/migration, `chat.service.ts`, `contacts.service.ts`, corresponding API tests.

- [ ] Write failing tests proving a new conversation stores its contact snapshot and inherits, but can override, user default memory.
- [ ] Run the focused tests and confirm failure because snapshots are absent.
- [ ] Add the append-only snapshot migration and minimal service implementation.
- [ ] Re-run focused tests and commit the green task.

### Task 2: Private-contact update and safe configuration validation

**Files:** contact DTO/controller/service, contact service tests, contacts API client.

- [ ] Write failing tests for owner-only profile and skill update, official-contact rejection, and unsafe profile rejection.
- [ ] Verify the tests fail before implementation.
- [ ] Add minimal authenticated update endpoint and reuse approved skill validation.
- [ ] Re-run focused tests and commit the green task.

### Task 3: Explicit memory validation and deleted-contact records

**Files:** contacts service/controller, memory tests, data-record DTO/client.

- [ ] Write failing tests for sensitive-memory rejection and owner-only retrieval of retained records.
- [ ] Verify the tests fail before implementation.
- [ ] Add minimum validation and records query without exposing active contacts or other-user data.
- [ ] Re-run focused tests and commit the green task.

### Task 4: Explicit private-contact deletion semantics

**Files:** remove DTO, contacts service tests, Prisma transaction implementation.

- [ ] Write failing tests for default retention, selected single-chat/memory deletion, discussion-group member removal, and auto-archive below two members.
- [ ] Verify the tests fail before implementation.
- [ ] Add a single transaction that verifies ownership before all deletes and preserves usage records.
- [ ] Re-run focused tests and commit the green task.

### Task 5: Contact and account UI

**Files:** contact editor/home, memory/account surfaces, component tests, E2E.

- [ ] Write failing component and E2E tests for skill selection, private-contact editing, delete choices, default-memory setting, and deleted-record access.
- [ ] Verify failures before implementation.
- [ ] Add the smallest controls and explanatory copy needed for the confirmed behavior.
- [ ] Re-run focused tests and commit the green task.

### Task 6: Migration, regression, and merge evidence

**Files:** M3 validation record.

- [ ] Generate Prisma client and check the migration against local PostgreSQL.
- [ ] Run API, web, safety, build/typecheck, and M3 E2E checks.
- [ ] Record commands, results, limitations, and M2 regression coverage.
- [ ] Request review, address substantiated findings, and produce a merge-ready commit series.
