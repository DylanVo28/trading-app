import type { BtcChartInterval } from './types';

export const BTC_CHART_COIN = 'BTC' as const;
export const DEFAULT_BTC_CHART_INTERVAL: BtcChartInterval = '1d';
export const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
export const HYPERLIQUID_WEBSOCKET_URL = 'wss://api.hyperliquid.xyz/ws';

export const BTC_CHART_HISTORY_LIMIT = 300;
export const BTC_CHART_REST_TIMEOUT_MS = 10_000;
export const BTC_CHART_HEARTBEAT_MS = 30_000;
export const BTC_CHART_FALLBACK_POLL_MS = 15_000;
export const BTC_CHART_INITIAL_RECONNECT_DELAY_MS = 1_000;
export const BTC_CHART_MAX_RECONNECT_DELAY_MS = 30_000;

export const BTC_CHART_INTERVAL_DURATION_MS = {
  '5m': 5 * 60 * 1_000,
  '1h': 60 * 60 * 1_000,
  '1d': 24 * 60 * 60 * 1_000,
} as const satisfies Readonly<Record<BtcChartInterval, number>>;
