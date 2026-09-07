import { Request, Response, NextFunction } from 'express';
import { IncidentsService } from '../services/incidents.service';
import {
  listIncidentsQuerySchema,
  acknowledgeIncidentSchema,
  resolveIncidentSchema,
  addIncidentNoteSchema,
} from '../validators/incidents.validator';

const incidentsService = new IncidentsService();

function parsePositiveIntId(param: string): number | null {
  const parsed = parseInt(param, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export class IncidentsController {
  /**
   * GET /api/incidents
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = listIncidentsQuerySchema.parse(req.query);
      const result = await incidentsService.list({
        api_id: validatedQuery.api_id,
        environment: validatedQuery.environment,
        status: validatedQuery.status,
        severity: validatedQuery.severity,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
      });

      res.status(result.status).json({
        success: result.success,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: err.errors,
          },
        });
        return;
      }

      console.error('List Incidents Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve incidents.',
        },
      });
    }
  }

  /**
   * GET /api/incidents/:id
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (!id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Incident ID must be a positive integer' },
        });
        return;
      }

      const result = await incidentsService.getById(id);
      if (!result.success) {
        res.status(result.status).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(result.status).json({
        success: true,
        data: result.data,
      });
    } catch (err: any) {
      console.error('Get Incident Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve incident details.',
        },
      });
    }
  }

  /**
   * PATCH /api/incidents/:id/acknowledge
   */
  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (!id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Incident ID must be a positive integer' },
        });
        return;
      }

      const validatedBody = acknowledgeIncidentSchema.parse(req.body || {});
      const result = await incidentsService.acknowledge(id, validatedBody.note);

      if (!result.success) {
        res.status(result.status).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(result.status).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Acknowledge Incident Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to acknowledge incident.',
        },
      });
    }
  }

  /**
   * PATCH /api/incidents/:id/resolve
   */
  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (!id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Incident ID must be a positive integer' },
        });
        return;
      }

      const validatedBody = resolveIncidentSchema.parse(req.body || {});
      const result = await incidentsService.resolve(id, validatedBody.note);

      if (!result.success) {
        res.status(result.status).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(result.status).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Resolve Incident Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to resolve incident.',
        },
      });
    }
  }

  /**
   * POST /api/incidents/:id/notes
   */
  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (!id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Incident ID must be a positive integer' },
        });
        return;
      }

      const validatedBody = addIncidentNoteSchema.parse(req.body);
      const result = await incidentsService.addNote(id, validatedBody.note);

      if (!result.success) {
        res.status(result.status).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(result.status).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
        return;
      }

      console.error('Add Incident Note Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to add note to incident.',
        },
      });
    }
  }

  /**
   * GET /api/incidents/:id/timeline
   */
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parsePositiveIntId(req.params.id);
      if (!id) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Incident ID must be a positive integer' },
        });
        return;
      }

      const result = await incidentsService.getTimeline(id);
      if (!result.success) {
        res.status(result.status).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(result.status).json({
        success: true,
        data: result.data,
      });
    } catch (err: any) {
      console.error('Get Incident Timeline Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve incident timeline.',
        },
      });
    }
  }
}
