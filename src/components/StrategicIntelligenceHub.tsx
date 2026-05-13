import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Sparkles, Loader2, BookOpen, ShieldCheck, FileText, Upload, Trash2, Scale, Mail, Globe, Search, ArrowRight, Zap, CheckCircle2, Copy, FileDown, Square, ChevronDown, ChevronRight, X, RefreshCw, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatWithBrilliantBasics, chatWithCommercialCounsel, researchMarketIntelligence, auditResearchKnowledge, processIngestedEmail, processIngestedLink, processIngestedFile, processIngestedCSV, runAutonomousEvolution, processIngestedText } from '../services/geminiService';
import { getKnowledgeNodes, ingestKnowledgeNode, type KnowledgeNode, globalNeuralResync, exportLegacyManifest, clearLegacyData, updateKnowledgeNode, deleteKnowledgeNode, batchNormaliseKnowledge } from '../services/researchService';
import { cn } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, orderBy } from 'firebase/firestore';
import * as pdfjs from 'pdfjs-dist';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import ReactMarkdown from 'react-markdown';
import { KnowledgeGraph } from './KnowledgeGraph';
import { IntelligenceFeed } from './IntelligenceFeed';
import Papa from 'papaparse';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface UploadedDoc {
  name: string;
  content: string;
}

type HubMode = 'auditor' | 'retention' | 'predictor' | null;

interface MaintenanceAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

