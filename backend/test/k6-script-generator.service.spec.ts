import { K6ScriptGeneratorService } from './k6-script-generator.service';
import { HttpMethod, LoadTest, LoadTestMode, LoadTestStatus } from '@prisma/client';

describe('K6ScriptGeneratorService', () => {
  let generator: K6ScriptGeneratorService;

  beforeEach(() => {
    generator = new K6ScriptGeneratorService();
  });

  it('should generate a valid constant-vus script for DURATION mode', () => {
    const loadTest: LoadTest = {
      id: 'test-123',
      name: 'Stress Test',
      description: null,
      projectId: 'proj-1',
      apiId: 'api-1',
      environmentId: 'env-1',
      createdBy: null,
      method: HttpMethod.GET,
      url: '/delay/2',
      headers: { 'X-Custom-Header': 'Sentinel' },
      queryParams: { page: '1' },
      body: null,
      authentication: { type: 'bearer', token: 'secret-token-xyz' },
      virtualUsers: 25,
      duration: 30,
      requestCount: null,
      mode: LoadTestMode.DURATION,
      timeout: 10,
      status: LoadTestStatus.QUEUED,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const script = generator.generateScript(loadTest, 'https://httpbin.org');

    expect(script).toContain("executor: 'constant-vus'");
    expect(script).toContain('vus: 25');
    expect(script).toContain("duration: '30s'");
    expect(script).toContain('https://httpbin.org/delay/2?page=1');
    expect(script).toContain('Authorization');
    expect(script).toContain('Bearer secret-token-xyz');
    expect(script).toContain('X-Custom-Header');
    expect(script).toContain("timeout: '10000ms'");
  });

  it('should generate a shared-iterations script for REQUEST_COUNT mode', () => {
    const loadTest: LoadTest = {
      id: 'test-456',
      name: 'Volume Test',
      description: null,
      projectId: 'proj-1',
      apiId: null,
      environmentId: null,
      createdBy: null,
      method: HttpMethod.POST,
      url: 'https://httpbin.org/post',
      headers: { 'Content-Type': 'application/json' },
      queryParams: {},
      body: JSON.stringify({ item: 'laptop', price: 999 }),
      authentication: { type: 'none' },
      virtualUsers: 50,
      duration: null,
      requestCount: 5000,
      mode: LoadTestMode.REQUEST_COUNT,
      timeout: 5,
      status: LoadTestStatus.QUEUED,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const script = generator.generateScript(loadTest, null);

    expect(script).toContain("executor: 'shared-iterations'");
    expect(script).toContain('vus: 50');
    expect(script).toContain('iterations: 5000');
    expect(script).toContain('POST');
    expect(script).toContain('laptop');
  });

  it('should resolve full URLs without altering scheme', () => {
    const url = generator.resolveTargetUrl(
      'https://api.external.com/v1/resource',
      'http://localhost:4000',
    );
    expect(url).toBe('https://api.external.com/v1/resource');
  });

  it('should resolve relative URLs against environment baseUrl', () => {
    const url = generator.resolveTargetUrl('/orders/42', 'https://api.sentinel.com/v1/');
    expect(url).toBe('https://api.sentinel.com/v1/orders/42');
  });
});
