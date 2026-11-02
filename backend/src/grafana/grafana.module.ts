import { Module } from '@nestjs/common';
import { GrafanaService } from './grafana.service';
import { GrafanaController } from './grafana.controller';

@Module({
  controllers: [GrafanaController],
  providers: [GrafanaService],
  exports: [GrafanaService],
})
export class GrafanaModule {}
