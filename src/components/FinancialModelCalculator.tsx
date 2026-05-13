import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, AlertTriangle, ChevronRight, Info, Sparkles, Send, Loader2, User } from 'lucide-react';
import { chatWithFinancialAgent } from '../services/geminiService';

export function FinancialModelCalculator() {
  const [inputs, setInputs] = useState<Record<string, string>>({
    contractTermMonths: '36',
    monthlyRecurringChargeGbp: '0',
    nonRecurringChargeGbp: '0',
    cpiPercentage: '3.5',
    capexIncCapLabourGbp: '0',
    netExpenditureMrcGbp: '0',
    netExpenditureNrcGbp: '0',
  });

  const parsedInputs = {
    contractTermMonths: parseFloat(inputs.contractTermMonths) || 0,
    monthlyRecurringChargeGbp: parseFloat(inputs.monthlyRecurringChargeGbp) || 0,
    nonRecurringChargeGbp: parseFloat(inputs.nonRecurringChargeGbp) || 0,
    cpiPercentage: parseFloat(inputs.cpiPercentage) || 0,
    capexIncCapLabourGbp: parseFloat(inputs.capexIncCapLabourGbp) || 0,
    netExpenditureMrcGbp: parseFloat(inputs.netExpenditureMrcGbp) || 0,
    netExpenditureNrcGbp: parseFloat(inputs.netExpenditureNrcGbp) || 0,
  };

  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: "Hello! I am your Financial Model Assistant. Adjust the parameters on the left, and ask me how to hit your target metrics (e.g. 'What term length do I need to hit 50% Margin?')." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const responseText = await chatWithFinancialAgent(userMessage, chatMessages, parsedInputs);
      setChatMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: "I encountered an error connecting to the intelligence server." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  // Calculations
  const tcv = (parsedInputs.monthlyRecurringChargeGbp * parsedInputs.contractTermMonths) + parsedInputs.nonRecurringChargeGbp;
  const totalCosts = (parsedInputs.netExpenditureMrcGbp * parsedInputs.contractTermMonths) + parsedInputs.netExpenditureNrcGbp + parsedInputs.capexIncCapLabourGbp;
  
  // EBITDA = TCV - ((Net Exp MRC * Term) + Net Exp NRC) over the term
  // Wait, calculation logic says: "EBITDA: Total Revenue (TCV) minus Total Operating Expenditure (Net MRC and NRC) over the term."
  const opex = (parsedInputs.netExpenditureMrcGbp * parsedInputs.contractTermMonths) + parsedInputs.netExpenditureNrcGbp;
  const ebitda = tcv - opex;

  const monthlyAmortisedRevenue = parsedInputs.contractTermMonths > 0 ? tcv / parsedInputs.contractTermMonths : 0;
  
  const contributionMargin = tcv > 0 ? (ebitda / tcv) * 100 : 0;
  
  // Payback in months (Capex / Monthly Margin) -> Net Cap / (MRC - Net MRC)
  const monthlyMargin = parsedInputs.monthlyRecurringChargeGbp - parsedInputs.netExpenditureMrcGbp;
  // Let's accurately define Payback based on initial Cap/NRC outlays
  // Outlay = Capex + Net NRC - NRC
  const initialOutlay = parsedInputs.capexIncCapLabourGbp + parsedInputs.netExpenditureNrcGbp - parsedInputs.nonRecurringChargeGbp;
  const payback = monthlyMargin > 0 ? (initialOutlay > 0 ? initialOutlay / monthlyMargin : 0) : (initialOutlay > 0 ? Infinity : 0);

  const netCapital = parsedInputs.capexIncCapLabourGbp - parsedInputs.nonRecurringChargeGbp;

  // MOIC: Multiple on Invested Capital. Total Net Cash Return / Initial Outlay
  const totalReturn = monthlyMargin * parsedInputs.contractTermMonths;
  const moic = initialOutlay > 0 ? totalReturn / initialOutlay : 0;

  // CCRP Cash on Cash Return Percentage
  // Using total project cash profit over initial invested cash
  const ccrp = initialOutlay > 0 ? (moic - 1) * 100 : 0;

  // Simple NPV proxy (Discounted at 10% over term)
  // Let's do a simple monthly discount
  const discountRateAnnual = 0.10;
  const discountRateMonthly = Math.pow(1 + discountRateAnnual, 1/12) - 1;
  let npv = -initialOutlay; // Year/Month 0
  for(let i=1; i<=parsedInputs.contractTermMonths; i++) {
     npv += monthlyMargin / Math.pow(1 + discountRateMonthly, i);
  }

  const showWarning = parsedInputs.cpiPercentage > 5 || (parsedInputs.capexIncCapLabourGbp > (tcv * 0.5));

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 }).format(val / 100);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-[#111827] uppercase tracking-tighter mb-2">Deal Metrics Agent</h2>
        <p className="text-[#6B7280] font-medium max-w-2xl text-sm leading-relaxed">
          High-level estimation tool for live projects and sales opportunities. All outputs are for guidance exclusively.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24} />
          <div>
            <h4 className="text-amber-800 font-bold uppercase tracking-widest text-[11px] mb-2">Internal Disclaimer</h4>
            <p className="text-amber-900/80 text-sm font-medium leading-relaxed">
              ESTIMATE ONLY: These figures are for guidance purposes and must be caveated in all formal proposals. Results are based on high-level assumptions rather than granular data sets.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Inputs */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border text-sm border-gray-100 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#111827] mb-6 flex items-center gap-2">
              <Calculator size={14} className="text-[#8B5CF6]" />
              Calculator Inputs
            </h3>
            
            <div className="space-y-5">
              {[
                { field: 'contractTermMonths', label: 'Contract Term', unit: 'Months' },
                { field: 'monthlyRecurringChargeGbp', label: 'Monthly Recurring Charge (MRC)', unit: '£' },
                { field: 'nonRecurringChargeGbp', label: 'Non Recurring Charge (NRC)', unit: '£' },
                { field: 'cpiPercentage', label: 'CPI Assumption', unit: '%' },
                { field: 'capexIncCapLabourGbp', label: 'Capex Inc. Cap Labour', unit: '£' },
                { field: 'netExpenditureMrcGbp', label: 'Net Expenditure MRC', unit: '£' },
                { field: 'netExpenditureNrcGbp', label: 'Net Expenditure NRC', unit: '£' }
              ].map((input) => (
                <div key={input.field} className="group">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 group-hover:text-[#8B5CF6] transition-colors">{input.label}</label>
                  <div className="relative">
                    {input.unit === '£' && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">£</span>}
                    <input
                      type="number"
                      value={inputs[input.field as keyof typeof inputs]}
                      onChange={(e) => handleInputChange(input.field, e.target.value)}
                      className={`w-full bg-gray-50 border border-transparent focus:bg-white focus:border-[#8B5CF6]/30 rounded-xl px-4 py-3 text-sm font-bold text-[#111827] outline-none transition-all ${input.unit === '£' ? 'pl-8' : ''} ${input.unit === '%' || input.unit === 'Months' ? 'pr-12' : ''}`}
                    />
                    {(input.unit === '%' || input.unit === 'Months') && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">{input.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Calculator size={120} />
            </div>

            <h3 className="text-xs font-black uppercase tracking-widest text-[#111827] mb-8">Financial Estimates</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-8">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Contract Value</p>
                <p className="text-xl font-black text-[#111827]">{formatMoney(tcv)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Costs</p>
                <p className="text-xl font-black text-rose-600">{formatMoney(totalCosts)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">EBITDA</p>
                <p className="text-xl font-black text-emerald-600">{formatMoney(ebitda)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Net Capital</p>
                <p className="text-xl font-black text-[#111827]">{formatMoney(netCapital)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Monthly Revenue</p>
                <p className="text-xl font-black text-[#111827]">{formatMoney(parsedInputs.monthlyRecurringChargeGbp)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Amortised MRC</p>
                <p className="text-xl font-black text-[#111827]">{formatMoney(monthlyAmortisedRevenue)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50">
                <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mb-2">Contribution Margin</p>
                <p className="text-lg font-black text-[#111827]">{formatPercent(contributionMargin)}</p>
              </div>
              <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
                <p className="text-[9px] uppercase font-bold text-[#8B5CF6] tracking-wider mb-2">CCRP</p>
                <p className="text-lg font-black text-[#8B5CF6]">{formatPercent(ccrp)}</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 relative group">
                <p className="text-[9px] uppercase font-bold text-blue-600 tracking-wider mb-2 flex items-center gap-1">
                  Est. MOIC
                  <Info size={10} className="text-blue-400" />
                </p>
                <p className="text-lg font-black text-blue-700">{moic.toFixed(2)}x</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Multiple on Invested Capital. Indicates expected total return on initial outlay.
                </div>
              </div>
              <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 relative group">
                <p className="text-[9px] uppercase font-bold text-rose-600 tracking-wider mb-2 flex items-center gap-1">
                  Payback
                  <Info size={10} className="text-rose-400" />
                </p>
                <p className="text-lg font-black text-rose-700">{payback === Infinity ? 'Never' : `${payback.toFixed(1)} mos`}</p>
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  High Sensitivity Metric based on assumed initial outlay and margin.
                </div>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 relative group">
                <p className="text-[9px] uppercase font-bold text-emerald-600 tracking-wider mb-2 flex items-center gap-1">
                  Est. NPV
                  <Info size={10} className="text-emerald-400" />
                </p>
                <p className="text-lg font-black text-emerald-700">{formatMoney(npv)}</p>
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  High Sensitivity Metric. Uses standard 10% discount rate proxy.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[400px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Sparkles size={16} className="text-[#8B5CF6]" />
              <h4 className="text-[11px] uppercase tracking-widest font-black text-[#111827]">Financial Analyst Agent</h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence initial={false}>
                {chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#111827] text-white' : 'bg-violet-100 text-[#8B5CF6]'}`}>
                        {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
                      </div>
                      <div className={`p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#111827] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm'}`}>
                        {msg.text.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < msg.text.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="flex items-start gap-2 max-w-[85%] flex-row">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-violet-100 text-[#8B5CF6]">
                        <Sparkles size={12} />
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-gray-100 text-gray-500 rounded-tl-sm flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-[#8B5CF6]" />
                        <span className="text-[12px] font-medium">Analyzing model parameters...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && handleSendMessage()}
                  placeholder="Ask how to hit your desired metrics..."
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#8B5CF6]/50 focus:bg-white rounded-full pl-5 pr-12 py-3 text-sm font-medium outline-none transition-all placeholder:text-gray-400"
                  disabled={isChatLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="absolute right-2 w-8 h-8 flex items-center justify-center bg-[#111827] hover:bg-[#8B5CF6] disabled:bg-gray-300 text-white rounded-full transition-colors"
                >
                  <Send size={14} className={chatInput.trim() && !isChatLoading ? "ml-0.5" : ""} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-center pt-2">
             <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400">
               ESTIMATE ONLY: These figures are for guidance purposes and must be caveated in all formal proposals.
             </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
