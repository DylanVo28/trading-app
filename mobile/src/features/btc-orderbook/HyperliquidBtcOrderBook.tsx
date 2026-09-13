import { StyleSheet, Text, View } from 'react-native';

import { normalizeOrderBookRows } from './calculations';
import {
  DEFAULT_BTC_ORDER_BOOK_AGGREGATION,
  DEFAULT_BTC_ORDER_BOOK_ROWS,
} from './constants';
import type { BtcOrderBookAggregation } from './types';
import { useBtcOrderBook } from './useBtcOrderBook';

export type { BtcOrderBookAggregation } from './types';

export interface HyperliquidBtcOrderBookProps {
  readonly initialAggregation?: BtcOrderBookAggregation;
  readonly rows?: number;
  readonly enabled?: boolean;
}

export function HyperliquidBtcOrderBook({
  initialAggregation = DEFAULT_BTC_ORDER_BOOK_AGGREGATION,
  rows = DEFAULT_BTC_ORDER_BOOK_ROWS,
  enabled = true,
}: HyperliquidBtcOrderBookProps) {
  const normalizedRows = normalizeOrderBookRows(rows);
  const { status } = useBtcOrderBook({
    aggregation: initialAggregation,
    enabled,
  });

  return (
    <View
      accessibilityLabel={`BTC order book, ${normalizedRows} rows, ${status}`}
      style={styles.container}
    >
      <Text style={styles.title}>Order Book</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#07151B',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  status: {
    color: '#78909C',
    fontSize: 12,
    marginTop: 4,
  },
  title: {
    color: '#F4F7F8',
    fontSize: 16,
    fontWeight: '600',
  },
});

