import { Router } from 'express';
import { MonitoringController } from '../controllers/monitoring.controller';

const router = Router();
const controller = new MonitoringController();

router.patch('/:apiId/config', controller.updateConfig.bind(controller));
router.get('/:apiId/logs', controller.getLogs.bind(controller));
router.get('/dashboard/stats', controller.getDashboardStats.bind(controller));
router.get('/health', controller.getApiHealthList.bind(controller));
router.get('/:apiId/health-details', controller.getApiHealthDetails.bind(controller));

export default router;
