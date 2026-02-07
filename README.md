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
| `user` | 使用者暱稱 | `leo` |
| `stock_code` | 股票代號 | `2330` |
| `amount` | 買入股數（正整數） | `10` |
| `price` | 每股價格（正數） | `500` |

範例：`@Bot leo buy 2330 10 500`

買入時自動以**加權平均**計算均價。

### `sell` - 賣出股票

```
@Bot <user> sell <stock_code> <amount> <price>
```

參數同 `buy`。賣出後均價不變，僅減少持股數量。全部賣出時自動移除該筆記錄。

範例：`@Bot leo sell 2330 5 550`

### `hold` - 查詢持股

```
@Bot <user> hold
```

顯示該使用者的所有持股及均價。

範例：`@Bot leo hold`

## Tech Stack

- TypeScript, Express 5, @line/bot-sdk v10
- Google Sheets 作為資料儲存
- Render Free Tier 部署

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
