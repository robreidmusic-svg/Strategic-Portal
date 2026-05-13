import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useForecastStatus } from '../hooks/useForecastStatus';
import { UNITS, FORECAST_MONTHS } from '../constants';
import { Opportunity } from '../types';
import { formatCurrency, cn, formatWeekDate } from '../lib/utils';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, AreaChart, Area, Cell, PieChart, Pie,
  LabelList
} from 'recharts';
import { BarChart3, TrendingUp, Users, Target, X, Briefcase, AlertCircle, RotateCcw, History, Pencil, ListTodo } from 'lucide-react';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { GlobalPrioritiesOverview } from './GlobalPrioritiesOverview';
import { motion, AnimatePresence } from 'motion/react';

export function GroupOverview() {
  const { forecastHistory, quotas, opportunities, unitOpportunities, selectedForecastMonth, churnEntries } = useApp();
  const { monthName } = useForecastStatus();
  const [isLiveYtd, setIsLiveYtd] = React.useState(false);
  const [isCallDetailsOpen, setIsCallDetailsOpen] = React.useState(false);

  // LOGIC: Auto-update on the 1st of each month to show Jan - Previous Month
  const ytdConfig = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0-indexed (0=Jan, 3=April)
    
    if (isLiveYtd) {
      // Live View: Jan - Current Month (Dynamic)
      const currentMonthValue = now.toISOString().slice(0, 7); // e.g. "2026-04"
      const currentMonthLabel = FORECAST_MONTHS.find(m => m.value === currentMonthValue)?.label || 'Current';
      
      return {
        count: currentMonthIndex + 1, // e.g., in April (3), Jan-Apr is 4 months
        targetMonthValue: currentMonthValue,
        label: currentMonthLabel,
        year: currentYear,
        isLive: true
      };
    } else {
      // Standard View: Jan - Current Month (Default)
      // This ensures "This number" includes deals closed in the current month as requested
      const currentMonthValue = now.toISOString().slice(0, 7);
      const currentMonthLabel = FORECAST_MONTHS.find(m => m.value === currentMonthValue)?.label || 'Current';

      return {
        count: currentMonthIndex + 1,
        targetMonthValue: currentMonthValue,
        label: currentMonthLabel,
        year: currentYear,
        isLive: false
      };
    }
  }, [isLiveYtd]);

  // 0.1 Churn Aggregation
  const churnStats = useMemo(() => {
    let monthlyClosedVal = 0;
    let ytdClosedVal = 0;
    let groupCall = 0;

    // 1. Booked Churn (Group Level)
    const currentActualMonth = new Date().toISOString().slice(0, 7);
    churnEntries.forEach(c => {
      if (c.month === selectedForecastMonth) monthlyClosedVal += c.mrc;
      // Churn YTD is inclusive of current live month as per user request
      if (c.month <= currentActualMonth) ytdClosedVal += c.mrc;
    });

    // 2. Churn Call (from latest unit submissions)
    UNITS.forEach(unit => {
      const latest = forecastHistory
        .filter(f => f.unit === unit && f.month === selectedForecastMonth)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      if (latest && latest.churnCall) {
        groupCall += Number(latest.churnCall) || 0;
      }
    });

    return { monthlyClosed: monthlyClosedVal, ytdClosed: ytdClosedVal, groupCall };
  }, [churnEntries, forecastHistory, selectedForecastMonth]);

  const { monthlyClosed, ytdClosed, groupCall } = churnStats;

  // 0. Performance Aggregation (Derived from optimized unit map)
  const groupStats = useMemo(() => {
    let closed = 0;
    let ytd = 0;

    UNITS.forEach(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      unitOpps.forEach(opp => {
        if (opp.stage === 'Closed Won') {
          if (opp.forecastMonth === selectedForecastMonth) closed += opp.mrc;
          if (opp.forecastMonth <= ytdConfig.targetMonthValue) ytd += opp.mrc;
        }
      });
    });

    return { totalClosedWon: closed, groupYtdPerformance: ytd, netInstallBookings: closed - monthlyClosed, netInstallYtd: ytd - ytdClosed };
  }, [unitOpportunities, selectedForecastMonth, ytdConfig, monthlyClosed, ytdClosed]);

  const { totalClosedWon, groupYtdPerformance, netInstallBookings, netInstallYtd } = groupStats;

  const netGrowthByUnitData = useMemo(() => {
    // Force live view for this chart specifically to ensure it catches current month data
    const now = new Date();
    const currentMonthValue = now.toISOString().slice(0, 7);

    const unitData = UNITS.map(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      const bookingsYtd = unitOpps
        .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth <= currentMonthValue)
        .reduce((sum, opp) => sum + opp.mrc, 0);

      const churnYtd = churnEntries
        .filter(c => c.unit === unit && c.month <= currentMonthValue)
        .reduce((sum, c) => sum + c.mrc, 0);

      return {
        unit: unit.replace('Strategic ', '').replace(' Wholesale', '').toUpperCase(),
        Bookings: bookingsYtd,
        Churn: -churnYtd,
        Net: bookingsYtd - churnYtd,
        isTotal: false
      };
    });

    const totalBookings = unitData.reduce((sum, d) => sum + d.Bookings, 0);
    const totalChurn = unitData.reduce((sum, d) => sum + d.Churn, 0);

    return [
      ...unitData,
      {
        unit: 'TOTAL',
        Bookings: totalBookings,
        Churn: totalChurn,
        Net: totalBookings + totalChurn,
        isTotal: true
      }
    ];
  }, [unitOpportunities, churnEntries]);

  // 1. Live Data Calculation for Charts
  const liveDataByUnit = useMemo(() => {
    const data: Record<string, number> = {};
    UNITS.forEach(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      const monthOpps = unitOpps.filter(opp => 
        opp.forecastMonth === selectedForecastMonth && 
        (opp.isIncludedInCall || opp.stage === 'Closed Won' || opp.stage?.toLowerCase().includes('commit'))
      );
      data[unit] = monthOpps.reduce((sum, opp) => sum + opp.mrc, 0);
    });
    return data;
  }, [unitOpportunities, selectedForecastMonth]);

  const totalQuota = useMemo(() => {
    return UNITS.reduce((sum, unit) => sum + quotas[unit].monthly, 0);
  }, [quotas]);

  const cumulativeGroupQuota = useMemo(() => {
    return totalQuota * ytdConfig.count;
  }, [totalQuota, ytdConfig]);

  const annualGroupQuota = useMemo(() => {
    return totalQuota * 12;
  }, [totalQuota]);

  // 1. Forecast Evolution Data for Selected Month
  const forecastEvolutionData = useMemo(() => {
    const submissions = [...forecastHistory]
      .filter(f => f.month === selectedForecastMonth)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (submissions.length === 0) {
      return {
        chartData: [{
          timestamp: Date.now(),
          weekLabel: 'Initial',
          fullDate: 'Initial',
          Low: 0,
          Call: 0,
          Upside: 0
        }],
        weekTicks: []
      };
    }

    const unitStates: Record<string, any> = {};
    const weeklyData: Record<string, any> = {};
    
    submissions.forEach((sub) => {
      unitStates[sub.unit] = sub;
      const subDate = new Date(sub.timestamp);
      const weekLabel = formatWeekDate(subDate);
      
      let currentLow = 0;
      let currentCall = 0;
      let currentUpside = 0;

      Object.values(unitStates).forEach((s: any) => {
        currentLow += (Number(s.low) || 0);
        currentCall += (Number(s.call) || 0);
        currentUpside += (Number(s.upside) || 0);
      });

      // Keep only the latest submission state for each week
      weeklyData[weekLabel] = {
        timestamp: sub.timestamp,
        weekLabel,
        fullDate: subDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        Low: currentLow,
        Call: currentCall,
        Upside: currentUpside,
      };
    });

    const chartData = Object.values(weeklyData).sort((a: any, b: any) => a.timestamp - b.timestamp);
    const weekTicks = chartData.map((d: any) => d.timestamp);

    return { chartData, weekTicks };
  }, [forecastHistory, selectedForecastMonth]);

  const { chartData, weekTicks } = forecastEvolutionData;

  // 2. Team Comparison Data: Latest submission for each team in selected month
  const comparisonData = useMemo(() => {
    return UNITS.map(unit => {
      const latest = forecastHistory
        .filter(f => f.unit === unit && f.month === selectedForecastMonth)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      const unitOpps = unitOpportunities[unit] || [];
      const closed = unitOpps
        .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth === selectedForecastMonth)
        .reduce((sum, opp) => sum + opp.mrc, 0);

      return {
        unit,
        Low: latest?.low || 0,
        Call: latest?.call !== undefined ? latest.call : liveDataByUnit[unit],
        Upside: latest?.upside || 0,
        Quota: quotas[unit].monthly,
        Closed: closed
      };
    });
  }, [forecastHistory, quotas, selectedForecastMonth, liveDataByUnit, unitOpportunities]);


  const totalGroupCall = useMemo(() => {
    return comparisonData.reduce((sum, d) => sum + d.Call, 0);
  }, [comparisonData]);

  const totalGroupLow = useMemo(() => {
    return comparisonData.reduce((sum, d) => sum + d.Low, 0);
  }, [comparisonData]);

  const totalGroupUpside = useMemo(() => {
    return comparisonData.reduce((sum, d) => sum + d.Upside, 0);
  }, [comparisonData]);

  // Implied / Projected YTD — only shown for current and future months
  const currentActualMonthValue = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const isForwardMonth = selectedForecastMonth >= currentActualMonthValue;

  const projectedStats = useMemo(() => {
    if (!isForwardMonth) return null;

    // Closed Won in all months STRICTLY BEFORE the selected month (hard actuals)
    let closedBeforeSelected = 0;
    UNITS.forEach(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      unitOpps.forEach(opp => {
        if (opp.stage === 'Closed Won' && opp.forecastMonth < selectedForecastMonth) {
          closedBeforeSelected += opp.mrc;
        }
      });
    });

    // Churn closed in all months before selected
    let churnBeforeSelected = 0;
    churnEntries.forEach(c => {
      if (c.month < selectedForecastMonth) churnBeforeSelected += c.mrc;
    });

    const projectedBookingsYtd = closedBeforeSelected + totalGroupCall;
    const projectedChurnYtd = churnBeforeSelected + groupCall;
    const projectedNetYtd = projectedBookingsYtd - projectedChurnYtd;
    const hasCall = totalGroupCall > 0;

    return { projectedBookingsYtd, projectedChurnYtd, projectedNetYtd, hasCall };
  }, [isForwardMonth, unitOpportunities, selectedForecastMonth, totalGroupCall, churnEntries, groupCall]);

  const ytdUnitData = useMemo(() => {
    const unitData = UNITS.map(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      const systemWonTotal = unitOpps
        .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth <= ytdConfig.targetMonthValue)
        .reduce((sum, opp) => sum + opp.mrc, 0);

      const ytdPerf = systemWonTotal;
      const ytdTarget = quotas[unit].monthly * ytdConfig.count;

      return {
        unit: unit.replace('Strategic ', '').replace(' Wholesale', '').toUpperCase(),
        Performance: ytdPerf,
        Target: ytdTarget,
        isAbove50: ytdPerf >= (ytdTarget * 0.5)
      };
    });

    const totalPerf = unitData.reduce((sum, d) => sum + d.Performance, 0);
    const totalTarget = unitData.reduce((sum, d) => sum + d.Target, 0);

    return [
      ...unitData,
      {
        unit: 'GROUP TOTAL',
        Performance: totalPerf,
        Target: totalTarget,
        isTotal: true,
        isAbove50: totalPerf >= (totalTarget * 0.5)
      }
    ];
  }, [unitOpportunities, quotas, ytdConfig]);

  const groupCallOpportunities = useMemo(() => {
    const grouped: Record<string, Opportunity[]> = {};
    UNITS.forEach(unit => {
      const unitOpps = unitOpportunities[unit] || [];
      const callOpps = unitOpps.filter(opp => 
        opp.forecastMonth === selectedForecastMonth && 
        (opp.isIncludedInCall || opp.stage === 'Closed Won')
      );
      if (callOpps.length > 0) {
        grouped[unit] = callOpps.sort((a, b) => b.mrc - a.mrc);
      }
    });
    return grouped;
  }, [unitOpportunities, selectedForecastMonth]);

  return (
    <div className="space-y-12 pb-12">
      <div className="space-y-12">
        {/* Bookings Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#8B5CF6] rounded-full" />
            <h3 className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest leading-none">Bookings {monthName}</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Panel 1: Closed Won */}
            <div className="bg-[#E0E5FF] p-8 rounded-[32px] relative overflow-hidden group border border-blue-100 shadow-sm transition-all hover:shadow-md">
              <div className="absolute -top-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={64} className="text-[#8B5CF6]" />
              </div>
              <p className="text-[10px] font-bold text-[#111827] uppercase tracking-[0.2em] mb-2 opacity-60">Closed Won ({monthName})</p>
              <div className="flex items-baseline gap-3 relative z-10">
                <AnimatedNumber value={totalClosedWon} className="text-4xl font-bold tracking-tight text-[#111827] font-mono" />
                <div className="flex flex-col font-mono">
                  <span className="text-[9px] font-bold text-[#8B5CF6] uppercase whitespace-nowrap">
                     {((totalClosedWon / totalGroupCall) * 100 || 0).toFixed(0)}% CALL
                  </span>
                  <span className="text-[9px] font-bold text-[#111827] uppercase whitespace-nowrap opacity-40">
                    {((totalClosedWon / totalQuota) * 100 || 0).toFixed(0)}% QUOTA
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 2: Group Call */}
            <div 
              onClick={() => setIsCallDetailsOpen(true)}
              className="bg-white p-8 rounded-[32px] border border-gray-100 relative overflow-hidden group cursor-pointer hover:border-[#8B5CF6]/50 transition-all shadow-sm hover:shadow-md"
            >
              <div className="absolute -top-1 -right-1 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={64} />
              </div>
              <p className="text-[10px] font-bold text-[#111827] uppercase tracking-[0.2em] mb-2 opacity-60">Group Call ({monthName})</p>
              <div className="flex flex-wrap items-end justify-between gap-4 relative z-10">
                <div className="flex items-baseline gap-3">
                  <AnimatedNumber value={totalGroupCall} className="text-4xl font-bold tracking-tight text-[#111827] font-mono" />
                  <span className="text-[9px] font-bold text-[#F29023] uppercase tracking-widest leading-none whitespace-nowrap bg-orange-50 px-2 py-1 rounded-full">
                    {((totalGroupCall / totalQuota) * 100 || 0).toFixed(0)}% QUOTA
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">LOW</span>
                    <span className="text-[11px] font-bold text-[#111827] tracking-tight">{formatCurrency(totalGroupLow)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">UPSIDE</span>
                    <span className="text-[11px] font-bold text-[#111827] tracking-tight">{formatCurrency(totalGroupUpside)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 3: YTD Results */}
            <div className="bg-[#282828] p-8 rounded-[32px] relative overflow-hidden group text-white shadow-xl">
              <div className="absolute -top-1 -right-1 opacity-20 group-hover:opacity-30 transition-opacity">
                <BarChart3 size={64} className="text-white" />
              </div>
              
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-2">Group YTD Closed ({ytdConfig.label})</p>
              <div className="flex flex-wrap items-baseline gap-3 relative z-10">
                <AnimatedNumber value={groupYtdPerformance} className="text-4xl font-bold tracking-tight text-white font-mono" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-white bg-white/10 px-2 py-1 rounded-full leading-none w-fit font-mono whitespace-nowrap">
                    {((groupYtdPerformance / cumulativeGroupQuota) * 100 || 0).toFixed(1)}% QUOTA
                  </span>
                  <span className="text-[9px] font-bold text-white/40 bg-white/5 px-2 py-1 rounded-full leading-none w-fit font-mono whitespace-nowrap">
                    {((groupYtdPerformance / annualGroupQuota) * 100 || 0).toFixed(1)}% ANNUAL
                  </span>
                </div>
              </div>

              {/* Projected YTD — only for current/future months */}
              {projectedStats?.hasCall && (
                <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                  <p className="text-[9px] font-bold text-[#F29023]/80 uppercase tracking-widest mb-1.5">▸ Projected YTD incl. {monthName} Call</p>
                  <div className="flex items-baseline gap-3">
                    <AnimatedNumber value={projectedStats.projectedBookingsYtd} className="text-2xl font-bold tracking-tight text-[#F29023] font-mono" />
                    <span className="text-[9px] font-bold text-[#F29023]/60 bg-[#F29023]/10 px-2 py-1 rounded-full leading-none font-mono whitespace-nowrap">
                      {((projectedStats.projectedBookingsYtd / cumulativeGroupQuota) * 100 || 0).toFixed(1)}% QUOTA
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Churn Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#F43F5E] rounded-full" />
            <h3 className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest leading-none">Churn {monthName}</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Churn Panel 1: Closed Churn */}
            <div className="bg-rose-50 p-8 rounded-[32px] border border-rose-100 relative overflow-hidden group">
              <div className="absolute top-6 right-6 p-2 bg-white/40 text-[#F43F5E] opacity-20 group-hover:opacity-100 transition-all z-40 rounded-full hover:bg-white cursor-help" title="Edit via Unit Dashboards">
                <Pencil size={14} />
              </div>
              <div className="absolute -top-1 -right-1 opacity-5">
                <AlertCircle size={64} className="text-[#F43F5E]" />
              </div>
              <p className="text-[10px] font-bold text-[#F43F5E] uppercase tracking-[0.2em] mb-2 leading-none">Closed Churn ({monthName})</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <AnimatedNumber value={monthlyClosed} className="text-4xl font-bold tracking-tight text-[#F43F5E] font-mono leading-none" />
                <span className="text-[10px] font-bold text-[#F43F5E]/50 uppercase font-mono">GBP</span>
              </div>
            </div>

            {/* Churn Panel 2: Group Churn Call */}
            <div className="bg-rose-50/50 p-8 rounded-[32px] border border-rose-100/50 relative overflow-hidden group">
              <div className="absolute top-6 right-6 p-2 bg-white/40 text-[#F43F5E] opacity-20 group-hover:opacity-100 transition-all z-40 rounded-full hover:bg-white cursor-help" title="Edit via Unit Dashboards">
                <Pencil size={14} />
              </div>
              <p className="text-[10px] font-bold text-[#F43F5E] uppercase tracking-[0.2em] mb-2 opacity-60 leading-none">Group Churn Call ({monthName})</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <AnimatedNumber value={groupCall} className="text-4xl font-bold tracking-tight text-[#F43F5E] font-mono leading-none" />
                <span className="text-[10px] font-bold text-[#F43F5E]/50 uppercase font-mono">GBP</span>
              </div>
            </div>

            {/* Churn Panel 3: Group Churn Closed YTD */}
            <div className="bg-[#282828] p-8 rounded-[32px] relative overflow-hidden group text-[#F43F5E]/80">
              <div className="absolute -top-1 -right-1 opacity-10">
                <History size={64} />
              </div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2 leading-none">Churn Closed YTD</p>
              <div className="flex items-baseline gap-2 relative z-10">
                <AnimatedNumber value={ytdClosed} className="text-4xl font-bold tracking-tight text-[#F43F5E] font-mono leading-none" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white/30 uppercase font-mono">Jan - Late '26</span>
                </div>
              </div>
              {projectedStats?.hasCall && (
                <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                  <p className="text-[9px] font-bold text-rose-400/70 uppercase tracking-widest mb-1.5">▸ Projected Churn YTD incl. {monthName} Call</p>
                  <AnimatedNumber value={projectedStats.projectedChurnYtd} className="text-2xl font-bold tracking-tight text-[#F43F5E] font-mono" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Net Install Section */}
        <div className="grid grid-cols-1 font-sans">
          <div className="bg-white p-8 rounded-[18px] border border-gray-100 relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
            <div className="absolute top-1/2 -right-4 -translate-y-1/2 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
              <TrendingUp size={120} className="text-[#111827]" />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-6 bg-[#8B5CF6] rounded-full" />
                  <h3 className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest leading-none">Net Install Bookings {monthName}</h3>
                </div>
                <p className="text-[11px] font-medium text-[#6B7280] mt-1">Bookings (Closed Won) minus Recorded Churn ({monthName})</p>
              </div>

              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col">
                  <p className="text-[9px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">{monthName} NET</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber 
                      value={netInstallBookings} 
                      className={cn(
                        "text-3xl font-bold tracking-tight font-mono",
                        netInstallBookings >= 0 ? "text-[#111827]" : "text-[#F43F5E]"
                      )} 
                    />
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase font-mono">GBP</span>
                  </div>
                </div>

                <div className="flex flex-col border-l border-gray-100 pl-8">
                  <p className="text-[9px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">YTD NIB</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber 
                      value={netInstallYtd} 
                      className={cn(
                        "text-3xl font-bold tracking-tight font-mono",
                        netInstallYtd >= 0 ? "text-[#111827]" : "text-[#F43F5E]"
                      )} 
                    />
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase font-mono">GBP</span>
                  </div>
                  {projectedStats?.hasCall && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[8px] font-bold text-[#F29023] uppercase tracking-widest mb-0.5">▸ Projected incl. {monthName}</p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedNumber 
                          value={projectedStats.projectedNetYtd} 
                          className={cn(
                            "text-xl font-bold tracking-tight font-mono",
                            projectedStats.projectedNetYtd >= 0 ? "text-[#111827]" : "text-[#F43F5E]"
                          )} 
                        />
                        <span className="text-[9px] font-bold text-[#6B7280] uppercase font-mono">GBP</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Priorities Heatmap Section */}
        <div className="mt-8">
          <GlobalPrioritiesOverview />
        </div>
      </div>

      {/* Forecast Evolution Trend */}
      <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm font-sans">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#8B5CF6] rounded-full" />
            <h3 className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest leading-none">Forecast Evolution {monthName}</h3>
          </div>
          <div className="flex bg-gray-50 p-2 rounded-full border border-gray-100 gap-6 px-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F43F5E]" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Call</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F29023]" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Upside</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="timestamp" 
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={weekTicks}
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 600, fill: '#6B7280' }}
                tickFormatter={(v) => {
                  const dataPoint = chartData.find(d => d.timestamp === v);
                  return dataPoint ? dataPoint.weekLabel : '';
                }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 600, fill: '#6B7280' }}
                tickFormatter={(v) => `£${v/1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#282828', color: '#ffffff', padding: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                itemStyle={{ color: '#ffffff', fontSize: '11px', fontWeight: 'bold' }}
                formatter={(v: number) => [formatCurrency(v), '']}
                labelFormatter={(value) => {
                  const dataPoint = chartData.find(d => d.timestamp === value);
                  return dataPoint ? dataPoint.fullDate : '';
                }}
                labelStyle={{ color: '#8B5CF6', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Line 
                type="monotone" 
                dataKey="Low" 
                stroke="#F43F5E" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#F43F5E', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6, strokeWidth: 0 }} 
                isAnimationActive={true}
              />
              <Line 
                type="monotone" 
                dataKey="Call" 
                stroke="#8B5CF6" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6, strokeWidth: 0 }} 
                isAnimationActive={true}
              />
              <Line 
                type="monotone" 
                dataKey="Upside" 
                stroke="#F29023" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#F29023', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 6, strokeWidth: 0 }} 
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Team Comparison Chart - Full Width */}
      <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm font-sans">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#F29023] rounded-full" />
            <h3 className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest leading-none">Unit Performance vs Quota</h3>
          </div>
          <div className="flex bg-gray-50 p-2 rounded-full border border-gray-100 gap-6 px-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-200 rounded-sm" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Quota</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#8B5CF6] rounded-sm" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Closed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#F29023] rounded-sm" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Call</span>
            </div>
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              layout="vertical" 
              data={comparisonData.map(d => ({
                ...d,
                unit: d.unit.replace('Strategic ', '').replace(' Wholesale', '').toUpperCase()
              }))} 
              margin={{ top: 0, right: 90, left: 20, bottom: 0 }}
              barGap={4}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <XAxis 
                type="number"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 600, fill: '#6B7280' }}
                tickFormatter={(v) => `£${v/1000}k`}
              />
              <YAxis 
                dataKey="unit" 
                type="category"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#111827' }}
                width={100}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#282828', color: '#ffffff', padding: '12px' }}
                itemStyle={{ color: '#ffffff' }}
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                formatter={(v: number) => [formatCurrency(v), '']}
              />
              
              <Bar dataKey="Quota" name="QUOTA" fill="#E5E7EB" radius={[0, 4, 4, 0]} barSize={8} />
              <Bar dataKey="Closed" name="CLOSED" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={8}>
                <LabelList 
                  dataKey="Closed" 
                  position="right" 
                  content={(props: any) => {
                    const { x, y, value, width } = props;
                    return (
                      <text x={x + width + 5} y={y + 8} fill="#8B5CF6" fontSize={8} fontWeight={700} className="font-mono">
                         {formatCurrency(value)}
                      </text>
                    );
                  }}
                />
              </Bar>
              <Bar dataKey="Call" fill="#F29023" radius={[0, 4, 4, 0]} barSize={8}>
                <LabelList 
                  dataKey="Call" 
                  position="right" 
                  content={(props: any) => {
                    const { x, y, value, width } = props;
                    return (
                      <text x={x + width + 5} y={y + 8} fill="#F29023" fontSize={8} fontWeight={700} className="font-mono">
                        {formatCurrency(value)}
                      </text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* YTD Performance vs Quota Chart - Full Width */}
      <div className="bg-[#282828] p-10 rounded-[28px] shadow-2xl relative overflow-hidden font-sans text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-10 gap-6 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-[#8B5CF6] rounded-full" />
              <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-none">Bookings YTD (Jan - {ytdConfig.label})</h3>
            </div>
            
            {/* Range Toggle */}
            <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
              <button 
                onClick={() => setIsLiveYtd(false)}
                className={cn(
                  "px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-all rounded-full",
                  !isLiveYtd ? "bg-white text-[#282828] shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                Completed Months
              </button>
              <button 
                onClick={() => setIsLiveYtd(true)}
                className={cn(
                  "px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-all rounded-full",
                  isLiveYtd ? "bg-white text-[#282828] shadow-lg" : "text-white/40 hover:text-white"
                )}
              >
                Live Positioning
              </button>
            </div>
          </div>
          
          <div className="flex gap-6 px-6 py-2 bg-white/5 rounded-full border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#F29023] rounded-full" />
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-none">Achieved</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-white/10 rounded-full border border-white/20" />
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest leading-none">Quota</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ytdUnitData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" strokeOpacity={0.05} />
              <XAxis 
                dataKey="unit" 
                axisLine={false} 
                tickLine={false} 
                interval={0}
                tick={(props) => {
                  const { x, y, payload } = props;
                  const entry = ytdUnitData.find(d => d.unit === payload.value);
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={20} textAnchor="middle" fill="#ffffff" fillOpacity={0.8} fontSize={10} fontWeight={700}>
                        {payload.value}
                      </text>
                      {entry?.isAbove50 && (
                        <g transform="translate(-14, 28)">
                          <text x={0} y={8} fill="#8B5CF6" fontSize={8} fontWeight={900} className="font-mono">50%</text>
                          <path 
                            d="M20 6L9 17L4 12" 
                            fill="none" 
                            stroke="#8B5CF6" 
                            strokeWidth="3" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="translate(18, -4) scale(0.6)"
                          />
                        </g>
                      )}
                    </g>
                  );
                }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 500, fill: '#ffffff', fillOpacity: 0.4 }}
                tickFormatter={(v) => `£${v/1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#ffffff', color: '#282828', padding: '12px' }}
                itemStyle={{ color: '#282828', fontSize: '11px', fontWeight: 'bold' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                formatter={(v: number) => [formatCurrency(v), '']}
              />
              <Bar dataKey="Target" name="QUOTA" fill="#ffffff" fillOpacity={0.05} radius={[8, 8, 8, 8]} barSize={40} />
              <Bar dataKey="Performance" name="ACHIEVED" fill="#F29023" radius={[8, 8, 8, 8]} barSize={40}>
                {ytdUnitData.map((entry: any, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isTotal ? '#F29023' : '#F29023'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NIB PERFORMANCE BY UNIT */}
      <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm font-sans">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-bold text-[#111827] tracking-tight">NIB Performance by Unit</h3>
            <p className="text-[11px] font-medium text-[#6B7280] mt-1 uppercase tracking-widest">
              Revenue Growth Indicator: Bookings vs. Churn (Jan - {FORECAST_MONTHS.find(m => m.value === new Date().toISOString().slice(0, 7))?.label || 'Current'})
            </p>
          </div>
          <div className="flex bg-gray-50 p-2 rounded-full border border-gray-100 gap-6 px-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Bookings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F43F5E]" />
              <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Churn</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={netGrowthByUnitData} 
              margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
              stackOffset="sign"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="unit" 
                axisLine={false} 
                tickLine={false} 
                interval={0}
                tick={(props) => {
                  const { x, y, payload } = props;
                  const entry = netGrowthByUnitData.find(d => d.unit === payload.value);
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={20} textAnchor="middle" fill="#111827" fontSize={9} fontWeight={700} className="uppercase">
                        {payload.value}
                      </text>
                      <text x={0} y={32} textAnchor="middle" fill={entry && entry.Net >= 0 ? "#8B5CF6" : "#F43F5E"} fontSize={9} fontWeight={800} className="font-mono">
                        {formatCurrency(entry?.Net || 0)}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 500, fill: '#6B7280' }}
                tickFormatter={(v) => `£${Math.abs(v)/1000}k`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#282828', color: '#ffffff', padding: '12px' }}
                itemStyle={{ color: '#ffffff' }}
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                formatter={(v: number) => [formatCurrency(Math.abs(v)), '']}
              />
              <ReferenceLine y={0} stroke="#E5E7EB" />
              <Bar dataKey="Bookings" fill="#8B5CF6" radius={[4, 4, 4, 4]} barSize={40}>
                {netGrowthByUnitData.map((entry, index) => (
                  <Cell key={`cell-bookings-${index}`} fill={entry.isTotal ? "#8B5CF6" : "#8B5CF6"} opacity={entry.isTotal ? 1 : 0.8} />
                ))}
              </Bar>
              <Bar dataKey="Churn" fill="#F43F5E" radius={[4, 4, 4, 4]} barSize={40}>
                {netGrowthByUnitData.map((entry, index) => (
                  <Cell key={`cell-churn-${index}`} fill={entry.isTotal ? "#E11D48" : "#F43F5E"} opacity={entry.isTotal ? 1 : 0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side Panel: Group Call Details */}
      <AnimatePresence>
        {isCallDetailsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCallDetailsOpen(false)}
              className="fixed inset-0 bg-[#111827]/40 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-4 right-4 bottom-4 w-full max-w-2xl bg-white z-[70] shadow-2xl rounded-[32px] flex flex-col border border-gray-100"
            >
              <div className="p-10 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#111827] tracking-tight">Group Portfolio Rollup</h2>
                  <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-widest mt-2">
                    Weighted Call: <span className="text-[#8B5CF6]">{formatCurrency(totalGroupCall)}</span> • {monthName} 2026
                  </p>
                </div>
                <button onClick={() => setIsCallDetailsOpen(false)} className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-[#111827]">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
                {(Object.entries(groupCallOpportunities) as [string, Opportunity[]][]).map(([unitName, opps]) => (
                  <div key={unitName} className="space-y-4">
                    <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                      <Briefcase size={16} className="text-[#8B5CF6]" />
                      <h3 className="text-[10px] font-bold text-[#111827] uppercase tracking-widest">{unitName}</h3>
                      <span className="ml-auto text-[10px] font-bold text-white bg-[#111827] px-3 py-1 rounded-full font-mono">
                        {formatCurrency(opps.reduce((s: number, o: Opportunity) => s + o.mrc, 0))}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {opps.map((opp: Opportunity) => (
                        <div key={opp.id} className="flex items-center justify-between p-5 bg-white rounded-[18px] border border-gray-100 hover:border-[#8B5CF6]/50 transition-all shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-[#111827] tracking-tight">{opp.customer}</span>
                            <span 
                              className="text-[9px] font-medium text-[#6B7280] uppercase tracking-widest mt-0.5 truncate max-w-xs block"
                              title={opp.oppIdentifier}
                            >
                              {opp.oppIdentifier.length > 40 ? `${opp.oppIdentifier.substring(0, 40)}...` : opp.oppIdentifier}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[13px] font-bold text-[#111827] font-mono">{formatCurrency(opp.mrc)}</span>
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full mt-1",
                              opp.stage === 'Closed Won' ? "bg-green-50 text-green-700" : "bg-gray-100 text-[#6B7280]"
                            )}>
                              {opp.stage}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(groupCallOpportunities).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300 py-20">
                    <TrendingUp size={64} className="opacity-20 mb-4" />
                    <p className="text-[11px] font-bold uppercase tracking-widest">No active call opportunities found</p>
                  </div>
                )}
              </div>

              <div className="p-10 border-t border-gray-50">
                <div className="flex justify-between items-center bg-[#111827] p-6 rounded-[24px] text-white shadow-xl">
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">Group Call Total</span>
                  <span className="text-3xl font-bold font-mono tracking-tight">{formatCurrency(totalGroupCall)}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
