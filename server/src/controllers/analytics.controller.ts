import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  private service: AnalyticsService;

  constructor() {
    this.service = new AnalyticsService();
  }

  async getAnalytics(req: Request, res: Response) {
    try {
      const { apiId, environment, applicationId, timeRange, startDate, endDate } = req.query;

      const data = await this.service.getAnalytics({
        apiId: apiId ? parseInt(apiId as string, 10) : undefined,
        environment: environment as string,
        applicationId: applicationId ? parseInt(applicationId as string, 10) : undefined,
        timeRange: timeRange as string,
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.json(data);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
}
