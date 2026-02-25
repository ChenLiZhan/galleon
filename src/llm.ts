import { config } from './config.js';
import type { Command } from './types.js';

const SYSTEM_PROMPT = `你是股票指令解析器。將使用者的自然語言轉換為結構化 JSON 指令。

支援的指令類型與格式：
1. buy - {"type":"buy","user":"名稱","stockCode":"代號","amount":數量,"price":價格}
2. sell - {"type":"sell","user":"名稱","stockCode":"代號","amount":數量}
3. hold - {"type":"hold","user":"名稱"}
4. quote - {"type":"quote","stockCode":"代號"}（查詢股票即時報價，stockCode 為台股純數字代號）
5. help - {"type":"help"}

股票代號規則：純數字(2330)=台股、英文(AAPL)=美股、數字.T(7203.T)=日股

範例：
「lee 買 2330 10股 500元」→ {"type":"buy","user":"lee","stockCode":"2330","amount":10,"price":500}
「幫 john 買入 AAPL 5股 每股150」→ {"type":"buy","user":"john","stockCode":"AAPL","amount":5,"price":150}
「alice 賣掉 2330 20股」→ {"type":"sell","user":"alice","stockCode":"2330","amount":20}
「bob 的持股」→ {"type":"hold","user":"bob"}
「查 2330」→ {"type":"quote","stockCode":"2330"}
「台積電股價」→ {"type":"quote","stockCode":"2330"}
「說明」→ {"type":"help"}

只回傳 JSON，不要任何解釋。無法解析則回傳 {"type":"error"}。`;

async function generateCompletion(userInput: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${config.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: `${SYSTEM_PROMPT}\n\n「${userInput}」→ `,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 128,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status}`);
    }

    const data = (await res.json()) as { response?: string };
    return data.response ?? '';
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{(?:[^{}]|\{[^{}]*\})*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('No valid JSON found in LLM response');
  }
}

function validateCommand(obj: unknown): Command | null {
  if (!obj || typeof obj !== 'object' || !('type' in obj)) return null;

  const cmd = obj as Record<string, unknown>;

  if (cmd.type === 'help') return { type: 'help' };

  if (
    cmd.type === 'buy' &&
    typeof cmd.user === 'string' &&
    typeof cmd.stockCode === 'string' &&
    cmd.user.trim() !== '' &&
    cmd.stockCode.trim() !== '' &&
    typeof cmd.amount === 'number' &&
    typeof cmd.price === 'number' &&
    cmd.amount > 0 &&
    Number.isInteger(cmd.amount) &&
    cmd.price > 0
  ) {
    return {
      type: 'buy',
      user: cmd.user.trim(),
      stockCode: cmd.stockCode.trim(),
      amount: cmd.amount,
      price: cmd.price,
    };
  }

  if (
    cmd.type === 'sell' &&
    typeof cmd.user === 'string' &&
    typeof cmd.stockCode === 'string' &&
    cmd.user.trim() !== '' &&
    cmd.stockCode.trim() !== '' &&
    typeof cmd.amount === 'number' &&
    cmd.amount > 0 &&
    Number.isInteger(cmd.amount)
  ) {
    return {
      type: 'sell',
      user: cmd.user.trim(),
      stockCode: cmd.stockCode.trim(),
      amount: cmd.amount,
    };
  }

  if (cmd.type === 'hold' && typeof cmd.user === 'string' && cmd.user.trim() !== '') {
    return { type: 'hold', user: cmd.user.trim() };
  }

  if (
    cmd.type === 'quote' &&
    typeof cmd.stockCode === 'string' &&
    /^\d{4,6}$/.test(cmd.stockCode.trim())
  ) {
    return { type: 'quote', stockCode: cmd.stockCode.trim() };
  }

  return null;
}

export async function parseNaturalLanguage(text: string): Promise<Command | null> {
  try {
    const response = await generateCompletion(text);
    const obj = extractJson(response);
    return validateCommand(obj);
  } catch (err) {
    console.error('[LLM] Parse failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
