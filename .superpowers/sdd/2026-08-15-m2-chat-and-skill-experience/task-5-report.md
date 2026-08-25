# Task 5 Implementation Report

Date: 2026-08-18

Branch: `feature/m2-chat-design`

Scope source: `task-5-brief.md`

## Status

Task 5 is implemented and verified. The work is limited to the chat interface, message actions, conversation management, responsive list/pane behavior, contact home/editor, and 2–3-member discussion-group creation. Task 6 skill UI, final visual design, media, payments, cancellation, and browser E2E/manual verification were not implemented.

## Implementation

### Chat structure and conversation management

- Added `conversation-list.tsx` with mixed single/group recency sorting, contact/group/title-only search, archive, and explicit delete confirmation.
- Added `chat-shell.tsx` to coordinate conversation selection, cached details, API operations, local per-conversation drafts and quote state, generation mode, notices, and new-chat flow.
- Added a two-pane desktop workspace and CSS-driven one-pane mobile list/conversation switching with a mobile back action.
- Added a new-chat chooser that requires selecting single chat or discussion group before selecting contacts.
- Conversation deletion copy explicitly states that usage records and contact memories are retained.

### Messages and composer

- Added `conversation-pane.tsx`, `message-bubble.tsx`, and `message-composer.tsx`.
- User messages expose copy and quote only. Assistant messages expose copy, quote, regenerate, and continue only.
- Quote state is sent through the existing `quoteMessageId` client contract and can be cleared before sending.
- Sending clears the current conversation draft; switching conversations preserves independent unsent drafts.
- Regeneration uses the existing generation client, appends its returned user/reply messages, and never removes or replaces prior history.
- Group assistant replies are rendered as separate bubbles and assigned to members in configured member order.
- The persistent Free/Token mode is rendered next to the composer and remains owned by the authenticated page shell.
- Loading, typing, quota/failure, and generation notices render outside the message-history list. No stop/cancel-generation control was added.
- The composer contains only text, quote state, and a disabled compact `+` placeholder for Task 6; no attachment, media, voice, or skill launcher UI was added.

### Contacts and groups

- Added `contacts-home.tsx` with fixed Official AI and My AI sections. The primary contact action opens the most recent direct chat or creates one.
- Added `contact-editor.tsx` for private-contact profile creation without skill-configuration UI.
- Preserved private-contact deletion with explicit confirmation.
- Added `group-creator.tsx`; selection order is retained, submission requires at least two contacts, and unchecked contacts become unavailable at the three-member cap.

### Page integration and neutral styling

- Replaced the Task 4 inline chat/contact panels in `app/page.tsx` with focused Task 5 components while retaining authentication, logout, navigation, Apps, Me, memory toggle, and typed client behavior.
- Added structural, neutral CSS for desktop/mobile layouts and component states. No final visual system or media assets were introduced.

## Files

Created:

- `apps/web/components/chat/chat-shell.tsx`
- `apps/web/components/chat/conversation-list.tsx`
- `apps/web/components/chat/conversation-pane.tsx`
- `apps/web/components/chat/message-bubble.tsx`
- `apps/web/components/chat/message-composer.tsx`
- `apps/web/components/chat/chat-shell.spec.tsx`
- `apps/web/components/chat/conversation-list.spec.tsx`
- `apps/web/components/chat/conversation-pane.spec.tsx`
- `apps/web/components/contacts/contacts-home.tsx`
- `apps/web/components/contacts/contact-editor.tsx`
- `apps/web/components/contacts/group-creator.tsx`
- `apps/web/components/contacts/group-creator.spec.tsx`

Modified:

- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`

## TDD evidence

### Observed red phase

Command:

```powershell
npm.cmd run test:web -- --run components/chat components/contacts
```

Result before implementation: failed as expected. Four suites failed during import resolution because `chat-shell`, `conversation-list`, `conversation-pane`, and `group-creator` did not exist; no tests ran.

### Focused green phase

Command:

```powershell
npm.cmd run test:web -- --run components/chat components/contacts
```

Final result: 4 test files passed, 8 tests passed. Coverage includes per-conversation draft survival, draft clearing on send, operational notices outside history, typing without cancellation, regeneration preserving history, role-specific message actions, field-limited search, archive/delete confirmation, independent ordered group replies, and the maximum-three group cap.

## Required verification

- `npm.cmd run test:web`: PASS — 14 files, 28 tests.
- `npm.cmd run typecheck --workspace @xinyu/web`: PASS.
- `git diff --check`: PASS; only Git line-ending conversion warnings were emitted for the existing Windows worktree policy.
- Browser E2E/manual verification: intentionally deferred to Task 7 by the Task 5 brief.

## Concerns and deferred contract gaps

1. The existing API has no dedicated regenerate/continue endpoint. Task 5 therefore uses `sendMessage`; regeneration resends the source user content and appends both the persisted user request and new assistant reply. This preserves history but can display a repeated user message.
2. The existing private-contact create contract requires at least one skill while Task 6 owns skill configuration UI. The Task 5 profile-only editor supplies a temporary Tarot default to satisfy the current API. Task 6 should replace this default when it introduces explicit skill selection.
3. The existing API `CreateGroupDto` allows up to six contacts, while Task 5 requires a maximum of three. The Task 5 UI enforces and tests the three-contact cap and slices submitted IDs to three; server-side alignment is outside this frontend-only task.

No implementation blocker remains for the scoped Task 5 frontend work.
