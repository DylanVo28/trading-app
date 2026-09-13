import {
  DEFAULT_BTC_ORDER_BOOK_ROWS,
  MAX_BTC_ORDER_BOOK_ROWS,
  MIN_BTC_ORDER_BOOK_ROWS,
} from './constants';

export function normalizeOrderBookRows(rows: number): number {
  if (!Number.isFinite(rows)) {
    return DEFAULT_BTC_ORDER_BOOK_ROWS;
  }

  const integerRows = Math.trunc(rows);
  return Math.min(
    MAX_BTC_ORDER_BOOK_ROWS,
    Math.max(MIN_BTC_ORDER_BOOK_ROWS, integerRows),
  );
}

