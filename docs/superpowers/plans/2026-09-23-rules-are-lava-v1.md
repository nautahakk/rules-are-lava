# Rules Are Lava V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a mobile-first solo writing game where Jev visibly judges accumulating semantic rules, with three-life daily runs, anonymous Code Critters, a daily top-10 board, and X sharing.

**Architecture:** One Next.js application serves the UI and four server endpoints. Pure game functions own rule selection and state transitions; server services own identity, deadlines, Jev calls, and optimistic database updates; Supabase Postgres stores anonymous runs and exposes ranked daily-score views only to server code.

**Tech Stack:** Node 24.15.0, Next.js 16.3.4, React 19.3.0, TypeScript 6.0.3, plain CSS, `@typesafe-ai/sdk` 0.6.0, Supabase JS 2.116.0, Zod 4.6.2, Vitest 5, Testing Library, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-09-22-rules-are-lava-design.md`

## Global Constraints

- Solo survival only; no multiplayer, chat, public responses, accounts, editable names, or social-handle fields.
- A run starts with three lives, uses a server-issued 30-second deadline, and accepts one trimmed response of 1–160 characters per round.
- Active rule stacks contain at most four rules, and every scored round contains at least one semantic Jev rule.
- Deterministic rules run in code; all active semantic rules are batched into at most one Jev request per round.
- Jev passes a semantic rule when `probabilities.yes >= 0.50`; malformed or unavailable Jev results leave the run retryable and do not consume a life.
- Player responses are evaluated in memory and never persisted or displayed publicly.
- The daily challenge and visible leaderboard use the UTC calendar date and reset at 00:00 UTC.
- The board shows ten entries, shared ranks for equal scores, and the current player's best row when outside the top ten.
- Public names come only from the fixed Code Critter catalogue.
- TypeSafe and Supabase service credentials remain server-only.
- UI must meet WCAG AA text contrast, visible keyboard focus, 44px touch targets, reduced-motion support, and an 8px spacing rhythm.
- Use plain CSS and platform features; add no component library, state library, realtime service, analytics SDK, cache, queue, or separate rate-limit service.

## Review Focus

- Whitespace-only and 161-character answers must return a validation error without changing round, score, lives, or deadline; pinned in Task 5 service tests.
- Two simultaneous submissions for one expected round must advance the run at most once; pinned in Task 5 optimistic-concurrency tests.
- A timeout or malformed Jev response must leave the answer retryable and issue a fresh deadline without consuming a life; pinned in Task 4 evaluator tests and Task 5 service tests.
- A run that crosses 00:00 UTC must finish against its original challenge date but must not appear on the new day's board; pinned in Task 3 leaderboard tests and Task 5 restore tests.
- Missing, non-finite, out-of-range, or unknown Jev choices/probabilities must fail closed as a retryable infrastructure error; pinned in Task 4 response-validation tests.

---

## File Map

| Path | Responsibility |
|---|---|
| `package.json` | Pinned runtime, scripts, and dependencies. |
| `src/game/types.ts` | Shared domain and API types. |
| `src/game/rules.ts` | Curated rule catalogue and deterministic evaluators. |
| `src/game/daily.ts` | UTC challenge id, reset time, deterministic sequence, active stack. |
| `src/game/engine.ts` | Pure pass/fail state transition. |
| `src/server/env.ts` | Lazy server-only environment validation. |
| `src/server/jev.ts` | One batched typed Jev request and strict response parsing. |
| `src/server/run-repository.ts` | Repository interface plus Supabase implementation. |
| `src/server/run-service.ts` | Start, restore, submit, deadline, and concurrency orchestration. |
| `src/server/identity.ts` | Anonymous HttpOnly player cookie. |
| `src/app/api/**/route.ts` | Thin HTTP adapters around server services. |
| `src/components/game.tsx` | Client game state and API orchestration. |
| `src/components/rule-stack.tsx` | Accessible rule cards and verdict rows. |
| `src/components/leaderboard.tsx` | Daily teaser, top ten, pinned player row, countdown. |
| `src/components/share-on-x.tsx` | X Web Intent URL and game-over action. |
| `src/app/globals.css` | Complete responsive visual system and motion fallback. |
| `supabase/migrations/202609230001_create_runs.sql` | Runs table, constraints, views, and server-only privileges. |
| `e2e/game.spec.ts` | Mocked full-browser gameplay and accessibility smoke coverage. |

### Task 1: Application Shell and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Create: `src/app/globals.css`

**Interfaces:**
- Consumes: Approved design spec only.
- Produces: Node/Next project scripts, `@/*` source alias, jsdom unit-test environment, and a rendered `Rules Are Lava` page for later tasks.

- [ ] **Step 1: Write the pinned package manifest**

```json
{
  "name": "rules-are-lava",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": "^24.15.0" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.116.0",
    "@typesafe-ai/sdk": "0.6.0",
    "next": "16.3.4",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "4.6.2"
  },
  "devDependencies": {
    "@axe-core/playwright": "4.13.0",
    "@playwright/test": "1.63.0",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/node": "22.20.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.4",
    "jsdom": "30.0.1",
    "supabase": "2.117.0",
    "typescript": "6.0.3",
    "vitest": "5.0.0"
  }
}
```

- [ ] **Step 2: Install exactly the manifest dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and `npm ls --depth=0` exits successfully.

- [ ] **Step 3: Add TypeScript, Next, lint, Vitest, Playwright, environment-example, and ignore configuration**

Use the Reddy project conventions: strict TypeScript, `@/* -> ./src/*`, jsdom tests matching `src/**/*.{test,spec}.{ts,tsx}`, Playwright base URL `http://127.0.0.1:3000`, and web server command `npm run dev -- --hostname 127.0.0.1`. `.env.example` contains only these empty keys:

