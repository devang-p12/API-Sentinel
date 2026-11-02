import { Controller, Get, Param, Query } from '@nestjs/common';
import { HealthEvaluationService } from './health-evaluation.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('health')
export class HealthEvaluationController {
  constructor(private readonly healthEvaluationService: HealthEvaluationService) {}

  @Get('monitors/:id')
  getMonitorHealth(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('expectedStatus') expectedStatus?: string,
    @Query('latencyThreshold') latencyThreshold?: string,
  ) {
    const customPolicy = {
      ...(expectedStatus ? { expectedStatus: parseInt(expectedStatus, 10) } : {}),
      ...(latencyThreshold ? { degradedLatencyThresholdMs: parseInt(latencyThreshold, 10) } : {}),
    };
    return this.healthEvaluationService.evaluateMonitor(
      id,
      user?.organizationId,
      customPolicy,
    );
  }

  @Get('apis/:id')
  getApiHealth(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('expectedStatus') expectedStatus?: string,
    @Query('latencyThreshold') latencyThreshold?: string,
  ) {
    const customPolicy = {
      ...(expectedStatus ? { expectedStatus: parseInt(expectedStatus, 10) } : {}),
      ...(latencyThreshold ? { degradedLatencyThresholdMs: parseInt(latencyThreshold, 10) } : {}),
    };
    return this.healthEvaluationService.evaluateApi(
      id,
      user?.organizationId,
      customPolicy,
    );
  }

  @Get('environments/:id')
  getEnvironmentHealth(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('expectedStatus') expectedStatus?: string,
    @Query('latencyThreshold') latencyThreshold?: string,
  ) {
    const customPolicy = {
      ...(expectedStatus ? { expectedStatus: parseInt(expectedStatus, 10) } : {}),
      ...(latencyThreshold ? { degradedLatencyThresholdMs: parseInt(latencyThreshold, 10) } : {}),
    };
    return this.healthEvaluationService.evaluateEnvironment(
      id,
      user?.organizationId,
      customPolicy,
    );
  }
}
