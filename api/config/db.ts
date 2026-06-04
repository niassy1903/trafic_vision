import { PDO } from '../PDO';

export const db = new PDO({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'traffic_vision'
});

export async function connectDB(): Promise<boolean> {
  return await db.connect();
}
