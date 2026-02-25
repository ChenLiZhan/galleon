export type Market = 'TW' | 'US' | 'JP';

export interface Holding {
  groupId: string;
  user: string;
  stockCode: string;
  amount: number;
  avgPrice: number;
  market: Market;
  updatedAt: string;
}

export interface TwseQuote {
  name: string;
  code: string;
  price: number | null;
  previousClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number;
  time: string;
}

export type Command =
  | { type: 'buy'; user: string; stockCode: string; amount: number; price: number }
  | { type: 'sell'; user: string; stockCode: string; amount: number }
  | { type: 'hold'; user: string }
  | { type: 'quote'; stockCode: string }
  | { type: 'help' };
