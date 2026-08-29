import { MonitoringRepository } from '../repositories/monitoring.repository';

export class MonitoringService {
  private repository: MonitoringRepository;

  constructor() {
    this.repository = new MonitoringRepository();
  }

  async updateConfig(apiId: number, config: { monitoringEnabled: boolean; monitoringInterval: number; timeout: number; degradedThresholdMs: number }) {
    return await this.repository.updateConfig(apiId, config);
  }

  async getLogs(apiId: number, limit?: number) {
    return await this.repository.getLogsByApiId(apiId, limit || 50);
  }

  async getDashboardStats() {
    return await this.repository.getDashboardStats();
  }

  async getApiHealthList(filters?: { environment?: string, status?: string }) {
    return await this.repository.getApiHealthList(filters);
  }

  async getApiHealthDetails(apiId: number) {
    return await this.repository.getApiHealthDetails(apiId);
  }
}
