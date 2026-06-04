import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initializeAPI } from './index';
import path from 'path';

async function bootstrapStandaloneAPI() {
  const app = express();
  const server = createServer(app);
  
  // Configure standalone socket.io server with CORS
  const io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
    }
  });

  const PORT = process.env.API_PORT || 3001;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve uploaded images statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Global CORS Middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  console.log('[API Standalone] Starting modular endpoints & socket links...');
  await initializeAPI(app, io);

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`  🚀 SWISS-QUALITY MODULAR TRAFFIC Vision API   `);
    console.log(`  Standalone Server Running on Port: ${PORT}  `);
    console.log(`===============================================`);
  });
}

// Execute standalone server startup
bootstrapStandaloneAPI();

export { bootstrapStandaloneAPI };
