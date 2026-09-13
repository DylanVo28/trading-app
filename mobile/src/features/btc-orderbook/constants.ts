import type { BtcOrderBookAggregation } from './types';

export const BTC_ORDER_BOOK_COIN = 'BTC' as const;
export const DEFAULT_BTC_ORDER_BOOK_AGGREGATION: BtcOrderBookAggregation =
  '5sf-1';
export const DEFAULT_BTC_ORDER_BOOK_ROWS = 15;
export const MIN_BTC_ORDER_BOOK_ROWS = 1;
export const MAX_BTC_ORDER_BOOK_ROWS = 20;

