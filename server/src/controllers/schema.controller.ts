import { Request, Response, NextFunction } from 'express';
import { SchemaRepository } from '../repositories/schema.repository';
import {
  apiIdParamSchema,
  changeIdParamSchema,
  getSchemaQuerySchema,
  getSchemaHistoryQuerySchema,
  getSchemaChangesQuerySchema,
  getRecentChangesQuerySchema,
} from '../validators/schema.validator';

export class SchemaController {
  private schemaRepository: SchemaRepository;

  constructor(repository?: SchemaRepository) {
    this.schemaRepository = repository || new SchemaRepository();
  }

  /**
   * Helper to format validation errors consistently
   */
  private handleValidationError(err: any, res: Response): boolean {
    if (err.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.errors[0]?.message || 'Invalid input data',
          details: err.errors,
        },
      });
      return true;
    }
    return false;
  }

  /**
   * GET /api/schemas/:apiId
   * Return the latest/current schema for the specified API and environment.
   */
  async getCurrentSchema(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { apiId } = apiIdParamSchema.parse(req.params);
      const { environment } = getSchemaQuerySchema.parse(req.query);

      const schema = await this.schemaRepository.getLatestSchema(apiId, environment);
      if (!schema) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No schema found for API ${apiId} in environment '${environment}'`,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          apiId: schema.apiId,
          environment: schema.environment,
          version: schema.version,
          isBaseline: schema.isBaseline,
          schemaDefinition: schema.schemaDefinition,
          sampleResponse: schema.sampleResponse ?? null,
          createdAt: schema.createdAt,
          updatedAt: schema.updatedAt,
        },
      });
    } catch (err: any) {
      if (this.handleValidationError(err, res)) return;

      console.error('Get Current Schema Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve current schema.',
        },
      });
    }
  }

  /**
   * GET /api/schemas/:apiId/history
   * Return schema version history for the specified API/environment in newest-first order.
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { apiId } = apiIdParamSchema.parse(req.params);
      const { environment, limit } = getSchemaHistoryQuerySchema.parse(req.query);

      const history = await this.schemaRepository.getSchemaHistory(apiId, environment, limit);

      res.status(200).json({
        success: true,
        data: history.map((item) => ({
          version: item.version,
          isBaseline: item.isBaseline,
          schemaDefinition: item.schemaDefinition,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      });
    } catch (err: any) {
      if (this.handleValidationError(err, res)) return;

      console.error('Get Schema History Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve schema history.',
        },
      });
    }
  }

  /**
   * GET /api/schemas/:apiId/changes
   * Return schema-change history for the specified API/environment in newest-first order.
   */
  async getChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { apiId } = apiIdParamSchema.parse(req.params);
      const { environment, limit, offset } = getSchemaChangesQuerySchema.parse(req.query);

      const changes = await this.schemaRepository.getSchemaChanges(
        apiId,
        environment,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: changes.map((c) => ({
          id: c.id,
          apiId: c.apiId,
          environment: c.environment,
          detectedAt: c.detectedAt,
          previousSchema: c.previousSchema,
          newSchema: c.newSchema,
          addedFields: c.addedFields,
          removedFields: c.removedFields,
          changedFieldTypes: c.changedFieldTypes,
          severity: c.severity,
          statusCode: c.statusCode,
          isAcknowledged: c.isAcknowledged,
        })),
      });
    } catch (err: any) {
      if (this.handleValidationError(err, res)) return;

      console.error('Get Schema Changes Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve schema changes.',
        },
      });
    }
  }

  /**
   * GET /api/schemas/:apiId/changes/recent
   * Return recent schema changes for the specified API/environment within the given minute window.
   */
  async getRecentChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { apiId } = apiIdParamSchema.parse(req.params);
      const { environment, minutes } = getRecentChangesQuerySchema.parse(req.query);

      // Retrieve recent schema changes using the existing repository method
      const allRecent = await this.schemaRepository.getRecentSchemaChanges(500);

      const cutoffTime = Date.now() - minutes * 60 * 1000;
      const filtered = allRecent.filter((change) => {
        const matchesApi = change.apiId === apiId;
        const matchesEnv = change.environment.toLowerCase() === environment.toLowerCase();
        const withinWindow = new Date(change.detectedAt).getTime() >= cutoffTime;
        return matchesApi && matchesEnv && withinWindow;
      });

      res.status(200).json({
        success: true,
        data: filtered.map((c) => ({
          id: c.id,
          apiId: c.apiId,
          environment: c.environment,
          detectedAt: c.detectedAt,
          previousSchema: c.previousSchema,
          newSchema: c.newSchema,
          addedFields: c.addedFields,
          removedFields: c.removedFields,
          changedFieldTypes: c.changedFieldTypes,
          severity: c.severity,
          statusCode: c.statusCode,
          isAcknowledged: c.isAcknowledged,
        })),
      });
    } catch (err: any) {
      if (this.handleValidationError(err, res)) return;

      console.error('Get Recent Schema Changes Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve recent schema changes.',
        },
      });
    }
  }

  /**
   * PATCH /api/schemas/changes/:changeId/acknowledge
   * Acknowledge a schema change event.
   */
  async acknowledgeChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { changeId } = changeIdParamSchema.parse(req.params);

      const updatedRecord = await this.schemaRepository.acknowledgeSchemaChange(changeId);
      if (!updatedRecord) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Schema change #${changeId} not found`,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Schema change acknowledged successfully',
        data: updatedRecord,
      });
    } catch (err: any) {
      if (this.handleValidationError(err, res)) return;

      console.error('Acknowledge Schema Change Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to acknowledge schema change.',
        },
      });
    }
  }
}
