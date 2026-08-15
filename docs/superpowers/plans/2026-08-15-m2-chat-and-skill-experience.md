# M2 聊天与趣味技能体验实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在桌面与移动浏览器运行的心屿聊天主入口、联系人管理、五项审核趣味技能和“我的/应用”信息架构，同时保持 M1 的安全、记忆隔离、额度和生成事务边界。

**Architecture:** 技能定义和官方联系人是版本化的受控服务端目录；自建联系人仅保存引用这些定义的技能配置。技能回合在 API 内构建结构化结果和受控模型上下文，再复用 M1 的 `GenerationPolicy`、`ChatGenerationCoordinator`、用量与消息持久化边界。Web 按导航、聊天、联系人、技能和设置拆分组件，通过类型化 API 客户端调用现有和新增端点。

**Tech Stack:** Next.js 16/React/TypeScript、NestJS、Prisma/PostgreSQL、Vitest、现有 `@xinyu/contracts`、`@xinyu/safety`、`@xinyu/ai`。

## Global Constraints

- 首发仅面向中文聊天路径；所有新生成仍须经过 `GenerationPolicy` 和 `packages/safety`。
- 产品是娱乐陪伴与自我探索，不实现真实排盘、确定性预测、专业建议、支付、充值或订阅。
- 记忆必须保持“用户 × 当前 AI 联系人”隔离，默认不从技能输入自动写入。
- 自建 AI 最多 3 项平台审核技能，必须指定一个主技能；官方 AI 不可由用户编辑。
- 一次技能回合只运行一项技能；群聊只允许指定一位具备该技能的 AI。
- 视觉风格、头像资产、最终文案和人生镜像/主题活动内容不在本计划中定稿。
- 每个任务以独立分支完成、经审查和验证后才进入集成分支；不得直接在 `main` 开发。

## File Structure

| 区域 | 责任 |
| --- | --- |
| `packages/contracts/src/skills.ts` | 技能代码、目录和结构化技能卡契约。 |
| `apps/api/src/skills/*` | 审核技能目录、配置验证、回合生成与安全降级。 |
| `apps/api/src/contacts/*` | 官方联系人资料、自建联系人技能配置、联系人授权。 |
| `apps/api/src/chat/*` | 技能回合与现有会话/消息/生成协调器的唯一集成点。 |
| `apps/api/prisma/*` | 自建联系人技能与消息卡元数据的可迁移持久化。 |
| `apps/web/components/navigation/*` | 桌面侧栏与移动底栏。 |
| `apps/web/components/chat/*` | 对话列表、会话、消息操作、输入框、技能入口与状态。 |
| `apps/web/components/contacts/*` | 官方/自建联系人分区、创建编辑和讨论组选择。 |
| `apps/web/components/skills/*` | 技能选择、最少信息收集、轻量结果卡。 |
| `apps/web/components/me/*` | 用量、记忆、隐私/协议、设置入口。 |
| `apps/web/components/apps/*` | 人生镜像与主题活动入口状态。 |

---

### Task 1: 受控技能目录、官方联系人基线与数据迁移

**Files:**
- Create: `packages/contracts/src/skills.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260815130000_add_contact_skill_and_message_metadata/migration.sql`
- Modify: `apps/api/src/contacts/official-contacts.ts`
- Create: `apps/api/src/skills/skill-catalog.ts`
- Test: `apps/api/src/skills/skill-catalog.spec.ts`

**Interfaces:**
- Produces `SkillCode = "tarot" | "mbti" | "zodiac" | "ziwei" | "meihua"` and `SkillCard` with `skill`, `title`, `summary`, `disclaimer`, `actions`.
- Produces `OFFICIAL_CONTACTS` for 岚、绘、衡、星、砚、舟, including immutable `primarySkill?: SkillCode` and ordered `skills`.
- Produces `SkillCatalog.get(code): SkillDefinition` and `SkillCatalog.list(): SkillDefinition[]`.

