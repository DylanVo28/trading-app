export const BTC_COIN = 'BTC' as const;

export interface BtcMarketSnapshot {
  coin: typeof BTC_COIN;
  szDecimals: number;
  maxLeverage: number;
  funding: number;
  openInterest: number;
  prevDayPx: number;
  dayNtlVlm: number;
  oraclePx: number;
  markPx: number;
  midPx: number | null;
}

export type MarketMoveDirection = 'up' | 'down' | 'flat';

export interface BtcMarketMetrics {
  price: number;
  priceChange: number;
  priceChangePercent: number;
  openInterestUsd: number;
  fundingPercent: number;
  direction: MarketMoveDirection;
}

export type MarketDataStatus =
  | 'loading'
  | 'live'
  | 'reconnecting'
  | 'error';

export interface BtcMarketDataState {
  snapshot: BtcMarketSnapshot | null;
  status: MarketDataStatus;
  lastUpdatedAt: number | null;
  error: Error | null;
}

export type HyperliquidMarketDataErrorCode =
  | 'aborted'
  | 'http'
  | 'invalid-response'
  | 'network'
  | 'timeout';

export class HyperliquidMarketDataError extends Error {
  readonly code: HyperliquidMarketDataErrorCode;
  readonly cause?: unknown;

  constructor(
    code: HyperliquidMarketDataErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'HyperliquidMarketDataError';
    this.code = code;
    this.cause = options?.cause;
  }
}
