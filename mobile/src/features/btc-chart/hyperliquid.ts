import {
  BTC_CHART_COIN,
  BTC_CHART_HISTORY_LIMIT,
  BTC_CHART_INTERVAL_DURATION_MS,
  BTC_CHART_REST_TIMEOUT_MS,
  HYPERLIQUID_INFO_URL,
} from './constants';
import {
  BtcCandleDataError,
  type BtcCandle,
  type BtcChartInterval,
} from './types';

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'json' | 'ok' | 'status'>>;

export interface FetchBtcCandlesOptions {
  readonly fetchImpl?: FetchLike;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

interface CandleSnapshotRequest {
  readonly type: 'candleSnapshot';
  readonly req: {
    readonly coin: typeof BTC_CHART_COIN;
    readonly interval: BtcChartInterval;
    readonly startTime: number;
    readonly endTime: number;
  };
}

export async function fetchBtcCandles(
  interval: BtcChartInterval,
  options: FetchBtcCandlesOptions = {},
): Promise<readonly BtcCandle[]> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? BTC_CHART_REST_TIMEOUT_MS;
  let didTimeout = false;

  const onExternalAbort = (): void => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  if (options.signal?.aborted) {
    controller.abort(options.signal.reason);
  }

  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(HYPERLIQUID_INFO_URL, {
      body: JSON.stringify(createCandleSnapshotRequest(interval)),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BtcCandleDataError(
        'http',
        `Hyperliquid candle request failed with HTTP ${response.status}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error: unknown) {
      throw new BtcCandleDataError(
        'invalid-response',
        'Hyperliquid returned invalid candle JSON.',
        { cause: error },
      );
    }

    return parseBtcCandleSnapshot(payload, interval);
  } catch (error: unknown) {
    if (error instanceof BtcCandleDataError) {
      throw error;
    }

    if (didTimeout) {
      throw new BtcCandleDataError(
        'timeout',
        `Hyperliquid candle request timed out after ${timeoutMs}ms.`,
        { cause: error },
      );
    }

    if (controller.signal.aborted) {
      throw new BtcCandleDataError(
        'aborted',
        'Hyperliquid candle request was aborted.',
        { cause: error },
      );
    }

    throw new BtcCandleDataError(
      'network',
      'Unable to load Hyperliquid BTC candles.',
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export function createCandleSnapshotRequest(
  interval: BtcChartInterval,
  endTime = Date.now(),
): CandleSnapshotRequest {
  const normalizedEndTime = parseTimestamp(endTime, 'endTime');
  const startTime = Math.max(
    0,
    normalizedEndTime -
      BTC_CHART_INTERVAL_DURATION_MS[interval] * BTC_CHART_HISTORY_LIMIT,
  );

  return {
    type: 'candleSnapshot',
    req: {
      coin: BTC_CHART_COIN,
      interval,
      startTime,
      endTime: normalizedEndTime,
    },
  };
}

export function parseBtcCandleSnapshot(
  payload: unknown,
  interval: BtcChartInterval,
): readonly BtcCandle[] {
  if (!Array.isArray(payload)) {
    throw invalidResponse('Expected an array of candles.');
  }

  const candlesByOpenTime = new Map<number, BtcCandle>();
  payload.forEach((item, index) => {
    const candle = parseCandle(item, interval, index);
    candlesByOpenTime.set(candle.openTime, candle);
  });

  return Array.from(candlesByOpenTime.values())
    .sort((left, right) => left.openTime - right.openTime)
    .slice(-BTC_CHART_HISTORY_LIMIT);
}

function parseCandle(
  value: unknown,
  interval: BtcChartInterval,
  index: number,
): BtcCandle {
  if (!isRecord(value)) {
    throw invalidResponse(`candles[${index}] must be an object.`);
  }

  if (value.s !== BTC_CHART_COIN) {
    throw invalidResponse(`candles[${index}].s must be BTC.`);
  }
  if (value.i !== interval) {
    throw invalidResponse(
      `candles[${index}].i must match interval ${interval}.`,
    );
  }

  const openTime = parseTimestamp(value.t, `candles[${index}].t`);
  const closeTime = parseTimestamp(value.T, `candles[${index}].T`);
  const open = parsePositiveWireNumber(value.o, `candles[${index}].o`);
  const high = parsePositiveWireNumber(value.h, `candles[${index}].h`);
  const low = parsePositiveWireNumber(value.l, `candles[${index}].l`);
  const close = parsePositiveWireNumber(value.c, `candles[${index}].c`);
  const volume = parseNonNegativeWireNumber(
    value.v,
    `candles[${index}].v`,
  );
  const tradeCount = parseNonNegativeInteger(
    value.n,
    `candles[${index}].n`,
  );

  if (closeTime < openTime) {
    throw invalidResponse(
      `candles[${index}].T must not be earlier than its open time.`,
    );
  }
  if (high < Math.max(open, close)) {
    throw invalidResponse(
      `candles[${index}].h must be at least open and close.`,
    );
  }
  if (low > Math.min(open, close)) {
    throw invalidResponse(
      `candles[${index}].l must be at most open and close.`,
    );
  }
  if (low > high) {
    throw invalidResponse(
      `candles[${index}].l must not be greater than high.`,
    );
  }

  return {
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume,
    tradeCount,
  };
}

function parseTimestamp(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw invalidResponse(`${field} must be a non-negative safe integer.`);
  }
  return value;
}

function parsePositiveWireNumber(value: unknown, field: string): number {
  const parsed = parseFiniteWireNumber(value, field);
  if (parsed <= 0) {
    throw invalidResponse(`${field} must be positive.`);
  }
  return parsed;
}

function parseNonNegativeWireNumber(value: unknown, field: string): number {
  const parsed = parseFiniteWireNumber(value, field);
  if (parsed < 0) {
    throw invalidResponse(`${field} must be non-negative.`);
  }
  return parsed;
}

function parseFiniteWireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw invalidResponse(`${field} must be a number or numeric string.`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw invalidResponse(`${field} must not be empty.`);
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw invalidResponse(`${field} must be finite.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw invalidResponse(`${field} must be a non-negative safe integer.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(detail: string): BtcCandleDataError {
  return new BtcCandleDataError(
    'invalid-response',
    `Invalid Hyperliquid candle response: ${detail}`,
  );
}
