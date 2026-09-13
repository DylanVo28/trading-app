import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { calculateBtcMarketMetrics, MARKET_MOVE_COLORS } from './calculations';
import {
  formatCountdown,
  formatFundingRate,
  formatMarketPrice,
  formatSignedMarketNumber,
  formatSignedPercent,
  formatUsd,
} from './formatters';
import { useBtcMarketData } from './useBtcMarketData';
import { useFundingCountdown } from './useFundingCountdown';

const NARROW_LAYOUT_WIDTH = 360;

export interface BtcMarketHeaderProps {
  initialExpanded?: boolean;
}

export function BtcMarketHeader({
  initialExpanded = true,
}: BtcMarketHeaderProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_LAYOUT_WIDTH;
  const { snapshot, status, error, retry } = useBtcMarketData();
  const countdownSeconds = useFundingCountdown();
  const metrics = useMemo(
    () => (snapshot === null ? null : calculateBtcMarketMetrics(snapshot)),
    [snapshot],
  );

  if (status === 'loading' && snapshot === null) {
    return (
      <MarketHeaderSkeleton expanded={expanded} isNarrow={isNarrow} />
    );
  }

  if (status === 'error' && snapshot === null) {
    return (
      <View style={styles.errorContainer} accessibilityRole="alert">
        <Text style={styles.errorTitle}>BTC market unavailable</Text>
        <Text style={styles.errorMessage} numberOfLines={2}>
          {error?.message ?? 'Unable to load market data.'}
        </Text>
        <Pressable
          accessibilityLabel="Retry loading BTC market data"
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot === null || metrics === null) {
    return null;
  }

  const moveColor = MARKET_MOVE_COLORS[metrics.direction];
  const statusLabel = status === 'reconnecting' ? 'Reconnecting' : 'Live';

  return (
    <View
      accessibilityLabel={`BTC-USDC market header, ${statusLabel}`}
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.marketBlock}>
          <View style={styles.marketNameRow}>
            <BitcoinIcon />
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.marketName}
            >
              BTC-USDC
            </Text>
          </View>
          <View style={styles.leverageRow}>
            <Text
              accessibilityLabel={`Maximum leverage ${snapshot.maxLeverage} times`}
              style={styles.leverage}
            >
              {snapshot.maxLeverage}x
            </Text>
            <View
              accessibilityLabel={statusLabel}
              accessibilityRole="text"
              style={[
                styles.statusDot,
                status === 'reconnecting'
                  ? styles.statusReconnecting
                  : styles.statusLive,
              ]}
            />
          </View>
        </View>

        <View style={styles.priceBlock}>
          <Text
            accessibilityLabel={`BTC price ${formatMarketPrice(
              metrics.price,
              snapshot.szDecimals,
            )} US dollars`}
            numberOfLines={1}
            style={[styles.price, { color: moveColor }]}
          >
            {formatMarketPrice(metrics.price, snapshot.szDecimals)}
          </Text>
          <Text
            accessibilityLabel={`24 hour change ${formatSignedMarketNumber(
              metrics.priceChange,
              snapshot.szDecimals,
            )}, ${formatSignedPercent(metrics.priceChangePercent)}`}
            numberOfLines={1}
            style={[styles.priceChange, { color: moveColor }]}
          >
            {formatSignedMarketNumber(
              metrics.priceChange,
              snapshot.szDecimals,
            )}{' '}
            / {formatSignedPercent(metrics.priceChangePercent)}
          </Text>
        </View>

        <Pressable
          accessibilityLabel={
            expanded ? 'Collapse BTC market details' : 'Expand BTC market details'
          }
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={6}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [
            styles.expandControl,
            pressed && styles.controlPressed,
          ]}
        >
          <View
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.chevron,
              expanded ? styles.chevronUp : styles.chevronDown,
            ]}
          />
        </Pressable>
      </View>

      {expanded ? (
        <View
          style={[
            styles.metricsGrid,
            isNarrow && styles.metricsGridNarrow,
          ]}
        >
          <Metric
            label="Mark / Oracle"
            narrow={isNarrow}
            value={`${formatMarketPrice(
              snapshot.markPx,
              snapshot.szDecimals,
            )} / ${formatMarketPrice(snapshot.oraclePx, snapshot.szDecimals)}`}
          />
          <Metric
            label="24h Volume"
            narrow={isNarrow}
            value={formatUsd(snapshot.dayNtlVlm)}
          />
          <Metric
            label="Open Interest"
            narrow={isNarrow}
            value={formatUsd(metrics.openInterestUsd)}
          />
          <Metric
            label="Funding / Countdown"
            narrow={isNarrow}
            value={
              <Text style={styles.metricValue}>
                <Text style={styles.fundingValue}>
                  {formatFundingRate(snapshot.funding)}
                </Text>
                {'   '}
                {formatCountdown(countdownSeconds)}
              </Text>
            }
            valueAccessibilityLabel={`${formatFundingRate(
              snapshot.funding,
            )}, ${formatCountdown(countdownSeconds)} remaining`}
          />
        </View>
      ) : null}
    </View>
  );
}

