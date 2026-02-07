import { getHoldings, upsertHolding, deleteHolding } from './sheets.js';
import type { Command } from './types.js';

export function parseCommand(text: string): Command | string {
  const parts = text.trim().split(/\s+/);
  const user = parts[0];
  const action = parts[1]?.toLowerCase();

  if (!user) {
    return `格式錯誤，請輸入指令，可用指令：buy、sell、hold`;
  }

  if (action === 'buy' || action === 'sell') {
    if (parts.length < 5) {
      return `格式錯誤，正確格式：[user] ${action} [stock_code] [amount] [price]`;
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

    return { type: action, user, stockCode, amount, price };
  }

  if (action === 'hold') {
    return { type: 'hold', user };
  }

  return `未知指令「${action}」，可用指令：buy、sell、hold`;
}

export async function executeCommand(command: Command): Promise<string> {
  switch (command.type) {
    case 'buy':
      return handleBuy(command);
    case 'sell':
      return handleSell(command);
    case 'hold':
      return handleHold(command.user);
  }
}

async function handleBuy(cmd: Command & { type: 'buy' }): Promise<string> {
  const holdings = await getHoldings(cmd.user);
  const existing = holdings.find((h) => h.stockCode === cmd.stockCode);

  const now = new Date().toISOString().slice(0, 10);

  if (existing) {
    const totalCost = existing.amount * existing.avgPrice + cmd.amount * cmd.price;
    const totalAmount = existing.amount + cmd.amount;
    const newAvgPrice = Math.round((totalCost / totalAmount) * 100) / 100;

    await upsertHolding({
      user: cmd.user,
      stockCode: cmd.stockCode,
      amount: totalAmount,
      avgPrice: newAvgPrice,
      updatedAt: now,
    });

    return (
      `買入成功！\n` +
      `${cmd.user} 買入 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
      `持有：${totalAmount}股，均價：${newAvgPrice}`
    );
  }

  await upsertHolding({
    user: cmd.user,
    stockCode: cmd.stockCode,
    amount: cmd.amount,
    avgPrice: cmd.price,
    updatedAt: now,
  });

  return (
    `買入成功！\n` +
    `${cmd.user} 買入 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
    `持有：${cmd.amount}股，均價：${cmd.price}`
  );
}

async function handleSell(cmd: Command & { type: 'sell' }): Promise<string> {
  const holdings = await getHoldings(cmd.user);
  const existing = holdings.find((h) => h.stockCode === cmd.stockCode);

  if (!existing) {
    return `${cmd.user} 沒有持有 ${cmd.stockCode}`;
  }

  if (cmd.amount > existing.amount) {
    return `賣出失敗！${cmd.user} 只持有 ${cmd.stockCode} ${existing.amount}股，無法賣出 ${cmd.amount}股`;
  }

  const remainingAmount = existing.amount - cmd.amount;
  const now = new Date().toISOString().slice(0, 10);

  if (remainingAmount === 0) {
    await deleteHolding(cmd.user, cmd.stockCode);
    return (
      `賣出成功！\n` +
      `${cmd.user} 賣出 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
      `已全部賣出`
    );
  }

  await upsertHolding({
    user: cmd.user,
    stockCode: cmd.stockCode,
    amount: remainingAmount,
    avgPrice: existing.avgPrice,
    updatedAt: now,
  });

  return (
    `賣出成功！\n` +
    `${cmd.user} 賣出 ${cmd.stockCode} ${cmd.amount}股 @${cmd.price}\n` +
    `剩餘：${remainingAmount}股，均價：${existing.avgPrice}`
  );
}

async function handleHold(user: string): Promise<string> {
  const holdings = await getHoldings(user);

  if (holdings.length === 0) {
    return `${user} 目前沒有持股`;
  }

  const lines = holdings.map((h) => `${h.stockCode}：${h.amount}股，均價 ${h.avgPrice}`);

  return `${user} 的持股：\n${lines.join('\n')}`;
}