- [ ] **Step 1: Write failing catalog and official-profile tests**

```ts
it("exposes exactly the five approved skills", () => {
  expect(catalog.list().map((skill) => skill.code)).toEqual(["tarot", "mbti", "zodiac", "ziwei", "meihua"]);
});

it("keeps 岚 skill-free and 绘 tarot-specialized", () => {
  expect(officialById("lan").skills).toEqual([]);
  expect(officialById("hui").primarySkill).toBe("tarot");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm.cmd run test:api -- --run src/skills/skill-catalog.spec.ts`

Expected: FAIL because the catalog/profile contract does not exist.

- [ ] **Step 3: Add the minimum typed catalog and Prisma fields**

```prisma
model PrivateContact {
  // existing fields
  skillCodes  String[] @default([])
  primarySkill String?
}

model Message {
  // existing fields
  metadata Json?
}
```

Use only the five approved codes. The catalog must state required minimum inputs, the no-precision rule, card actions, and the fixed Chinese disclaimer. Create a new migration; never edit existing migrations.

- [ ] **Step 4: Run generation and focused tests**

Run: `npm.cmd run db:generate` then `npm.cmd run test:api -- --run src/skills/skill-catalog.spec.ts`

Expected: generated Prisma types include both new fields and all catalog tests pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts apps/api/prisma apps/api/src/contacts/official-contacts.ts apps/api/src/skills
git commit -m "feat: define M2 skill catalog and contact metadata"
```

### Task 2: 自建联系人技能配置与权限 API

**Files:**
- Create: `apps/api/src/contacts/dto/update-contact-skills.dto.ts`
- Modify: `apps/api/src/contacts/dto/create-contact.dto.ts`
- Modify: `apps/api/src/contacts/contacts.service.ts`
- Modify: `apps/api/src/contacts/contacts.controller.ts`
- Modify: `apps/api/src/contacts/contacts.module.ts`
- Test: `apps/api/src/contacts/contacts.service.spec.ts`
- Test: `apps/api/src/contacts/contacts.controller.spec.ts`

**Interfaces:**
- Consumes `SkillCatalog` and `UpdateContactSkillsDto { skillCodes: SkillCode[]; primarySkill: SkillCode }`.
- Produces `PATCH /contacts/:contactId/skills` and enriched contact response `{ type, skills, primarySkill, editable }`.

- [ ] **Step 1: Write failing authorization/configuration tests**

```ts
it("rejects more than three or unknown skill codes", async () => {
  await expect(service.updateSkills(userId, privateId, { skillCodes: ["tarot", "mbti", "zodiac", "ziwei"], primarySkill: "tarot" })).rejects.toMatchObject({ response: { code: "CONTACT_SKILLS_INVALID" } });
});

