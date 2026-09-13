import { HyperliquidMarketDataError } from './types';

const UNAVAILABLE_VALUE = '—';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

const compactUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const priceFormatters = new Map<number, Intl.NumberFormat>();
const signedPriceFormatters = new Map<number, Intl.NumberFormat>();

export function parseFiniteWireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw invalidNumber(field);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw invalidNumber(field);
  }

  const parsed: number = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw invalidNumber(field);
  }

  return parsed;
}

export function parseOptionalFiniteWireNumber(
  value: unknown,
  field: string,
): number | null {
  return value === null
    ? null
    : parseFiniteWireNumber(value, field);
}

export function formatMarketPrice(
  value: number | null | undefined,
  sizeDecimals = 5,
): string {
  if (!isFiniteNumber(value)) {
    return UNAVAILABLE_VALUE;
  }

  const fractionDigits = clampInteger(6 - sizeDecimals, 0, 6);
  let formatter = priceFormatters.get(fractionDigits);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    priceFormatters.set(fractionDigits, formatter);
  }

  return formatter.format(normalizeNegativeZero(value));
}

export function formatSignedMarketNumber(
  value: number | null | undefined,
  sizeDecimals = 5,
): string {
  if (!isFiniteNumber(value)) {
    return UNAVAILABLE_VALUE;
  }

  const fractionDigits = clampInteger(6 - sizeDecimals, 0, 6);
  let formatter = signedPriceFormatters.get(fractionDigits);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay: 'exceptZero',
    });
    signedPriceFormatters.set(fractionDigits, formatter);
  }

  return formatter.format(normalizeNegativeZero(value));
}

export function formatUsd(value: number | null | undefined): string {
  return formatFiniteNumber(value, usdFormatter);
}

export function formatSignedUsd(value: number | null | undefined): string {
  return formatFiniteNumber(value, signedUsdFormatter);
}

export function formatCompactUsd(value: number | null | undefined): string {
  return formatFiniteNumber(value, compactUsdFormatter);
}

export function formatSignedPercent(
  value: number | null | undefined,
  fractionDigits = 2,
): string {
  if (!isFiniteNumber(value)) {
    return UNAVAILABLE_VALUE;
  }

  const digits = clampInteger(fractionDigits, 0, 8);
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  });
  return `${formatter.format(normalizeNegativeZero(value))}%`;
}

export function formatFundingRate(
  fundingRate: number | null | undefined,
): string {
  if (!isFiniteNumber(fundingRate)) {
    return UNAVAILABLE_VALUE;
  }
  return formatPercentValue(fundingRate * 100, 4);
}

export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const hours = Math.floor(safeSeconds / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, '0'))
    .join(':');
}

function invalidNumber(field: string): HyperliquidMarketDataError {
  return new HyperliquidMarketDataError(
    'invalid-response',
    `Hyperliquid response contains an invalid number at ${field}.`,
  );
}

function formatPercentValue(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) {
    return UNAVAILABLE_VALUE;
  }
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${formatter.format(normalizeNegativeZero(value))}%`;
}

function formatFiniteNumber(
  value: number | null | undefined,
  formatter: Intl.NumberFormat,
): string {
  return isFiniteNumber(value)
    ? formatter.format(normalizeNegativeZero(value))
    : UNAVAILABLE_VALUE;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
