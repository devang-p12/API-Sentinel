import { Router } from 'express';
import { LoadTestController } from '../controllers/load-test.controller';

const router = Router();
const controller = new LoadTestController();

// 1. Run Tests
router.post('/', controller.runSingle.bind(controller));
router.post('/run', controller.runSingle.bind(controller));
router.post('/run-all', controller.runAll.bind(controller));

// 2. Batch Progress
router.get('/batch/:batchId', controller.getBatchProgress.bind(controller));

// 3. Scheduler
router.get('/schedule/status', controller.getScheduleStatus.bind(controller));
router.post('/schedule/config', controller.updateSchedule.bind(controller));
router.post('/schedule/toggle', controller.updateSchedule.bind(controller));

// 4. History Queries
router.get('/', controller.listHistory.bind(controller));
router.get('/history', controller.listHistory.bind(controller));
router.get('/api/:apiId', controller.getByApiId.bind(controller));
router.get('/:id', controller.getById.bind(controller));

export default router;
