import { Router } from 'express';
import { IncidentsController } from '../controllers/incidents.controller';

const router = Router();
const controller = new IncidentsController();

// Incident Management routes
router.get('/', controller.list.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id/acknowledge', controller.acknowledge.bind(controller));
router.patch('/:id/resolve', controller.resolve.bind(controller));
router.post('/:id/notes', controller.addNote.bind(controller));
router.get('/:id/timeline', controller.getTimeline.bind(controller));

export default router;