it("rejects attempts to edit official contact skills", async () => {
  await expect(service.updateSkills(userId, "hui", { skillCodes: ["mbti"], primarySkill: "mbti" })).rejects.toBeDefined();
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm.cmd run test:api -- --run src/contacts/contacts.service.spec.ts`

Expected: FAIL because the DTO and service method do not exist.

- [ ] **Step 3: Implement one validation path**

Validate ownership before any update, require non-empty skills to have a primary skill contained in `skillCodes`, preserve order, cap at three, and resolve codes only from `SkillCatalog`. Never permit mutation of `OFFICIAL_CONTACTS`.

- [ ] **Step 4: Verify API behavior**

Run: `npm.cmd run test:api -- --run src/contacts/contacts.service.spec.ts src/contacts/contacts.controller.spec.ts`

Expected: private-contact create/update/list works; cross-user and official edits are rejected.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/contacts
git commit -m "feat: configure approved skills for private contacts"
```

### Task 3: 技能回合服务、安全降级与消息卡持久化

**Files:**
- Create: `apps/api/src/skills/skill-session.service.ts`
- Create: `apps/api/src/skills/skill-session.service.spec.ts`
- Create: `apps/api/src/skills/dto/start-skill-session.dto.ts`
- Create: `apps/api/src/skills/skills.module.ts`
- Modify: `apps/api/src/chat/dto/send-message.dto.ts`
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/chat/chat-generation-coordinator.ts`
- Modify: `apps/api/src/chat/chat.controller.ts`
- Modify: `apps/api/src/chat/chat.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes selected `SkillCode`, contact profile, minimal user input and M1 `GenerationPolicy`.
- Produces `POST /chat/conversations/:conversationId/skill-sessions` response `{ userMessage, assistantMessage, skillCard, mode, chargedTokens }`.
- Stores `SkillCard` only in the assistant message `metadata`; no raw sensitive input is copied into the card.

- [ ] **Step 1: Write failing service tests for five paths**

```ts
it("returns a single tarot card and fixed entertainment disclaimer", async () => {
  const result = await sessions.start(userId, conversationId, { skill: "tarot", topic: "最近的感受", mode: "free", requestId });
  expect(result.skillCard).toMatchObject({ skill: "tarot", disclaimer: "趣味解读，仅供娱乐参考" });
});

it("does not create a skill card for high-risk content", async () => {
  await expect(sessions.start(userId, conversationId, { skill: "tarot", topic: "该不该自行停药", mode: "free", requestId })).rejects.toMatchObject({ response: { code: "GENERATION_SAFETY_REJECTED" } });
});
```

Also cover: selected skill is not mounted, group requires explicit eligible contact, incomplete ziwei input returns the ordinary-chat/fallback state, and a repeated request ID is idempotent.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd run test:api -- --run src/skills/skill-session.service.spec.ts`

Expected: FAIL because no skills module/session endpoint exists.

- [ ] **Step 3: Implement through existing generation boundaries**

`SkillSessionService` must resolve conversation ownership, contact eligibility and group target before generation. It builds Chinese-only structured context from `SkillCatalog`, calls the existing coordinator exactly once, and attaches a card only after output safety validation. Reuse `requestId`, use the current mode, and do not create a second billing path.

- [ ] **Step 4: Add memory opt-in endpoint behavior**

Expose a separate explicit action that sends a user-selected fact to the existing contact-memory API. Do not automatically save topic, date, draw, answer set, result or card content.

- [ ] **Step 5: Verify focused and full API safety behavior**

Run: `npm.cmd run test:api` and `npm.cmd run test:safety`

Expected: all existing M1 tests remain green; skills reject high-risk content before a result card is persisted.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/skills apps/api/src/chat apps/api/src/app.module.ts
git commit -m "feat: add safe entertainment skill sessions"
```

### Task 4: 类型化 Web API、导航外壳与应用/我的页面

**Files:**
- Create: `apps/web/lib/chat-api.ts`
- Create: `apps/web/lib/contacts-api.ts`
- Create: `apps/web/lib/skills-api.ts`
- Create: `apps/web/components/navigation/app-navigation.tsx`
- Create: `apps/web/components/navigation/app-navigation.spec.tsx`
- Create: `apps/web/components/apps/apps-home.tsx`
- Create: `apps/web/components/me/me-home.tsx`
- Create: `apps/web/components/me/memory-manager.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes API contracts for contacts, conversations, usage, memory and skill sessions.
- Produces a four-item navigation shell with `chat | contacts | apps | me` active state, desktop side navigation and mobile bottom navigation.

- [ ] **Step 1: Write failing navigation tests**

```tsx
it("uses chat as the authenticated default and exposes all four navigation destinations", () => {
  render(<AppNavigation active="chat" onNavigate={vi.fn()} />);
  expect(screen.getByRole("button", { name: "聊天" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "联系人" })).toBeVisible();
  expect(screen.getByRole("button", { name: "应用" })).toBeVisible();
  expect(screen.getByRole("button", { name: "我的" })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm.cmd run test:web -- --run components/navigation/app-navigation.spec.tsx`

Expected: FAIL because the split navigation component does not exist.

- [ ] **Step 3: Implement API clients and route shell**

Move direct `fetch` calls out of `app/page.tsx`. API clients must always include the browser token, map API errors to non-message-stream notices, and send a UUID `requestId` for every generation request. Apps page has only two launch cards with “后续模块开发” state; Me page groups account/usage, memories, privacy/security, agreement and settings.

- [ ] **Step 4: Verify desktop/mobile semantic states**

Run: `npm.cmd run test:web`

Expected: authenticated default is chat; all navigation destinations, memory deletion confirmation and app-placeholder states are covered.

- [ ] **Step 5: Commit**

```powershell
git add apps/web
git commit -m "feat: add M2 navigation and account surfaces"
```

### Task 5: 聊天主界面、会话操作与讨论组创建

**Files:**
- Create: `apps/web/components/chat/conversation-list.tsx`
- Create: `apps/web/components/chat/conversation-pane.tsx`
- Create: `apps/web/components/chat/message-bubble.tsx`
- Create: `apps/web/components/chat/message-composer.tsx`
- Create: `apps/web/components/chat/chat-shell.tsx`
- Create: `apps/web/components/chat/*.spec.tsx`
- Create: `apps/web/components/contacts/contacts-home.tsx`
- Create: `apps/web/components/contacts/contact-editor.tsx`
- Create: `apps/web/components/contacts/group-creator.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes the Task 4 API clients and navigation shell; consumes `SkillLauncher` from Task 6.
- Produces desktop two-pane/mobile single-pane chat, local per-conversation drafts, quote/copy/regenerate actions, archive/delete/search and group creation capped at three AI contacts.

- [ ] **Step 1: Write failing interaction tests**

```tsx
it("preserves a local draft when switching conversations", async () => {
  render(<ChatShell conversations={fixtures} />);
  await userEvent.type(screen.getByRole("textbox", { name: "消息" }), "未发送草稿");
  await userEvent.click(screen.getByRole("button", { name: "另一个对话" }));
  await userEvent.click(screen.getByRole("button", { name: "第一个对话" }));
  expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("未发送草稿");
});

it("caps a discussion group at three AI contacts", async () => {
  render(<GroupCreator contacts={fourContacts} onCreate={vi.fn()} />);
  // fourth selection is unavailable and submit sends at most three IDs
});
```

- [ ] **Step 2: Run focused web tests and confirm failure**

Run: `npm.cmd run test:web -- --run components/chat components/contacts`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement focused components**

Keep pending/free/token/error notices outside the message stream. User messages expose copy/quote only; assistant messages expose copy/quote/regenerate/continue only. Group replies render separately in member order. Input supports text, quote and a compact “+” menu; no attachment or cancel-generation control is introduced.

- [ ] **Step 4: Verify browser paths**

Run: `npm.cmd run test:web` and browser E2E/manual script covering desktop and narrow mobile viewport: login → chat → single message → quote → regenerate → draft switch → group creation → archive/delete confirmation.

Expected: message history is never silently overwritten and operational notices do not appear as AI messages.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/components/chat apps/web/components/contacts apps/web/app
git commit -m "feat: build M2 chat and contact experience"
```

### Task 6: 技能选择、最少输入和卡片体验

**Files:**
- Create: `apps/web/components/skills/skill-launcher.tsx`
- Create: `apps/web/components/skills/skill-input-flow.tsx`
- Create: `apps/web/components/skills/skill-result-card.tsx`
- Create: `apps/web/components/skills/*.spec.tsx`
- Modify: `apps/web/components/chat/message-composer.tsx`
- Modify: `apps/web/components/chat/message-bubble.tsx`
- Modify: `apps/web/components/chat/conversation-pane.tsx`

**Interfaces:**
- Consumes `SkillDefinition`, `SkillCard`, current contact skills and `startSkillSession()`.
- Produces a compact “+” menu, one-time skill notice, minimal-input cards, result cards and explicit “记住此信息” action.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("shows only the active contact's mounted skills in the composer menu", async () => {
  render(<SkillLauncher skills={[tarot, mbti]} onStart={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "更多功能" }));
  expect(screen.getByRole("button", { name: "塔罗" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "紫微斗数" })).not.toBeInTheDocument();
});

it("renders the fixed entertainment label without raw birth input", () => {
  render(<SkillResultCard card={ziweiCard} />);
  expect(screen.getByText("趣味解读，仅供娱乐参考")).toBeVisible();
  expect(screen.queryByText("2001-01-01")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm.cmd run test:web -- --run components/skills`

Expected: FAIL because no skill UI exists.

- [ ] **Step 3: Implement the minimum skill flow**

Show the first-skill notice once per browser session. Ask for the catalog-defined minimum inputs in natural chat or a small choice card. On missing input, offer generic topic interpretation or return to chat. Send exactly one `requestId`; render the structured card from message metadata; require an explicit user click before creating a contact memory.

- [ ] **Step 4: Verify safety and group restrictions end-to-end**

Run: `npm.cmd run test:web`, `npm.cmd run test:api`, and browser E2E/manual script for tarot, MBTI, zodiac, ziwei, meihua, insufficient input, high-risk rejection, explicit memory save, and group target selection.

Expected: no card for rejected high-risk requests; a group cannot start a skill without selecting an eligible member.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/components/skills apps/web/components/chat
git commit -m "feat: add M2 entertainment skill interactions"
```

### Task 7: M2 集成验收与发布前记录

**Files:**
- Create: `docs/M2_聊天与趣味技能验证记录.md`
- Modify: `docs/最小可用版本验收标准.md` only if M2 changes a stated MVP requirement
- Test: existing API/Web/Safety suites and browser E2E coverage

**Interfaces:**
- Consumes completed Tasks 1–6 on the M2 integration branch.
- Produces an evidence-backed verification record with actual commands, database result, browser paths and known limitations.

- [ ] **Step 1: Write the integration acceptance checklist before executing it**

Include: authenticated ownership denial, official/private contact separation, 3-skill cap, five skills, high-risk rejection, group target restriction, message action history, local drafts, responsive navigation, memory deletion, quota behavior, and no unintended new payment path.

- [ ] **Step 2: Run database verification on a disposable PostgreSQL instance**

Run `npm.cmd run db:generate`, deploy all migrations to a fresh database, then run:

```powershell
$env:DATABASE_URL='postgresql://xinyu:xinyu@localhost:15432/xinyu_island?schema=public'
npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma
```

Expected: schema is up to date. Do not reset or alter any user-owned database/container.

- [ ] **Step 3: Run full automated verification**

Run: `npm.cmd run verify`

Expected: exit code 0 with all API, Web, AI, config and safety tests passing and production build succeeding.

- [ ] **Step 4: Run browser critical paths and record evidence**

Verify desktop and mobile-width flows for login, navigation, contact creation/configuration, chat, quote, regenerate, mode state, group, each skill, explicit memory save/delete, archive/delete and application placeholders.

- [ ] **Step 5: Commit the verification record**

```powershell
git add docs/M2_聊天与趣味技能验证记录.md
git commit -m "docs: record M2 verification evidence"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 cover official AI, skills, safety, memory, group and accounting boundaries; Tasks 4–6 cover all A1/A3 navigation and chat interactions; Task 7 covers required database, regression and browser verification.
- **Excluded scope:** visual finalization, final opening copy, media, payment, custom skills, full-text search, pins, real astrology/ziwei calculation, Life Mirror content and theme activity implementation are intentionally absent.
- **Dependency order:** Task 1 → Task 2 → Task 3 supplies API/data contracts; Task 4 supplies Web shell/clients; Task 5 and Task 6 consume those contracts; Task 7 integrates all modules.
- **Ambiguity check:** “Token” remains M1 development simulation; all skill output shares the existing model mode and does not introduce payment semantics.
