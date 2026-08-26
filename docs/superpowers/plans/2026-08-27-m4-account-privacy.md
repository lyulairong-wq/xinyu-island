# M4 Account, Privacy, and Data Rights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver agreement viewing, immediate irreversible account deletion, and deletion-safe in-flight chat generation.

**Architecture:** Keep `User` as the sole deletion root and rely on current PostgreSQL cascade relations for personal data. `AuthService` owns consent projection, password verification, session revocation, and deletion; `MeController` only exposes authenticated routes. Web renders records returned by the API and clears its credential only after success.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL 16, Next.js 16/React 19, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-m4-account-privacy-design.md`

## Global Constraints

- Work only in an isolated `feature/m4-account-privacy` worktree; do not alter `main`.
- Reuse the current information architecture/styles; M4 does not finalize visual design.
- Only `terms`, `privacy`, and `entertainment_notice` at internal closed-beta version `1.0` exist.
- Do not add re-consent, revocation, export (including its entry), password change, cool-off, recovery, email, multi-device sessions, reports, appeals, or admin workflows.
- Deletion immediately and irreversibly removes profile, sessions, consents, private contacts, chats/messages, memories, skill state, token account, generation requests, and personal usage.
- The email may immediately register a completely new account.
- A generation that loses its account/conversation before persistence must not add messages or personal usage.
- Merge requires `npm.cmd run verify`, migration status, and isolated PostgreSQL browser E2E to pass.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/contracts/src/consent-documents.ts` | The shared runtime catalog/types for the three fixed approved documents. |
| `apps/api/src/auth/dto/delete-account.dto.ts` | Password and explicit irreversible-confirmation validation. |
| `apps/api/src/auth/auth.service.ts` | Consent projection and the hard-delete transaction. |
| `apps/api/src/auth/auth.controller.ts` | Authenticated `/me/consents` and `/me/account-deletion`. |
| `apps/api/src/chat/chat-generation-coordinator.ts` | Active owned-conversation checks immediately before message writes. |
| `apps/web/lib/account-api.ts` | Typed authenticated agreement/deletion requests. |
| `apps/web/components/me/consent-documents.tsx` | Read-only agreement content, version, and confirmation time. |
| `apps/web/components/me/account-deletion-panel.tsx` | Password, acknowledgement, and destructive submission UI. |
| `apps/web/components/me/me-home.tsx` | Composition only; retains the existing account/memory/privacy sections. |
| `apps/web/app/page.tsx` | Local token clearing and one-time deletion-success handoff. |
| `e2e/m4-account-privacy.spec.ts` | Real PostgreSQL/browser proof of deletion cascade and email reuse. |

### Task 1: Establish the shared agreement-document contract

**Files:**
- Create: `packages/contracts/src/consent-documents.ts`
- Create: `packages/contracts/src/consent-documents.spec.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/components/auth/consent-checklist.tsx`
- Modify: `apps/web/components/auth/consent-checklist.spec.tsx`

**Interfaces:**
- Produces `CONSENT_DOCUMENTS`, `ConsentDocumentType`, `ConsentDocument`, and `CURRENT_CONSENT_DOCUMENT_VERSION` from `@xinyu/contracts`.
- `ConsentDocument = { type; title; version: "1.0"; content }`.
- `ConsentChecklist` keeps its existing selection/payload exports.

- [ ] **Step 1: Write failing contract and registration UI tests**

```ts
expect(CONSENT_DOCUMENTS.map((item) => item.type)).toEqual([
  "terms", "privacy", "entertainment_notice"
]);
expect(CONSENT_DOCUMENTS.every((item) => item.version === "1.0" && item.content.length > 0)).toBe(true);
expect(buildConsentPayload({ terms: true, privacy: true, entertainment_notice: true }))
  .toEqual(CONSENT_DOCUMENTS.map(({ type, version }) => ({ type, version })));
```

- [ ] **Step 2: Verify failure**

Run: `npm.cmd run test --workspace @xinyu/contracts -- consent-documents.spec.ts`

Expected: FAIL because no shared catalog exists.

- [ ] **Step 3: Implement one catalog; remove the web duplicate**

```ts
export const CURRENT_CONSENT_DOCUMENT_VERSION = "1.0" as const;
export const CONSENT_DOCUMENT_TYPES = ["terms", "privacy", "entertainment_notice"] as const;
export type ConsentDocumentType = (typeof CONSENT_DOCUMENT_TYPES)[number];
export type ConsentDocument = {
  type: ConsentDocumentType; title: string;
  version: typeof CURRENT_CONSENT_DOCUMENT_VERSION; content: string;
};
export const CONSENT_DOCUMENTS: readonly ConsentDocument[] = [terms, privacy, entertainmentNotice];
```

