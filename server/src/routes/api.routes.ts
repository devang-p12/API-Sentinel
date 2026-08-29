import { Router } from 'express';
import { ApiController } from '../controllers/api.controller';

const router = Router();
const controller = new ApiController();

// Database connection health check
router.get('/db-test', controller.testDb.bind(controller));

// API Management CRUD routes
router.post('/apis', controller.register.bind(controller));
router.get('/apis', controller.list.bind(controller));
router.get('/apis/:id', controller.getById.bind(controller));
router.delete('/apis/:id', controller.delete.bind(controller));

export default router;
