# M0 认证与准入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-shaped, free-closed-beta entry flow that registers or logs in a user, records the three required consents, restores a valid session, and routes the user into the existing authenticated application shell.

**Architecture:** Preserve the existing NestJS `AuthService`, JWT guard, Prisma session/consent tables, and `/api/v1/me` endpoint as the server authority. Split the current monolithic Web entry logic into a small auth API client, browser token storage adapter, session bootstrap hook, and authentication form components; the future formal chat UI remains out of scope.

**Tech Stack:** Next.js 16 App Router, React 19, NestJS 11, Prisma 6/PostgreSQL 16, Vitest 4, TypeScript 5.9.

**Shared M0 types:**

```ts
export type AuthUser = { id: string; email: string; nickname: string; ageBand: string };
export type ConsentType = "terms" | "privacy" | "entertainment_notice";
export type ConsentSelection = Record<ConsentType, boolean>;
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type TokenStorage = { read(): string | null; write(token: string): void; clear(): void };
export class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
```

## Global Constraints

- This plan implements only M0 from `docs/superpowers/specs/2026-08-09-mvp-module-roadmap-design.md`.
- Do not change final chat information architecture, official AI persona content, final visual design, formal legal text, payment, third-party login, email verification, password recovery, or account deletion.
- Registration requires `terms`, `privacy`, and `entertainment_notice`; the client must not send a registration request until all are selected.
- Continue using the current bearer-token contract. Do not introduce cookies or a new authentication provider in this module.
- Do not modify existing Prisma migrations. M0 should not require a schema migration unless implementation evidence demonstrates a missing server-side state.
- All user-visible Chinese copy introduced by this module must remain explicitly labelled as an internal/closed-beta version until formal legal copy is approved.

---

### Task 1: Define M0 scope and executable acceptance cases

**Files:**

- Create: `docs/modules/m0-auth-admission.md`
- Modify: `docs/基础架构阶段状态.md`

**Interfaces:**

- Consumes: `docs/模块需求与验收模板.md`, `docs/最小可用版本验收标准.md`
- Produces: M0-specific acceptance cases used by Tasks 2–6

- [ ] **Step 1: Create the M0 module record from the template**

Record the branch as `feature/m0-auth-admission`, state that the module owns entry authentication and consent capture, and explicitly exclude password recovery, email verification, third-party login, payment, account deletion, and final legal copy.

- [ ] **Step 2: Define the mandatory API and browser cases**

Add this acceptance table to the module record:

| Scenario | Expected result | Verification |
|---|---|---|
| Register with all three consents | Creates user, consent records, token account, and active session | API + browser |
| Register missing any consent | Returns conflict; no user or session is created | API |
| Login using mixed-case/space-padded email | Uses normalized identity and creates a new session | API |
| Reload with valid token | `/me` restores authenticated user before app shell renders | browser |
| Reload with invalid/revoked token | Token is cleared and entry screen is shown | browser |
| Logout | Server session is revoked and local token is removed | API + browser |
| Access another user’s session | Rejected by ownership filter | API |

- [ ] **Step 3: Commit the module contract**

```powershell
git add docs/modules/m0-auth-admission.md docs/基础架构阶段状态.md
git commit -m "docs: define M0 auth admission scope"
```

### Task 2: Add server-side authentication service coverage

**Files:**

- Create: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/auth.policy.spec.ts`
- Modify: `apps/api/src/auth/auth.service.ts` only if a failing test demonstrates missing behavior

**Interfaces:**

- Consumes: `AuthService.register(input)`, `AuthService.login(input)`, `AuthService.logout(userId, sessionId)`, `AuthService.getSessions(userId)`
- Produces: regression coverage for consent enforcement, normalized login, session ownership, and session revocation

- [ ] **Step 1: Write failing service tests using a Prisma transaction mock**

Cover the following concrete assertions:

```ts
await expect(service.register({ ...baseInput, consents: [{ type: "terms", version: "1.0" }] }))
  .rejects.toThrow("必须同意");

await service.login({ email: "  USER@example.com ", password: "password123", deviceLabel: "web" });
expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "user@example.com" } });

