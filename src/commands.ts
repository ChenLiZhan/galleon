import { getHoldings, upsertHolding, deleteHolding } from './sheets.js';
import { fetchTwseQuote } from './twse.js';
import type { Command, Holding, Market, TwseQuote } from './types.js';

function detectMarket(stockCode: string): Market {
  if (/^\d+\.T$/i.test(stockCode)) return 'JP';
  if (/^\d+$/.test(stockCode)) return 'TW';
  return 'US';
}

export function parseCommand(text: string): Command | string {
  const parts = text.trim().split(/\s+/);

  if (parts[0]?.toLowerCase() === 'help') {
    return { type: 'help' };
  }

  // Single token matching TW stock code pattern → quote command
  if (parts.length === 1 && /^\d{4,6}$/.test(parts[0])) {
    return { type: 'quote', stockCode: parts[0] };
  }

  const user = parts[0];
  const action = parts[1]?.toLowerCase();

  if (!user) {
    return `格式錯誤，請輸入指令，可用指令：buy、sell、hold、help`;
  }

  if (action === 'buy') {
    if (parts.length < 5) {
      return `格式錯誤，正確格式：[user] buy [stock_code] [amount] [price]`;
    }
    const [, , stockCode, amountStr, priceStr] = parts;
    const amount = Number(amountStr);
    const price = Number(priceStr);

    if (!stockCode) {
      return `請提供 stock_code`;
    }
    if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return `amount 必須是正整數`;
    }
    if (isNaN(price) || price <= 0) {
      return `price 必須是正數`;
    }

    return { type: 'buy', user, stockCode, amount, price };
  }

  if (action === 'sell') {
    if (parts.length < 4) {
      return `格式錯誤，正確格式：[user] sell [stock_code] [amount]`;
    }
    const [, , stockCode, amountStr] = parts;
    const amount = Number(amountStr);

    if (!stockCode) {
      return `請提供 stock_code`;
    }
    if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return `amount 必須是正整數`;
    }

    return { type: 'sell', user, stockCode, amount };
  }

  if (action === 'hold') {
    return { type: 'hold', user };
  }

  return `未知指令「${action}」，可用指令：buy、sell、hold、help`;
}

export async function executeCommand(command: Command, groupId: string): Promise<string> {
  switch (command.type) {
    case 'buy':
      return handleBuy(command, groupId);
    case 'sell':
      return handleSell(command, groupId);
    case 'hold':
      return handleHold(command.user, groupId);
    case 'quote':
      return handleQuote(command.stockCode);
    case 'help':
      return handleHelp();
  }
}

