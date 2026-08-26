import { Router } from 'express';
import { TestController } from '../controllers/test.controller';

const router = Router();
const controller = new TestController();

router.post('/run', controller.runTest.bind(controller));

export default router;