await service.logout("user-1", "session-1");
expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
  where: { id: "session-1", userId: "user-1" },
  data: { revokedAt: expect.any(Date) }
});
```

- [ ] **Step 2: Run the targeted tests and confirm the intended failures**

Run: `npm.cmd run test:api -- --run src/auth/auth.service.spec.ts src/auth/auth.policy.spec.ts`  
Expected: tests fail until the mock setup and any demonstrated missing behavior are implemented.

- [ ] **Step 3: Implement only behavior required by failing tests**

Keep consent enforcement in `auth.policy.ts`, identity normalization in `normalizeEmail`, and database/session writes in `AuthService`. Do not duplicate these rules in controllers or the Web application.

- [ ] **Step 4: Run auth tests and typecheck**

Run:

```powershell
npm.cmd run test:api
npm.cmd run typecheck --workspace @xinyu/api
```

Expected: all auth/API tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit the server coverage**

```powershell
git add apps/api/src/auth
git commit -m "test: cover auth admission service flows"
```

### Task 3: Extract a typed Web authentication client and token storage adapter

**Files:**

- Create: `apps/web/lib/auth-api.ts`
- Create: `apps/web/lib/auth-session.ts`
- Create: `apps/web/lib/auth-session.spec.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**

- Produces: `register(input): Promise<AuthSession>`, `login(input): Promise<AuthSession>`, `getCurrentUser(token): Promise<AuthUser>`, `logout(token): Promise<void>`, and `createTokenStorage(storage: StorageLike): TokenStorage`
- Consumes: `/auth/register`, `/auth/login`, `/auth/logout`, `/me`

- [ ] **Step 1: Write failing storage tests against an injected storage interface**

Use a lightweight in-memory implementation rather than relying on browser globals in Vitest:

```ts
const storage = new Map<string, string>();
const adapter = createTokenStorage({
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key)
});

adapter.write("token-1");
expect(adapter.read()).toBe("token-1");
adapter.clear();
expect(adapter.read()).toBeNull();
```

- [ ] **Step 2: Run the storage test and confirm it fails**

Run: `npm.cmd run test:web -- --run lib/auth-session.spec.ts`  
Expected: FAIL because `createTokenStorage` does not yet exist.

- [ ] **Step 3: Implement the narrow client and adapter**

`auth-api.ts` must parse a non-success response into an `ApiError` containing a user-safe message; it must not expose raw server stack traces. `auth-session.ts` must use the fixed key `xinyu_access_token` and only access `window.localStorage` through a browser-safe wrapper.

- [ ] **Step 4: Replace direct auth fetch/localStorage calls in `page.tsx`**

Use the new functions for login, registration, session restoration, and logout. Do not refactor chat/contact/memory requests in this task; they remain outside M0.

- [ ] **Step 5: Run targeted Web tests and typecheck**

Run:

```powershell
npm.cmd run test:web
npm.cmd run typecheck --workspace @xinyu/web
```

Expected: token storage tests pass and the Web workspace typechecks.

- [ ] **Step 6: Commit the extraction**

```powershell
git add apps/web/lib apps/web/app/page.tsx
git commit -m "feat: centralize web auth session handling"
```

### Task 4: Implement session bootstrap and safe authenticated entry transitions

**Files:**

- Create: `apps/web/components/auth/auth-gate.tsx`
- Create: `apps/web/components/auth/auth-gate.spec.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**

- Consumes: `getCurrentUser(token): Promise<AuthUser>`, `TokenStorage.clear(): void`
- Produces: `AuthGate` with `loading`, `anonymous`, and `authenticated` states

- [ ] **Step 1: Add a failing state-transition test**

Test the three required branches with injected functions:

```tsx
render(<AuthGate loadUser={async () => ({ email: "user@example.com", nickname: "测试", ageBand: "18_plus" })} />);
expect(await screen.findByText("authenticated-child")).toBeInTheDocument();

render(<AuthGate loadUser={async () => { throw new ApiError(401, "登录状态已失效"); }} />);
expect(await screen.findByText("anonymous-child")).toBeInTheDocument();
expect(clearAccessToken).toHaveBeenCalledTimes(1);
```

Install `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` only if the existing Vitest environment cannot render React components. Configure the smallest Web-only test setup required for these assertions.

- [ ] **Step 2: Run the component test and confirm it fails**

Run: `npm.cmd run test:web -- --run components/auth/auth-gate.spec.tsx`  
Expected: FAIL until `AuthGate` and its test environment exist.

- [ ] **Step 3: Implement `AuthGate`**

On mount, read the stored token. With no token, render the anonymous branch. With a token, call `/me`; on success render the authenticated branch; on any authentication failure clear the token and render the anonymous branch. While the request is pending, render a neutral loading state and do not render the chat shell.

- [ ] **Step 4: Wire `HomePage` through the gate**

Keep `HomePage` responsible for choosing entry versus authenticated shell. Pass a logout callback that first calls `/auth/logout` when a token exists, then clears the local token even if the request fails.

- [ ] **Step 5: Run Web tests and build**

Run:

```powershell
npm.cmd run test:web
npm.cmd run build --workspace @xinyu/web
```

Expected: component tests and production build pass.

- [ ] **Step 6: Commit session restoration**

```powershell
git add apps/web/components/auth apps/web/app/page.tsx apps/web/package.json package-lock.json
git commit -m "feat: restore and clear web auth sessions"
```

### Task 5: Make registration consent explicit and auditable in the entry UI

**Files:**

- Create: `apps/web/components/auth/consent-checklist.tsx`
- Create: `apps/web/components/auth/consent-checklist.spec.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `docs/modules/m0-auth-admission.md`

