/**
 * Types for the traffic infraction monitoring system.
 */

export interface Infraction {
  id: number;
  type: string;
  date_infraction: string; // YYYY-MM-DD
  heure_infraction: string; // HH:MM:SS
  distance: number; // cm
  etat_feu: 'rouge' | 'orange' | 'vert';
  message: string;
  image_url?: string;
  coordonnees?: string;
  score_confiance?: number;
  created_at?: string;
}

export interface Stats {
  total: number;
  today: number;
  week: number;
  month: number;
}

export interface SystemStatus {
  status: 'online' | 'offline';
  arduinoConnected: boolean;
  lastPing?: string;
}

export interface SimulatorState {
  lightState: 'rouge' | 'orange' | 'vert';
  sensorDistance: number; // cm
  thresholdDistance: number; // infraction detection threshold (e.g. 20cm)
  autoCycle: boolean;
  cycleTimer?: number;
}
