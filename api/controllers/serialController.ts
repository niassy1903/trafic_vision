import { Request, Response } from 'express';
import { ArduinoSerialListener } from '../arduino/serialListener';

export class SerialController {
  /**
   * Fetch live connection status of local physical Arduino Serial Port
   */
  static getSerialStatus(req: Request, res: Response) {
    res.json({
      enabled: process.env.SERIAL_ENABLED === 'true',
      port: process.env.SERIAL_PORT || '/dev/cu.usbserial-10',
      baudRate: Number(process.env.SERIAL_BAUD_RATE || 9600),
      isListening: ArduinoSerialListener.isConnectionActive()
    });
  }

  /**
   * Ingest a mockup serial transmission (raw JSON string)
   * This is extremely valuable for testing when running in hosting environments where USB drivers are not bound!
   */
  static simulateSerialInput(req: Request, res: Response) {
    const { line } = req.body;

    if (!line) {
      return res.status(400).json({
        success: false,
        message: "Un paramètre 'line' contenant la trame brute (ex: un JSON au format string) est requis."
      });
    }

    try {
      // Ingest string line through our serial core decoder
      ArduinoSerialListener.simulateIncomingSerialLine(line);

      res.json({
        success: true,
        message: "Trame Série simulée transmise avec succès au décodeur de l'API !",
        ingestedLine: line
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'émulation du flux série",
        error: err.message
      });
    }
  }
}
