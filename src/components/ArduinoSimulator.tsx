import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Settings, 
  HelpCircle, 
  Sliders, 
  Wifi, 
  Radio, 
  CheckCircle,
  Play,
  RotateCcw,
  Terminal,
  Send,
  Usb,
  Code,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react';
import { SimulatorState } from '../types';
import { apiService } from '../services/apiService';

interface ArduinoSimulatorProps {
  lightState: 'rouge' | 'orange' | 'vert';
  setLightState: React.Dispatch<React.SetStateAction<'rouge' | 'orange' | 'vert'>>;
  distance: number;
  setDistance: (dist: number) => void;
  triggerViolation: (dist: number) => void;
  socketHeartbeat: () => void;
  webSerialActive: boolean;
  startWebSerial: () => void;
  stopWebSerial: () => void;
  serialConsoleLines: string[];
  setSerialConsoleLines: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function ArduinoSimulator({
  lightState,
  setLightState,
  distance,
  setDistance,
  triggerViolation,
  socketHeartbeat,
  webSerialActive,
  startWebSerial,
  stopWebSerial,
  serialConsoleLines,
  setSerialConsoleLines
}: ArduinoSimulatorProps) {
  
  const [autoMode, setAutoMode] = useState(true);
  const [threshold, setThreshold] = useState(15.0); // cm threshold
  const [isDriving, setIsDriving] = useState(false);
  const [carPosition, setCarPosition] = useState(100); // 100% (off road to the right)
  
  const [serialStatus, setSerialStatus] = useState({
    enabled: false,
    port: '/dev/ttyACM0',
    baudRate: 9600,
    isListening: false
  });

  const [customSerialFrame, setCustomSerialFrame] = useState(
    '{"type": "infraction", "lightState": "rouge", "distance": 8.5, "message": "Véhicule en effraction au feu rouge"}'
  );

  const [copiedText, setCopiedText] = useState(false);

  const autoModeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch Serial Connection configuration details
  const fetchSerialStatus = async () => {
    try {
      const data = await apiService.get('/api/serial/status');
      setSerialStatus(data);
    } catch (e) {
      console.warn("Erreur chargement statut Port Série:", e);
    }
  };

  useEffect(() => {
    fetchSerialStatus();
    const interval = setInterval(fetchSerialStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Post serial line over API
  const sendSerialFrame = async (frameText: string) => {
    try {
      const data = await apiService.post('/api/serial/simulate', { line: frameText });
      if (data.success) {
        setSerialConsoleLines(prev => [
          ...prev,
          `[TX SUCCESS - ${new Date().toLocaleTimeString()}] : ${frameText}`
        ]);
        
        // If it's a status frame, immediately reflect lightState inside the UI simulator
        try {
          const parsed = JSON.parse(frameText);
          if (parsed.type === 'status' && parsed.lightState) {
            setLightState(parsed.lightState);
          }
        } catch (e) {}
      } else {
        setSerialConsoleLines(prev => [
          ...prev,
          `[UX ERROR - PORT BLOCK] Statut: ${data.message}`
        ]);
      }
    } catch (err: any) {
      setSerialConsoleLines(prev => [
        ...prev,
        `[COMM ERROR] Connexion impossible à l'API: ${err.message}`
      ]);
    }
  };

  // Scroll terminal to view
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialConsoleLines]);

  // Send periodic heartbeat to server to prove Arduino simulator is connected
  useEffect(() => {
    // Send immediate heartbeat
    socketHeartbeat();
    
    // Pulse connection heartbeat every 4 seconds
    const interval = setInterval(() => {
      socketHeartbeat();
    }, 4000);

    return () => clearInterval(interval);
  }, [socketHeartbeat]);

  // Traffic Light auto cycling simulation
  useEffect(() => {
    if (!autoMode) {
      if (autoModeTimerRef.current) {
        clearInterval(autoModeTimerRef.current);
      }
      return;
    }

    const runCycle = () => {
      setLightState('vert');
      
      let nextState: 'rouge' | 'orange' | 'vert' = 'vert';
      const cycleInterval = setInterval(() => {
        setLightState(prev => {
          if (prev === 'vert') {
            return 'orange';
          } else if (prev === 'orange') {
            return 'rouge';
          } else {
            return 'vert';
          }
        });
      }, 5000);

      autoModeTimerRef.current = cycleInterval;
    };

    runCycle();

    return () => {
      if (autoModeTimerRef.current) {
        clearInterval(autoModeTimerRef.current);
      }
    };
  }, [autoMode, setLightState]);

  // Trigger violation immediately if distance drops below threshold while light is RED
  const handleDistanceChange = (newVal: number) => {
    setDistance(newVal);
    if (lightState === 'rouge' && newVal < threshold) {
      // Prevent rapid fire triggers by debouncing or simple state gate
      triggerViolation(newVal);
    }
  };

  // Visual Car Driving Simulation across the road track
  const driveCarAcross = () => {
    if (isDriving) return;
    setIsDriving(true);
    setCarPosition(100); // start at right side of road

    let pos = 100;
    const driveInterval = setInterval(() => {
      pos -= 2;
      setCarPosition(pos);
      
      // Calculate simulated ultrasonic distance as the car gets closer to sensor
      // Sensor is located at position 35% on the road track
      // As car reaches 35%, measured distance drops
      const distanceFromSensor = Math.abs(pos - 35) + 3; // +3cm baseline offset
      
      // Feed live distance reading to simulator
      if (pos > 15 && pos < 70) {
        setDistance(Number(distanceFromSensor.toFixed(1)));
      }

      // Check for infraction when car crosses sensor zone (pos ~35)
      if (pos <= 38 && pos >= 32) {
        if (lightState === 'rouge') {
          triggerViolation(Number(distanceFromSensor.toFixed(1)));
        }
      }

      // Finish drive
      if (pos <= -15) {
        clearInterval(driveInterval);
        setIsDriving(false);
        setCarPosition(100);
        setDistance(32.4); // restore standard resting distance
      }
    }, 45); // smooth drive animation steps
  };

  return (
    <div className="space-y-6 font-sans text-slate-200">
      
      {/* Tab Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Console de Simulation Matérielle</h2>
        <p className="text-xs text-slate-400 mt-1">
          Simulateur interactif pour tester l'intégration de l'Arduino UNO, des LEDs et du capteur ultrason sans équipement reel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Interactive Playground Box - 7 Columns */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Virtual Road crosswalk simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
              Route de Test Virtuelle & Capteur de Franchissement (Radar)
            </h3>
            
            {/* The actual Road */}
            <div className="relative h-28 bg-slate-950 border-y-2 border-slate-700/60 flex items-center rounded-lg overflow-hidden">
              
              {/* Lane markings (dashes) */}
              <div className="absolute inset-x-0 h-0.5 border-t border-dashed border-slate-500 opacity-60" />
              
              {/* Traffic Crossing White Band lines (Effet de passage piéton) */}
              <div className="absolute left-[38%] inset-y-0 w-8 flex flex-col justify-between py-1 bg-slate-950">
                <div className="h-2 w-full bg-slate-200" />
                <div className="h-2 w-full bg-slate-200" />
                <div className="h-2 w-full bg-slate-200" />
                <div className="h-2 w-full bg-slate-200" />
                <div className="h-2 w-full bg-slate-200" />
                <div className="h-2 w-full bg-slate-200" />
              </div>

              {/* Red-light Stop Line marker */}
              <div className="absolute left-[36%] inset-y-0 w-1 bg-red-500 shadow-lg shadow-red-500/50" />

              {/* Simulated Ultrasonic Sensor Field (Visual Cone) */}
              <div className={`absolute left-[20%] right-[60%] inset-y-0 bg-cyan-500/5 border-x border-dashed border-cyan-500/10 transition-all ${
                lightState === 'rouge' ? 'bg-red-500/10 border-red-500/20' : ''
              }`} />

              {/* The sensor hardware miniature icon */}
              <div className="absolute left-[34%] top-1.5 -translate-x-1/2 p-1.5 bg-slate-900 border border-slate-700 rounded-md flex gap-1 z-10" title="Capteur Ultrason HC-SR04">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 block" />
              </div>

              {/* The physical traffic lights miniature */}
              <div className="absolute left-[40%] top-2 z-10 p-1.5 bg-slate-900 border border-slate-700 rounded-md flex gap-1 items-center">
                <span className={`w-2.5 h-2.5 rounded-full block ${lightState === 'rouge' ? 'bg-red-500 animate-pulse' : 'bg-red-950'}`} />
                <span className={`w-2.5 h-2.5 rounded-full block ${lightState === 'orange' ? 'bg-amber-500 animate-pulse' : 'bg-amber-950'}`} />
                <span className={`w-2.5 h-2.5 rounded-full block ${lightState === 'vert' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-950'}`} />
              </div>

              {/* Simulated Moving Car */}
              <div 
                className="absolute w-14 h-8 bg-red-600 rounded-lg shadow-md flex items-center justify-center border border-red-500 font-bold text-[10px] text-white transition-all cursor-crosshair z-20"
                style={{ left: `${carPosition}%` }}
              >
                🚙
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[11px] text-slate-400 leading-normal">
                Cliquez pour démarrer la voiture. Elle accélèrera sur la voie de test et franchira le feu tricolore à hauteur du capteur à ultrasons.
              </span>
              <button
                onClick={driveCarAcross}
                disabled={isDriving}
                className="px-5 py-2.5 bg-red-650 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shrink-0 transition-all cursor-pointer shadow-lg shadow-red-900/10"
              >
                <Play className="w-3.5 h-3.5" />
                Lancer une voiture 🚗
              </button>
            </div>
          </div>

          {/* Graphical hardware view - Schematic Mock of Arduino Uno + Breadboard */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-lg">
            
            {/* Visual Chip Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-6">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Schéma Électronique Interactif (Virtuel)
            </h3>

            <div className="flex flex-col md:flex-row items-center justify-around gap-8">
              
              {/* Virtual Arduino Uno Design Board */}
              <div className="w-68 bg-[#0d3460] border-2 border-[#12589e] rounded-2xl p-4.5 text-slate-100 flex flex-col justify-between h-50 relative shadow-2xl">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] bg-slate-900/60 p-1 rounded border border-blue-500/20 font-bold font-mono tracking-wider">ARDUINO UNO R3</span>
                    <div className="flex gap-1.5 font-mono text-[9px] text-[#2de9b6] items-center">
                      <Wifi className="w-3.5 h-3.5 animate-pulse" />
                      <span>TX : RX</span>
                    </div>
                  </div>
                  
                  {/* IC Microcontroller Chip visual */}
                  <div className="w-40 bg-zinc-900 border border-zinc-700 h-8 rounded mt-4.5 flex p-1 items-center justify-between font-mono text-[7px] text-zinc-500 pr-1 overflow-hidden select-none">
                    <span>||||||||||||||||||||</span>
                    <span className="text-zinc-300 font-bold text-[8px]">ATmega328P</span>
                    <span>||||||||||||||||||||</span>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    <span className="text-[8px] font-mono text-slate-300">POWER (5V)</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest">Digital IO Ports</span>
                </div>
              </div>

              {/* Virtual Prototype Solderless Breadboard */}
              <div className="flex-1 w-full bg-zinc-100 border border-zinc-300 pr-6 pl-6 py-5 rounded-xl shadow-lg text-zinc-800 space-y-4">
                <span className="text-[9px] font-bold font-mono tracking-wider text-zinc-400 uppercase">Prototyping Breadboard</span>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  
                  {/* LED Module */}
                  <div className="p-3 bg-zinc-200/60 border border-zinc-300 rounded-lg flex flex-col items-center">
                    <span className="text-[9px] font-bold text-zinc-500 font-mono">Simulateur Modules LED</span>
                    
                    <div className="flex gap-2.5 mt-3">
                      <div className={`w-6 h-6 rounded-full border border-zinc-300 transition-all ${
                        lightState === 'rouge' 
                          ? 'bg-red-500 shadow-md shadow-red-500/70' 
                          : 'bg-red-950/20'
                      }`} />
                      <div className={`w-6 h-6 rounded-full border border-zinc-300 transition-all ${
                        lightState === 'orange' 
                          ? 'bg-amber-500 shadow-md shadow-amber-500/70' 
                          : 'bg-amber-950/20'
                      }`} />
                      <div className={`w-6 h-6 rounded-full border border-zinc-300 transition-all ${
                        lightState === 'vert' 
                          ? 'bg-emerald-500 shadow-md shadow-emerald-500/70' 
                          : 'bg-emerald-950/20'
                      }`} />
                    </div>
                  </div>

                  {/* Ultrasonic module HC-SR04 */}
                  <div className="p-3 bg-zinc-200/60 border border-zinc-300 rounded-lg flex flex-col items-center justify-between">
                    <span className="text-[9px] font-bold text-zinc-500 font-mono">HC-SR04 Ultrasonic</span>
                    <div className="flex justify-center gap-3.5 mt-1">
                      {/* Cylinders */}
                      <div className="w-8 h-8 rounded-full bg-zinc-400 border-2 border-cyan-400 flex items-center justify-center text-[7px] text-zinc-850 font-bold select-none shadow-sm font-mono">TRIG</div>
                      <div className="w-8 h-8 rounded-full bg-zinc-400 border-2 border-cyan-400 flex items-center justify-center text-[7px] text-zinc-850 font-bold select-none shadow-sm font-mono">ECHO</div>
                    </div>
                  </div>

                  {/* Distance Sensor Live metric */}
                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg flex flex-col justify-center">
                    <span className="text-[8px] font-mono font-bold text-cyan-400 uppercase tracking-widest">Valeur Virtuelle</span>
                    <div className="text-lg font-bold font-mono mt-1 text-slate-50">
                      {distance.toFixed(1)} <span className="text-[10px] text-slate-400">cm</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Active Controllers - 4 Columns */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 border-b border-slate-850 pb-3">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Panneau de Réglages
          </h3>

          {/* Mode switch */}
          <div className="space-y-2">
            <span className="text-[10.5px] text-slate-400 font-mono uppercase font-semibold">Mode de fonctionnement</span>
            
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-850 rounded-lg">
              <button
                onClick={() => setAutoMode(true)}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  autoMode 
                    ? 'bg-red-650 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Auto-Cycle LED
              </button>
              <button
                onClick={() => setAutoMode(false)}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  !autoMode 
                    ? 'bg-red-650 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Contrôle Manuel
              </button>
            </div>
          </div>

          {/* Manual LED state togglers (Active only if manual mode enabled) */}
          <div className={`space-y-2.5 transition-all ${autoMode ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <span className="text-[10.5px] text-slate-400 font-mono uppercase font-semibold block">Changer l'état manuellement</span>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setLightState('rouge')}
                className={`w-full py-2.5 px-4 font-bold text-xs uppercase rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  lightState === 'rouge' 
                    ? 'bg-red-500/20 text-red-400 border-red-500 shadow-md shadow-red-500/5' 
                    : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-800'
                }`}
              >
                🔴 FEU ROUGE
              </button>

              <button
                onClick={() => setLightState('orange')}
                className={`w-full py-2.5 px-4 font-bold text-xs uppercase rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  lightState === 'orange' 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-md shadow-amber-500/5' 
                    : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-800'
                }`}
              >
                🟡 FEU ORANGE
              </button>

              <button
                onClick={() => setLightState('vert')}
                className={`w-full py-2.5 px-4 font-bold text-xs uppercase rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  lightState === 'vert' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-500/5' 
                    : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-800'
                }`}
              >
                🟢 FEU VERT
              </button>
            </div>
            {autoMode && (
              <span className="text-[9.5px] text-slate-500 italic">Désactivez le mode Auto pour tester le manuel</span>
            )}
          </div>

          {/* Ultrasonic distance Slider */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono uppercase font-semibold">
              <span>Ajuster capteur ultrason</span>
              <span className="text-cyan-400 font-bold">{distance.toFixed(1)} cm</span>
            </div>
            
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={distance}
              onChange={(e) => handleDistanceChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>Proche (2cm)</span>
              <span>Éloigné (40cm)</span>
            </div>
          </div>

          {/* Setting custom Infraction Threshold */}
          <div className="space-y-3 pt-2 border-t border-slate-850">
            <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono uppercase font-semibold animate-pulse">
              <span>Seuil de Détection</span>
              <span className="text-red-400 font-bold">{threshold} cm</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-2.5 border border-slate-850 rounded-lg">
              <input
                type="number"
                min="5"
                max="30"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 15.0)}
                className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-center text-slate-100 font-mono focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 font-sans">
                Seuil de franchissement (Si la voiture passe plus près que cette valeur au feu rouge).
              </span>
            </div>
          </div>

          {/* Clear simulator state */}
          <button
            onClick={() => {
              setDistance(32.4);
              setLightState('vert');
              setAutoMode(true);
            }}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg border border-slate-850 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser le simulateur
          </button>
        </div>

      </div>

      {/* NEW section : Real-Time Serial Monitor Interface */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Moniteur de Port Série USB (Arduino Real-Time)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Testez et observez la réception brute de trames de l'Arduino en format JSON via la liaison série.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real Web Serial Native Connection block */}
            <button
              onClick={webSerialActive ? stopWebSerial : startWebSerial}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                webSerialActive 
                  ? 'bg-rose-650 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/10 border border-rose-600' 
                  : 'bg-cyan-650 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-900/10 border border-cyan-600'
              }`}
              title="Connecte votre Arduino physique branché sur votre port USB à TraficVision via l'API Web Serial de votre navigateur."
            >
              <Usb className="w-3.5 h-3.5 animate-pulse" />
              {webSerialActive ? 'Déconnecter Arduino Physique' : '🔌 Lire Port Série physique (ex: /dev/cu.usbserial-10)'}
            </button>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
              <div className="text-[11px] font-mono">
                Port USB: <span className="text-slate-200 font-bold">{webSerialActive ? 'Actif (/dev/cu.usbserial-10)' : 'Simulé'}</span> | Baud: <span className="text-slate-200 font-bold">9600</span>
              </div>
              <span className={`h-2 w-2 rounded-full ml-1.5 ${webSerialActive || serialStatus.isListening ? 'bg-emerald-500 animate-ping' : 'bg-amber-600'}`} />
              <span className="text-[10px] font-semibold text-slate-300">
                {webSerialActive ? 'Connecté Direct' : 'Standby'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Triggers and settings */}
          <div className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Injecter / Simuler Trames Série (JSON)
            </h4>
            <p className="text-xs text-slate-300 leading-normal">
              Utilisez les préréglages ou saisissez une trame JSON personnalisée pour simuler un signal électrique reçu de l'Arduino.
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => sendSerialFrame('{"type": "status", "lightState": "rouge", "distance": 18.2}')}
                className="p-2.5 bg-slate-950 hover:bg-slate-855 border border-slate-800 rounded-lg text-[11px] text-slate-450 hover:text-red-400 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                🔴 status (Feu rouge, 18cm)
              </button>
              <button
                onClick={() => sendSerialFrame('{"type": "status", "lightState": "vert", "distance": 32.5}')}
                className="p-2.5 bg-slate-950 hover:bg-slate-855 border border-slate-800 rounded-lg text-[11px] text-slate-450 hover:text-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                🟢 status (Feu vert, 32cm)
              </button>
              <button
                onClick={() => sendSerialFrame('{"type": "infraction", "lightState": "rouge", "distance": 5.2, "message": "Feu rouge brûlé brutalement !"}')}
                className="p-2.5 bg-red-950/20 hover:bg-red-950/30 border border-red-900/30 rounded-lg text-[11px] text-red-300 text-left font-mono transition-all flex items-center gap-1.5 cursor-pointer sm:col-span-2"
              >
                ⚠️ infraction (Franchissement à 5.2cm)
              </button>
            </div>

