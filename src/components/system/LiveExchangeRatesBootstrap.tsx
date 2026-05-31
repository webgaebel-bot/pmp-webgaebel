import { useLiveExchangeRates } from '@/hooks/useLiveExchangeRates';

export const LiveExchangeRatesBootstrap = () => {
  useLiveExchangeRates();
  return null;
};

export default LiveExchangeRatesBootstrap;
