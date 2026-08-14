# Galleon - LINE Bot

## Tech Stack
- TypeScript (strict mode), Express 5, @line/bot-sdk v10
- ESM modules (`"type": "module"` in package.json)
- pnpm 10 for package management (via corepack, `packageManager` field in package.json)
- ESLint 9 (flat config) + Prettier for linting/formatting
- Google Sheets as data storage (via `googleapis` + Service Account JWT)
- Deploy target: Oracle Cloud Free Tier VM — Docker Compose + GitHub Actions CI/CD
- Production URL: https://galleon.chenlizhan.com
- Reverse proxy: Caddy (managed by `gateway` repo), routes `galleon.chenlizhan.com` → `galleon:3000`

## Commands
- `pnpm dev` - 開發模式 (tsx watch)
- `pnpm build` - TypeScript 編譯到 dist/
- `pnpm lint:fix` - ESLint 自動修正 (含 Prettier formatting)
- `pnpm format` - Prettier 格式化
- 沒有單元測試 — pure-function / regex 邏輯改動可用 `node -e "..."` 跑 ad-hoc 比對表 sanity check（例：用一組案例陣列檢驗 `detectMarket()` 與 quote regex 的輸出）

## Code Conventions
- Single quotes, semicolons, trailing commas, 100 char print width
- Unused variables/args prefixed with `_` (ESLint argsIgnorePattern: `^_`)
- ESM imports require `.js` extension for local modules (e.g., `./config.js`)
- Environment variables managed via `dotenv/config` in `src/config.ts`
- Never create or import unused library/const/object
- Input normalization (uppercase, suffix stripping, etc.) belongs in handler functions before external API calls (e.g., `handleQuote()`), NOT in `parseCommand()` — `Command` objects should faithfully represent user input

## LLM Integration
- LLM inference via shared Ollama service at `http://ollama:11434` (separate `ollama` repo) — used as NLU fallback when `parseCommand()` fails
- LLM module: `src/llm.ts` — `parseNaturalLanguage()` is the public API, returns `Command | null`
- Ollama API: uses `/api/generate` with `stream: false`, model configured via `OLLAMA_MODEL` env var (default `qwen2.5:7b`)
- NLU flow: `parseCommand()` → fails → `parseNaturalLanguage()` → `validateCommand()` runtime schema check → `executeCommand()` or fallback error
- Optional env vars in `config.ts` use `process.env.X ?? 'default'` pattern (not `requireEnv()`), so missing Ollama config won't crash the bot
- Docker log rotation configured: `json-file` driver, `max-size: 10m`, `max-file: 3` — all services must include this to prevent disk exhaustion

