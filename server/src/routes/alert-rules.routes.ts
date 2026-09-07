import { Router } from 'express';
import { AlertRulesController } from '../controllers/alert-rules.controller';

const router = Router();
const controller = new AlertRulesController();

// Alert Rules CRUD routes
router.post('/', controller.create.bind(controller));
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.patch('/:id/toggle', controller.toggleEnabled.bind(controller));

export default router;
