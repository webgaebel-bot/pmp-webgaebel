export type CurrencyRateRow = {
  base_currency: string;
  target_currency: string;
  rate: number;
  updated_at?: string | null;
};

export type CurrencySnapshot = {
  base_currency: string;
  converted_amount: number;
  exchange_rate: number;
  fx_rate_used: number;
  fx_timestamp: string;
  original_amount: number;
  original_currency: string;
};

type CurrencyServiceDeps = {
  getBaseCurrency: () => Promise<string>;
  getFxRates: () => Promise<CurrencyRateRow[]>;
};

const DEFAULT_FX_RATE_ROWS: CurrencyRateRow[] = [
  { base_currency: 'USD', target_currency: 'PKR', rate: 278.14 },
  { base_currency: 'PKR', target_currency: 'USD', rate: 0.00359592 },
  { base_currency: 'USD', target_currency: 'EUR', rate: 0.86206897 },
  { base_currency: 'EUR', target_currency: 'USD', rate: 1.16 },
  { base_currency: 'USD', target_currency: 'GBP', rate: 0.74626866 },
  { base_currency: 'GBP', target_currency: 'USD', rate: 1.34 },
  { base_currency: 'USD', target_currency: 'AED', rate: 3.7037037 },
  { base_currency: 'AED', target_currency: 'USD', rate: 0.27 },
  { base_currency: 'EUR', target_currency: 'PKR', rate: 322.9 },
  { base_currency: 'PKR', target_currency: 'EUR', rate: 0.00309663 },
  { base_currency: 'GBP', target_currency: 'PKR', rate: 374.36 },
  { base_currency: 'PKR', target_currency: 'GBP', rate: 0.00267056 },
  { base_currency: 'AED', target_currency: 'PKR', rate: 75.86 },
  { base_currency: 'PKR', target_currency: 'AED', rate: 0.01318194 },
];

