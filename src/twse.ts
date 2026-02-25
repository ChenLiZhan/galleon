import type { TwseQuote } from './types.js';

const BASE_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';

interface TwseRawStock {
  c: string; // stock code
  n: string; // stock name
  z: string; // current price ("-" if not traded)
  y: string; // previous close
  o: string; // open
  h: string; // high
  l: string; // low
  v: string; // volume (張)
  t: string; // last trade time (HH:MM:SS)
}

interface TwseResponse {
  msgArray: TwseRawStock[];
  rtcode: string;
}

function parseNumber(val: string): number | null {
  if (!val || val === '-') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

async function fetchFromExchange(
  code: string,
  exchange: 'tse' | 'otc',
): Promise<TwseRawStock | null> {
  const exCh = `${exchange}_${code}.tw`;
  const url = `${BASE_URL}?ex_ch=${exCh}&json=1&delay=0&_=${Date.now()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      headers: {
        Referer: 'https://mis.twse.com.tw/stock/',
        'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as TwseResponse;
    if (data.rtcode !== '0000' || !data.msgArray?.length) return null;

    return data.msgArray[0];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toQuote(raw: TwseRawStock): TwseQuote {
  return {
    code: raw.c,
    name: raw.n,
    price: parseNumber(raw.z),
    previousClose: parseNumber(raw.y) ?? 0,
    open: parseNumber(raw.o),
    high: parseNumber(raw.h),
    low: parseNumber(raw.l),
    volume: Number(raw.v) || 0,
    time: raw.t || '',
  };
}

export async function fetchTwseQuote(code: string): Promise<TwseQuote | null> {
  // Query both TWSE (listed) and TPEx (OTC) in parallel
  const [tseResult, otcResult] = await Promise.allSettled([
    fetchFromExchange(code, 'tse'),
    fetchFromExchange(code, 'otc'),
  ]);

  const tseStock = tseResult.status === 'fulfilled' ? tseResult.value : null;
  if (tseStock) return toQuote(tseStock);

  const otcStock = otcResult.status === 'fulfilled' ? otcResult.value : null;
  if (otcStock) return toQuote(otcStock);

  return null;
}
