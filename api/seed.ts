import { PDO } from './PDO';
import { Infraction } from '../src/types';

/**
 * Seed historical data into the database using PDO wrapper
 */
export async function seedDatabase(db: PDO, force = false): Promise<void> {
  console.log("[Seeder] Checking database contents...");

  // Check if we already have records
  const checkStmt = db.prepare("SELECT * FROM infractions");
  const existing: Infraction[] = await checkStmt.execute();

  if (existing.length > 0 && !force) {
    console.log(`[Seeder] Database already populated with ${existing.length} records. Skipping seed.`);
    return;
  }

  console.log("[Seeder] Seeding database with historical infractions...");

  const now = new Date();
  const messages = [
    "Franchissement de feu rouge à vitesse élevée",
    "Véhicule arrêté au-delà de la ligne d'effet du signal",
    "Franchissement de feu rouge - vitesse modérée",
    "Non-respect de l'arrêt au feu rouge",
    "Véhicule n'ayant pas marqué l'arrêt réglementaire"
  ];

  // Helper to subtract days
  const subDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  };

  // Helper to format date
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper to format time
  const formatTime = (date: Date) => {
    return date.toTimeString().split(' ')[0];
  };

  const insertStmt = db.prepare(`
    INSERT INTO infractions (type, date_infraction, heure_infraction, distance, etat_feu, message, image_url, coordonnees, score_confiance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  // 1. Some infractions for today
  // Red light infractions
  for (let i = 0; i < 2; i++) {
    const d = new Date();
    d.setHours(now.getHours() - (i * 2 + 1), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
    
    await insertStmt.execute([
      "feu_rouge_grille",
      formatDate(d),
      formatTime(d),
      parseFloat((Math.random() * 15 + 5).toFixed(1)),
      "rouge",
      messages[Math.floor(Math.random() * messages.length)],
      null, null, null
    ]);
    count++;
  }

  // Motorcycle helmet infraction for today
  {
    const d = new Date();
    d.setHours(now.getHours() - 3, Math.floor(Math.random() * 60));
    await insertStmt.execute([
      "moto_sans_casque",
      formatDate(d),
      formatTime(d),
      0, // not applicable for laser distance usually
      "vert", // could be vert/orange/rouge
      "YOLO Tracking detect: Conducteur de moto circulant sans casque rigide",
      "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80",
      "[180, 110, 420, 390]",
      0.94
    ]);
    count++;
  }

  // 2. Infractions for this week (excluding today)
  for (let i = 1; i <= 6; i++) {
    const numForDay = Math.floor(Math.random() * 2) + 1; // 1 to 2 per day
    for (let j = 0; j < numForDay; j++) {
      const d = subDays(now, i);
      d.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      
      const isHelmetInf = Math.random() > 0.6; // ~30% chance of helmet infraction
      if (isHelmetInf) {
        await insertStmt.execute([
          "moto_sans_casque",
          formatDate(d),
          formatTime(d),
          0,
          "orange",
          "YOLO Tracking detect: Motocycliste sans casque sur voie publique",
          "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80",
          "[150, 90, 390, 410]",
          parseFloat((0.85 + Math.random() * 0.14).toFixed(2))
        ]);
      } else {
        await insertStmt.execute([
          "feu_rouge_grille",
          formatDate(d),
          formatTime(d),
          parseFloat((Math.random() * 16 + 4).toFixed(1)),
          "rouge",
          messages[Math.floor(Math.random() * messages.length)],
          null, null, null
        ]);
      }
      count++;
    }
  }

  // 3. Infractions for the rest of the month (excluding this week)
  for (let i = 7; i <= 28; i++) {
    const chance = Math.random();
    if (chance > 0.4) {
      const d = subDays(now, i);
      d.setHours(7 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 60), Math.floor(Math.random() * 65));
      
      const isHelmetInf = Math.random() > 0.7;
      if (isHelmetInf) {
        await insertStmt.execute([
          "moto_sans_casque",
          formatDate(d),
          formatTime(d),
          0,
          "vert",
          "YOLO Tracking detect: Motard circulant sur avenue sans équipement obligatoire (casque)",
          "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&auto=format&fit=crop&q=80",
          "[190, 100, 410, 380]",
          parseFloat((0.80 + Math.random() * 0.18).toFixed(2))
        ]);
      } else {
        await insertStmt.execute([
          "feu_rouge_grille",
          formatDate(d),
          formatTime(d),
          parseFloat((Math.random() * 18 + 2).toFixed(1)),
          "rouge",
          messages[Math.floor(Math.random() * messages.length)],
          null, null, null
        ]);
      }
      count++;
    }
  }

  console.log(`[Seeder] Successfully seeded ${count} infractions!`);
}
