import {
  BTC_CHART_COIN,
  BTC_CHART_HISTORY_LIMIT,
} from './constants';
import { parseBtcCandleSnapshot } from './hyperliquid';
import type { BtcCandle, BtcChartInterval } from './types';

export const HYPERLIQUID_PING_MESSAGE = JSON.stringify({ method: 'ping' });

export function createBtcCandleSubscription(
  interval: BtcChartInterval,
): string {
  return JSON.stringify({
    method: 'subscribe',
    subscription: {
      type: 'candle',
      coin: BTC_CHART_COIN,
      interval,
    },
  });
}

/**
 * Returns null for acknowledgements, pongs and unrelated channels.
 * A malformed candle on the requested channel throws so callers can retain
 * their last valid data without committing a partial update.
 */
export function parseBtcCandleMessage(
  rawMessage: unknown,
  interval: BtcChartInterval,
): BtcCandle | null {
  if (typeof rawMessage !== 'string') {
    return null;
  }

  let message: unknown;
  try {
    message = JSON.parse(rawMessage) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(message) || message.channel !== 'candle') {
    return null;
  }

  const candles = parseBtcCandleSnapshot([message.data], interval);
  return candles[0] ?? null;
}

export function mergeBtcCandles(
  current: readonly BtcCandle[],
  incoming: readonly BtcCandle[],
): readonly BtcCandle[] {
  const candlesByOpenTime = new Map<number, BtcCandle>();

  current.forEach((candle) => {
    candlesByOpenTime.set(candle.openTime, candle);
  });
  incoming.forEach((candle) => {
    candlesByOpenTime.set(candle.openTime, candle);
  });

  return Array.from(candlesByOpenTime.values())
    .sort((left, right) => left.openTime - right.openTime)
    .slice(-BTC_CHART_HISTORY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
