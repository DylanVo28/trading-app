import type {
  BtcOrderBookAggregation,
  BtcOrderBookRestClient,
  BtcOrderBookSnapshot,
} from './types';

export type BtcOrderBookSnapshotFetcher = (
  aggregation: BtcOrderBookAggregation,
  signal?: AbortSignal,
) => Promise<BtcOrderBookSnapshot>;

/**
 * Keeps the hook coupled to a small client interface. The Hyperliquid request
 * and validation implementation is supplied in Phase 2.
 */
export function createBtcOrderBookRestClient(
  fetchSnapshot: BtcOrderBookSnapshotFetcher,
): BtcOrderBookRestClient {
  return { fetchSnapshot };
}

