import { db } from '../config/db';
import { Infraction, Stats } from '../../src/types';

export class InfractionModel {
  /**
   * Fetch all infractions from database
   */
  static async getAll(): Promise<Infraction[]> {
    let query = "SELECT * FROM infractions";
    if (!db.isFallbackMode()) {
      query += " ORDER BY id DESC";
    }
    const stmt = db.prepare(query);
    return await stmt.execute();
  }

  /**
   * Fetch the single most recent infraction
   */
  static async getLatest(): Promise<Infraction | null> {
    const list = await this.getAll();
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => b.id - a.id);
    return sorted[0];
  }

  /**
   * Save a brand new infraction
   */
  static async create(data: {
    type: string;
    date_infraction: string;
    heure_infraction: string;
    distance: number;
    etat_feu: string;
    message: string;
    image_url?: string;
    coordonnees?: string;
    score_confiance?: number;
  }): Promise<Infraction> {
    const sql = `
      INSERT INTO infractions (type, date_infraction, heure_infraction, distance, etat_feu, message, image_url, coordonnees, score_confiance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertStmt = db.prepare(sql);
    const result = await insertStmt.execute([
      data.type,
      data.date_infraction,
      data.heure_infraction,
      data.distance,
      data.etat_feu,
      data.message,
      data.image_url || null,
      data.coordonnees || null,
      data.score_confiance || null
    ]);

    const insertedId = result?.insertId || Date.now();
    return {
      id: insertedId,
      type: data.type,
      date_infraction: data.date_infraction,
      heure_infraction: data.heure_infraction,
      distance: data.distance,
      etat_feu: data.etat_feu as 'rouge' | 'orange' | 'vert',
      message: data.message,
      image_url: data.image_url,
      coordonnees: data.coordonnees,
      score_confiance: data.score_confiance,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Delete specific infraction
   */
  static async delete(id: number): Promise<boolean> {
    const stmt = db.prepare("DELETE FROM infractions WHERE id = ?");
    const result = await stmt.execute([id]);
    const affected = result?.affectedRows || 0;
    return affected > 0;
  }

  /**
   * Clear all infraction entries from table or fallback JSON store
   */
  static async clearAll(): Promise<boolean> {
    const isFallback = db.isFallbackMode();
    const query = isFallback ? "DELETE FROM infractions" : "TRUNCATE TABLE infractions";
    const stmt = db.prepare(query);
    await stmt.execute();
    return true;
  }

  /**
   * Calculate live traffic vision insights
   */
  static async getStats(): Promise<Stats> {
    const isFallback = db.isFallbackMode();

    if (!isFallback) {
      try {
        const totalStmt = db.prepare("SELECT COUNT(*) as cnt FROM infractions");
        const rTotal = await totalStmt.execute();
        const total = Number(rTotal[0]?.cnt || 0);

        const todayStmt = db.prepare("SELECT COUNT(*) as cnt FROM infractions WHERE date_infraction >= CURDATE()");
        const rToday = await todayStmt.execute();
        const today = Number(rToday[0]?.cnt || 0);

        const weekStmt = db.prepare("SELECT COUNT(*) as cnt FROM infractions WHERE date_infraction >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
        const rWeek = await weekStmt.execute();
        const week = Number(rWeek[0]?.cnt || 0);

        const monthStmt = db.prepare("SELECT COUNT(*) as cnt FROM infractions WHERE date_infraction >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
        const rMonth = await monthStmt.execute();
        const month = Number(rMonth[0]?.cnt || 0);

        return { total, today, week, month };
      } catch (e) {
        console.warn("[InfractionModel] MySQL statistics failed, using local parser:", e);
      }
    }

    // JSON file store parsing fallback
    const infractions = await this.getAll();
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    infractions.forEach(i => {
      const infDate = new Date(i.date_infraction + 'T00:00:00');
      if (infDate >= startOfToday) todayCount++;
      if (infDate >= startOfWeek) weekCount++;
      if (infDate >= startOfMonth) monthCount++;
    });

    return {
      total: infractions.length,
      today: todayCount,
      week: weekCount,
      month: monthCount
    };
  }
}
