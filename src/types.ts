export interface Holding {
  user: string;
  stockCode: string;
  amount: number;
  avgPrice: number;
  updatedAt: string;
}

export type Command =
  | { type: 'buy'; user: string; stockCode: string; amount: number; price: number }
  | { type: 'sell'; user: string; stockCode: string; amount: number }
  | { type: 'hold'; user: string }
  | { type: 'help' };
