import React, { useState } from 'react';
import { ai, Type } from '../services/ai/client';
import { 
  Sparkles, LayoutGrid, FileText, Send, User, Target, Map, AlertTriangle, 
  ChevronRight, Download, Share2, CheckCircle2, ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AIInfographic } from '../types';
import { motion, AnimatePresence } from 'motion/react';



export function AccountPlanBuilder() {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'infographic' | 'deck'>('infographic');
  const [plan, setPlan] = useState<AIInfographic | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    strategicGoals: '',
    keyContacts: '',
    relationshipMap: '',
    painPoints: ''
  });

  const generatePlan = async () => {
    if (!formData.customerName) return alert('Please enter a customer name');
    
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a strategic account plan for ${formData.customerName}. 
        Strategic Goals: ${formData.strategicGoals}
        Key Contacts: ${formData.keyContacts}
        Relationship Map: ${formData.relationshipMap}
        Pain Points: ${formData.painPoints}
        
        Provide a structured strategic plan for a high-stakes enterprise sales team.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executive_summary: { type: Type.STRING },
              strategic_pillars: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    icon: { type: Type.STRING, description: "A lucide-react icon name like 'Target', 'Zap', 'Shield'" },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["icon", "title", "description"]
                }
              },
              relationship_map: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] }
                  },
                  required: ["name", "role", "sentiment"]
                }
              },
              action_plan: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["executive_summary", "strategic_pillars", "relationship_map", "action_plan"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setPlan(result);
    } catch (error) {
      console.error('AI Generation Error:', error);
      alert('Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-16">
      <header className="border-b-4 border-app-text pb-12">
        <p className="text-[10px] font-black text-app-muted uppercase tracking-[0.3em] mb-4">Strategic Intelligence</p>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
          <h2 className="text-5xl md:text-7xl font-black text-app-text tracking-[-0.04em] leading-[0.85] font-aptos uppercase">
            Account<br />
            <span className="text-app-muted opacity-20">Strategy</span>
          </h2>
          {plan && (
            <div className="flex border border-app-text bg-white p-1 self-start">
              <button
                onClick={() => setView('infographic')}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  view === 'infographic' ? "bg-app-text text-white" : "text-app-muted hover:text-app-text"
                )}
              >
                <LayoutGrid size={16} />
                Manifesto
              </button>
              <button
                onClick={() => setView('deck')}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  view === 'deck' ? "bg-app-text text-white" : "text-app-muted hover:text-app-text"
                )}
              >
                <FileText size={16} />
                Briefing
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
        {/* Input Panel */}
        <div className="xl:col-span-4">
          <div className="bg-white border border-app-text p-10 space-y-10">
            <h3 className="text-xl font-black text-app-text uppercase tracking-tight flex items-center gap-3">
              <User size={24} />
              Entity Specs
            </h3>
            <div className="space-y-8">
              <InputField 
                label="Customer Entity" 
                value={formData.customerName} 
                onChange={(v) => setFormData({...formData, customerName: v})} 
                placeholder="GLOBAL OPERATIONS LTD"
              />
              <TextAreaField 
                label="Strategic Trajectory" 
                value={formData.strategicGoals} 
                onChange={(v) => setFormData({...formData, strategicGoals: v})} 
                placeholder="Objectives for the current fiscal cycle..."
              />
              <TextAreaField 
                label="Principal Agents" 
                value={formData.keyContacts} 
                onChange={(v) => setFormData({...formData, keyContacts: v})} 
                placeholder="Primary decision makers and stakeholders..."
              />
              <TextAreaField 
                label="Influence Network" 
                value={formData.relationshipMap} 
                onChange={(v) => setFormData({...formData, relationshipMap: v})} 
                placeholder="Mapping of internal and external connections..."
              />
              <TextAreaField 
                label="Friction Points" 
                value={formData.painPoints} 
                onChange={(v) => setFormData({...formData, painPoints: v})} 
                placeholder="Critical operational challenges..."
              />
              <button
                onClick={generatePlan}
                disabled={loading}
                className="w-full bg-app-text text-white font-black py-6 text-[11px] uppercase tracking-[0.3em] transition-all hover:opacity-90 flex items-center justify-center gap-4 disabled:opacity-30"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-none animate-spin" />
                    SYNTHESIZING...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    GENERATE BLUEPRINT
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Panel */}
        <div className="xl:col-span-8">
          <AnimatePresence mode="wait">
            {!plan ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[700px] flex flex-col items-center justify-center bg-app-bg border border-app-text p-16 text-center"
              >
                <div className="w-24 h-24 bg-white border border-app-text flex items-center justify-center mb-10">
                  <Sparkles className="text-app-muted opacity-30" size={48} />
                </div>
                <h3 className="text-2xl font-black text-app-text uppercase tracking-tight mb-4">Input Required</h3>
                <p className="text-[10px] font-bold text-app-muted uppercase tracking-[0.2em] max-w-xs leading-relaxed">
                  Populate executive parameters to generate a synthetic account strategy.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              >
                {view === 'infographic' ? (
                  <InfographicView plan={plan} />
                ) : (
                  <DeckView plan={plan} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function InfographicView({ plan }: { plan: AIInfographic }) {
  return (
    <div className="space-y-16">
      {/* Executive Summary */}
      <div className="bg-white border-app-text border-2 p-12 relative">
        <div className="absolute top-0 right-0 w-32 h-32 border-l border-b border-app-text flex items-center justify-center uppercase font-black text-[10px] tracking-widest text-app-muted p-4">
          Abstract.01
        </div>
        <div className="space-y-8">
          <h3 className="text-[10px] font-black text-app-text uppercase tracking-[0.4em]">Integrated Strategy Brief</h3>
          <p className="text-4xl text-app-text font-black leading-[1.1] tracking-tight font-aptos">
            "{plan.executive_summary}"
          </p>
        </div>
      </div>

      {/* Strategic Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plan.strategic_pillars.map((pillar, i) => (
          <div key={i} className="bg-white p-10 border border-app-text group hover:bg-app-text hover:text-white transition-all duration-300">
            <div className="w-16 h-16 bg-app-bg border border-app-text flex items-center justify-center mb-8 group-hover:bg-white group-hover:border-white transition-all">
              <Target className={cn("text-app-text transition-colors")} size={32} />
            </div>
            <h4 className="text-lg font-black uppercase tracking-tight mb-4">{pillar.title}</h4>
            <p className="text-[11px] font-bold opacity-60 uppercase tracking-wide leading-relaxed">{pillar.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Relationship Map */}
        <div className="bg-app-bg border border-app-text p-12">
          <h3 className="text-2xl font-black text-app-text uppercase tracking-tight mb-12 flex items-center gap-4">
            <Map size={32} />
            Influence Map
          </h3>
          <div className="space-y-6">
            {plan.relationship_map.map((person, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-white border border-app-text">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-app-text text-white flex items-center justify-center font-black text-xl">
                    {person.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight text-app-text">{person.name}</p>
                    <p className="text-[9px] font-bold text-app-muted uppercase tracking-widest mt-1">{person.role}</p>
                  </div>
                </div>
                <span className={cn(
                  "px-4 py-2 border border-app-text text-[9px] font-black uppercase tracking-[0.2em]",
                  person.sentiment === 'Positive' ? "bg-pastel-sage text-app-text" :
                  person.sentiment === 'Negative' ? "bg-rose-100 text-rose-600" :
                  "bg-app-bg text-app-muted"
                )}>
                  {person.sentiment}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Plan */}
        <div className="bg-app-text p-12 text-white">
          <h3 className="text-2xl font-black uppercase tracking-tight mb-12 flex items-center gap-4">
            <CheckCircle2 size={32} className="text-pastel-sage" />
            Execution Chain
          </h3>
          <div className="space-y-12">
            {plan.action_plan.map((step, i) => (
              <div key={i} className="flex gap-8 group">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border border-white/20 flex items-center justify-center text-[10px] font-black shrink-0 transition-all bg-white/5">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {i < plan.action_plan.length - 1 && <div className="w-px h-full bg-white/10 mt-4" />}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest pt-3 leading-relaxed text-white/60">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckView({ plan }: { plan: AIInfographic }) {
  const slides = [
    { title: "Summary", subtitle: "Core Thesis", content: plan.executive_summary, icon: FileText },
    ...plan.strategic_pillars.map(p => ({ title: p.title, subtitle: "Strategic Pillar", content: p.description, icon: Target })),
    { title: "Roadmap", subtitle: "Terminal Goals", content: plan.action_plan.join('\n\n'), icon: ArrowRight }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <div className="bg-white border border-app-text flex flex-col min-h-[700px]">
      <div className="p-16 flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className="space-y-12"
          >
            <div className="space-y-4">
              <p className="text-[10px] font-black text-app-muted uppercase tracking-[0.4em] mb-4">{slides[currentSlide].subtitle}</p>
              <h3 className="text-6xl font-black text-app-text tracking-[-0.04em] uppercase font-aptos">{slides[currentSlide].title}</h3>
            </div>
            <div className="w-24 h-px bg-app-text mx-auto opacity-20" />
            <p className="text-2xl font-bold text-app-text leading-tight uppercase font-aptos max-w-2xl">
              {slides[currentSlide].content}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-10 bg-app-bg border-t border-app-text flex items-center justify-between">
        <div className="flex gap-4">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1 transition-all duration-500",
                currentSlide === i ? "w-16 bg-app-text" : "w-4 bg-app-border"
              )}
            />
          ))}
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-4 border border-app-text hover:bg-white disabled:opacity-20 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-3"
          >
            <ChevronRight size={20} className="rotate-180" />
            Prev
          </button>
          <button 
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-4 bg-app-text text-white disabled:opacity-20 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-3"
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="space-y-3">
      <label className="text-[9px] font-black text-app-muted uppercase tracking-[0.3em]">{label}</label>
      <input 
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-app-bg border border-app-text px-6 py-4 text-app-text placeholder:text-app-muted/30 focus:outline-none focus:bg-white transition-all text-xs font-bold uppercase tracking-tight"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="space-y-3">
      <label className="text-[9px] font-black text-app-muted uppercase tracking-[0.3em]">{label}</label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-app-bg border border-app-text px-6 py-4 text-app-text placeholder:text-app-muted/30 focus:outline-none focus:bg-white transition-all text-xs font-bold uppercase tracking-tight resize-none"
      />
    </div>
  );
}
