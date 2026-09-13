import {
  BtcMarketMetrics,
  BtcMarketSnapshot,
  MarketMoveDirection,
} from './types';

export const MARKET_MOVE_COLORS: Readonly<
  Record<MarketMoveDirection, string>
> = {
  up: '#14B8A6',
  down: '#F43F5E',
  flat: '#94A3B8',
};

export function getPrimaryPrice(snapshot: BtcMarketSnapshot): number {
  return snapshot.midPx ?? snapshot.markPx;
}

export function calculateBtcMarketMetrics(
  snapshot: BtcMarketSnapshot,
): BtcMarketMetrics {
  const price = finiteOrZero(getPrimaryPrice(snapshot));
  const priceChange = finiteOrZero(price - snapshot.prevDayPx);
  const priceChangePercent =
    snapshot.prevDayPx === 0
      ? 0
      : finiteOrZero((priceChange / snapshot.prevDayPx) * 100);
  const openInterestUsd = finiteOrZero(
    snapshot.openInterest * snapshot.oraclePx,
  );
  const fundingPercent = finiteOrZero(snapshot.funding * 100);

  return {
    price,
    priceChange,
    priceChangePercent,
    openInterestUsd,
    fundingPercent,
    direction: getMarketMoveDirection(priceChange),
  };
}

export function getMarketMoveDirection(
  priceChange: number,
): MarketMoveDirection {
  if (priceChange > 0) {
    return 'up';
  }
  if (priceChange < 0) {
    return 'down';
  }
  return 'flat';
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? normalizeNegativeZero(value) : 0;
}

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
