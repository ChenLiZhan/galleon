# Galleon - LINE Bot

## Tech Stack
- TypeScript (strict mode), Express 5, @line/bot-sdk v10
- ESM modules (`"type": "module"` in package.json)
- pnpm for package management
- ESLint 9 (flat config) + Prettier for linting/formatting

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
- Express error middleware MUST have exactly 4 params `(err, req, res, next)` — prefix unused with `_`
- ESLint 10 has peer dep conflicts with typescript-eslint — stay on ESLint 9
- `eslint-plugin-prettier/recommended` already includes `eslint-config-prettier`, don't add both
