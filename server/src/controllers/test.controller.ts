import { Request, Response, NextFunction } from 'express';
import { TestService } from '../services/test.service';
import { runTestSchema } from '../validators/test.validator';

const testService = new TestService();

export class TestController {
  async runTest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = runTestSchema.parse(req.body);
      const result = await testService.runTest(data);
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.name !== 'ZodError') {
        // Return network errors nicely instead of a generic 500
        res.status(400).json({
          success: false,
          error: {
            code: 'REQUEST_FAILED',
            message: err.message
          }
        });
        return;
      }
      next(err);
    }
  }
}
