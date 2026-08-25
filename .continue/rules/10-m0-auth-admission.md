---
name: M0 authentication admission - scoped autonomous execution
alwaysApply: true
description: Allow autonomous implementation only for the M0 auth-admission module, with strict repository and command boundaries.
---

# M0 autonomous execution rules

## Scope

- Current repository: `C:\VibeCoding_Project\xinyu-island`
- Allowed branch: `feature/m0-auth-admission`
- Allowed isolated worktree: `C:\VibeCoding_Project\xinyu-island\.worktrees\m0-auth-admission`
- Sole implementation source: `docs/superpowers/plans/2026-08-09-m0-auth-admission.md`
- Mandatory project rules: `AGENTS.md`
- Execute only Task 1 through Task 6 in the M0 plan.
- Do not begin M1 or any other module.

## Allowed autonomous actions

The agent may perform the following without requesting confirmation:

- Read, search, and inspect files inside this repository and the M0 worktree.
- Create or reuse only the specified M0 branch and worktree.
- Create, edit, rename, and add files required by M0 and its tests.
- Run these verification commands from the M0 worktree:
  - `npm.cmd ci`
  - `npm.cmd run test:api`
  - `npm.cmd run test:web`
  - `npm.cmd run typecheck`
  - `npm.cmd run build`
  - `npm.cmd run verify`
- Run safe Git inspection commands: `git status`, `git diff`, `git log`, `git branch`, `git rev-parse`, and `git worktree list`.
- Create local commits on `feature/m0-auth-admission` after each completed M0 task.

## Mandatory implementation discipline

- Read `AGENTS.md` and the M0 plan before editing.
- Check `git status --short` before beginning and before every commit.
- Preserve all pre-existing unrelated changes exactly as found.
- Follow test-driven development: add or adjust a failing test first, implement the smallest change, then run the relevant tests.
- Keep each M0 task in an independent local Git commit.
- Do not modify historical Prisma migrations. M0 must not add a migration unless the plan explicitly requires one.
- Keep Bearer Token authentication. Do not introduce payments, token billing, final visual UI, AI personas, life-mirror content, or unrelated refactors.
- Record the three consent types: terms, privacy, and entertainment notice.
- Never include secrets, API keys, access tokens, `.env` content, database records, or user session data in source files, commits, terminal output, or reports.

## Prohibited actions

Never run or propose:

- `git push`, `git pull`, `git fetch`, `git rebase`, `git merge`
- `git reset --hard`, `git clean`, `git checkout --`, `git restore`
- `Remove-Item`, `del`, `rmdir`, `rd`, or any recursive deletion command
- package installation other than `npm.cmd ci`
- `npm install`, `npm update`, `npm audit fix`
- database reset, drop, seed, migration generation, or Docker operations
- changes outside `C:\VibeCoding_Project\xinyu-island`
- modifications to global configuration, user home directories, IDE settings, credentials, or remote services
- deployment, publishing, PR creation, or remote repository changes

## Stop and report instead of acting when

- The M0 plan conflicts with `AGENTS.md` or existing architecture.
- A required command fails twice for the same reason.
- The worktree or branch cannot be created without touching unrelated changes.
- A task requires a new dependency, database migration, external service, secret, UI decision, or product decision not already confirmed.
- A command would be outside the allowlist or potentially destructive.

## Completion report

After Task 6, stop. Report:

1. Worktree path and branch.
2. Local commit hashes and messages.
3. Files changed per task.
4. Exact test commands and results.
5. Unresolved risks or deviations; write `none` if none exist.

Do not push any commit. Wait for Codex review and acceptance.
