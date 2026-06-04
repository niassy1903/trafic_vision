import React from 'react';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  BarChart3, 
  Cpu, 
  BookOpen, 
  Settings 
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  arduinoConnected: boolean;
}

export default function Sidebar({ currentTab, setTab, arduinoConnected }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'infractions', label: 'Infractions', icon: AlertTriangle, badge: true },
    { id: 'statistics', label: 'Statistiques', icon: BarChart3 },
    { id: 'simulator', label: 'Simulateur Arduino', icon: Cpu },
    { id: 'setup', label: 'Guide & Code Arduino', icon: BookOpen },
    { id: 'settings', label: 'Configuration', icon: Settings }
  ];

  return (
    <aside className="w-68 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 font-sans">
      {/* Brand Header */}
      <div>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/30">
              <span className="text-xl font-bold text-red-500">🚨</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 tracking-tight">TraficVision</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Supervision Feu Rouge</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/10'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="p-3.5 rounded-lg bg-slate-850 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              {arduinoConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {arduinoConnected ? 'Capteur Connecté' : 'Simulation Active'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {arduinoConnected ? 'Arduino UNO : En ligne' : 'Simulateur Virtuel'}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center text-[10px] text-slate-500 font-mono">
          v1.0.0 © TraficVision
        </div>
      </div>
    </aside>
  );
}