Export it in `packages/contracts/src/index.ts`. Make `consent-checklist.tsx` import this catalog and use `title`/server version, preserving checkbox and dialog behavior. Move the existing approved Chinese content exactly; do not invent legal copy.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd run test --workspace @xinyu/contracts -- consent-documents.spec.ts`; `npm.cmd run test --workspace @xinyu/web -- consent-checklist.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts apps/web/components/auth/consent-checklist.tsx apps/web/components/auth/consent-checklist.spec.tsx
git commit -m "refactor: share consent document catalog"
```

### Task 2: Add consent retrieval and immediate hard deletion

**Files:**
- Create: `apps/api/src/auth/dto/delete-account.dto.ts`
- Modify: `apps/api/src/auth/auth.policy.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Create: `apps/api/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Produces `getConsents(userId): Promise<{ documents: Array<ConsentDocument & { grantedAt: Date }> }>`.
- Produces `deleteAccount(userId, password): Promise<void>`.
- `DeleteAccountDto` has `password: string` (8–128 chars) and `confirmed: true`.
- Exposes guarded `GET /me/consents` and `POST /me/account-deletion`; success is `{ success: true }`.

- [ ] **Step 1: Write failing service/controller tests**

```ts
await expect(service.getConsents("user-1")).resolves.toEqual({
  documents: expect.arrayContaining([
    expect.objectContaining({ type: "terms", version: "1.0", grantedAt: expect.any(Date) })
  ])
});
await expect(service.deleteAccount("user-1", "wrong-password")).rejects.toMatchObject({ status: 400 });
expect(transaction.user.delete).not.toHaveBeenCalled();
await expect(service.deleteAccount("user-1", "password123")).resolves.toBeUndefined();
expect(transaction.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
```

Also cover: query is only for current user/granted/unrevoked records; missing user is 401; controller passes only authenticated `user.id`; DTO rejects `confirmed: false`.

- [ ] **Step 2: Verify failure**

Run: `npm.cmd run test --workspace @xinyu/api -- auth.service.spec.ts auth.controller.spec.ts`

Expected: FAIL because the new DTO, methods, and routes do not exist.

- [ ] **Step 3: Implement the API**

```ts
export class DeleteAccountDto {
  @IsString() @Length(8, 128) password!: string;
  @IsBoolean() @Equals(true) confirmed!: true;
}

async deleteAccount(userId: string, password: string): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new UnauthorizedException("登录状态已失效");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new BadRequestException({ code: "ACCOUNT_DELETION_INVALID" });
  }
  await this.prisma.$transaction(async (tx) => {
    await tx.userSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await tx.user.delete({ where: { id: userId } });
  });
}
```

Map consent rows to the shared fixed catalog in catalog order; if any required active record is absent, reject as invalid authorization state instead of fabricating consent. Have `auth.policy.ts` import the shared version/type values. In `MeController`, use the existing JWT guard and pass only the current id. Do not make a Prisma migration: all required relationships already have `onDelete: Cascade`.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd run test --workspace @xinyu/api -- auth.service.spec.ts auth.controller.spec.ts auth.policy.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/auth
git commit -m "feat: add account privacy endpoints"
```

### Task 3: Make generation writeback deletion-safe

**Files:**
- Modify: `apps/api/src/chat/chat-generation-coordinator.ts`
- Modify: `apps/api/src/chat/chat-generation-coordinator.spec.ts`

**Interfaces:**
- Produces private `assertActiveOwnedConversation(client, input): Promise<void>`.
- It runs `conversation.findFirst({ where: { id, userId, user: { status: "active" } }, select: { id: true } })`.
- Absence throws `BadRequestException({ code: "GENERATION_CONTEXT_UNAVAILABLE" })`.

- [ ] **Step 1: Write failing free and Token race tests**

```ts
prisma.conversation.findFirst
  .mockResolvedValueOnce({ id: "conversation-1" })
  .mockResolvedValueOnce(null);
await expect(coordinator.generate(input())).rejects.toMatchObject({
  response: { code: "GENERATION_CONTEXT_UNAVAILABLE" }
});
expect(transaction.message.create).not.toHaveBeenCalled();
expect(usage.releaseFree).toHaveBeenCalledWith(reservation);
```

Add a Token test where the transaction check returns null before its first write; assert no transaction messages or usage result. Extend the test harness with root/transaction `conversation.findFirst`, defaulting to the active conversation so prior test behavior remains unchanged.

- [ ] **Step 2: Verify failure**

Run: `npm.cmd run test --workspace @xinyu/api -- chat-generation-coordinator.spec.ts`

Expected: FAIL because no recheck occurs before persistence.

- [ ] **Step 3: Guard every persistence boundary**

