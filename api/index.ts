import { Express } from 'express';
import { Server as SocketServer } from 'socket.io';
import { connectDB } from './config/db';
import { SocketManager } from './socket/socketManager';
import apiRoutes from './routes/apiRoutes';
import { seedDatabase } from './seed';
import { db } from './config/db';
import { ArduinoSerialListener } from './arduino/serialListener';

/**
 * Initializes the standalone API module.
 * Connects database, seeds mock logs, binds routes to express, and establishes Socket.io behavior.
 */
export async function initializeAPI(app: Express, io: SocketServer) {
  // 1. Initialize DB Connection using the custom MySQL PDO class
  console.log('[API Module] Attempting DB connection via PDO config...');
  await connectDB();

  // 2. Clear & seed default traffic insights on startup if empty
  try {
    await seedDatabase(db);
  } catch (err) {
    console.error('[API Module] Database seeding issue:', err);
  }

  // 3. Mount all custom REST API controllers cleanly
  console.log('[API Module] Registering decoupled Express router controllers under "/api/*"');
  app.use('/api', apiRoutes);

  // 4. Initialize Sockets with SocketManager
  console.log('[API Module] Spinning up SocketManager for real-time alerting & heartbeats...');
  SocketManager.init(io);

  // 5. Boot Up Serial connection links to physical Arduino board
  console.log('[API Module] Commencing physical serial listener threads...');
  ArduinoSerialListener.init();
}
