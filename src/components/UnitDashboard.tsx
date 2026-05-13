import React, { useState, useMemo } from 'react';
import { Unit, Opportunity, ForecastSubmission } from '../types';
import { useApp } from '../context/AppContext';
import { useForecastStatus } from '../hooks/useForecastStatus';
import { FORECAST_MONTHS } from '../constants';
import { formatCurrency, cn, formatWeekDate } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Line, Area, Cell, ReferenceLine, PieChart, Pie
} from 'recharts';
import { TrendingUp, Target, CheckCircle2, AlertCircle, Calculator, ChevronRight, ChevronLeft, Database, Plus, X, BarChart3, Trophy, History, RotateCcw, Undo2, Loader2, Pencil, ListTodo, Flag } from 'lucide-react';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { WeeklyPrioritiesPanel } from './WeeklyPrioritiesPanel';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';

interface UnitDashboardProps {
  unit: Unit;
}

export function UnitDashboard({ unit }: UnitDashboardProps) {
  const { unitOpportunities, quotas, submitForecast, forecastHistory, updateOpportunity, addOpportunity, selectedForecastMonth, setSelectedForecastMonth, churnEntries, addChurnEntry, deleteChurnEntry, updateChurnEntry } = useApp();
  const unitOpps = unitOpportunities[unit] || [];
  const unitQuota = quotas[unit];

  const unitChurn = useMemo(() => {
    return churnEntries.filter(c => c.unit === unit && c.month === selectedForecastMonth);
  }, [churnEntries, unit, selectedForecastMonth]);

  const { monthName, isHistoricalMonth } = useForecastStatus();
  const [isLiveYtd, setIsLiveYtd] = useState(false);
  
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

  const churnTotal = unitChurn.reduce((sum, c) => sum + c.mrc, 0);

  const churnTotalYTD = useMemo(() => {
    const currentActualMonth = new Date().toISOString().slice(0, 7);
    return churnEntries
      .filter(c => c.unit === unit && c.month <= currentActualMonth)
      .reduce((sum, c) => sum + c.mrc, 0);
  }, [churnEntries, unit]);

  // Submission Panel Specific State
  const [submissionMonth, setSubmissionMonth] = useState(selectedForecastMonth);
  
  // Sync submission month when user changes dashboard filter
  React.useEffect(() => {
    setSubmissionMonth(selectedForecastMonth);
  }, [selectedForecastMonth]);

  const [isCallBuilderOpen, setIsCallBuilderOpen] = useState(false);
  const [builderView, setBuilderView] = useState<'selection' | 'history'>('selection');
  
  const [showPlaceholderForm, setShowPlaceholderForm] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'mrc' | 'oppIdentifier' | null>(null);
  const [editingChurnId, setEditingChurnId] = useState<string | null>(null);
  const [editingChurnField, setEditingChurnField] = useState<'mrc' | 'customerName' | 'serviceType' | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [placeholderData, setPlaceholderData] = useState({
    customer: '',
    mrc: '',
    identifier: '',
    description: ''
  });
  
  const handleAddPlaceholder = async () => {
    setFormError(null);
    if (!placeholderData.customer || !placeholderData.mrc || !placeholderData.identifier) {
      setFormError('Please fill in all required fields marked with *');
      return;
    }

    setIsLogging(true);
    try {
      await addOpportunity({
        oppIdentifier: placeholderData.identifier,
        owner: 'Manual Entry',
        customer: placeholderData.customer,
        mrc: parseFloat(placeholderData.mrc) || 0,
        closeDate: `${submissionMonth}-01`,
        forecastMonth: submissionMonth,
        stage: isHistoricalMonth ? 'Closed Won' : 'Pipeline',
        nextStep: isHistoricalMonth ? (placeholderData.description || 'Historical Booking') : 'Placeholder Opportunity',
        unit: unit,
        isIncludedInCall: true
      });

      setPlaceholderData({ customer: '', mrc: '', identifier: '', description: '' });
      setShowPlaceholderForm(false);
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 5000); 
    } catch (error: any) {
      console.error('Error logging deal:', error);
      setFormError('Failed to log deal. Please check your connection or permissions.');
    } finally {
      setIsLogging(false);
    }
  };

  // Data for the Dashboard (Top Panels) - Controlled by selectedForecastMonth
  const dashboardSubmission = useMemo(() => {
    return [...forecastHistory]
      .filter(f => f.unit === unit && f.month === selectedForecastMonth)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [forecastHistory, unit, selectedForecastMonth]);

  const dashboardCallTotal = useMemo(() => {
    return unitOpps
      .filter(opp => 
        opp.forecastMonth === selectedForecastMonth && 
        (opp.isIncludedInCall || opp.stage === 'Closed Won')
      )
      .reduce((sum, opp) => sum + opp.mrc, 0);
  }, [unitOpps, selectedForecastMonth]);

  // Data for the Submission Panel - Controlled by submissionMonth
  const latestSubmission = useMemo(() => {
    return [...forecastHistory]
      .filter(f => f.unit === unit && f.month === submissionMonth)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [forecastHistory, unit, submissionMonth]);

  // Call Builder State
  const [lowForecast, setLowForecast] = useState<string>(latestSubmission?.low.toString() || '');
  const [upsideForecast, setUpsideForecast] = useState<string>(latestSubmission?.upside.toString() || '');
  
  const [churnLowForecast, setChurnLowForecast] = useState<string>(latestSubmission?.churnLow?.toString() || '');
  const [churnCallForecast, setChurnCallForecast] = useState<string>(latestSubmission?.churnCall?.toString() || '');
  const [churnWorstCaseForecast, setChurnWorstCaseForecast] = useState<string>(latestSubmission?.churnWorstCase?.toString() || '');

  // Record Churn Form State
  const [showChurnForm, setShowChurnForm] = useState(false);
  const [churnFormData, setChurnFormData] = useState({
    customer: '',
    serviceType: '',
    mrc: ''
  });

  // Reset inputs when month changes
  React.useEffect(() => {
    setLowForecast(latestSubmission?.low.toString() || '');
    setUpsideForecast(latestSubmission?.upside.toString() || '');
    setChurnLowForecast(latestSubmission?.churnLow?.toString() || '');
    setChurnCallForecast(latestSubmission?.churnCall?.toString() || '');
    setChurnWorstCaseForecast(latestSubmission?.churnWorstCase?.toString() || '');
  }, [submissionMonth, latestSubmission]);

  const [showAllMonths, setShowAllMonths] = useState(false);

  // Derived Data
  const filteredOpps = useMemo(() => {
    if (showAllMonths) return unitOpps;
    return unitOpps.filter(opp => opp.forecastMonth === selectedForecastMonth);
  }, [unitOpps, selectedForecastMonth, showAllMonths]);

  const currentMonthOpps = filteredOpps;

  const closedDeals = useMemo(() => {
    return unitOpps.filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth === selectedForecastMonth);
  }, [unitOpps, selectedForecastMonth]);

  const closedTotal = closedDeals.reduce((sum, opp) => sum + opp.mrc, 0);
  
  const callTotal = useMemo(() => {
    return unitOpps
      .filter(opp => 
        opp.forecastMonth === submissionMonth && 
        (opp.isIncludedInCall || opp.stage === 'Closed Won')
      )
      .reduce((sum, opp) => sum + opp.mrc, 0);
  }, [unitOpps, submissionMonth]);

  const syncForecastWithLiveState = async (updatedOpps: Opportunity[]) => {
    if (latestSubmission) {
      const newCallTotal = updatedOpps
        .filter(opp => 
          opp.forecastMonth === submissionMonth && 
          (opp.isIncludedInCall || opp.stage === 'Closed Won')
        )
        .reduce((sum, opp) => sum + opp.mrc, 0);

      await submitForecast({
        unit,
        month: submissionMonth,
        low: latestSubmission.low,
        upside: latestSubmission.upside,
        call: newCallTotal,
        churnLow: latestSubmission.churnLow || 0,
        churnCall: latestSubmission.churnCall || 0,
        churnWorstCase: latestSubmission.churnWorstCase || 0,
        timestamp: Date.now()
      });
    }
  };

  const toggleOpp = async (id: string, currentState: boolean) => {
    const newIncludedState = !currentState;
    await updateOpportunity(id, { isIncludedInCall: newIncludedState });
    
    const updatedOpps = unitOpps.map(opp => 
      opp.id === id ? { ...opp, isIncludedInCall: newIncludedState } : opp
    );
    await syncForecastWithLiveState(updatedOpps);
  };

  const markAsWon = async (id: string) => {
    await updateOpportunity(id, { stage: 'Closed Won', isIncludedInCall: true });
    
    const updatedOpps = unitOpps.map(opp => 
      opp.id === id ? { ...opp, stage: 'Closed Won', isIncludedInCall: true } : opp
    );
    await syncForecastWithLiveState(updatedOpps);
  };

  const handleInlineUpdate = async (id: string, updates: Partial<Opportunity>) => {
    await updateOpportunity(id, updates);
    const updatedOpps = unitOpps.map(opp => 
      opp.id === id ? { ...opp, ...updates } : opp
    );
    await syncForecastWithLiveState(updatedOpps);
  };

  const startEditing = (opp: Opportunity, field: 'mrc' | 'oppIdentifier') => {
    setEditingId(opp.id);
    setEditingField(field);
    setEditingValue(field === 'mrc' ? opp.mrc.toString() : opp.oppIdentifier);
  };

  const saveEdit = async () => {
    if (!editingId || !editingField) return;
    const value = editingField === 'mrc' ? parseFloat(editingValue) || 0 : editingValue;
    await handleInlineUpdate(editingId, { [editingField]: value });
    setEditingId(null);
    setEditingField(null);
  };

  const startChurnEdit = (entry: any, field: 'mrc' | 'customerName' | 'serviceType') => {
    setEditingChurnId(entry.id);
    setEditingChurnField(field);
    setEditingValue(field === 'mrc' ? entry.mrc.toString() : entry[field]);
  };

  const saveChurnEdit = async () => {
    if (!editingChurnId || !editingChurnField) return;
    const value = editingChurnField === 'mrc' ? parseFloat(editingValue) || 0 : editingValue;
    await updateChurnEntry(editingChurnId, { [editingChurnField]: value });
    setEditingChurnId(null);
    setEditingChurnField(null);
  };

  const handleResetChurn = async () => {
    if (!confirm('Are you sure you want to reset (delete) all recorded churn for this month and unit?')) return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      unitChurn.forEach(entry => {
        batch.delete(doc(db, 'churn', entry.id));
      });
      await batch.commit();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      console.error('Churn reset failed:', err);
      setFormError('Failed to reset churn.');
    } finally {
      setIsResetting(false);
    }
  };

  // YTD Logic
  const ytdPerformance = useMemo(() => {
    // 1. Get all 'Closed Won' opportunities for this unit up to the target month
    return unitOpps
      .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth <= ytdConfig.targetMonthValue)
      .reduce((sum, opp) => sum + opp.mrc, 0);
  }, [unitOpps, ytdConfig]);

  const ytdQuota = useMemo(() => {
    // YTD Quota = Sum of quotas for months in the range
    return unitQuota.monthly * ytdConfig.count;
  }, [unitQuota, ytdConfig]);

  const annualUnitQuota = useMemo(() => {
    return unitQuota.monthly * 12;
  }, [unitQuota]);

  // Implied / Projected YTD — only shown for current and future months
  const currentActualMonthValue = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const isForwardMonth = selectedForecastMonth >= currentActualMonthValue;

  const projectedUnitStats = useMemo(() => {
    if (!isForwardMonth) return null;

    const closedBeforeSelected = unitOpps
      .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth < selectedForecastMonth)
      .reduce((sum, opp) => sum + opp.mrc, 0);

    const churnBeforeSelected = churnEntries
      .filter(c => c.unit === unit && c.month < selectedForecastMonth)
      .reduce((sum, c) => sum + c.mrc, 0);

    const churnCallValue = parseFloat(churnCallForecast) || 0;
    const projectedBookingsYtd = closedBeforeSelected + callTotal;
    const projectedChurnYtd = churnBeforeSelected + churnCallValue;
    const projectedNetYtd = projectedBookingsYtd - projectedChurnYtd;
    const hasCall = callTotal > 0;

    return { projectedBookingsYtd, projectedChurnYtd, projectedNetYtd, hasCall };
  }, [isForwardMonth, unitOpps, selectedForecastMonth, callTotal, churnEntries, unit, churnCallForecast]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const selectedIds = unitOpps
        .filter(opp => opp.forecastMonth === submissionMonth && opp.isIncludedInCall)
        .map(opp => opp.id);

      const submission: ForecastSubmission = {
        unit,
        month: submissionMonth,
        low: parseFloat(lowForecast) || 0,
        upside: parseFloat(upsideForecast) || 0,
        call: callTotal,
        churnLow: parseFloat(churnLowForecast) || 0,
        churnCall: parseFloat(churnCallForecast) || 0,
        churnWorstCase: parseFloat(churnWorstCaseForecast) || 0,
        timestamp: Date.now(),
        oppIds: selectedIds,
        type: 'submission'
      };
      await submitForecast(submission);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Forecast submission failed:', error);
      setFormError('Failed to submit forecast. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCall = async () => {
    setIsResetting(true);
    // Find all deals that are NOT 'Closed Won' but ARE currently included in the call
    const activeOpps = unitOpps.filter(opp => 
      opp.forecastMonth === submissionMonth && 
      opp.isIncludedInCall && 
      opp.stage !== 'Closed Won'
    );
    
    if (activeOpps.length === 0) {
      setIsResetting(false);
      setResetSuccess(true); // Still show success if already empty/clean
      setTimeout(() => setResetSuccess(false), 3000);
      return;
    }

    try {
      // 1. Save Snapshot
      const snapshot: ForecastSubmission = {
        unit,
        month: submissionMonth,
        low: parseFloat(lowForecast) || 0,
        upside: parseFloat(upsideForecast) || 0,
        call: callTotal,
        churnLow: parseFloat(churnLowForecast) || 0,
        churnCall: parseFloat(churnCallForecast) || 0,
        churnWorstCase: parseFloat(churnWorstCaseForecast) || 0,
        timestamp: Date.now(),
        oppIds: activeOpps.map(o => o.id),
        type: 'reset_snapshot'
      };
      await submitForecast(snapshot);

      // 2. Clear Selections using Batch
      const batch = writeBatch(db);
      activeOpps.forEach(opp => {
        batch.update(doc(db, 'opportunities', opp.id), { isIncludedInCall: false });
      });
      
      await batch.commit();
      
      // 3. Sync the now-cleared state to history to reflect zero pipeline in history
      const clearedOpps = unitOpps.map(opp => 
        activeOpps.find(a => a.id === opp.id) ? { ...opp, isIncludedInCall: false } : opp
      );
      await syncForecastWithLiveState(clearedOpps);
      
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (error) {
      console.error('Reset failed:', error);
      setFormError('Reset failed. Please check your connection.');
    } finally {
      setIsResetting(false);
    }
  };

  const restoreSnapshot = async (oppIds: string[]) => {
    // 1. Clear current selections first
    const currentSelected = unitOpps.filter(opp => opp.forecastMonth === submissionMonth && opp.isIncludedInCall);
    for (const opp of currentSelected) {
      await updateOpportunity(opp.id, { isIncludedInCall: false });
    }

    // 2. Apply snapshot IDs
    for (const id of oppIds) {
      await updateOpportunity(id, { isIncludedInCall: true });
    }
  };


  // Chart Data
  const currentMonthData = [
    {
      name: 'Current Month',
      Closed: closedTotal,
      Forecast: dashboardCallTotal,
      Remaining: Math.max(0, unitQuota.monthly - closedTotal - dashboardCallTotal)
    }
  ];


  const quarterData = [
    { name: 'Current', Closed: closedTotal, Forecast: dashboardCallTotal },
    { name: 'Next Month', Closed: 0, Forecast: dashboardSubmission?.low || 0 },
    { name: 'Q-Out', Closed: 0, Forecast: dashboardSubmission?.upside || 0 },
  ];

  const monthlyNetPerformanceData = useMemo(() => {
    return FORECAST_MONTHS.map(m => {
      const bookings = unitOpps
        .filter(opp => opp.stage === 'Closed Won' && opp.forecastMonth === m.value)
        .reduce((sum, opp) => sum + opp.mrc, 0);
      
      const churn = churnEntries
        .filter(c => c.unit === unit && c.month === m.value)
        .reduce((sum, c) => sum + c.mrc, 0);

      return {
        month: m.label,
        Bookings: bookings,
        Churn: -churn,
        Net: bookings - churn
      };
    });
  }, [unitOpps, churnEntries, unit]);

  const handleAddChurn = async () => {
    if (!churnFormData.customer || !churnFormData.serviceType || !churnFormData.mrc) {
      setFormError('Please fill in all churn details.');
      return;
    }
    setIsLogging(true);
    try {
      await addChurnEntry({
        customerName: churnFormData.customer,
        serviceType: churnFormData.serviceType,
        mrc: parseFloat(churnFormData.mrc) || 0,
        month: selectedForecastMonth,
        unit: unit
      });
      setChurnFormData({ customer: '', serviceType: '', mrc: '' });
      setShowChurnForm(false);
      setLogSuccess(true);
      setTimeout(() => setLogSuccess(false), 5000);
    } catch (err) {
      setFormError('Failed to record churn.');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
      {/* Left Column: Stats & Call Builder */}
      <div className="xl:col-span-2 space-y-12">
        {/* Stats Grid - Compact 3-Panel Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-1 px-4 mt-4">
          {/* Panel 1: Closed Won */}
          <div className="bg-[#E0E5FF] p-8 rounded-l-[32px] border border-gray-100 relative overflow-hidden group">
            <div className="absolute -top-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target size={56} className="text-[#8B5CF6]" />
            </div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">{unit} Closed Won ({monthName})</p>
            <div className="flex items-baseline gap-3 relative z-10">
              <AnimatedNumber value={closedTotal} className="text-3xl font-bold tracking-tight text-[#111827]" />
              <div className="flex flex-wrap gap-2 font-mono">
                <span className="text-[10px] font-bold text-[#8B5CF6] uppercase whitespace-nowrap">
                  {((closedTotal / dashboardCallTotal) * 100 || 0).toFixed(0)}% Call
                </span>
                <span className="text-[10px] font-bold text-[#111827] uppercase whitespace-nowrap opacity-40">
                  {((closedTotal / unitQuota.monthly) * 100 || 0).toFixed(0)}% Quota
                </span>
              </div>
            </div>
          </div>

          {/* Panel 2: Unit Call */}
          <div className="bg-white p-8 border border-gray-100 relative overflow-hidden group">
            <div className="absolute -top-1 -right-1 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={56} className="text-[#111827]" />
            </div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">{unit} Call ({monthName})</p>
            <div className="flex flex-wrap items-end justify-between gap-4 relative z-10">
              <div className="flex items-baseline gap-2">
                <AnimatedNumber value={dashboardCallTotal} className="text-3xl font-bold tracking-tight text-[#111827]" />
                <span className="text-[10px] font-bold text-[#F29023] uppercase tracking-widest leading-none whitespace-nowrap">
                  {((dashboardCallTotal / unitQuota.monthly) * 100 || 0).toFixed(0)}% Quota
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[8px] font-bold text-[#6B7280] uppercase">Low</span>
                  <span className="text-[11px] font-bold text-[#111827] tracking-tight leading-none">{formatCurrency(dashboardSubmission?.low || 0)}</span>
                </div>
                <div className="flex items-center gap-2 font-mono border-t border-gray-100 pt-1">
                  <span className="text-[8px] font-bold text-[#6B7280] uppercase">Upside</span>
                  <span className="text-[11px] font-bold text-[#111827] tracking-tight leading-none">{formatCurrency(dashboardSubmission?.upside || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: YTD Results */}
          <div className="bg-[#282828] p-8 rounded-r-[32px] border border-[#282828] relative overflow-hidden group text-white shadow-xl shadow-black/10">
            <div className="absolute -top-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity">
              <BarChart3 size={56} className="text-[#8B5CF6]" />
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start mb-2 relative z-10 gap-2">
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest leading-tight">{unit} YTD Closed ({ytdConfig.label})</p>
              
              {/* Range Toggle HUD */}
              <div className="flex bg-white/5 p-1 rounded-full border border-white/10 shrink-0">
                <button 
                  onClick={() => setIsLiveYtd(false)}
                  className={cn(
                    "px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all rounded-full",
                    !isLiveYtd ? "bg-white text-[#282828]" : "text-white/40 hover:text-white"
                  )}
                >
                  History
                </button>
                <button 
                  onClick={() => setIsLiveYtd(true)}
                  className={cn(
                    "px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all rounded-full",
                    isLiveYtd ? "bg-white text-[#282828]" : "text-white/40 hover:text-white"
                  )}
                >
                  Live
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-4 relative z-10 mt-2">
              <AnimatedNumber value={ytdPerformance} className="text-3xl font-bold tracking-tight text-white" />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#8B5CF6] leading-none w-fit font-mono">
                  {((ytdPerformance / ytdQuota) * 100 || 0).toFixed(1)}% YTD Quota
                </span>
                <span className="text-[9px] font-medium text-white/40 leading-none w-fit font-mono">
                  {((ytdPerformance / annualUnitQuota) * 100 || 0).toFixed(1)}% Annual
                </span>
              </div>
            </div>

            {/* Projected YTD — only for current/future months */}
            {projectedUnitStats?.hasCall && (
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                <p className="text-[9px] font-bold text-[#F29023]/80 uppercase tracking-widest mb-1.5">▸ Projected YTD incl. {monthName} Call</p>
                <div className="flex items-baseline gap-3">
                  <AnimatedNumber value={projectedUnitStats.projectedBookingsYtd} className="text-2xl font-bold tracking-tight text-[#F29023] font-mono" />
                  <span className="text-[9px] font-bold text-[#F29023]/60 bg-[#F29023]/10 px-2 py-1 rounded-full leading-none font-mono whitespace-nowrap">
                    {((projectedUnitStats.projectedBookingsYtd / ytdQuota) * 100 || 0).toFixed(1)}% QUOTA
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unit Net Install Section */}
        <div className="px-4 mt-8">
          <div className="bg-white p-8 rounded-[24px] border border-gray-100 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
            <div className="absolute top-1/2 -right-4 -translate-y-1/2 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
              <TrendingUp size={160} className="text-[#8B5CF6]" />
            </div>
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
              <div className="max-w-md">
                <p className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-[0.2em] mb-2">Revenue Growth indicator</p>
                <h3 className="text-2xl font-bold text-[#111827] tracking-tight leading-none uppercase">Net Install Bookings</h3>
                <p className="text-[13px] font-medium text-[#6B7280] mt-2">{unit} Bookings minus Recorded Churn ({monthName})</p>
              </div>

              <div className="flex flex-wrap gap-12 items-center">
                <div className="flex flex-col">
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">{monthName} Net</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber 
                      value={closedTotal - churnTotal} 
                      className={cn(
                        "text-3xl font-bold tracking-tight",
                        (closedTotal - churnTotal) >= 0 ? "text-[#111827]" : "text-rose-600"
                      )} 
                    />
                    <span className="text-[10px] font-black text-[#6B7280] uppercase font-mono">GBP</span>
                  </div>
                </div>

                <div className="w-[1px] h-12 bg-gray-100 hidden lg:block" />

                <div className="flex flex-col">
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">YTD Result (NIB)</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber 
                      value={ytdPerformance - churnTotalYTD} 
                      className={cn(
                        "text-3xl font-bold tracking-tight",
                        (ytdPerformance - churnTotalYTD) >= 0 ? "text-[#111827]" : "text-rose-600"
                      )} 
                    />
                    <span className="text-[10px] font-black text-[#6B7280] uppercase font-mono">GBP</span>
                  </div>
                  <p className="text-[10px] font-medium text-[#6B7280]/60 mt-1 uppercase tracking-widest">Jan - {ytdConfig.label}</p>
                  {projectedUnitStats?.hasCall && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[8px] font-bold text-[#F29023] uppercase tracking-widest mb-0.5">▸ Projected NIB incl. {monthName}</p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedNumber 
                          value={projectedUnitStats.projectedNetYtd} 
                          className={cn(
                            "text-xl font-bold tracking-tight font-mono",
                            projectedUnitStats.projectedNetYtd >= 0 ? "text-[#111827]" : "text-rose-600"
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

        {/* Churn Stats Grid - 3-Panel Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-1 px-4 mt-8">
          {/* Panel 1: Low Churn */}
          <div className="bg-[#FEF2F2] p-8 rounded-l-[32px] border border-red-50 relative overflow-hidden group">
            <button 
              onClick={() => {
                setBuilderView('churn' as any);
                setIsCallBuilderOpen(true);
              }}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white border border-red-100 text-[#F43F5E] opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110 rounded-full shadow-lg"
              title="Edit Recorded Churn"
            >
              <Pencil size={14} />
            </button>
            <div className="absolute -top-1 -right-1 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity">
              <AlertCircle size={56} className="text-[#F43F5E]" />
            </div>
            <p className="text-[11px] font-bold text-[#F43F5E] uppercase tracking-widest mb-1">{unit} Booked Churn ({monthName})</p>
            <div className="flex items-baseline gap-3 relative z-10">
              <AnimatedNumber value={churnTotal} className="text-3xl font-bold tracking-tight text-[#F43F5E]" />
              <span className="text-[10px] font-mono font-bold text-[#F43F5E]/60 uppercase">GBP</span>
            </div>
          </div>

          {/* Panel 2: Call Churn */}
          <div className="bg-white p-8 border border-gray-100 relative overflow-hidden group">
            <button 
              onClick={() => {
                setBuilderView('selection');
                setIsCallBuilderOpen(true);
              }}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white border border-red-100 text-[#F43F5E] opacity-0 group-hover:opacity-100 transition-all z-40 hover:scale-110 rounded-full shadow-lg"
              title="Edit Churn Call"
            >
              <Pencil size={14} />
            </button>
            <div className="absolute -top-1 -right-1 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
              <RotateCcw size={56} className="text-[#F43F5E]" />
            </div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1">{unit} Call Churn ({monthName})</p>
            <div className="flex items-baseline gap-3 relative z-10">
              <AnimatedNumber value={dashboardSubmission?.churnCall || 0} className="text-3xl font-bold tracking-tight text-[#F43F5E]" />
              <span className="text-[10px] font-mono font-bold text-[#F43F5E]/40 uppercase">GBP</span>
            </div>
          </div>

          {/* Panel 3: Cumulative Booked Churn YTD */}
          <div className="bg-[#282828] p-8 rounded-r-[32px] border border-[#282828] relative overflow-hidden group text-[#F43F5E] shadow-xl shadow-black/10">
            <div className="absolute -top-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity">
              <History size={56} className="text-[#F43F5E]" />
            </div>
            <p className="text-[11px] font-bold text-[#F43F5E]/60 uppercase tracking-widest mb-1">{unit} Booked Churn (YTD)</p>
            <div className="flex items-baseline gap-3 relative z-10 mt-2">
              <AnimatedNumber value={churnTotalYTD} className="text-3xl font-bold tracking-tight text-[#F43F5E]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#F43F5E]/60 uppercase font-mono">
                  Cumulative Jan - {ytdConfig.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Churn & Placeholders Control Bar */}
        <div className="flex flex-wrap gap-6 items-center bg-[#F9FAFB] p-6 rounded-[24px] border border-gray-100 mx-4">
          <div className="flex items-center gap-3">
            <button
               onClick={() => setShowPlaceholderForm(true)}
               className="px-6 py-3 bg-[#282828] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#F29023] transition-all rounded-full flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> Add Booking Placeholder
            </button>
            <button
               onClick={() => setShowChurnForm(true)}
               className="px-6 py-3 bg-[#F43F5E] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all rounded-full flex items-center gap-2 shadow-sm"
            >
              <Plus size={14} /> Record Churn Item
            </button>
          </div>
          <div className="h-8 w-[1px] bg-gray-200" />
          <div className="flex items-center gap-8">
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-widest">Booked ({monthName})</span>
               <span className="text-sm font-bold text-[#111827] tracking-tight">{formatCurrency(closedTotal)}</span>
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-[#F43F5E] uppercase tracking-widest">Recorded Churn ({monthName})</span>
               <span className="text-sm font-bold text-[#F43F5E] tracking-tight">{formatCurrency(churnTotal)}</span>
             </div>
          </div>
        </div>

        {/* Weekly Priorities Section */}
        <div className="px-4 mt-8">
          <WeeklyPrioritiesPanel unitId={unit} />
        </div>


        {/* Floating Side Sheet: Call Builder */}
        <AnimatePresence>
          {isCallBuilderOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCallBuilderOpen(false)}
                className="fixed inset-0 bg-app-text/60 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-[90vw] lg:max-w-6xl bg-app-panel z-[70] shadow-2xl border-l border-app-text flex flex-col"
              >
                <div className="p-8 border-b border-app-text flex items-center justify-between bg-app-sidebar">
                  <div>
                    <h2 className="text-2xl font-black text-app-text uppercase tracking-tighter">Opportunity Selection</h2>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-[10px] font-bold text-app-muted uppercase tracking-widest leading-none">Targeting: {FORECAST_MONTHS.find(m => m.value === submissionMonth)?.label} 2026</p>
                      <div className="flex bg-app-text/5 p-1 border border-app-text/10">
                        <button 
                          onClick={() => setBuilderView('selection')}
                          className={cn(
                            "px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all",
                            builderView === 'selection' ? "bg-app-text text-white" : "text-app-muted hover:text-app-text"
                          )}
                        >
                          Bookings
                        </button>
                        <button 
                          onClick={() => setBuilderView('churn' as any)}
                          className={cn(
                            "px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all",
                            (builderView as any) === 'churn' ? "bg-rose-600 text-white" : "text-app-muted hover:text-rose-600"
                          )}
                        >
                          Churn
                        </button>
                        <button 
                          onClick={() => setBuilderView('history')}
                          className={cn(
                            "px-3 py-1 text-[8px] font-black uppercase tracking-widest transition-all",
                            builderView === 'history' ? "bg-app-text text-white" : "text-app-muted hover:text-app-text"
                          )}
                        >
                          History
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsCallBuilderOpen(false)} className="p-2 hover:bg-app-text/5 transition-colors">
                    <X size={32} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {builderView === 'selection' ? (
                    <>
                      {/* Existing Booking Content */}
                      <div className="p-8 flex items-center justify-between bg-white border-b border-gray-100">
                        <div className="flex gap-3">
                           <button
                            onClick={() => setShowPlaceholderForm(true)}
                            className="px-6 py-2.5 bg-[#282828] text-white text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-[#F29023] rounded-full shadow-sm"
                          >
                            + Add Placeholder
                          </button>
                          <button
                            onClick={() => setShowAllMonths(!showAllMonths)}
                            className={cn(
                              "px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border border-gray-200 rounded-full",
                              showAllMonths ? "bg-[#E0E5FF] text-[#282828]" : "bg-white text-[#6B7280]"
                            )}
                          >
                            {showAllMonths ? 'Scoped Month' : 'All Loaded Ops'}
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-1 leading-none">Calculated Call</p>
                          <p className="text-2xl font-bold text-[#111827] tracking-tight leading-none">{formatCurrency(callTotal)}</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                            <tr className="bg-gray-50/50">
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Inc. In Call</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Opportunity / Account</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest text-right">MRC (£)</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Status</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Next Steps</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {unitOpps
                              .filter(opp => showAllMonths || opp.forecastMonth === submissionMonth)
                              .map((opp) => (
                              <tr 
                                key={opp.id} 
                                className={cn(
                                  "group hover:bg-[#E0E5FF]/20 transition-colors cursor-default",
                                  opp.isIncludedInCall && "bg-[#E0E5FF]/10"
                                )}
                              >
                                <td className="px-8 py-5">
                                  <button 
                                    onClick={() => toggleOpp(opp.id, !!opp.isIncludedInCall)}
                                    className={cn(
                                      "w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all",
                                      opp.isIncludedInCall 
                                        ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" 
                                        : "border-gray-200 group-hover:border-[#8B5CF6] bg-white"
                                    )}
                                  >
                                    {opp.isIncludedInCall && <CheckCircle2 size={14} />}
                                  </button>
                                </td>
                                 <td className="px-8 py-5">
                                  <p className="text-[12px] font-bold text-[#111827] uppercase tracking-tight leading-snug">{opp.customer}</p>
                                  {editingId === opp.id && editingField === 'oppIdentifier' ? (
                                    <input
                                      autoFocus
                                      className="text-[10px] font-bold text-[#111827] uppercase tracking-widest bg-[#E0E5FF]/30 border-b-2 border-[#8B5CF6] focus:outline-none w-full px-1"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                    />
                                  ) : (
                                    <p 
                                      className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest cursor-pointer hover:text-[#8B5CF6] inline-flex items-center gap-1 group/ident"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(opp, 'oppIdentifier');
                                      }}
                                      title={opp.oppIdentifier}
                                    >
                                      {opp.oppIdentifier.length > 40 ? `${opp.oppIdentifier.substring(0, 40)}...` : opp.oppIdentifier}
                                      <Pencil size={10} className="opacity-0 group-hover/ident:opacity-100 transition-opacity" />
                                    </p>
                                  )}
                                </td>
                                <td className="px-8 py-5 text-right font-mono">
                                  {editingId === opp.id && editingField === 'mrc' ? (
                                    <input
                                      autoFocus
                                      className="text-[13px] font-bold text-[#111827] bg-[#E0E5FF]/30 border-b-2 border-[#8B5CF6] focus:outline-none w-24 text-right px-1"
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onBlur={saveEdit}
                                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                    />
                                  ) : (
                                    <span 
                                      className="text-[13px] font-bold text-[#111827] cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors inline-flex items-center gap-2 group/mrc"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(opp, 'mrc');
                                      }}
                                    >
                                      {formatCurrency(opp.mrc)}
                                      <Pencil size={10} className="opacity-0 group-hover/mrc:opacity-100 transition-opacity text-[#8B5CF6]" />
                                    </span>
                                  )}
                                </td>
                                <td className="px-8 py-5">
                                  <span className={cn(
                                    "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full",
                                    opp.stage === 'Closed Won' ? "bg-emerald-100 text-emerald-700" : 
                                    opp.stage?.toLowerCase().includes('commit') ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                                  )}>
                                    {opp.stage}
                                  </span>
                                </td>
                                <td className="px-8 py-5">
                                  <p 
                                    className="text-[9px] font-medium text-[#6B7280] whitespace-normal break-words max-w-[200px]" 
                                    title={opp.nextStep}
                                  >
                                    {opp.nextStep || 'No next steps recorded'}
                                  </p>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  {opp.stage !== 'Closed Won' ? (
                                    <div className="flex items-center justify-end gap-3">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleInlineUpdate(opp.id, { timeRisk: !opp.timeRisk });
                                        }}
                                        className={cn(
                                          "p-2 rounded-full transition-all border",
                                          opp.timeRisk 
                                            ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                                            : "bg-gray-50 text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-100"
                                        )}
                                        title={opp.timeRisk ? "Time Risk Active" : "Mark as Time Risk"}
                                      >
                                        <Flag size={14} className={cn(opp.timeRisk && "fill-rose-600/20")} />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markAsWon(opp.id);
                                        }}
                                        className="px-4 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 text-[10px] font-bold uppercase tracking-widest hover:bg-[#8B5CF6] hover:text-white transition-all rounded-full flex items-center gap-2 shadow-sm"
                                      >
                                        <Trophy size={12} />
                                        WON
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2 text-emerald-600">
                                      <CheckCircle2 size={16} />
                                      <span className="text-[10px] font-bold uppercase tracking-widest">BOOKED</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (builderView as any) === 'churn' ? (
                    <div className="flex flex-col h-full bg-white">
                       <div className="p-8 flex items-center justify-between bg-rose-50/30 border-b border-rose-100">
                         <div>
                           <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1 leading-none">Recorded Churn Impact</p>
                           <p className="text-3xl font-bold text-rose-900 tracking-tight leading-none">{formatCurrency(churnTotal)}</p>
                         </div>
                         <div className="flex gap-3">
                            <button
                              onClick={handleResetChurn}
                              disabled={isResetting || unitChurn.length === 0}
                              className={cn(
                                "px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-full border flex items-center gap-2",
                                resetSuccess ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-rose-200 text-rose-600 hover:bg-rose-50"
                              )}
                            >
                              {isResetting ? <RotateCcw size={14} className="animate-spin" /> : resetSuccess ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                              {resetSuccess ? "Reset Applied" : "Reset Month Churn"}
                            </button>
                            <button
                              onClick={() => setShowChurnForm(true)}
                              className="px-6 py-2.5 bg-[#F43F5E] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all rounded-full flex items-center gap-2 shadow-lg shadow-rose-200"
                            >
                              <Plus size={14} /> Record More Churn
                            </button>
                         </div>
                       </div>
                       
                       <div className="overflow-y-auto">
                         <table className="w-full text-left border-collapse">
                           <thead className="sticky top-0 bg-white border-b border-rose-100 z-10">
                             <tr className="bg-rose-50/10">
                               <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Customer</th>
                               <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Service Type</th>
                               <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest text-right">MRC (£)</th>
                               <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-widest text-right">Action</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-rose-50">
                             {unitChurn.map((entry) => (
                               <tr key={entry.id} className="group hover:bg-rose-50/20 transition-colors">
                                 <td className="px-8 py-5">
                                   {editingChurnId === entry.id && editingChurnField === 'customerName' ? (
                                      <input
                                        autoFocus
                                        className="text-[12px] font-bold text-[#282828] uppercase tracking-tight bg-rose-50 px-2 py-1 border-b-2 border-rose-400 focus:outline-none w-full"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={saveChurnEdit}
                                        onKeyDown={(e) => e.key === 'Enter' && saveChurnEdit()}
                                      />
                                   ) : (
                                      <p 
                                        className="text-[12px] font-bold text-[#282828] uppercase tracking-tight cursor-pointer hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-3 group/churn"
                                        onClick={() => startChurnEdit(entry, 'customerName')}
                                      >
                                        {entry.customerName}
                                        <Pencil size={10} className="opacity-0 group-hover/churn:opacity-100 transition-opacity text-[#F43F5E]" />
                                      </p>
                                   )}
                                 </td>
                                 <td className="px-8 py-5">
                                   {editingChurnId === entry.id && editingChurnField === 'serviceType' ? (
                                      <input
                                        autoFocus
                                        className="text-[11px] font-medium text-[#6B7280] uppercase font-mono italic bg-rose-50 px-2 py-1 border-b-2 border-rose-400 focus:outline-none w-full"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={saveChurnEdit}
                                        onKeyDown={(e) => e.key === 'Enter' && saveChurnEdit()}
                                      />
                                   ) : (
                                      <p 
                                        className="text-[11px] font-medium text-[#6B7280] uppercase font-mono italic cursor-pointer hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-3 group/type"
                                        onClick={() => startChurnEdit(entry, 'serviceType')}
                                      >
                                        {entry.serviceType}
                                        <Pencil size={10} className="opacity-0 group-hover/type:opacity-100 transition-opacity text-[#F43F5E]" />
                                      </p>
                                   )}
                                 </td>
                                 <td className="px-8 py-5 text-right font-mono">
                                   {editingChurnId === entry.id && editingChurnField === 'mrc' ? (
                                      <input
                                        autoFocus
                                        className="text-[13px] font-bold text-[#F43F5E] bg-rose-50 px-2 py-1 border-b-2 border-rose-400 focus:outline-none w-28 text-right"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={saveChurnEdit}
                                        onKeyDown={(e) => e.key === 'Enter' && saveChurnEdit()}
                                      />
                                   ) : (
                                      <p 
                                        className="text-[13px] font-bold text-[#F43F5E] cursor-pointer hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-3 group/mrc"
                                        onClick={() => startChurnEdit(entry, 'mrc')}
                                      >
                                        -{formatCurrency(entry.mrc)}
                                        <Pencil size={10} className="opacity-0 group-hover/mrc:opacity-100 transition-opacity" />
                                      </p>
                                   )}
                                 </td>
                                 <td className="px-8 py-5 text-right">
                                   <button 
                                     onClick={() => deleteChurnEntry(entry.id)}
                                     className="p-2.5 text-[#6B7280] hover:text-[#F43F5E] hover:bg-rose-50 transition-all rounded-full"
                                     title="Remove Entry"
                                   >
                                     <X size={16} />
                                   </button>
                                 </td>
                               </tr>
                             ))}
                             {unitChurn.length === 0 && (
                               <tr>
                                 <td colSpan={4} className="px-8 py-32 text-center">
                                   <div className="w-20 h-20 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                     <AlertCircle size={32} className="text-gray-300" />
                                   </div>
                                   <p className="text-[12px] font-bold text-[#6B7280] uppercase tracking-widest">No churn entries recorded</p>
                                   <p className="text-[10px] text-[#6B7280]/40 uppercase tracking-widest mt-2">{unit} - {monthName}</p>
                                 </td>
                               </tr>
                             )}
                           </tbody>
                         </table>
                       </div>
                    </div>
                  ) : (
                    <div className="p-10">
                      <div className="flex items-center justify-between mb-10">
                        <h3 className="text-[14px] font-bold text-[#111827] uppercase tracking-tight">Call Archival History</h3>
                        <div className="bg-[#E0E5FF] px-4 py-1.5 rounded-full border border-[#8B5CF6]/10">
                          <p className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Snapshot System Active</p>
                        </div>
                      </div>
                      <div className="space-y-6">
                        {[...forecastHistory]
                          .filter(h => h.unit === unit && h.month === submissionMonth && h.oppIds)
                          .sort((a, b) => b.timestamp - a.timestamp)
                          .map((history) => (
                          <div key={history.timestamp} className="bg-white border border-gray-100 p-8 rounded-[24px] flex items-center justify-between group hover:shadow-lg transition-all hover:border-[#8B5CF6]/20">
                            <div>
                               <div className="flex items-center gap-3 mb-3">
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                                  history.type === 'reset_snapshot' 
                                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                )}>
                                  {history.type === 'reset_snapshot' ? 'Reset Snapshot' : 'Submitted Call'}
                                </span>
                                <span className="text-[11px] font-bold text-[#6B7280] font-mono">{new Date(history.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex items-baseline gap-3">
                                <span className="text-3xl font-bold text-[#111827] tracking-tight">{formatCurrency(history.call)}</span>
                                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest opacity-60">Total Value</span>
                              </div>
                              <p className="text-[10px] font-bold text-[#6B7280]/40 uppercase tracking-widest mt-3 flex items-center gap-2">
                                <Target size={12} />
                                {history.oppIds?.length || 0} Opportunities selected
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                if (history.oppIds) restoreSnapshot(history.oppIds);
                                setBuilderView('selection');
                              }}
                              className="px-6 py-3 border-2 border-[#282828] text-[#282828] text-[10px] font-bold uppercase tracking-widest hover:bg-[#282828] hover:text-white transition-all rounded-full flex items-center gap-2 shadow-sm"
                            >
                              <Undo2 size={14} />
                              RESTORE
                            </button>
                          </div>
                        ))}
                        {[...forecastHistory].filter(h => h.unit === unit && h.month === submissionMonth && h.oppIds).length === 0 && (
                          <div className="text-center py-32 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-200">
                            <History size={48} className="mx-auto text-gray-300 mb-6" />
                            <p className="text-[12px] font-bold text-[#6B7280] uppercase tracking-widest">No archival snapshots found</p>
                            <p className="text-[10px] text-[#6B7280]/40 uppercase tracking-widest mt-2">{unit} - {monthName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between rounded-b-none">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Live Selection Active</p>
                      <p className="text-[13px] font-bold text-[#282828] uppercase tracking-tight">Rippled to Main Dashboard</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCallBuilderOpen(false)}
                    className="px-10 py-5 bg-[#282828] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl shadow-black/20 hover:bg-[#F29023] transition-all"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Right Column: Submission & Charts */}
      <div className="space-y-6">
        <div className="bg-[#282828] p-8 rounded-[32px] text-white shadow-xl shadow-black/10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-[#F29023]">
              Submission
            </h3>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-full">
              <button 
                onClick={() => {
                  const idx = FORECAST_MONTHS.findIndex(m => m.value === submissionMonth);
                  if (idx > 0) setSubmissionMonth(FORECAST_MONTHS[idx - 1].value);
                }}
                className="hover:text-[#F29023] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[10px] font-bold px-4 min-w-[80px] text-center uppercase tracking-widest text-white/80">
                {FORECAST_MONTHS.find(m => m.value === submissionMonth)?.label}
              </span>
              <button 
                onClick={() => {
                  const idx = FORECAST_MONTHS.findIndex(m => m.value === submissionMonth);
                  if (idx < FORECAST_MONTHS.length - 1) setSubmissionMonth(FORECAST_MONTHS[idx + 1].value);
                }}
                className="hover:text-[#F29023] transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <div className="group">
              <div className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
                <span className="group-hover:text-white/60 transition-colors">Calculated Call</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetCall();
                    }}
                    disabled={isResetting}
                    className={cn(
                      "flex items-center gap-2 transition-all bg-white/5 px-3 py-1 border rounded-full",
                      resetSuccess ? "text-emerald-400 border-emerald-400/30" : "text-white/40 border-white/10 hover:text-white hover:border-white/30"
                    )}
                    title="Reset selection for all pipeline deals"
                  >
                    {isResetting ? (
                      <RotateCcw size={12} className="animate-spin" />
                    ) : resetSuccess ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <RotateCcw size={12} />
                    )}
                    {resetSuccess ? 'COMPLETED' : 'RESET'}
                  </button>
                </div>
              </div>
              <div 
                className="w-full border-b border-white/10 pb-4 text-3xl font-bold text-white tracking-tight flex items-center justify-start gap-4 cursor-pointer group/callrow hover:border-[#8B5CF6]/40 transition-colors" 
                onClick={() => setIsCallBuilderOpen(true)}
              >
                {/* PROMINENT BUILDER TRIGGER */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 transition-all group-hover/callrow:bg-[#8B5CF6] group-hover/callrow:text-white group-hover/callrow:border-[#8B5CF6] rounded-full">
                  <Calculator size={16} className="opacity-50 group-hover/callrow:opacity-100" />
                  <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Call Builder</span>
                  <ChevronRight size={12} className="opacity-30 group-hover/callrow:opacity-100" />
                </div>
                
                <span>{formatCurrency(callTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#F29023]/60 mb-2 border-b border-white/5 pb-2">Booking Estimates</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Low Range (£)</label>
                    <input 
                      type="number"
                      value={lowForecast}
                      onChange={(e) => setLowForecast(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-[16px] px-5 py-4 text-white focus:outline-none focus:bg-white/10 focus:border-[#8B5CF6]/40 transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Upside Range (£)</label>
                    <input 
                      type="number"
                      value={upsideForecast}
                      onChange={(e) => setUpsideForecast(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-[16px] px-5 py-4 text-white focus:outline-none focus:bg-white/10 focus:border-[#8B5CF6]/40 transition-all text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-6">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400/60">Churn Estimates</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Churn Low (£)</label>
                      <input 
                        type="number"
                        value={churnLowForecast}
                        onChange={(e) => setChurnLowForecast(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-[16px] px-5 py-4 text-white focus:outline-none focus:bg-rose-500/10 focus:border-rose-500/40 transition-all text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Churn Call (£)</label>
                      <input 
                        type="number"
                        value={churnCallForecast}
                        onChange={(e) => setChurnCallForecast(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-[16px] px-5 py-4 text-white focus:outline-none focus:bg-rose-500/10 focus:border-rose-500/40 transition-all text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">Churn Worst Case (£)</label>
                    <input 
                      type="number"
                      value={churnWorstCaseForecast}
                      onChange={(e) => setChurnWorstCaseForecast(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white/5 border border-white/10 rounded-[16px] px-5 py-4 text-white focus:outline-none focus:bg-rose-500/10 focus:border-rose-500/40 transition-all text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                "w-full px-6 py-5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 mt-6 rounded-full shadow-lg",
                showSuccess 
                  ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-[#F29023] text-white hover:bg-white hover:text-[#282828] shadow-[#F29023]/20"
              )}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : showSuccess ? (
                <>
                  <CheckCircle2 size={16} />
                  SYNCED TO BOARD
                </>
              ) : (
                'SUBMIT FORECAST'
              )}
            </button>
          </div>
        </div>

        {/* Charts - Architectural Style */}
        <div className="bg-white border border-gray-100 p-8 rounded-[32px] shadow-sm">
          <p className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-1">Quota Attainment</p>
          <h3 className="text-xl font-bold text-[#111827] uppercase tracking-tight mb-8">Performance Coverage</h3>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentMonthData} layout="vertical" margin={{ left: -20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#282828', color: '#fff', padding: '12px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="Closed" stackId="a" fill="#111827" radius={[4, 0, 0, 4]} />
                <Bar dataKey="Forecast" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="Remaining" stackId="a" fill="#E0E5FF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#111827]" />
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Closed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Forecast</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#E0E5FF]" />
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Remaining</span>
            </div>
          </div>
        </div>

        {/* Unit Net Performance Trend Chart - New Chart */}
        <div className="bg-white border border-gray-100 p-8 rounded-[32px] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <p className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-widest mb-1">Growth Analytics</p>
              <h3 className="text-xl font-bold text-[#111827] uppercase tracking-tight leading-none">Net Performance Trend</h3>
              <p className="text-[11px] font-medium text-[#6B7280] mt-1">
                Bookings vs. Churn ({unit})
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Bookings</span>
              </div>
              <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[9px] font-bold text-rose-700 uppercase tracking-widest">Churn</span>
              </div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={monthlyNetPerformanceData} 
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                stackOffset="sign"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#6B7280' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 600, fill: '#9CA3AF' }}
                  tickFormatter={(v) => `£${Math.abs(v)/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#282828', color: '#fff', padding: '12px', fontSize: '11px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: '#F9FAFB' }}
                  formatter={(v: number) => [formatCurrency(Math.abs(v)), '']}
                />
                <ReferenceLine y={0} stroke="#E5E7EB" />
                <Bar dataKey="Bookings" fill="#10B981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="Churn" fill="#F43F5E" radius={[0, 0, 4, 4]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Success Notification Toast */}
      <AnimatePresence>
        {logSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
            className="fixed bottom-12 left-1/2 z-[100] px-8 py-5 bg-[#282828] text-white rounded-full shadow-2xl flex items-center gap-6 min-w-[360px] border border-white/10"
          >
            <div className="bg-[#8B5CF6] text-white p-2.5 rounded-full shadow-lg shadow-[#8B5CF6]/40">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 leading-none mb-1.5">System Event</p>
              <p className="text-[14px] font-bold uppercase tracking-tight text-white leading-none">Entry Logged Successfully</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Placeholder Modal - Sharp Grid Style */}
      <AnimatePresence>
        {showPlaceholderForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#282828]/60 backdrop-blur-md z-[80] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-white"
            >
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <p className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-[0.2em] mb-1">Board Interaction</p>
                  <h3 className="text-2xl font-bold text-[#111827] uppercase tracking-tight">
                    {isHistoricalMonth ? 'Log Historical Booking' : 'Add Placeholder'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowPlaceholderForm(false)}
                  className="w-12 h-12 flex items-center justify-center bg-white rounded-full border border-gray-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-10 space-y-8">
                {formError && (
                  <div className="flex items-center gap-3 p-5 bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-widest rounded-2xl border border-rose-100">
                    <AlertCircle size={18} />
                    {formError}
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest ml-1">Customer Name *</label>
                  <input 
                    type="text"
                    value={placeholderData.customer}
                    onChange={(e) => {
                      setFormError(null);
                      setPlaceholderData({...placeholderData, customer: e.target.value});
                    }}
                    disabled={isLogging}
                    className="w-full px-8 py-5 bg-gray-50 border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white focus:outline-none transition-all text-[15px] font-bold uppercase tracking-wide disabled:opacity-50 rounded-2xl"
                    placeholder="ACCOUNT NAME"
                  />
                </div>
                {isHistoricalMonth && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest ml-1">Deal Description</label>
                    <input 
                      type="text"
                      value={placeholderData.description}
                      onChange={(e) => setPlaceholderData({...placeholderData, description: e.target.value})}
                      disabled={isLogging}
                      className="w-full px-8 py-5 bg-gray-50 border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white focus:outline-none transition-all text-[15px] font-bold uppercase tracking-wide disabled:opacity-50 rounded-2xl"
                      placeholder="BRIEF DEAL SUMMARY"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest ml-1">
                      {isHistoricalMonth ? 'Booking Value (£) *' : 'Est. Booking MRC (£) *'}
                    </label>
                    <input 
                      type="number"
                      value={placeholderData.mrc}
                      onChange={(e) => {
                        setFormError(null);
                        setPlaceholderData({...placeholderData, mrc: e.target.value});
                      }}
                      disabled={isLogging}
                      className="w-full px-8 py-5 bg-gray-50 border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white focus:outline-none transition-all text-[15px] font-bold disabled:opacity-50 rounded-2xl"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest ml-1">Registry Ref *</label>
                    <input 
                      type="text"
                      value={placeholderData.identifier}
                      onChange={(e) => {
                        setFormError(null);
                        setPlaceholderData({...placeholderData, identifier: e.target.value});
                      }}
                      disabled={isLogging}
                      className="w-full px-8 py-5 bg-gray-50 border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white focus:outline-none transition-all text-[15px] font-bold uppercase tracking-wide disabled:opacity-50 rounded-2xl"
                      placeholder="OPP REFERENCE"
                    />
                  </div>
                </div>
              </div>

              <div className="p-10 pt-0 flex gap-4">
                <button 
                  onClick={() => setShowPlaceholderForm(false)}
                  disabled={isLogging}
                  className="flex-1 px-8 py-5 border border-gray-200 text-[11px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50 rounded-full"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddPlaceholder}
                  disabled={isLogging}
                  className="flex-1 px-8 py-5 bg-[#282828] text-white text-[11px] font-bold uppercase tracking-widest hover:bg-[#F29023] transition-all disabled:opacity-50 flex items-center justify-center gap-3 rounded-full shadow-xl shadow-black/10"
                >
                  {isLogging ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirm Log
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Churn Record Modal */}
      <AnimatePresence>
        {showChurnForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#282828]/60 backdrop-blur-md"
              onClick={() => setShowChurnForm(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl border border-white"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <p className="text-[11px] font-bold text-rose-500 uppercase tracking-[0.2em] mb-1">Impact Event</p>
                  <h3 className="text-2xl font-bold text-[#111827] uppercase tracking-tight">Record Churn Value</h3>
                  <p className="text-[11px] text-[#6B7280] uppercase tracking-widest mt-1">Impact for {monthName}</p>
                </div>
                <button 
                  onClick={() => setShowChurnForm(false)}
                  className="w-12 h-12 flex items-center justify-center bg-white rounded-full border border-gray-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">Customer Name *</label>
                    <input
                      type="text"
                      value={churnFormData.customer}
                      onChange={(e) => setChurnFormData(prev => ({ ...prev, customer: e.target.value }))}
                      className="w-full bg-gray-50 border border-transparent focus:border-rose-500/30 focus:bg-white p-5 rounded-2xl text-[15px] font-bold focus:outline-none transition-all placeholder:text-gray-300"
                      placeholder="Organization Name"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">Service Type *</label>
                    <input
                      type="text"
                      value={churnFormData.serviceType}
                      onChange={(e) => setChurnFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                      className="w-full bg-gray-50 border border-transparent focus:border-rose-500/30 focus:bg-white p-5 rounded-2xl text-[15px] font-bold focus:outline-none transition-all placeholder:text-gray-300"
                      placeholder="e.g. Ethernet, IP Transit"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">MRC (£) *</label>
                    <input
                      type="number"
                      value={churnFormData.mrc}
                      onChange={(e) => setChurnFormData(prev => ({ ...prev, mrc: e.target.value }))}
                      className="w-full bg-gray-50 border border-transparent focus:border-rose-500/30 focus:bg-white p-5 rounded-2xl text-[15px] font-bold focus:outline-none transition-all placeholder:text-gray-300 text-rose-600"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddChurn}
                  disabled={isLogging}
                  className="w-full bg-rose-600 hover:bg-[#282828] text-white font-bold py-5 rounded-full flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-[11px] shadow-xl shadow-rose-200"
                >
                  {isLogging ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      Log Churn Impact
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, percentage, className }: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: any; 
  color: 'sand' | 'sage' | 'blue';
  percentage?: number;
  className?: string;
}) {
  const bgColors = {
    sand: "bg-pastel-sand",
    sage: "bg-pastel-sage",
    blue: "bg-pastel-blue"
  };

  return (
    <div className={cn("flex-1 p-10 relative group border-app-text", bgColors[color], className)}>
      <div className="flex items-center justify-between mb-8">
        <div className="w-12 h-12 bg-app-text/5 flex items-center justify-center border border-app-text/10 group-hover:bg-app-text/10 transition-colors">
          <Icon size={24} className="text-app-text" />
        </div>
        {percentage !== undefined && (
          <span className="text-xs font-black text-app-text border-b-2 border-app-text pb-1">
            {percentage.toFixed(1)}% RECOVERY
          </span>
        )}
      </div>
      <p className="text-[10px] font-black text-app-muted uppercase tracking-[0.2em] mb-4">{title}</p>
      <p className="text-4xl font-black text-app-text tracking-tighter tracking-tight transition-transform group-hover:translate-x-1 duration-300">{value}</p>
      
      {subtitle && (
        <p className="text-[10px] font-bold text-app-text/60 uppercase tracking-widest mt-4 border-t border-app-text/10 pt-4 font-mono">{subtitle}</p>
      )}

      {percentage !== undefined && (
        <div className="mt-8 w-full bg-app-text/5 h-1 border border-app-text/10 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentage)}%` }}
            className="h-full bg-app-text"
          />
        </div>
      )}
    </div>
  );
}
