import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  HelpCircle, 
  Sliders, 
  Wifi, 
  Check, 
  RefreshCcw,
  Volume2,
  Trash2
} from 'lucide-react';

interface SettingsViewProps {
  onClearAll: () => void;
  onRefresh: () => void;
  totalCount: number;
}

export default function SettingsView({ onClearAll, onRefresh, totalCount }: SettingsViewProps) {
  const [copied, setCopied] = useState(false);
  const localApiUrl = window.location.origin;

  const handleCopyApiUrl = () => {
    navigator.clipboard.writeText(`${localApiUrl}/api/infractions`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans text-slate-200">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Paramètres du Système</h2>
        <p className="text-xs text-slate-400 mt-1">
          Gérez les configurations de connexions d'API, l'état de la base de données et l'environnement de supervision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* API Endpoint Panel */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" />
            Point de terminaison API (Endpoint)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pour connecter votre Arduino réel ou votre script relais Python, effectuez des requêtes POST HTTP de détection à l'URL suivante :
          </p>
          
          <div className="flex gap-2 p-1.5 bg-slate-950 border border-slate-850 rounded-lg">
            <input
              type="text"
              readOnly
              value={`${localApiUrl}/api/infractions`}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-cyan-300 border-none focus:outline-none"
            />
            <button
              onClick={handleCopyApiUrl}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-semibold rounded border border-slate-755 text-slate-300 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copié</span>
                </>
              ) : (
                <span>Copier l'URL</span>
              )}
            </button>
          </div>

          <p className="text-[10.5px] text-slate-500 font-mono">
            Format attendu : JSON {"{ distance: float, etat_feu: 'rouge' | 'vert' | 'orange' }"}
          </p>
        </div>

        {/* Database administration panel */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Administration des données
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Opérations de maintenance sur la base de données intégrée de TraficVision.
          </p>
          
          <div className="p-4 bg-slate-950/80 rounded-lg border border-slate-850 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] text-slate-500 font-mono text-xs block">Volume de la base de données</span>
              <span className="text-lg font-bold text-red-400 mt-1 block">
                {totalCount} procès-verbaux
              </span>
            </div>
            
            <button
              onClick={onRefresh}
              className="p-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 transition-all cursor-pointer"
              title="Synchroniser la DB"
            >
              <RefreshCcw className="w-4 h-4 text-cyan-400" />
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                if (confirm("Réinitialiser l'ensemble des enregistrements de la base de données ?")) {
                  onClearAll();
                }
              }}
              className="w-full py-3 bg-red-950/20 hover:bg-red-950 text-red-200 border border-red-900/30 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-red-400 animate-pulse" />
              Effacer tout l'historique
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