```ts
private async assertActiveOwnedConversation(client: PrismaService | Prisma.TransactionClient, input: ChatGenerationInput) {
  const conversation = await client.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId, user: { status: "active" } },
    select: { id: true }
  });
  if (!conversation) throw new BadRequestException({ code: "GENERATION_CONTEXT_UNAVAILABLE" });
}
```

Await this at the start of `persistUserMessage` and `persistAssistantMessages`. This covers the free user write, the free delayed assistant write, and both Token transaction writes. Preserve existing free reservation release and Token transaction rollback behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd run test --workspace @xinyu/api -- chat-generation-coordinator.spec.ts`

Expected: PASS; normal free/Token and group flow is unchanged, but a deletion race cannot write messages or finalize usage.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/chat/chat-generation-coordinator.ts apps/api/src/chat/chat-generation-coordinator.spec.ts
git commit -m "fix: guard generation writes after account deletion"
```

### Task 4: Build the web account/privacy surface

**Files:**
- Create: `apps/web/lib/account-api.ts`
- Create: `apps/web/lib/account-api.spec.ts`
- Create: `apps/web/components/me/consent-documents.tsx`
- Create: `apps/web/components/me/consent-documents.spec.tsx`
- Create: `apps/web/components/me/account-deletion-panel.tsx`
- Create: `apps/web/components/me/account-deletion-panel.spec.tsx`
- Modify: `apps/web/components/me/me-home.tsx`
- Modify: `apps/web/components/me/me-home.spec.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/page.spec.tsx`

**Interfaces:**
- Produces `getConsentDocuments(): Promise<{ documents: ConsentDocumentWithGrant[] }>`.
- Produces `deleteAccount({ password, confirmed: true }): Promise<{ success: true }>`.
- `ConsentDocumentWithGrant` extends Task 1 document with `grantedAt: string`.
- `AccountDeletionPanel` takes `onDeleted(): Promise<void>`.
- `MeHome` takes `onAccountDeleted(): Promise<void>`.

- [ ] **Step 1: Write failing API/component/page tests**

```tsx
render(<AccountDeletionPanel onDeleted={onDeleted} />);
await user.type(screen.getByLabelText("当前密码"), "password123");
await user.click(screen.getByLabelText("我理解注销后无法恢复"));
await user.click(screen.getByRole("button", { name: "立即注销账号" }));
expect(deleteAccount).toHaveBeenCalledWith({ password: "password123", confirmed: true });
await expect(onDeleted).toHaveBeenCalledTimes(1);

expect(await screen.findByRole("heading", { name: "协议和隐私" })).toBeVisible();
expect(screen.getByText("确认时间")).toBeVisible();
expect(screen.queryByText("数据导出")).not.toBeInTheDocument();
```

Test authenticated GET/POST exact paths/body, successful local-token clearing/login handoff, and failed deletion keeping the session/panel open with a safe error notice.

- [ ] **Step 2: Verify failure**

Run: `npm.cmd run test --workspace @xinyu/web -- account-api.spec.ts consent-documents.spec.tsx account-deletion-panel.spec.tsx me-home.spec.tsx page.spec.tsx`

Expected: FAIL because the API and UI components do not exist.

- [ ] **Step 3: Implement focused client/UI components**

```ts
export function getConsentDocuments() {
  return authenticatedRequest<{ documents: ConsentDocumentWithGrant[] }>("/me/consents");
}
export function deleteAccount(input: { password: string; confirmed: true }) {
  return authenticatedRequest<{ success: true }>("/me/account-deletion", {
    method: "POST", body: JSON.stringify(input)
  });
}
```

`ConsentDocuments` loads once and displays server-returned title, version, localized confirmation time, and expandable read-only text. `AccountDeletionPanel` requires nonempty password plus acknowledgement before enabling its button; it uses existing `operationalNotice`, no browser `confirm()`, recovery copy, export item, or re-consent UI. Keep `MeHome` composition-focused.

