import { Request, Response, NextFunction } from 'express';
import { ApiService } from '../services/api.service';
import { registerApiSchema } from '../validators/api.validator';

const apiService = new ApiService();

export class ApiController {
  async testDb(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await apiService.testConnection();
      res.json({
        success: true,
        message: 'PostgreSQL connected',
        data: result,
      });
    } catch (err: any) {
      console.error('PostgreSQL Connection Test Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Failed to connect to PostgreSQL database. Please ensure PostgreSQL is running and credentials are correct.',
        },
      });
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = registerApiSchema.parse(req.body);
      const createdApi = await apiService.registerApi(validatedData);

      res.status(201).json({
        success: true,
        message: 'API registered successfully',
        data: createdApi,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Register API Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to register API in database.',
        },
      });
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { environment, status, search } = req.query;
      const apis = await apiService.getApis({
        environment: typeof environment === 'string' ? environment : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });

      res.json({
        success: true,
        data: apis,
      });
    } catch (err: any) {
      console.error('List APIs Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve APIs from database.',
        },
      });
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'API ID must be a valid number' },
        });
        return;
      }

      const api = await apiService.getApiById(id);
      if (!api) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: api,
      });
    } catch (err: any) {
      console.error('Get API Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve API' },
      });
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'API ID must be a valid number' },
        });
        return;
      }

      const deleted = await apiService.deleteApi(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'API not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: 'API deleted successfully',
      });
    } catch (err: any) {
      console.error('Delete API Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete API' },
      });
    }
  }
}
