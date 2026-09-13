import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatMarketPrice } from '../btc-market/formatters';
import { BtcChartSvg } from './BtcChartSvg';
import {
  calculateCandleGeometry,
  calculateVisibleWindow,
  createChartLayout,
  DEFAULT_VISIBLE_CANDLE_COUNT,
} from './chartMath';
import { DEFAULT_BTC_CHART_INTERVAL } from './constants';
import type { BtcCandle, BtcChartInterval } from './types';
import { useBtcCandles } from './useBtcCandles';

const TOOLBAR_HEIGHT = 52;
const MARKET_INFO_HEIGHT = 64;
const MIN_CHART_HEIGHT = 440;
const MAX_CHART_HEIGHT = 620;
const MIN_CANVAS_HEIGHT = 260;
const MIN_CANDLE_SLOT_WIDTH = 4;
const MAX_CANDLE_SLOT_WIDTH = 20;

const INTERVAL_LABELS: Readonly<Record<BtcChartInterval, string>> = {
  '5m': '5m',
  '1h': '1h',
  '1d': 'D',
};

const MARKET_INTERVAL_LABELS: Readonly<Record<BtcChartInterval, string>> = {
  '5m': '5m',
  '1h': '1H',
  '1d': '1D',
};

export interface HyperliquidBtcChartProps {
  readonly initialInterval?: BtcChartInterval;
  readonly height?: number;
}

