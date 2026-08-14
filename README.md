# Galleon

LINE 聊天機器人，用於追蹤股票持股記錄。在群組中 @mention Bot 即可操作買入、賣出及查詢持股。

## 指令

在群組中 tag Bot 後輸入指令：

### `buy` - 買入股票

```
@Bot <user> buy <stock_code> <amount> <price>
```

| 參數 | 說明 | 範例 |
|------|------|------|
| `user` | 使用者暱稱 | `lee` |
| `stock_code` | 股票代號 | `2330` |
| `amount` | 買入股數（正整數） | `10` |
| `price` | 每股價格（正數） | `500` |

範例：`@Bot lee buy 2330 10 500`

買入時自動以**加權平均**計算均價。

### `sell` - 賣出股票

```
@Bot <user> sell <stock_code> <amount>
```

| 參數 | 說明 | 範例 |
|------|------|------|
| `user` | 使用者暱稱 | `lee` |
| `stock_code` | 股票代號 | `2330` |
| `amount` | 賣出股數（正整數） | `5` |

賣出後均價不變，僅減少持股數量。全部賣出時自動移除該筆記錄。

範例：`@Bot lee sell 2330 5`

### `hold` - 查詢持股

```
@Bot <user> hold
```

顯示該使用者的所有持股及均價，依市場分類（🇹🇼 台股、🇺🇸 美股、🇯🇵 日股）。

範例：`@Bot lee hold`

### 股票代號與市場判斷

買入時會根據股票代號格式自動判斷市場：

| 格式 | 市場 | 範例 |
|------|------|------|
| 純數字 | 🇹🇼 台股 | `2330` |
| 數字 + 字母 | 🇹🇼 台股（ETF） | `00981A` |
| 英文字母 | 🇺🇸 美股 | `AAPL` |
| 數字 + `.T` | 🇯🇵 日股 | `7203.T` |

### `help` - 顯示指令說明

```
@Bot help
```

列出所有可用指令、格式及範例。

範例：`@Bot help`

### 自然語言理解（NLU Fallback）

除了上述結構化指令外，Bot 也支援自然語言輸入。當結構化指令解析失敗時，會自動透過 Ollama LLM 嘗試理解指令意圖。

範例：
- `@Bot lee 買 2330 10股 500元` → 自動解析為 buy 指令
- `@Bot 幫 lee 買入 AAPL 5股 每股150` → 自動解析為 buy 指令
- `@Bot lee 的持股` → 自動解析為 hold 指令

需要 Ollama 服務運行於同一 Docker 網路中。

> ⚠️ **目前 production 未啟用。** Ollama 服務已於 2026-08 從 Oracle 上移除，
> `ChenLiZhan/ollama` repo 也**已從 GitHub 刪除**（不是封存 —— clone 不回來了），
> VM 上沒有 `ollama` container（實測 `docker ps` 只有
> caddy / vaultwarden / galleon）。程式碼路徑仍在（`src/llm.ts`），但
> `http://ollama:11434` 連不到，所以**結構化指令解析失敗時，使用者直接看到
> 「抱歉，無法理解指令」**，上面那些範例都不會生效。
>
> 要恢復這個功能，得在 `web` network 上重新提供一個 Ollama 端點，或把
> `OLLAMA_URL` 指向外部服務。

## Tech Stack

| 類別 | 技術 |
|------|------|
| 語言 | TypeScript (strict mode, ESM) |
| 執行環境 | Node.js >= 22 |
| Web 框架 | Express 5 |
| LINE SDK | @line/bot-sdk v10 |
| 資料儲存 | Google Sheets（via `googleapis` + Service Account JWT） |
| 套件管理 | pnpm 10（via corepack） |
| Lint / Format | ESLint 9 (flat config) + Prettier |
| 開發工具 | tsx (watch mode) |

## CI/CD

- **部署平台**：Oracle Cloud Free Tier VM（Docker Compose）
- **Production URL**：https://galleon.chenlizhan.com
- **Webhook URL**：https://galleon.chenlizhan.com/callback
- **Container Registry**：GHCR (`ghcr.io/chenlizhan/galleon`)
- **部署方式**：Push 到 `master` → GitHub Actions lint + build Docker image → 推到 GHCR → SSH 到 VM pull + restart
- **反向代理**：由 [gateway](../gateway) repo 的 Caddy 統一管理 HTTPS 與路由

## 環境變數

