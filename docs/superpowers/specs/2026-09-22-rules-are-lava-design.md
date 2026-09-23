# Rules Are Lava — Version One Design

Date: 2026-09-22
Status: Ready for user review

## Goal

Build a small, immediately playable web game that demonstrates Jev making fast, typed decisions over several natural-language constraints at once.

The product should work for a stranger who arrives from X, Reddit, or GitHub:

1. They understand the premise within a few seconds.
2. They start without creating an account or waiting for another player.
3. They write short responses while rules accumulate.
4. They see exactly how Jev judged each semantic rule.
5. Their run ends with a simple score, daily rank, and optional X share.

The game is the demonstration. Jev must remain visibly central rather than being hidden behind a generic score.

## Product Boundary

Version one includes:

- Solo survival play only.
- One global daily challenge with the same ordered rule sequence for everyone.
- Three lives and an endless score measured in successful rounds.
- At most four active rules; the oldest rule melts when a fifth enters.
- Rule-by-rule verdicts, including Jev probabilities for semantic rules.
- A small daily leaderboard showing the top 10 and the current player's best position.
- A countdown to the next daily reset.
- Anonymous, generated Code Critter identities.
- A game-over action that posts a prepared result to X.
- A public GitHub repository and README explaining the Jev integration.

Version one does not include:

- Live or asynchronous multiplayer.
- Public lobbies, chat, spectators, or voting.
- Accounts, profiles, editable display names, or typed social handles.
- X authentication or API integration.
- All-time, weekly, or seasonal leaderboards.
- Achievements, experience points, unlocks, streak rewards, or purchases.
- User-authored public rules or publicly displayed player responses.
- Challenge links, result permalink infrastructure, or dynamic social cards.

These exclusions keep the first release focused on whether the Jev-driven game loop is enjoyable and understandable.

## Core Game Loop

The player starts a run with three lives, a score of zero, and one active rule.

Each round follows this sequence:

1. Show the active rule stack and a server-issued 30-second deadline.
2. The player submits one trimmed response containing 1–160 characters.
3. Deterministic constraints are checked in code.
4. All semantic constraints are sent to Jev in one batched request.
5. Show a separate verdict for every rule.
6. If every rule passes, increase the score by one.
7. If any rule fails or time expires, remove one life and do not increase the score.
8. Advance to the next rule in the daily sequence whether the answer passed or failed.
9. When the active stack would exceed four rules, visibly melt the oldest rule before adding the new one.
10. End the run when no lives remain.

The timer begins when the round becomes interactive. Submitting locks the answer. A request failure never consumes a life; the player can retry the same submission.

There is no ambiguous outcome in version one. A Jev semantic rule passes when its `yes` probability is at least 0.50 and fails otherwise. The probability remains visible so players can see close calls and understand that Jev is making a calibrated decision rather than producing prose.

Jev's verdict is final for the run. Appeals and human voting belong only in a possible future multiplayer design.

## Rules

Rules come from a curated, version-controlled catalogue. Each rule declares:

- Stable identifier.
- Short player-facing wording.
- Evaluator type: deterministic or semantic.
- Deterministic predicate or Jev question definition.
- Optional examples used only in development tests, never sent as live player hints.

Deterministic examples:

- Use exactly six words.
- Do not use the letter E.
- End with a question mark.
- Include a number.

Semantic examples:

- Mention something that could reasonably happen on Mars.
- Make an animal sound suspicious.
- Sound hopeful without promising success.
- Describe a harmless crime.
- Imply that it is raining without saying “rain.”

At least one active rule in every scored round must be semantic, ensuring Jev is always part of the central experience. Deterministic rules use code because presenting Jev as a worse word counter would weaken the demonstration.

The daily ordered sequence is generated deterministically from the UTC calendar date and the catalogue. All players receive the same sequence. The sequence may repeat evaluator categories but must not add an exact duplicate while that rule remains active.

The catalogue is intentionally small at launch. New rules should be added only after the initial set has been played enough to expose unclear or unfun combinations.

## Jev Integration

The app uses the official `@typesafe-ai/sdk` from server-only code. The TypeSafe API key never reaches the browser.

The existing implementation in `Projects/Jev-Codex-Router/plugin/lib/classifier.js` provides the proven local pattern to reuse:

- `TypeSafeClient` with `jev-latest`.
- Typed `choice` questions.
- One `systemOne` request containing state plus named questions.
- Explicit validation of returned answers and probabilities.
- A short timeout and no automatic retry.

For each round, the state sent to Jev contains only:

