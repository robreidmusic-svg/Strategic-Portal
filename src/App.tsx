/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AccountPlanBuilder } from './components/AccountPlanBuilder';
import { FinancialModelCalculator } from './components/FinancialModelCalculator';
import { AdminPanel } from './components/AdminPanel';
import { StrategicIntelligenceHub } from './components/StrategicIntelligenceHub';
import { QuoteBuilder } from './components/QuoteBuilder';
import NetworkVisualizer from './components/NetworkVisualizer';
import { Login } from './components/Login';
import { cn } from './lib/utils';
import { Loader2, LogOut } from 'lucide-react';
import { Toaster } from 'sonner';

function AppContent() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { portalUser, loading, logout } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-hrma-canvas flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-hrma-charcoal animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#111827]">Negotiating Access...</p>
        </div>
      </div>
    );
  }

  if (!portalUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-hrma-canvas flex p-0 md:p-4 lg:p-6">
      <Toaster position="top-right" expand={false} richColors />
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-[calc(100vh-theme(spacing.12))] relative",
        "lg:ml-64 p-4 md:p-8 lg:p-12 bg-white rounded-[32px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05)] md:mx-4"
      )}>
        {/* Global Sign Out Button */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8 lg:top-12 lg:right-12 z-10 no-print">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-6 py-2 bg-[#282828] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-[#F29023] transition-all rounded-full"
            title="Secure Sign Out"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        <div className={cn(
          "mx-auto",
          activeSection.startsWith('intel-hub') ? "max-w-[1600px]" : "max-w-7xl"
        )}>
          {activeSection === 'dashboard' && <Dashboard />}
          {activeSection === 'account-plan' && <AccountPlanBuilder />}
          {activeSection === 'intel-hub-auditor' && <StrategicIntelligenceHub initialMode="auditor" />}
          {activeSection === 'intel-hub-retention' && <StrategicIntelligenceHub initialMode="retention" />}
          {activeSection === 'intel-hub-predictor' && <StrategicIntelligenceHub initialMode="predictor" />}
          {activeSection === 'deal-metrics-agent' && <FinancialModelCalculator />}
          {activeSection === 'network-visualizer' && <NetworkVisualizer />}
          {activeSection === 'quote-builder' && <QuoteBuilder />}
          {activeSection === 'admin' && <AdminPanel />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