```dotenv
TYPESAFE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_REPOSITORY_URL=
```

`.gitignore` must include `.next/`, `node_modules/`, `playwright-report/`, `test-results/`, `.env*`, and `!.env.example`.

- [ ] **Step 4: Write the failing landing-page test**

```tsx
import { render, screen } from '@testing-library/react';
import Page from './page';

it('introduces the Jev-refereed game', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Rules Are Lava' })).toBeInTheDocument();
  expect(screen.getByText('A survival writing game refereed by Jev.')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the test and verify the missing page fails**

Run: `npm test -- src/app/page.test.tsx`

Expected: FAIL because `./page` does not exist.

- [ ] **Step 6: Add the minimum accessible root layout and page**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rules Are Lava',
  description: 'A survival writing game refereed by Jev.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

```tsx
// src/app/page.tsx
export default function Page() {
  return <main><h1>Rules Are Lava</h1><p>A survival writing game refereed by Jev.</p></main>;
}
```

- [ ] **Step 7: Verify the shell**

Run: `npm test -- src/app/page.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: successful production build without environment secrets because environment access is not imported yet.

- [ ] **Step 8: Commit the shell**

```bash
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs .gitignore .env.example vitest.config.ts vitest.setup.ts playwright.config.ts src/app
git commit -m "chore: scaffold Rules Are Lava web app"
```

### Task 2: Pure Rules, Daily Sequence, and Game Engine

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/rules.ts`
- Create: `src/game/rules.test.ts`
- Create: `src/game/daily.ts`
- Create: `src/game/daily.test.ts`
- Create: `src/game/engine.ts`
- Create: `src/game/engine.test.ts`

**Interfaces:**
- Consumes: No application state or external services.
- Produces: `Rule`, `RunState`, `RuleVerdict`, `challengeDate()`, `nextResetAt()`, `dailySequence()`, `activeRules()`, `evaluateDeterministicRule()`, and `applyRoundResult()`.

- [ ] **Step 1: Define shared domain types**

```ts
export type EvaluatorKind = 'deterministic' | 'semantic';
export type RunStatus = 'active' | 'completed';

export type Rule = {
  id: string;
  label: string;
  evaluator: EvaluatorKind;
  question?: string;
};

export type RuleVerdict = {
  ruleId: string;
  label: string;
  evaluator: EvaluatorKind;
  passed: boolean;
  probability?: number;
  detail?: string;
};