            {/* Custom Frame builder block */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] text-slate-400 font-mono uppercase block font-bold block">
                Trame brute personnalisée (Format JSON requis)
              </label>
              <textarea
                rows={3}
                value={customSerialFrame}
                onChange={(e) => setCustomSerialFrame(e.target.value)}
                className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg p-3 text-emerald-400 focus:outline-none focus:border-slate-700"
              />
              <button
                onClick={() => sendSerialFrame(customSerialFrame)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/30 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Transmettre la trame au décodeur USB 🔌
              </button>
            </div>
          </div>

          {/* Right Column: Serial Monitor Console output */}
          <div className="lg:col-span-7 flex flex-col h-76 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-2xl relative">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-950 flex justify-between items-center select-none shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-mono text-slate-400 font-bold ml-2">Console Série (9600 Baud)</span>
              </div>
              <button
                onClick={() => setSerialConsoleLines([`-- Console réinitialisée le ${new Date().toLocaleTimeString()}`])}
                className="text-[10px] bg-slate-950 hover:bg-slate-850 text-slate-400 px-2 py-1 rounded border border-slate-800 transition-all font-mono cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Terminal screen */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-emerald-400 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
              {serialConsoleLines.map((line, idx) => (
                <div key={idx} className="leading-relaxed border-b border-slate-900/45 pb-1 flex items-start gap-1">
                  <span className="text-slate-600 select-none">&gt;&gt;</span>
                  <span className={line.startsWith('[ERROR') || line.startsWith('[COMM') ? 'text-rose-400' : line.includes('infraction') ? 'text-amber-400 font-bold' : ''}>
                    {line}
                  </span>
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
          </div>
        </div>

        {/* Arduino INO Script Resource Section */}
        <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h4 className="text-xs font-mono font-bold text-[#4facfe] uppercase tracking-wider flex items-center gap-1.5">
              <Code className="w-4 h-4" />
              Code Source Arduino UNO requis (.INO)
            </h4>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`// Code Arduino UNO pour l'envoi de trames JSON en temps réel
#include <ArduinoJson.h> // Requiert la bibliothèque ArduinoJson sous IDE (v6+)

const int TRIG_PIN = 9;   // HC-SR04 Trigger Pin
const int ECHO_PIN = 10;  // HC-SR04 Echo Pin
const int LED_ROUGE = 5;  // LED Rouge de contrôle
const int INT_THRESHOLD = 15; // Seuil d'infraction en cm

void setup() {
  Serial.begin(9600); // Vitesse configurée à 9600 bauds
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_ROUGE, OUTPUT);
}

void loop() {
  // 1. Lire la distance du capteur ultrason
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);
  float distance = duration * 0.034 / 2;

  // Détection de l'état du feu (exemple de simulation interne ou de fils d'entrée)
  bool isRed = digitalRead(LED_ROUGE);

  // 2. Envoyer périodiquement l'état brut
  StaticJsonDocument<200> doc;
  doc["type"] = "status";
  doc["lightState"] = isRed ? "rouge" : "vert";
  doc["distance"] = distance;
  
  serializeJson(doc, Serial);
  Serial.println(); // Retour à la ligne pour le décodeur de l'API (\\r\\n)

  // 3. Si franchissement de la ligne au feu rouge : Alerter en temps réel
  if (isRed && distance < INT_THRESHOLD) {
    StaticJsonDocument<200> infDoc;
    infDoc["type"] = "infraction";
    infDoc["lightState"] = "rouge";
    infDoc["distance"] = distance;
    infDoc["message"] = "Franchissement non autorisee (Feu rouge grille !)";
    
    serializeJson(infDoc, Serial);
    Serial.println(); // Retour à la ligne pour le décodeur
    delay(2000); // Anti-rebond temporisation
  }

  delay(200); // Cadence d'échantillonnage de 5Hz
}`);
                setCopiedText(true);
                setTimeout(() => setCopiedText(false), 2000);
              }}
              className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition-all shrink-0 uppercase font-mono font-bold"
            >
              {copiedText ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copiedText ? 'Copié' : 'Copier de script .ino'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Téléversez ce programme C++ sur votre microcontrôleur Arduino UNO. Le port série de l'API Node.js lira instantanément le flux de messages au format JSON, enregistrera de manière sécurisée chaque détection dans la base de données via <strong>mysql2 (PDO)</strong>, et alertera instantanément l'interface graphique en temps réel grâce à <strong>Socket.io</strong>.
          </p>

          <pre className="bg-slate-950/80 p-4 rounded-lg text-[11px] font-mono text-cyan-300 leading-relaxed overflow-x-auto border border-slate-900 select-all">
{`void loop() {
  // Emission de trame infraction en JSON brut sur la liaison de communication série USB
  Serial.print("{\\"type\\": \\"infraction\\", \\"lightState\\": \\"rouge\\", \\"distance\\": ");
  Serial.print(distance);
  Serial.println(", \\"message\\": \\"Franchissement radar ultrason\\"}");
}`}
          </pre>
        </div>
      </div>

    </div>
  );
}
