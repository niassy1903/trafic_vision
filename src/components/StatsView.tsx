import React from 'react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  Trophy, 
  Activity, 
  HelpCircle,
  Clock,
  Navigation,
  CalendarDays
} from 'lucide-react';
import { Infraction } from '../types';

interface StatsViewProps {
  infractions: Infraction[];
}

export default function StatsView({ infractions }: StatsViewProps) {
  
  // 1. Process Day of Week Trends (Last 7 Days)
  const getWeeklyTrend = () => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const trendMap: { [key: string]: number } = {};
    
    // Initialize last 7 days
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];
      trendMap[dayName] = 0;
    }

    // Accumulate actual infractions metrics
    infractions.forEach(inf => {
      try {
        const d = new Date(inf.date_infraction + 'T12:00:00'); // avoid timezone shifts
        const dayName = days[d.getDay()];
        if (dayName in trendMap) {
          trendMap[dayName]++;
        }
      } catch (e) {
        // Safe fallback
      }
    });

    return Object.keys(trendMap).map(key => ({
      name: key.substring(0, 3) + '.', // e.g. Lun. Mar.
      'Infractions': trendMap[key]
    }));
  };

  // 2. Process Hourly Distribution
  const getHourlyDistribution = () => {
    // Group slots into 2-hourly brackets
    const hours = [
      { label: '00h - 04h', count: 0 },
      { label: '04h - 08h', count: 0 },
      { label: '08h - 12h', count: 0 },
      { label: '12h - 16h', count: 0 },
      { label: '16h - 20h', count: 0 },
      { label: '20h - 00h', count: 0 }
    ];

    infractions.forEach(inf => {
      try {
        const timePart = inf.heure_infraction.split(':');
        const hour = parseInt(timePart[0], 10);
        if (!isNaN(hour)) {
          if (hour >= 0 && hour < 4) hours[0].count++;
          else if (hour >= 4 && hour < 8) hours[1].count++;
          else if (hour >= 8 && hour < 12) hours[2].count++;
          else if (hour >= 12 && hour < 16) hours[3].count++;
          else if (hour >= 16 && hour < 20) hours[4].count++;
          else if (hour >= 20 && hour < 24) hours[5].count++;
        }
      } catch (e) {}
    });

    return hours.map(h => ({
      name: h.label,
      'Nombre': h.count
    }));
  };

  // 3. Process Distance Proximity Distribution (Pie Chart)
  const getProximityDistribution = () => {
    let under10 = 0;
    let from10To15 = 0;
    let from15To20 = 0;
    let above20 = 0;

    infractions.forEach(inf => {
      // Skip motorcycle helmet infractions which are verified via computer vision rather than ultrasonic distance thresholds
      if (inf.type !== 'feu_rouge_grille') return;
      const d = inf.distance;
      if (d < 10) under10++;
      else if (d >= 10 && d < 15) from10To15++;
      else if (d >= 15 && d < 20) from15To20++;
      else above20++;
    });

    return [
      { name: 'Critique (<10cm)', value: under10, color: '#ef4444' }, // intense red
      { name: 'Rapproché (10-15cm)', value: from10To15, color: '#ff7849' }, // orange-red
      { name: 'Moyen (15-20cm)', value: from15To20, color: '#f59e0b' }, // amber
      { name: 'Marginal (>20cm)', value: above20, color: '#3b82f6' } // blue
    ].filter(item => item.value > 0); // hide empty slices
  };

  // Pre-calculated processed datasets
  const weeklyData = getWeeklyTrend();
  const hourlyData = getHourlyDistribution();
  const proximityData = getProximityDistribution();

  // Summary widgets helpers (bypass non-sensor violations for distance calculations)
  const redLightInfractions = infractions.filter(i => i.type === 'feu_rouge_grille');
  const averageDistance = redLightInfractions.length > 0
    ? (redLightInfractions.reduce((sum, inf) => sum + inf.distance, 0) / redLightInfractions.length).toFixed(1)
    : '0.0';

  const highestHourBracket = () => {
    if (infractions.length === 0) return 'Aucune donnée';
    const sorted = [...hourlyData].sort((a,b) => b['Nombre'] - a['Nombre']);
    return sorted[0]['Nombre'] > 0 ? sorted[0].name : 'Aucun pic';
  };

  return (
    <div className="space-y-6 font-sans text-slate-200">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Rapports & Statistiques Analytiques</h2>
        <p className="text-xs text-slate-400 mt-1">
          Analyse statistique consolidée des infractions enregistrées par les capteurs d'intersections connectés.
        </p>
      </div>

      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase text-slate-400 block font-mono">Période la plus risquée</span>
            <span className="text-lg font-bold text-slate-100 mt-0.5 block">
              {highestHourBracket()}
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase text-slate-400 block font-mono">Distance Moyenne Capteur</span>
            <span className="text-lg font-bold text-slate-100 mt-0.5 block">
              {averageDistance} cm
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-550 rounded-lg">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase text-slate-400 block font-mono">Taux Infraction Quotidien</span>
            <span className="text-lg font-bold text-slate-100 mt-0.5 block">
              {(infractions.length / 30).toFixed(1)} / jour (Moy.)
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Weekly Area Trend - Large 7-col */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Évolution Hebdomadaire des Franchissements
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInfractions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold', color: '#94a3b8' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Infractions" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorInfractions)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Proximity Slice Pie chart - 5-col */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Répartition par Proximité (Distance)
          </h3>
          {proximityData.length === 0 ? (
            <div className="h-68 flex items-center justify-center text-slate-550 text-xs">
              Aucune donnée disponible pour le graphique circulaire.
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={proximityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {proximityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Pie Legends */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs">
                {proximityData.map((d, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-slate-400 truncate max-w-[120px]" title={d.name}>
                      {d.name} : <strong className="text-slate-200">{d.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2-Hourly brackets Distribution bar chart */}
        <div className="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Distribution Horaire des Infractions (Toutes périodes confondues)
          </h3>
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical = {false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  cursor={{ fill: '#1e293b', opacity: 0.2 }}
                />
                <Bar dataKey="Nombre" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.Nombre === Math.max(...hourlyData.map(o=>o.Nombre)) ? '#ef4444' : '#3b82f6'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
