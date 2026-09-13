import {
  parseFiniteWireNumber,
  parseOptionalFiniteWireNumber,
} from './formatters';
import {
  BTC_COIN,
  BtcMarketSnapshot,
  HyperliquidMarketDataError,
} from './types';

const INFO_URL = 'https://api.hyperliquid.xyz/info';
const DEFAULT_TIMEOUT_MS = 10_000;

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'json' | 'ok' | 'status'>>;

export interface FetchBtcMarketSnapshotOptions {
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function fetchBtcMarketSnapshot(
  options: FetchBtcMarketSnapshotOptions = {},
): Promise<BtcMarketSnapshot> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
    const response = await fetchImpl(INFO_URL, {
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HyperliquidMarketDataError(
        'http',
        `Hyperliquid info request failed with HTTP ${response.status}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error: unknown) {
      throw new HyperliquidMarketDataError(
        'invalid-response',
        'Hyperliquid returned invalid JSON.',
        { cause: error },
      );
    }

    return parseBtcMarketSnapshot(payload);
  } catch (error: unknown) {
    if (error instanceof HyperliquidMarketDataError) {
      throw error;
    }

    if (didTimeout) {
      throw new HyperliquidMarketDataError(
        'timeout',
        `Hyperliquid info request timed out after ${timeoutMs}ms.`,
        { cause: error },
      );
    }

    if (controller.signal.aborted) {
      throw new HyperliquidMarketDataError(
        'aborted',
        'Hyperliquid info request was aborted.',
        { cause: error },
      );
    }

    throw new HyperliquidMarketDataError(
      'network',
      'Unable to load Hyperliquid market data.',
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export function parseBtcMarketSnapshot(payload: unknown): BtcMarketSnapshot {
  if (!Array.isArray(payload) || payload.length !== 2) {
    throw invalidResponse('Expected [meta, assetContexts].');
  }

  const [meta, assetContexts] = payload;
  if (!isRecord(meta) || !Array.isArray(meta.universe)) {
    throw invalidResponse('Missing perpetual universe.');
  }
  if (!Array.isArray(assetContexts)) {
    throw invalidResponse('Missing asset contexts.');
  }
  if (meta.universe.length !== assetContexts.length) {
    throw invalidResponse('Universe and asset contexts are not index-aligned.');
  }

  const btcIndexes = meta.universe.flatMap((asset, index) =>
    isRecord(asset) && asset.name === BTC_COIN ? [index] : [],
  );
  if (btcIndexes.length !== 1) {
    throw invalidResponse('Expected exactly one BTC market.');
  }

  const btcIndex = btcIndexes[0];
  const asset = meta.universe[btcIndex];
  const context = assetContexts[btcIndex];
  if (!isRecord(asset) || !isRecord(context)) {
    throw invalidResponse('BTC metadata or asset context is missing.');
  }

  return {
    coin: BTC_COIN,
    szDecimals: parseInteger(asset.szDecimals, 'universe[BTC].szDecimals'),
    maxLeverage: parsePositiveNumber(
      asset.maxLeverage,
      'universe[BTC].maxLeverage',
    ),
    funding: parseFiniteWireNumber(context.funding, 'contexts[BTC].funding'),
    openInterest: parseFiniteWireNumber(
      context.openInterest,
      'contexts[BTC].openInterest',
    ),
    prevDayPx: parseFiniteWireNumber(
      context.prevDayPx,
      'contexts[BTC].prevDayPx',
    ),
    dayNtlVlm: parseFiniteWireNumber(
      context.dayNtlVlm,
      'contexts[BTC].dayNtlVlm',
    ),
    oraclePx: parseFiniteWireNumber(
      context.oraclePx,
      'contexts[BTC].oraclePx',
    ),
    markPx: parseFiniteWireNumber(context.markPx, 'contexts[BTC].markPx'),
    midPx: parseOptionalFiniteWireNumber(
      context.midPx,
      'contexts[BTC].midPx',
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInteger(value: unknown, field: string): number {
  const parsed = parseFiniteWireNumber(value, field);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw invalidResponse(`${field} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveNumber(value: unknown, field: string): number {
  const parsed = parseFiniteWireNumber(value, field);
  if (parsed <= 0) {
    throw invalidResponse(`${field} must be positive.`);
  }
  return parsed;
}

function invalidResponse(detail: string): HyperliquidMarketDataError {
  return new HyperliquidMarketDataError(
    'invalid-response',
    `Invalid Hyperliquid response: ${detail}`,
  );
}
