import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Filter, 
  RefreshCcw, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  FileSpreadsheet,
  AlertTriangle,
  Camera,
  Image
} from 'lucide-react';
import { Infraction } from '../types';

interface InfractionListProps {
  infractions: Infraction[];
  onDeleteInfraction: (id: number) => void;
  onClearAll: () => void;
  onRefresh: () => void;
}

export default function InfractionList({
  infractions,
  onDeleteInfraction,
  onClearAll,
  onRefresh
}: InfractionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDistance, setFilterDistance] = useState<'all' | 'under10' | '10to20' | 'above20'>('all');
  const [filterType, setFilterType] = useState<'all' | 'feu_rouge_grille' | 'moto_sans_casque'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const itemsPerPage = 8;

  // Filter & Search Logic
  const filteredInfractions = infractions.filter(inf => {
    // Search query match
    const matchesSearch = 
      inf.id.toString().includes(searchTerm) ||
      inf.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.date_infraction.includes(searchTerm) ||
      inf.heure_infraction.includes(searchTerm);

    // Distance match (only applies directly to red light radar infractions)
    let matchesDistance = true;
    if (inf.type === 'feu_rouge_grille') {
      if (filterDistance === 'under10') {
        matchesDistance = inf.distance < 10;
      } else if (filterDistance === '10to20') {
        matchesDistance = inf.distance >= 10 && inf.distance <= 20;
      } else if (filterDistance === 'above20') {
        matchesDistance = inf.distance > 20;
      }
    } else {
      // For YOLO alerts, they only match if distance filter is set to "all"
      if (filterDistance !== 'all') {
        matchesDistance = false;
      }
    }

    // Type filter match
    let matchesType = true;
    if (filterType !== 'all') {
      matchesType = inf.type === filterType;
    }

    return matchesSearch && matchesDistance && matchesType;
  });

  // Pagination Logic
  const totalItems = filteredInfractions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInfractions.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Export to CSV helper
  const exportToCSV = () => {
    const headers = ['ID', 'Type', 'Date', 'Heure', 'Distance (cm)', 'Etat Feu', 'Confiance YOLO', 'Message'];
    const rows = infractions.map(inf => [
      inf.id,
      inf.type,
      inf.date_infraction,
      inf.heure_infraction,
      inf.type === 'moto_sans_casque' ? '' : inf.distance,
      inf.etat_feu,
      inf.type === 'moto_sans_casque' ? (inf.score_confiance || 0.94) : '',
      `"${inf.message.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `archives_infractions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans text-slate-200">
      
      {/* Upper header action section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Registre National des Infractions</h2>
          <p className="text-xs text-slate-400 mt-1">
            Recherche, tri et consultation archivée des procès-verbaux de franchissement de feu rouge (Laser) et d'infractions casque (YOLOv8).
          </p>
        </div>
        
        {/* Actions panel */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onRefresh}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-800 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
            title="Actualiser la liste"
          >
            <RefreshCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Actualiser</span>
          </button>

          <button
            onClick={exportToCSV}
            disabled={infractions.length === 0}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-slate-200 rounded-lg border border-slate-800 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => {
              if (confirm("Êtes-vous sûr de vouloir supprimer TOUTES les infractions de la base de données ?")) {
                onClearAll();
              }
            }}
            disabled={infractions.length === 0}
            className="px-3.5 py-2.5 bg-red-950/40 hover:bg-red-950 disabled:opacity-40 text-red-200 rounded-lg border border-red-900/30 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Vider la DB</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar widget */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ID, date, heure, description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs py-2.5 pl-10 pr-4 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-550 focus:ring-1 focus:ring-slate-800 transition-all font-sans"
          />
        </div>

        {/* Source Filter */}
        <div className="md:col-span-3">
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full text-xs py-2.5 px-3 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
          >
            <option value="all">Filtre Source : Tous</option>
            <option value="feu_rouge_grille">🚦 Feu Rouge (Radar Ultrasons)</option>
            <option value="moto_sans_casque">🏍️ Sans Casque (YOLO Caméra)</option>
          </select>
        </div>

        {/* Proximity Distance filter */}
        <div className="md:col-span-3">
          <select
            value={filterDistance}
            onChange={(e) => {
              setFilterDistance(e.target.value as any);
              setCurrentPage(1);
            }}
            disabled={filterType === 'moto_sans_casque'}
            className="w-full text-xs py-2.5 px-3 bg-slate-950 border border-slate-850 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 focus:outline-none focus:border-cyan-550 transition-all cursor-pointer"
          >
            <option value="all">Distance : Toutes</option>
            <option value="under10">Critique (Moins de 10.0 cm)</option>
            <option value="10to20">Passage classique (10.0 - 20.0 cm)</option>
            <option value="above20">Marginal (Au-dessus de 20.0 cm)</option>
          </select>
        </div>

        {/* Counter */}
        <div className="md:col-span-2 text-right text-xs font-mono text-slate-400">
          Trouvés: <span className="font-bold text-cyan-400">{filteredInfractions.length}</span> / {infractions.length}
        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 font-mono text-slate-400 uppercase text-[10px] tracking-wider select-none">
                <th className="py-3.5 px-4 font-bold text-center w-16">ID</th>
                <th className="py-3.5 px-4">Modul / Source</th>
                <th className="py-3.5 px-4">Date & Heure</th>
                <th className="py-3.5 px-4">Capteurs / AI Vision</th>
                <th className="py-3.5 px-4">État Feu</th>
                <th className="py-3.5 px-4">Message / Rapport</th>
                <th className="py-3.5 px-4 text-center w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/80">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertTriangle className="w-10 h-10 text-slate-600 animate-bounce" />
                      <span>Aucun procès-verbal ne correspond à ces critères.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((inf) => (
                  <tr 
                    key={inf.id}
                    className="hover:bg-slate-850/20 transition-colors duration-150 text-slate-300 group"
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 text-center text-xs font-bold font-mono text-cyan-400">
                      #{inf.id}
                    </td>

                    {/* Source Device Module */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {inf.type === 'moto_sans_casque' ? '🏍️' : '🚗'}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-205">
                            {inf.type === 'moto_sans_casque' ? 'Casque Moto' : 'Feu Rouge Grillé'}
                          </span>
                          <span className="block text-[9px] font-mono text-slate-500">
                            {inf.type === 'moto_sans_casque' ? 'YOLO AI CPU' : 'Distance Laser'}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    {/* Date / Time */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold font-mono text-slate-300">
                        {inf.date_infraction}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-500 font-mono">
                        {inf.heure_infraction}
                      </span>
                    </td>

                    {/* Sensor parameters / Image Crop box */}
                    <td className="py-3.5 px-4">
                      {inf.type === 'moto_sans_casque' ? (
                        <div className="flex items-center gap-2 font-sans text-xs">
                          {inf.image_url && (
                            <div 
                              onClick={() => inf.image_url && setSelectedImage(inf.image_url)}
                              className="w-10 h-7 rounded border border-amber-500/20 overflow-hidden shrink-0 relative bg-slate-950 cursor-zoom-in group-hover:border-amber-400/50"
                              title="Cliquer pour agrandir la capture"
                            >
                              <img src={inf.image_url} alt="Crop" className="w-full h-full object-cover opacity-80 hover:opacity-100" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[7px] text-white">IMAGE</span>
                              </div>
                            </div>
                          )}
                          <span className="inline-block text-[10px] font-extrabold text-amber-405 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10">
                            Confidence: {(inf.score_confiance ? inf.score_confiance * 100 : 94).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-100">
                          <span className={`w-2 h-2 rounded-full ${
                            inf.distance < 10 ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          <span>{inf.distance.toFixed(1)} cm</span>
                        </div>
                      )}
                    </td>

                    {/* Active State (Red/Orange/Green) */}
                    <td className="py-3.5 px-4">
                      {inf.etat_feu === 'rouge' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/10 font-sans uppercase">
                          🔴 ROUGE
                        </span>
                      )}
                      {inf.etat_feu === 'orange' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/10 font-sans uppercase">
                          🟡 ORANGE
                        </span>
                      )}
                      {inf.etat_feu === 'vert' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 font-sans uppercase">
                          🟢 VERT
                        </span>
                      )}
                    </td>

                    {/* Notification Message content */}
                    <td 
                      className="py-3.5 px-4 text-xs text-slate-400 group-hover:text-slate-200 transition-colors max-w-sm truncate" 
                      title={inf.message}
                    >
                      {inf.message}
                    </td>

                    {/* Delete item button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onDeleteInfraction(inf.id)}
                        className="p-1 px-2 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors inline-flex cursor-pointer border border-transparent hover:border-red-500/10"
                        title="Archiver / Supprimer le procès-verbal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info/Pagination controls */}
        {totalPages > 1 && (
          <div className="py-3.5 px-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              Affichage {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} sur {totalItems} infractions
            </span>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:hover:bg-slate-805 text-slate-400 hover:text-slate-205 font-bold transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => paginate(num)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer ${
                      currentPage === num 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:hover:bg-slate-805 text-slate-400 hover:text-slate-205 font-bold transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Frame Visual Overlay Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 z-55"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-xl w-full text-right relative space-y-2">
            <button 
              className="text-slate-400 hover:text-white text-sm font-bold bg-slate-900 border border-slate-755 p-2 rounded-lg cursor-pointer"
              onClick={() => setSelectedImage(null)}
            >
              Fermer [✕]
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video shadow-2xl relative">
              <img src={selectedImage} alt="YOLO Zoom crop capture evidence" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              {/* Overlay bounding boxes labels simulator */}
              <div className="absolute inset-x-12 inset-y-12 border border-red-500 pointer-events-none">
                <span className="absolute -top-5 left-0 bg-red-650 text-white font-mono text-[8px] font-bold px-1 rounded uppercase tracking-wider">
                  Without Helmet (94%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