- The submitted response.
- The active semantic rule identifiers and wording.
- The current daily challenge identifier and round number for context.

Each semantic rule becomes a named yes/no choice question. All active semantic rules are evaluated in the same Jev request, so a round performs at most one TypeSafe call.

The server validates that every requested rule has an answer, that both probabilities are finite values between zero and one, and that the returned choice exists. A malformed, timed-out, or unavailable Jev response returns a retryable game error and leaves the run unchanged.

Player responses are not stored after evaluation and are never included in the leaderboard.

## Daily Challenge and Leaderboard

The daily challenge changes at 00:00 UTC. The API returns an absolute reset timestamp; the browser renders it as a live `Resets in 4h 18m` countdown, avoiding timezone labels and manual conversion.

Before playing, the landing screen shows only a quiet teaser below the primary play action:

```text
Today's best: 14 rounds · resets in 4h 18m
```

The full leaderboard appears after game over:

```text
Today's Survivors

1. Binary Badger       14
2. Async Axolotl       12
3. Null Narwhal        11
...
27. You                 7

Resets in 4h 18m
```

Leaderboard behaviour:

- Show the top 10 best scores for the current UTC challenge.
- Show the current player's best daily score and rank as a pinned row when they are outside the top 10.
- Keep only the best run per player per day on the board.
- Rank by score descending. Equal scores share a rank; version one has no speed tiebreaker.
- Treat the board as low-stakes entertainment. It carries no prizes or claims of strong cheat resistance.
- Automatically exclude expired days from ordinary queries; historical leaderboards are not exposed.

The server records scores from completed server-tracked runs. The browser cannot submit an arbitrary final score.

## Anonymous Identity

On first visit, the server assigns a random opaque player identifier in an HttpOnly, SameSite cookie. The associated public name is generated from a fixed Code Critter list such as:

- Async Axolotl
- Binary Badger
- Recursive Raccoon
- Null Narwhal
- Segfault Sloth

Names are not editable. A short numeric suffix is added only when the same generated name already appears on that day's board.

The identifier exists only to preserve a daily personal best and pinned rank. It is not an account, is not recoverable across cleared cookies or devices, and stores no email, social handle, or other personal information.

## Sharing on X

The game-over screen contains one secondary `Share on X` action. It opens an X Web Intent; the app does not request X permissions or call the X API.

The prepared post emphasizes Jev's ruling rather than leaderboard status:

```text
I survived 9 rounds of Rules Are Lava 🌋

Jev's ruling got me on: “Sound hopeful without promising success.”
Can you beat 9?

<game URL>
```

The player's response is not inserted into the post. This avoids publishing accidental personal information or abusive text through the game. When the decisive failed rule was deterministic, the copy says `The lava got me on` rather than attributing that verdict to Jev. The post comes from the player's own X account, providing attribution without a handle field in the app.

There is no Reddit-specific copy action in version one.

## User Experience

The product uses one responsive game surface rather than separate marketing and application areas.

### Ready state

- `Rules Are Lava` title.
- One sentence: `A survival writing game refereed by Jev.`
- Primary `Play today's challenge` button.
- Small daily-best teaser and reset countdown.
- A short `How Jev judges` disclosure linking to the technical explanation.

### Playing state

- Score and three-life indicator.
- Four compact rule cards at most.
- Clear visual treatment when an old rule melts.
- One labelled response field with character count.
- 30-second countdown and prominent submit action.
- Keyboard submission support that does not interfere with multiline entry.

### Verdict state

- One row per active rule.
- Plain pass/fail icon and text, never colour alone.
- Jev probability for semantic rules, such as `Pass · 78%`.
- Exact deterministic reason where relevant, such as `5 of 6 words`.
- A short transition into the next round without requiring an extra confirmation click.

### Game-over state

- Final score and local personal-best status.
- Daily top 10 plus the player's pinned position.
- Reset countdown.
- Primary `Play again` action.
- Secondary `Share on X` action.
- Link to the public GitHub repository and explanation of the Jev decision flow.

The visual direction is dark volcanic rock with restrained lava colour used for state and motion. The interface must maintain WCAG AA text contrast, visible focus states, 44-pixel touch targets, reduced-motion support, and an 8-pixel spacing rhythm.

## Architecture

Use one Next.js application for the UI and server endpoints, deployed to Vercel. This matches an existing workspace pattern and keeps the TypeSafe key, game authority, and web interface in one project.

Use Supabase Postgres without Supabase Auth for persistent runs and the daily board. This also matches an existing workspace pattern. All database access occurs server-side; the browser receives no service credential and does not query Supabase directly.

