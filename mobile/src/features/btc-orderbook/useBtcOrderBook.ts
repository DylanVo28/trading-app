import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  BtcOrderBookAggregation,
  BtcOrderBookDataState,
  BtcOrderBookRestClient,
  BtcOrderBookSocketClient,
} from './types';

export interface UseBtcOrderBookOptions {
  readonly aggregation: BtcOrderBookAggregation;
  readonly enabled: boolean;
  readonly restClient?: BtcOrderBookRestClient;
  readonly socketClient?: BtcOrderBookSocketClient;
}

export interface UseBtcOrderBookResult extends BtcOrderBookDataState {
  readonly retry: () => void;
}

const INITIAL_STATE: BtcOrderBookDataState = {
  snapshot: null,
  status: 'loading',
  lastUpdatedAt: null,
  error: null,
};

export function useBtcOrderBook({
  aggregation,
  enabled,
  restClient,
  socketClient,
}: UseBtcOrderBookOptions): UseBtcOrderBookResult {
  const [state, setState] = useState<BtcOrderBookDataState>(INITIAL_STATE);
  const [retryVersion, setRetryVersion] = useState(0);
  const snapshotRef = useRef(state.snapshot);
  const lastUpdatedAtRef = useRef(state.lastUpdatedAt);

  const retry = useCallback((): void => {
    setRetryVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const hasDataClient = restClient !== undefined || socketClient !== undefined;

    setState({
      snapshot: null,
      status: 'loading',
      lastUpdatedAt: null,
      error: null,
    });
    snapshotRef.current = null;
    lastUpdatedAtRef.current = null;

    const subscription = socketClient?.subscribe(aggregation, {
      onSnapshot: (snapshot) => {
        if (!active) {
          return;
        }
        const lastUpdatedAt = Date.now();
        snapshotRef.current = snapshot;
        lastUpdatedAtRef.current = lastUpdatedAt;
        setState({
          snapshot,
          status: 'live',
          lastUpdatedAt,
          error: null,
        });
      },
      onDisconnect: (error) => {
        if (!active) {
          return;
        }
        const snapshot = snapshotRef.current;
        if (snapshot === null) {
          setState({
            snapshot: null,
            status: 'error',
            lastUpdatedAt: null,
            error,
          });
          return;
        }

        setState({
          snapshot,
          status: 'reconnecting',
          lastUpdatedAt: lastUpdatedAtRef.current,
          error,
        });
      },
    });

    if (restClient !== undefined) {
      void restClient.fetchSnapshot(aggregation, controller.signal)
        .then((snapshot) => {
          if (!active || snapshotRef.current !== null) {
            return;
          }
          const lastUpdatedAt = Date.now();
          snapshotRef.current = snapshot;
          lastUpdatedAtRef.current = lastUpdatedAt;
          setState({
            snapshot,
            status: 'reconnecting',
            lastUpdatedAt,
            error: null,
          });
        })
        .catch((error: unknown) => {
          if (!active || controller.signal.aborted || snapshotRef.current !== null) {
            return;
          }
          let normalizedError = new Error('Unable to load the BTC order book.');
          if (error instanceof Error) {
            normalizedError = error;
          }
          setState({
            snapshot: null,
            status: 'error',
            lastUpdatedAt: null,
            error: normalizedError,
          });
        });
    } else if (!hasDataClient) {
      setState(INITIAL_STATE);
    }

    return () => {
      active = false;
      controller.abort();
      if (subscription !== undefined) {
        subscription.close();
      }
    };
  }, [aggregation, enabled, restClient, retryVersion, socketClient]);

  return {
    snapshot: state.snapshot,
    status: state.status,
    lastUpdatedAt: state.lastUpdatedAt,
    error: state.error,
    retry,
  };
}