In `HomePage`, create a callback that clears `getBrowserTokenStorage()`, sets `user` null, and displays once on the anonymous screen: `账号已注销，相关个人数据已删除。`. Pass it through both direct and `AuthGate` authenticated paths. Do not call logout after deletion has already removed the session.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd run test --workspace @xinyu/web -- account-api.spec.ts consent-documents.spec.tsx account-deletion-panel.spec.tsx me-home.spec.tsx page.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/lib/account-api.ts apps/web/lib/account-api.spec.ts apps/web/components/me apps/web/app/page.tsx apps/web/app/page.spec.tsx
git commit -m "feat: add account deletion and agreement viewing"
```

### Task 5: Prove cascade and immediate email reuse against isolated PostgreSQL

**Files:**
- Create: `e2e/m4-account-privacy.spec.ts`
- Modify: `docs/superpowers/specs/2026-08-27-m4-account-privacy-design.md`

**Interfaces:**
- Consumes `E2E_DATABASE_URL` supplied by `scripts/e2e/run.mjs`.
- Uses a test-owned `PrismaClient` only against that disposable database.
- Produces M4 verification evidence in the approved design doc.

- [ ] **Step 1: Write failing browser/database acceptance test**

```ts
await page.getByRole("button", { name: "我的", exact: true }).click();
await expect(page.getByRole("heading", { name: "协议和隐私" })).toBeVisible();
await page.getByLabel("当前密码").fill("E2E-password-1234");
await page.getByLabel("我理解注销后无法恢复").check();
await page.getByRole("button", { name: "立即注销账号" }).click();
await expect(page.getByText("账号已注销，相关个人数据已删除。")).toBeVisible();
expect(await prisma.user.count({ where: { email } })).toBe(0);
expect(await prisma.conversation.count({ where: { userId } })).toBe(0);
expect(await prisma.tokenUsageRecord.count({ where: { userId } })).toBe(0);
```

Before deletion, create a private contact, conversation/message, memory, skill generation request, token account/usage through normal paths or test-owned DB setup. Attempt wrong password first and prove the account still works. Retain the old JWT and assert `GET /me` returns 401. Re-register the same email; assert new id differs and new chat/memory/usage counts are zero.

- [ ] **Step 2: Verify failure**

Run: `npm.cmd run test:e2e -- e2e/m4-account-privacy.spec.ts`

Expected: FAIL until all M4 paths exist; it must reveal any missed cascade relation.

- [ ] **Step 3: Finish safe E2E isolation and evidence**

```ts
const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
test.afterAll(async () => prisma.$disconnect());
```

Never access development data. After successful commands, append `M4 验证记录` to the spec with actual command results/counts and commit SHA—never a pre-emptive success claim.

- [ ] **Step 4: Run acceptance checks**

Run: `npm.cmd run db:generate`; `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`; `npm.cmd run test:e2e -- e2e/m4-account-privacy.spec.ts`

Expected: no pending migration and PASS against a new disposable PostgreSQL container.

- [ ] **Step 5: Commit**

```powershell
git add e2e/m4-account-privacy.spec.ts docs/superpowers/specs/2026-08-27-m4-account-privacy-design.md
git commit -m "test: verify account deletion data cascade"
```

### Task 6: Run the M4 merge gate

**Files:**
- Modify: `docs/superpowers/specs/2026-08-27-m4-account-privacy-design.md` only to replace verification placeholders with observed results.

**Interfaces:**
- Consumes Tasks 1–5.
- Produces a clean reviewable feature branch; this task does not merge or push.

- [ ] **Step 1: Run complete verification**

Run: `npm.cmd run verify`; then `npm.cmd run test:e2e`

Expected: all static checks, unit tests, build, and existing plus M4 E2E tests PASS.

- [ ] **Step 2: Check schema and branch state**

Run: `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`; `git status --short`; `git log --oneline main..HEAD`

Expected: no pending migration, no generated/untracked artifacts, only M4 commits ahead of `main`.

- [ ] **Step 3: Record observed proof then re-run affected checks**

Add exact results and `git rev-parse --short HEAD` to the M4 verification record.

Run: `npm.cmd run verify`; `npm.cmd run test:e2e -- e2e/m4-account-privacy.spec.ts`

Expected: PASS.

- [ ] **Step 4: Commit and request review**

```powershell
git add docs/superpowers/specs/2026-08-27-m4-account-privacy-design.md
git commit -m "docs: record M4 verification evidence"
git status --short
git log --oneline main..HEAD
```

Expected: clean branch ready for review. Do not merge or push without explicit authorization.

## Self-Review

### Spec coverage

- Read-only current documents, version, and confirmation time: Tasks 1, 2, and 4.
- No export/re-consent/revocation/cooling-off/recovery and no UI entries: Global Constraints and Task 4 tests.
- Password plus irreversible immediate deletion: Tasks 2 and 4.
- All personal cascade data, old-session invalidation, immediate email reuse: Tasks 2 and 5.
- In-flight generation safety: Task 3.
- Real PostgreSQL plus complete regression: Tasks 5 and 6.
- Life Mirror remains deferred: no task adds it.

### Placeholder scan

There are no implementation TODOs or placeholder implementation steps. Task 1 relocates the three existing approved objects from `apps/web/components/auth/consent-checklist.tsx` into the shared contract byte-for-byte, then changes only their property name from `label` to `title`.

### Type consistency

- Task 1 defines `ConsentDocument`/ `ConsentDocumentType`; Tasks 2 and 4 consume them.
- Task 2 defines the routes used by Task 4.
- Task 3 only adds a private guard and changes no public chat contract.
- Task 4’s `onAccountDeleted` flows from `HomePage` through `AuthenticatedHome` to `MeHome`.
