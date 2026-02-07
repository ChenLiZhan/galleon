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
@Bot <user> sell <stock_code> <amount> <price>
```

參數同 `buy`。賣出後均價不變，僅減少持股數量。全部賣出時自動移除該筆記錄。

範例：`@Bot lee sell 2330 5 550`

### `hold` - 查詢持股

```
@Bot <user> hold
```

顯示該使用者的所有持股及均價。

範例：`@Bot lee hold`

### `help` - 顯示指令說明

```
@Bot help
```

列出所有可用指令、格式及範例。

範例：`@Bot help`

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

- **部署平台**：[Render](https://render.com) Free Tier
- **Production URL**：https://galleon-32wd.onrender.com
- **部署方式**：Render 連接 GitHub repo，push 到 `master` 分支後自動觸發部署
- **Build Command**：`pnpm install && pnpm build`
- **Start Command**：`pnpm start`

## 環境變數

| 變數 | 說明 |
|------|------|
| `CHANNEL_SECRET` | LINE Channel Secret |
| `CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google 服務帳號 email |
| `GOOGLE_PRIVATE_KEY` | Google 服務帳號私鑰 |
| `SPREADSHEET_ID` | Google Sheets 文件 ID |
| `PORT` | 伺服器埠號（預設 3000） |

## 開發

```bash
pnpm install
pnpm dev
```

## 部署

```bash
pnpm build
pnpm start
```