export type RunState = {
  roundIndex: number;
  lives: number;
  score: number;
  status: RunStatus;
};
```

- [ ] **Step 2: Write failing rule-catalogue tests**

Cover all four deterministic rules and require at least six semantic rules. Pin these examples:

```ts
expect(evaluateDeterministicRule('six_words', 'one two three four five six').passed).toBe(true);
expect(evaluateDeterministicRule('six_words', 'one two three').detail).toBe('3 of 6 words');
expect(evaluateDeterministicRule('no_e', 'Volcanic ash')).toMatchObject({ passed: false });
expect(evaluateDeterministicRule('question_end', 'Ready now?').passed).toBe(true);
expect(evaluateDeterministicRule('include_number', 'Take route 7').passed).toBe(true);
```

- [ ] **Step 3: Run the catalogue test and verify failure**

Run: `npm test -- src/game/rules.test.ts`

Expected: FAIL because the catalogue and evaluator do not exist.

- [ ] **Step 4: Implement the curated catalogue and deterministic evaluator**

Use these stable ids and exact player-facing labels:

```ts
export const RULES: readonly Rule[] = [
  { id: 'mars_event', label: 'Mention something that could reasonably happen on Mars.', evaluator: 'semantic', question: 'Does the response mention something that could reasonably happen on Mars?' },
  { id: 'suspicious_animal', label: 'Make an animal sound suspicious.', evaluator: 'semantic', question: 'Does the response make an animal sound suspicious?' },
  { id: 'hopeful_no_promise', label: 'Sound hopeful without promising success.', evaluator: 'semantic', question: 'Does the response sound hopeful without promising success?' },
  { id: 'harmless_crime', label: 'Describe a harmless crime.', evaluator: 'semantic', question: 'Does the response describe a harmless crime?' },
  { id: 'implied_rain', label: 'Imply that it is raining without saying “rain.”', evaluator: 'semantic', question: 'Does the response imply rain without using the word rain?' },
  { id: 'tiny_disaster', label: 'Describe a disaster that would fit in a pocket.', evaluator: 'semantic', question: 'Does the response describe a disaster small enough to fit in a pocket?' },
  { id: 'bad_advice', label: 'Give advice that is clearly a bad idea.', evaluator: 'semantic', question: 'Does the response give advice that is clearly a bad idea?' },
  { id: 'awkward_apology', label: 'Apologize without using “sorry.”', evaluator: 'semantic', question: 'Does the response function as an apology without using the word sorry?' },
  { id: 'six_words', label: 'Use exactly six words.', evaluator: 'deterministic' },
  { id: 'no_e', label: 'Do not use the letter E.', evaluator: 'deterministic' },
  { id: 'question_end', label: 'End with a question mark.', evaluator: 'deterministic' },
  { id: 'include_number', label: 'Include a number.', evaluator: 'deterministic' }
] as const;
```

Implement `evaluateDeterministicRule(ruleId, text)` with whitespace word splitting, `/e/iu`, `trimEnd().endsWith('?')`, and `/\p{N}/u`. Throw for an unknown or semantic id so programming errors cannot silently pass.

- [ ] **Step 5: Write failing daily-sequence tests**

```ts
const first = dailySequence('2026-09-23', 40);
expect(dailySequence('2026-09-23', 40)).toEqual(first);
expect(dailySequence('2026-09-24', 40)).not.toEqual(first);
for (let round = 0; round < 40; round += 1) {
  const stack = activeRules('2026-09-23', round);
  expect(stack.length).toBeLessThanOrEqual(4);
  expect(new Set(stack.map(rule => rule.id)).size).toBe(stack.length);
  expect(stack.some(rule => rule.evaluator === 'semantic')).toBe(true);
}
expect(nextResetAt(new Date('2026-09-23T20:00:00Z')).toISOString()).toBe('2026-09-24T00:00:00.000Z');
```

- [ ] **Step 6: Implement deterministic UTC sequencing without another dependency**

Use FNV-1a to turn `${date}:${category}:${cycle}` into a 32-bit seed and Mulberry32 for a deterministic Fisher-Yates shuffle. Build the requested sequence one item at a time, alternating semantic and deterministic buckets, and reject candidates present in the previous four emitted ids. Export:

```ts
export function challengeDate(now: Date): string;
export function nextResetAt(now: Date): Date;
export function dailySequence(date: string, count: number): Rule[];
export function activeRules(date: string, roundIndex: number): Rule[];
```

`activeRules` returns `dailySequence(date, roundIndex + 1).slice(-4)`.

- [ ] **Step 7: Write failing game-transition tests**

```ts
const start = { roundIndex: 0, lives: 3, score: 0, status: 'active' } as const;
expect(applyRoundResult(start, true)).toEqual({ roundIndex: 1, lives: 3, score: 1, status: 'active' });
expect(applyRoundResult(start, false)).toEqual({ roundIndex: 1, lives: 2, score: 0, status: 'active' });
expect(applyRoundResult({ ...start, lives: 1 }, false)).toEqual({ roundIndex: 1, lives: 0, score: 0, status: 'completed' });
```

- [ ] **Step 8: Implement the minimal pure transition and run all domain tests**

```ts
export function applyRoundResult(state: RunState, passed: boolean): RunState {
  if (state.status !== 'active') return state;
  const lives = passed ? state.lives : state.lives - 1;
  return {
    roundIndex: state.roundIndex + 1,
    lives,
    score: state.score + (passed ? 1 : 0),
    status: lives === 0 ? 'completed' : 'active'
  };
}
```

Run: `npm test -- src/game`

Expected: all domain tests PASS.

- [ ] **Step 9: Commit the domain**

```bash
git add src/game
git commit -m "feat: add daily rules and survival engine"
```

### Task 3: Supabase Schema, Anonymous Identity, and Ranked Scores

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202609230001_create_runs.sql`
- Create: `src/server/env.ts`
- Create: `src/server/db.ts`
- Create: `src/server/identity.ts`
- Create: `src/server/identity.test.ts`
- Create: `src/server/run-repository.ts`
- Create: `src/server/run-repository.test.ts`

