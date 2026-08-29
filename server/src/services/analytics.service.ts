import { AnalyticsRepository, AnalyticsFilters } from '../repositories/analytics.repository';

export class AnalyticsService {
  private repository: AnalyticsRepository;

  constructor() {
    this.repository = new AnalyticsRepository();
  }

  private parseTimeRange(timeRange: string, customStartDate?: string, customEndDate?: string): { startDate: Date, endDate: Date, bucketInterval: string } {
    const endDate = customEndDate ? new Date(customEndDate) : new Date();
    let startDate = customStartDate ? new Date(customStartDate) : new Date();
    let bucketInterval = 'hour';

    if (!customStartDate) {
      switch (timeRange) {
        case '1h':
          startDate = new Date(endDate.getTime() - 1 * 60 * 60 * 1000);
          bucketInterval = 'minute'; // Group by minute for 1 hour
          break;
        case '6h':
          startDate = new Date(endDate.getTime() - 6 * 60 * 60 * 1000);
          bucketInterval = 'minute'; // Postgres doesn't easily do 5-minute with date_trunc natively without generate_series, so minute or hour. Let's use minute for fine grain.
          // Wait, 'minute' across 6 hours is 360 points. That's fine for recharts.
          break;
        case '24h':
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          bucketInterval = 'hour';
          break;
        case '7d':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          bucketInterval = 'hour';
          break;
        case '30d':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          bucketInterval = 'day';
          break;
        default:
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          bucketInterval = 'hour';
      }
    } else {
      // Custom date range bucketing heuristic
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (durationHours <= 12) bucketInterval = 'minute';
      else if (durationHours <= 24 * 14) bucketInterval = 'hour';
      else bucketInterval = 'day';
    }

    return { startDate, endDate, bucketInterval };
  }

  async getAnalytics(params: {
    apiId?: number;
    environment?: string;
    applicationId?: number;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { startDate, endDate, bucketInterval } = this.parseTimeRange(
      params.timeRange || '24h',
      params.startDate,
      params.endDate
    );

    const filters: AnalyticsFilters = {
      apiId: params.apiId,
      environment: params.environment,
      applicationId: params.applicationId,
      startDate,
      endDate
    };

    const [overall, timeseries, statusDistribution] = await Promise.all([
      this.repository.getOverallMetrics(filters),
      this.repository.getTimeseriesData(filters, bucketInterval),
      this.repository.getStatusDistribution(filters)
    ]);

    return {
      metrics: overall,
      timeseries,
      statusDistribution,
      meta: {
        startDate,
        endDate,
        bucketInterval
      }
    };
  }
}
