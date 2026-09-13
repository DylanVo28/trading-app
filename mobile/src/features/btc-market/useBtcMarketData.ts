import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchBtcMarketSnapshot } from './hyperliquid';
import { BtcMarketDataState, BtcMarketSnapshot } from './types';
import {
  BTC_ASSET_CONTEXT_SUBSCRIPTION,
  HYPERLIQUID_PING,
  HYPERLIQUID_WEBSOCKET_URL,
  parseBtcAssetContextMessage,
} from './websocket';

const HEARTBEAT_MS = 30_000;
const STALE_AFTER_MS = 15_000;
const FALLBACK_POLL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export interface UseBtcMarketDataResult extends BtcMarketDataState {
  retry: () => void;
}

export function useBtcMarketData(): UseBtcMarketDataResult {
  const [state, setState] = useState<BtcMarketDataState>({
    snapshot: null,
    status: 'loading',
    lastUpdatedAt: null,
    error: null,
  });
  const snapshotRef = useRef<BtcMarketSnapshot | null>(null);
  const startRef = useRef<(() => void) | null>(null);

  const retry = useCallback((): void => {
    startRef.current?.();
  }, []);

  useEffect(() => {
    let mounted = true;
    let appIsActive = AppState.currentState === 'active';
    let runId = 0;
    let reconnectAttempt = 0;
    let pollInFlight = false;
    let socket: WebSocket | null = null;
    let bootstrapAbort: AbortController | null = null;
    let pollAbort: AbortController | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    const isCurrentRun = (candidateRunId: number): boolean =>
      mounted && appIsActive && candidateRunId === runId;

    const clearTimer = (
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
      pollAbort?.abort();
      pollAbort = null;
      pollInFlight = false;
      heartbeatTimer = clearIntervalTimer(heartbeatTimer);
      fallbackPollTimer = clearIntervalTimer(fallbackPollTimer);
      reconnectTimer = clearTimer(reconnectTimer);
      staleTimer = clearTimer(staleTimer);

      const previousSocket = socket;
      socket = null;
      if (
        previousSocket !== null &&
        previousSocket.readyState !== WebSocket.CLOSED
      ) {
        previousSocket.close();
      }
    };

    const commitSnapshot = (
      nextSnapshot: BtcMarketSnapshot,
      status: BtcMarketDataState['status'],
    ): void => {
      const updatedAt = Date.now();
      snapshotRef.current = nextSnapshot;
      setState({
        snapshot: nextSnapshot,
        status,
        lastUpdatedAt: updatedAt,
        error: null,
      });
    };

    const setReconnecting = (error: Error | null = null): void => {
      setState((current) => ({
        ...current,
        snapshot: snapshotRef.current,
        status: snapshotRef.current === null ? 'loading' : 'reconnecting',
        error,
      }));
    };

    const pollRest = async (candidateRunId: number): Promise<void> => {
      if (!isCurrentRun(candidateRunId) || pollInFlight) {
        return;
      }

      pollInFlight = true;
      const controller = new AbortController();
      pollAbort = controller;
      try {
        const nextSnapshot = await fetchBtcMarketSnapshot({
          signal: controller.signal,
        });
        if (isCurrentRun(candidateRunId)) {
          commitSnapshot(nextSnapshot, 'reconnecting');
        }
      } catch {
        // Keep the last known snapshot while the socket is unavailable.
      } finally {
        if (pollAbort === controller) {
          pollAbort = null;
          pollInFlight = false;
        }
      }
    };

    const startFallbackPolling = (candidateRunId: number): void => {
      if (fallbackPollTimer !== null) {
        return;
      }
      fallbackPollTimer = setInterval(() => {
        void pollRest(candidateRunId);
      }, FALLBACK_POLL_MS);
    };

    const connectSocket = (candidateRunId: number): void => {
      if (!isCurrentRun(candidateRunId) || snapshotRef.current === null) {
        return;
      }

      reconnectTimer = clearTimer(reconnectTimer);
      const nextSocket = new WebSocket(HYPERLIQUID_WEBSOCKET_URL);
      socket = nextSocket;

      const scheduleStaleCheck = (): void => {
        staleTimer = clearTimer(staleTimer);
        staleTimer = setTimeout(() => {
          if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
            return;
          }
          setReconnecting();
          nextSocket.close();
        }, STALE_AFTER_MS);
      };

      const scheduleReconnect = (): void => {
        if (!isCurrentRun(candidateRunId) || reconnectTimer !== null) {
          return;
        }
        const exponentialDelay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttempt,
          MAX_RECONNECT_DELAY_MS,
        );
        const jitteredDelay = Math.min(
          exponentialDelay * (0.5 + Math.random()),
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectSocket(candidateRunId);
        }, jitteredDelay);
      };

      nextSocket.onopen = () => {
        if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
          nextSocket.close();
          return;
        }
        fallbackPollTimer = clearIntervalTimer(fallbackPollTimer);
        nextSocket.send(BTC_ASSET_CONTEXT_SUBSCRIPTION);
        heartbeatTimer = clearIntervalTimer(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          if (nextSocket.readyState === WebSocket.OPEN) {
            nextSocket.send(HYPERLIQUID_PING);
          }
        }, HEARTBEAT_MS);
        setState((current) => ({ ...current, status: 'live', error: null }));
        scheduleStaleCheck();
      };

      nextSocket.onmessage = (event: MessageEvent) => {
        if (!isCurrentRun(candidateRunId) || socket !== nextSocket) {
          return;
        }
        const previous = snapshotRef.current;
        if (previous === null) {
          return;
        }

        try {
          const nextSnapshot = parseBtcAssetContextMessage(
            event.data,
            previous,
          );
          if (nextSnapshot !== null) {
            reconnectAttempt = 0;
            commitSnapshot(nextSnapshot, 'live');
            scheduleStaleCheck();
          }
        } catch {
          // Ignore malformed updates and retain the last valid snapshot.
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
        staleTimer = clearTimer(staleTimer);
        setReconnecting();
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
      setReconnecting();
      const controller = new AbortController();
      bootstrapAbort = controller;

      void fetchBtcMarketSnapshot({ signal: controller.signal })
        .then((nextSnapshot) => {
          if (!isCurrentRun(candidateRunId)) {
            return;
          }
          bootstrapAbort = null;
          commitSnapshot(nextSnapshot, 'reconnecting');
          connectSocket(candidateRunId);
        })
        .catch((error: unknown) => {
          if (!isCurrentRun(candidateRunId)) {
            return;
          }
          bootstrapAbort = null;
          const normalizedError =
            error instanceof Error
              ? error
              : new Error('Unable to load BTC market data.');

          if (snapshotRef.current === null) {
            setState({
              snapshot: null,
              status: 'error',
              lastUpdatedAt: null,
              error: normalizedError,
            });
            return;
          }

          setReconnecting(normalizedError);
          connectSocket(candidateRunId);
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
  }, []);

  return { ...state, retry };
}