## Gotchas
- Docker log rotation configured: `json-file` driver, `max-size: 10m`, `max-file: 3` — all services must include this to prevent disk exhaustion
- Bot command format: `[user] [action] [args...]` (user comes FIRST, e.g., `lee buy 2330 10 500`, `lee sell 2330 10`, `lee hold`)
- `buy` requires price (for avg price calc), `sell` does not — when changing command args, also update `README.md` and `handleHelp()` in `commands.ts`
- Express error middleware MUST have exactly 4 params `(err, req, res, next)` — prefix unused with `_`
- ESLint 10 has peer dep conflicts with typescript-eslint — stay on ESLint 9
- `eslint-plugin-prettier/recommended` already includes `eslint-config-prettier`, don't add both
- `google.auth.JWT` uses options object `{ email, key, scopes }`, NOT positional args
- `GOOGLE_PRIVATE_KEY` env var needs `.replace(/\\n/g, '\n')` — already handled in `src/config.ts`
- LINE SDK v10 mention detection: use `mention.mentionees[].index` + `length` to strip @mention text — MUST check `isSelf === true` to ensure bot is the target (not just any @mention)
- LINE SDK `Mentionee` type narrowing: `MentioneeBase.type` is `string` (not literal), so `m.type === 'user'` won't auto-narrow — use `(m as webhook.UserMentionee).isSelf` with a type predicate
- Google Sheets API: `findRowIndex` must skip header row (slice(1)), row numbers are 1-based for API calls
- Google Sheets API: `findRowIndex` and `getHoldings` filter must both include `row.length >= 7` guard — Sheets API omits trailing empty cells, so short rows cause `undefined` access
- User name matching is case-insensitive (`.toLowerCase()` comparison in `sheets.ts`) — but Sheets stores the original case from first entry (canonical name). When updating existing records in `commands.ts`, use `existing.user` (from Sheets) not `cmd.user` (from input)
- Google Sheets schema change checklist: update `HEADERS` array, all API range strings (e.g., `A:G`), `ensureHeaders()` range, `getHoldings()` filter/map (row indices), `upsertHolding()` rowData array and update range — all in `sheets.ts`
- Market detection: `detectMarket()` in `commands.ts` — pure digits or digits + single letter suffix (e.g., `00981A` 主動式 ETF、`00631L` 槓桿型、`00632R` 反向型)=TW, letters=US, digits+`.T`=JP. stockCode with `.T` suffix is stored as-is in Sheets; TW ETF codes with letter suffix are uppercased in `handleQuote()` before calling TWSE. Adding a new market requires updating `Market` type, `detectMarket()`, `MARKET_HEADERS`, and `MARKET_ORDER`
- Adding a field to `Holding`: update `types.ts` (interface), `sheets.ts` (HEADERS, ranges, row mapping, rowData), and all `upsertHolding()` call sites in `commands.ts`
- Multi-group data isolation: `getSourceId()` in `index.ts` extracts source ID from LINE event (group=`groupId`, room=`roomId`, user=`userId`) — used as `group_id` (column G) in Google Sheets to separate holdings per group
- `executeCommand(command, groupId)` requires `groupId` as second param — all handlers pass it to sheet functions (`getHoldings`, `upsertHolding`, `deleteHolding`, `findRowIndex`)
- Adding a new column to Google Sheets: prefer appending as the LAST column to avoid shifting existing column indices and breaking row index mappings
- pnpm lockfile format changes between major versions — use `corepack use pnpm@<version>` to regenerate
- Dockerfile uses multi-stage build: builder stage compiles TypeScript, production stage only has `dist/` + prod dependencies
- VM 上的 repo 認證用 **per-repo deploy key**（`~/.ssh/gh_galleon`），透過 `.git/config` 的 `core.sshCommand` 綁定，remote 是 SSH URL。不要用 Personal Access Token —— classic PAT 的 `repo` scope 等於帳號下所有 repo 的完整讀寫，且會以明文留在 `.git/config` 和 shell history。⚠️ `core.sshCommand` 不進版控，重新 clone 後必須重設，否則 CI 的 `git pull` 會失敗。注意這跟 workflow 裡的 `secrets.GITHUB_TOKEN`（Actions 內建、用來登入 GHCR）和 `secrets.SSH_PRIVATE_KEY`（Actions → VM）是三個不同的東西
- Docker container runs as non-root user `nodejs` (UID 1001)
- `docker-compose.yml` uses `image: ghcr.io/chenlizhan/galleon:latest` — image 由 GitHub Actions 建置推到 GHCR
- `docker-compose.yml` uses `env_file: .env` to load secrets — `.env` stays on the VM, never in CI/CD
- Container name `galleon` is used as DNS hostname by gateway Caddy — do NOT rename without updating `gateway/Caddyfile`
- 只有兩條路由：`GET /health` 與 `POST /callback`（`src/index.ts`）。**`GET /` 回 404 是正常的**，不是服務掛掉 —— 判斷死活一律用 `/health`（compose healthcheck 與 Caddy upstream 都打它）。拿根路徑當存活訊號會得到假警報或假安心，這條教訓已寫進 `leeLab/RUNBOOK.md` 的新增服務 checklist
- `web` network 是 `external: true` —— **由 `gateway` repo 的 compose 建立**（`name: web, driver: bridge`）。gateway 沒起，galleon `docker compose up` 會直接死在 `network web not found`，而那個錯誤訊息不會告訴你該先起誰
- CI/CD (`.github/workflows/deploy.yml`): lint → build + push Docker image to GHCR → SSH to VM for `docker compose pull` + `docker compose up -d`
- GitHub Actions Secrets needed: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (GHCR auth uses built-in `GITHUB_TOKEN`, no extra secret needed)
- VM 首次部署需要先登入 GHCR: `echo <PAT> | docker login ghcr.io -u <username> --password-stdin`
- CI/CD 只 build `linux/arm64`（VM 是 Oracle Cloud Ampere ARM）。原本 QEMU 模擬 amd64 會在 pnpm install 階段 SIGILL 卡死，所以拿掉了。若換 x86 VM 需改 `.github/workflows/deploy.yml` 的 `platforms`
- Changing bot command **syntax/parsing** (args, new command type): also update few-shot examples in `SYSTEM_PROMPT` in `src/llm.ts`, `handleHelp()` in `commands.ts`, and `README.md`. Changing only **output rendering** (line format, sort order, added fields in reply text) doesn't require those — SYSTEM_PROMPT is input-only, handleHelp describes command syntax not output, README descriptions are high-level
- Adding a new Command type: update `Command` union in `types.ts`, `parseCommand()` detection in `commands.ts`, `executeCommand()` switch + handler in `commands.ts`, `SYSTEM_PROMPT` few-shot examples in `llm.ts`, `validateCommand()` in `llm.ts`, `handleHelp()` in `commands.ts`, and `README.md`
- Not all commands need `groupId`/`user` — stateless commands like `quote` and `help` can ignore the `groupId` param in `executeCommand()`
- Stock quote feature: `src/twse.ts` calls TWSE MIS API (`mis.twse.com.tw/stock/api/getStockInfo.jsp`) — no API key needed, but has implicit rate limit (~3 req/5s). Request headers need `Referer: https://mis.twse.com.tw/stock/`
- TWSE API: response field `z` (current price) is `"-"` during non-trading hours — always use `parseNumber()` (not `Number()`) to avoid NaN propagation. `previousClose` (`y` field) can also be `"-"`
- TWSE API: stock codes don't distinguish listed (上市 tse) vs OTC (上櫃 otc) — `fetchTwseQuote()` queries both in parallel via `Promise.allSettled`, prefers tse result
- TWSE API: invalid stock codes still return `rtcode: '0000'` with non-empty `msgArray` but empty field values — must validate `stock.n` (name) is non-empty in `fetchFromExchange()` to detect non-existent stocks
- Quote command detection: `/^\d{4,6}[A-Z]?$/i` in `parseCommand()` — single token of 4-6 digits (optionally followed by a single letter for ETF codes like `00981A`) triggers quote. This runs BEFORE user/action parsing, so won't conflict with `[user] [action]` commands
- Extending quote to US/JP stocks: add new API module (e.g., `src/yahoo.ts`), update `parseCommand()` pattern, `validateCommand()` regex, `SYSTEM_PROMPT`, and `handleQuote()` to dispatch by `detectMarket()`
- `validateCommand()` in `src/llm.ts` mirrors `parseCommand()` validation rules — if validation rules change in `commands.ts`, update `llm.ts` too
- Ollama cold start: first request after model unload takes extra time (~10-30s) for model loading — 30s timeout configured in `generateCompletion()`
- ⚠️ **Ollama NLU fallback 在 production 是死的**：`ollama` container 已從 Oracle 移除，`ChenLiZhan/ollama` repo 也**已從 GitHub 刪除**（不是封存，clone 不回來；2026-08，實測 `docker ps` 只有 caddy / vaultwarden / galleon）。要恢復得自己重建一個 Ollama 部署。`src/llm.ts` 的程式碼路徑還在且仍會被呼叫，但一定失敗 → 使用者看到「抱歉，無法理解指令」。改動 `parseCommand()` 時**不要假設有 LLM 兜底**
- Google Sheets 認證走 `.env` 的 `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`（`google.auth.JWT`），**不是**讀 `googlesheets.json`。那個檔只是金鑰原始檔（`.gitignore` 有擋、備份在 fortress），container 沒有 mount 它 —— 別依賴它存在
- **OCI egress 會間歇性中斷**，Google API 呼叫因此有兩層對策，改動時別當多餘程式碼刪掉：
  1. `src/sheets.ts` 每 60s 背景 `auth.getAccessToken()` 保溫。JWT 只在到期前 5 分鐘才自動換新，若剛好撞上斷線，使用者的請求會卡在 `oauth2.googleapis.com`；heartbeat 讓那 5 分鐘內有約 5 次重試機會。用 `.unref()` 所以不會擋住 process 結束
  2. `src/index.ts` 的 `executeWithRetry()` 對 `ETIMEDOUT` / `ENOTFOUND` / `EAI_AGAIN` 重試一次（間隔 2s），失敗才回「🌐 網路忙線中」；非網路錯誤直接回「系統錯誤」—— 兩種訊息刻意分開，使用者才知道該不該重試
