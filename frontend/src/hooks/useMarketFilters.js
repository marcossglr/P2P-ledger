import { useState, useMemo } from 'react';
import { parseSmartAmount } from '../utils/formatters';

export function useMarketFilters(onRefresh) {
  const [selectedBank, setSelectedBank] = useState(
    () => localStorage.getItem('p2p_chart_bank') || 'ALL'
  );
  const [amountFilter, setAmountFilter] = useState(
    () => localStorage.getItem('p2p_chart_amount') || ''
  );
  const [onlyMerchants, setOnlyMerchants] = useState(
    () => localStorage.getItem('p2p_chart_merchants') === 'true'
  );
  const [priceMode, setPriceMode] = useState(
    () => localStorage.getItem('p2p_chart_price_mode') || 'BEST'
  );

  const updateBank = (val) => {
    setSelectedBank(val);
    localStorage.setItem('p2p_chart_bank', val);
    if (onRefresh) onRefresh(true, val, parseSmartAmount(amountFilter));
  };

  const updateAmount = (val) => {
    setAmountFilter(val);
    localStorage.setItem('p2p_chart_amount', val);
    if (onRefresh) onRefresh(true, selectedBank, parseSmartAmount(val));
  };

  const updateMerchants = (val) => {
    setOnlyMerchants(val);
    localStorage.setItem('p2p_chart_merchants', String(val));
  };

  const updatePriceMode = (val) => {
    setPriceMode(val);
    localStorage.setItem('p2p_chart_price_mode', val);
  };

  const hasActiveFilters = useMemo(() => {
    return selectedBank !== 'ALL' || amountFilter !== '' || onlyMerchants;
  }, [selectedBank, amountFilter, onlyMerchants]);

  return {
    selectedBank,
    updateBank,
    amountFilter,
    updateAmount,
    onlyMerchants,
    updateMerchants,
    priceMode,
    updatePriceMode,
    hasActiveFilters,
  };
}
