import { ApiRepository, CreateApiDTO } from '../repositories/api.repository';
import { RegisterApiInput } from '../validators/api.validator';
import { query } from '../config/database';

export class ApiService {
  private repository: ApiRepository;

  constructor() {
    this.repository = new ApiRepository();
  }

  async testConnection() {
    const startTime = Date.now();
    const result = await query('SELECT NOW() AS current_time, current_database() AS db_name, version() AS pg_version;');
    const latency = Date.now() - startTime;
    return {
      connected: true,
      time: result.rows[0].current_time,
      database: result.rows[0].db_name,
      version: result.rows[0].pg_version,
      latencyMs: latency,
    };
  }

  async registerApi(input: RegisterApiInput) {
    const dto: CreateApiDTO = {
      name: input.name.trim(),
      description: input.description?.trim(),
      baseUrl: input.baseUrl.trim(),
      version: input.version || 'v1',
      environment: input.environment || 'development',
      authentication: input.authentication || 'api-key',
      authConfig: input.authConfig || {},
      scopes: input.scopes || { read: true, write: false, delete: false },
      apiKey: input.apiKey || undefined,
      status: input.status || 'Active',
      headers: input.headers || [],
      requestBody: input.requestBody,
      expectedStatus: input.expectedStatus || 200,
      applicationId: input.applicationId || undefined,
    };

    return await this.repository.create(dto);
  }

  async getApis(filters?: { environment?: string; status?: string; search?: string }) {
    return await this.repository.findAll(filters);
  }

  async getApiById(id: number) {
    return await this.repository.findById(id);
  }

  async deleteApi(id: number) {
    return await this.repository.delete(id);
  }
}
