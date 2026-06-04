import { Server as SocketServer, Socket } from 'socket.io';
import { db } from '../config/db';
import { InfractionModel } from '../models/infraction';
import { Infraction, Stats } from '../../src/types';

export class SocketManager {
  private static io: SocketServer | null = null;
  private static currentLightState: 'rouge' | 'orange' | 'vert' = 'rouge';
  private static currentDistance = 100;
  private static lastArduinoContact = Date.now();

  /**
   * Initializes real-time listener behaviors
   */
  static init(io: SocketServer) {
    this.io = io;

    io.on('connection', async (socket: Socket) => {
      console.log(`[SocketManager] Client synced: ${socket.id}`);

      // Send current state vectors instantly
      try {
        const stats = await InfractionModel.getStats();
        socket.emit('lightStateUpdate', { state: this.currentLightState });
        socket.emit('distanceUpdate', { distance: this.currentDistance });
        socket.emit('systemStatusUpdate', {
          arduinoConnected: this.isArduinoConnected(),
          timestamp: new Date().toISOString(),
          databaseMode: db.isFallbackMode() ? 'SQLite Fallback (JSON)' : 'MySQL (Live PDO)'
        });
        socket.emit('statsUpdate', stats);
      } catch (e) {
        console.error("[SocketManager] Initial syncing error:", e);
      }

      // Sync request
      socket.on('requestStatsSync', async () => {
        const liveStats = await InfractionModel.getStats();
        socket.emit('statsUpdate', liveStats);
      });

      // Update light state
      socket.on('updateLightState', (payload: { state: 'rouge' | 'orange' | 'vert' }) => {
        this.currentLightState = payload.state;
        console.log(`[SocketManager] Light state matched to: ${payload.state}`);
        io.emit('lightStateUpdate', { state: this.currentLightState });
      });

      // Heartbeat from Arduino / Simulator
      socket.on('arduinoHeartbeat', () => {
        this.lastArduinoContact = Date.now();
        io.emit('systemStatusUpdate', {
          arduinoConnected: true,
          timestamp: new Date().toISOString(),
          databaseMode: db.isFallbackMode() ? 'SQLite Fallback (JSON)' : 'MySQL (Live PDO)'
        });
      });

      socket.on('disconnect', () => {
        console.log(`[SocketManager] Connection dissolved: ${socket.id}`);
      });
    });
  }

  static isArduinoConnected(): boolean {
    return (Date.now() - this.lastArduinoContact) < 10000;
  }

  static getCurrentLightState(): 'rouge' | 'orange' | 'vert' {
    return this.currentLightState;
  }

  static getCurrentDistance(): number {
    return this.currentDistance;
  }

  static getLastArduinoContact(): number {
    return this.lastArduinoContact;
  }

  /**
   * Updates state and broadcasts changes. Called by Arduino Serial module.
   */
  static updateLightStateAndDistance(state: 'rouge' | 'orange' | 'vert', distance: number) {
    this.currentLightState = state;
    this.currentDistance = distance;
    this.lastArduinoContact = Date.now();

    if (this.io) {
      this.io.emit('lightStateUpdate', { state: this.currentLightState });
      this.io.emit('distanceUpdate', { distance: this.currentDistance });
      
      this.io.emit('systemStatusUpdate', {
        arduinoConnected: true,
        timestamp: new Date().toISOString(),
        databaseMode: db.isFallbackMode() ? 'SQLite Fallback (JSON)' : 'MySQL (Live PDO)'
      });
    }
  }

  /**
   * Broadcast newly registered infraction JSON payload to all connected frontend clients
   */
  static broadcastNewInfraction(infraction: Infraction) {
    if (this.io) {
      this.lastArduinoContact = Date.now();
      const broadcastPayload = {
        ...infraction,
        date: infraction.date_infraction,
        heure: infraction.heure_infraction
      };
      console.log(`[SocketManager] Broadcasting real-time infraction JSON Alert:`, broadcastPayload);
      this.io.emit('newInfraction', broadcastPayload);
    }
  }

  /**
   * Broadcast re-calculated metrics structures
   */
  static broadcastStats(stats: Stats) {
    if (this.io) {
      this.io.emit('statsUpdate', stats);
    }
  }

  /**
   * Broadcast single deletion element
   */
  static broadcastDelete(id: number) {
    if (this.io) {
      this.io.emit('infractionDeleted', { id });
    }
  }

  /**
   * Broadcast clear/reset commands
   */
  static broadcastReset(message: string) {
    if (this.io) {
      this.io.emit('databaseReset', { message });
    }
  }
}
