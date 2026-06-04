import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { Infraction, Stats } from '../src/types';

// Fallback JSON persistence manager - resolves consistently regardless of root vs api subdirectory launch
const FALLBACK_DIR = path.join(process.cwd().endsWith('api') ? process.cwd() : path.join(process.cwd(), 'api'), 'data');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'database.json');

function ensureFallbackFile() {
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }
  if (!fs.existsSync(FALLBACK_FILE)) {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readFallback(): Infraction[] {
  ensureFallbackFile();
  try {
    const data = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    return JSON.parse(data) as Infraction[];
  } catch (e) {
    return [];
  }
}

function writeFallback(data: Infraction[]) {
  ensureFallbackFile();
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * PDOStatement mimics the PHP PDOStatement database interaction object.
 */
export class PDOStatement {
  constructor(
    private sql: string,
    private pool: Pool | null,
    private isFallbackActive: boolean
  ) {}

  /**
   * Executes a prepared statement with key parameters array
   */
  async execute(params: any[] = []): Promise<any> {
    if (!this.isFallbackActive && this.pool) {
      try {
        const [result] = await this.pool.execute(this.sql, params);
        return result;
      } catch (err: any) {
        console.error("[PDOStatement] Execution error, falling back:", err.message);
      }
    }

    // Process using JSON File Store fallback
    return this.executeFallback(params);
  }

  private executeFallback(params: any[] = []): any {
    // Basic SQL operations parser fallback for JSON store
    const lowerSql = this.sql.trim().toLowerCase();
    const records = readFallback();

    if (lowerSql.startsWith('select')) {
      // Return sorted reverse list for simple select all queries
      if (lowerSql.includes('order by')) {
        return [...records].reverse();
      }
      return records;
    }

    if (lowerSql.startsWith('insert')) {
      // Extract insert param values from array
      const type = params[0] || 'feu_rouge_grille';
      const date = params[1] || new Date().toISOString().split('T')[0];
      const heure = params[2] || new Date().toTimeString().split(' ')[0];
      const distance = Number(params[3]) || 0;
      const etatFeu = params[4] || 'rouge';
      const message = params[5] || 'Franchissement non autorisé';
      const imageUrl = params[6] || undefined;
      const coordonnees = params[7] || undefined;
      const scoreConfiance = params[8] !== undefined ? Number(params[8]) : undefined;

      const nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
      const newInf: Infraction = {
        id: nextId,
        type,
        date_infraction: date,
        heure_infraction: heure,
        distance,
        etat_feu: etatFeu,
        message,
        image_url: imageUrl,
        coordonnees,
        score_confiance: scoreConfiance,
        created_at: new Date().toISOString()
      };

      records.push(newInf);
      writeFallback(records);
      return { insertId: nextId, affectedRows: 1 };
    }

    if (lowerSql.startsWith('delete')) {
      // Simple delete operations parse
      if (lowerSql.includes('where')) {
        const idToDelete = params[0];
        if (idToDelete) {
          const initialLen = records.length;
          const filtered = records.filter(r => r.id !== Number(idToDelete));
          writeFallback(filtered);
          return { affectedRows: initialLen - filtered.length };
        }
      }
      return { affectedRows: 0 };
    }

    return { affectedRows: 0 };
  }
}

/**
 * PDO Class - Replicates PHP Data Objects (PDO) for Node.js MySQL backend
 */
export class PDO {
  private pool: Pool | null = null;
  private isFallback = true;
  private connectionDetails: any = {};

  constructor(config: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
  }) {
    this.connectionDetails = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: Number(config.port || process.env.DB_PORT || 3306),
      user: config.user || process.env.DB_USER || 'root',
      password: config.password || process.env.DB_PASSWORD || '',
      database: config.database || process.env.DB_NAME || 'traffic_vision'
    };
  }

  /**
   * Initializes the connection and migrates tables
   */
  async connect(): Promise<boolean> {
    try {
      console.log(`[PDO] Attempting to connect to MySQL database at ${this.connectionDetails.host}:${this.connectionDetails.port}...`);
      
      this.pool = mysql.createPool({
        host: this.connectionDetails.host,
        port: this.connectionDetails.port,
        user: this.connectionDetails.user,
        password: this.connectionDetails.password,
        database: this.connectionDetails.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      // Quick ping test
      const conn = await this.pool.getConnection();
      console.log(`[PDO] Connected successfully to MySQL database "${this.connectionDetails.database}".`);
      conn.release();
      this.isFallback = false;

      // Ensure base tables exist
      await this.ensureTables();
      return true;
    } catch (err: any) {
      console.warn(`[PDO] MySQL connection failed: ${err.message}. Enabling offline database fallback.`);
      this.isFallback = true;
      ensureFallbackFile();
      return false;
    }
  }

  /**
   * Exposes whether we are running in local JSON File storage fallback
   */
  isFallbackMode(): boolean {
    return this.isFallback;
  }

  /**
   * Prepares a SQL statement, returning a PDOStatement instance
   */
  prepare(sql: string): PDOStatement {
    return new PDOStatement(sql, this.pool, this.isFallback);
  }

  /**
   * Quick execution helper
   */
  async exec(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.prepare(sql);
    return await stmt.execute(params);
  }

  /**
   * Recreates the infractions structural table
   */
  private async ensureTables() {
    if (this.isFallback || !this.pool) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS infractions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          type VARCHAR(100) NOT NULL DEFAULT 'feu_rouge_grille',
          date_infraction DATE NOT NULL,
          heure_infraction TIME NOT NULL,
          distance FLOAT NOT NULL,
          etat_feu VARCHAR(20) NOT NULL DEFAULT 'rouge',
          message TEXT,
          image_url VARCHAR(255) NULL,
          coordonnees VARCHAR(100) NULL,
          score_confiance FLOAT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      
      // Safe Alter Table checking - add nullable fields if they were omitted in pre-existing setups
      try {
        await this.pool.query("ALTER TABLE infractions ADD COLUMN image_url VARCHAR(255) NULL");
      } catch (ee) {}
      try {
        await this.pool.query("ALTER TABLE infractions ADD COLUMN coordonnees VARCHAR(100) NULL");
      } catch (ee) {}
      try {
        await this.pool.query("ALTER TABLE infractions ADD COLUMN score_confiance FLOAT NULL");
      } catch (ee) {}

      console.log("[PDO] Confirmed table `infractions` is ready in MySQL with YOLO compatibility.");
    } catch (err: any) {
      console.error("[PDO] Failed creating tables:", err.message);
    }
  }
}
