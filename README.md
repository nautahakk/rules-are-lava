# Rules Are Lava

A daily survival game where every answer must obey a growing stack of rules, judged by Jev — [play it here](https://rules-are-lava.vercel.app).

## How Jev is used

Rules that can be checked exactly, such as word counts or forbidden letters, are evaluated in code. Semantic rules are sent together in one System One request to TypeSafe's Jev model. A semantic rule passes when Jev's yes probability is at least `0.50`.

## Privacy

There are no accounts. Each browser receives an anonymous generated name for the daily leaderboard. Submitted response text is evaluated but not stored.

## Local setup

Requires Node.js 24.

```bash
npm install
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Add a TypeSafe API key and the local Supabase URL and service-role key to `.env.local`. The Supabase CLI prints the local values after startup.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Architecture

- [Approved design](docs/superpowers/specs/2026-09-22-rules-are-lava-design.md)
- [Implementation plan](docs/superpowers/plans/2026-09-23-rules-are-lava-v1.md)

## License

[MIT](LICENSE)
