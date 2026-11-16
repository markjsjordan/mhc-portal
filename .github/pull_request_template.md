## Summary
<!-- Briefly describe what this PR changes and why. -->

**ClickUp Ticket:** <!-- e.g. wdvf3acxht -->

## Type of Change
- [ ] Bug fix (`fix:`)
- [ ] Feature (`feat:`)
- [ ] Refactor / Chore / Docs

## Bug-to-Regression-Test Checklist (Required for `bug` / `fix:` / QA-failure PRs)
- [ ] **Failing-first regression test added**: verified **RED** on base commit (`<base-sha>`) and **GREEN** on head commit (`<head-sha>`)
- [ ] **Lowest test level chosen & justified**:
  - [ ] Vitest unit/component (`*.test.ts` / `*.test.tsx`)
  - [ ] Vitest API/route (`packages/app/src/routes/__tests__/*.test.ts`)
  - [ ] Playwright E2E (`e2e/*.spec.ts`) — only when a real browser, multi-page route, or auth/permission flow is required
  - Justification: <!-- why this level is the lowest that catches the defect -->

## Verification
- [ ] Lint, TypeCheck, Build, and Tests pass locally (pre-commit hook enabled)
