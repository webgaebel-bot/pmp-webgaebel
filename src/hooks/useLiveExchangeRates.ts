import { useEffect, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

type FxApiResponse = {
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
  time_last_updated?: number;
  date?: string;
};

type LiveExchangeRatesState = {
  isSyncing: boolean;
  error: Error | null;
  hasSynced: boolean;
};

const SESSION_STORAGE_KEY = 'pmp:live-exchange-rates:v1';
const FX_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

const REQUIRED_PAIRS = [
  ['USD', 'PKR'],
  ['PKR', 'USD'],
  ['USD', 'EUR'],
  ['EUR', 'USD'],
  ['USD', 'GBP'],
  ['GBP', 'USD'],
] as const;

const getRatesBucket = (response: FxApiResponse) => response.rates || response.conversion_rates || {};

const toRate = (value: unknown) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

const toInverseRate = (value: unknown) => {
  const sourceRate = toRate(value);
  if (!sourceRate) return null;

  return Number((1 / sourceRate).toFixed(8));
};

const getUpdatedAt = (response: FxApiResponse) => {
  if (typeof response.time_last_updated === 'number' && Number.isFinite(response.time_last_updated)) {
    return new Date(response.time_last_updated * 1000).toISOString();
  }

  if (typeof response.date === 'string' && response.date.trim()) {
    const parsedDate = new Date(response.date);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
  }

  return new Date().toISOString();
};

export const useLiveExchangeRates = (): LiveExchangeRatesState => {
  const [state, setState] = useState<LiveExchangeRatesState>({
    isSyncing: false,
    error: null,
    hasSynced: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSupabaseConfigured()) return;
    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY)) return;

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'pending');

    const controller = new AbortController();
    let isActive = true;

    const syncRates = async () => {
      setState((current) => ({ ...current, isSyncing: true, error: null }));

      try {
        const response = await fetch(FX_API_URL, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load FX rates: ${response.status}`);
        }

        const payload = (await response.json()) as FxApiResponse;
        const bucket = getRatesBucket(payload);
        const updatedAt = getUpdatedAt(payload);

        const rows = REQUIRED_PAIRS.map(([baseCurrency, targetCurrency]) => {
          if (baseCurrency === 'USD') {
            const directRate = toRate(bucket[targetCurrency]);
            return directRate
              ? { base_currency: baseCurrency, target_currency: targetCurrency, rate: directRate, updated_at: updatedAt }
              : null;
          }

          const sourceRate = toRate(bucket[baseCurrency]);
          const inverseRate = sourceRate ? toInverseRate(sourceRate) : null;

          return inverseRate && Number.isFinite(inverseRate) && inverseRate > 0
            ? { base_currency: baseCurrency, target_currency: targetCurrency, rate: inverseRate, updated_at: updatedAt }
            : null;
        }).filter(Boolean) as Array<{ base_currency: string; target_currency: string; rate: number; updated_at: string }>;

        if (!rows.length) {
          throw new Error('FX API response did not include the required currency pairs.');
        }

        const supabase = getSupabaseClient();
        const { error: upsertError } = await supabase
          .from('fx_rates')
          .upsert(rows, { onConflict: 'base_currency,target_currency' });

        if (upsertError) {
          throw upsertError;
        }

        const { error: refreshError } = await supabase.rpc('auto_convert_expense_currency');

        if (refreshError) {
          throw refreshError;
        }

        if (!isActive) return;

        window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'done');
        setState({ isSyncing: false, error: null, hasSynced: true });
      } catch (err) {
        if (!isActive) return;

        const isAbortError = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbortError) {
          setState({
            isSyncing: false,
            error: err instanceof Error ? err : new Error('Unable to sync live exchange rates.'),
            hasSynced: false,
          });
        }
      }
    };

    void syncRates().finally(() => {
      if (isActive) {
        setState((current) => ({ ...current, isSyncing: false }));
      }
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return state;
};

export default useLiveExchangeRates;
