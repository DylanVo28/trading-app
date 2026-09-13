import type {
  BtcOrderBookAggregation,
  BtcOrderBookSocketClient,
  BtcOrderBookSocketHandlers,
  BtcOrderBookSocketSubscription,
} from './types';

export type BtcOrderBookSubscriber = (
  aggregation: BtcOrderBookAggregation,
  handlers: BtcOrderBookSocketHandlers,
) => BtcOrderBookSocketSubscription;

/**
 * Defines the lifecycle boundary used by the hook. The concrete Hyperliquid
 * protocol, heartbeat and reconnect policy are added in Phase 3.
 */
export function createBtcOrderBookSocketClient(
  subscribe: BtcOrderBookSubscriber,
): BtcOrderBookSocketClient {
  return { subscribe };
}

