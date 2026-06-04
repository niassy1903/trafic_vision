import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { initializeAPI } from './api/index';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Set up socket.io with robust CORS policies
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow connections from any origin
      methods: ['GET', 'POST']
    }
  });

  const PORT = 3000;

  // Middleware for parsing JSON requests with increased limits to allow base64 images from YOLO
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Serve uploaded images statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // CORS setup for api requests (helpful during development/simulators)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize all custom MySQL PDO-compliant endpoints and Socket listeners
  console.log('[Server] Connecting database and configuring Socket/REST controllers...');
  await initializeAPI(app, io);

  // Mount Vite or serve static code

  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Initializing Vite middleware in Development mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Serving production static files from dist/');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Handle SPA routing correctly
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Express & Socket.io server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Critical failure starting the server:', err);
});