- `renovate.json` 的 timezone 是 `Asia/Taipei`，但 VM 在東京（Sebastian 用 `Asia/Tokyo`）。兩邊都排週一早上，實務上沒差別；要調時間的話以 Tokyo 為準
- **galleon 無本地狀態，刻意不做備份**（沒有 volume、`src/` 完全沒有 `fs` 呼叫），資料全在 Google Sheets。它不在 `leeLab/SERVICES.md` 的備份表裡是判斷結果，不是遺漏 —— 理由與殘餘風險見 README 的「為什麼沒有備份腳本」
- VM path: `~/apps/galleon`

## leeLab 契約

本 repo 被 meta repo **`leeLab`**（`~/apps/leeLab`，private）索引。leeLab 只放**索引**不放定義，
所以這裡的定義改了它不會自己知道。下列改動必須在**同一次變更**裡一起做完——
事後補的成功率是零，因為那時你已經不記得改了哪些欄位。

| 你改了 | 就要同步 |
|---|---|
| `docker-compose.yml` 的 port / container name / image | `leeLab/SERVICES.md` Oracle 服務表（container name 同時是 Caddy upstream DNS） |
| 對外域名（連帶 `Gateway/Caddyfile`） | `leeLab/SERVICES.md` Oracle 服務表 |
| `.github/workflows/deploy.yml` 的流程（GHCR、平台、部署動作） | `leeLab/SERVICES.md` 部署管線表 |
| 新增外部依賴（目前是 Google Sheets API + LINE Messaging API） | `leeLab/SERVICES.md` 的「galleon 外部依賴」那行 |
| VM 上的 `.env` / service account 金鑰 | `fortress/galleon.env.age`、`fortress/galleon-googlesheets.json.age` |
| **開始有本地狀態**（volume、寫檔、DB） | 這條最重要：`leeLab/SERVICES.md` 備份表 + 寫備份腳本 + 加進 `leeLab/scripts/verify-backup.sh` 的 target 與 `leelab-verify@.timer` 的 instance |
| 服務下線 | `leeLab/SERVICES.md` 的**四張表**（服務清單／排程總表／部署管線／備份）逐一移除，加上 `DR.md` 與 `fortress`。照 `leeLab/CHECKLISTS/decommission.md` 走 |

「galleon 無備份」目前是**判斷結果不是遺漏**（無 volume、`src/` 無 `fs` 呼叫，資料全在 Google Sheets），
`leeLab/SERVICES.md` 的備份表也是照這個前提寫的。哪天加了狀態卻沒同步，那張表就會從
「刻意不備份」悄悄變成「以為有備份」——沒有任何告警會提醒你。

驗收：`~/apps/leeLab/scripts/check-drift.sh oracle`
