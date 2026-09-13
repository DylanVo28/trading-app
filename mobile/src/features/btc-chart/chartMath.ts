import type { BtcCandle, BtcChartInterval } from './types';

export const DEFAULT_VISIBLE_CANDLE_COUNT = 60;
export const PRICE_PANE_RATIO = 0.72;
export const VOLUME_SMA_PERIOD = 20;
export const PRICE_DOMAIN_PADDING_RATIO = 0.05;

export interface NumericDomain {
  readonly min: number;
  readonly max: number;
}

export interface ChartVisibleWindow {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly count: number;
}

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  readonly plotLeft: number;
  readonly plotRight: number;
  readonly plotWidth: number;
  readonly priceTop: number;
  readonly priceBottom: number;
  readonly priceHeight: number;
  readonly volumeTop: number;
  readonly volumeBottom: number;
  readonly volumeHeight: number;
  readonly timeAxisTop: number;
  readonly timeAxisHeight: number;
  readonly rightAxisWidth: number;
}

export interface CandleGeometry {
  readonly slotWidth: number;
  readonly bodyWidth: number;
}

const utcTickFormatters: Readonly<Record<BtcChartInterval, Intl.DateTimeFormat>> = {
  '5m': new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }),
  '1h': new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }),
  '1d': new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }),
};

const compactVolumeFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function createChartLayout(width: number, height: number): ChartLayout {
  const safeWidth = normalizeDimension(width);
  const safeHeight = normalizeDimension(height);
  const rightAxisWidth = safeWidth < 360 ? 62 : 72;
  const timeAxisHeight = 28;
  const plotWidth = Math.max(1, safeWidth - rightAxisWidth);
  const paneHeight = Math.max(1, safeHeight - timeAxisHeight);
  const priceHeight = paneHeight * PRICE_PANE_RATIO;
  const volumeHeight = paneHeight - priceHeight;

  return {
    width: safeWidth,
    height: safeHeight,
    plotLeft: 0,
    plotRight: plotWidth,
    plotWidth,
    priceTop: 0,
    priceBottom: priceHeight,
    priceHeight,
    volumeTop: priceHeight,
    volumeBottom: paneHeight,
    volumeHeight,
    timeAxisTop: paneHeight,
    timeAxisHeight,
    rightAxisWidth,
  };
}

export function calculateVisibleWindow(
  totalCandleCount: number,
  requestedEndIndex = totalCandleCount,
  requestedVisibleCount = DEFAULT_VISIBLE_CANDLE_COUNT,
): ChartVisibleWindow {
  const total = Math.max(0, Math.floor(finiteOrZero(totalCandleCount)));
  if (total === 0) {
    return { startIndex: 0, endIndex: 0, count: 0 };
  }

  const visibleCount = clamp(
    Math.floor(finiteOrDefault(requestedVisibleCount, 1)),
    1,
    total,
  );
  const endIndex = clamp(
    Math.floor(finiteOrDefault(requestedEndIndex, total)),
    visibleCount,
    total,
  );
  const startIndex = endIndex - visibleCount;

  return { startIndex, endIndex, count: visibleCount };
}

export function getVisibleCandles(
  candles: readonly BtcCandle[],
  window: ChartVisibleWindow,
): readonly BtcCandle[] {
  return candles.slice(window.startIndex, window.endIndex);
}

export function calculateCandleGeometry(
  plotWidth: number,
  visibleCandleCount: number,
): CandleGeometry {
  const safePlotWidth = normalizeDimension(plotWidth);
  const safeCount = Math.max(1, Math.floor(finiteOrDefault(visibleCandleCount, 1)));
  const slotWidth = safePlotWidth / safeCount;

  return {
    slotWidth,
    bodyWidth: Math.max(1, slotWidth * 0.68),
  };
}

export function calculatePriceDomain(
  candles: readonly BtcCandle[],
  paddingRatio = PRICE_DOMAIN_PADDING_RATIO,
): NumericDomain {
  if (candles.length === 0) {
    return { min: 0, max: 1 };
  }

  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  candles.forEach((candle) => {
    minimum = Math.min(minimum, candle.low);
    maximum = Math.max(maximum, candle.high);
  });

  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
    return { min: 0, max: 1 };
  }

  const requestedPadding = Math.max(0, finiteOrZero(paddingRatio));
  const range = maximum - minimum;
  const padding =
    range > 0
      ? range * requestedPadding
      : Math.max(Math.abs(maximum) * requestedPadding, 1);

  return {
    min: minimum - padding,
    max: maximum + padding,
  };
}

