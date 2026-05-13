import React, { useMemo, useState } from 'react';
import { KnowledgeNode } from '../services/researchService';
import { Brain, Zap, Link2, TrendingUp, ArrowRight, FileText, Globe, Database, Pencil, Trash2, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface IntelligenceFeedProps {
  nodes: KnowledgeNode[];
  onUpdateSynthesis?: (sourceId: string, targetId: string, rationale: string) => void;
  onDeleteSynthesis?: (sourceId: string, targetId: string) => void;
}

interface SynthesisCard {
  id: string;
  sourceId: string;
  targetId: string;
  sourceTitle: string;
  sourceType: string;
  sourceCategory: string;
  targetTitle: string;
  targetType: string;
  targetCategory: string;
  rationale: string;
  isCrossType: boolean;
  timestamp: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <Database className="w-3.5 h-3.5" />,
  operator: <Globe className="w-3.5 h-3.5" />,
  market: <TrendingUp className="w-3.5 h-3.5" />,
  regulatory: <FileText className="w-3.5 h-3.5" />,
  commercial: <Link2 className="w-3.5 h-3.5" />,
};

export function IntelligenceFeed({ nodes, onUpdateSynthesis, onDeleteSynthesis }: IntelligenceFeedProps) {
  const syntheses = useMemo(() => {
    const results: SynthesisCard[] = [];

    nodes.forEach(node => {
      if (node.synthesisMap && Object.keys(node.synthesisMap).length > 0) {
        Object.entries(node.synthesisMap).forEach(([targetId, rationale]) => {
          const target = nodes.find(n => n.id === targetId);
          if (target && rationale) {
            const isCrossType = node.type !== target.type;
            results.push({
              id: `${node.id}_${targetId}`,
              sourceId: node.id,
              targetId: targetId,
              sourceTitle: node.title,
              sourceType: node.type,
              sourceCategory: node.category,
              targetTitle: target.title,
              targetType: target.type,
              targetCategory: target.category,
              rationale,
              isCrossType,
              timestamp: node.updatedAt,
            });
          }
        });
      }
    });

    // Cross-type syntheses first (most valuable), then by recency
    return results.sort((a, b) => {
      if (a.isCrossType !== b.isCrossType) return a.isCrossType ? -1 : 1;
      return b.timestamp - a.timestamp;
    });
  }, [nodes]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Sort nodes by creation time for the recent-memories fallback
  const recentNodes = useMemo(() =>
    [...nodes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8),
    [nodes]
  );

  // ── CASE 1: Synthesis cross-reference data exists ──
  if (syntheses.length > 0) {
    return (
      <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
        {syntheses.map((syn, index) => (
          <motion.div
            key={syn.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
            className={`p-4 relative overflow-hidden rounded-2xl border transition-all group cursor-default ${
              syn.isCrossType
                ? 'border-archival-terracotta/20 bg-archival-parchment/30 hover:bg-archival-parchment/50'
                : 'border-paper-border bg-white hover:bg-archival-bone'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg shrink-0 ${
                syn.isCrossType ? 'bg-archival-terracotta/10 text-archival-terracotta' : 'bg-archival-parchment text-archival-ink'
              }`}>
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  {syn.isCrossType && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black tracking-[0.15em] text-archival-terracotta uppercase font-friendly">
                      <TrendingUp className="w-3 h-3" />
                      <span>Cross-Domain Synthesis</span>
                    </div>
                  )}
                  {onUpdateSynthesis && onDeleteSynthesis && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingId(syn.id); setEditValue(syn.rationale); }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onDeleteSynthesis(syn.sourceId, syn.targetId)}
                        className="text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === syn.id ? (
                  <div className="mt-1 flex flex-col gap-2">
                    <textarea 
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full text-[13px] text-archival-ink leading-relaxed font-medium bg-white border border-archival-terracotta/20 rounded-lg p-2 focus:ring-2 focus:ring-archival-terracotta outline-none font-friendly"
                      rows={3}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (onUpdateSynthesis) {
                            onUpdateSynthesis(syn.sourceId, syn.targetId, editValue);
                          }
                          setEditingId(null);
                        }}
                        className="p-1 text-white bg-archival-terracotta hover:bg-archival-ink rounded-md transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-archival-ink leading-relaxed font-medium font-friendly">
                    {syn.rationale}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-white border border-paper-border text-archival-ink font-semibold truncate max-w-[140px] font-mono">
                    {syn.sourceTitle}
                  </span>
                  <ArrowRight className="w-3 h-3 text-paper-muted shrink-0" />
                  <span className="px-2 py-0.5 rounded-full bg-white border border-paper-border text-archival-ink font-semibold truncate max-w-[140px] font-mono">
                    {syn.targetTitle}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-400">
                  <span>{syn.sourceType}/{syn.sourceCategory}</span>
                  <span>↔</span>
                  <span>{syn.targetType}/{syn.targetCategory}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── CASE 2: No synthesis yet but we have nodes — show recent memories ──
  if (recentNodes.length > 0) {
    return (
      <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Brain className="w-3.5 h-3.5 text-indigo-400" />
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            Recent Memories — Run Re-Sync to generate synthesis links
          </p>
        </div>
        {recentNodes.map((node, index) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg shrink-0 bg-indigo-50 text-indigo-500">
                {TYPE_ICONS[node.type] || <Brain className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-black tracking-[0.15em] text-indigo-400 uppercase bg-indigo-50 px-2 py-0.5 rounded-full">
                    {node.type}
                  </span>
                  <span className="text-[8px] text-gray-400 truncate">{node.category}</span>
                </div>
                <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">
                  {node.title}
                </p>
                <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mt-1">
                  {node.summary}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // ── CASE 3: Empty library ──
  return (
    <div className="flex flex-col items-center justify-center p-8 text-gray-500 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
      <Brain className="w-8 h-8 mb-3 opacity-20" />
      <p className="text-sm font-medium">No strategic syntheses yet.</p>
      <p className="text-xs opacity-60 mt-1">Ingest data and run a Global Re-Sync to generate narrative links.</p>
    </div>
  );
}
