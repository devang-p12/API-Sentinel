import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();
const controller = new AnalyticsController();

router.get('/', (req, res) => controller.getAnalytics(req, res));

export default router;
