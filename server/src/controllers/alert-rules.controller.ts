import { Request, Response, NextFunction } from 'express';
import { AlertRulesService } from '../services/alert-rules.service';
import { createAlertRuleSchema, updateAlertRuleSchema, toggleEnabledSchema } from '../validators/alert-rules.validator';

const alertRulesService = new AlertRulesService();

export class AlertRulesController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createAlertRuleSchema.parse(req.body);
      const rule = await alertRulesService.createRule(validatedData);

      res.status(201).json({
        success: true,
        message: 'Alert rule created successfully',
        data: rule,
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

      console.error('Create Alert Rule Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create alert rule.',
        },
      });
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const apiId = req.query.api_id ? parseInt(req.query.api_id as string, 10) : undefined;
      const environment = typeof req.query.environment === 'string' ? req.query.environment : undefined;

      const rules = await alertRulesService.getRules({ apiId, environment });

      res.json({
        success: true,
        data: rules,
      });
    } catch (err: any) {
      console.error('List Alert Rules Error:', err.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve alert rules.',
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
          error: { code: 'INVALID_ID', message: 'Alert rule ID must be a valid number' },
        });
        return;
      }

      const rule = await alertRulesService.getRuleById(id);
      if (!rule) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert rule not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: rule,
      });
    } catch (err: any) {
      console.error('Get Alert Rule Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to retrieve alert rule' },
      });
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Alert rule ID must be a valid number' },
        });
        return;
      }

      const validatedData = updateAlertRuleSchema.parse(req.body);
      const rule = await alertRulesService.updateRule(id, validatedData);
      if (!rule) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert rule not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert rule updated successfully',
        data: rule,
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

      console.error('Update Alert Rule Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update alert rule' },
      });
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Alert rule ID must be a valid number' },
        });
        return;
      }

      const deleted = await alertRulesService.deleteRule(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert rule not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert rule deleted successfully',
      });
    } catch (err: any) {
      console.error('Delete Alert Rule Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete alert rule' },
      });
    }
  }

  async toggleEnabled(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_ID', message: 'Alert rule ID must be a valid number' },
        });
        return;
      }

      const validatedData = toggleEnabledSchema.parse(req.body);
      const rule = await alertRulesService.toggleEnabled(id, validatedData.is_enabled);
      if (!rule) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Alert rule not found' },
        });
        return;
      }

      res.json({
        success: true,
        message: `Alert rule ${validatedData.is_enabled ? 'enabled' : 'disabled'} successfully`,
        data: rule,
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

      console.error('Toggle Alert Rule Error:', err.message);
      res.status(500).json({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to toggle alert rule' },
      });
    }
  }
}
