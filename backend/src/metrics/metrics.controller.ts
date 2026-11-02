import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class MetricsController {
  constructor(private readonly metricsService: PrometheusMetricsService) {}

  @Public()
  @Get(['metrics', 'api/v1/metrics'])
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
