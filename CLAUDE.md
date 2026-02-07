# Galleon - LINE Bot

## Tech Stack
- TypeScript (strict mode), Express 5, @line/bot-sdk v10
- ESM modules (`"type": "module"` in package.json)
- pnpm 10 for package management (via corepack, `packageManager` field in package.json)
- ESLint 9 (flat config) + Prettier for linting/formatting
- Google Sheets as data storage (via `googleapis` + Service Account JWT)
- Deploy target: Render Free Tier — auto-deploy on push to `master`
- Production URL: https://galleon-32wd.onrender.com
- Render build: `pnpm install && pnpm build`, start: `pnpm start`

## Commands
- `pnpm dev` - 開發模式 (tsx watch)
- `pnpm build` - TypeScript 編譯到 dist/
- `pnpm lint:fix` - ESLint 自動修正 (含 Prettier formatting)
- `pnpm format` - Prettier 格式化

## Code Conventions
- Single quotes, semicolons, trailing commas, 100 char print width
- Unused variables/args prefixed with `_` (ESLint argsIgnorePattern: `^_`)
- ESM imports require `.js` extension for local modules (e.g., `./config.js`)
- Environment variables managed via `dotenv/config` in `src/config.ts`
- Never create or import unused library/const/object

## Gotchas
- Bot command format: `[user] [action] [args...]` (user comes FIRST, e.g., `lee buy 2330 10 500`, `lee sell 2330 10`, `lee hold`)
- `buy` requires price (for avg price calc), `sell` does not — when changing command args, also update `README.md` and `handleHelp()` in `commands.ts`
- Express error middleware MUST have exactly 4 params `(err, req, res, next)` — prefix unused with `_`
- ESLint 10 has peer dep conflicts with typescript-eslint — stay on ESLint 9
- `eslint-plugin-prettier/recommended` already includes `eslint-config-prettier`, don't add both
- `google.auth.JWT` uses options object `{ email, key, scopes }`, NOT positional args
- `GOOGLE_PRIVATE_KEY` env var needs `.replace(/\\n/g, '\n')` — already handled in `src/config.ts`
- LINE SDK v10 mention detection: use `mention.mentionees[].index` + `length` to strip @mention text
- Google Sheets API: `findRowIndex` must skip header row (slice(1)), row numbers are 1-based for API calls
- Google Sheets schema change checklist: update `HEADERS` array, all API range strings (e.g., `A:F`), `ensureHeaders()` range, `getHoldings()` filter/map (row indices), `upsertHolding()` rowData array and update range — all in `sheets.ts`
- Market detection: `detectMarket()` in `commands.ts` — pure digits=TW, letters=US, digits+`.T`=JP. Adding a new market requires updating `Market` type, `detectMarket()`, `MARKET_HEADERS`, and `MARKET_ORDER`
- Adding a field to `Holding`: update `types.ts` (interface), `sheets.ts` (HEADERS, ranges, row mapping, rowData), and all `upsertHolding()` call sites in `commands.ts`
- pnpm lockfile format changes between major versions — use `corepack use pnpm@<version>` to regenerate