function BitcoinIcon() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.bitcoinIcon}
    >
      <Text style={styles.bitcoinSymbol}>₿</Text>
    </View>
  );
}

interface MetricProps {
  label: string;
  narrow?: boolean;
  value: string | React.ReactNode;
  valueAccessibilityLabel?: string;
}

function Metric({
  label,
  narrow = false,
  value,
  valueAccessibilityLabel,
}: MetricProps) {
  const accessibleValue =
    valueAccessibilityLabel ?? (typeof value === 'string' ? value : '');

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${accessibleValue}`}
      style={[styles.metric, narrow && styles.metricNarrow]}
    >
      <View style={styles.metricLabelUnderline}>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text numberOfLines={1} style={styles.metricValue}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

function MarketHeaderSkeleton({
  expanded,
  isNarrow,
}: {
  expanded: boolean;
  isNarrow: boolean;
}) {
  return (
    <View
      accessibilityLabel="Loading BTC market data"
      accessibilityRole="progressbar"
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={[styles.skeleton, styles.skeletonMarket]} />
        <View style={[styles.skeleton, styles.skeletonPrice]} />
        <View style={[styles.skeleton, styles.skeletonControl]} />
      </View>
      {expanded ? (
        <View
          style={[
            styles.metricsGrid,
            isNarrow && styles.metricsGridNarrow,
          ]}
        >
          {Array.from({ length: 4 }, (_, index) => (
            <View
              key={index}
              style={[styles.metric, isNarrow && styles.metricNarrow]}
            >
              <View style={[styles.skeleton, styles.skeletonLabel]} />
              <View style={[styles.skeleton, styles.skeletonValue]} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bitcoinIcon: {
    alignItems: 'center',
    backgroundColor: '#F7931A',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginRight: 8,
    width: 20,
  },
  bitcoinSymbol: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  chevron: {
    borderColor: '#ECF2F4',
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    height: 10,
    width: 10,
  },
  chevronDown: {
    marginBottom: 5,
    transform: [{ rotate: '135deg' }],
  },
  chevronUp: {
    marginTop: 5,
    transform: [{ rotate: '-45deg' }],
  },
  container: {
    alignSelf: 'stretch',
    backgroundColor: '#0A171D',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  controlPressed: {
    opacity: 0.65,
  },
  errorContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#0A171D',
    minHeight: 168,
    padding: 24,
  },
  errorMessage: {
    color: '#94A3A8',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#ECF2F4',
    fontSize: 18,
    fontWeight: '600',
  },
  expandControl: {
    alignItems: 'center',
    backgroundColor: '#142128',
    borderColor: '#26343A',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    marginLeft: 6,
    width: 32,
  },
  fundingValue: {
    color: '#36D6CB',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  leverage: {
    color: '#36D6CB',
    fontSize: 12,
    lineHeight: 15,
  },
  leverageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 28,
    marginTop: 4,
  },
  marketBlock: {
    flexBasis: '50%',
    flexShrink: 1,
  },
  marketName: {
    color: '#ECF2F4',
    flexShrink: 1,
    fontSize: 21,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 25,
  },
  marketNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 25,
  },
  metric: {
    flexBasis: '50%',
    minWidth: 0,
    paddingRight: 8,
  },
  metricNarrow: {
    flexBasis: 'auto',
    paddingRight: 0,
    width: '100%',
  },
  metricLabel: {
    color: '#96A1A5',
    fontSize: 14,
    lineHeight: 17,
  },
  metricLabelUnderline: {
    alignSelf: 'flex-start',
    borderBottomColor: '#96A1A5',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  metricValue: {
    color: '#ECF2F4',
    fontSize: 15,
    lineHeight: 19,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 18,
    marginTop: 16,
  },
  metricsGridNarrow: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  price: {
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 26,
  },
  priceBlock: {
    flex: 1,
    minWidth: 0,
  },
  priceChange: {
    fontSize: 14,
    lineHeight: 17,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: '#36D6CB',
    borderRadius: 8,
    marginTop: 16,
    minHeight: 44,
    minWidth: 92,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryText: {
    color: '#07151B',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  skeleton: {
    backgroundColor: '#1D2B31',
    borderRadius: 6,
  },
  skeletonControl: {
    height: 32,
    marginLeft: 6,
    width: 32,
  },
  skeletonLabel: {
    height: 12,
    width: '58%',
  },
  skeletonMarket: {
    height: 38,
    width: '43%',
  },
  skeletonPrice: {
    flex: 1,
    height: 34,
    marginLeft: 8,
  },
  skeletonValue: {
    height: 16,
    marginTop: 5,
    width: '82%',
  },
  statusDot: {
    borderRadius: 4,
    height: 5,
    marginLeft: 6,
    width: 5,
  },
  statusLive: {
    backgroundColor: '#36D6CB',
  },
  statusReconnecting: {
    backgroundColor: '#F59E0B',
  },
});