**Interfaces:**
- Consumes: `RunStatus` from `src/game/types.ts`.
- Produces: `RunRecord`, `LeaderboardResult`, `RunRepository`, `SupabaseRunRepository`, `getOrCreatePlayerId()`, and lazy `serverEnv()`.

- [ ] **Step 1: Write the migration with server-only data access**

```sql
create extension if not exists pgcrypto;

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  challenge_date date not null,
  round_index integer not null default 0 check (round_index >= 0),
  lives smallint not null default 3 check (lives between 0 and 3),
  score integer not null default 0 check (score >= 0),
  status text not null default 'active' check (status in ('active', 'completed')),
  deadline_at timestamptz,
  critter_name text not null check (char_length(critter_name) between 1 and 80),
  last_failed_rule_id text,
  last_failed_evaluator text check (last_failed_evaluator is null or last_failed_evaluator in ('deterministic', 'semantic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'active' and deadline_at is not null and lives > 0) or (status = 'completed' and deadline_at is null and lives = 0))
);

alter table public.runs enable row level security;
revoke all on public.runs from anon, authenticated;

create index runs_player_day_idx on public.runs (player_id, challenge_date, score desc);
create index runs_daily_board_idx on public.runs (challenge_date, status, score desc);

create view public.daily_best_scores with (security_invoker = true) as
select distinct on (challenge_date, player_id)
  id, player_id, challenge_date, score, critter_name, completed_at
from public.runs
where status = 'completed'
order by challenge_date, player_id, score desc, completed_at asc;

create view public.ranked_daily_scores with (security_invoker = true) as
select
  id, player_id, challenge_date, score, critter_name, completed_at,
  dense_rank() over (partition by challenge_date order by score desc) as rank
from public.daily_best_scores;

revoke all on public.daily_best_scores from anon, authenticated;
revoke all on public.ranked_daily_scores from anon, authenticated;
```

- [ ] **Step 2: Apply the migration to a local Supabase database**

Run: `npx supabase start`

Expected: local Supabase services start.

Run: `npx supabase db reset`

Expected: migration completes and both views exist.

- [ ] **Step 3: Add lazy environment and service-client creation**

