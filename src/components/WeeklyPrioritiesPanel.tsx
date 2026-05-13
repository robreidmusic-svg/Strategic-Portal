import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2, AlertCircle, Clock, Save, ChevronRight, ListTodo, CircleDot, Activity, UserPlus } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { getWeekNumber, submitWeeklyPriorities, type WeeklyPriority } from '../services/priorityService';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';

interface WeeklyPrioritiesPanelProps {
  unitId: string;
}

export function WeeklyPrioritiesPanel({ unitId }: WeeklyPrioritiesPanelProps) {
  const { portalUser } = useApp();
  const [currentPriority, setCurrentPriority] = useState<WeeklyPriority | null>(null);
  const [priorityTexts, setPriorityTexts] = useState(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isFridayReview, setIsFridayReview] = useState(false);

  const { week, year } = getWeekNumber(new Date());

  useEffect(() => {
    const today = new Date();
    setIsFridayReview(today.getDay() === 5); // 5 is Friday

    const prioritiesRef = collection(db, 'weeklyPriorities');
    const q = query(
      prioritiesRef,
      where('unitId', '==', unitId),
      where('weekNumber', '==', week),
      where('year', '==', year),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as WeeklyPriority;
        setCurrentPriority({ ...data, id: snapshot.docs[0].id });
        setPriorityTexts(data.priorities.map(p => p.text));
      } else {
        setCurrentPriority(null);
        setPriorityTexts(['', '', '']);
      }
    });

    return () => unsubscribe();
  }, [unitId, week, year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalUser) return;

    setIsSubmitting(true);
    try {
      const priorityData: Omit<WeeklyPriority, 'id'> = {
        unitId,
        weekNumber: week,
        year,
        priorities: priorityTexts.map((text, idx) => ({
          text,
          status: currentPriority?.priorities[idx]?.status || 'pending'
        })),
        submittedBy: portalUser.firstName + ' ' + portalUser.lastName,
        submittedAt: currentPriority?.submittedAt || Date.now(),
        updatedAt: Date.now()
      };

      await submitWeeklyPriorities(priorityData);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error submitting priorities:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (idx: number, status: WeeklyPriority['priorities'][0]['status']) => {
    if (!currentPriority?.id) return;

    const newPriorities = [...currentPriority.priorities];
    newPriorities[idx].status = status;

    const docRef = doc(db, 'weeklyPriorities', currentPriority.id);
    await updateDoc(docRef, {
      priorities: newPriorities,
      updatedAt: Date.now()
    });
  };

  const isDeadlinePassed = () => {
    const now = new Date();
    // Monday midday check
    if (now.getDay() === 1 && now.getHours() >= 12) return true;
    if (now.getDay() > 1) return true;
    return false;
  };

  const deadlinePassed = isDeadlinePassed();

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden font-sans">
      <div className="p-5 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#282828] text-white rounded-xl flex items-center justify-center shadow-md">
            <ListTodo size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#111827] uppercase tracking-tighter leading-none italic">
              Top 3 Priorities - Week {week}
            </h3>
            <p className="text-[9px] font-bold text-[#6B7280] uppercase tracking-[0.2em] mt-1 flex items-start gap-2">
              <Clock size={10} className={cn("mt-0.5", deadlinePassed ? "text-rose-500" : "text-emerald-500")} />
              <span>Deadlines, Blockers, Learnings, Deliverables - ”What must be progressed or resolved this week?”</span>
            </p>
          </div>
        </div>
        {!deadlinePassed && (
          <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
            <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Mon 12:00</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {isFridayReview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
              <Activity size={16} className="text-[#8B5CF6] animate-pulse" />
              <p className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-widest">Friday Strategic Review</p>
            </div>
            {currentPriority?.priorities.map((p, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs font-bold text-[#111827] leading-tight">{p.text || `Priority ${idx + 1}`}</p>
                  <span className={cn(
                    "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-sm tracking-widest",
                    p.status === 'completed' ? "bg-emerald-600 text-white" :
                    p.status === 'ongoing' ? "bg-amber-500 text-white" :
                    p.status === 'support_needed' ? "bg-rose-600 text-white" :
                    "bg-gray-400 text-white"
                  )}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleStatusUpdate(idx, 'completed')}
                    className={cn(
                      "py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all",
                      p.status === 'completed' ? "bg-emerald-600 text-white" : "bg-white text-gray-400 border border-gray-100"
                    )}
                  >
                    Done
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(idx, 'ongoing')}
                    className={cn(
                      "py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all",
                      p.status === 'ongoing' ? "bg-amber-500 text-white" : "bg-white text-gray-400 border border-gray-100"
                    )}
                  >
                    Ongoing
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(idx, 'support_needed')}
                    className={cn(
                      "py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all",
                      p.status === 'support_needed' ? "bg-rose-600 text-white" : "bg-white text-gray-400 border border-gray-100"
                    )}
                  >
                    Support
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {priorityTexts.map((text, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400 group-focus-within:bg-[#282828] group-focus-within:text-white transition-all">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    required
                    disabled={deadlinePassed && currentPriority != null}
                    value={text}
                    onChange={(e) => {
                      const newTexts = [...priorityTexts];
                      newTexts[idx] = e.target.value;
                      setPriorityTexts(newTexts);
                    }}
                    placeholder={`Priority ${idx + 1}...`}
                    className="w-full bg-gray-50 border border-transparent focus:border-[#8B5CF6]/30 focus:bg-white pl-12 pr-6 py-4 rounded-xl text-[13px] font-bold placeholder:text-gray-300 focus:outline-none transition-all shadow-inner disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              {showSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-emerald-600"
                >
                  <CheckCircle2 size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Saved</span>
                </motion.div>
              ) : (
                <div />
              )}
              
              <button
                type="submit"
                disabled={isSubmitting || (deadlinePassed && currentPriority != null)}
                className="px-8 py-3 bg-[#282828] text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#8B5CF6] transition-all disabled:opacity-30 shadow-md flex items-center gap-2"
              >
                {isSubmitting ? <Clock className="animate-spin" size={12} /> : <Save size={12} />}
                {currentPriority ? 'Update' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100">
        <div className="flex items-center justify-between text-[8px] font-bold text-[#6B7280] uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", currentPriority ? "bg-emerald-500" : "bg-rose-500")} />
            {currentPriority ? currentPriority.submittedBy : 'Pending'}
          </div>
          {currentPriority && (
            <span className="font-medium lowercase italic text-gray-400">
              {new Date(currentPriority.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
