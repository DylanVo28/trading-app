import { memo, useMemo } from 'react';
import Svg, {
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { formatMarketPrice } from '../btc-market/formatters';
import {
  calculateCandleGeometry,
  calculatePriceDomain,
  calculatePriceTickCount,
  calculateTimeTickIndexes,
  calculateVisibleWindow,
  calculateVolumeDomain,
  calculateVolumeSma,
  createChartLayout,
  createLinearTicks,
  DEFAULT_VISIBLE_CANDLE_COUNT,
  formatCompactVolume,
  formatUtcTick,
  getCandleCenterX,
  getVisibleCandles,
  scalePriceToY,
  scaleVolumeToY,
  VOLUME_SMA_PERIOD,
} from './chartMath';
import type { BtcCandle, BtcChartInterval } from './types';

const COLORS = {
  background: '#0A171D',
  axisText: '#A9B1BA',
  grid: '#203038',
  paneSeparator: '#35434A',
  up: '#18B7A8',
  down: '#F04C57',
  flat: '#94A3A8',
  volumeSma: '#D6C47A',
} as const;

const BTC_SIZE_DECIMALS = 5;

export interface BtcChartSvgProps {
  readonly candles: readonly BtcCandle[];
  readonly interval: BtcChartInterval;
  readonly width: number;
  readonly height: number;
  readonly displayVolume?: number | null;
  readonly visibleEndIndex?: number;
  readonly visibleCandleCount?: number;
}

export const BtcChartSvg = memo(function BtcChartSvg({
  candles,
  interval,
  width,
  height,
  displayVolume,
  visibleEndIndex = candles.length,
  visibleCandleCount = DEFAULT_VISIBLE_CANDLE_COUNT,
}: BtcChartSvgProps) {
  const model = useMemo(() => {
    const layout = createChartLayout(width, height);
    const window = calculateVisibleWindow(
      candles.length,
      visibleEndIndex,
      visibleCandleCount,
    );
    const visibleCandles = getVisibleCandles(candles, window);
    const geometry = calculateCandleGeometry(
      layout.plotWidth,
      Math.max(1, window.count),
    );
    const priceDomain = calculatePriceDomain(visibleCandles);
    const volumeDomain = calculateVolumeDomain(visibleCandles);
    const priceTicks = createLinearTicks(
      priceDomain,
      calculatePriceTickCount(layout.width),
    );
    const timeTickIndexes = calculateTimeTickIndexes(
      window.count,
      layout.width,
    );
    const volumeSma = calculateVolumeSma(candles);

    const smaPoints = visibleCandles.flatMap((_, visibleIndex) => {
      const sourceIndex = window.startIndex + visibleIndex;
      const value = volumeSma[sourceIndex];
      return value === null
        ? []
        : [
            {
              x: getCandleCenterX(visibleIndex, geometry, layout.plotLeft),
              y: scaleVolumeToY(value, volumeDomain, layout),
            },
          ];
    });
    const smaPath = smaPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
      .join(' ');
    const lastVisibleSourceIndex = window.endIndex - 1;

    return {
      geometry,
      lastVisibleSma:
        lastVisibleSourceIndex >= 0
          ? volumeSma[lastVisibleSourceIndex] ?? null
          : null,
      layout,
      priceDomain,
      priceTicks,
      smaPath,
      timeTickIndexes,
      visibleCandles,
      volumeDomain,
      window,
    };
  }, [candles, height, visibleCandleCount, visibleEndIndex, width]);

  const latestCandleIsVisible =
    candles.length > 0 && model.window.endIndex === candles.length;
  const latestCandle = latestCandleIsVisible
    ? candles[candles.length - 1]
    : null;
  const latestPriceY =
    latestCandle === null
      ? null
      : scalePriceToY(latestCandle.close, model.priceDomain, model.layout);
  const latestDirection =
    latestCandle === null ? 'flat' : getCandleDirection(latestCandle);
  const latestColor = COLORS[latestDirection];
  const latestLabelTop =
    latestPriceY === null
      ? 0
      : clamp(
          latestPriceY - 10,
          model.layout.priceTop,
          model.layout.priceBottom - 20,
        );

  return (
    <Svg
      height={model.layout.height}
      pointerEvents="none"
      viewBox={`0 0 ${model.layout.width} ${model.layout.height}`}
      width={model.layout.width}
    >
      <Rect
        fill={COLORS.background}
        height={model.layout.height}
        width={model.layout.width}
        x={0}
        y={0}
      />

      <G>
        {model.priceTicks.map((tick) => {
          const y = scalePriceToY(tick, model.priceDomain, model.layout);
          return (
            <G key={`price-${tick}`}>
              <Line
                stroke={COLORS.grid}
                strokeWidth={1}
                x1={model.layout.plotLeft}
                x2={model.layout.plotRight}
                y1={y}
                y2={y}
              />
              <SvgText
                fill={COLORS.axisText}
                fontSize={11}
                x={model.layout.plotRight + 7}
                y={y + 4}
              >
                {formatMarketPrice(tick, BTC_SIZE_DECIMALS)}
              </SvgText>
            </G>
          );
        })}

        {model.timeTickIndexes.map((visibleIndex, tickIndex) => {
          const candle = model.visibleCandles[visibleIndex];
          if (candle === undefined) {
            return null;
          }
          const x = getCandleCenterX(
            visibleIndex,
            model.geometry,
            model.layout.plotLeft,
          );
          const isFirst = tickIndex === 0;
          const isLast = tickIndex === model.timeTickIndexes.length - 1;
          return (
            <G key={`time-${candle.openTime}`}>
              <Line
                stroke={COLORS.grid}
                strokeWidth={1}
                x1={x}
                x2={x}
                y1={model.layout.priceTop}
                y2={model.layout.volumeBottom}
              />
              <SvgText
                fill={COLORS.axisText}
                fontSize={10}
                textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                x={clamp(x, 4, model.layout.plotRight - 4)}
                y={model.layout.height - 8}
              >
                {formatUtcTick(candle.openTime, interval)}
              </SvgText>
            </G>
          );
        })}
      </G>

      <Line
        stroke={COLORS.paneSeparator}
        strokeWidth={1}
        x1={model.layout.plotLeft}
        x2={model.layout.width}
        y1={model.layout.volumeTop}
        y2={model.layout.volumeTop}
      />
      <Line
        stroke={COLORS.grid}
        strokeWidth={1}
        x1={model.layout.plotRight}
        x2={model.layout.plotRight}
        y1={model.layout.priceTop}
        y2={model.layout.volumeBottom}
      />

      <G>
        {model.visibleCandles.map((candle, visibleIndex) => {
          const x = getCandleCenterX(
            visibleIndex,
            model.geometry,
            model.layout.plotLeft,
          );
          const openY = scalePriceToY(
            candle.open,
            model.priceDomain,
            model.layout,
          );
          const closeY = scalePriceToY(
            candle.close,
            model.priceDomain,
            model.layout,
          );
          const highY = scalePriceToY(
            candle.high,
            model.priceDomain,
            model.layout,
          );
          const lowY = scalePriceToY(
            candle.low,
            model.priceDomain,
            model.layout,
          );
          const direction = getCandleDirection(candle);
          const color = COLORS[direction];
          const rawBodyHeight = Math.abs(closeY - openY);
          const bodyHeight = Math.max(1, rawBodyHeight);
          const bodyY = clamp(
            Math.min(openY, closeY) - (rawBodyHeight === 0 ? 0.5 : 0),
            model.layout.priceTop,
            model.layout.priceBottom - bodyHeight,
          );
          const volumeY = scaleVolumeToY(
            candle.volume,
            model.volumeDomain,
            model.layout,
          );

          return (
            <G key={candle.openTime}>
              <Line
                stroke={color}
                strokeWidth={1}
                x1={x}
                x2={x}
                y1={highY}
                y2={lowY}
              />
              <Rect
                fill={color}
                height={bodyHeight}
                width={model.geometry.bodyWidth}
                x={x - model.geometry.bodyWidth / 2}
                y={bodyY}
              />
              <Rect
                fill={color}
                fillOpacity={0.58}
                height={Math.max(0, model.layout.volumeBottom - volumeY)}
                width={model.geometry.bodyWidth}
                x={x - model.geometry.bodyWidth / 2}
                y={volumeY}
              />
            </G>
          );
        })}
      </G>

      {model.smaPath.length > 0 ? (
        <Path
          d={model.smaPath}
          fill="none"
          stroke={COLORS.volumeSma}
          strokeWidth={1.25}
        />
      ) : null}
      <SvgText
        fill={COLORS.axisText}
        fontSize={11}
        x={8}
        y={model.layout.volumeTop + 16}
      >
        {`Volume ${formatCompactVolume(
          displayVolume ??
            model.visibleCandles[model.visibleCandles.length - 1]?.volume ??
            null,
        )}  SMA ${VOLUME_SMA_PERIOD} ${formatCompactVolume(
          model.lastVisibleSma,
        )}`}
      </SvgText>

      {latestCandle !== null && latestPriceY !== null ? (
        <G>
          <Line
            stroke={latestColor}
            strokeDasharray="3 3"
            strokeWidth={1}
            x1={model.layout.plotLeft}
            x2={model.layout.plotRight}
            y1={latestPriceY}
            y2={latestPriceY}
          />
          <Rect
            fill={latestColor}
            height={20}
            width={model.layout.rightAxisWidth}
            x={model.layout.plotRight}
            y={latestLabelTop}
          />
          <SvgText
            fill="#FFFFFF"
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
            x={model.layout.plotRight + model.layout.rightAxisWidth / 2}
            y={latestLabelTop + 14}
          >
            {formatMarketPrice(latestCandle.close, BTC_SIZE_DECIMALS)}
          </SvgText>
        </G>
      ) : null}
    </Svg>
  );
});

function getCandleDirection(
  candle: BtcCandle,
): 'up' | 'down' | 'flat' {
  if (candle.close > candle.open) {
    return 'up';
  }
  if (candle.close < candle.open) {
    return 'down';
  }
  return 'flat';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
