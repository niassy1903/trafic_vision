import { Request, Response } from 'express';
import { InfractionModel } from '../models/infraction';
import { db } from '../config/db';
import { seedDatabase } from '../seed';
import { SocketManager } from '../socket/socketManager';
import { ArduinoSerialListener } from '../arduino/serialListener';

export class InfractionController {
  /**
   * Get server and connection details
   */
  static getStatus(req: Request, res: Response) {
    const isArduinoConnected = SocketManager.isArduinoConnected();
    const currentLightState = SocketManager.getCurrentLightState();
    res.json({
      status: 'online',
      arduinoConnected: isArduinoConnected,
      database: {
        mode: db.isFallbackMode() ? 'Fallback (JSON Database)' : 'MySQL (Live PDO Connection)',
        unconfigured: db.isFallbackMode()
      },
      currentLightState,
      lastPing: new Date(SocketManager.getLastArduinoContact()).toISOString()
    });
  }

  /**
   * Get unified system connections layout
   */
  static getSystemStatus(req: Request, res: Response) {
    const isArduinoConnected = SocketManager.isArduinoConnected() || ArduinoSerialListener.isConnectionActive();
    const isDatabaseConnected = !db.isFallbackMode();
    res.json({
      arduino: isArduinoConnected ? 'connecte' : 'deconnecte',
      database: isDatabaseConnected ? 'connectee' : 'deconnectee',
      socket: 'actif'
    });
  }

  /**
   * Fetch the absolute latest infractions trace from DB
   */
  static async latest(req: Request, res: Response) {
    try {
      const row = await InfractionModel.getLatest();
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  }

  /**
   * Fetch all recorded database logs
   */
  static async list(req: Request, res: Response) {
    try {
      const logs = await InfractionModel.getAll();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  }

  /**
   * Fetch traffic stats
   */
  static async getStats(req: Request, res: Response) {
    try {
      const stats = await InfractionModel.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  }

  /**
   * Create a new infraction
   */
  static async create(req: Request, res: Response) {
    const type = req.body.type || 'feu_rouge_grille';
    const date = req.body.date || req.body.date_infraction || new Date().toISOString().split('T')[0];
    const heure = req.body.heure || req.body.heure_infraction || new Date().toTimeString().split(' ')[0];
    const distance = req.body.distance !== undefined ? Number(req.body.distance) : 0;
    const etat_feu = req.body.etat_feu || 'rouge';
    const message = req.body.message || (type === 'moto_sans_casque' ? "Conducteur détecté sans casque de protection par caméra YOLOv8" : "Franchissement non autorisé de la ligne d'effet");
    const coordonnees = req.body.coordonnees || undefined;
    const score_confiance = req.body.score_confiance !== undefined ? Number(req.body.score_confiance) : undefined;

    // Get raw image from client payload
    const rawImage = req.body.image || req.body.image_url;
    let finalImageUrl = rawImage || undefined;

    // Save Base64 images directly onto the Express server local filesystem and serve them statically
    if (rawImage && rawImage.startsWith('data:image')) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const matches = rawImage.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const filename = `infraction_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const filepath = path.join(uploadsDir, filename);
          
          fs.writeFileSync(filepath, base64Data, 'base64');
          finalImageUrl = `/uploads/${filename}`;
          console.log(`[YOLO Image Process] Saved base64 image as standalone static file: ${filepath}`);
        }
      } catch (err: any) {
        console.error("[YOLO Image Process] Failed saving base64 content:", err.message);
      }
    }

    const data = {
      type,
      date_infraction: date,
      heure_infraction: heure,
      distance,
      etat_feu: etat_feu as any,
      message,
      image_url: finalImageUrl,
      coordonnees,
      score_confiance
    };

    try {
      const newRecord = await InfractionModel.create(data);
      
      // Update Socket connections instantly with real-time payload alerting!
      SocketManager.broadcastNewInfraction(newRecord);

      // Recalculate stats and broadcast
      const updatedStats = await InfractionModel.getStats();
      SocketManager.broadcastStats(updatedStats);

      res.status(201).json({
        success: true,
        message: 'Infraction enregistrée via PDO avec succès !',
        infraction: newRecord,
        stats: updatedStats
      });
    } catch (err: any) {
      console.error("[Controller CREATE] Failed inserting infraction:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Delete specific logs
   */
  static async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await InfractionModel.delete(id);
      
      if (success) {
        SocketManager.broadcastDelete(id);
      }
      
      const updatedStats = await InfractionModel.getStats();
      SocketManager.broadcastStats(updatedStats);

      res.json({
        success: true,
        message: success ? `Infraction ${id} supprimée avec succès` : `Infraction non trouvée`,
        stats: updatedStats
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Seed mock history database values
   */
  static async seed(req: Request, res: Response) {
    try {
      await seedDatabase(db, true);
      const stats = await InfractionModel.getStats();
      SocketManager.broadcastStats(stats);
      SocketManager.broadcastReset("Base de données réensemencée");

      res.json({
        success: true,
        message: 'Base de données réensemencée avec succès !',
        stats
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Clear all records
   */
  static async clearAll(req: Request, res: Response) {
    try {
      await InfractionModel.clearAll();
      const updatedStats = await InfractionModel.getStats();
      SocketManager.broadcastStats(updatedStats);
      SocketManager.broadcastReset("Base de données entièrement effacée");

      res.json({
        success: true,
        message: 'Base de données vidée avec succès'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
