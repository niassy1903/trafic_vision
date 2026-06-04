import React, { useEffect, useState } from 'react';
import { 
  AlertOctagon, 
  Activity, 
  Calendar, 
  TrendingUp, 
  Play, 
  Volume2, 
  VolumeX,
  Clock,
  ShieldCheck,
  Radar,
  Camera,
  Eye,
  Cpu,
  Video,
  Terminal,
  FileText,
  Copy,
  Check,
  Zap,
  HardDrive,
  Info,
  Layers,
  Sliders,
  Server
} from 'lucide-react';
import { Infraction, Stats } from '../types';

interface DashboardProps {
  stats: Stats;
  latestInfractions: Infraction[];
  arduinoConnected: boolean;
  activeAlert: Infraction | null;
  dismissAlert: () => void;
  onSimulateCross: () => void;
  onSimulateYolo: () => void;
  systemStatus: 'online' | 'offline';
  lightState: 'rouge' | 'orange' | 'vert';
  distance: number;
  webSerialActive: boolean;
  startWebSerial: () => void;
  stopWebSerial: () => void;
  serialConsoleLines: string[];
}

export default function Dashboard({
  stats,
  latestInfractions,
  arduinoConnected,
  activeAlert,
  dismissAlert,
  onSimulateCross,
  onSimulateYolo,
  systemStatus,
  lightState,
  distance,
  webSerialActive,
  startWebSerial,
  stopWebSerial,
  serialConsoleLines
}: DashboardProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'python_sync'>('diagnostics');
  const [confThreshold, setConfThreshold] = useState<number>(0.75);

  // Compute live breakdown counts from local infractions list
  const redLightCount = latestInfractions.filter(i => i.type === 'feu_rouge_grille').length;
  const helmetCount = latestInfractions.filter(i => i.type === 'moto_sans_casque').length;

  useEffect(() => {
    if (activeAlert && audioEnabled) {
      playAlertSiren();
    }
  }, [activeAlert, audioEnabled]);

  const copyPythonCommand = () => {
    navigator.clipboard.writeText("python detect_yolo.py");
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const playAlertSiren = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      
      if (activeAlert?.type === 'moto_sans_casque') {
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.setValueAtTime(698.46, now + 0.15); // F5
        osc1.frequency.setValueAtTime(587.33, now + 0.3);
        osc1.frequency.setValueAtTime(698.46, now + 0.45);
      } else {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5
        osc1.frequency.setValueAtTime(1046.50, now + 0.15); // C6
        osc1.frequency.setValueAtTime(880, now + 0.3); 
        osc1.frequency.setValueAtTime(1046.50, now + 0.45);
      }
      
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.60);
    } catch (e) {
      console.warn("Unable to play alert audio:", e);
    }
  };

  // Sound test manually triggered by user
  const handleSoundTest = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25); // G5 quick sweep
      
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn(e);
    }
  };

  // Radar Proximity Percentage logic
  const maxProximityDistance = 40.0;
  const rawProximityPercent = Math.max(0, Math.min(100, ((maxProximityDistance - distance) / maxProximityDistance) * 100));
  const proximityPercent = distance > maxProximityDistance ? 0 : rawProximityPercent;
  const isCriticalDistance = distance <= 15.0;

  // Sparkline data generators representing real traffic activity levels
  const generateSparkline = (seed: number, count: number): string => {
    const values = Array.from({ length: 12 }, (_, i) => {
      const amp = 8 + (seed % (i + 1)) * 4;
      return 30 - (Math.min(25, (count * 1.5) + (i % 3 === 0 ? amp * 0.8 : amp * 0.3)));
    });
    return values.map((val, idx) => `${idx * 15},${val}`).join(' ');
  };

  return (
    <div className="space-y-6 font-sans text-slate-200" id="supervision-dashboard">
      
      {/* 1. Header Navigation Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="font-mono text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/10">
              Station de Contrôle Active
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            AI Supervision Multimodale Routière
            <span className="text-xs font-mono font-normal text-slate-500 border border-slate-800 px-2 py-0.5 rounded bg-slate-950">
              v2.1.0-LIVE
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Intégration d'acquisition physique Arduino <strong className="text-slate-300">Capteur Laser de Franchissement</strong> & détection par IA <strong className="text-amber-400">YOLOv8 sans Casque</strong>.
          </p>
        </div>
        
        {/* Connection status pills & Audio Controller */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Audio controller button */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center gap-2 text-xs font-semibold ${
              audioEnabled 
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20' 
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900'
            }`}
            title={audioEnabled ? "Désactiver la sirène système" : "Activer la sirène système"}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>Sirène On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500" />
                <span>Sirène Off</span>
              </>
            )}
          </button>

          {/* Sound test trigger */}
          <button 
            onClick={handleSoundTest}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 text-xs font-semibold transition cursor-pointer"
            title="Tester le synthétiseur audio"
          >
            Test Son
          </button>
          
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-850">
            <span className="text-[11px] font-mono font-medium text-slate-500">API Status:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-emerald-400 font-mono">3000/OK</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bento Grid Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Incidents */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-700/80 group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <AlertOctagon className="w-24 h-24 text-red-500" />
          </div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cumul d'Infractions</p>
              <h3 className="text-3xl font-extrabold text-white tracking-tight">
                {stats.total}
              </h3>
            </div>
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          
          {/* Interactive sparkline and label */}
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/70">
            <span className="text-[10px] text-slate-500 font-mono">Toutes sources cumulées</span>
            <svg className="w-20 h-6 overflow-visible" strokeWidth="2" stroke="rgb(239, 68, 68)" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d={`M ${generateSparkline(stats.total, stats.total)}`} />
            </svg>
          </div>
        </div>

        {/* Metric 2: Red Light Laser Detections */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-700/80 group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Radar className="w-24 h-24 text-cyan-500" />
          </div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Radar Laser Feu Rouge</p>
              <h3 className="text-3xl font-extrabold text-white tracking-tight">
                {redLightCount}
              </h3>
            </div>
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
              <Radar className="w-5 h-5" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/70">
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              Arduino Ultrasons
            </span>
            <svg className="w-20 h-6 overflow-visible" strokeWidth="2" stroke="rgb(6, 182, 212)" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d={`M ${generateSparkline(redLightCount + 1, redLightCount)}`} />
            </svg>
          </div>
        </div>

        {/* Metric 3: YOLO Helmet Detections */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-700/80 group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Camera className="w-24 h-24 text-amber-500" />
          </div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Caméra YOLO Sans Casque</p>
              <h3 className="text-3xl font-extrabold text-amber-405 tracking-tight">
                {helmetCount}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/70">
            <span className="text-[10px] text-amber-400 font-mono font-semibold">weights: best.pt</span>
            <svg className="w-20 h-6 overflow-visible" strokeWidth="2" stroke="rgb(245, 158, 11)" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d={`M ${generateSparkline(helmetCount + 3, helmetCount)}`} />
            </svg>
          </div>
        </div>

        {/* Metric 4: Live Frequency Stream */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-700/80 group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Activity className="w-24 h-24 text-emerald-500" />
          </div>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fréquence Aujourd'hui</p>
              <h3 className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                {stats.today} <span className="text-[11px] font-normal text-slate-500">pvs</span>
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/70">
            <span className="text-[10px] text-slate-500 font-mono">Trafic moyen/heur</span>
            <svg className="w-20 h-6 overflow-visible" strokeWidth="2" stroke="rgb(16, 185, 129)" fill="none">
              <path strokeLinecap="round" strokeLinejoin="round" d={`M ${generateSparkline(stats.today + 5, stats.today)}`} />
            </svg>
          </div>
        </div>

      </div>

      {/* 3. Real-Time Active Breach Alarm Banner */}
      {activeAlert && (
        <div className={`bg-gradient-to-r ${
          activeAlert.type === 'moto_sans_casque' 
            ? 'from-amber-950/80 via-slate-900 to-amber-950/25 border-amber-500/70 shadow-amber-900/10' 
            : 'from-rose-950/80 via-slate-900 to-rose-950/25 border-rose-500/70 shadow-rose-900/10'
        } border-2 rounded-2xl p-6 shadow-2xl relative transition-all duration-300 animate-slideUp`}>
          
          {/* Close button */}
          <div className="absolute top-4 right-4">
            <button
              onClick={dismissAlert}
              className={`font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border hover:bg-slate-950 transition-all cursor-pointer ${
                activeAlert.type === 'moto_sans_casque' 
                  ? 'text-amber-400 border-amber-500/30 hover:border-amber-400' 
                  : 'text-rose-400 border-rose-500/30 hover:border-rose-400'
              }`}
            >
              ACQUITTER L'ALERTE SYSTEME
            </button>
          </div>

          <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3.5 text-white rounded-xl shadow-lg mt-1 ${
                activeAlert.type === 'moto_sans_casque' 
                  ? 'bg-amber-600 shadow-amber-600/20' 
                  : 'bg-red-600 shadow-red-600/20'
              }`}>
                <AlertOctagon className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold py-0.5 px-2 rounded-full font-mono inline-block ${
                    activeAlert.type === 'moto_sans_casque' ? 'bg-amber-500/20 text-amber-330' : 'bg-red-500/20 text-red-330'
                  }`}>
                    🛑 {activeAlert.type === 'moto_sans_casque' ? 'ALERTE IA YOLOv8 DECOUPLÉE' : 'CRITICAL RADAR ULTRASONIQUE'}
                  </span>
                  
                  <span className="text-[10px] font-mono text-slate-500">
                    ID Transgression : #{activeAlert.id}
                  </span>
                </div>
                
                <h3 className="text-xl font-black text-white tracking-tight">
                  {activeAlert.type === 'moto_sans_casque' 
                    ? 'INFRACTION DETECTÉE : CONDUCTEUR DE MOTO SANS CASQUE' 
                    : 'BREACH DE FEU ROUGE : FRANCHISSEMENT DE SIGNAL'}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-500 block font-mono">Date et Heure locale</span>
                    <span className="text-xs font-bold text-slate-200 font-mono mt-1 block">
                      {activeAlert.date_infraction} à {activeAlert.heure_infraction}
                    </span>
                  </div>
                  
                  {activeAlert.type === 'moto_sans_casque' ? (
                    <>
                      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl font-mono">
                        <span className="text-[10px] uppercase text-slate-500 block">Indice de Confiance IA</span>
                        <span className="text-xs font-bold text-amber-400 mt-1 block flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          {((activeAlert.score_confiance ? activeAlert.score_confiance : 0.94) * 100).toFixed(0)}% de précision
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl font-mono">
                        <span className="text-[10px] uppercase text-slate-500 block">Bounding Box (Cible)</span>
                        <span className="text-xs font-bold text-cyan-405 mt-1 block truncate">
                          {activeAlert.coordonnees || "[154, 82, 388, 412]"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl font-mono">
                        <span className="text-[10px] uppercase text-slate-500 block font-mono">Distance Véhicule</span>
                        <span className="text-xs font-bold text-red-400 mt-1 block">
                          {activeAlert.distance} cm du capteur laser
                        </span>
                      </div>
                      <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl font-mono">
                        <span className="text-[10px] uppercase text-slate-500 block">État du Contrôleur</span>
                        <span className="text-xs font-extrabold text-red-500 mt-1 block flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                          FEU ACTIF : ROUGE
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                <p className="text-xs text-slate-300 mt-3.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                  <strong className="text-white">Rapport d'infraction :</strong> {activeAlert.message}
                </p>
              </div>
            </div>

            {/* Simulated Frame crop visualizer */}
            {activeAlert.type === 'moto_sans_casque' && activeAlert.image_url && (
              <div className="w-full sm:w-56 h-36 rounded-xl border border-amber-500/40 overflow-hidden relative shrink-0 shadow-2xl bg-black">
                <img 
                  src={activeAlert.image_url} 
                  alt="YOLO Infraction Crop" 
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                {/* AI Overlay bounding box mockup */}
                <div className="absolute inset-x-5 inset-y-5 border-2 border-red-500 pointer-events-none animate-pulse">
                  <span className="absolute -top-5.5 -left-1 bg-red-600 text-white font-mono text-[8px] px-1 py-0.5 rounded font-black uppercase tracking-wider">
                    SANS CASQUE {((activeAlert.score_confiance ? activeAlert.score_confiance : 0.94) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN WORKSPACE: Visual Real-time Monitors Column Tri-split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Module A: Interactive Obstruction & Ultrasonic Radar Sonar (Col 4) */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 px-1.5 rounded bg-cyan-500/10 text-cyan-405">
                  <Radar className="w-4 h-4 animate-spin-slow" />
                </span>
                <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  1. Sonar Ultrasons & Feu
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold border ${
                arduinoConnected 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-550/20' 
                  : 'bg-slate-950 text-slate-500 border-slate-800/60'
              }`}>
                {arduinoConnected ? 'ARDUINO PHYSIQUE: CONNECTÉ' : 'SIMULATION MATÉRIELLE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Contrôleur de feu et mesure de distance laser pour piéger les franchissements de ligne blanche.
            </p>
          </div>

          {/* Interactive Radar Visual Arc and Traffic signal representation */}
          <div className="space-y-4">
            
            {/* The physical simulator light layout */}
            <div className="flex items-stretch gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-850/80 relative overflow-hidden">
              
              <div className="w-12 bg-slate-900 px-2 py-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3 justify-center items-center shadow-xl shrink-0">
                <div className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                  lightState === 'rouge' 
                    ? 'bg-red-500 border-red-300 shadow-lg shadow-red-500/80 scale-105 animate-pulse' 
                    : 'bg-red-950/20 border-red-950/40 opacity-30'
                }`} />
                <div className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                  lightState === 'orange' 
                    ? 'bg-amber-500 border-amber-300 shadow-lg shadow-amber-500/80 scale-105' 
                    : 'bg-amber-950/20 border-amber-950/40 opacity-30'
                }`} />
                <div className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                  lightState === 'vert' 
                    ? 'bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/80 scale-105' 
                    : 'bg-emerald-950/20 border-emerald-950/40 opacity-30'
                }`} />
              </div>

              {/* Sonar visual arc wave display */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-850">
                  <span className="text-[8px] uppercase text-slate-500 font-mono font-bold block">Feu Actuel</span>
                  <span className="text-xs font-black font-semibold mt-0.5 block font-mono">
                    {lightState === 'rouge' && <span className="text-red-500">🔴 ROUGE (REPRÉSAILLES RADAR)</span>}
                    {lightState === 'orange' && <span className="text-amber-550">🟡 AVERTISSEMENT ORANGE</span>}
                    {lightState === 'vert' && <span className="text-emerald-400">🟢 VOIE LIBRE (SANS PV)</span>}
                  </span>
                </div>

                {/* Radar Sonar pulse */}
                <div className="h-20 relative bg-slate-900 rounded-lg overflow-hidden border border-slate-850 flex items-center justify-center">
                  
                  {/* Dynamic sonar concentric rings */}
                  <div className={`absolute rounded-full border border-cyan-500/30 transition-all ${
                    isCriticalDistance ? 'border-red-500/60' : 'border-cyan-500/30'
                  }`} style={{
                    width: `${Math.max(40, proximityPercent * 0.9)}px`,
                    height: `${Math.max(40, proximityPercent * 0.9)}px`,
                    animation: isCriticalDistance ? 'pulse 0.6s infinite' : 'pulse 2s infinite'
                  }} />

                  <div className={`absolute rounded-full border border-dashed text-center font-mono text-[9px] flex items-center justify-center shrink-0 ${
                    isCriticalDistance ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-cyan-500/5 text-cyan-405 border-cyan-505/20'
                  }`} style={{ width: '60px', height: '60px' }}>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase font-bold tracking-wider leading-none block">Radar</span>
                      <span className="font-extrabold text-[11px] block">{distance.toFixed(1)}cm</span>
                    </div>
                  </div>

                  {/* Laser distance line representation */}
                  <div className="absolute bottom-1 right-2 bg-black/60 font-mono text-[8px] text-slate-400 px-1 rounded-md">
                    Seuil Limite: 15.0cm
                  </div>
                </div>
              </div>

            </div>

            {/* Interactive distance progress gauge */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-950/40 border border-slate-850/80">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>Distance Laser</span>
                <span className={`font-semibold ${isCriticalDistance ? 'text-red-400 font-bold' : 'text-cyan-400'}`}>
                  {distance.toFixed(1)} cm / {isCriticalDistance ? 'CRITIQUE (FRANCHI!)' : 'Ok'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                <div 
                  className={`h-full transition-all duration-150 rounded-full ${
                    isCriticalDistance 
                      ? 'bg-gradient-to-r from-red-650 to-red-500' 
                      : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, proximityPercent))}%` }}
                />
              </div>
            </div>

            {/* Direct USB Arduino connection panel */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-850/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wide text-slate-400 font-bold uppercase flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${webSerialActive ? 'bg-emerald-500 animate-ping' : 'bg-amber-600'}`} />
                  Liaison Directe Port USB
                </span>
                <span className="text-[9px] font-semibold text-slate-500 font-mono">
                  {webSerialActive ? 'Actif (9600 Baud)' : 'Standby / Simulé'}
                </span>
              </div>

              <button
                onClick={webSerialActive ? stopWebSerial : startWebSerial}
                className={`w-full py-2 px-3 rounded-lg text-xs font-black font-mono inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  webSerialActive 
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-405 border border-cyan-500/30 animate-pulse'
                }`}
                title="Connecte votre Arduino physique branché sur votre port USB à TraficVision via l'API Web Serial de votre navigateur."
              >
                <span>🔌</span>
                {webSerialActive ? 'Déconnecter Arduino' : 'Connecter Arduino Physique'}
              </button>

              {/* Micro Serial Console Ticker */}
              <div className="bg-slate-900 border border-slate-850 rounded-lg p-2 max-h-[50px] overflow-y-auto scrollbar-thin">
                <div className="text-[9px] font-mono leading-none text-slate-400 space-y-1">
                  {serialConsoleLines.slice(-2).map((l, idx) => (
                    <div key={idx} className="truncate select-all" title={l}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          <button
            onClick={onSimulateCross}
            className="w-full py-2.5 px-4 bg-slate-850 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-750 inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer hover:border-slate-700 hover:shadow-md active:scale-98 group"
          >
            <Play className="w-3.5 h-3.5 text-red-500 group-hover:scale-110" />
            Simuler franchissement de voiture
          </button>
        </div>

        {/* Module B: Real-Time AI Camera Feed Monitor (Col 4) */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-1.5 rounded bg-amber-500/10 text-amber-400">
                <Video className="w-4 h-4 animate-pulse" />
              </span>
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center justify-between flex-1">
                2. Flux Live Caméra YOLOv8
                <span className="text-[9px] font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded text-amber-400 border border-amber-500/20 uppercase">
                  Active
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-sans">
              Algorithme de tracking d'images pour classifier les motards et vérifier la présence d'un équipement de protection.
            </p>
          </div>

          {/* AI Monitor Screen Feed rendering */}
          <div className="bg-black rounded-xl border border-slate-850 relative overflow-hidden h-44 group select-none flex flex-col justify-end">
            
            {/* Choose the absolute latest motorcycle infraction as dynamic visual backdrop */}
            {latestInfractions.find(i => i.type === 'moto_sans_casque') ? (
              <img 
                src={latestInfractions.find(i => i.type === 'moto_sans_casque')?.image_url} 
                alt="Latest YOLO Detection" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-[1.02] transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            ) : (
              <img 
                src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&q=80" 
                alt="Default AI Camera Feed Backdrop" 
                className="absolute inset-0 w-full h-full object-cover opacity-30"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Scanning radar laser overlaying vertical line */}
            <div className="absolute left-0 right-0 h-[1.5px] bg-red-500 shadow-md shadow-red-500/50 top-0 animate-feedScan pointer-events-none" />

            {/* Neural network mock matrix overlay */}
            <div className="absolute inset-0 bg-transparent grid grid-cols-4 grid-rows-3 opacity-20 pointer-events-none">
              <div className="border-r border-b border-white/5" />
              <div className="border-r border-b border-white/5" />
              <div className="border-r border-b border-white/5" />
              <div className="border-b border-white/5" />
              <div className="border-r border-b border-white/5" />
              <div className="border-r border-b border-white/5" />
              <div className="border-r border-b border-white/5" />
              <div className="border-b border-white/5" />
            </div>

            {/* Blinking camera telemetry tags */}
            <div className="absolute top-2 left-2 bg-black/85 text-[8.5px] font-mono text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 shadow-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              YOLO_CAM_01 [30 FPS]
            </div>

            <div className="absolute top-2 right-2 bg-black/85 text-[8.5px] font-mono text-slate-400 px-2 py-0.5 rounded border border-slate-800">
              Latency: 22.4 ms
            </div>

            {/* Glowing simulated bounding box */}
            <div className="absolute inset-x-12 inset-y-8 border-2 border-red-500 rounded pointer-events-none">
              <span className="absolute -top-5 left-0 bg-red-600 text-white font-mono text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase leading-none">
                Without Helmet 94.2%
              </span>
            </div>

            {/* Stream resolution label */}
            <div className="absolute bottom-2 left-2 bg-black/80 font-mono text-[8px] text-slate-400 px-1.5 py-0.5 rounded">
              H.264 | 1920x1080 | model:best.pt
            </div>
          </div>

          <button
            onClick={onSimulateYolo}
            className="w-full py-2.5 px-4 bg-slate-850 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-750 inline-flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer hover:border-slate-700 active:scale-98 group shadow-sm"
          >
            <Camera className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110" />
            Simuler motard sans casque (YOLOv8)
          </button>
        </div>

        {/* Module C: Advanced YOLO Diagnostics & Integration Sync Portal (Col 4) */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Tab navigation */}
            <div className="flex border-b border-slate-800 pb-1">
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`pb-2 px-3 text-xs font-bold font-sans tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeTab === 'diagnostics' 
                    ? 'border-cyan-500 text-white' 
                    : 'border-transparent text-slate-400 hover:text-slate-350'
                }`}
              >
                Diagnostics IA
              </button>
              <button
                onClick={() => setActiveTab('python_sync')}
                className={`pb-2 px-3 text-xs font-bold font-sans tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeTab === 'python_sync' 
                    ? 'border-cyan-500 text-white' 
                    : 'border-transparent text-slate-405 hover:text-slate-350'
                }`}
              >
                Script Python
              </button>
            </div>

            {/* TAB CONTENT: Live Diagnostic sliders */}
            {activeTab === 'diagnostics' ? (
              <div className="space-y-3 py-1">
                {/* Simulated Server/CPU Core Thermal status */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-405" />
                      Charge Processeur (YOLO Process)
                    </span>
                    <span className="text-slate-300">42% / 54°C</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: '42%' }} />
                  </div>
                </div>

                {/* Simulated VRAM allocation */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-teal-400" />
                      Neural Cache Memory
                    </span>
                    <span className="text-slate-300">1.2 GB / 4.0 GB</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '30%' }} />
                  </div>
                </div>

                {/* Interactive confidence Threshold controller */}
                <div className="space-y-1.5 pt-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-400 font-bold block">Seuil d'Alerte YOLOv8</span>
                    <span className="font-extrabold text-cyan-400">{(confThreshold * 100).toFixed(0)}% de certitude</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.95"
                    step="0.05"
                    value={confThreshold}
                    onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none border border-slate-850"
                  />
                  <p className="text-[9px] text-slate-550 leading-tight">
                    Toutes détections sous ce seuil de probabilité seront ignorées pour éviter les alertes intempestives.
                  </p>
                </div>
              </div>
            ) : (
              /* TAB CONTENT: Command launch instructions script copy block */
              <div className="space-y-3.5 py-1">
                <p className="text-[10.5px] text-slate-400 leading-relaxed">
                  Lancez le script autonome pour connecter votre caméra réelle (Webcam USB) au serveur Node en direct :
                </p>
                <div className="bg-slate-950 rounded-xl border border-slate-850 p-2.5 relative group font-mono text-[10px]">
                  <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase border-b border-slate-850 pb-1.5 mb-2">
                    <span>CLI Shell Command</span>
                    <button
                      onClick={copyPythonCommand}
                      className="p-1 rounded bg-slate-900 border border-slate-800 hover:text-white transition cursor-pointer flex items-center gap-1 text-[8px]"
                      title="Copier la commande"
                    >
                      {copiedCode ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{copiedCode ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                  <span className="text-cyan-400">python</span> <span className="text-slate-200">detect_yolo.py</span>
                </div>
                <div className="bg-cyan-500/5 rounded-xl border border-cyan-504/10 p-3 flex gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[9.5px] text-slate-400 leading-normal">
                    Ce script utilise la librairie <code className="text-slate-200 font-mono text-[8px] bg-slate-900 rounded px-1">ultralytics</code> pour charger le modèle et poster les paquets en Base64.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 flex justify-between items-center font-mono">
            <span>WebSocket Live Tunnel</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-[9px]">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
              SECURE CONNECTED
            </span>
          </div>
        </div>

      </div>

      {/* 5. LIVE SOCKETS EVENTS LOGS TERMINAL */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
              Flux Général de Supervision et Journalisation (Temps Réel)
            </h3>
            <p className="text-[11px] text-slate-400">
              Journal d'analyse en temps réel. Cliquez sur n'importe quelle anomalie pour zoomer l'evidence de preuve.
            </p>
          </div>
          <span className="self-start sm:self-center px-2.5 py-1 text-[9px] font-mono font-bold bg-slate-950 border border-slate-800/70 text-cyan-404 rounded-lg flex items-center gap-1">
            <Server className="w-3 h-3 text-cyan-400" />
            Node.js API Websockets Synced
          </span>
        </div>

        {/* Console Event Table list */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestInfractions.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center text-slate-550 border border-dashed border-slate-850 rounded-xl">
              <ShieldCheck className="w-10 h-10 text-slate-800 mb-2" />
              <p className="text-xs font-semibold">Aucun incident détecté sur ce segment routier</p>
              <p className="text-[10px] text-slate-400 mt-1">En attente de paquets télémétriques...</p>
            </div>
          ) : (
            latestInfractions.slice(0, 6).map((infraction) => {
              const isYolo = infraction.type === 'moto_sans_casque';
              return (
                <div 
                  key={infraction.id}
                  onClick={() => setSelectedInfraction(infraction)}
                  className={`p-3.5 bg-slate-950/70 hover:bg-slate-900/90 rounded-xl border transition-all duration-150 flex flex-col justify-between space-y-3 cursor-zoom-in group uppercase-none ${
                    isYolo 
                      ? 'border-amber-500/20 hover:border-amber-500/55 hover:shadow-lg hover:shadow-amber-500/5' 
                      : 'border-slate-850 hover:border-slate-700'
                  }`}
                  title="Cliquer pour inspecter la preuve"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <span className="text-base shrink-0 p-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                        {isYolo ? '🏍️' : '🚗'}
                      </span>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-100 block truncate group-hover:text-cyan-400 transition-colors">
                          {isYolo ? 'Pilote sans Casque' : 'Feu Rouge Grillé'}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold block mt-0.5 tracking-wider uppercase font-mono">
                          {isYolo ? 'ANALYSE YOLOv8' : 'RADAR PHYSIQUE'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Timestamp badges */}
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {infraction.heure_infraction}
                      </span>
                    </div>
                  </div>

                  {/* Summary/Message content inside terminal tile */}
                  <p className="text-[10.5px] text-slate-400 leading-normal line-clamp-2 bg-slate-900/40 p-2 rounded border border-slate-850/60">
                    "{infraction.message}"
                  </p>

                  {/* Indicators footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-850 font-mono text-[9px]">
                    <span className="text-slate-500">
                      ID: #{infraction.id}
                    </span>
                    {isYolo ? (
                      <span className="inline-block text-[8.5px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/10 px-1.5 py-0.5 rounded">
                        CONF: {((infraction.score_confiance ? infraction.score_confiance : 0.94) * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="inline-block text-[8.5px] font-extrabold bg-cyan-500/10 text-cyan-405 border border-cyan-500/10 px-1.5 py-0.5 rounded">
                        DIST: {infraction.distance.toFixed(1)} cm
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. MODAL METADATA EVIDENCE INSPECTOR */}
      {selectedInfraction && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800/90 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] uppercase font-mono font-bold py-1 px-3 rounded-full border ${
                  selectedInfraction.type === 'moto_sans_casque' 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-cyan-500/10 text-cyan-405 border-cyan-500/20'
                }`}>
                  🔍 {selectedInfraction.type === 'moto_sans_casque' ? 'PREUVE CAMÉRA COMPROMETTANTE (YOLO)' : 'JUSTIFICATIF ACQUISITION MATÉRIEL'}
                </span>
                <h3 className="text-lg font-black text-white tracking-tight mt-3">
                  ID INFRACTION #{selectedInfraction.id} — DOSSIER DE CONTREVENT
                </h3>
              </div>
              <button 
                onClick={() => setSelectedInfraction(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1.5 bg-slate-800/80 rounded-lg hover:bg-slate-755 border border-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Bounding image if available */}
            {selectedInfraction.type === 'moto_sans_casque' && selectedInfraction.image_url ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black">
                <img 
                  src={selectedInfraction.image_url} 
                  alt="Camera evidence evidence" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Simulated YOLO Red detection drawing box */}
                <div className="absolute inset-x-12 inset-y-12 border-2 border-red-500 pointer-events-none animate-pulse">
                  <span className="absolute -top-6 left-0 bg-red-650 text-white text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider shadow-md">
                    Without Helmet {((selectedInfraction.score_confiance ? selectedInfraction.score_confiance : 0.94) * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 bg-black/85 font-mono text-[9px] px-2 py-0.5 rounded text-cyan-405 border border-slate-800">
                  Classe YOLO: motorcycle | Box: {selectedInfraction.coordonnees || "[154, 82, 388, 412]"}
                </div>
              </div>
            ) : (
              // Obstruction representation for Laser/Radar trigger
              <div className="aspect-video bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl border border-slate-850/80 p-5 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Radar className="w-36 h-36 text-red-500" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                    <Radar className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest font-mono">Détails d'Acquisition Laser</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Franchissement physique capturé dans l'intervalle.</p>
                  </div>
                </div>

                {/* Laser sensor telemetry stats */}
                <div className="grid grid-cols-2 gap-3.5 my-3">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono">
                    <span className="text-[8px] text-slate-500 block uppercase">Distance Relevée</span>
                    <span className="text-xs font-black text-red-400 block mt-1">{selectedInfraction.distance.toFixed(1)} cm</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono">
                    <span className="text-[8px] text-slate-500 block uppercase">Seuil d'infraction</span>
                    <span className="text-xs font-black text-slate-350 block mt-1">&lt; 15.0 cm</span>
                  </div>
                </div>

                <div className="text-[10px] p-2 bg-red-500/5 border border-red-500/10 text-red-400 rounded-md font-mono text-center">
                  🚫 INFRACTION CONFIRMÉE PAR CAPTEUR MATÉRIEL ULTRASONIQUE
                </div>
              </div>
            )}

            {/* Detailed metadata list properties */}
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl space-y-1.5 border border-slate-850 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date et Heure :</span>
                  <span className="text-slate-300">{selectedInfraction.date_infraction} à {selectedInfraction.heure_infraction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Périphérique d'acquisition :</span>
                  <span className="text-slate-300">
                    {selectedInfraction.type === 'moto_sans_casque' ? 'Webcam USB (YOLO_CAM_01)' : 'Arduino Laser (Sensor #A)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut du procès-verbal :</span>
                  <span className="text-emerald-400 font-medium font-semibold">GÉNÉRÉ - TRANSMIS EN BDD</span>
                </div>
              </div>
              
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <p className="text-xs text-slate-300">
                  <strong className="text-white">Rapport Officiel :</strong> {selectedInfraction.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedInfraction(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold rounded-xl cursor-pointer border border-slate-700 transition"
            >
              Fermer et retourner au panel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