| 變數 | 說明 |
|------|------|
| `CHANNEL_SECRET` | LINE Channel Secret |
| `CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google 服務帳號 email |
| `GOOGLE_PRIVATE_KEY` | Google 服務帳號私鑰 |
| `SPREADSHEET_ID` | Google Sheets 文件 ID |
| `PORT` | 伺服器埠號（預設 3000） |
| `OLLAMA_URL` | Ollama 服務 URL（預設 `http://ollama:11434`） |
| `OLLAMA_MODEL` | Ollama 模型名稱（預設 `qwen2.5:7b`） |

## 開發

```bash
pnpm install
pnpm dev
```

## 部署

### Docker（Production）

VM 上是 **image-based** 部署（與 gateway / sebastian 的「SSH 進去 git pull」不同）：
image 由 GitHub Actions 建好推到 GHCR，VM 只 pull、不 build（節省記憶體，而且 VM 是
ARM，本機 build 很慢）。VM 上的 repo checkout 只用來取 `docker-compose.yml`。

> 前置條件：**`gateway` 必須已經啟動**。`web` network 由它建立，galleon 這邊是
> `external: true`；順序反了會得到 `network web not found`，而那個錯誤訊息不會
>告訴你該先起誰。

#### 首次部署（含整台重建）

```bash
# 1. clone —— deploy key 認證，core.sshCommand 不進版控，必須手動設
cd ~/apps
GIT_SSH_COMMAND="ssh -i ~/.ssh/gh_galleon -o IdentitiesOnly=yes" \
  git clone git@github.com:ChenLiZhan/galleon.git galleon
git -C galleon config core.sshCommand "ssh -i ~/.ssh/gh_galleon -o IdentitiesOnly=yes"

# 2. 取回 .env —— 從 fortress，不要手填（見下方「秘密與備份」）

# 3. 登入 GHCR（image 是 private package，沒登入 pull 會 401）
echo <PAT> | docker login ghcr.io -u <username> --password-stdin

# 4. 啟動
docker compose pull && docker compose up -d
curl -s localhost:3000/health    # 期望 OK
```

第 1 步的 `core.sshCommand` 漏掉的話，之後 CI 的部署會失敗 —— GitHub Actions
的部署步驟第一件事就是 `git pull origin master`。

#### 日常更新

push 到 `master` 即自動部署。手動觸發：`gh workflow run deploy.yml`。

```bash
docker compose pull && docker compose up -d
```

## 秘密與備份

`.env` 不進版控，也不進 CI/CD —— 它只存在於 VM 上的 `~/apps/galleon/.env`。
離機備份在 `ChenLiZhan/fortress`（GitHub private repo），以 age passphrase 加密：

| fortress 檔案 | 還原到 |
|---|---|
| `galleon.env.age` | `~/apps/galleon/.env` |
| `galleon-googlesheets.json.age` | Google service account 金鑰原始檔（見下） |

```bash
git clone git@github.com:ChenLiZhan/fortress.git ~/fortress
age -d -o ~/apps/galleon/.env ~/fortress/galleon.env.age
rm -rf ~/fortress    # 用完即刪，明文不留在 VM 上
```

> `googlesheets.json` 是從 Google Cloud Console 下載的 service account 金鑰原始檔，
> **執行時不需要它** —— 程式走 `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`
> 兩個環境變數（`src/config.ts`），container 也沒有 mount 這個檔。保留它是為了
> 輪替金鑰時能重新抽出那兩個值。**DR 只要有 `.env` 就能把服務跑起來。**

⚠️ **改過 `.env` 之後要同步回 fortress。** 不同步是不會有任何警告的失效：
檔案在、解得開、內容是舊的，還原後 bot 起不來而你會以為備份沒問題。

整台 Oracle 重建的完整順序見 `leeLab` repo 的 `DR.md` 情境 A。

### 為什麼沒有備份腳本

galleon **無本地狀態**，所以刻意不做備份 —— 這是判斷結果，不是遺漏：

- 沒有 volume、沒有資料庫、沒有任何檔案寫入（`src/` 裡完全沒有 `fs` 呼叫）
- 所有持股資料都在 Google Sheets，由 Google 自己保存版本歷史
- container 整個刪掉重 `docker compose up -d`，不會掉任何資料

代價是**資料的存活改成依賴兩個外部帳號**，而這兩者目前都沒有納入 DR 演練：

| 風險 | 現況 |
|---|---|
| Google Sheets 被誤刪 / 改壞 | 只能靠 Google Sheets 內建的版本記錄（未演練） |
| Service account 金鑰被撤銷 | 需重發並更新 `.env` + fortress |

> `SPREADSHEET_ID` 指向的那份試算表是 galleon 唯一的資料庫。搬移或刪除它等同資料遺失。

### 本地直接執行

```bash
pnpm build
pnpm start
```
