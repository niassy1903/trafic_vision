import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { InfractionModel } from '../models/infraction';
import { SocketManager } from '../socket/socketManager';

export class ArduinoSerialListener {
  private static port: any = null;
  private static parser: any = null;
  private static isListening = false;

  /**
   * Initializes the Serial connection to Arduino
   */
  static init() {
    const isEnabled = process.env.SERIAL_ENABLED === 'true';
    const portPath = process.env.SERIAL_PORT || '/dev/cu.usbserial-10';
    const baudRate = Number(process.env.SERIAL_BAUD_RATE || 9600);

    if (!isEnabled) {
      console.log(`[Arduino Serial] Serial port interface is disabled by config (SERIAL_ENABLED="false").`);
      console.log(`[Arduino Serial] Standing by to process simulated virtual serial entries or manual events.`);
      return;
    }

    console.log(`[Arduino Serial] Attempting to open serial connection on ${portPath} at ${baudRate} baud...`);

    try {
      this.port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      // Attach status event hooks
      this.port.on('open', () => {
        console.log(`======================================================================`);
        console.log(`   🔌 ARDUINO SERIAL PORT CONNECTED SUCCESSFULLY ON: ${portPath}      `);
        console.log(`======================================================================`);
        this.isListening = true;
      });

      this.port.on('error', (err: any) => {
        console.error(`[Arduino Serial] Connection error on port ${portPath}:`, err.message);
        console.log(`[Arduino Serial] Retrying in 15 seconds, or verify your USB permissions / custom configurations.`);
        this.isListening = false;
        
        // Schedule auto reconnect
        setTimeout(() => this.reconnect(), 15000);
      });

      this.port.on('close', () => {
        console.log(`[Arduino Serial] Port connection closed on ${portPath}.`);
        this.isListening = false;
        setTimeout(() => this.reconnect(), 10000);
      });

      // Parse JSON packets line-by-line
      this.parser.on('data', async (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        console.log(`[Arduino Serial <= Received Raw Line]: "${trimmed}"`);

        try {
          // Parse JSON payload
          const payload = JSON.parse(trimmed);

          if (payload.type === 'status') {
            console.log(`[Arduino Serial => Status Packet]: Sensed light state "${payload.lightState || payload.etat_feu}" - distance to bar: ${payload.distance}cm`);
            
            // Register active connection heartbeat in real time
            SocketManager.updateLightStateAndDistance(
              (payload.lightState || payload.etat_feu || 'rouge') as 'rouge' | 'orange' | 'vert',
              Number(payload.distance) || 0
            );
          } else if (payload.type === 'infraction' || payload.type === 'feu_rouge_grille') {
            console.log(`[Arduino Serial => Infraction Packet ALERT!]: Sensed traffic breach! JSON content:`, payload);

            // Create record
            const newInfraction = await InfractionModel.create({
              type: payload.type || payload.infractionType || 'feu_rouge_grille',
              date_infraction: payload.date || payload.date_infraction || new Date().toISOString().split('T')[0],
              heure_infraction: payload.heure || payload.heure_infraction || new Date().toTimeString().split(' ')[0],
              distance: Number(payload.distance) || 0,
              etat_feu: payload.etat_feu || payload.lightState || 'rouge',
              message: payload.message || 'Infraction detectee par le radar laser'
            });

            // Double broadcast alerting in real time
            SocketManager.broadcastNewInfraction(newInfraction);

            // Re-fetch and propagate updated metrics
            const updatedStats = await InfractionModel.getStats();
            SocketManager.broadcastStats(updatedStats);
          } else {
            console.log(`[Arduino Serial => Information]: General data read:`, payload);
          }
        } catch (jsonErr: any) {
          console.warn(`[Arduino Serial => Parse Warning]: Could not parse line to valid JSON structure. Content: "${line}"`, jsonErr.message);
        }
      });

      // Try opening port
      this.port.open((err: any) => {
        if (err) {
          console.error(`[Arduino Serial] Failed to auto-open port:`, err.message);
          this.isListening = false;
          // Start a periodic check to self-heal/reconnect
          setTimeout(() => this.reconnect(), 15000);
        }
      });

    } catch (createErr: any) {
      console.error(`[Arduino Serial] Library error. Could not allocate port instance:`, createErr.message);
      this.isListening = false;
    }
  }

  /**
   * Reconnect handler
   */
  private static reconnect() {
    if (this.isListening) return;
    const isEnabled = process.env.SERIAL_ENABLED === 'true';
    if (!isEnabled) return;

    console.log(`[Arduino Serial] Attempting reconnection...`);
    if (this.port && !this.port.isOpen) {
      this.port.open((err: any) => {
        if (err) {
          console.warn(`[Arduino Serial] Reconnection attempt failed:`, err.message);
        } else {
          console.log(`[Arduino Serial] Reconnection succeeded!`);
        }
      });
    } else if (!this.port) {
      this.init();
    }
  }

  /**
   * Status API Helper
   */
  static isConnectionActive(): boolean {
    return this.isListening;
  }

  /**
   * Allows injecting a mockup raw line as if it were sent directly by Serial communication.
   * This guarantees client-side demonstration testing capability in virtualized online containers!
   */
  static simulateIncomingSerialLine(line: string) {
    console.log(`[Arduino Serial Sim] Simulating incoming Serial line text: "${line}"`);
    if (this.parser) {
      this.parser.emit('data', line);
    } else {
      // Direct parser emulator logic in case serialport engine is missing / offline
      this.emulateDirectLine(line);
    }
  }

  private static async emulateDirectLine(line: string) {
    try {
      const payload = JSON.parse(line);
      if (payload.type === 'status') {
        SocketManager.updateLightStateAndDistance(
          (payload.lightState || payload.etat_feu || 'rouge') as 'rouge' | 'orange' | 'vert',
          Number(payload.distance) || 0
        );
      } else if (payload.type === 'infraction' || payload.type === 'feu_rouge_grille') {
        const newRecord = await InfractionModel.create({
          type: payload.type || payload.infractionType || 'feu_rouge_grille',
          date_infraction: payload.date || payload.date_infraction || new Date().toISOString().split('T')[0],
          heure_infraction: payload.heure || payload.heure_infraction || new Date().toTimeString().split(' ')[0],
          distance: Number(payload.distance) || 0,
          etat_feu: payload.etat_feu || payload.lightState || 'rouge',
          message: payload.message || 'Infraction detectee par le radar laser (Simule Serial)'
        });

        SocketManager.broadcastNewInfraction(newRecord);

        const updatedStats = await InfractionModel.getStats();
        SocketManager.broadcastStats(updatedStats);
      }
    } catch (err: any) {
      console.warn(`[Arduino Serial Sim Error]:`, err.message);
    }
  }
}