async function handleBuy(cmd: Command & { type: 'buy' }, groupId: string): Promise<string> {
  const holdings = await getHoldings(cmd.user, groupId);
  const existing = holdings.find((h) => h.stockCode === cmd.stockCode);

  const now = new Date().toISOString().slice(0, 10);

  if (existing) {
    const totalCost = existing.amount * existing.avgPrice + cmd.amount * cmd.price;
    const totalAmount = existing.amount + cmd.amount;
    const newAvgPrice = Math.round((totalCost / totalAmount) * 100) / 100;

    await upsertHolding({
      groupId,
      user: existing.user,
      stockCode: cmd.stockCode,
      amount: totalAmount,
      avgPrice: newAvgPrice,
      market: existing.market,
      updatedAt: now,
    });

    return (
      `成功！\n` +
      `${existing.user} 買入 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
      `持有：${totalAmount}股，均價：${newAvgPrice}`
    );
  }

  await upsertHolding({
    groupId,
    user: cmd.user,
    stockCode: cmd.stockCode,
    amount: cmd.amount,
    avgPrice: cmd.price,
    market: detectMarket(cmd.stockCode),
    updatedAt: now,
  });

  return (
    `成功！\n` +
    `${cmd.user} 買入 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
    `持有：${cmd.amount}股，均價：${cmd.price}`
  );
}

async function handleSell(cmd: Command & { type: 'sell' }, groupId: string): Promise<string> {
  const holdings = await getHoldings(cmd.user, groupId);
  const existing = holdings.find((h) => h.stockCode === cmd.stockCode);

  if (!existing) {
    return `${cmd.user} 沒有持有 ${cmd.stockCode}`;
  }

  if (cmd.amount > existing.amount) {
    return `賣出失敗！${existing.user} 只持有 ${cmd.stockCode} ${existing.amount}股，無法賣出 ${cmd.amount}股`;
  }

  const remainingAmount = existing.amount - cmd.amount;
  const now = new Date().toISOString().slice(0, 10);

  if (remainingAmount === 0) {
    await deleteHolding(existing.user, cmd.stockCode, groupId);
    return `成功！\n${existing.user} 賣出 ${cmd.stockCode} ${cmd.amount}股\n已全部賣出`;
  }

  await upsertHolding({
    groupId,
    user: existing.user,
    stockCode: cmd.stockCode,
    amount: remainingAmount,
    avgPrice: existing.avgPrice,
    market: existing.market,
    updatedAt: now,
  });

  return (
    `成功！\n` +
    `${existing.user} 賣出 ${cmd.stockCode} ${cmd.amount}股\n` +
    `剩餘：${remainingAmount}股，均價：${existing.avgPrice}`
  );
}

const MARKET_HEADERS: Record<Market, string> = {
  TW: '🇹🇼 台股',
  US: '🇺🇸 美股',
  JP: '🇯🇵 日股',
};

const MARKET_ORDER: Market[] = ['TW', 'US', 'JP'];

async function handleHold(user: string, groupId: string): Promise<string> {
  const holdings = await getHoldings(user, groupId);

  if (holdings.length === 0) {
    return `${user} 目前沒有持股`;
  }

  const canonicalUser = holdings[0].user;

  const byMarket = new Map<Market, Holding[]>();
  for (const h of holdings) {
    const group = byMarket.get(h.market) ?? [];
    group.push(h);
    byMarket.set(h.market, group);
  }

  const sections: string[] = [];
  for (const market of MARKET_ORDER) {
    const group = byMarket.get(market);
    if (!group) continue;
    const lines = group.map((h) => `  ${h.stockCode}：${h.amount}股，均價 ${h.avgPrice}`);
    sections.push(`${MARKET_HEADERS[market]}\n${lines.join('\n')}`);
  }

  return `${canonicalUser} 的持股：\n\n${sections.join('\n\n')}`;
}

function formatQuote(quote: TwseQuote): string {
  const price = quote.price ?? quote.previousClose;
  const diff = quote.price != null ? quote.price - quote.previousClose : 0;
  const diffPercent =
    quote.previousClose > 0 ? ((diff / quote.previousClose) * 100).toFixed(2) : '0.00';
  const sign = diff > 0 ? '+' : '';
  const arrow = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➖';

  const lines = [
    `${quote.name}（${quote.code}）`,
    `${arrow} ${price} ${sign}${diff.toFixed(2)}（${sign}${diffPercent}%）`,
  ];

  if (quote.price == null) {
    lines.push('⏸ 目前非交易時間，顯示昨收價');
  }

  return lines.join('\n');
}

async function handleQuote(stockCode: string): Promise<string> {
  const quote = await fetchTwseQuote(stockCode);
  if (!quote) {
    return `找不到股票代號 ${stockCode}，請確認是否為有效的台股代號`;
  }
  return formatQuote(quote);
}

function handleHelp(): string {
  return [
    '📋 可用指令一覽',
    '',
    '▸ buy — 買入股票',
    '  格式：[user] buy [股票代號] [數量] [價格]',
    '  範例：lee buy 2330 10 500',
    '',
    '▸ sell — 賣出股票',
    '  格式：[user] sell [股票代號] [數量]',
    '  範例：lee sell 2330 5',
    '',
    '▸ hold — 查詢持股（依市場分類）',
    '  格式：[user] hold',
    '  範例：lee hold',
    '',
    '▸ [股票代號] — 查詢台股即時報價',
    '  格式：[股票代號]',
    '  範例：2330',
    '',
    '▸ help — 顯示此說明',
    '  格式：help',
    '',
    '📌 股票代號與市場判斷',
    '  純數字（2330）→ 🇹🇼 台股',
    '  英文（AAPL）→ 🇺🇸 美股',
    '  數字.T（7203.T）→ 🇯🇵 日股',
  ].join('\n');
}
