import { useEffect, useState } from 'react';

const ONE_SECOND_MS = 1_000;
const ONE_HOUR_MS = 60 * 60 * ONE_SECOND_MS;

export function getSecondsUntilNextUtcHour(nowMs = Date.now()): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  const elapsedInHour = ((nowMs % ONE_HOUR_MS) + ONE_HOUR_MS) % ONE_HOUR_MS;
  return Math.ceil((ONE_HOUR_MS - elapsedInHour) / ONE_SECOND_MS);
}

export function useFundingCountdown(): number {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getSecondsUntilNextUtcHour(),
  );

  useEffect(() => {
    const updateCountdown = (): void => {
      setSecondsRemaining(getSecondsUntilNextUtcHour());
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, ONE_SECOND_MS);
    return () => clearInterval(timer);
  }, []);

  return secondsRemaining;
}
