import {
  parseFiniteWireNumber,
  parseOptionalFiniteWireNumber,
} from './formatters';
import { BTC_COIN, BtcMarketSnapshot } from './types';

export const HYPERLIQUID_WEBSOCKET_URL = 'wss://api.hyperliquid.xyz/ws';

export const BTC_ASSET_CONTEXT_SUBSCRIPTION = JSON.stringify({
  method: 'subscribe',
  subscription: { type: 'activeAssetCtx', coin: BTC_COIN },
});

export const HYPERLIQUID_PING = JSON.stringify({ method: 'ping' });

/**
 * Returns null for acknowledgements, pong messages and updates for other markets.
 * A malformed BTC update throws and is intentionally ignored by the hook.
 */
export function parseBtcAssetContextMessage(
  rawMessage: unknown,
  previous: BtcMarketSnapshot,
): BtcMarketSnapshot | null {
  if (typeof rawMessage !== 'string') {
    return null;
  }

  let message: unknown;
  try {
    message = JSON.parse(rawMessage) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(message) || message.channel !== 'activeAssetCtx') {
    return null;
  }

  const data = message.data;
  if (!isRecord(data) || data.coin !== BTC_COIN) {
    return null;
  }

  const context = data.ctx;
  if (!isRecord(context)) {
    throw new Error('Malformed BTC activeAssetCtx message.');
  }

  return {
    ...previous,
    funding: parseFiniteWireNumber(context.funding, 'ws.ctx.funding'),
    openInterest: parseFiniteWireNumber(
      context.openInterest,
      'ws.ctx.openInterest',
    ),
    prevDayPx: parseFiniteWireNumber(context.prevDayPx, 'ws.ctx.prevDayPx'),
    dayNtlVlm: parseFiniteWireNumber(context.dayNtlVlm, 'ws.ctx.dayNtlVlm'),
    oraclePx: parseFiniteWireNumber(context.oraclePx, 'ws.ctx.oraclePx'),
    markPx: parseFiniteWireNumber(context.markPx, 'ws.ctx.markPx'),
    midPx:
      context.midPx === undefined
        ? previous.midPx
        : parseOptionalFiniteWireNumber(context.midPx, 'ws.ctx.midPx'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
