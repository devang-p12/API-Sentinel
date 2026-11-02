import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReliabilityScoreService } from './reliability-score.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('apis/:id/reliability-score')
export class ReliabilityScoreController {
  constructor(private readonly scoreService: ReliabilityScoreService) {}

  @Get()
  getReliabilityScore(
    @CurrentUser() user: any,
    @Param('id') apiId: string,
    @Query('environmentId') environmentId?: string,
    @Query('limit') limit?: string,
    @Query('w_avail') wAvail?: string,
    @Query('w_lat') wLat?: string,
    @Query('w_err') wErr?: string,
    @Query('w_stab') wStab?: string,
    @Query('w_schema') wSchema?: string,
    @Query('targetLatency') targetLatency?: string,
    @Query('maxLatency') maxLatency?: string,
  ) {
    const customConfig = {
      weights: {
        ...(wAvail ? { availabilityWeight: parseFloat(wAvail) } : {}),
        ...(wLat ? { latencyWeight: parseFloat(wLat) } : {}),
        ...(wErr ? { errorRateWeight: parseFloat(wErr) } : {}),
        ...(wStab ? { latencyStabilityWeight: parseFloat(wStab) } : {}),
        ...(wSchema ? { schemaStabilityWeight: parseFloat(wSchema) } : {}),
      },
      ...(targetLatency ? { targetLatencyMs: parseInt(targetLatency, 10) } : {}),
      ...(maxLatency ? { maxAcceptableLatencyMs: parseInt(maxLatency, 10) } : {}),
    };

    return this.scoreService.calculateForApi(apiId, user.organizationId, {
      environmentId,
      limit: limit ? parseInt(limit, 10) : 100,
      config: customConfig,
      persist: true,
    });
  }

  @Get('history')
  getScoreHistory(
    @CurrentUser() user: any,
    @Param('id') apiId: string,
    @Query('environmentId') environmentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.scoreService.getHistoricalScores({
      apiId,
      organizationId: user.organizationId,
      environmentId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Post('calculate')
  triggerCalculation(
    @CurrentUser() user: any,
    @Param('id') apiId: string,
    @Query('environmentId') environmentId?: string,
  ) {
    return this.scoreService.calculateForApi(apiId, user.organizationId, {
      environmentId,
      persist: true,
    });
  }
}
