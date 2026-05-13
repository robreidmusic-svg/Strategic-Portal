import React, { useState, useRef } from 'react';
import { FileText, Save, Download, Image as ImageIcon, Loader2, Plus, Trash2, Layout, Zap, Info } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { chatWithBrilliantBasics, chatWithCommercialCounsel, generateSolutionDiagram } from '../services/geminiService';

interface CommercialTerm {
  id: string;
  label: string;
  value: string;
}

export function QuoteBuilder() {
  const [customerName, setCustomerName] = useState('GLOBAL TECH LTD');
  const [projectTitle, setProjectTitle] = useState('ENTERPRISE CONNECTIVITY SUITE');
  const [solutionDescription, setSolutionDescription] = useState('High-capacity fibre backbone connecting London and Amsterdam nodes with diverse routing and sub-5ms latency guarantees.');
  const [terms, setTerms] = useState<CommercialTerm[]>([
    { id: '1', label: 'MONTHLY RECURRING (MRC)', value: '£4,500' },
    { id: '2', label: 'NON-RECURRING (NRC)', value: '£1,200' },
    { id: '3', label: 'CONTRACT TERM', value: '36 MONTHS' },
  ]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDiagram, setGeneratedDiagram] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const quoteRef = useRef<HTMLDivElement>(null);

  const handleAddTerm = () => {
    setTerms([...terms, { id: Date.now().toString(), label: 'NEW TERM', value: 'VALUE' }]);
  };

  const handleUpdateTerm = (id: string, field: 'label' | 'value', value: string) => {
    setTerms(terms.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleRemoveTerm = (id: string) => {
    setTerms(terms.filter(t => t.id !== id));
  };

  const handleGenerateDiagram = async () => {
    if (!solutionDescription || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const svg = await generateSolutionDiagram(solutionDescription);
      setGeneratedDiagram(svg);
    } catch (error) {
      console.error("Diagram generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    setIsExporting(true);
    // Simulate a brief delay to hide UI elements if needed before print
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 500);
  };

  return (
    <div className="space-y-12 pb-20 font-mono">
      {/* Header Area */}
      <header className="border-b-4 border-pastel-blue pb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] mb-2">Deal Architecture Toolkit</p>
            <h2 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-[0.9]">
              Quote<br />
              <span className="text-zinc-400">Architect</span>
            </h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-pastel-blue hover:text-zinc-900 transition-all flex items-center gap-3 border border-zinc-900"
            >
              <Download size={14} />
              Export PDF
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        {/* Editor Side */}
        <div className="xl:col-span-4 space-y-8 no-print">
          <div className="bg-white border-2 border-zinc-900 p-6 space-y-6 shadow-[8px_8px_0px_0px_#EAF0F2]">
            <div className="flex items-center gap-3 border-b-2 border-zinc-900 pb-4">
              <Zap size={20} className="text-zinc-400" />
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Input Parameters</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Client Identity</label>
                <input 
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 text-xs font-black focus:outline-none focus:border-zinc-900 uppercase"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Opportunity Name</label>
                <input 
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value.toUpperCase())}
                  className="w-full bg-zinc-50 border border-zinc-200 p-3 text-xs font-black focus:outline-none focus:border-zinc-900 uppercase"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Commercial Terms</label>
                <button 
                  onClick={handleAddTerm}
                  className="text-[9px] font-black text-zinc-900 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <Plus size={10} /> Add Item
                </button>
              </div>
              <div className="space-y-3">
                {terms.map((term) => (
                  <div key={term.id} className="flex gap-2 group">
                    <input 
                      value={term.label}
                      onChange={(e) => handleUpdateTerm(term.id, 'label', e.target.value.toUpperCase())}
                      className="flex-1 bg-zinc-50 border border-zinc-200 p-2 text-[10px] font-bold focus:outline-none focus:border-zinc-900"
                    />
                    <input 
                      value={term.value}
                      onChange={(e) => handleUpdateTerm(term.id, 'value', e.target.value.toUpperCase())}
                      className="w-24 bg-zinc-50 border border-zinc-200 p-2 text-[10px] font-black text-right focus:outline-none focus:border-zinc-900"
                    />
                    <button 
                      onClick={() => handleRemoveTerm(term.id)}
                      className="p-2 text-zinc-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">Solution Schematic</label>
                <div className="flex items-center gap-1 bg-pastel-sage px-2 py-0.5 border border-pastel-sage">
                  <span className="text-[8px] font-black text-emerald-800 uppercase tracking-widest">AI Assisted</span>
                </div>
              </div>
              <textarea 
                value={solutionDescription}
                onChange={(e) => setSolutionDescription(e.target.value)}
                placeholder="Describe the solution architecture..."
                className="w-full h-32 bg-zinc-50 border border-zinc-200 p-4 text-[10px] font-medium leading-relaxed focus:outline-none focus:border-zinc-900 resize-none"
              />
              <button 
                onClick={handleGenerateDiagram}
                disabled={isGenerating || !solutionDescription}
                className={cn(
                  "w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                  isGenerating ? "bg-zinc-100 text-zinc-400 border-zinc-100" : "bg-pastel-blue text-zinc-900 hover:bg-zinc-900 hover:text-white shadow-lg shadow-zinc-100"
                )}
              >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                {isGenerating ? 'Synthesizing...' : 'Generate Diagram'}
              </button>
            </div>
          </div>

          <div className="p-4 bg-zinc-100 border-l-4 border-zinc-900 space-y-2">
            <div className="flex items-center gap-2 text-[9px] font-black text-zinc-900 uppercase">
              <Info size={12} /> Usage Note
            </div>
            <p className="text-[8px] font-bold text-zinc-500 uppercase leading-relaxed tracking-widest">
              This tool creates aesthetic summaries for initial steering discussions. Formal quotes must still be generated via CRM.
            </p>
          </div>
        </div>

        {/* Preview Side */}
        <div className="xl:col-span-8">
          <div className="sticky top-8">
            <div className="flex items-center gap-2 mb-4 no-print">
              <Layout size={14} className="text-zinc-400" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Document Preview</span>
            </div>

            {/* THE QUOTE TEMPLATE */}
            <div 
              ref={quoteRef}
              className="bg-white border-[1px] border-zinc-200 w-full aspect-[1/1.414] p-16 flex flex-col print:border-0 print:p-8"
              id="quote-document"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b-[6px] border-zinc-900 pb-12 mb-12">
                <div className="space-y-1">
                  <h1 className="text-5xl font-black tracking-tighter leading-[0.8] mb-4">SPEC.0{new Date().getDate()}</h1>
                  <div className="bg-pastel-blue text-zinc-900 px-2 py-1 inline-block">
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase">Solution Summary</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{customerName}</p>
                  <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Title Section */}
              <div className="mb-16">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.4em] mb-3">Project Reference</p>
                <h2 className="text-3xl font-black text-zinc-900 uppercase tracking-tighter leading-tight break-words">
                  {projectTitle}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-12 flex-1">
                {/* Left: Solution & Diagram */}
                <div className="space-y-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] border-b border-zinc-100 pb-2">01. Architecture View</h4>
                    <div className="aspect-video bg-zinc-50 border border-zinc-100 flex items-center justify-center relative overflow-hidden group">
                      {generatedDiagram ? (
                        <div 
                          className="w-full h-full flex items-center justify-center p-4 [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain" 
                          dangerouslySetInnerHTML={{ __html: generatedDiagram }} 
                        />
                      ) : (
                        <div className="text-center p-8 opacity-20">
                          <ImageIcon size={40} className="mx-auto mb-3" />
                          <p className="text-[8px] font-black uppercase tracking-[0.2em]">Schematic Space Empty</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] border-b border-zinc-100 pb-2">02. Design Narrative</h4>
                    <p className="text-[10px] font-medium leading-relaxed text-zinc-600 uppercase tracking-wide">
                      {solutionDescription || 'Awaiting design narrative input...'}
                    </p>
                  </div>
                </div>

                {/* Right: Commercials */}
                <div className="space-y-10">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] border-b border-zinc-100 pb-2">03. Commercial Framework</h4>
                    <div className="space-y-0">
                      {terms.map((term, i) => (
                        <div key={term.id} className="flex justify-between items-center py-4 border-b border-zinc-100 border-dotted group text-zinc-900">
                          <div>
                            <span className="text-[8px] font-bold text-zinc-400 mr-3">0{i+1}</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{term.label}</span>
                          </div>
                          <span className="text-xs font-black">{term.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-pastel-sand text-zinc-900 space-y-3">
                    <div className="flex items-center gap-3">
                      <Zap size={14} className="text-zinc-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Technical Status</p>
                    </div>
                    <p className="text-[8px] font-bold uppercase tracking-widest leading-loose opacity-60">
                      Standard SLA Grade 1 Applies. All fiber paths subject to detailed GIS desktop survey. Latency figures are target-based.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-auto border-t border-zinc-100 pt-8 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-zinc-900 tracking-[0.5em] uppercase">Strategic Asset Intelligence</p>
                  <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Confidential Solution Design • Internal Use Only</p>
                </div>
                <div className="flex items-center gap-4 grayscale opacity-40">
                  <div className="w-12 h-[2px] bg-zinc-900" />
                  <span className="text-[9px] font-black">ZAYO.EUR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #quote-document, #quote-document * {
            visibility: visible;
          }
          #quote-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            border: 0 !important;
            margin: 0 !important;
            padding: 2cm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