const roundTo = (value: number, digits = 4) => {
  const factor = Math.pow(10, digits);
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const normalizeCode = (value: string | null | undefined, fallback = 'USD') => {
  const normalized = String(value || fallback).trim().toUpperCase();
  return normalized || fallback;
};

const buildRateLookup = (rates: CurrencyRateRow[]) => {
  const lookup = new Map<string, { rate: number; timestamp: string }>();

  rates.forEach((row) => {
    const base = normalizeCode(row.base_currency);
    const target = normalizeCode(row.target_currency);
    const rate = Number(row.rate);
    if (!base || !target || !Number.isFinite(rate) || rate <= 0) return;

    const timestamp = row.updated_at || new Date().toISOString();
    lookup.set(`${base}->${target}`, { rate, timestamp });
    lookup.set(`${target}->${base}`, { rate: 1 / rate, timestamp });
  });

  DEFAULT_FX_RATE_ROWS.forEach((row) => {
    const base = normalizeCode(row.base_currency);
    const target = normalizeCode(row.target_currency);
    const rate = Number(row.rate);
    if (!base || !target || !Number.isFinite(rate) || rate <= 0) return;
    const timestamp = row.updated_at || new Date().toISOString();
    const directKey = `${base}->${target}`;
    const inverseKey = `${target}->${base}`;
    if (!lookup.has(directKey)) lookup.set(directKey, { rate, timestamp });
    if (!lookup.has(inverseKey)) lookup.set(inverseKey, { rate: 1 / rate, timestamp });
  });

  return lookup;
};

const resolveRate = (lookup: Map<string, { rate: number; timestamp: string }>, fromCurrency: string, toCurrency: string) => {
  const normalizedFrom = normalizeCode(fromCurrency);
  const normalizedTo = normalizeCode(toCurrency);
  if (normalizedFrom === normalizedTo) return lookup.get(`${normalizedFrom}->${normalizedTo}`) || { rate: 1, timestamp: new Date().toISOString() };

  const direct = lookup.get(`${normalizedFrom}->${normalizedTo}`);
  if (direct && Number.isFinite(direct.rate) && direct.rate > 0) return direct;

  const inverse = lookup.get(`${normalizedTo}->${normalizedFrom}`);
  if (inverse && Number.isFinite(inverse.rate) && inverse.rate > 0) {
    return { rate: 1 / inverse.rate, timestamp: inverse.timestamp };
  }

  for (const [key, value] of lookup.entries()) {
    const [source, intermediate] = key.split('->');
    if (source !== normalizedFrom) continue;
    const viaTarget = lookup.get(`${intermediate}->${normalizedTo}`);
    if (viaTarget && viaTarget.rate > 0) {
      return { rate: value.rate * viaTarget.rate, timestamp: value.timestamp || viaTarget.timestamp };
    }
    const viaInverse = lookup.get(`${normalizedTo}->${intermediate}`);
    if (viaInverse && viaInverse.rate > 0) {
      return { rate: value.rate / viaInverse.rate, timestamp: value.timestamp || viaInverse.timestamp };
    }
  }

  return null;
};

const resolveSnapshot = async (
  deps: CurrencyServiceDeps,
  originalAmount: number,
  originalCurrency: string,
  baseCurrencyOverride?: string
): Promise<CurrencySnapshot> => {
  const baseCurrency = normalizeCode(baseCurrencyOverride || (await deps.getBaseCurrency()));
  const originalCurrencyCode = normalizeCode(originalCurrency, baseCurrency);
  const amount = Number(originalAmount || 0);

  if (!Number.isFinite(amount)) {
    throw new Error('Finance conversion requires a numeric amount.');
  }

  if (amount < 0) {
    throw new Error('Finance conversion does not accept negative amounts.');
  }

  if (!amount) {
    return {
      original_amount: 0,
      original_currency: originalCurrencyCode,
      base_currency: baseCurrency,
      exchange_rate: 1,
      fx_rate_used: 1,
      fx_timestamp: new Date().toISOString(),
      converted_amount: 0,
    };
  }

  if (originalCurrencyCode === baseCurrency) {
    const timestamp = new Date().toISOString();
    return {
      original_amount: roundTo(amount),
      original_currency: originalCurrencyCode,
      base_currency: baseCurrency,
      exchange_rate: 1,
      fx_rate_used: 1,
      fx_timestamp: timestamp,
      converted_amount: roundTo(amount),
    };
  }

  const lookup = buildRateLookup(await deps.getFxRates());
  const direct = resolveRate(lookup, originalCurrencyCode, baseCurrency);
  if (!direct || !Number.isFinite(direct.rate) || direct.rate <= 0) {
    throw new Error(`Missing FX rate for ${originalCurrencyCode} -> ${baseCurrency}.`);
  }

  const convertedAmount = roundTo(amount * direct.rate);
  return {
    original_amount: roundTo(amount),
    original_currency: originalCurrencyCode,
    base_currency: baseCurrency,
    exchange_rate: roundTo(direct.rate, 8),
    fx_rate_used: roundTo(direct.rate, 8),
    fx_timestamp: direct.timestamp || new Date().toISOString(),
    converted_amount: convertedAmount,
  };
};

export const createCurrencyService = (deps: CurrencyServiceDeps) => ({
  resolveSnapshot: (amount: number, originalCurrency: string, baseCurrencyOverride?: string) =>
    resolveSnapshot(deps, amount, originalCurrency, baseCurrencyOverride),
  normalizeRecord: async (
    record: Record<string, any>,
    amountKey = 'amount',
    currencyKey = 'currency',
    baseCurrencyOverride?: string
  ) => {
    const snapshot = await resolveSnapshot(
      deps,
      Number(record?.[amountKey] || 0),
      String(record?.[currencyKey] || 'USD'),
      baseCurrencyOverride
    );

    return {
      ...record,
      original_amount: snapshot.original_amount,
      original_currency: snapshot.original_currency,
      base_currency: snapshot.base_currency,
      exchange_rate: snapshot.exchange_rate,
      converted_amount: snapshot.converted_amount,
      fx_rate_used: snapshot.fx_rate_used,
      fx_timestamp: snapshot.fx_timestamp,
    };
  },
});

export type CurrencyService = ReturnType<typeof createCurrencyService>;
