import { Router } from 'express';
import { SchemaController } from '../controllers/schema.controller';

const router = Router();
const controller = new SchemaController();

// 1. Acknowledge a schema change event
router.patch('/changes/:changeId/acknowledge', controller.acknowledgeChange.bind(controller));

// 2. Recent schema changes for an API (registered before /:apiId/changes to avoid path ambiguity)
router.get('/:apiId/changes/recent', controller.getRecentChanges.bind(controller));

// 3. Paginated schema change history for an API
router.get('/:apiId/changes', controller.getChanges.bind(controller));

// 4. Schema version history for an API
router.get('/:apiId/history', controller.getHistory.bind(controller));

// 5. Current/latest schema for an API
router.get('/:apiId', controller.getCurrentSchema.bind(controller));

export default router;