**Interfaces:**

- Produces: `ConsentChecklist` accepting `value: ConsentSelection` and `onChange(next: ConsentSelection): void`, plus `buildConsentPayload(value: ConsentSelection): Array<{ type: ConsentType; version: "1.0" }>`
- Consumes: `terms`, `privacy`, `entertainment_notice` and internal-test document version `1.0`

- [ ] **Step 1: Write failing checklist tests**

Verify that all three document types are rendered, the submit action remains disabled until all are selected, and the consent payload contains exactly three entries:

```ts
expect(buildConsentPayload({ terms: true, privacy: true, entertainment_notice: true })).toEqual([
  { type: "terms", version: "1.0" },
  { type: "privacy", version: "1.0" },
  { type: "entertainment_notice", version: "1.0" }
]);
```

- [ ] **Step 2: Run the checklist test and confirm it fails**

Run: `npm.cmd run test:web -- --run components/auth/consent-checklist.spec.tsx`  
Expected: FAIL until the checklist and payload helper exist.

- [ ] **Step 3: Implement the checklist and registration integration**

The three selections must be individually visible and required. Add links or expandable labels to clearly identified internal-test versions of the documents; do not present them as finalized legal text. The registration button remains disabled until all three values are true, while server-side enforcement remains unchanged.

- [ ] **Step 4: Run Web tests and build**

Run:

```powershell
npm.cmd run test:web
npm.cmd run build --workspace @xinyu/web
```

Expected: consent tests and production build pass.

- [ ] **Step 5: Commit explicit consent handling**

```powershell
git add apps/web/components/auth apps/web/app/page.tsx docs/modules/m0-auth-admission.md
git commit -m "feat: require explicit entry consents"
```

### Task 6: Verify M0 against real PostgreSQL and browser behavior

**Files:**

- Create: `docs/modules/m0-auth-admission-verification.md`
- Modify: `docs/基础架构阶段状态.md`

**Interfaces:**

- Consumes: completed M0 browser flow, local PostgreSQL, API at `/api/v1`
- Produces: an evidence-backed module acceptance record

- [ ] **Step 1: Run the module regression checks**

Run:

```powershell
npm.cmd run test:api
npm.cmd run test:web
npm.cmd run typecheck
npm.cmd run build --workspace @xinyu/web
```

Expected: all commands exit successfully.

- [ ] **Step 2: Verify migration state**

Run:

```powershell
$env:DATABASE_URL='postgresql://xinyu:xinyu@localhost:5432/xinyu_island?schema=public'
npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma
```

Expected: database schema is up to date.

- [ ] **Step 3: Perform the real browser cases**

Use a new test email and verify: incomplete consent cannot submit; full consent registers; reload restores the authenticated user; logout returns to entry; login succeeds; an invalid/revoked token returns to entry. Record only test identifiers and results, never tokens or passwords.

- [ ] **Step 4: Record results and known limits**

Record exact commands, pass/fail results, browser coverage, API endpoint coverage, and these intentional exclusions: password recovery, email verification, third-party login, formal legal copy, data export, and account deletion.

- [ ] **Step 5: Run full repository regression and commit verification**

Run: `npm.cmd run verify`  
Expected: successful typecheck, tests, and production builds across all workspaces.

```powershell
git add docs/modules/m0-auth-admission-verification.md docs/基础架构阶段状态.md
git commit -m "test: verify M0 auth admission flow"
```

## Plan self-review

- M0 remains isolated from free-model, quota, contact-memory, life-mirror, payment, and final chat-UI work.
- Every implementation task has concrete files, interfaces, a failing test first, validation commands, and a commit boundary.
- The only potential new dependencies are explicit and scoped to React component testing; they are introduced only if current Web Vitest cannot render components.
- The plan preserves existing bearer-token architecture and does not require a migration.
