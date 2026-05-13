import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UNITS, FORECAST_MONTHS } from '../constants';
import { Unit } from '../types';
import { Upload, Database, Target, Save, AlertCircle, FileSpreadsheet, CheckCircle2, Trash2, Calendar, ChevronLeft, ChevronRight, Users, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker (matching installed 3.11.174)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
import { db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { AnimatePresence } from 'motion/react';

export function AdminPanel() {
  const { 
    quotas, 
    isQuotasLoaded, 
    updateQuotas, 
    uploadCSV, 
    opportunities, 
    clearAllOpportunities, 
    selectedForecastMonth, 
    setSelectedForecastMonth, 
    knowledgeBaseContent, 
    updateKnowledgeBase, 
    isKnowledgeBaseLoaded,
    legalKnowledgeBaseContent,
    updateLegalKnowledgeBase,
    isLegalKnowledgeBaseLoaded
  } = useApp();
  const [dragActive, setDragActive] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [uploadTargetMonth, setUploadTargetMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Local state for quotas to allow smooth editing
  const [localQuotas, setLocalQuotas] = useState(quotas);
  const [isSaving, setIsSaving] = useState(false);
  const [viewTargetMonth, setViewTargetMonth] = useState(new Date().toISOString().slice(0, 7));

  // Local state for knowledge base editor
  const [localKB, setLocalKB] = useState(knowledgeBaseContent);
  const [isSavingKB, setIsSavingKB] = useState(false);
  const [kbSaveStatus, setKbSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [localLegalKB, setLocalLegalKB] = useState(legalKnowledgeBaseContent);
  const [isSavingLegalKB, setIsSavingLegalKB] = useState(false);
  const [legalKbSaveStatus, setLegalKbSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadConfirmation, setUploadConfirmation] = useState(false);
  const kbFileInputRef = React.useRef<HTMLInputElement>(null);
  const legalKbFileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync local knowledge base if global one changes
  React.useEffect(() => {
    if (isKnowledgeBaseLoaded) {
      setLocalKB(knowledgeBaseContent);
    }
  }, [knowledgeBaseContent, isKnowledgeBaseLoaded]);

  React.useEffect(() => {
    if (isLegalKnowledgeBaseLoaded) {
      setLocalLegalKB(legalKnowledgeBaseContent);
    }
  }, [legalKnowledgeBaseContent, isLegalKnowledgeBaseLoaded]);

  // Sync local quotas if global quotas change (e.g. on initial load)
  React.useEffect(() => {
    if (isQuotasLoaded) {
      setLocalQuotas(quotas);
    }
  }, [quotas, isQuotasLoaded]);

  if (!isQuotasLoaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
        <span className="ml-3 text-zinc-500 font-medium">Loading quotas...</span>
      </div>
    );
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadCSV(e.dataTransfer.files[0], uploadTargetMonth);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadCSV(e.target.files[0], uploadTargetMonth);
    }
  };

  const handleDelete = async () => {
    await clearAllOpportunities(uploadTargetMonth);
    setShowConfirmDelete(false);
  };

  const handleQuotaChange = (unit: Unit, field: 'monthly' | 'annual', value: string) => {
    setLocalQuotas(prev => ({
      ...prev,
      [unit]: {
        ...prev[unit],
        [field]: value === '' ? '' : parseFloat(value)
      }
    }));
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSaveQuotas = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    
    try {
      console.log('[Quotas Debug] Starting batch save for quotas...');
      const batch = writeBatch(db);
      for (const unit of UNITS) {
        const monthly = typeof localQuotas[unit].monthly === 'string' ? 0 : localQuotas[unit].monthly;
        const annual = typeof localQuotas[unit].annual === 'string' ? 0 : localQuotas[unit].annual;
        // Sanitize ID: Firestore doesn't allow slashes in document IDs within a collection
        const sanitizedId = unit.replace(/\//g, '_');
        const quotaRef = doc(db, 'quotas', sanitizedId);
        console.log(`[Quotas Debug] Setting quota for ${unit} (${sanitizedId}):`, { monthly, annual });
        batch.set(quotaRef, { monthly, annual });
      }
      
      await batch.commit();
      console.log('[Quotas Debug] Batch commit successful.');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving quotas:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKB = async () => {
    setIsSavingKB(true);
    setKbSaveStatus('idle');
    try {
      await updateKnowledgeBase(localKB);
      setKbSaveStatus('success');
      setTimeout(() => setKbSaveStatus('idle'), 3000);
    } catch (error) {
      setKbSaveStatus('error');
    } finally {
      setIsSavingKB(false);
    }
  };

  const handleSaveLegalKB = async () => {
    setIsSavingLegalKB(true);
    setLegalKbSaveStatus('idle');
    try {
      await updateLegalKnowledgeBase(localLegalKB);
      setLegalKbSaveStatus('success');
      setTimeout(() => setLegalKbSaveStatus('idle'), 3000);
    } catch (error) {
      setLegalKbSaveStatus('error');
    } finally {
      setIsSavingLegalKB(false);
    }
  };

  const handleKBFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isLegal = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const updateState = isLegal ? setLocalLegalKB : setLocalKB;
    const updateLoader = isLegal ? setIsSavingLegalKB : setIsSavingKB;

    if (file.type === "application/pdf") {
      updateLoader(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = "";
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          fullText += pageText + "\n";
        }
        
        updateState(fullText.trim());
        setUploadConfirmation(true);
        setTimeout(() => setUploadConfirmation(false), 3000);
      } catch (error) {
        console.error("PDF upload error:", error);
        alert("Failed to parse PDF. Please try a different document or copy the text manually.");
      } finally {
        updateLoader(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        updateState(content);
        setUploadConfirmation(true);
        setTimeout(() => setUploadConfirmation(false), 3000);
      };
      reader.readAsText(file);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Customer Account', 'Close Date', 'Opportunity Name', 'IGNORE THIS COLUMN', 'Total MRR & MRR (converted)', 'Next Step', 'Opportunity Owner', 'Forecast Category'];
    const row = ['Global Tech Ltd', '13/04/2026', 'Q2 Expansion', '', '50000', 'Meeting scheduled', 'Ed Wheeler', 'Commit'];
    const csvContent = [headers.join(','), row.join(',')].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'forecast_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-16">
      <header className="border-b-4 border-app-text pb-12">
        <p className="text-[10px] font-black text-app-muted uppercase tracking-[0.3em] mb-4">Command Center</p>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <h2 className="text-5xl md:text-7xl font-black text-app-text tracking-[-0.04em] leading-[0.85] font-aptos uppercase">
            Admin<br />
            <span className="text-app-muted opacity-20">Control</span>
          </h2>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 lg:gap-12">
            {/* Existing Month Toggle */}
            <div className="flex items-center">
              <div className="h-14 w-14 border border-app-text flex items-center justify-center bg-app-text text-white shrink-0">
                <Calendar size={20} />
              </div>
              <div className="flex items-center glass-3d rounded-r-full h-14 pr-2 pl-4">
                <button 
                  onClick={() => {
                    const idx = FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth);
                    if (idx > 0) setSelectedForecastMonth(FORECAST_MONTHS[idx - 1].value);
                  }}
                  disabled={FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth) === 0}
                  className="btn-3d w-10 h-10 rounded-full flex items-center justify-center bg-white hover:bg-pastel-sage disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                
                <div className="px-6 flex flex-col justify-center min-w-[140px] text-center">
                  <span className="text-[9px] font-black text-app-muted uppercase tracking-[0.2em] mb-0.5">Forecast</span>
                  <span className="text-xs font-black text-app-text uppercase tracking-widest leading-none">
                    {FORECAST_MONTHS.find(m => m.value === selectedForecastMonth)?.label}
                  </span>
                </div>

                <button 
                  onClick={() => {
                    const idx = FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth);
                    if (idx < FORECAST_MONTHS.length - 1) setSelectedForecastMonth(FORECAST_MONTHS[idx + 1].value);
                  }}
                  disabled={FORECAST_MONTHS.findIndex(m => m.value === selectedForecastMonth) === FORECAST_MONTHS.length - 1}
                  className="btn-3d w-10 h-10 rounded-full flex items-center justify-center bg-white hover:bg-pastel-sage disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <button 
              onClick={downloadTemplate}
              className="btn-3d px-8 py-4 bg-app-text rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:opacity-90 flex items-center gap-3 self-start"
            >
              <FileSpreadsheet size={16} />
              Download Template
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* CSV Upload */}
        <div className="space-y-12">
          <div className="bg-white border border-app-text">
            <div className="p-8 border-b border-app-text flex items-center justify-between bg-app-sidebar">
              <h3 className="text-xl font-black text-app-text uppercase tracking-tight flex items-center gap-3">
                <Database size={24} />
                Data Stream
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border border-app-text bg-white px-4 py-2">
                  <select 
                    value={uploadTargetMonth}
                    onChange={(e) => setUploadTargetMonth(e.target.value)}
                    className="bg-transparent text-[10px] font-black text-app-text focus:outline-none cursor-pointer uppercase tracking-widest"
                  >
                    {FORECAST_MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label} 2026</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "relative h-80 border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 mx-8 my-8 bg-app-bg",
                dragActive ? "border-app-text bg-pastel-sage/20" : "border-app-border hover:border-app-text"
              )}
            >
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 bg-white border border-app-text flex items-center justify-center mb-6">
                <Upload className={cn(dragActive ? "text-app-text" : "text-app-muted")} size={32} />
              </div>
              <p className="text-[10px] font-black text-app-text uppercase tracking-[0.2em]">Drop CRM Manifest</p>
              <p className="text-[9px] font-bold text-app-muted uppercase tracking-widest mt-2">Maximum file size: 100MB</p>
            </div>

            {opportunities.filter(o => o.forecastMonth === uploadTargetMonth).length > 0 && (
              <div className="p-8 bg-pastel-sage border-t border-app-text flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-app-text flex items-center justify-center">
                    <CheckCircle2 className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-app-text uppercase tracking-tight">
                      {opportunities.filter(o => o.forecastMonth === uploadTargetMonth).length} Entries Loaded
                    </p>
                    <p className="text-[9px] font-bold text-app-muted uppercase tracking-widest mt-1">Live for {FORECAST_MONTHS.find(m => m.value === uploadTargetMonth)?.label} cycle</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-6 py-3 border border-app-text text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] bg-white hover:bg-rose-50 transition-all"
                >
                  Clear Manifest
                </button>
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {showConfirmDelete && (
              <div className="fixed inset-0 bg-app-text/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 font-aptos">
                <div className="bg-white border-2 border-app-text w-full max-w-sm p-8 space-y-8">
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-app-text uppercase tracking-tight">Destructive Action</h4>
                    <p className="text-xs font-bold text-app-muted uppercase tracking-widest">Are you sure you want to clear all data for {FORECAST_MONTHS.find(m => m.value === uploadTargetMonth)?.label} 2026?</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowConfirmDelete(false)}
                      className="flex-1 px-4 py-3 border border-app-text text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDelete}
                      className="flex-1 px-4 py-3 bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>

          <div className="bg-app-text p-10 text-white space-y-8">
            <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-tight">
              <AlertCircle size={24} />
              Ingestion Logic
            </h3>
            <div className="space-y-8 text-white/60">
              <p className="text-xs leading-relaxed font-medium uppercase tracking-wide">
                The mapping engine automatically parses raw export columns to assign sales teams based on Opportunity Owner.
              </p>
              
              <div className="space-y-8 border-t border-white/10 pt-8">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-white uppercase tracking-[.3em]">Required Header Set</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[9px]">
                    {['Customer Account', 'Close Date', 'Opportunity Name', 'Total MRR & MRR (converted)', 'Next Step', 'Opportunity Owner', 'Forecast Category'].map((header) => (
                      <div key={header} className="px-4 py-3 bg-white/5 border border-white/10 text-white uppercase tracking-widest">
                        {header}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-white uppercase tracking-[.3em]">Validation Status</p>
                  <ul className="space-y-4 text-[10px] font-bold uppercase tracking-widest">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white" /> Zero-prep CRM parsing active</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white" /> Temporal mapping: DD/MM/YYYY</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-white" /> Immutable won-deal protection</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quota Management */}
        <div className="bg-white border border-app-text p-12">
          <h3 className="text-2xl font-black text-app-text uppercase tracking-tight mb-12 flex items-center gap-4">
            <Target size={32} />
            Quota Framework
          </h3>
          <div className="space-y-12">
            {UNITS.map((unit) => (
              <div key={unit} className="space-y-6">
                <div className="flex items-center justify-between border-b border-app-text pb-2">
                  <h4 className="text-sm font-black text-app-text uppercase tracking-widest">{unit}</h4>
                  <span className="text-[9px] font-bold text-app-muted uppercase tracking-widest">FY2026 Target: {formatCurrency(Number(localQuotas[unit].annual) || 0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-app-muted uppercase tracking-[0.2em]">Monthly Goal (£)</label>
                    <input 
                      type="number"
                      value={localQuotas[unit].monthly}
                      onChange={(e) => handleQuotaChange(unit, 'monthly', e.target.value)}
                      className="w-full px-6 py-4 bg-app-bg border border-app-text focus:outline-none focus:bg-white transition-all text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-app-muted uppercase tracking-[0.2em]">Annual Yield (£)</label>
                    <input 
                      type="number"
                      value={localQuotas[unit].annual}
                      onChange={(e) => handleQuotaChange(unit, 'annual', e.target.value)}
                      className="w-full px-6 py-4 bg-app-bg border border-app-text focus:outline-none focus:bg-white transition-all text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-8">
              <button 
                onClick={handleSaveQuotas}
                disabled={isSaving}
                className={cn(
                  "btn-3d w-full py-6 rounded-full text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4",
                  saveStatus === 'success' ? "bg-pastel-sage text-app-text border border-app-text" : 
                  saveStatus === 'error' ? "bg-rose-600 text-white" :
                  "bg-app-text text-white hover:opacity-90"
                )}
              >
                {isSaving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-none animate-spin" />
                    SYNCING TO CLOUD
                  </>
                ) : saveStatus === 'success' ? (
                  <>
                    <CheckCircle2 size={18} />
                    PARAMETERS SAVED
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    INITIALIZE SYNC
                  </>
                )}
              </button>
              {saveStatus === 'success' && (
                <p className="text-center text-[9px] font-black text-app-text mt-4 uppercase tracking-[0.2em] animate-pulse">
                  Global parameters locked.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Call Opportunity Details View */}
      <div className="space-y-12">
        <div className="bg-white border border-app-text">
          <div className="p-6 border-b border-app-text bg-app-sidebar flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-app-text flex items-center justify-center">
                <Sparkles className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-app-text uppercase tracking-tight">Documentation</h3>
                <p className="text-[9px] font-bold text-app-muted uppercase tracking-widest leading-none mt-1">AI Program Source</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={kbFileInputRef}
                onChange={handleKBFileUpload}
                accept=".txt,.md,.pdf"
                className="hidden" 
              />
              <button 
                onClick={() => kbFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-app-text text-[9px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors"
              >
                <Upload size={14} />
                Upload Doc
              </button>
              {uploadConfirmation && (
                <div className="flex items-center gap-2 text-[9px] font-black text-pastel-sage bg-pastel-sage/10 px-3 py-2 border border-pastel-sage animate-in fade-in slide-in-from-right-4">
                  <CheckCircle2 size={12} />
                  READ SUCCESS
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Brilliant Basics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-app-muted uppercase tracking-widest">Brilliant Basics Context</label>
                  <button 
                    onClick={() => kbFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1 bg-pastel-sage border border-app-text text-[8px] font-black uppercase tracking-widest hover:opacity-80 transition-all"
                  >
                    <Upload size={10} />
                    Upload
                  </button>
                  <input type="file" ref={kbFileInputRef} onChange={(e) => handleKBFileUpload(e, false)} accept=".txt,.md,.pdf" className="hidden" />
                </div>
                <textarea 
                  value={localKB}
                  onChange={(e) => setLocalKB(e.target.value)}
                  className="w-full h-48 p-4 bg-app-bg border border-app-text focus:outline-none focus:bg-white transition-all text-[10px] font-mono leading-relaxed"
                />
                <button 
                  onClick={handleSaveKB}
                  disabled={isSavingKB}
                  className={cn(
                    "btn-3d w-full py-3 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2",
                    kbSaveStatus === 'success' ? "bg-pastel-sage text-app-text" : "bg-app-text text-white"
                  )}
                >
                  {isSavingKB ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {kbSaveStatus === 'success' ? 'CONTEXT SAVED' : 'SAVE BASICS'}
                </button>
              </div>

              {/* Commercial Counsel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-app-muted uppercase tracking-widest">Commercial Counsel (MSA Standards)</label>
                  <button 
                    onClick={() => legalKbFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1 bg-pastel-blue border border-app-text text-[8px] font-black uppercase tracking-widest hover:opacity-80 transition-all"
                  >
                    <Upload size={10} />
                    Upload
                  </button>
                  <input type="file" ref={legalKbFileInputRef} onChange={(e) => handleKBFileUpload(e, true)} accept=".txt,.md,.pdf" className="hidden" />
                </div>
                <textarea 
                  value={localLegalKB}
                  onChange={(e) => setLocalLegalKB(e.target.value)}
                  className="w-full h-48 p-4 bg-app-bg border border-app-text focus:outline-none focus:bg-white transition-all text-[10px] font-mono leading-relaxed"
                />
                <button 
                  onClick={handleSaveLegalKB}
                  disabled={isSavingLegalKB}
                  className={cn(
                    "btn-3d w-full py-3 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2",
                    legalKbSaveStatus === 'success' ? "bg-pastel-sage text-app-text" : "bg-app-text text-white"
                  )}
                >
                  {isSavingLegalKB ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {legalKbSaveStatus === 'success' ? 'LEGAL SAVED' : 'SAVE LAW'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border border-app-border">
              <p className="text-[9px] font-black text-app-muted uppercase tracking-[0.2em] leading-relaxed">
                Source updates instantly retrain respective agents. Max file size: 10MB. Text is preferred for legal precision.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-app-text bg-white">
        <div className="p-10 border-b border-app-text bg-app-sidebar flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-app-text flex items-center justify-center">
              <Users className="text-white" size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-app-text uppercase tracking-tight">Full Pipeline Granularity</h3>
              <p className="text-[10px] font-bold text-app-muted uppercase tracking-widest mt-1">Audit trail for group call composition</p>
            </div>
          </div>

          <div className="flex items-center border border-app-text bg-white">
            <button 
              onClick={() => {
                const idx = FORECAST_MONTHS.findIndex(m => m.value === viewTargetMonth);
                if (idx > 0) setViewTargetMonth(FORECAST_MONTHS[idx - 1].value);
              }}
              disabled={FORECAST_MONTHS.findIndex(m => m.value === viewTargetMonth) === 0}
              className="p-3 hover:bg-pastel-sage disabled:opacity-30 border-r border-app-text transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="px-12 min-w-[200px] text-center">
              <span className="text-lg font-black text-app-text uppercase tracking-widest">
                {FORECAST_MONTHS.find(m => m.value === viewTargetMonth)?.label} 2026
              </span>
            </div>

            <button 
              onClick={() => {
                const idx = FORECAST_MONTHS.findIndex(m => m.value === viewTargetMonth);
                if (idx < FORECAST_MONTHS.length - 1) setViewTargetMonth(FORECAST_MONTHS[idx + 1].value);
              }}
              disabled={FORECAST_MONTHS.findIndex(m => m.value === viewTargetMonth) === FORECAST_MONTHS.length - 1}
              className="p-3 hover:bg-pastel-sage disabled:opacity-30 border-l border-app-text transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg border-b border-app-text">
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest">Division</th>
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest">Account</th>
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest">Principal</th>
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest text-right">Yield (£)</th>
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest">Stage</th>
                <th className="px-10 py-5 text-[10px] font-black text-app-text uppercase tracking-widest">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {opportunities.filter(o => o.forecastMonth === viewTargetMonth && (o.isIncludedInCall || o.stage === 'Closed Won' || o.stage?.toLowerCase().includes('commit'))).length > 0 ? (
                opportunities
                  .filter(o => o.forecastMonth === viewTargetMonth && (o.isIncludedInCall || o.stage === 'Closed Won' || o.stage?.toLowerCase().includes('commit')))
                  .sort((a, b) => a.unit.localeCompare(b.unit))
                  .map((opp) => (
                    <tr key={opp.id} className="hover:bg-app-bg transition-colors">
                      <td className="px-10 py-5">
                        <span className={cn(
                          "px-3 py-1 text-[9px] font-black uppercase tracking-wider",
                          opp.unit === 'China/Apac' ? "bg-pastel-sand text-app-text" :
                          opp.unit === 'Hyperscale' ? "bg-pastel-blue text-app-text" :
                          opp.unit === 'Strategic Wholesale' ? "bg-pastel-sage text-app-text" :
                          "bg-app-text text-white"
                        )}>
                          {opp.unit}
                        </span>
                      </td>
                      <td className="px-10 py-5 text-sm font-black text-app-text uppercase tracking-tight">{opp.customer}</td>
                      <td className="px-10 py-5 text-[10px] font-bold text-app-muted uppercase tracking-widest">{opp.owner}</td>
                      <td className="px-10 py-5 text-right font-mono font-bold text-app-text">{formatCurrency(opp.mrc)}</td>
                      <td className="px-10 py-5">
                        <span className="text-[9px] font-black text-app-text uppercase tracking-widest border border-app-text px-3 py-1">
                          {opp.stage}
                        </span>
                      </td>
                      <td className="px-10 py-5 text-[10px] font-mono text-app-muted uppercase">{opp.oppIdentifier}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center text-app-muted text-[10px] font-black uppercase tracking-[0.3em]">
                    No commit entries identified for this cycle.
                  </td>
                </tr>
              )}
            </tbody>
            {opportunities.filter(o => o.forecastMonth === viewTargetMonth && (o.isIncludedInCall || o.stage === 'Closed Won' || o.stage?.toLowerCase().includes('commit'))).length > 0 && (
              <tfoot className="bg-app-text text-white">
                <tr>
                  <td colSpan={3} className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.4em]">Integrated Group Call Yield</td>
                  <td className="px-10 py-8 text-right font-black text-white text-3xl tracking-tighter">
                    {formatCurrency(
                      opportunities
                        .filter(o => o.forecastMonth === viewTargetMonth && (o.isIncludedInCall || o.stage === 'Closed Won' || o.stage?.toLowerCase().includes('commit')))
                        .reduce((sum, o) => sum + o.mrc, 0)
                    )}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  </div>
);
}
