import { io, Socket } from 'socket.io-client';

/**
 * Dynamic resolution of the Node.js API server host.
 * - If running in a local decoupled setup (Vite on port 5173, etc.), it points to the standalone API server (defaulting to localhost on port 3001).
 * - If running in the integrated workspace sandbox or a production deployment on the same origin, it uses the page's current protocol and hostname.
 */
export function getBackendUrl(): string {
  // Respect explicit public environment variable override if defined
  const metaEnv = (import.meta as any).env;
  const envUrl = metaEnv ? metaEnv.VITE_API_URL : undefined;
  if (envUrl) {
    return envUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  const { protocol, hostname, port } = window.location;

  // If local Vite development server is run separately (typically port 5173 / 5174)
  if (port === '5173' || port === '5174') {
    // Resolve to the default standalone Node.js Express server on port 3001
    return `${protocol}//${hostname}:3001`;
  }

  // Otherwise, use same-origin connection (production or integrated sandbox on port 3000)
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}

const BACKEND_URL = getBackendUrl();
console.log(`[API Service] Decoupled backend routing target resolved to: ${BACKEND_URL}`);

/**
 * Perform an HTTP fetch request against the decoupled API
 */
async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BACKEND_URL}${cleanEndpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response;
}

export const apiService = {
  /**
   * Get target backend service base URL
   */
  getBackendUrl,

  /**
   * HTTP GET Request helper
   */
  async get(endpoint: string): Promise<any> {
    const res = await fetchAPI(endpoint, { method: 'GET' });
    return await res.json();
  },

  /**
   * HTTP POST Request helper
   */
  async post(endpoint: string, data?: any): Promise<any> {
    const res = await fetchAPI(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
    return await res.json();
  },

  /**
   * HTTP DELETE Request helper
   */
  async delete(endpoint: string): Promise<any> {
    const res = await fetchAPI(endpoint, { method: 'DELETE' });
    return await res.json();
  },

  /**
   * Create a Socket.io WebSocket connection tied to the separated server
   */
  connectSocket(): Socket {
    console.log(`[Socket Link] Initiating WebSocket connection to decoupled server: ${BACKEND_URL}`);
    return io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });
  }
};
