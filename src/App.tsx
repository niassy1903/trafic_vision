import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Menu, X, ShieldAlert } from 'lucide-react';
import { apiService } from './services/apiService';

import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InfractionList from './components/InfractionList';
import StatsView from './components/StatsView';
import ArduinoSimulator from './components/ArduinoSimulator';
import SetupInstructions from './components/SetupInstructions';
import SettingsView from './components/SettingsView';

import { Infraction, Stats, SystemStatus } from './types';

export default function App() {
  const [currentTab, setTab] = useState<string>('dashboard');
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, week: 0, month: 0 });
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ status: 'online', arduinoConnected: false });
  const [lightState, setLightState] = useState<'rouge' | 'orange' | 'vert'>('vert');
  const [distance, setDistance] = useState<number>(32.4); // cm resting state
  const [activeAlert, setActiveAlert] = useState<Infraction | null>(null);
  
  // Mobile UI Sidebar state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Web Serial API references and state guides
  const [webSerialActive, setWebSerialActive] = useState(false);
  const [serialConsoleLines, setSerialConsoleLines] = useState<string[]>([
    '-- En attente de connexion de l\'Arduino Physique ou de trames émulées par liaison série...'
  ]);
  const serialReaderRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const keepReadingRef = useRef(true);
  const lastInfractionTimeRef = useRef<number>(0);

  // Auto clean-up Web Serial connections on component unmount
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      try {
        if (serialReaderRef.current) {
          serialReaderRef.current.cancel();
        }
      } catch (e) {}
    };
  }, []);

  const startWebSerial = async () => {
    if (!('serial' in navigator)) {
      setSerialConsoleLines(prev => [
        ...prev,
        `⚠️ [AVERTISSEMENT] : La Web Serial API n'est pas supportée par votre navigateur actuel ou cet environnement d'iframe.`,
        `💡 Conseil : Utilisez Google Chrome ou Microsoft Edge récent et assurez-vous d'ouvrir l'application dans un nouvel onglet avec l'URL de prévisualisation directe pour que les permissions de ports USB s'ouvrent.`
      ]);
      return;
    }

    try {
      setSerialConsoleLines(prev => [
        ...prev,
        `🔌 Ouverture du sélecteur de périphérique série... Choisissez votre carte Arduino sur le port USB (ex: "/dev/cu.usbserial-10").`
      ]);
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;
      setWebSerialActive(true);
      keepReadingRef.current = true;

      setSerialConsoleLines(prev => [
        ...prev,
        `✅ [MATÉRIEL LANCE SÉRIE] Liaison connectée à l'Arduino physique avec succès !`
      ]);

      // Create Decode Stream
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      let lineBuffer = '';

      while (port.readable && keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          for (const rawLine of lines) {
            const cleanLine = rawLine.trim();
            if (!cleanLine) continue;

            // Log each raw line to scroll console in real-time
            setSerialConsoleLines(prev => [
              ...prev.slice(-99),
              `[SÉRIE BRUTE] : ${cleanLine}`
            ]);

            // Match user's specific Arduino line:
            // "Distance: 12 cm | Couleur du feu: ROUGE"
            const textMatch = cleanLine.match(/Distance:\s*(\d+)\s*cm\s*\|\s*Couleur du feu:\s*(VERT|ORANGE|ROUGE)/i);
            if (textMatch) {
              const dValue = parseInt(textMatch[1]);
              const rawColor = textMatch[2].toUpperCase();
              
              let mappedL: 'rouge' | 'orange' | 'vert' = 'vert';
              if (rawColor === 'ROUGE') mappedL = 'rouge';
              else if (rawColor === 'ORANGE') mappedL = 'orange';
              else if (rawColor === 'VERT') mappedL = 'vert';

              // 1. Update UI states locally in React App
              setDistance(dValue);
              setLightState(mappedL);

              // 2. Transmit to backend via simulator-simulation API to keep DB matching and fire socket updates
              const payload = {
                type: 'status',
                lightState: mappedL,
                distance: dValue
              };
              
              apiService.post('/api/serial/simulate', { line: JSON.stringify(payload) }).catch(() => {});

              // 3. Match Infraction rule: Distance is <= 10 and Light is RED (ROUGE)
              if (dValue <= 10 && mappedL === 'rouge') {
                const now = Date.now();
                if (now - lastInfractionTimeRef.current > 3000) { // 3s debounce
                  lastInfractionTimeRef.current = now;
                  
                  setSerialConsoleLines(prev => [
                    ...prev,
                    `🚨 [ALERTE ROUGE] Véhicule franchi à ${dValue}cm ! Envoi de l'effraction au serveur Cloud...`
                  ]);

                  apiService.post('/api/infractions', {
                    type: "feu_rouge_grille",
                    distance: dValue,
                    etat_feu: "rouge",
                    message: "Infraction détectée en direct par le Capteur de Proximité physique de votre Arduino (/dev/cu.usbserial-10)"
                  }).then(() => {
                    fetchData();
                  }).catch(err => {
                    console.error("Échec d'envoi de l'effraction réelle", err);
                  });
                }
              }
            } else {
              // Try parsing as raw JSON as fallback support
              try {
                const parsed = JSON.parse(cleanLine);
                if (parsed.type === 'status' && parsed.lightState) {
                  setDistance(Number(parsed.distance) || 0);
                  setLightState(parsed.lightState);
                } else if (parsed.type === 'infraction' || parsed.type === 'feu_rouge_grille') {
                  const now = Date.now();
                  if (now - lastInfractionTimeRef.current > 3000) {
                    lastInfractionTimeRef.current = now;
                    apiService.post('/api/infractions', {
                      type: "feu_rouge_grille",
                      distance: Number(parsed.distance) || 0,
                      etat_feu: "rouge",
                      message: parsed.message || "Infraction détectée par le Capteur Ultrason physique"
                    }).then(() => {
                      fetchData();
                    });
                  }
                }
              } catch (e) {
                // Not standard JSON or user's line, ignore
              }
            }
          }
        }
      }
    } catch (err: any) {
      setSerialConsoleLines(prev => [
        ...prev,
        `❌ [REAL PORT ERROR] : ${err.message}`
      ]);
      setWebSerialActive(false);
    }
  };

  const stopWebSerial = async () => {
    keepReadingRef.current = false;
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel();
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
    } catch (e) {}
    serialReaderRef.current = null;
    serialPortRef.current = null;
    setWebSerialActive(false);
    setSerialConsoleLines(prev => [
      ...prev,
      `🔌 [REAL PORT DISCONNECTED] Liaison déconnectée.`
    ]);
  };

  // 1. Initial REST API Fetch on load
  const fetchData = async () => {
    try {
      // Get all infractions
      const infractionsData = await apiService.get('/api/infractions');
      setInfractions(infractionsData);

      // Get stats
      const statsData = await apiService.get('/api/stats');
      setStats(statsData);

      // Get systems status
      const systemData = await apiService.get('/api/system');
      setSystemStatus(prev => ({
        ...prev,
        arduinoConnected: systemData.arduino === 'connecte'
      }));
    } catch (error) {
      console.error("Error loading server metrics", error);
    }
  };

  useEffect(() => {
    fetchData();

    // 2. Setup Real-time WebSockets with Socket.io using dynamic API Service
    const socket = apiService.connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend! ID: ${socket.id}`);
      setSystemStatus(prev => ({ ...prev, status: 'online' }));
    });

    socket.on('disconnect', () => {
      console.log("[Socket] Disconnected from backend.");
      setSystemStatus(prev => ({ ...prev, status: 'offline' }));
    });

    // Real-time violation notification broadcast listener
    socket.on('newInfraction', (newInfraction: Infraction) => {
      console.log("[Socket] Real-time Infraction Received:", newInfraction);
      
      // Prepend at start of list
      setInfractions(prev => [newInfraction, ...prev]);
      
      // Auto display active visual flash alert widget
      setActiveAlert(newInfraction);
    });

    // Receive updated aggregate counts
    socket.on('statsUpdate', (newStats: Stats) => {
      setStats(newStats);
    });

    // Receive infraction deleted event
    socket.on('infractionDeleted', (payload: { id: number }) => {
      console.log("[Socket] Real-time Infraction Deleted:", payload.id);
      setInfractions(prev => prev.filter(inf => inf.id !== payload.id));
    });

    // Receive database reset/clear event
    socket.on('databaseReset', (payload: { message: string }) => {
      console.log("[Socket] Real-time Database Cleared or Seeded:", payload.message);
      setInfractions([]);
      setStats({ total: 0, today: 0, week: 0, month: 0 });
      fetchData(); // Trigger full re-fetch for new loaded seed or cleared states
    });

    // Live Arduino hook contact update
    socket.on('systemStatusUpdate', (status: { arduinoConnected: boolean }) => {
      setSystemStatus(prev => ({
        ...prev,
        arduinoConnected: status.arduinoConnected
      }));
    });

    // Receive synchronized traffic light state changes from other tabs/server
    socket.on('lightStateUpdate', (payload: { state: 'rouge' | 'orange' | 'vert' }) => {
      console.log("[Socket] Received synchronized light state:", payload.state);
      setLightState(payload.state);
    });

    // Receive synchronized distance measurements from other tabs/server/hardware
    socket.on('distanceUpdate', (payload: { distance: number }) => {
      console.log("[Socket] Received synchronized distance:", payload.distance);
      setDistance(payload.distance);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Sync local traffic light changes to all connected systems via Socket.io
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('updateLightState', { state: lightState });
    }
  }, [lightState]);

  // Handler: Manual simulate traffic transgression
  const handleSimulateCross = async () => {
    // Generate simulated breach
    try {
      const messages = [
        "Véhicule ayant franchi le feu rouge en direct",
        "Breach de feu rouge détecté par le capteur de proximité",
        "Sensors ont flashé un passage à grande vitesse",
        "Non respect de l'arrêt réglementaire au carrefour"
      ];
      
      const simulatedDistance = parseFloat((Math.random() * 10 + 3).toFixed(1)); // 3 cm to 13 cm

      const data = await apiService.post('/api/infractions', {
        type: "feu_rouge_grille",
        distance: simulatedDistance,
        etat_feu: "rouge",
        message: messages[Math.floor(Math.random() * messages.length)]
      });

      console.log("Simulated infraction sent to POST route successfully", data);
      fetchData();
    } catch (e) {
      console.error("Simulation error", e);
    }
  };

  // Handler: Manual simulate YOLO motorcycle without helmet infraction
  const handleSimulateYolo = async () => {
    try {
      const messages = [
        "Conducteur détecté sans casque de protection par caméra YOLOv8",
        "Passager de moto circulant sans casque sur boulevard principal",
        "Infraction YOLO: Moto sans casque identifiée au point kilométrique PK-4",
        "Absence de dispositif de sécurité (casque de protection) par le pilote de moto"
      ];
      
      const images = [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=80"
      ];

      const coordinates = [
        "[120, 95, 340, 420]",
        "[170, 110, 390, 400]",
        "[190, 80, 410, 380]"
      ];

      const score = parseFloat((0.85 + Math.random() * 0.14).toFixed(2));

      await apiService.post('/api/infractions', {
        type: "moto_sans_casque",
        distance: 0,
        etat_feu: lightState,
        message: messages[Math.floor(Math.random() * messages.length)],
        image_url: images[Math.floor(Math.random() * images.length)],
        coordonnees: coordinates[Math.floor(Math.random() * coordinates.length)],
        score_confiance: score
      });

      console.log("Simulated YOLO infraction sent successfully");
      fetchData();
    } catch (e) {
      console.error("Simulation YOLO error", e);
    }
  };

  // Handler: Emit simulator heartbeat to keep socket status active
  const handleSimulatorHeartbeat = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('arduinoHeartbeat');
    }
  };

  // Handler: Virtual simulator crossing trigger inside control slider
  const handleSimulatorTriggerViolation = async (dist: number) => {
    // Triggers infraction only if a new flash alert isn't already active
    if (activeAlert) return;

    try {
      await apiService.post('/api/infractions', {
        type: "feu_rouge_grille",
        distance: parseFloat(dist.toFixed(1)),
        etat_feu: "rouge",
        message: "Infraction détectée via le curseur matériel"
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: Delete single item
  const handleDeleteInfraction = async (id: number) => {
    try {
      await apiService.delete(`/api/infractions/${id}`);
      setInfractions(prev => prev.filter(inf => inf.id !== id));
      fetchData();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  // Handler: Reset/Empty list
  const handleClearAll = async () => {
    try {
      await apiService.post('/api/clear-all');
      setInfractions([]);
      setStats({ total: 0, today: 0, week: 0, month: 0 });
    } catch (e) {
      console.error("Reset failed", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100 font-sans">
      
      {/* Mobile Header Navigation bar */}
      <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚨</span>
          <div>
            <h1 className="text-xs font-bold text-slate-150">TraficVision</h1>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Supervision Live</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-350 hover:text-slate-100 rounded bg-slate-850 hover:bg-slate-800 transition"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Overlay Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/95 flex flex-col pt-16">
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 text-slate-400 bg-slate-900 border border-slate-800 roundedLg"
          >
            <X className="w-5 h-5" />
          </button>
          <nav className="flex flex-col gap-3 p-6 text-center text-lg font-semibold">
            {[
              { id: 'dashboard', label: 'Tableau de bord' },
              { id: 'infractions', label: 'Infractions' },
              { id: 'statistics', label: 'Statistiques' },
              { id: 'simulator', label: 'Simulateur Arduino' },
              { id: 'setup', label: 'Guide & Code Arduino' },
              { id: 'settings', label: 'Paramètres' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`py-3.5 rounded-xl border ${
                  currentTab === tab.id 
                    ? 'bg-red-600 text-white border-red-500 shadow-lg' 
                    : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Desktop Persistent Left Sidebar */}
      <div className="hidden md:block">
        <Sidebar 
          currentTab={currentTab} 
          setTab={setTab} 
          arduinoConnected={systemStatus.arduinoConnected || webSerialActive} 
        />
      </div>

      {/* Scrollable Content Pane layout */}
      <main className="flex-1 overflow-y-auto h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Render Tab Pages dynamically based on active identifier */}
        {currentTab === 'dashboard' && (
          <Dashboard 
            stats={stats}
            latestInfractions={infractions}
            arduinoConnected={systemStatus.arduinoConnected || webSerialActive}
            activeAlert={activeAlert}
            dismissAlert={() => setActiveAlert(null)}
            onSimulateCross={handleSimulateCross}
            onSimulateYolo={handleSimulateYolo}
            systemStatus={systemStatus.status}
            lightState={lightState}
            distance={distance}
            webSerialActive={webSerialActive}
            startWebSerial={startWebSerial}
            stopWebSerial={stopWebSerial}
            serialConsoleLines={serialConsoleLines}
          />
        )}

        {currentTab === 'infractions' && (
          <InfractionList 
            infractions={infractions}
            onDeleteInfraction={handleDeleteInfraction}
            onClearAll={handleClearAll}
            onRefresh={fetchData}
          />
        )}

        {currentTab === 'statistics' && (
          <StatsView infractions={infractions} />
        )}

        {currentTab === 'simulator' && (
          <ArduinoSimulator 
            lightState={lightState}
            setLightState={setLightState}
            distance={distance}
            setDistance={setDistance}
            triggerViolation={handleSimulatorTriggerViolation}
            socketHeartbeat={handleSimulatorHeartbeat}
            webSerialActive={webSerialActive}
            startWebSerial={startWebSerial}
            stopWebSerial={stopWebSerial}
            serialConsoleLines={serialConsoleLines}
            setSerialConsoleLines={setSerialConsoleLines}
          />
        )}

        {currentTab === 'setup' && (
          <SetupInstructions />
        )}

        {currentTab === 'settings' && (
          <SettingsView 
            onClearAll={handleClearAll}
            onRefresh={fetchData}
            totalCount={infractions.length}
          />
        )}

      </main>

    </div>
  );
}
