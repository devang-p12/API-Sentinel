import { Controller, Get } from '@nestjs/common';
import { CustomerDashboardService } from './customer-dashboard.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('customer-dashboard')
export class CustomerDashboardController {
  constructor(private readonly dashboardService: CustomerDashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: any) {
    return this.dashboardService.getDashboardSummary(user.organizationId);
  }

  @Get()
  getDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getDashboardSummary(user.organizationId);
  }
}
