import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getWeekNumber, type WeeklyPriority } from '../services/priorityService';
import { UNITS } from '../constants';
import { cn } from '../lib/utils';
import { ListTodo, CheckCircle2, CircleDot, AlertCircle, TrendingUp, Users } from 'lucide-react';

export function GlobalPrioritiesOverview() {
  const [allPriorities, setAllPriorities] = useState<Record<string, WeeklyPriority>>({});
  const { week, year } = getWeekNumber(new Date());

  useEffect(() => {
    const prioritiesRef = collection(db, 'weeklyPriorities');
    const q = query(
      prioritiesRef,
      where('weekNumber', '==', week),
      where('year', '==', year)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, WeeklyPriority> = {};
      snapshot.docs.forEach(doc => {
        const priority = doc.data() as WeeklyPriority;
        data[priority.unitId] = priority;
      });
      setAllPriorities(data);
    });

    return () => unsubscribe();
  }, [week, year]);

  const heatmapData = useMemo(() => {
    return UNITS.map(unit => {
      const priority = allPriorities[unit];
      return {
        unit: unit.replace('Strategic ', '').replace(' Wholesale', '').toUpperCase(),
        fullName: unit,
        priorities: priority?.priorities || [],
        submitted: !!priority
      };
    });
  }, [allPriorities]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500';
      case 'ongoing': return 'bg-amber-500';
      case 'support_needed': return 'bg-rose-500';
      default: return 'bg-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-600';
      case 'ongoing': return 'text-amber-600';
      case 'support_needed': return 'text-rose-600';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-[#F29023] rounded-full" />
            <h3 className="text-2xl font-bold text-[#111827] tracking-tight uppercase italic">Top 3 Priorities - Week {week}</h3>
          </div>
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.2em] leading-relaxed">
            Deadlines, Blockers, Learnings, Deliverables - ”What must be progressed or resolved this week?”
          </p>
        </div>
        <div className="flex items-center gap-6 px-6 py-2.5 bg-gray-50 border border-gray-100 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Ongoing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-[9px] font-bold text-[#111827] uppercase tracking-widest">Support</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {heatmapData.map((data, idx) => (
          <motion.div 
            key={idx} 
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn(
              "relative p-4 border border-gray-100 rounded-2xl transition-all bg-white shadow-sm overflow-hidden group min-h-[100px] flex flex-col justify-between",
              !data.submitted && "border-dashed border-gray-200 bg-gray-50/30"
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-[9px] font-black text-[#111827] tracking-widest uppercase leading-tight line-clamp-1">
                {data.unit}
              </span>
              {!data.submitted && (
                <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
              )}
            </div>

            <div className="flex gap-1.5 mt-auto">
              {data.submitted ? (
                data.priorities.map((p, pIdx) => (
                  <div 
                    key={pIdx} 
                    className={cn("w-full h-1.5 rounded-full shadow-sm", getStatusColor(p.status))} 
                  />
                ))
              ) : (
                <div className="w-full h-1.5 bg-gray-200 rounded-full grayscale opacity-20" />
              )}
            </div>

            {/* Hover Expansion Details */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-[#282828] p-4 flex flex-col transition-opacity duration-200 z-10">
              <p className="text-[8px] font-black text-[#F29023] uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                {data.fullName}
              </p>
              <div className="space-y-2 flex-grow overflow-y-auto custom-scrollbar">
                {data.submitted ? (
                  data.priorities.map((p, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", getStatusColor(p.status))} />
                      <p className="text-[9px] font-bold text-white/90 leading-[1.3] uppercase tracking-tight">
                        {p.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-center mt-4">
                    Inputs Pending
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
