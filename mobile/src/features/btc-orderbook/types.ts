export const BTC_ORDER_BOOK_AGGREGATIONS = [
  '5sf-1',
  '5sf-2',
  '5sf-5',
  '4sf',
  '3sf',
] as const;

export type BtcOrderBookAggregation =
  (typeof BTC_ORDER_BOOK_AGGREGATIONS)[number];

export interface BtcOrderBookLevel {
  readonly price: number;
  readonly size: number;
  readonly orderCount: number;
}

export interface BtcOrderBookSnapshot {
  readonly coin: 'BTC';
  readonly time: number;
  readonly bids: readonly BtcOrderBookLevel[];
  readonly asks: readonly BtcOrderBookLevel[];
}

export type BtcOrderBookStatus =
  | 'loading'
  | 'live'
  | 'reconnecting'
  | 'error';

export interface BtcOrderBookDataState {
  readonly snapshot: BtcOrderBookSnapshot | null;
  readonly status: BtcOrderBookStatus;
  readonly lastUpdatedAt: number | null;
  readonly error: Error | null;
}

export interface BtcOrderBookRestClient {
  fetchSnapshot(
    aggregation: BtcOrderBookAggregation,
    signal?: AbortSignal,
  ): Promise<BtcOrderBookSnapshot>;
}

export interface BtcOrderBookSocketSubscription {
  close(): void;
}

export interface BtcOrderBookSocketClient {
  subscribe(
    aggregation: BtcOrderBookAggregation,
    handlers: BtcOrderBookSocketHandlers,
  ): BtcOrderBookSocketSubscription;
}

export interface BtcOrderBookSocketHandlers {
  readonly onSnapshot: (snapshot: BtcOrderBookSnapshot) => void;
  readonly onDisconnect: (error: Error | null) => void;
}

