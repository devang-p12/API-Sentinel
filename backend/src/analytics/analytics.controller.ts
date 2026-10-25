import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('monitors/:id/analytics')
  getMonitorAnalytics(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bucket') bucket?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const bucketMinutes = bucket ? parseInt(bucket, 10) : 60;

    return this.analyticsService.getMonitorAnalytics(id, fromDate, toDate, bucketMinutes);
  }

  @Get('apis/:id/analytics')
  getApiAnalytics(@Param('id') id: string) {
    return this.analyticsService.getApiAnalytics(id);
  }
}
