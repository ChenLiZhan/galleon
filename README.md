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
| 數字 + `.TW` | 🇹🇼 台股（明確指定） | `2330.TW` |
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

```bash
# 首次部署
cp .env.example .env
nano .env  # 填入實際環境變數
docker compose pull
docker compose up -d

# 更新部署（或透過 GitHub Actions 自動觸發）
docker compose pull
docker compose up -d
```

Docker image 由 GitHub Actions 建置並推送到 GHCR，VM 上不做 build（節省記憶體）。

### 本地直接執行

```bash
pnpm build
pnpm start
```
