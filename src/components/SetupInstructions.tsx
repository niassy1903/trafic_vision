import React, { useState } from 'react';
import { 
  Terminal, 
  Database, 
  HelpCircle, 
  Power, 
  Cpu, 
  Copy, 
  Check, 
  FileText 
} from 'lucide-react';

export default function SetupInstructions() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const arduinoCode = `/**
 * TraficVision - Détection d'infractions "Feu Rouge Grillé"
 * Microcontrôleur : Arduino UNO
 * Capteurs & composants : 
 *   - LED Rouge (Pin 8)
 *   - LED Orange (Pin 9)
 *   - LED Verte (Pin 10)
 *   - Capteur ultrason HC-SR04 Trigger (Pin 2) & Echo (Pin 3)
 */

#include <ArduinoJson.h> // Installer via le gestionnaire de bibliothèques Arduino

// Définition des broches
const int LED_ROUGE = 8;
const int LED_ORANGE = 9;
const int LED_VERTE = 10;
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;

// Variables de configuration
const float SEUIL_DISTANCE_CM = 15.0; // Seuil pour infraction (distance par rapport au feu)
const unsigned long DELAI_ORANGE_MS = 2000;
const unsigned long DELAI_VERT_MS = 5000;
const unsigned long DELAI_ROUGE_MS = 6000;

enum EtatFeu { VERT, ORANGE, ROUGE };
EtatFeu etatActuel = VERT;
unsigned long tempsChangementEtat = 0;

void setup() {
  Serial.begin(9600); // Débit série standard
  
  // Configuration des broches
  pinMode(LED_ROUGE, OUTPUT);
  pinMode(LED_ORANGE, OUTPUT);
  pinMode(LED_VERTE, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  tempsChangementEtat = millis();
  mettreAJourLEDs();
}

void loop() {
  // 1. Gérer le cycle de re-signalisation tricolore automatique
  gererCycleFeu();

  // 2. Mesurer la distance via le capteur à ultrasons HC-SR04
  float distance = mesurerDistance();

  // 3. Détecter l'infraction
  // Si le feu est rouge ET qu'un véhicule franchit la ligne d'effet (Distance < Seuil)
  if (etatActuel == ROUGE && distance > 0.5 && distance < SEUIL_DISTANCE_CM) {
    signalerInfraction(distance);
    delay(2000); // Anti-rebond : éviter les détections multiples pour le même véhicule
  }

  delay(100); // Court délai pour stabiliser les mesures
}

float mesurerDistance() {
  // Impulsion de déclenchement du capteur
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Lecture de la durée de l'onde de retour
  long duree = pulseIn(ECHO_PIN, HIGH);
  
  // Calcul de la distance d'après la vitesse du son (340 m/s)
  float distance = duree * 0.034 / 2;
  return distance;
}

void gererCycleFeu() {
  unsigned long now = millis();
  unsigned long ecart = now - tempsChangementEtat;

  if (etatActuel == VERT && ecart >= DELAI_VERT_MS) {
    etatActuel = ORANGE;
    tempsChangementEtat = now;
    mettreAJourLEDs();
  } 
  else if (etatActuel == ORANGE && ecart >= DELAI_ORANGE_MS) {
    etatActuel = ROUGE;
    tempsChangementEtat = now;
    mettreAJourLEDs();
  } 
  else if (etatActuel == ROUGE && ecart >= DELAI_ROUGE_MS) {
    etatActuel = VERT;
    tempsChangementEtat = now;
    mettreAJourLEDs();
  }
}

void mettreAJourLEDs() {
  digitalWrite(LED_VERTE, etatActuel == VERT ? HIGH : LOW);
  digitalWrite(LED_ORANGE, etatActuel == ORANGE ? HIGH : LOW);
  digitalWrite(LED_ROUGE, etatActuel == ROUGE ? HIGH : LOW);
}

void signalerInfraction(float distanceEnregistree) {
  // Construire et sérialiser l'objet JSON vers le port Série
  // Cet objet sera capturé par un script de pont (Ex : Python ou serialport sur Node.js)
  StaticJsonDocument<200> doc;
  doc["type"] = "feu_rouge_grille";
  doc["distance"] = distanceEnregistree;
  doc["etat_feu"] = "rouge";
  doc["message"] = "Véhicule flashé par le radar de surveillance";

  // Envoyer sur le port série
  serializeJson(doc, Serial);
  Serial.println(); // Retour à la ligne pour marquer la fin du paquet
}
`;

  const sqlSchema = `-- Base de données : traffic
-- Créer la base de données
CREATE DATABASE IF NOT EXISTS traffic DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE traffic;

-- Structure de la table infractions
CREATE TABLE IF NOT EXISTS infractions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(100) NOT NULL DEFAULT 'feu_rouge_grille',
    date_infraction DATE NOT NULL,
    heure_infraction TIME NOT NULL,
    distance FLOAT NOT NULL,
    etat_feu VARCHAR(20) NOT NULL DEFAULT 'rouge',
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertion de données de test (facultatif)
INSERT INTO infractions (type, date_infraction, heure_infraction, distance, etat_feu, message) 
VALUES ('feu_rouge_grille', CURDATE(), CURTIME(), 12.5, 'rouge', 'Infraction détectée via simulateur');
`;

  return (
    <div className="space-y-6 font-sans text-slate-200">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Guide d'Installation & Code Source Hardware</h2>
        <p className="text-xs text-slate-400 mt-1">
          Passez de la simulation virtuelle à la réalité. Suivez ces étapes pour connecter un véritable microcontrôleur Arduino UNO et une base de données MySQL.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Wiring & Steps */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Wire Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Power className="w-4 h-4 text-cyan-400 animate-pulse" />
              Câblage des composants physiques
            </h3>
            
            <div className="space-y-3 text-xs leading-relaxed text-slate-350">
              <p className="font-bold text-slate-250">1. Capteur Ultrason HC-SR04 :</p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li><strong className="text-cyan-450 font-mono">VCC</strong> d'HC-SR04 ➜ <strong className="text-red-400 font-mono">5V</strong> d'Arduino</li>
                <li><strong className="text-cyan-450 font-mono">GND</strong> d'HC-SR04 ➜ <strong className="text-slate-400 font-mono">GND</strong> d'Arduino</li>
                <li><strong className="text-cyan-450 font-mono">Trig</strong> d'HC-SR04 ➜ Broche numérique <strong className="text-white font-mono">2</strong></li>
                <li><strong className="text-cyan-450 font-mono">Echo</strong> d'HC-SR04 ➜ Broche numérique <strong className="text-white font-mono">3</strong></li>
              </ul>

              <p className="font-bold text-slate-250 mt-4">2. LEDs Réplicat du Feu tricolore :</p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li><span className="text-red-500">LED Rouge</span> (Anode) ➜ Résistance 220Ω ➜ Broche numérique <strong className="text-white font-mono">8</strong></li>
                <li><span className="text-amber-500">LED Orange</span> (Anode) ➜ Résistance 220Ω ➜ Broche numérique <strong className="text-white font-mono">9</strong></li>
                <li><span className="text-emerald-500">LED Verte</span> (Anode) ➜ Résistance 220Ω ➜ Broche numérique <strong className="text-white font-mono">10</strong></li>
                <li>Les <strong className="text-slate-400 font-mono">Cathodes</strong> communes ➜ Résistances ➜ Broche <strong className="text-slate-400 font-mono">GND</strong></li>
              </ul>
            </div>
          </div>

          {/* Integration Bridge scripts info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Dialogue Sino-Matériel (Arduino ➜ Node.js)
            </h3>
            <p className="text-xs leading-relaxed text-slate-400">
              Puisque l'Arduino UNO émet le JSON d'infraction sur le port série USB, vous pouvez configurer un pont léger en Node.js pour intercepter ces messages et exécuter la requête HTTP :
            </p>
            <div className="bg-slate-950 p-3.5 border border-slate-850 rounded-lg mt-3 text-[10.5px] font-mono text-cyan-300">
              npm install serialport @serialport/parser-readline
            </div>
            <p className="text-[11px] text-slate-500 italic mt-2.5 leading-snug">
              Un script écoute le flux physique USB, extrait la chaîne JSON, et appelle ensuite la méthode : <br />
              <code className="text-red-400 font-bold bg-[#1d1010] py-0.5 px-1 rounded border border-red-950/20">POST /api/infractions</code> de notre backend !
            </p>
          </div>

        </div>

        {/* Right Column: Copyable Source Code tabs - 7 Columns */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Arduino Code container */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3.5 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold font-mono text-cyan-400 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                code_arduino_uno.ino (C++)
              </span>
              <button
                onClick={() => copyToClipboard(arduinoCode, 'arduino')}
                className="px-2.5 py-1 text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 rounded transition-all cursor-pointer"
              >
                {copiedSection === 'arduino' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-76 font-mono text-[10.5px] text-slate-300 bg-slate-950/70 leading-relaxed scrollbar-thin">
              <pre>{arduinoCode}</pre>
            </div>
          </div>

          {/* MySQL schema script container */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3.5 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                traffic.sql (MySQL Schema)
              </span>
              <button
                onClick={() => copyToClipboard(sqlSchema, 'sql')}
                className="px-2.5 py-1 text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 rounded transition-all cursor-pointer"
              >
                {copiedSection === 'sql' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-60 font-mono text-[10.5px] text-slate-300 bg-slate-950/70 leading-relaxed scrollbar-thin">
              <pre>{sqlSchema}</pre>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
