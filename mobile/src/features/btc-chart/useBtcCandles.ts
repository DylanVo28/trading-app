import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  BTC_CHART_FALLBACK_POLL_MS,
  BTC_CHART_HEARTBEAT_MS,
  BTC_CHART_INITIAL_RECONNECT_DELAY_MS,
  BTC_CHART_MAX_RECONNECT_DELAY_MS,
  HYPERLIQUID_WEBSOCKET_URL,
} from './constants';
import { fetchBtcCandles } from './hyperliquid';
import type {
  BtcCandle,
  BtcChartDataState,
  BtcChartDataStatus,
  BtcChartInterval,
} from './types';
import {
  createBtcCandleSubscription,
  HYPERLIQUID_PING_MESSAGE,
  mergeBtcCandles,
  parseBtcCandleMessage,
} from './websocket';

interface CachedCandles {
  readonly candles: readonly BtcCandle[];
  readonly lastUpdatedAt: number;
}

interface IntervalCandleState extends BtcChartDataState {
  readonly interval: BtcChartInterval;
}

export interface UseBtcCandlesResult extends BtcChartDataState {
  readonly retry: () => void;
}

export function useBtcCandles(
  interval: BtcChartInterval,
): UseBtcCandlesResult {
  const cacheRef = useRef(new Map<BtcChartInterval, CachedCandles>());
  const candlesRef = useRef<readonly BtcCandle[]>([]);
  const lastUpdatedAtRef = useRef<number | null>(null);
  const startRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<IntervalCandleState>({
    interval,
    candles: [],
    status: 'loading',
    lastUpdatedAt: null,
    error: null,
  });

  const retry = useCallback((): void => {
    startRef.current?.();
  }, []);

  useEffect(() => {
    let mounted = true;
    let appIsActive = AppState.currentState === 'active';
    let runId = 0;
    let reconnectAttempt = 0;
    let refreshInFlight = false;
    let socket: WebSocket | null = null;
    let bootstrapAbort: AbortController | null = null;
    let refreshAbort: AbortController | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const cached = cacheRef.current.get(interval);
    candlesRef.current = cached?.candles ?? [];
    lastUpdatedAtRef.current = cached?.lastUpdatedAt ?? null;
    setState({
      interval,
      candles: candlesRef.current,
      status: candlesRef.current.length === 0 ? 'loading' : 'reconnecting',
      lastUpdatedAt: lastUpdatedAtRef.current,
      error: null,
    });

    const isCurrentRun = (candidateRunId: number): boolean =>
      mounted && appIsActive && candidateRunId === runId;

    const clearTimeoutTimer = (
      timer: ReturnType<typeof setTimeout> | null,
    ): null => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      return null;
    };

    const clearIntervalTimer = (
      timer: ReturnType<typeof setInterval> | null,
    ): null => {
      if (timer !== null) {
        clearInterval(timer);
      }
      return null;
    };

    const stopRun = (): void => {
      runId += 1;
      bootstrapAbort?.abort();
      bootstrapAbort = null;
      refreshAbort?.abort();
      refreshAbort = null;
      refreshInFlight = false;
      heartbeatTimer = clearIntervalTimer(heartbeatTimer);
      fallbackPollTimer = clearIntervalTimer(fallbackPollTimer);
      reconnectTimer = clearTimeoutTimer(reconnectTimer);

      const previousSocket = socket;
      socket = null;
      if (
        previousSocket !== null &&
        previousSocket.readyState !== WebSocket.CLOSED
      ) {
        previousSocket.close();
      }
    };

    const commitCandles = (
      nextCandles: readonly BtcCandle[],
      status: BtcChartDataStatus,
    ): void => {
      const updatedAt = Date.now();
      candlesRef.current = nextCandles;
      lastUpdatedAtRef.current = updatedAt;
      cacheRef.current.set(interval, {
        candles: nextCandles,
        lastUpdatedAt: updatedAt,
      });
      setState({
        interval,
        candles: nextCandles,
        status,
        lastUpdatedAt: updatedAt,
        error: null,
      });
    };

    const setConnectionStatus = (
      requestedStatus: 'live' | 'reconnecting',
      error: Error | null = null,
    ): void => {
      const status =
        requestedStatus === 'reconnecting' && candlesRef.current.length === 0
          ? 'loading'
          : requestedStatus;
      setState({
        interval,
        candles: candlesRef.current,
        status,
        lastUpdatedAt: lastUpdatedAtRef.current,
        error,
      });
    };

    const refreshRest = async (candidateRunId: number): Promise<void> => {
      if (!isCurrentRun(candidateRunId) || refreshInFlight) {
        return;
      }

      refreshInFlight = true;
      const controller = new AbortController();
      refreshAbort = controller;

      try {
        const snapshot = await fetchBtcCandles(interval, {
          signal: controller.signal,
        });
        if (!isCurrentRun(candidateRunId)) {
          return;
        }

        const nextCandles = mergeBtcCandles(candlesRef.current, snapshot);
        const socketIsOpen = socket?.readyState === WebSocket.OPEN;
        commitCandles(nextCandles, socketIsOpen ? 'live' : 'reconnecting');
      } catch {
        // Retain the last valid candles while reconnecting.
      } finally {
        if (refreshAbort === controller) {
          refreshAbort = null;
          refreshInFlight = false;
        }
      }
    };

    const startFallbackPolling = (candidateRunId: number): void => {
      if (fallbackPollTimer !== null) {
        return;
      }

      void refreshRest(candidateRunId);
      fallbackPollTimer = setInterval(() => {
        void refreshRest(candidateRunId);
      }, BTC_CHART_FALLBACK_POLL_MS);
    };

    const connectSocket = (
      candidateRunId: number,
      backfillOnOpen: boolean,
    ): void => {
      if (!isCurrentRun(candidateRunId)) {
        return;
      }

      reconnectTimer = clearTimeoutTimer(reconnectTimer);
      const nextSocket = new WebSocket(HYPERLIQUID_WEBSOCKET_URL);
      socket = nextSocket;

      const scheduleReconnect = (): void => {
        if (!isCurrentRun(candidateRunId) || reconnectTimer !== null) {
          return;
        }

        const exponentialDelay = Math.min(
          BTC_CHART_INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
          BTC_CHART_MAX_RECONNECT_DELAY_MS,
        );
        const jitteredDelay = Math.min(
          exponentialDelay * (0.5 + Math.random()),
          BTC_CHART_MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectSocket(candidateRunId, true);
        }, jitteredDelay);
      };

      nextSocket.onopen = () => {
        if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
          nextSocket.close();
          return;
        }

        try {
          nextSocket.send(createBtcCandleSubscription(interval));
        } catch {
          nextSocket.close();
          return;
        }

        fallbackPollTimer = clearIntervalTimer(fallbackPollTimer);
        heartbeatTimer = clearIntervalTimer(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          if (nextSocket.readyState !== WebSocket.OPEN) {
            return;
          }
          try {
            nextSocket.send(HYPERLIQUID_PING_MESSAGE);
          } catch {
            nextSocket.close();
          }
        }, BTC_CHART_HEARTBEAT_MS);
        setConnectionStatus('live');

        if (backfillOnOpen) {
          void refreshRest(candidateRunId);
        }
      };

      nextSocket.onmessage = (event: MessageEvent) => {
        if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
          return;
        }

        try {
          const candle = parseBtcCandleMessage(event.data, interval);
          if (candle === null) {
            return;
          }

          reconnectAttempt = 0;
          commitCandles(
            mergeBtcCandles(candlesRef.current, [candle]),
            'live',
          );
        } catch {
          // Ignore malformed realtime messages and keep the last valid state.
        }
      };

      nextSocket.onerror = () => {
        if (isCurrentRun(candidateRunId) && socket === nextSocket) {
          nextSocket.close();
        }
      };

      nextSocket.onclose = () => {
        if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
          return;
        }

        socket = null;
        heartbeatTimer = clearIntervalTimer(heartbeatTimer);
        setConnectionStatus('reconnecting');
        startFallbackPolling(candidateRunId);
        scheduleReconnect();
      };
    };

    const start = (): void => {
      stopRun();
      if (!mounted || !appIsActive) {
        return;
      }

      const candidateRunId = runId;
      reconnectAttempt = 0;
      setConnectionStatus('reconnecting');
      const controller = new AbortController();
      bootstrapAbort = controller;

      void fetchBtcCandles(interval, { signal: controller.signal })
        .then((snapshot) => {
          if (!isCurrentRun(candidateRunId)) {
            return;
          }

          bootstrapAbort = null;
          commitCandles(
            mergeBtcCandles(candlesRef.current, snapshot),
            'reconnecting',
          );
          connectSocket(candidateRunId, false);
        })
        .catch((error: unknown) => {
          if (!isCurrentRun(candidateRunId)) {
            return;
          }

          bootstrapAbort = null;
          const normalizedError =
            error instanceof Error
              ? error
              : new Error('Unable to load BTC candles.');

          if (candlesRef.current.length === 0) {
            setState({
              interval,
              candles: [],
              status: 'error',
              lastUpdatedAt: null,
              error: normalizedError,
            });
            return;
          }

          setConnectionStatus('reconnecting', normalizedError);
          connectSocket(candidateRunId, true);
          startFallbackPolling(candidateRunId);
        });
    };

    startRef.current = start;
    if (appIsActive) {
      start();
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState) => {
        const nextIsActive = nextAppState === 'active';
        if (nextIsActive === appIsActive) {
          return;
        }

        appIsActive = nextIsActive;
        if (appIsActive) {
          start();
        } else {
          stopRun();
        }
      },
    );

    return () => {
      mounted = false;
      startRef.current = null;
      appStateSubscription.remove();
      stopRun();
    };
  }, [interval]);

  if (state.interval !== interval) {
    const cached = cacheRef.current.get(interval);
    return {
      candles: cached?.candles ?? [],
      status: cached === undefined ? 'loading' : 'reconnecting',
      lastUpdatedAt: cached?.lastUpdatedAt ?? null,
      error: null,
      retry,
    };
  }

  return {
    candles: state.candles,
    status: state.status,
    lastUpdatedAt: state.lastUpdatedAt,
    error: state.error,
    retry,
  };
}