export function StrategicIntelligenceHub({ initialMode = null }: { initialMode?: HubMode }) {
  const { knowledgeBaseContent, legalKnowledgeBaseContent, portalUser: realPortalUser } = useApp();
  const portalUser = realPortalUser || { uid: 'debug', firstName: 'Rob', lastName: 'Reid', email: 'rob.reid@zayo.internal', role: 'admin' };
  const [mode, setMode] = useState<HubMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    auditor: [],
    retention: [],
    predictor: []
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionDocs, setSessionDocs] = useState<UploadedDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [isEditingNode, setIsEditingNode] = useState(false);
  const [editedNodeContent, setEditedNodeContent] = useState({ title: '', summary: '', body: '' });
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [searchKnowledgeBase, setSearchKnowledgeBase] = useState(true);
  const [deepResearchMax, setDeepResearchMax] = useState(false);
  const [agentOutputStyle, setAgentOutputStyle] = useState<'Summary' | 'Normal' | 'Full Report' | 'Exhaustive'>('Normal');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const consolidateCategory = (rawCategory: string) => {
    const lower = rawCategory.toLowerCase();
    
    // Consolidate Fibre & Optical
    if (lower.includes('fibre') || lower.includes('fiber') || lower.includes('fttx') || lower.includes('dark') || lower.includes('wavelength') || lower.includes('dwdm')) {
      return 'Fibre & Wavelengths';
    }
    // Consolidate Data Centers
    if (lower.includes('data cent') || lower.includes('colocation') || lower.includes('dc ') || lower.includes('facility')) {
      return 'Data Centers & Colocation';
    }
    // Consolidate Subsea
    if (lower.includes('subsea') || lower.includes('cable') || lower.includes('marine') || lower.includes('landing')) {
      return 'Subsea Cables';
    }
    // Consolidate Cloud & Compute
    if (lower.includes('cloud') || lower.includes('compute') || lower.includes('iaas') || lower.includes('paas') || lower.includes('saas') || lower.includes('neocloud')) {
      return 'Cloud & Compute';
    }
    // Consolidate Agent / Neural
    if (lower.includes('agent') || lower.includes('response') || lower.includes('bot') || lower.includes('neural')) {
      return 'Agent Responses';
    }
    // Consolidate Legal / Contracts
    if (lower.includes('contract') || lower.includes('legal') || lower.includes('clause') || lower.includes('retention') || lower.includes('hygiene') || lower.includes('audit')) {
      return 'Contracts, Compliance & Legal';
    }
    // Consolidate Market & Competitor
    if (lower.includes('market') || lower.includes('competitor') || lower.includes('landscape') || lower.includes('strategic')) {
      return 'Market Intelligence';
    }
    // Consolidate Network Operators
    if (lower.includes('network operator') || lower.includes('isp') || lower.includes('telecom') || lower.includes('carrier')) {
      return 'Network Operators';
    }
    
    // Capitalize first letter of each word as fallback
    return rawCategory.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const libraryCategories = useMemo(() => {
    const categories: Record<string, { type: string, id: string, title: string, subtitle?: string, item: any }[]> = {};

    knowledgeNodes.forEach(n => {
      const cat = consolidateCategory(n.category || 'Uncategorized');
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ type: n.type, id: n.id, title: n.title, subtitle: n.summary, item: n });
    });

    return Object.entries(categories).sort((a,b) => a[0].localeCompare(b[0]));
  }, [knowledgeNodes]);
  const [memoryInput, setMemoryInput] = useState('');
  const [isIngestingLink, setIsIngestingLink] = useState(false);
  const [isIngestingText, setIsIngestingText] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionStage, setIngestionStage] = useState<'idle' | 'linking' | 'analyzing' | 'persisting'>('idle');
  const [ingestionTab, setIngestionTab] = useState<'link' | 'text' | 'file'>('link');
  const [lastIngestionResult, setLastIngestionResult] = useState<{
    summary: string;
    insights: any[]; // shape: { topic?, title?, category?, summary?, body? }
    isCSV?: boolean;
  } | null>(null);
  const [expandedInsightIdx, setExpandedInsightIdx] = useState<number | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionLog, setEvolutionLog] = useState<string[]>([]);
  const [researchDirectives, setResearchDirectives] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [isAuditing, setIsAuditing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [ingestionInput, setIngestionInput] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeAlerts, setActiveAlerts] = useState<MaintenanceAlert[]>([]);

  // Maintenance Alerts Listener
  useEffect(() => {
    const q = query(collection(db, "maintenance_alerts"), where("resolved", "==", false), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MaintenanceAlert[];
      setActiveAlerts(alerts);
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Alerts listener error:", error);
    });
    return () => unsubscribe();
  }, []);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, mode]);

  useEffect(() => {
    // Always pre-fetch nodes so the Memories counter is accurate across all modes
    fetchInsights();
  }, []);

  useEffect(() => {
    if (mode === 'predictor') {
      fetchInsights();
    }
  }, [mode]);


  // Background Email Ingestion Listener
  useEffect(() => {
    if (!portalUser) return;

    const q = query(collection(db, "pending_emails"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot?.docs || [];
      if (docs.length > 0 && !isIngesting) {
        setIsIngesting(true);
        const emailDoc = docs[0];
        const emailData = emailDoc.data() as { subject: string, body: string, from: string, date: string };
        
        try {
          toast.info(`Ingesting intelligence from email: ${emailData.subject}`);
          const { count } = await processIngestedEmail(emailData);
          await deleteDoc(doc(db, "pending_emails", emailDoc.id));
          if (count > 0) {
            toast.success(`Successfully extracted ${count} strategic insights.`);
            fetchInsights();
          }
        } catch (error) {
          console.error("Background ingestion error:", error);
        } finally {
          setIsIngesting(false);
        }
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("Listener error:", error);
      }
    });

    return () => unsubscribe();
  }, [isIngesting, portalUser]);

  const fetchInsights = async () => {
    console.log('[Hub] Fetching knowledge nodes...');
    const nodes = await getKnowledgeNodes();
    console.log(`[Hub] Received ${nodes.length} knowledge nodes.`);
    setKnowledgeNodes(nodes);
  };

  const handleUpdateSynthesis = async (sourceId: string, targetId: string, newRationale: string) => {
    try {
      const sourceNode = knowledgeNodes.find(n => n.id === sourceId);
      if (!sourceNode) return;
      const newSynthesisMap = { ...sourceNode.synthesisMap, [targetId]: newRationale };
      await updateKnowledgeNode(sourceId, { synthesisMap: newSynthesisMap });
      toast.success('Synthesis rationale updated.');
      fetchInsights();
    } catch (error) {
      toast.error('Failed to update synthesis.');
    }
  };

  const handleDeleteSynthesis = async (sourceId: string, targetId: string) => {
    try {
      const sourceNode = knowledgeNodes.find(n => n.id === sourceId);
      if (!sourceNode) return;
      const newSynthesisMap = { ...sourceNode.synthesisMap };
      delete newSynthesisMap[targetId];
      await updateKnowledgeNode(sourceId, { synthesisMap: newSynthesisMap });
      toast.success('Synthesis deleted.');
      fetchInsights();
    } catch (error) {
      toast.error('Failed to delete synthesis.');
    }
  };

  const handleUpdateNode = async () => {
    if (!selectedNode) return;
    try {
      await updateKnowledgeNode(selectedNode.id, {
        title: editedNodeContent.title,
        summary: editedNodeContent.summary,
        body: editedNodeContent.body
      });
      toast.success('Knowledge node updated.');
      setIsEditingNode(false);
      setSelectedNode(prev => prev ? { ...prev, ...editedNodeContent } : null);
      fetchInsights();
    } catch (error) {
      toast.error('Failed to update node.');
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (!confirm('Are you sure you want to delete this node? This cannot be undone.')) return;
    try {
      await deleteKnowledgeNode(selectedNode.id);
      toast.success('Knowledge node deleted.');
      setSelectedNode(null);
      fetchInsights();
    } catch (error) {
      toast.error('Failed to delete node.');
    }
  };

  const handleEvolution = async () => {
    if (isEvolving) return;
    
    abortControllerRef.current = new AbortController();
    setIsEvolving(true);
    setEvolutionLog(prev => ["Neural Engine Initializing...", "Inbound Data Streams Calibrated...", ...prev.slice(0, 4)]);

    try {
      toast.info("Autonomous research cycle engaged.");
      setEvolutionLog(prev => ["Neural Processing Unit (NPU) Spin-up...", ...prev]);
      
      const currentHistory = (messages.predictor || []).map(m => ({
        role: m.role,
        text: m.text
      }));
      
      // Simulate intermediate steps for better UX
      const statusInterval = setInterval(() => {
        const statuses = [
          "Executing Cross-Border Network Crawl...",
          "Analyzing Fiber Backbone Topologies...",
          "Extracting DWDM Technical Specifications...",
          "Auditing Regional PoP Densities...",
          "Mapping Subsea Landing Points...",
          "Comparing Competitor Latency Profiles..."
        ];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        setEvolutionLog(prev => [status, ...prev]);
      }, 5000);

      // Perform initial check
      if (abortControllerRef.current?.signal.aborted) {
        clearInterval(statusInterval);
        return;
      }

      const result = await runAutonomousEvolution(currentHistory, researchDirectives);
      clearInterval(statusInterval);
      
      if (abortControllerRef.current?.signal.aborted) {
        toast.warning("Research cycle terminated manually.");
        setIsEvolving(false);
        return;
      }

      setEvolutionLog(prev => [
        `NEURAL EXTRACTION COMPLETE.`,
        `TARGETING: ${result.reasoning.substring(0, 150)}...`,
        `SNAPSHOT: Created ${result.operatorsFound} Operator Profiles & ${result.insightsFound} Technical Reports.`,
        ...prev
      ]);
      toast.success(`Evolved knowledge with ${result.operatorsFound + result.insightsFound} new findings.`);
      fetchInsights();
    } catch (error: any) {
      if (abortControllerRef.current?.signal.aborted) return;
      console.error("Evolution Error:", error);
      
      const isQuota = error?.message?.includes("quota") || error?.message?.includes("429");
      if (isQuota) {
        toast.error("Neural Quota Exhausted. System cooling down. Please retry in 60 seconds.");
        setEvolutionLog(prev => ["ERROR: RESOURCE_EXHAUSTED. Please wait for quota reset.", ...prev.slice(0, 4)]);
      } else {
        toast.error("Evolution engine stalled. Retrying later.");
      }
    } finally {
      setIsEvolving(false);
      abortControllerRef.current = null;
    }
  };

  const stopEvolution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsEvolving(false);
      setEvolutionLog(prev => ["COMMAND: KILL_RESEARCH_PROCESS executed.", "Session halted.", ...prev.slice(0, 4)]);
    }
  };

  const handleAudit = async () => {
    if (isLoading || isAuditing) return;
    setIsAuditing(true);
    setIsLoading(true);

    try {
      const response = await auditResearchKnowledge();
      setMessages(prev => ({
        ...prev,
        predictor: [...prev.predictor, { 
          role: 'assistant', 
          text: `### 🛡️ KNOWLEDGE AUDIT COMPLETE\n\n${response}` 
        }]
      }));
      fetchInsights();
    } catch (error) {
      console.error("Audit Error:", error);
    } finally {
      setIsAuditing(false);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, forDirectIngestion: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let content = "";
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          content += textContent.items.map((item: any) => item.str).join(" ") + "\n";
        }
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else if (file.name.endsWith('.csv')) {
        content = await file.text(); // Keep raw CSV for the dedicated CSV pipeline
      } else {
        content = await file.text();
      }

      toast.success(`${file.name} successfully loaded into buffer.`);

      if (forDirectIngestion) {
        const isCSV = file.name.endsWith('.csv');
        
        if (isCSV) {
          toast.info(`CSV Structured Ingestion starting for: ${file.name}`);
          const result = await processIngestedCSV(file.name, content);
          if (result.count > 0) {
            toast.success(`CSV ingested: ${result.count} structured nodes created (grouped by ${result.groupingKey}).`);
            setLastIngestionResult({ summary: result.summary, insights: result.nodes || [] });
            fetchInsights();
          } else {
            toast.success("CSV processed. No structured nodes generated.");
          }
        } else {
          toast.info(`Neural processing starting for: ${file.name}`);
          const result = await processIngestedFile(file.name, content);
          if (result.count > 0) {
            toast.success(`Successfully extracted ${result.count} strategic insights to memory.`);
            setLastIngestionResult({ summary: result.summary, insights: result.insights });
            fetchInsights();
          } else {
            toast.success("File processed. No new significant insights extracted.");
          }
        }
      } else {
        setSessionDocs(prev => [...prev, { name: file.name, content }]);
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast.error(`Failed to process file: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleLinkIngestion = async () => {
    if (!memoryInput.trim() || isIngestingLink) return;

    setIsIngestingLink(true);
    try {
      toast.info(`Crawling neural pathways for: ${memoryInput}`);
      const result = await processIngestedLink(memoryInput);
      if (result.count > 0) {
        toast.success(`Successfully extracted ${result.count} strategic insights to memory.`);
        setLastIngestionResult({ summary: result.summary, insights: result.insights });
        fetchInsights();
        setMemoryInput("");
      } else {
        toast.success("Intelligence scanned. No new significant insights extracted.");
      }
    } catch (error) {
      console.error("Link ingestion error:", error);
      toast.error("Neural link ingestion failed.");
    } finally {
      setIsIngestingLink(false);
    }
  };

  const handleTextIngestion = async (text: string) => {
    if (!text.trim() || isIngestingText) return;
    setIsIngestingText(true);
    try {
      toast.info("Synthesizing text into strategic memory...");
      const result = await processIngestedText(text);
      if (result.count > 0) {
        toast.success(`Neural synthesis complete. ${result.count} insights extracted.`);
        setLastIngestionResult({ summary: result.summary, insights: result.insights });
        fetchInsights();
        setMemoryInput("");
      }
    } catch (error) {
      console.error("Text ingestion error:", error);
      toast.error("Neural text synthesis failed.");
    } finally {
      setIsIngestingText(false);
    }
  };

  const removeDoc = (index: number) => {
    setSessionDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleGlobalResync = async () => {
    setIsResyncing(true);
    try {
      toast.info("Initializing Global Neural Re-indexing...");
      const result = await globalNeuralResync();
      toast.success(`Neural re-sync complete. Audited ${result.nodeCount} files and generated ${result.rationaleCount} strategic rationales.`);
      fetchInsights();
    } catch (error) {
      toast.error("Global Neural Re-sync failed.");
    } finally {
      setIsResyncing(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("⚠️ BROGGO 2.0 MIGRATION\n\nThis will:\n1. Export a manifest of all legacy data to your clipboard\n2. Delete ALL old research_insights and network_operators\n\nThe new knowledge_nodes collection is untouched.\n\nProceed?")) return;
    
    try {
      toast.info("Exporting legacy manifest...");
      const manifest = await exportLegacyManifest();
      
      if (manifest.length > 0) {
        const manifestText = `BROGGO 1.2 LEGACY MANIFEST\nExported: ${new Date().toISOString()}\n${'='.repeat(50)}\n\n${manifest.join('\n')}`;
        navigator.clipboard.writeText(manifestText);
        toast.success(`Manifest exported to clipboard (${manifest.length} items). Clearing legacy data...`);
        console.log('[Migration] Legacy manifest:', manifestText);
      } else {
        toast.info("No legacy data found. Collections may already be cleared.");
      }
      
      const result = await clearLegacyData();
      toast.success(`Migration complete. Cleared ${result.insightsCleared} insights + ${result.operatorsCleared} operators. Broggo 2.0 is clean.`);
      fetchInsights();
    } catch (error) {
      toast.error("Migration failed. Check console.");
      console.error('[Migration] Error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !mode) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => ({
      ...prev,
      [mode]: [...prev[mode], { role: 'user', text: userMessage }]
    }));
    setIsLoading(true);

    try {
      const currentHistory = (messages[mode] || []).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text
      }));

      // Check if user is asking to trigger research / evolution
      const lowerInput = userMessage.toLowerCase();
      if (mode === 'predictor' && (lowerInput.includes('trigger') || lowerInput.includes('launch') || lowerInput.includes('test') || lowerInput.includes('start research') || lowerInput.includes('engage agent'))) {
         handleEvolution();
         setMessages(prev => ({
           ...prev,
           [mode]: [...prev[mode], { role: 'assistant', text: 'RESEARCH COMMAND DETECTED: Initializing neural research cycle based on your request.' }]
         }));
         setIsLoading(false);
         return;
      }

      let response = "";
      if (mode === 'auditor') {
        response = await chatWithBrilliantBasics(userMessage, currentHistory, knowledgeBaseContent || "");
      } else if (mode === 'retention') {
        const baseLegalContext = `--- RETENTION GUIDELINES ---\n${legalKnowledgeBaseContent}`;
        response = await chatWithCommercialCounsel(userMessage, currentHistory, baseLegalContext, sessionDocs);
      } else if (mode === 'predictor') {
        const combinedResearcherContext = sessionDocs.length > 0 
          ? `--- SESSION DOCUMENTS ---\n${sessionDocs.map(doc => `--- DOCUMENT: ${doc.name} ---\n${doc.content}`).join('\n\n')}\n\n`
          : "";
        response = await researchMarketIntelligence(
          combinedResearcherContext + userMessage, 
          currentHistory,
          { useWebSearch, searchKnowledgeBase, deepResearchMax, outputStyle: agentOutputStyle }
        );
        
        await ingestKnowledgeNode({
          title: `Query: ${userMessage.substring(0, 50)}...`,
          type: 'commercial',
          category: 'Go-to-Market Strategy',
          tags: ['agent-response'],
          summary: `Broggo response to user query`,
          body: `**User Query:**\n${userMessage}\n\n**Agent Response:**\n${response}`,
          source: 'agent',
          sourceType: 'text',
        });
        toast.success("Agent output saved to neural memory.");
        
        fetchInsights();
      }

      setMessages(prev => ({
        ...prev,
        [mode]: [...prev[mode], { role: 'assistant', text: response || 'I could not generate a response.' }]
      }));
    } catch (error) {
      console.error("Hub Error:", error);
      setMessages(prev => ({
        ...prev,
        [mode]: [...prev[mode], { role: 'assistant', text: 'Intelligence engine offline.' }]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const renderTag = (text: string) => {
    const parts = text.split(/(\[LEGAL RISK\]|\[STRATEGIC NEGOTIATION\])/g);
    return parts.map((part, i) => {
      if (part === '[LEGAL RISK]') {
        return <span key={i} className="inline-block px-1.5 py-0.5 bg-rose-600 text-white font-black text-[7px] tracking-widest mr-1 rounded-sm mb-1">LEGAL RISK</span>;
      }
      if (part === '[STRATEGIC NEGOTIATION]') {
        return <span key={i} className="inline-block px-1.5 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] font-black text-[7px] tracking-widest mr-1 rounded-sm mb-1 border border-[#8B5CF6]/20">STRATEGIC NEGOTIATION</span>;
      }
      return part;
    });
  };

  const getAgentTheme = () => {
    switch (mode) {
      case 'auditor': return { color: '#D67B1B', icon: <ShieldCheck size={24} />, label: 'Brilliant Basics Advisor' };
      case 'retention': return { color: '#A3B18A', icon: <Scale size={24} />, label: 'Retention Case Vault' };
      case 'predictor': return { color: '#F29023', icon: <Globe size={24} />, label: 'Broggo Neural Feed' };
      default: return { color: '#1A1A1A', icon: <Sparkles size={24} />, label: 'Neural Intelligence Hub' };
    }
  };

  const theme = getAgentTheme();


  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-4 lg:p-8 font-sans bg-app-bg relative" data-theme="paper">
      <div className="paper-texture" />
      
      {/* Maintenance Alert Banner */}
      <AnimatePresence>
        {activeAlerts.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full mb-6 relative z-50"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl flex items-center justify-between border shadow-lg",
              activeAlerts.some(a => a.severity === 'critical') 
                ? "bg-rose-50 border-rose-200 text-rose-900" 
                : "bg-amber-50 border-amber-200 text-amber-900"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-2 rounded-xl",
                  activeAlerts.some(a => a.severity === 'critical') ? "bg-rose-200" : "bg-amber-200"
                )}>
                  <Zap size={20} className={activeAlerts.some(a => a.severity === 'critical') ? "animate-pulse" : ""} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest">Maintenance System: {activeAlerts.some(a => a.severity === 'critical') ? 'CRITICAL FAILURE' : 'SYSTEM WARNING'}</h4>
                  <p className="text-[10px] font-bold opacity-80 mt-0.5">{activeAlerts[0].message} {activeAlerts.length > 1 && `(+${activeAlerts.length - 1} more)`}</p>
                </div>
              </div>
              <button 
                onClick={async () => {
                  for (const alert of activeAlerts) {
                    await updateKnowledgeNode(alert.id, { resolved: true }, "maintenance_alerts" as any); // hacky way to use existing service if it supports it, or just use firebase doc directly
                    // Better: direct firebase call
                    const { doc, updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, "maintenance_alerts", alert.id), { resolved: true });
                  }
                }}
                className="px-4 py-2 bg-white/50 hover:bg-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Acknowledge All
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full py-8 lg:py-12 px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-5">
              <div 
                className="w-16 h-16 rounded-[24px] flex items-center justify-center shadow-lg text-white ring-1 ring-white/20"
                style={{ backgroundColor: theme.color }}
              >
                {theme.icon}
              </div>
              <div>
                <h2 className="text-3xl font-serif font-black text-[#1A1A1A] uppercase tracking-tighter leading-none italic">{theme.label}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-archival-sage animate-pulse" />
                  <p className="text-[10px] font-friendly font-bold text-app-muted uppercase tracking-[0.2em]">Neural Connection Stabilized</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="px-5 py-3 bg-white border border-paper-border rounded-full shadow-[1px_1px_2px_rgba(0,0,0,0.05)] flex items-center gap-3">
              <p className="text-[10px] font-friendly font-bold text-app-muted uppercase tracking-widest">
                Memories: <span className="text-[#1A1A1A] font-mono">{knowledgeNodes.length}</span>
              </p>
              {mode !== 'predictor' && sessionDocs.length > 0 && (
                <>
                  <div className="w-px h-3 bg-paper-border" />
                  <p className="text-[10px] font-friendly font-bold text-app-muted uppercase tracking-widest">
                    Session Docs: <span className="text-[#1A1A1A] font-mono">{sessionDocs.length}</span>
                  </p>
                </>
              )}
            </div>

            {mode === 'predictor' && (
              <button 
                onClick={handleAudit}
                disabled={isLoading || knowledgeNodes.length === 0}
                className="px-6 py-3 bg-archival-parchment text-archival-terracotta border border-paper-border rounded-full text-[11px] font-friendly font-bold uppercase tracking-widest hover:bg-archival-terracotta hover:text-white transition-all flex items-center gap-3 shadow-[1px_1px_2px_rgba(0,0,0,0.05)]"
              >
                {isAuditing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Audit Agent Logic
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[850px] overflow-visible">
          {/* Main Chat Interface */}
          <div className={cn(
            "flex flex-col relative z-10 paper-card bg-white/60 backdrop-blur-md transition-all duration-500 overflow-hidden",
            mode === 'predictor' ? "lg:col-span-6" : "lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3"
          )}>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 scrollbar-hide bg-app-bg/30">
              {messages[mode].length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20 opacity-40">
                  <div className="w-24 h-24 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F29023]">
                    <Brain size={48} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-app-text uppercase tracking-tighter italic">Neural Session Initialized</h3>
                    <p className="text-[10px] font-bold text-app-muted uppercase tracking-[0.4em]">Awaiting Strategic Query</p>
                  </div>
                </div>
              )}
              {messages[mode].map((m, idx) => (
                <div key={idx} className={cn(
                  "flex flex-col max-w-[85%] group",
                  m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                  <div className={cn(
                    "px-8 py-6 rounded-[32px] text-[15px] leading-relaxed relative shadow-[1px_1px_2px_rgba(0,0,0,0.05)] transition-all group-hover:shadow-md",
                    m.role === 'user' 
                      ? "bg-archival-sage/10 text-archival-ink border border-archival-sage/20 rounded-tr-none" 
                      : "bg-white text-archival-ink border border-paper-border rounded-tl-none"
                  )}>
                    <div className="absolute top-4 -mx-10 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className={cn(
                         "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase tracking-tighter border border-paper-border bg-white shadow-sm font-mono",
                         m.role === 'user' ? "text-archival-terracotta" : "text-archival-ink"
                       )}>
                         {m.role === 'user' ? 'USR' : 'BRG'}
                       </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-current prose-p:font-medium prose-strong:font-black">
                      <ReactMarkdown>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  {m.role === 'assistant' && !isLoading && idx === messages[mode].length - 1 && (
                    <div className="flex items-center gap-4 mt-3 px-2">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(m.text);
                          toast.success("Intelligence cloned");
                        }}
                        className="text-[9px] font-black text-app-muted hover:text-[#8B5CF6] uppercase tracking-[0.3em] flex items-center gap-1.5 transition-colors font-friendly"
                      >
                        <Copy size={10} /> Clone
                      </button>
                      <button 
                        onClick={() => {
                          const historyHtml = messages[mode].slice(0, idx + 1).map(m => `
                            <div style="margin-bottom: 30px; border-bottom: 1px solid #E5E0D8; padding-bottom: 20px;">
                              <h4 style="color: #1A1A1A; font-size: 10px; text-transform: uppercase; font-weight: 900;">${m.role}</h4>
                              <div style="font-size: 13px; line-height: 1.6; color: #1A1A1A;">${m.text.replace(/\n/g, '<br/>')}</div>
                            </div>
                          `).join('');

                          const content = `
                            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                            <head><meta charset='utf-8'><title>Strategic Briefing</title></head>
                            <body style="font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1A1A1A; background-color: #FCFBF9;">
                              <h1 style="color: #D67B1B; font-size: 24px; text-transform: uppercase; font-weight: 900; font-style: italic;">Strategic Briefing</h1>
                              <p style="color: #8E8675; font-size: 10px; text-transform: uppercase; font-weight: bold; tracking: 2px;">Compendium ID: ${new Date().getTime()} | Agent: BROGGO 1.2</p>
                              <hr style="border: 0; border-top: 2px solid #D67B1B; margin: 30px 0;"/>
                              ${historyHtml}
                            </body>
                            </html>
                          `;
                          const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `Strategic_Briefing_${new Date().toISOString().slice(0,10)}.doc`;
                          link.click();
                          toast.success("Briefing Exported");
                        }}
                        className="text-[9px] font-black text-app-muted hover:text-archival-terracotta uppercase tracking-[0.3em] flex items-center gap-1.5 transition-colors font-friendly"
                      >
                        <FileDown size={10} /> Briefing
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-4 px-8 py-5 bg-white border border-paper-border text-app-muted rounded-full text-[10px] font-friendly font-black uppercase tracking-[0.4em] shadow-[1px_1px_2px_rgba(0,0,0,0.05)] animate-pulse w-fit">
                  <Loader2 size={16} className="animate-spin text-archival-terracotta" />
                  Neural Synthesis in Progress...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="px-6 lg:px-12 pb-12 pt-6 bg-[#FCFBF9]">
              <div className="flex flex-wrap gap-2 mb-6">
                {/* Session Docs moved to right column */}
              </div>
              <div className="relative flex items-center gap-3 lg:gap-6">
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.onchange = (e: any) => handleFileUpload(e, false);
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-12 h-12 bg-white border border-paper-border rounded-2xl flex items-center justify-center text-app-muted hover:text-archival-terracotta hover:shadow-md transition-all shadow-[1px_1px_2px_rgba(0,0,0,0.05)] shrink-0"
                  title="Attach Context Document"
                >
                  <Upload size={20} />
                </button>
                <div className="flex-1 relative min-w-0">
                  <div className="relative group/input">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        mode === 'auditor' ? "Audit hygiene for North-West Unit..." : 
                        mode === 'retention' ? "Extract the key principles from this clause..." :
                        "Neural Archive Search..."
                      }
                      className="w-full bg-white border border-paper-border focus:border-archival-terracotta/40 pl-6 pr-14 py-4 rounded-[24px] text-[14px] font-bold placeholder:text-app-muted/40 focus:outline-none transition-all shadow-[1px_1px_2px_rgba(0,0,0,0.05)] font-friendly"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-archival-ink h-10 w-10 text-white hover:bg-archival-terracotta disabled:opacity-30 transition-all flex items-center justify-center rounded-[14px] shadow-xl shadow-black/10 shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </div>

                  {mode === 'predictor' && (
                    <div className="flex flex-wrap items-center gap-4 px-2 mt-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={searchKnowledgeBase} onChange={(e) => setSearchKnowledgeBase(e.target.checked)} className="peer sr-only" />
                          <div className="w-10 h-5 bg-paper-border peer-checked:bg-archival-terracotta peer-checked:shadow-[0_0_10px_rgba(214,123,27,0.3)] rounded-full relative transition-all duration-300">
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm" />
                          </div>
                          <span className="text-[8px] font-friendly font-black uppercase tracking-[0.1em] text-app-muted group-hover:text-app-text transition-colors">Archive</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={useWebSearch} onChange={(e) => setUseWebSearch(e.target.checked)} className="peer sr-only" />
                          <div className="w-10 h-5 bg-paper-border peer-checked:bg-archival-terracotta peer-checked:shadow-[0_0_10px_rgba(214,123,27,0.3)] rounded-full relative transition-all duration-300">
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm" />
                          </div>
                          <span className="text-[8px] font-friendly font-black uppercase tracking-[0.1em] text-app-muted group-hover:text-app-text transition-colors">Live Web</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group relative">
                          <input type="checkbox" checked={deepResearchMax} onChange={(e) => setDeepResearchMax(e.target.checked)} className="peer sr-only" />
                          <div className="w-10 h-5 bg-paper-border peer-checked:bg-archival-terracotta peer-checked:shadow-[0_0_15px_rgba(214,123,27,0.5)] rounded-full relative transition-all duration-300">
                            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm" />
                            {deepResearchMax && (
                              <div className="absolute inset-0 rounded-full border border-archival-terracotta animate-ping opacity-20" />
                            )}
                          </div>
                          <span className="text-[8px] font-friendly font-black uppercase tracking-[0.1em] text-app-muted group-hover:text-app-text transition-colors">Max Research</span>
                        </label>
                      </div>
                      
                      <div className="w-px h-5 bg-app-border mx-2" />
                      
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-[0.1em] text-app-muted">Output Depth:</span>
                          <div className="flex bg-app-bg p-0.5 rounded-full border border-app-border">
                            {[
                              { label: 'Brief', value: 'Summary', desc: 'High-speed, focused bullet points for quick consumption.' },
                              { label: 'Standard', value: 'Normal', desc: 'Balanced executive overviews with moderate detail.' },
                              { label: 'Detailed', value: 'Full Report', desc: 'Deep-dive reports including technical context and nuances.' },
                              { label: 'Exhaustive', value: 'Exhaustive', desc: 'Maximum-length dossiers with multi-stage reasoning data.' }
                            ].map((opt) => (
                              <div key={opt.label} className="group/opt relative">
                                <button
                                  type="button"
                                  onClick={() => setAgentOutputStyle(opt.value as any)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-[8px] font-friendly font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                    agentOutputStyle === opt.value 
                                      ? "bg-white text-archival-ink shadow-sm border border-paper-border" 
                                      : "text-app-muted hover:text-app-text"
                                  )}
                                >
                                  {opt.label}
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#111827] text-white text-[7px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover/opt:opacity-100 transition-opacity pointer-events-none z-50 min-w-[120px] text-center shadow-xl">
                                  {opt.desc}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#111827]" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Right Section: Knowledge Map Explorer - ONLY VISIBLE IN PREDICTOR MODE */}
          {mode === 'predictor' && (
            <div className="lg:col-span-6 flex flex-col gap-8 overflow-visible animate-in fade-in slide-in-from-right-10 duration-700">
            <div className="paper-card p-0 flex flex-col relative group overflow-hidden shadow-xl shadow-black/5">
              <div className="absolute top-8 left-8 z-20 pointer-events-none">
                <h3 className="text-lg font-serif font-black text-archival-ink uppercase tracking-tighter italic leading-none">
                  Neural<br />
                  <span className="text-archival-terracotta">Archive</span>
                </h3>
                <div className="h-1 w-12 bg-archival-terracotta mt-2 rounded-full" />
              </div>

              {knowledgeNodes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center px-12">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-app-muted">Neural matrix empty. Ingest data to build memory.</p>
                </div>
              ) : (
                <div className="relative w-full h-[220px]">
                  <KnowledgeGraph 
                    nodes={knowledgeNodes}
                    onNodeClick={(node) => setSelectedNode(node)}
                  />
                </div>
              )}

              {/* Moved Status Bar and Controls to Bottom Row */}
              <div className="p-6 border-t border-paper-border bg-archival-parchment/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={async () => {
                      const count = await batchNormaliseKnowledge();
                      toast.success(`Neural Resync Complete: ${count} nodes formatted.`);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-paper-border rounded-full text-[9px] font-friendly font-black uppercase tracking-widest text-app-muted hover:text-archival-terracotta hover:shadow-md transition-all shadow-[1px_1px_2px_rgba(0,0,0,0.05)]"
                  >
                    <RefreshCw size={12} /> Neural Resync
                  </button>
                  <button 
                    onClick={() => setShowIngestionModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-archival-ink text-white border border-white/10 rounded-full text-[9px] font-friendly font-black uppercase tracking-widest hover:bg-archival-terracotta hover:shadow-md transition-all shadow-lg"
                  >
                    <Upload size={12} /> Add Intelligence
                  </button>
                </div>

                <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-paper-border bg-white shadow-[1px_1px_2px_rgba(0,0,0,0.05)]">
                  <div className="w-2 h-2 rounded-full bg-archival-sage animate-pulse" />
                  <p className="text-[9px] font-friendly font-bold uppercase tracking-widest text-archival-ink">
                    Live Neural Feed: {knowledgeNodes.length} Nodes Synchronized
                  </p>
                </div>
              </div>
            </div>
            
            {/* Session Ingestion Panel (Moved here) */}
            {sessionDocs.length > 0 && (
              <div className="paper-card p-6 bg-archival-sage/5 border-archival-sage/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h5 className="text-[10px] font-friendly font-black uppercase tracking-widest text-archival-ink mb-4 flex items-center gap-2">
                  <Upload size={12} className="text-archival-terracotta" /> Active Intelligence Ingestion
                </h5>
                <div className="flex flex-wrap gap-3">
                  {sessionDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2 bg-white border border-paper-border rounded-xl shadow-sm group hover:border-archival-terracotta transition-all">
                      <div className="w-2 h-2 rounded-full bg-archival-terracotta/40" />
                      <span className="text-[10px] font-bold text-archival-ink uppercase tracking-wider truncate max-w-[200px]">{doc.name}</span>
                      <button 
                        type="button" 
                        onClick={() => removeDoc(idx)} 
                        className="text-app-muted hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Synthesis Feed (Mini) */}
            <div className="flex-1 min-h-[320px] paper-card p-8 overflow-hidden flex flex-col">
              <h5 className="text-[11px] font-friendly font-black uppercase tracking-widest text-archival-ink flex items-center gap-2 mb-6">
                <Brain size={14} className="text-archival-terracotta" /> Synthesis Stream
              </h5>
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <IntelligenceFeed 
                  nodes={knowledgeNodes} 
                  onUpdateSynthesis={handleUpdateSynthesis}
                  onDeleteSynthesis={handleDeleteSynthesis}
                />
              </div>
            </div>
            </div>
          )}
        </div>

        {/* Node Details Modal (Pop-up) */}
        <AnimatePresence>
          {selectedNode && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 lg:p-12">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setSelectedNode(null); setIsEditingNode(false); }}
                className="absolute inset-0 bg-app-text/20 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh] border border-app-border"
              >
                <div className="paper-texture opacity-5" />
                
                {/* Modal Header */}
                <div className="p-8 border-b border-paper-border bg-archival-parchment/30 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-archival-terracotta/10 flex items-center justify-center text-archival-terracotta">
                      <Brain size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-black text-archival-ink uppercase tracking-tighter leading-none italic">Intelligence Node</h3>
                      <p className="text-[9px] font-friendly font-bold text-app-muted uppercase tracking-[0.3em] mt-2 font-mono">ID: {selectedNode.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setEditedNodeContent({ title: selectedNode.title, summary: selectedNode.summary, body: selectedNode.body });
                        setIsEditingNode(!isEditingNode);
                      }}
                      className="w-12 h-12 flex items-center justify-center bg-white border border-paper-border rounded-full text-app-muted hover:text-archival-terracotta transition-all shadow-[1px_1px_2px_rgba(0,0,0,0.05)]"
                    >
                      <Zap size={18} />
                    </button>
                    <button 
                      onClick={() => setSelectedNode(null)}
                      className="w-12 h-12 flex items-center justify-center bg-archival-ink text-white rounded-full hover:bg-archival-terracotta transition-all shadow-lg"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-12 space-y-10 relative z-10 scrollbar-hide">
                  {isEditingNode ? (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-app-muted uppercase tracking-[0.3em]">Title</label>
                        <input 
                          type="text" 
                          value={editedNodeContent.title}
                          onChange={(e) => setEditedNodeContent(p => ({ ...p, title: e.target.value }))}
                          className="w-full text-2xl font-black text-app-text bg-app-bg border border-transparent focus:border-[#8B5CF6]/30 px-6 py-4 rounded-2xl outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-app-muted uppercase tracking-[0.3em]">Executive Summary</label>
                        <textarea 
                          value={editedNodeContent.summary}
                          onChange={(e) => setEditedNodeContent(p => ({ ...p, summary: e.target.value }))}
                          className="w-full text-sm font-bold text-app-muted bg-app-bg border border-transparent focus:border-[#8B5CF6]/30 px-6 py-4 rounded-2xl outline-none transition-all resize-none"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-app-muted uppercase tracking-[0.3em]">Technical Report (Markdown)</label>
                        <textarea 
                          value={editedNodeContent.body}
                          onChange={(e) => setEditedNodeContent(p => ({ ...p, body: e.target.value }))}
                          className="w-full text-[14px] leading-relaxed text-app-text font-mono bg-app-bg border border-transparent focus:border-[#8B5CF6]/30 px-8 py-6 rounded-3xl outline-none transition-all resize-none"
                          rows={12}
                        />
                      </div>
                      <div className="flex items-center gap-4 pt-4">
                        <button 
                          onClick={handleUpdateNode} 
                          className="px-10 py-4 bg-[#8B5CF6] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:opacity-90 transition-all shadow-lg shadow-[#8B5CF6]/20"
                        >
                          Synchronize Changes
                        </button>
                        <button 
                          onClick={() => setIsEditingNode(false)} 
                          className="px-10 py-4 bg-app-bg text-app-muted rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-gray-200 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <span className="px-4 py-1.5 bg-pastel-sage text-app-text border border-app-border text-[9px] font-black rounded-full uppercase tracking-widest">{selectedNode.type}</span>
                           <span className="px-4 py-1.5 bg-pastel-blue text-app-text border border-app-border text-[9px] font-black rounded-full uppercase tracking-widest">{selectedNode.category}</span>
                        </div>
                        <h2 className="text-5xl font-black text-app-text tracking-tighter leading-[0.9] uppercase italic">{selectedNode.title}</h2>
                        <p className="text-xl font-bold text-app-muted leading-tight uppercase italic max-w-2xl">{selectedNode.summary}</p>
                      </div>

                      <div className="w-24 h-1.5 bg-[#8B5CF6] rounded-full opacity-20" />

                      <div className="prose prose-lg max-w-none text-app-text prose-headings:uppercase prose-headings:tracking-tighter prose-headings:font-black prose-p:font-medium prose-p:leading-relaxed prose-strong:font-black">
                        <ReactMarkdown>{selectedNode.body}</ReactMarkdown>
                      </div>

                      {selectedNode.connections && selectedNode.connections.length > 0 && (
                        <div className="pt-10 border-t border-app-border">
                          <h4 className="text-[10px] font-black text-app-muted uppercase tracking-[0.4em] mb-6">Neural Connections</h4>
                          <div className="flex flex-wrap gap-3">
                            {selectedNode.connections.map(id => (
                              <div key={id} className="px-5 py-3 bg-app-bg border border-app-border rounded-full text-[10px] font-bold uppercase tracking-widest text-app-muted">
                                Node: {id.substring(0, 8)}...
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                {!isEditingNode && (
                  <div className="p-10 bg-app-bg border-t border-app-border flex items-center justify-between relative z-10">
                    <p className="text-[9px] font-bold text-app-muted uppercase tracking-widest">
                      Last Indexed: {selectedNode.updatedAt ? new Date(selectedNode.updatedAt).toLocaleString() : 'N/A'}
                    </p>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          const text = `${selectedNode.title}\n\n${selectedNode.summary}\n\n${selectedNode.body}`;
                          navigator.clipboard.writeText(text);
                          toast.success("Intelligence cloned to clipboard");
                        }}
                        className="flex items-center gap-3 px-6 py-3 bg-white border border-app-border rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-app-text hover:shadow-md transition-all"
                      >
                        <Copy size={14} /> Clone Node
                      </button>
                      <button 
                        onClick={handleDeleteNode}
                        className="flex items-center gap-3 px-6 py-3 bg-rose-50 border border-rose-100 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-100 transition-all"
                      >
                        <Trash2 size={14} /> Purge Node
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Ingestion Summary Overlay (Updated for new aesthetic) */}
        <AnimatePresence>
          {lastIngestionResult && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-8 bottom-8 top-32 z-[150] bg-white rounded-[40px] shadow-2xl p-12 overflow-hidden flex flex-col border-2 border-[#8B5CF6]/10"
            >
              <div className="paper-texture opacity-5" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] bg-[#8B5CF6]/5 flex items-center justify-center text-[#8B5CF6] border border-[#8B5CF6]/10">
                    <Sparkles size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-app-text uppercase tracking-tighter italic leading-none">Neural Extraction</h3>
                    <p className="text-[10px] font-bold text-app-muted uppercase tracking-[0.3em] mt-2">
                      Synthesis Complete • {lastIngestionResult.insights.length} Insights Identified
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setLastIngestionResult(null); setExpandedInsightIdx(null); }}
                  className="px-10 py-4 bg-app-bg text-app-text border border-app-border rounded-full text-[11px] font-black uppercase tracking-[0.3em] transition-all hover:bg-gray-100"
                >
                  Dismiss
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 space-y-10 relative z-10 scrollbar-hide">
                <div className="p-10 bg-pastel-blue/30 rounded-[32px] border border-app-border">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-app-muted mb-4">Executive Abstract</h4>
                  <p className="text-xl font-bold text-app-text leading-tight italic">"{lastIngestionResult.summary}"</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lastIngestionResult.insights.map((insight, idx) => {
                    const label = insight.title || insight.topic || 'Intelligence Node';
                    const detail = insight.body || insight.details || '';
                    const cat = insight.category || 'General Intelligence';
                    const isExpanded = expandedInsightIdx === idx;
                    return (
                      <div 
                        key={idx} 
                        className="p-8 bg-white border border-app-border rounded-[32px] shadow-sm hover:border-[#8B5CF6]/30 transition-all group cursor-pointer"
                        onClick={() => setExpandedInsightIdx(isExpanded ? null : idx)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-app-text">{cat}</span>
                          </div>
                          <span className="text-[9px] text-[#8B5CF6] font-black uppercase tracking-widest">
                            {isExpanded ? 'Collapse' : 'Inspect'}
                          </span>
                        </div>
                        <h5 className="text-[16px] font-black text-app-text uppercase tracking-tight mb-3 group-hover:text-[#8B5CF6] transition-colors">{label}</h5>
                        <p className="text-[12px] text-app-muted font-medium leading-relaxed italic line-clamp-2">{insight.summary}</p>
                        
                        <AnimatePresence>
                          {isExpanded && detail && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-6 pt-6 border-t border-app-border">
                                <div className="text-[12px] text-app-text leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto font-mono bg-app-bg rounded-2xl p-6 border border-app-border">
                                  {detail}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-app-border flex items-center justify-between relative z-10">
                <p className="text-[10px] font-bold text-app-muted uppercase tracking-widest max-w-xl">
                  Strategic insights have been autonomously woven into the permanent 3D Knowledge Map.
                </p>
                <button 
                  onClick={() => { setLastIngestionResult(null); setExpandedInsightIdx(null); }}
                  className="px-12 py-5 bg-app-text text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-[#8B5CF6] transition-all shadow-xl shadow-app-text/20"
                >
                  Confirm Indexing
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Ingestion Modal - GLOBAL ACCESS */}
        <AnimatePresence>
          {showIngestionModal && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowIngestionModal(false)}
                className="absolute inset-0 bg-archival-ink/40 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col border border-archival-parchment"
              >
                <div className="paper-texture opacity-5" />
                <div className="p-8 border-b border-archival-parchment flex items-center justify-between relative z-10 bg-archival-bone/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-archival-terracotta/10 flex items-center justify-center text-archival-terracotta border border-archival-terracotta/20">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-archival-ink uppercase tracking-tighter leading-none italic">Neural Ingestion</h3>
                      <p className="text-[9px] font-black text-archival-ink/40 uppercase tracking-[0.3em] mt-2 font-mono">FEED THE ARCHIVE</p>
                    </div>
                  </div>
                  <button onClick={() => setShowIngestionModal(false)} className="w-10 h-10 flex items-center justify-center bg-archival-ink text-white rounded-full hover:bg-archival-terracotta transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex border-b border-archival-parchment relative z-10">
                  {(['link', 'text', 'file'] as const).map(tab => (
                    <button key={tab} onClick={() => setIngestionTab(tab)} className={cn("flex-1 py-4 text-[9px] font-black uppercase tracking-[0.3em] transition-all border-b-2 font-mono", ingestionTab === tab ? "border-archival-terracotta text-archival-ink bg-archival-bone/30" : "border-transparent text-archival-ink/30 hover:text-archival-ink")}>
                      {tab === 'link' ? 'Neural Link' : tab === 'text' ? 'Intel Draft' : 'Technical Dossier'}
                    </button>
                  ))}
                </div>

                <div className="p-10 space-y-8 relative z-10 min-h-[300px] flex flex-col">
                  {ingestionTab === 'link' && (
                    <div className="space-y-4 flex-1">
                      <label className="text-[9px] font-black text-archival-ink/40 uppercase tracking-[0.3em] font-mono">Target URL</label>
                      <input type="url" placeholder="https://..." value={ingestionInput} onChange={(e) => setIngestionInput(e.target.value)} className="w-full bg-archival-parchment/30 border border-archival-parchment rounded-2xl px-6 py-4 text-sm font-bold text-archival-ink focus:border-archival-terracotta/40 outline-none transition-all placeholder:text-archival-ink/20" />
                    </div>
                  )}
                  {ingestionTab === 'text' && (
                    <div className="space-y-4 flex-1">
                      <label className="text-[9px] font-black text-archival-ink/40 uppercase tracking-[0.3em] font-mono">Paste Intelligence</label>
                      <textarea placeholder="Enter raw text..." rows={6} value={ingestionInput} onChange={(e) => setIngestionInput(e.target.value)} className="w-full bg-archival-parchment/30 border border-archival-parchment rounded-2xl px-6 py-4 text-sm font-bold text-archival-ink focus:border-archival-terracotta/40 outline-none transition-all placeholder:text-archival-ink/20 resize-none" />
                    </div>
                  )}
                  {ingestionTab === 'file' && (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-archival-parchment rounded-3xl p-10 bg-archival-parchment/10 group hover:bg-archival-parchment/20 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-archival-ink mb-4 shadow-sm group-hover:scale-110 transition-transform"><FileText size={32} /></div>
                      <p className="text-[11px] font-black text-archival-ink uppercase tracking-widest">Select Files</p>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, true)} accept=".md,.markdown,text/markdown,text/x-markdown,.txt,text/plain,.pdf,.docx,.csv" />
                    </div>
                  )}

                  <div className="pt-6">
                    <button 
                      disabled={isIngesting || (ingestionTab !== 'file' && !ingestionInput.trim())}
                      onClick={async () => {
                        setIsIngesting(true);
                        setIngestionStage('linking');
                        try {
                          let count = 0;
                          if (ingestionTab === 'link') {
                            const res = await processIngestedLink(ingestionInput);
                            setIngestionStage('analyzing');
                            count = res.count;
                          } else if (ingestionTab === 'text') {
                            const res = await processIngestedText(ingestionInput);
                            setIngestionStage('analyzing');
                            count = res.count;
                          }
                          
                          if (count > 0) {
                            setIngestionStage('persisting');
                            await new Promise(r => setTimeout(r, 800)); // Brief pause for UX
                            toast.success(`Successfully ingested ${count} insights.`);
                            fetchInsights();
                            setShowIngestionModal(false);
                            setIngestionInput('');
                          }
                        } catch (err) { toast.error("Ingestion failed."); }
                        finally { 
                          setIsIngesting(false); 
                          setIngestionStage('idle');
                        }
                      }}
                      className={cn(
                        "w-full py-5 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] shadow-xl transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden",
                        isIngesting ? "bg-[#D67B1B]" : "bg-archival-ink hover:bg-archival-terracotta"
                      )}
                    >
                      {isIngesting && (
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ 
                            width: ingestionStage === 'linking' ? "33%" : 
                                   ingestionStage === 'analyzing' ? "66%" : "100%" 
                          }}
                          className="absolute top-0 left-0 h-1 bg-white/40"
                        />
                      )}
                      <div className="flex items-center gap-3">
                        {isIngesting ? <Loader2 size={16} className="animate-spin text-archival-terracotta" /> : <Sparkles size={16} className="text-archival-terracotta" />}
                        <span className="font-friendly font-bold uppercase tracking-widest text-[11px] text-archival-ink">
                          {ingestionStage === 'idle' && 'Archival Sync'}
                          {ingestionStage === 'linking' && 'Establishing Neural Link...'}
                          {ingestionStage === 'analyzing' && 'Synthesizing Intelligence...'}
                          {ingestionStage === 'persisting' && 'Persisting to Archive...'}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
