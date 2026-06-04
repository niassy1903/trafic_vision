import { Router } from 'express';
import { InfractionController } from '../controllers/infractionController';
import { SerialController } from '../controllers/serialController';

const router = Router();

// Routes definition mapping to the InfractionController
router.get('/system', InfractionController.getSystemStatus);
router.get('/status', InfractionController.getStatus);
router.get('/stats', InfractionController.getStats);
router.get('/infractions', InfractionController.list);
router.get('/infractions/latest', InfractionController.latest);
router.post('/infractions', InfractionController.create);
router.delete('/infractions/:id', InfractionController.delete);
router.post('/seed', InfractionController.seed);
router.post('/clear-all', InfractionController.clearAll);

// Arduino USB Serial communication monitoring and system test endpoints
router.get('/serial/status', SerialController.getSerialStatus);
router.post('/serial/simulate', SerialController.simulateSerialInput);

export default router;
