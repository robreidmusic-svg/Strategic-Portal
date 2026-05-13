import { useMemo } from 'react';
import { FORECAST_MONTHS } from '../constants';
import { useApp } from '../context/AppContext';

export function useForecastStatus() {
  const { selectedForecastMonth } = useApp();

  const status = useMemo(() => {
    const currentMonthIndex = FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth);
    const monthName = FORECAST_MONTHS[currentMonthIndex]?.label || 'Unknown';
    
    // Q1 is Jan, Feb, Mar
    const isHistoricalMonth = currentMonthIndex >= 0 && currentMonthIndex <= 2;
    
    // Determine the "Current" index for calculation purposes (1-indexed for math)
    const monthNum = parseInt(selectedForecastMonth.split('-')[1]);
    const precedingMonths = monthNum - 1;

    return {
      monthName,
      monthIndex: currentMonthIndex,
      isHistoricalMonth,
      monthNum,
      precedingMonths,
      selectedForecastMonth
    };
  }, [selectedForecastMonth]);

  return status;
}
