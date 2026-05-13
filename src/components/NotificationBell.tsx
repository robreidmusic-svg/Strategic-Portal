import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, XCircle, ExternalLink, Loader2, Inbox, Zap } from 'lucide-react';
import {
  getPendingProposals,
  getAllProposals,
  decideProposal,
  ResearchProposal,
} from '../services/proposalService';

const SCOPE_COLOURS: Record<string, string> = {
  Quick:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  Deep:      'bg-blue-50 text-blue-700 border-blue-200',
  Exhaustive:'bg-purple-50 text-purple-700 border-purple-200',
};

const COST_COLOURS: Record<string, string> = {
  Low:    'text-emerald-600',
  Medium: 'text-amber-600',
  High:   'text-red-600',
};

const COST_BARS: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

function CostDots({ cost }: { cost: string }) {
  const filled = COST_BARS[cost] ?? 1;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= filled ? COST_COLOURS[cost]?.replace('text-', 'bg-') : 'bg-gray-200'}`}
        />
      ))}
    </span>
  );
}

function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: ResearchProposal;
  onDecide: (id: string, decision: 'approved' | 'denied') => void;
}) {
  const [deciding, setDeciding] = useState<'approved' | 'denied' | null>(null);

  const handle = async (decision: 'approved' | 'denied') => {
    setDeciding(decision);
    await onDecide(proposal.id, decision);
  };

  const isPast = proposal.status !== 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border p-4 space-y-3 ${
        isPast
          ? 'bg-gray-50 border-gray-100 opacity-60'
          : 'bg-white border-gray-200 shadow-sm'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${SCOPE_COLOURS[proposal.scope]}`}
          >
            {proposal.scope}
          </span>
          {isPast && (
            <span
              className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                proposal.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {proposal.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <CostDots cost={proposal.estimatedCost} />
          <span className={`text-[9px] font-semibold ${COST_COLOURS[proposal.estimatedCost]}`}>
            {proposal.estimatedCost} cost
          </span>
        </div>
      </div>

      {/* Topic */}
      <p className="text-[13px] font-bold text-[#111827] leading-tight">
        {proposal.topic}
      </p>

      {/* Rationale */}
      <p className="text-[11px] text-[#6B7280] leading-relaxed">
        {proposal.rationale}
      </p>

      {/* Proposed question */}
      <div className="bg-[#F3F4F6] rounded-lg px-3 py-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
          Proposed Research Question
        </p>
        <p className="text-[11px] text-[#374151] italic leading-relaxed">
          "{proposal.proposedQuestion}"
        </p>
      </div>

      {/* Source */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-[#9CA3AF] uppercase tracking-widest font-semibold">
          Signal from
        </span>
        <a
          href={proposal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-bold text-[#8B5CF6] hover:underline flex items-center gap-0.5"
        >
          {proposal.source}
          <ExternalLink size={8} />
        </a>
      </div>

      {/* Actions — only show for pending */}
      {!isPast && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handle('approved')}
            disabled={!!deciding}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#111827] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#1F2937] transition-colors disabled:opacity-50"
          >
            {deciding === 'approved' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CheckCircle size={11} />
            )}
            Approve
          </button>
          <button
            onClick={() => handle('denied')}
            disabled={!!deciding}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-[#6B7280] text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {deciding === 'denied' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <XCircle size={11} />
            )}
            Deny
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [proposals, setProposals] = useState<ResearchProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = showAll ? await getAllProposals() : await getPendingProposals();
      setProposals(data);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    // Initial load of pending count (always)
    getPendingProposals().then(setProposals);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDecide = async (id: string, decision: 'approved' | 'denied') => {
    await decideProposal(id, decision);
    await load();
  };

  const displayed = showAll ? proposals : proposals.filter(p => p.status === 'pending');

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="broggo-notification-bell"
        onClick={() => setOpen(prev => !prev)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm hover:border-[#8B5CF6]/40 hover:shadow-md transition-all"
        title="Broggo Research Proposals"
      >
        <Bell size={15} className={pendingCount > 0 ? 'text-[#8B5CF6]' : 'text-[#6B7280]'} />
        {pendingCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-[#F29023] rounded-full flex items-center justify-center text-[8px] font-black text-white leading-none"
          >
            {pendingCount > 9 ? '9+' : pendingCount}
          </motion.span>
        )}
      </button>

      {/* Inbox panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-[360px] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden z-50"
            id="broggo-inbox-panel"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#8B5CF6]/5 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#8B5CF6]/10 rounded-lg px-2 py-1">
                  <Zap size={10} className="text-[#8B5CF6]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#8B5CF6]">
                    Broggo
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[#111827]">Research Proposals</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#9CA3AF] hover:text-[#111827] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Toggle: pending / all */}
            <div className="flex border-b border-gray-100">
              {(['pending', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setShowAll(tab === 'all')}
                  className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                    (tab === 'all') === showAll
                      ? 'text-[#8B5CF6] border-b-2 border-[#8B5CF6]'
                      : 'text-[#9CA3AF] hover:text-[#6B7280]'
                  }`}
                >
                  {tab === 'pending' ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` : 'All'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-[480px] overflow-y-auto p-3 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-[#9CA3AF]">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[11px]">Scanning intelligence feeds…</span>
                </div>
              ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#9CA3AF]">
                  <Inbox size={28} strokeWidth={1.5} />
                  <p className="text-[11px] text-center leading-relaxed">
                    {showAll
                      ? 'No proposals yet. Run the daily scan to generate one.'
                      : 'Nothing pending. Broggo is satisfied the queue is clear.'}
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {displayed.map(p => (
                    <ProposalCard key={p.id} proposal={p} onDecide={handleDecide} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
