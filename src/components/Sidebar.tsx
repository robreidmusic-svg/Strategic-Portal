import React from 'react';
import { LayoutDashboard, FileText, Settings, Shield, Menu, X, LogOut, Sparkles, ScrollText, Moon, Sun, Monitor, Palette, Terminal, ShieldCheck, Scale, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const { adminMode, setAdminMode, portalUser, logout, theme, setTheme } = useApp();
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { type: 'divider', label: 'Intelligence Nodes' },
    { id: 'deal-metrics-agent', label: 'Metrics Engine', icon: FileText, color: 'text-archival-terracotta', activeStyle: 'bg-archival-terracotta text-white' },
    { id: 'intel-hub-retention', label: 'Retention Case Vault', icon: Scale, color: 'text-archival-sage', activeStyle: 'bg-archival-sage text-white' },
    { id: 'intel-hub-predictor', label: 'Broggo Neural Feed', icon: Globe, color: 'text-archival-terracotta', activeStyle: 'bg-archival-terracotta text-white' },
    ...(adminMode ? [{ id: 'admin', label: 'System Admin', icon: Settings }] : []),
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-archival-bone rounded-md shadow-md border border-archival-parchment"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-archival-ink text-white transition-all duration-300 lg:translate-x-0 font-sans border-r border-white/5",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full tracking-wide relative overflow-hidden">
          {/* UI Polish: Paper Texture Overlay */}
          <div className="paper-texture opacity-10 absolute inset-0 pointer-events-none" />
          
          <div className="p-8 flex-1 relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-archival-terracotta to-hrma-orange rounded-lg flex items-center justify-center shadow-lg">
                  <Globe className="text-white" size={18} />
                </div>
                <h1 className="text-[10px] font-black tracking-[0.3em] uppercase opacity-90 font-friendly leading-tight text-gradient-gold">
                  STRATEGIC<br/>
                  PORTAL
                </h1>
              </div>
            </div>
 
            <nav className="space-y-2 flex flex-col">
              {navItems.map((item: any, i) => {
                if (item.type === 'divider') {
                  return <div key={`div-${i}`} className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 mb-2 mt-8 px-4 font-friendly">{item.label}</div>;
                }
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 transition-all duration-300 group text-[10px] font-black text-left rounded-xl uppercase tracking-widest",
                      isActive
                        ? (item.activeStyle || "bg-white/10 text-white shadow-xl border border-white/5")
                        : "text-white/40 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300",
                      isActive ? "bg-white/10 border-white/20" : "bg-black/20 border-white/5 group-hover:border-white/10"
                    )}>
                      <item.icon size={14} className={cn(
                        isActive ? "text-white" : item.color || "opacity-40 group-hover:opacity-100"
                      )} />
                    </div>
                    <span className="flex-1 font-friendly">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
 
          <div className="p-6 border-t border-white/5 space-y-4">
            {/* User Info */}
            {portalUser && (
              <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 flex items-center justify-center bg-archival-terracotta/10 text-archival-terracotta border border-archival-terracotta/20 rounded-full shadow-inner">
                    <span className="text-[10px] font-black font-mono">
                      {portalUser?.firstName?.substring(0, 1).toUpperCase() || ''}
                      {portalUser?.lastName?.substring(0, 1).toUpperCase() || ''}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-white truncate font-friendly tracking-wider">
                      {portalUser?.firstName} {portalUser?.lastName}
                    </p>
                    <p className="text-[8px] text-white/30 truncate tracking-[0.2em] uppercase font-black font-mono">
                      {portalUser?.role}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 hover:bg-white/10 text-white/40 hover:text-white transition-all rounded-full"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
 
            {portalUser?.role === 'admin' && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-black/20 rounded-full border border-white/5">
                <div className="flex items-center gap-2">
                  <Shield size={12} className={adminMode ? "text-archival-terracotta" : "text-white/20"} />
                  <span className="text-[8px] font-black text-white/30 tracking-[0.2em] uppercase font-mono">ARCHIVAL ADMIN</span>
                </div>
                <button
                  onClick={() => setAdminMode(!adminMode)}
                  className={cn(
                    "relative inline-flex h-4 w-9 items-center rounded-full transition-all duration-500 focus:outline-none ring-1 ring-inset",
                    adminMode ? "bg-archival-terracotta/20 ring-archival-terracotta/40" : "bg-white/5 ring-white/10"
                  )}
                >
                  <span className={cn(
                    "inline-block h-2 w-2 transform rounded-full transition-all duration-500",
                    adminMode ? "translate-x-6 bg-archival-terracotta shadow-[0_0_10px_rgba(214,123,27,0.8)]" : "translate-x-1 bg-white/20"
                  )} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