export function calculateVolumeDomain(
  candles: readonly BtcCandle[],
): NumericDomain {
  const maximum = candles.reduce(
    (currentMaximum, candle) => Math.max(currentMaximum, candle.volume),
    0,
  );

  return {
    min: 0,
    max: maximum > 0 && Number.isFinite(maximum) ? maximum * 1.1 : 1,
  };
}

export function calculateVolumeSma(
  candles: readonly BtcCandle[],
  period = VOLUME_SMA_PERIOD,
): readonly (number | null)[] {
  const safePeriod = Math.max(1, Math.floor(finiteOrDefault(period, 1)));
  let rollingTotal = 0;

  return candles.map((candle, index) => {
    rollingTotal += candle.volume;
    if (index >= safePeriod) {
      rollingTotal -= candles[index - safePeriod].volume;
    }
    return index + 1 >= safePeriod ? rollingTotal / safePeriod : null;
  });
}

export function scalePriceToY(
  price: number,
  domain: NumericDomain,
  layout: ChartLayout,
): number {
  return scaleValueToY(price, domain, layout.priceTop, layout.priceHeight);
}

export function scaleVolumeToY(
  volume: number,
  domain: NumericDomain,
  layout: ChartLayout,
): number {
  return scaleValueToY(volume, domain, layout.volumeTop, layout.volumeHeight);
}

export function getCandleCenterX(
  visibleIndex: number,
  geometry: CandleGeometry,
  plotLeft = 0,
): number {
  return (
    finiteOrZero(plotLeft) +
    (Math.max(0, Math.floor(finiteOrZero(visibleIndex))) + 0.5) *
      geometry.slotWidth
  );
}

export function createLinearTicks(
  domain: NumericDomain,
  requestedCount: number,
): readonly number[] {
  const count = Math.max(2, Math.floor(finiteOrDefault(requestedCount, 2)));
  const range = domain.max - domain.min;
  if (!Number.isFinite(range) || range <= 0) {
    return [domain.min, domain.max];
  }

  return Array.from(
    { length: count },
    (_, index) => domain.min + (range * index) / (count - 1),
  );
}

export function calculatePriceTickCount(width: number): number {
  if (width < 360) {
    return 4;
  }
  if (width < 600) {
    return 5;
  }
  return 6;
}

export function calculateTimeTickIndexes(
  visibleCandleCount: number,
  width: number,
): readonly number[] {
  const count = Math.max(0, Math.floor(finiteOrZero(visibleCandleCount)));
  if (count === 0) {
    return [];
  }

  const requestedTickCount = width < 360 ? 3 : width < 600 ? 4 : 6;
  const tickCount = Math.min(count, requestedTickCount);
  if (tickCount === 1) {
    return [0];
  }

  return Array.from(
    new Set(
      Array.from({ length: tickCount }, (_, index) =>
        Math.round((index * (count - 1)) / (tickCount - 1)),
      ),
    ),
  );
}

export function formatUtcTick(
  timestamp: number,
  interval: BtcChartInterval,
): string {
  if (!Number.isFinite(timestamp)) {
    return '—';
  }
  return utcTickFormatters[interval].format(new Date(timestamp));
}

export function formatCompactVolume(value: number | null): string {
  return value !== null && Number.isFinite(value)
    ? compactVolumeFormatter.format(value)
    : '—';
}

function scaleValueToY(
  value: number,
  domain: NumericDomain,
  top: number,
  height: number,
): number {
  const range = domain.max - domain.min;
  if (!Number.isFinite(value) || !Number.isFinite(range) || range <= 0) {
    return top + height / 2;
  }

  const normalized = clamp((value - domain.min) / range, 0, 1);
  return top + height * (1 - normalized);
}

function normalizeDimension(value: number): number {
  return Math.max(1, finiteOrDefault(value, 1));
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function finiteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
