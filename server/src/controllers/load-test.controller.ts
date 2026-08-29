import { Request, Response, NextFunction } from 'express';
import { LoadTestService } from '../services/load-test.service';
import { SchedulerService } from '../services/scheduler.service';
import {
  runSingleLoadTestSchema,
  runAllLoadTestsSchema,
  scheduleConfigSchema,
} from '../validators/load-test.validator';

const loadTestService = new LoadTestService();
export const schedulerService = new SchedulerService(loadTestService);

export class LoadTestController {
  /**
   * Triggers a manual load test on a single registered API
   * POST /api/load-tests or POST /api/load-tests/run
   */
  async runSingle(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = runSingleLoadTestSchema.parse(req.body);
      const result = await loadTestService.runSingleApiLoadTest(validatedInput, 'manual');

      res.status(200).json({
        success: true,
        message: 'Load test completed successfully',
        data: result,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid load test parameters',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Single Load Test Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOAD_TEST_FAILED',
          message: err.message || 'An error occurred during load test execution',
        },
      });
    }
  }

  /**
   * Triggers batch load testing across all registered active APIs asynchronously
   * POST /api/load-tests/run-all
   */
  async runAll(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = runAllLoadTestsSchema.parse(req.body);
      const batchResult = await loadTestService.runAllApisLoadTestAsync(validatedInput, 'batch');

      res.status(202).json({
        success: true,
        message: batchResult.message,
        data: {
          batchId: batchResult.batchId,
          totalApis: batchResult.totalApis,
          virtualUsers: batchResult.virtualUsers,
          duration: batchResult.duration,
          concurrency: batchResult.concurrency,
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid batch load test parameters',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Batch Load Test Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_TEST_FAILED',
          message: err.message || 'Failed to start batch load test',
        },
      });
    }
  }

  /**
   * Retrieves batch progress and results
   * GET /api/load-tests/batch/:batchId
   */
  async getBatchProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { batchId } = req.params;
      if (!batchId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_BATCH_ID', message: 'Batch ID is required' },
        });
        return;
      }

      const progress = await loadTestService.getBatchStatus(batchId);
      if (!progress) {
        res.status(404).json({
          success: false,
          error: { code: 'BATCH_NOT_FOUND', message: `Batch ${batchId} not found` },
        });
        return;
      }

      res.json({
        success: true,
        data: progress,
      });
    } catch (err: any) {
      console.error('Get Batch Progress Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to retrieve batch progress' },
      });
    }
  }

  /**
   * Retrieves load test historical records
   * GET /api/load-tests
   */
  async listHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { apiId, batchId, status, triggerType, limit, offset } = req.query;

      const filters = {
        apiId: apiId ? parseInt(String(apiId), 10) : undefined,
        batchId: typeof batchId === 'string' ? batchId : undefined,
        status: typeof status === 'string' ? status : undefined,
        triggerType: typeof triggerType === 'string' ? triggerType : undefined,
        limit: limit ? parseInt(String(limit), 10) : 50,
        offset: offset ? parseInt(String(offset), 10) : 0,
      };

      const history = await loadTestService.getHistory(filters);
      res.json({
        success: true,
        data: history,
      });
    } catch (err: any) {
      console.error('List History Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve load test history' },
      });
    }
  }

  /**
   * Retrieves single test run details by ID
   * GET /api/load-tests/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Load test ID must be a valid integer' },
        });
        return;
      }

      const run = await loadTestService.getById(id);
      if (!run) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Load test run not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: run,
      });
    } catch (err: any) {
      console.error('Get Load Test Run Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve load test run' },
      });
    }
  }

  /**
   * Retrieves test history for a specific registered API
   * GET /api/load-tests/api/:apiId
   */
  async getByApiId(req: Request, res: Response, next: NextFunction) {
    try {
      const apiId = parseInt(req.params.apiId, 10);
      if (isNaN(apiId)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_API_ID', message: 'API ID must be a valid integer' },
        });
        return;
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

      const history = await loadTestService.getByApiId(apiId, limit, offset);
      res.json({
        success: true,
        data: history,
      });
    } catch (err: any) {
      console.error('Get By API ID Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve API test history' },
      });
    }
  }

  /**
   * Retrieves scheduler status and configuration
   * GET /api/load-tests/schedule/status
   */
  async getScheduleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = schedulerService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (err: any) {
      console.error('Get Schedule Status Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to retrieve scheduler status' },
      });
    }
  }

  /**
   * Updates scheduler configuration or toggles background scheduled execution
   * POST /api/load-tests/schedule/config or /schedule/toggle
   */
  async updateSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedConfig = scheduleConfigSchema.parse(req.body);
      const updatedStatus = schedulerService.updateConfig(validatedConfig);

      res.json({
        success: true,
        message: 'Scheduler configuration updated successfully',
        data: updatedStatus,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid schedule configuration',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Update Schedule Error:', err.message);
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SCHEDULE_CONFIG',
          message: err.message || 'Failed to update scheduler configuration',
        },
      });
    }
  }
}
