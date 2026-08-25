# Task 4 Report: Web API Clients, Navigation Shell, Apps, and Me

## Delivered scope

- Added typed Web API clients for chat, contacts, and skill sessions. Added a small usage client because the Me surface consumes the existing `/usage` endpoint.
- Added a shared authenticated request boundary that reads the browser token at request time, attaches it as a Bearer token, normalizes network/API failures into operational notices, and does not surface server error text as chat content.
- Added UUID request IDs to both generation paths exposed by the Web clients: ordinary message generation and skill-session generation. Callers may retain a valid UUID for an intentional retry; otherwise the client creates one with `crypto.randomUUID()`.
- Moved authenticated page network access out of `app/page.tsx`; pages and components now call typed clients. Authentication remains on the existing auth client/session boundary.
- Extracted `AppNavigation` with the stable `chat | contacts | apps | me` destination type, Chat default, `aria-current` active state, desktop side placement, and mobile fixed bottom placement.
- Preserved login, registration consent, session restoration, server logout attempt, and local-token clearing behavior. The existing logout regression remains green.
- Replaced the provisional Life Mirror experience content with an Apps information surface containing exactly two launch cards: “人生镜像副本” and “主题活动”, each marked “后续模块开发”.
- Added the Me information architecture grouped into account/usage, memories, privacy/security, user agreement, and settings.
- Extracted `MemoryManager`; memories remain selected per contact, explicit additions use the existing memory API, and deletion requires browser confirmation before the delete request is sent.
- Kept operational errors outside the message list through the existing notice area.
- Added only structural CSS needed for the reusable shell and responsive placement. No final visual design was established.

## API client coverage

| Client | Typed operations |
| --- | --- |
| `chat-api.ts` | list/create/get/update/delete conversations, create groups, send messages, delete messages |
| `contacts-api.ts` | list/create/delete contacts, update approved skills, list/create/delete memories, update default memory |
| `skills-api.ts` | start a skill session, explicitly remember a selected skill fact |
| `usage-api.ts` | load the current free and simulated Token usage summary |

All authenticated operations pass through `authenticatedRequest`, which reads `xinyu_access_token` from browser storage and attaches `Authorization: Bearer <token>`.

## TDD evidence

1. Added the navigation test before the component existed.
   - Command: `npm.cmd run test:web -- --run components/navigation/app-navigation.spec.tsx`
   - Observed RED: the suite failed to resolve `./app-navigation`; 1 failed suite, 0 tests collected.
2. Added API-client, Apps, Me, and memory confirmation tests before their production modules existed.
   - Command: `npm.cmd run test:web -- --run lib/api-clients.spec.ts components/apps/apps-home.spec.tsx components/me/memory-manager.spec.tsx components/me/me-home.spec.tsx`
   - Observed RED: all 4 suites failed to resolve the new modules; 4 failed suites, 0 tests collected.
3. Implemented the minimum clients and surfaces, then ran the combined focused suite.
   - Initial implementation run: 4 component suites passed; 2 API-client tests failed because the test mock reused a consumed `Response` object. The mock was corrected to return a fresh response per request; no production behavior changed for that test issue.
   - Final focused GREEN: 5 files, 8 tests passed.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd run test:web -- --run components/navigation/app-navigation.spec.tsx lib/api-clients.spec.ts components/apps/apps-home.spec.tsx components/me/memory-manager.spec.tsx components/me/me-home.spec.tsx` | Passed: 5 files, 8 tests |
| `npm.cmd run test:web` | Passed: 10 files, 20 tests |
| `npm.cmd run typecheck --workspace @xinyu/web` | Passed |
| `git diff --check` / `git diff --cached --check` | Passed |
| Direct `fetch` audit under `apps/web/app` and `apps/web/components` | None found |
| Task 5/6 component-path audit (`components/chat`, `components/contacts`, `components/skills`) | No files created |

The focused command forwards paths successfully but emits npm's existing warning that `--run` is parsed as an unknown npm CLI option. Vitest still receives the paths and exits successfully.

## Scope audit

- No Task 5 conversation-list, conversation-pane, message-bubble, composer, contacts editor, or group-creator component was added.
- No Task 6 skill launcher, skill input flow, or skill result UI was added.
- No API, Prisma, model, safety, quota, billing, payment, package dependency, or migration behavior changed.
- The prior provisional private-contact creation form was not carried into this shell extraction because the Task 2 API now requires an explicit approved skill configuration; implementing that selection belongs to the Task 5 contact editor and Task 6 skill experience. The existing contact list, private-contact deletion, and provisional discussion-group action remain available through typed clients.
- Apps contains status/entry information only; no Life Mirror or theme-event experience content remains in the authenticated page.

## Commit

- `648cb3d feat: add M2 navigation and account surfaces`

## Known limitations and follow-up

- No browser E2E or live API exercise was required or run for Task 4. Responsive placement is implemented in CSS and navigation semantics are component-tested; viewport-level interaction remains part of later M2 browser acceptance.
- The account/privacy/agreement/settings groups are information architecture only. Formal policy text and final settings controls are intentionally not defined here.
- The full chat experience, contact creation/skill editor, three-member discussion-group UX, and skill launcher/result UI remain Tasks 5 and 6.
