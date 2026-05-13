import React, { useState } from 'react';
import { UNITS, FORECAST_MONTHS } from '../constants';
import { useApp } from '../context/AppContext';
import { Unit } from '../types';
import { UnitDashboard } from './UnitDashboard';
import { GroupOverview } from './GroupOverview';
import { cn, formatWeekDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export function Dashboard() {
  const { selectedForecastMonth, setSelectedForecastMonth, accentColor: theme, portalUser } = useApp();
  const [activeTab, setActiveTab] = useState<Unit | 'Overview'>('Overview');
  const [currentDate, setCurrentDate] = useState<string>('');

  const getDaysRemaining = () => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDayOfMonth.getDate() - today.getDate();
  };
  
  const daysRemaining = getDaysRemaining();

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  const formatHeaderDate = () => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = now.getDate();
    const monthName = now.toLocaleDateString('en-GB', { month: 'long' });
    const year = now.getFullYear();
    
    return `${dayName}, ${day}${getOrdinalSuffix(day)} ${monthName} ${year}`;
  };

  // Apply theme to body data-attribute for global variable switching
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Live Date Logic
  React.useEffect(() => {
    setCurrentDate(formatHeaderDate());
    
    const timer = setInterval(() => {
      setCurrentDate(formatHeaderDate());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const themeColors = {
    sage: 'text-emerald-900/40',
    dark: 'text-zinc-400',
    mono: 'text-black/20',
    nord: 'text-[#88C0D0]/40',
    matrix: 'text-[#00FF41]/20',
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-12">
      {/* Header with Archival Styling: Handcrafted serif, technical markers */}
      <header className="pb-12 border-b border-archival-parchment/50">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="w-px h-6 bg-archival-terracotta/40" />
            <p className="text-[10px] font-black text-archival-ink uppercase tracking-[0.4em] font-mono">
              ZAYO EUROPE | STRATEGIC NODE
            </p>
          </div>
          <NotificationBell />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-black text-archival-ink tracking-tighter leading-[0.9] font-serif uppercase italic">
              Strategic<br/>
              <span className="text-archival-terracotta">Team Portal</span>
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-[2px] w-12 bg-archival-terracotta" />
              <p className="text-sm font-black text-archival-ink/60 uppercase tracking-widest font-friendly">
                {getGreeting()}, <span className="text-archival-ink">{portalUser?.firstName || 'Strategist'}</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-start md:items-end text-right gap-4">
            <div className="flex items-center gap-3 px-5 py-2 bg-archival-ink text-white rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-black/10">
              <Shield size={12} className="text-archival-terracotta" />
              Authenticated Session
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[20px] font-black text-archival-ink leading-none tracking-tight font-mono">{currentDate || '2026'}</span>
              <div className="w-1.5 h-1.5 bg-archival-terracotta rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Navigation Controls Area */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Unit Switcher - Archival Tabs */}
          <div className="flex bg-archival-parchment/50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar border border-archival-parchment">
            <button
              onClick={() => setActiveTab('Overview')}
              className={cn(
                "px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap font-friendly",
                activeTab === 'Overview' 
                  ? "bg-archival-ink text-white shadow-lg" 
                  : "text-archival-ink/40 hover:text-archival-ink hover:bg-white/50"
              )}
            >
              System Overview
            </button>
            {UNITS.map((unit) => (
              <button
                key={unit}
                onClick={() => setActiveTab(unit)}
                className={cn(
                  "px-8 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap font-friendly",
                  activeTab === unit 
                    ? "bg-archival-ink text-white shadow-lg" 
                    : "text-archival-ink/40 hover:text-archival-ink hover:bg-white/50"
                )}
              >
                {unit}
              </button>
            ))}
          </div>

          {/* Archival Month Selector */}
          <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl border border-archival-parchment shadow-sm">
            <button 
              onClick={() => {
                const idx = FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth);
                if (idx > 0) setSelectedForecastMonth(FORECAST_MONTHS[idx - 1].value);
              }}
              disabled={FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth) === 0}
              className="p-2 hover:bg-archival-parchment rounded-xl disabled:opacity-20 text-archival-ink/40 hover:text-archival-ink transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="px-6 py-1 min-w-[120px] text-center border-x border-archival-parchment">
              <span className="text-[10px] font-black text-archival-ink uppercase tracking-[0.3em] font-mono">
                {FORECAST_MONTHS.find(m => m.value === selectedForecastMonth)?.label} '26
              </span>
            </div>

            <button 
              onClick={() => {
                const idx = FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth);
                if (idx < FORECAST_MONTHS.length - 1) setSelectedForecastMonth(FORECAST_MONTHS[idx + 1].value);
              }}
              disabled={FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth) === FORECAST_MONTHS.length - 1}
              className="p-2 hover:bg-archival-parchment rounded-xl disabled:opacity-20 text-archival-ink/40 hover:text-archival-ink transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-archival-parchment pt-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-archival-sage rounded-full" />
            <span className="text-[9px] font-black text-archival-ink/40 uppercase tracking-[0.3em] font-mono">BROGGO NEURAL ENGINE: STABLE</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-archival-parchment text-archival-ink rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-archival-parchment/50">
              <Calendar size={12} className="text-archival-terracotta" />
              <span>{daysRemaining} DAYS UNTIL LOCK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${selectedForecastMonth}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'Overview' ? (
              <GroupOverview />
            ) : (
              <UnitDashboard unit={activeTab as Unit} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