Minimum server surfaces:

- `POST /api/runs` — create a run for today's challenge and return its first rule stack.
- `GET /api/runs/:id` — restore the authoritative run and reconcile an expired round deadline.
- `POST /api/runs/:id/answers` — validate the expected round, evaluate one answer, atomically advance the run, and return the verdict plus next state.
- `GET /api/leaderboard` — return today's best score, top 10, current player's position, and reset timestamp.

Minimum persistent run fields:

- Run identifier.
- Opaque player identifier.
- UTC challenge date.
- Current round index.
- Lives remaining.
- Score.
- Active/completed status.
- Current round deadline.
- Generated Code Critter name.
- Creation and update timestamps.

Player response text is processed in memory and omitted from persistent storage. The answer endpoint requires the client's expected round and advances only if it matches the stored round, preventing duplicate requests from incrementing a run twice.

No cache, queue, realtime subscription, websocket service, analytics SDK, or separate moderation service is required in version one.

## Failure Behaviour

- Jev timeout, malformed response, authentication failure, or network error: keep the run unchanged, restore the submitted text locally, and show `Jev slipped into the lava. Try again.`
- Database failure before state update: keep the round unchanged and allow a retry.
- Duplicate or stale round submission: return the current authoritative run state without applying another score or life change.
- Browser refresh during a run: restore score, lives, round, and rule stack from the server; unsent response text may be restored from session storage.
- Timer expiry: the client sends an explicit timeout result, but the server consumes one life only after its stored deadline has passed. Refreshing or submitting after the deadline performs the same idempotent reconciliation. A retryable Jev failure issues a fresh deadline so infrastructure failure cannot consume the player's remaining time.
- Daily reset during an active run: let that run finish against the challenge date on which it started, but submit it only to that expired day's hidden records; the visible board shows the new challenge.
- Missing identity cookie: issue a new anonymous identity and start fresh rather than attempting account recovery.

## Security and Abuse Boundaries

- Keep the TypeSafe key and Supabase service credentials server-only.
- Validate trimmed response length, run ownership, expected round, rule identifiers, stored deadline, and Jev response shape on the server.
- Use generated leaderboard names only; accept no public free-form profile data.
- Never store or broadcast player responses.
- Add conservative per-player submission throttling backed by the run's expected-round transition. Do not add another infrastructure service solely for rate limiting in version one.
- Escape all displayed strings even though public leaderboard names come from a fixed catalogue.
- Do not trust client timers, scores, lives, rule stacks, or evaluator results.
- Treat cleared cookies, multiple devices, and determined leaderboard cheating as accepted low-stakes limitations until abuse is observed.

## Testing

Keep the game engine as pure functions with focused tests for:

1. The same UTC date produces the same ordered rule sequence.
2. A rule is not duplicated while already active.
3. The active stack never exceeds four rules and melts the oldest rule first.
4. Passing all rules increments score without consuming a life.
5. Any failed rule consumes one life without incrementing score.
6. The run ends at zero lives.
7. Equal leaderboard scores share a rank.
8. Only one best score per player appears each day.

API tests use a fake Jev client and database adapter to verify:

1. Semantic rules are batched into one Jev call per round.
2. Deterministic rules do not require Jev.
3. Invalid probabilities and missing answers do not change run state.
4. Duplicate expected-round submissions do not score twice.
5. A Jev failure leaves the round retryable.
6. Arbitrary client-supplied scores and rules are ignored.

One browser smoke test covers start, pass, fail, game over, leaderboard display, countdown, keyboard use, narrow mobile layout, and reduced motion.

## Success Criteria

- A new visitor can begin the daily challenge without an account or another player.
- The premise and Jev's role are understandable before the first submission.
- Every scored round includes at least one semantic Jev decision.
- Each round performs no more than one Jev request.
- The player can inspect a verdict for every active rule.
- Game and leaderboard state cannot be changed by editing client-side score values.
- No player-authored text or social handle is published by the app.
- The daily board shows the top 10, the player's own rank, and an accurate reset countdown.
- The complete core loop works comfortably on a phone.
- The README clearly explains why Jev is appropriate, what is deterministic code, what Jev evaluates, and how probabilities become verdicts.

## Deferred Until Evidence Supports It

- Private or public multiplayer.
- Verified X handles on leaderboard entries.
- Persistent accounts and cross-device identity.
- Permanent or seasonal rankings.
- Human voting or Jev ruling appeals.
- User-authored rule packs.
- Signed result pages and generated social images.
- Stronger anti-cheat controls.
- More elaborate progression or retention systems.

