export const BTC_CHART_INTERVALS = ['5m', '1h', '1d'] as const;

export type BtcChartInterval = (typeof BTC_CHART_INTERVALS)[number];

export interface BtcCandle {
  readonly openTime: number;
  readonly closeTime: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
  readonly tradeCount: number;
}

export type BtcChartDataStatus =
  | 'loading'
  | 'live'
  | 'reconnecting'
  | 'error';

export interface BtcChartDataState {
  readonly candles: readonly BtcCandle[];
  readonly status: BtcChartDataStatus;
  readonly lastUpdatedAt: number | null;
  readonly error: Error | null;
}

export type BtcCandleDataErrorCode =
  | 'aborted'
  | 'http'
  | 'invalid-response'
  | 'network'
  | 'timeout';

export class BtcCandleDataError extends Error {
  readonly code: BtcCandleDataErrorCode;
  readonly cause?: unknown;

  constructor(
    code: BtcCandleDataErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = 'BtcCandleDataError';
    this.code = code;
    this.cause = options?.cause;
  }
}