`serverEnv()` uses a Zod object for `TYPESAFE_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, all non-empty strings. It runs only inside a server function, never at module import, so `next build` does not require deployed secrets.

```ts
export function createServiceDatabase() {
  const env = serverEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
```

- [ ] **Step 4: Write failing anonymous-identity tests**

Pin UUID acceptance, invalid-cookie replacement, fixed Code Critter output, and collision suffixing:

```ts
expect(validPlayerId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
expect(validPlayerId('not-a-player')).toBe(false);
expect(codeCritter('550e8400-e29b-41d4-a716-446655440000')).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
expect(uniqueCritterName('Binary Badger', new Set(['Binary Badger']), '550e8400-e29b-41d4-a716-446655440000')).toMatch(/^Binary Badger · \d{2}$/);
```

- [ ] **Step 5: Implement identity helpers**

Use adjective/code-term and animal arrays, select both from a stable hash of the UUID, and use the final two decimal digits of the UUID hash only when the base name is already taken. `getOrCreatePlayerId()` reads `ral_player`, validates UUID syntax, otherwise creates `crypto.randomUUID()`, and sets:

```ts
{
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365
}
```

- [ ] **Step 6: Define repository interfaces and record types**

```ts
export type RunRecord = {
  id: string;
  playerId: string;
  challengeDate: string;
  roundIndex: number;
  lives: number;
  score: number;
  status: 'active' | 'completed';
  deadlineAt: string | null;
  critterName: string;
  lastFailedRuleId: string | null;
  lastFailedEvaluator: 'deterministic' | 'semantic' | null;
  completedAt: string | null;
};

export type LeaderboardResult = {
  top: Array<{ rank: number; critterName: string; score: number; isPlayer: boolean }>;
  player: { rank: number; critterName: string; score: number; isPlayer: true } | null;
};

export interface RunRepository {
  createRun(input: Omit<RunRecord, 'id'>): Promise<RunRecord>;
  findOwnedRun(id: string, playerId: string): Promise<RunRecord | null>;
  critterForPlayerDay(date: string, playerId: string): Promise<string | null>;
  namesForDay(date: string): Promise<Set<string>>;
  advanceRun(id: string, playerId: string, expectedRound: number, next: RunRecord): Promise<RunRecord | null>;
  refreshDeadline(id: string, playerId: string, expectedRound: number, deadlineAt: string): Promise<RunRecord | null>;
  leaderboard(date: string, playerId: string): Promise<LeaderboardResult>;
}
```

- [ ] **Step 7: Write failing repository mapping and ranking tests**

Test snake-case database rows mapping to `RunRecord`, reuse of the same player's existing Code Critter across repeated daily runs, top-ten truncation, shared ranks, one best score per player, the player's pinned row, and exclusion of a completed run whose `challenge_date` differs from the requested day.

- [ ] **Step 8: Implement the Supabase repository**

Use server-service queries only. `advanceRun` must update with all four filters:

```ts
.eq('id', id)
.eq('player_id', playerId)
.eq('round_index', expectedRound)
.eq('status', 'active')
```

Return `null` when the conditional update affected no row. `leaderboard()` queries `ranked_daily_scores` twice: top ten ordered by `score desc, completed_at asc`, and the current player's row for the same challenge date. Never fetch previous dates for the visible response.

- [ ] **Step 9: Verify and commit persistence**

Run: `npm test -- src/server/identity.test.ts src/server/run-repository.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: exit 0.

```bash
git add supabase src/server/env.ts src/server/db.ts src/server/identity.ts src/server/identity.test.ts src/server/run-repository.ts src/server/run-repository.test.ts
git commit -m "feat: add anonymous run persistence"
```

### Task 4: Batched Jev Semantic Evaluator

**Files:**
- Create: `src/server/jev.ts`
- Create: `src/server/jev.test.ts`

**Interfaces:**
- Consumes: semantic `Rule[]` from `src/game/types.ts` and a server-only TypeSafe key.
- Produces: `evaluateSemanticRules(input, rules, options?) -> Promise<RuleVerdict[]>` and `JevUnavailableError`.

- [ ] **Step 1: Write the fake-client success test**

```ts
const calls: unknown[] = [];
class FakeClient {
  async systemOne(payload: unknown) {
    calls.push(payload);
    return {
      answers: {
        suspicious_animal: { choice: 'yes', probabilities: { yes: 0.82, no: 0.18 } },
        hopeful_no_promise: { choice: 'no', probabilities: { yes: 0.42, no: 0.58 } }
      }
    };
  }
}

const verdicts = await evaluateSemanticRules('The fox may improve tomorrow.', rules, {
  apiKey: 'test-key',
  Client: FakeClient
});
expect(calls).toHaveLength(1);
expect(verdicts.map(({ passed, probability }) => ({ passed, probability }))).toEqual([
  { passed: true, probability: 0.82 },
  { passed: false, probability: 0.42 }
]);
```

- [ ] **Step 2: Run the success test and verify failure**

Run: `npm test -- src/server/jev.test.ts`

Expected: FAIL because `evaluateSemanticRules` does not exist.

- [ ] **Step 3: Implement one typed question per semantic rule and one request**

```ts
const questions = Object.fromEntries(rules.map(rule => [
  rule.id,
  choice(rule.question!, {
    yes: { verdict: 'The response obeys this rule.' },
    no: { verdict: 'The response breaks this rule.' }
  })
]));

const client = new Client({
  apiKey,
  defaultModel: 'jev-latest',
  logLevel: 'off',
  retry: { maxRetries: 0 },
  timeout: 2500
});

const response = await client.systemOne({
  state: { response: text, rules: rules.map(({ id, label }) => ({ id, label })) },
  questions
}, {
  signal,
  timeout: 2500,
  retry: { maxRetries: 0 }
});
```

For each rule, validate `choice` is `yes` or `no`; both probabilities exist, are finite, and fall in `[0, 1]`; and the answer key matches a requested rule. Return `passed: probabilityYes >= 0.50` rather than trusting the selected label alone.

- [ ] **Step 4: Add the hostile-response test matrix**

Each case must reject with `JevUnavailableError`:

```ts
it.each([
  undefined,
  { choice: 'maybe', probabilities: { yes: 0.5, no: 0.5 } },
  { choice: 'yes', probabilities: { yes: Number.NaN, no: 0 } },
  { choice: 'yes', probabilities: { yes: 1.2, no: -0.2 } },
  { choice: 'yes', probabilities: { yes: 0.7 } }
])('rejects malformed Jev answer %#', async answer => {
  await expect(runWithAnswer(answer)).rejects.toBeInstanceOf(JevUnavailableError);
});
```

Also test that a thrown timeout or authentication error is wrapped without exposing the API key or raw provider body.

- [ ] **Step 5: Verify and commit Jev integration**

Run: `npm test -- src/server/jev.test.ts`

Expected: PASS, including one-call batching and every malformed response.

```bash
git add src/server/jev.ts src/server/jev.test.ts
git commit -m "feat: evaluate semantic rules with Jev"
```

### Task 5: Authoritative Run Service and API Routes

**Files:**
- Create: `src/server/run-service.ts`
- Create: `src/server/run-service.test.ts`
- Create: `src/server/test-memory-repository.ts`
- Create: `src/server/http.ts`
- Create: `src/app/api/runs/route.ts`
- Create: `src/app/api/runs/[id]/route.ts`
- Create: `src/app/api/runs/[id]/answers/route.ts`
- Create: `src/app/api/leaderboard/route.ts`

**Interfaces:**
- Consumes: pure game functions, `RunRepository`, anonymous player id, and `evaluateSemanticRules`.
- Produces: `startRun()`, `restoreRun()`, `submitRound()`, `clientRunState()`, and JSON endpoints defined by the spec.

- [ ] **Step 1: Define the public response shape and validation schema**

```ts
export type ClientRunState = {
  id: string;
  challengeDate: string;
  roundIndex: number;
  lives: number;
  score: number;
  status: 'active' | 'completed';
  deadlineAt: string | null;
  critterName: string;
  activeRules: Array<Pick<Rule, 'id' | 'label' | 'evaluator'>>;
  lastFailure: { ruleId: string; label: string; evaluator: 'deterministic' | 'semantic' } | null;
};

const submissionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('answer'), expectedRound: z.number().int().nonnegative(), text: z.string().trim().min(1).max(160) }),
  z.object({ kind: z.literal('timeout'), expectedRound: z.number().int().nonnegative() })
]);
```

All route errors use `{ error: { code, message, retryable } }` and an appropriate 400, 404, 409, or 503 status.

- [ ] **Step 2: Write failing start/validation tests**

Use `MemoryRunRepository` and an injected clock. Pin:

```ts
expect((await startRun(deps)).lives).toBe(3);
expect((await startRun(deps)).activeRules).toHaveLength(1);
expect(new Date((await startRun(deps)).deadlineAt!).getTime() - now.getTime()).toBe(30_000);
```

For `''`, `'   '`, and `'x'.repeat(161)`, assert `submitRound` rejects before calling Jev and the stored record is byte-for-byte unchanged.

- [ ] **Step 3: Implement start and serializer**

`startRun` computes the UTC challenge date and first reuses `critterForPlayerDay()` when that player already has a run today. Otherwise it checks names already used that day and assigns a collision-safe Code Critter. It creates a three-life run with deadline `now + 30_000` and serializes active rules from `challengeDate + roundIndex`. Never accept initial game state from the browser.

- [ ] **Step 4: Write failing pass, fail, timeout, and retry tests**

Cover:

- All deterministic and semantic verdicts pass: score increments, lives stay three.
- One verdict fails: score stays, one life is lost, failed rule metadata is stored.
- Timeout submitted one millisecond before deadline: `ROUND_ACTIVE` conflict and no mutation.
- Timeout at deadline: exactly one life lost.
- A timeout clears failed-rule metadata so sharing cannot blame an earlier rule for the final loss.
- Jev throws: state unchanged, deadline becomes `now + 30_000`, and error is retryable.
- Zero lives: completed status, null deadline, and no further submission changes state.
- Run begun on `2026-09-23T23:59:50Z` and answered after midnight retains challenge date `2026-09-23`.
- After any answer, the persisted `RunRecord` contains verdict metadata but no response text field or submitted text value.

- [ ] **Step 5: Implement answer orchestration**

For an answer submission:

1. Load by `runId + playerId`.
2. Return 404 when missing.
3. Return current state when completed or `expectedRound` is stale.
4. If `now >= deadline`, apply one failed timeout transition instead of evaluating late text.
5. Evaluate every active deterministic rule in code.
6. Batch every active semantic rule through the injected Jev evaluator.
7. Pass the round only when every verdict passes.
8. Set the next deadline to `now + 30_000`, or null at zero lives.
9. Call conditional `advanceRun` using the expected round.
10. When the update returns null, reload and return the authoritative state.

On `JevUnavailableError`, conditionally call `refreshDeadline` for the same round, then return a retryable `JEV_UNAVAILABLE` error. Do not persist answer text in any path.

- [ ] **Step 6: Pin simultaneous-submission behaviour**

Run two `submitRound` promises against the same in-memory repository and expected round. Configure the memory repository's conditional update like Postgres. Assert:

```ts
expect(repo.record.roundIndex).toBe(1);
expect(repo.record.score).toBe(1);
expect(results.every(result => result.roundIndex === 1)).toBe(true);
```

- [ ] **Step 7: Implement restore and deadline reconciliation**

`restoreRun` returns the owned run unchanged when active and before deadline. At or after deadline it applies exactly one failed transition through the same conditional update; if another request wins, it reloads current state. A completed old-day run remains readable, but leaderboard lookup always uses today's UTC date.

- [ ] **Step 8: Add thin route handlers**

Each handler obtains `playerId` through `getOrCreatePlayerId()`, constructs the repository and Jev evaluator server-side, calls one service function, and maps domain errors through `jsonError()`. Routes never accept player id, score, lives, active rules, evaluator results, challenge date, or deadline from JSON.

- [ ] **Step 9: Verify service and route types**

Run: `npm test -- src/server/run-service.test.ts`

Expected: PASS for validation, deadline, midnight, retry, completion, and concurrency cases.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 10: Commit the authoritative server flow**

```bash
git add src/server/run-service.ts src/server/run-service.test.ts src/server/test-memory-repository.ts src/server/http.ts src/app/api
git commit -m "feat: add authoritative daily run API"
```

### Task 6: Responsive Game, Verdicts, Leaderboard, and X Sharing

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/game.tsx`
- Create: `src/components/game.test.tsx`
- Create: `src/components/rule-stack.tsx`
- Create: `src/components/leaderboard.tsx`
- Create: `src/components/countdown.tsx`
- Create: `src/components/share-on-x.tsx`
- Create: `src/components/share-on-x.test.ts`

**Interfaces:**
- Consumes: `ClientRunState`, `RuleVerdict`, and the four JSON endpoints.
- Produces: ready, playing, verdict, and game-over UI; local draft restoration; daily teaser; full board; X share action.

- [ ] **Step 1: Write the failing ready-state component test**

Mock `GET /api/leaderboard` with `{ topScore: 14, top: [], player: null, resetAt: '2026-09-24T00:00:00.000Z' }`. Assert the page has one primary `Play today's challenge` button and the quiet line `Today's best: 14 rounds` before a run begins, while the full `Today's Survivors` heading is absent.

- [ ] **Step 2: Implement ready state and daily teaser**

Render one focused game card. Fetch the leaderboard once on mount, derive countdown text from the absolute reset timestamp, and place the teaser below the play action. Add a `How Jev judges` disclosure explaining that exact constraints run in code while semantic constraints use Jev probabilities. The primary action posts `/api/runs`, stores the returned run id in `sessionStorage` as `ral_run`, and enters playing state.

- [ ] **Step 3: Write the failing play/verdict test**

Mock a run with four rules. Type a multiline response, press Enter alone, and assert no request occurred. Press Ctrl+Enter, return mixed verdicts, and assert:

```ts
expect(screen.getByText('Pass · 78%')).toBeInTheDocument();
expect(screen.getByText('5 of 6 words')).toBeInTheDocument();
expect(screen.getByText('2 lives')).toBeInTheDocument();
```

Also assert 160-character text is accepted, the submit action disables while awaiting a result, and plain Enter remains available for multiline input.

- [ ] **Step 4: Implement playing and verdict states**

`Game` owns the small state union `'ready' | 'playing' | 'submitting' | 'verdict' | 'gameover'`. Keep the response controlled, mirror it to `sessionStorage` under `ral_draft`, and clear it only after a successful authoritative transition. Submit with button or Ctrl/Cmd+Enter. Use `aria-live="polite"` for score/timer and `role="status"` for infrastructure errors.

`RuleStack` renders at most four `<li>` cards. `VerdictList` renders pass/fail icon plus text; semantic rows format `Math.round(probability * 100)%`, and deterministic rows show exact detail. Colour supplements but never replaces the label.

- [ ] **Step 5: Implement authoritative countdown and restore**

`Countdown` renders remaining whole seconds from `deadlineAt`. At zero, it sends exactly one `{ kind: 'timeout', expectedRound }` request guarded by a ref. On reload, `Game` reads `ral_run`, calls `GET /api/runs/:id`, and uses the returned server state; a missing/404 run clears session storage and returns to ready state.

- [ ] **Step 6: Write and implement leaderboard presentation tests**

Pin top-ten rows, shared rank text, and a separate player row only when `player` is not already represented in `top`. Render the full `Today's Survivors` section only in game-over state. The reset countdown must use the API timestamp rather than calculating local midnight.

- [ ] **Step 7: Write the X intent helper test**

```ts
expect(buildXIntent({
  score: 9,
  failedRule: { label: 'Sound hopeful without promising success.', evaluator: 'semantic' },
  siteUrl: 'https://rulesarelava.example'
})).toBe(
  'https://x.com/intent/post?text=' + encodeURIComponent(
    'I survived 9 rounds of Rules Are Lava 🌋\n\nJev\'s ruling got me on: “Sound hopeful without promising success.”\nCan you beat 9?\n\nhttps://rulesarelava.example'
  )
);
```

Add a second assertion that deterministic failures say `The lava got me on` and never credit Jev. Keep the URL builder in one pure function so an X URL change requires one edit.
Add a third assertion with `failedRule: null` that says `The lava caught me at round 9.` and names no rule.

- [ ] **Step 8: Implement game-over and X sharing**

Game over fetches the leaderboard again, compares the final score with numeric `localStorage.ral_personal_best`, updates that value when higher, and renders `New personal best` only for an actual increase. It then renders the full board, `Play again`, a secondary anchor targeting the built X intent URL with `target="_blank" rel="noopener noreferrer"`, and a repository link from `NEXT_PUBLIC_REPOSITORY_URL`. Use `window.location.origin` for the site URL. Never include response text. Component tests must pin first-run best, lower replay, and higher replay behavior.

- [ ] **Step 9: Finish the plain-CSS visual system**

Use CSS custom properties for volcanic background, elevated rock surfaces, text, muted text, lava, success, failure, focus, radius, and shadows. Use an 8px spacing scale, `clamp()` typography, 44px minimum controls, visible `:focus-visible`, a single-column phone layout, and a max-width desktop game surface. Animate only opacity/transform for rule melting and verdict entry. Under `prefers-reduced-motion: reduce`, remove transitions and animations.

- [ ] **Step 10: Verify UI and commit**

Run: `npm test -- src/app/page.test.tsx src/components`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

```bash
git add src/app src/components
git commit -m "feat: build the Rules Are Lava game experience"
```

### Task 7: Browser Smoke Test, README, and Deployment Checks

**Files:**
- Create: `e2e/game.spec.ts`
- Create: `README.md`
- Create: `LICENSE`

**Interfaces:**
- Consumes: Finished app and stable API shapes.
- Produces: Credential-free browser regression, public technical explanation, deployment checklist, and final verified branch.

- [ ] **Step 1: Write the mocked browser journey**

In Playwright, intercept all four API surfaces with a tiny in-test run fixture. Exercise:

1. Landing copy and daily-best teaser.
2. Start run.
3. Submit one passing response.
4. Inspect semantic probability and deterministic detail.
5. Trigger three failed rounds until game over.
6. Confirm top ten, pinned player rank, reset countdown, `Play again`, and `Share on X`.
7. Confirm the X anchor contains score and failed rule but not the submitted response.

Use `@axe-core/playwright` on ready, playing, verdict, and game-over states and assert no serious or critical violations.

- [ ] **Step 2: Add mobile and reduced-motion coverage**

Set viewport to 375×812, submit via Ctrl+Enter, assert no horizontal overflow with `document.documentElement.scrollWidth <= window.innerWidth`, then emulate reduced motion and assert the active rule card has `animation-name: none` and near-zero transition duration.

- [ ] **Step 3: Run the browser smoke test**

Run: `npx playwright install chromium`

Expected: Chromium installs successfully.

Run: `npm run test:e2e`

Expected: all gameplay, 375px, reduced-motion, and axe checks PASS.

- [ ] **Step 4: Run the complete local gate**

Run: `npm test`

Expected: all unit/component tests PASS.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: successful production build.

Run: `npm run test:e2e`

Expected: all browser tests PASS.

- [ ] **Step 5: Create the public repository and apply hosted infrastructure**

Run `gh repo create rules-are-lava --public --source . --remote origin --push`, then capture the returned repository URL for `NEXT_PUBLIC_REPOSITORY_URL`. Link the repository to the intended Supabase project, apply `202609230001_create_runs.sql`, and set `TYPESAFE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_REPOSITORY_URL` in the Vercel project. Deploy production, capture the resulting public game URL, and manually verify one real semantic pass, one real semantic failure, a retry after temporarily invalid TypeSafe credentials, one completed leaderboard entry, the GitHub link, and the X intent window.

- [ ] **Step 6: Write the public README and license with the actual deployment URL**

README sections, in order:

1. One-sentence premise and the production URL returned in Step 5.
2. `How Jev is used`: deterministic rules in code, semantic rules in one batched System One request, probability threshold at 0.50.
3. `Privacy`: no accounts, response text not stored, generated leaderboard names only.
4. `Local setup`: Node version, `npm install`, `.env.example` copy, Supabase start/reset, `npm run dev`.
5. `Verification`: test, typecheck, lint, build, and E2E commands.
6. `Architecture`: links to the approved spec and implementation plan.
7. MIT license.

Use the standard MIT license text with year `2026` and copyright holder `Róbert`. Do not claim Jev evaluates deterministic constraints or that the leaderboard is cheat-proof.

- [ ] **Step 7: Commit and publish the release-ready documentation and tests**

```bash
git add e2e README.md LICENSE
git commit -m "test: verify and document Rules Are Lava v1"
git push origin main
```

- [ ] **Step 8: Final branch review**

Run: `git status --short`

Expected: no output.

Run: `git log --oneline --decorate -8`

Expected: the seven task commits are visible in order, with no unrelated files.

Review the branch specifically for persisted response text, client-supplied authority, exposed secrets, Jev attribution errors, timer races, and mobile overflow before publishing.