export function HyperliquidBtcChart({
  initialInterval = DEFAULT_BTC_CHART_INTERVAL,
  height,
}: HyperliquidBtcChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(screenWidth);
  const [interval, setInterval] = useState<BtcChartInterval>(initialInterval);
  const [visibleEndIndex, setVisibleEndIndex] = useState(0);
  const [visibleCandleCount, setVisibleCandleCount] = useState(
    DEFAULT_VISIBLE_CANDLE_COUNT,
  );
  const [followingLatest, setFollowingLatest] = useState(true);
  const [viewportEndOpenTime, setViewportEndOpenTime] = useState<number | null>(
    null,
  );
  const [selectedOpenTime, setSelectedOpenTime] = useState<number | null>(null);
  const { candles, status, error, retry } = useBtcCandles(interval);

  const responsiveHeight = clamp(
    containerWidth * 1.2,
    MIN_CHART_HEIGHT,
    MAX_CHART_HEIGHT,
  );
  const resolvedHeight =
    height === undefined || !Number.isFinite(height)
      ? responsiveHeight
      : Math.max(MIN_CANVAS_HEIGHT + TOOLBAR_HEIGHT + MARKET_INFO_HEIGHT, height);
  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    resolvedHeight - TOOLBAR_HEIGHT - MARKET_INFO_HEIGHT,
  );
  const layout = useMemo(
    () => createChartLayout(containerWidth, canvasHeight),
    [canvasHeight, containerWidth],
  );
  const anchoredEndIndex = useMemo(() => {
    if (viewportEndOpenTime === null) {
      return -1;
    }
    const index = candles.findIndex(
      (candle) => candle.openTime === viewportEndOpenTime,
    );
    return index < 0 ? -1 : index + 1;
  }, [candles, viewportEndOpenTime]);
  const effectiveEndIndex = followingLatest
    ? candles.length
    : anchoredEndIndex >= 0
      ? anchoredEndIndex
      : visibleEndIndex;
  const visibleWindow = useMemo(
    () =>
      calculateVisibleWindow(
        candles.length,
        effectiveEndIndex,
        visibleCandleCount,
      ),
    [candles.length, effectiveEndIndex, visibleCandleCount],
  );
  const geometry = useMemo(
    () =>
      calculateCandleGeometry(
        layout.plotWidth,
        Math.max(1, visibleWindow.count),
      ),
    [layout.plotWidth, visibleWindow.count],
  );
  const selectedCandle = useMemo(
    () =>
      selectedOpenTime === null
        ? null
        : candles.find((candle) => candle.openTime === selectedOpenTime) ?? null,
    [candles, selectedOpenTime],
  );
  const latestCandle = candles[candles.length - 1] ?? null;
  const displayCandle = selectedCandle ?? latestCandle;

  const previewTranslationX = useSharedValue(0);
  const previewScaleX = useSharedValue(1);
  const crosshairActive = useSharedValue(0);
  const crosshairX = useSharedValue(0);
  const crosshairY = useSharedValue(0);

  useEffect(() => {
    setFollowingLatest(true);
    setVisibleEndIndex(0);
    setViewportEndOpenTime(null);
    setVisibleCandleCount(DEFAULT_VISIBLE_CANDLE_COUNT);
    setSelectedOpenTime(null);
  }, [interval]);

  useEffect(() => {
    if (followingLatest) {
      return;
    }

    if (anchoredEndIndex >= 0) {
      setVisibleEndIndex(anchoredEndIndex);
      return;
    }

    const clampedWindow = calculateVisibleWindow(
      candles.length,
      visibleEndIndex,
      visibleCandleCount,
    );
    setVisibleEndIndex(clampedWindow.endIndex);
    if (clampedWindow.endIndex >= candles.length) {
      setFollowingLatest(true);
      setViewportEndOpenTime(null);
    } else {
      setViewportEndOpenTime(
        candles[clampedWindow.endIndex - 1]?.openTime ?? null,
      );
    }
  }, [
    anchoredEndIndex,
    candles,
    followingLatest,
    visibleCandleCount,
    visibleEndIndex,
  ]);

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setContainerWidth(nextWidth);
    }
  }, []);

  const selectCandleAtX = useCallback(
    (x: number): void => {
      if (visibleWindow.count === 0) {
        setSelectedOpenTime(null);
        return;
      }

      const visibleIndex = clamp(
        Math.floor((x - layout.plotLeft) / geometry.slotWidth),
        0,
        visibleWindow.count - 1,
      );
      const sourceIndex = visibleWindow.startIndex + visibleIndex;
      setSelectedOpenTime(candles[sourceIndex]?.openTime ?? null);
    },
    [candles, geometry.slotWidth, layout.plotLeft, visibleWindow],
  );

  const clearSelection = useCallback((): void => {
    setSelectedOpenTime(null);
  }, []);

  const commitPan = useCallback(
    (translationX: number): void => {
      if (visibleWindow.count === 0 || geometry.slotWidth <= 0) {
        return;
      }

      const candleDelta = Math.round(-translationX / geometry.slotWidth);
      const nextEndIndex = clamp(
        visibleWindow.endIndex + candleDelta,
        visibleWindow.count,
        candles.length,
      );
      setVisibleEndIndex(nextEndIndex);
      const nextFollowingLatest = nextEndIndex >= candles.length;
      setFollowingLatest(nextFollowingLatest);
      setViewportEndOpenTime(
        nextFollowingLatest
          ? null
          : candles[nextEndIndex - 1]?.openTime ?? null,
      );
    },
    [candles.length, geometry.slotWidth, visibleWindow],
  );

  const commitPinch = useCallback(
    (scale: number, focalX: number): void => {
      if (visibleWindow.count === 0 || !Number.isFinite(scale) || scale <= 0) {
        return;
      }

      const maximumVisibleCount = Math.max(
        1,
        Math.min(
          candles.length,
          Math.floor(layout.plotWidth / MIN_CANDLE_SLOT_WIDTH),
        ),
      );
      const minimumVisibleCount = Math.min(
        maximumVisibleCount,
        Math.max(1, Math.ceil(layout.plotWidth / MAX_CANDLE_SLOT_WIDTH)),
      );
      const nextVisibleCount = clamp(
        Math.round(visibleWindow.count / scale),
        minimumVisibleCount,
        maximumVisibleCount,
      );

      let nextEndIndex: number;
      if (followingLatest) {
        nextEndIndex = candles.length;
      } else {
        const focalRatio = clamp(
          (focalX - layout.plotLeft) / layout.plotWidth,
          0,
          1,
        );
        const anchorIndex =
          visibleWindow.startIndex + focalRatio * visibleWindow.count;
        const nextStartIndex = anchorIndex - focalRatio * nextVisibleCount;
        nextEndIndex = clamp(
          Math.round(nextStartIndex + nextVisibleCount),
          nextVisibleCount,
          candles.length,
        );
      }

      setVisibleCandleCount(nextVisibleCount);
      setVisibleEndIndex(nextEndIndex);
      const nextFollowingLatest = nextEndIndex >= candles.length;
      setFollowingLatest(nextFollowingLatest);
      setViewportEndOpenTime(
        nextFollowingLatest
          ? null
          : candles[nextEndIndex - 1]?.openTime ?? null,
      );
    },
    [candles.length, followingLatest, layout, visibleWindow],
  );

  const goToLatest = useCallback((): void => {
    setFollowingLatest(true);
    setVisibleEndIndex(candles.length);
    setViewportEndOpenTime(null);
  }, [candles.length]);

  const changeInterval = useCallback((nextInterval: BtcChartInterval): void => {
    setInterval(nextInterval);
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(candles.length > 0)
    .maxPointers(1)
    .activeOffsetX([-8, 8])
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      previewTranslationX.value = clampWorklet(
        event.translationX,
        -layout.plotWidth,
        layout.plotWidth,
      );
    })
    .onEnd((event) => {
      runOnJS(commitPan)(event.translationX);
    })
    .onFinalize(() => {
      previewTranslationX.value = withTiming(0, { duration: 120 });
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(candles.length > 0)
    .onUpdate((event) => {
      previewScaleX.value = clampWorklet(event.scale, 0.5, 2);
    })
    .onEnd((event) => {
      runOnJS(commitPinch)(event.scale, event.focalX);
    })
    .onFinalize(() => {
      previewScaleX.value = withTiming(1, { duration: 120 });
    });

  const crosshairGesture = Gesture.Pan()
    .enabled(candles.length > 0)
    .maxPointers(1)
    .activateAfterLongPress(250)
    .minDistance(0)
    .onStart((event) => {
      crosshairActive.value = 1;
      crosshairX.value = clampWorklet(
        event.x,
        layout.plotLeft,
        layout.plotRight,
      );
      crosshairY.value = clampWorklet(
        event.y,
        layout.priceTop,
        layout.volumeBottom,
      );
      runOnJS(selectCandleAtX)(event.x);
    })
    .onUpdate((event) => {
      crosshairX.value = clampWorklet(
        event.x,
        layout.plotLeft,
        layout.plotRight,
      );
      crosshairY.value = clampWorklet(
        event.y,
        layout.priceTop,
        layout.volumeBottom,
      );
      runOnJS(selectCandleAtX)(event.x);
    })
    .onFinalize(() => {
      crosshairActive.value = withTiming(0, { duration: 100 });
      runOnJS(clearSelection)();
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(crosshairGesture, panGesture),
    pinchGesture,
  );

  const previewStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: previewTranslationX.value },
      { scaleX: previewScaleX.value },
    ],
  }));
  const verticalCrosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairActive.value,
    transform: [{ translateX: crosshairX.value }],
  }));
  const horizontalCrosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairActive.value,
    transform: [{ translateY: crosshairY.value }],
  }));

  const moveColor = getCandleColor(displayCandle);
  const statusLabel = getStatusLabel(status);
  const accessibilitySummary = displayCandle
    ? `BTC-USDC ${MARKET_INTERVAL_LABELS[interval]} chart, ${statusLabel}, open ${formatMarketPrice(
        displayCandle.open,
      )}, high ${formatMarketPrice(displayCandle.high)}, low ${formatMarketPrice(
        displayCandle.low,
      )}, close ${formatMarketPrice(displayCandle.close)}`
    : `BTC-USDC ${MARKET_INTERVAL_LABELS[interval]} chart, ${statusLabel}`;

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, { height: resolvedHeight }]}
    >
      <View style={styles.toolbar}>
        {(['5m', '1h', '1d'] as const).map((candidateInterval) => {
          const selected = candidateInterval === interval;
          return (
            <Pressable
              accessibilityLabel={`Show ${MARKET_INTERVAL_LABELS[candidateInterval]} BTC candles`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={candidateInterval}
              onPress={() => changeInterval(candidateInterval)}
              style={({ pressed }) => [
                styles.intervalButton,
                selected && styles.intervalButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.intervalText,
                  selected && styles.intervalTextSelected,
                ]}
              >
                {INTERVAL_LABELS[candidateInterval]}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.toolbarDivider} />
        <View accessibilityElementsHidden style={styles.candleTypeIcon}>
          <View style={styles.candleTypeWick} />
          <View style={styles.candleTypeBody} />
        </View>
      </View>

      <View style={styles.marketInfo}>
        <View style={styles.marketTitleRow}>
          <Text numberOfLines={1} style={styles.marketTitle}>
            BTC-USDC · {MARKET_INTERVAL_LABELS[interval]} · Hyperliquid
          </Text>
          <View
            accessibilityLabel={statusLabel}
            style={[
              styles.statusDot,
              status === 'live'
                ? styles.statusLive
                : status === 'error'
                  ? styles.statusError
                  : styles.statusReconnecting,
            ]}
          />
        </View>
        {displayCandle ? (
          <Text numberOfLines={1} style={styles.ohlcRow}>
            O <Text style={{ color: moveColor }}>{formatMarketPrice(displayCandle.open)}</Text>
            {'  '}H <Text style={{ color: moveColor }}>{formatMarketPrice(displayCandle.high)}</Text>
            {'  '}L <Text style={{ color: moveColor }}>{formatMarketPrice(displayCandle.low)}</Text>
            {'  '}C <Text style={{ color: moveColor }}>{formatMarketPrice(displayCandle.close)}</Text>
          </Text>
        ) : (
          <Text style={styles.ohlcPlaceholder}>O —  H —  L —  C —</Text>
        )}
      </View>

      <View style={[styles.chartViewport, { height: canvasHeight }]}>
        {status === 'loading' && candles.length === 0 ? (
          <ChartSkeleton />
        ) : status === 'error' && candles.length === 0 ? (
          <ChartError message={error?.message} onRetry={retry} />
        ) : candles.length === 0 ? (
          <ChartEmpty onRetry={retry} />
        ) : (
          <GestureDetector gesture={composedGesture}>
            <View
              accessible
              accessibilityLabel={accessibilitySummary}
              accessibilityRole="image"
              style={styles.gestureSurface}
            >
              <Animated.View style={[styles.chartPreview, previewStyle]}>
                <BtcChartSvg
                  candles={candles}
                  displayVolume={displayCandle?.volume}
                  height={canvasHeight}
                  interval={interval}
                  visibleCandleCount={visibleCandleCount}
                  visibleEndIndex={effectiveEndIndex}
                  width={containerWidth}
                />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.verticalCrosshair,
                  { height: layout.volumeBottom },
                  verticalCrosshairStyle,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.horizontalCrosshair,
                  { width: layout.plotWidth },
                  horizontalCrosshairStyle,
                ]}
              />
            </View>
          </GestureDetector>
        )}

        {!followingLatest && candles.length > 0 ? (
          <Pressable
            accessibilityLabel="Return to latest BTC candle"
            accessibilityRole="button"
            onPress={goToLatest}
            style={({ pressed }) => [
              styles.latestButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.latestButtonText}>Latest</Text>
          </Pressable>
        ) : null}

        {status === 'reconnecting' && candles.length > 0 ? (
          <View style={styles.reconnectingBadge}>
            <Text style={styles.reconnectingText}>Reconnecting</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ChartSkeleton() {
  return (
    <View
      accessibilityLabel="Loading BTC candle chart"
      accessibilityRole="progressbar"
      style={styles.stateContainer}
    >
      <View style={[styles.skeletonBar, { height: '55%', left: '8%' }]} />
      <View style={[styles.skeletonBar, { height: '35%', left: '24%' }]} />
      <View style={[styles.skeletonBar, { height: '68%', left: '40%' }]} />
      <View style={[styles.skeletonBar, { height: '46%', left: '56%' }]} />
      <View style={[styles.skeletonBar, { height: '76%', left: '72%' }]} />
    </View>
  );
}

function ChartError({
  message,
  onRetry,
}: {
  readonly message?: string;
  readonly onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.stateContainer}>
      <Text style={styles.stateTitle}>BTC chart unavailable</Text>
      <Text numberOfLines={2} style={styles.stateMessage}>
        {message ?? 'Unable to load BTC candles.'}
      </Text>
      <RetryButton onPress={onRetry} />
    </View>
  );
}

function ChartEmpty({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <View style={styles.stateContainer}>
      <Text style={styles.stateTitle}>No BTC candle data</Text>
      <RetryButton onPress={onRetry} />
    </View>
  );
}

function RetryButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Retry loading BTC candles"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
    >
      <Text style={styles.retryButtonText}>Retry</Text>
    </Pressable>
  );
}

function getCandleColor(candle: BtcCandle | null): string {
  if (candle === null || candle.close === candle.open) {
    return '#94A3A8';
  }
  return candle.close > candle.open ? '#18B7A8' : '#F04C57';
}

function getStatusLabel(status: 'loading' | 'live' | 'reconnecting' | 'error') {
  switch (status) {
    case 'live':
      return 'Live';
    case 'reconnecting':
      return 'Reconnecting';
    case 'error':
      return 'Unavailable';
    default:
      return 'Loading';
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampWorklet(value: number, minimum: number, maximum: number): number {
  'worklet';
  return Math.min(maximum, Math.max(minimum, value));
}

const styles = StyleSheet.create({
  candleTypeBody: {
    backgroundColor: '#CDD5DA',
    height: 17,
    width: 7,
  },
  candleTypeIcon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    marginLeft: 12,
    width: 32,
  },
  candleTypeWick: {
    backgroundColor: '#CDD5DA',
    height: 27,
    position: 'absolute',
    width: 1,
  },
  chartPreview: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chartViewport: {
    backgroundColor: '#0A171D',
    overflow: 'hidden',
    position: 'relative',
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: '#0A171D',
    borderTopColor: '#2B373D',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gestureSurface: {
    flex: 1,
    overflow: 'hidden',
  },
  horizontalCrosshair: {
    backgroundColor: '#A9B1BA',
    height: StyleSheet.hairlineWidth,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  intervalButton: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    height: 52,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: 10,
  },
  intervalButtonSelected: {
    borderBottomColor: '#52D5C8',
  },
  intervalText: {
    color: '#C4CDD2',
    fontSize: 17,
  },
  intervalTextSelected: {
    color: '#52D5C8',
    fontWeight: '600',
  },
  latestButton: {
    alignItems: 'center',
    backgroundColor: '#173139',
    borderColor: '#3A555D',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 34,
    height: 44,
    justifyContent: 'center',
    minWidth: 68,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 74,
  },
  latestButtonText: {
    color: '#52D5C8',
    fontSize: 13,
    fontWeight: '600',
  },
  marketInfo: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  marketTitle: {
    color: '#CDD5DA',
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
  },
  marketTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  ohlcPlaceholder: {
    color: '#77858C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  ohlcRow: {
    color: '#A9B1BA',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.65,
  },
  reconnectingBadge: {
    backgroundColor: 'rgba(10, 23, 29, 0.88)',
    borderColor: '#9A7427',
    borderRadius: 6,
    borderWidth: 1,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  reconnectingText: {
    color: '#E8B44A',
    fontSize: 11,
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#173139',
    borderColor: '#3A555D',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginTop: 14,
    minWidth: 88,
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: '#52D5C8',
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonBar: {
    backgroundColor: '#1B3037',
    bottom: '16%',
    position: 'absolute',
    width: '8%',
  },
  stateContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stateMessage: {
    color: '#89979D',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  stateTitle: {
    color: '#CDD5DA',
    fontSize: 16,
    fontWeight: '600',
  },
  statusDot: {
    borderRadius: 7,
    height: 14,
    marginLeft: 10,
    width: 14,
  },
  statusError: {
    backgroundColor: '#F04C57',
  },
  statusLive: {
    backgroundColor: '#18B7A8',
    borderColor: '#154B48',
    borderWidth: 4,
  },
  statusReconnecting: {
    backgroundColor: '#E8B44A',
  },
  toolbar: {
    alignItems: 'center',
    borderBottomColor: '#2B373D',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 52,
  },
  toolbarDivider: {
    backgroundColor: '#46535A',
    height: 28,
    marginLeft: 4,
    width: StyleSheet.hairlineWidth,
  },
  verticalCrosshair: {
    backgroundColor: '#A9B1BA',
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
});
