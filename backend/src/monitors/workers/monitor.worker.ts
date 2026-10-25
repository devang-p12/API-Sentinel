import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { MONITOR_QUEUE, REDIS_CONNECTION } from '../../queue/queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpProbeService } from '../services/http-probe.service';
import { MonitorExecutionService } from '../services/monitor-execution.service';
import { IncidentEvaluatorService } from '../../incidents/incident-evaluator.service';

export interface MonitorJobData {
  monitorId: string;
}

@Injectable()
export class MonitorWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorWorker.name);
  private worker: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly redisConnection: Redis,
    private readonly prisma: PrismaService,
    private readonly httpProbeService: HttpProbeService,
    private readonly executionService: MonitorExecutionService,
    private readonly incidentEvaluator: IncidentEvaluatorService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<MonitorJobData>(
      MONITOR_QUEUE,
      async (job: Job<MonitorJobData>) => {
        return this.process(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 10,
      },
    );

    this.worker.on('ready', () => {
      this.logger.log('MonitorWorker is connected to Redis and listening for jobs.');
    });

    this.worker.on('error', (err) => {
      this.logger.error(`MonitorWorker encountered an error: ${err.message}`, err.stack);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} failed with error: ${err.message}`);
    });
  }

  async process(job: Job<MonitorJobData>) {
    const { monitorId } = job.data;
    this.logger.log(`[Worker] Processing probe check for monitor ID: ${monitorId}`);

    try {
      const monitor = await this.prisma.monitor.findUnique({
        where: { id: monitorId },
        include: { environment: true },
      });

      if (!monitor) {
        this.logger.warn(`Monitor ${monitorId} not found in database. Skipping.`);
        return;
      }

      if (!monitor.isActive) {
        this.logger.log(`Monitor ${monitorId} is marked inactive. Skipping.`);
        return;
      }

      // Resolve full target URL
      let targetUrl = monitor.url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        const baseUrl = monitor.environment?.baseUrl || '';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
        targetUrl = `${cleanBase}${cleanPath}`;
      }

      // Merge environment variables / headers with monitor headers
      const envHeaders = (monitor.environment?.variables as Record<string, string>) || {};
      const monitorHeaders = (monitor.headers as Record<string, string>) || {};
      const mergedHeaders = { ...envHeaders, ...monitorHeaders };

      // Determine expected status code from assertions or default 200
      let expectedStatus = 200;
      const assertionsList = Array.isArray(monitor.assertions) ? (monitor.assertions as any[]) : [];
      const statusAssertion = assertionsList.find((a) => a && a.type === 'statusCode');
      if (statusAssertion && statusAssertion.expected) {
        expectedStatus = parseInt(statusAssertion.expected, 10);
      }

      // Execute probe (Agentless network call)
      const probeResult = await this.httpProbeService.probe({
        method: monitor.method,
        url: targetUrl,
        headers: mergedHeaders,
        body: monitor.body || undefined,
        timeoutMs: monitor.timeoutMs,
        expectedStatusCode: expectedStatus,
        assertions: Array.isArray(monitor.assertions) ? monitor.assertions : [],
      });

      // Persist telemetry record to PostgreSQL
      await this.executionService.recordExecution(monitor.id, probeResult);

      // Evaluate alert rules and incident state machine
      await this.incidentEvaluator.evaluateMonitor(monitor.id);

      return {
        monitorId: monitor.id,
        status: probeResult.status,
        statusCode: probeResult.statusCode,
        responseTimeMs: probeResult.responseTimeMs,
      };
    } catch (err: any) {
      this.logger.error(`Unexpected worker exception for monitor ${monitorId}: ${err.message}`, err.stack);
      // Even on unexpected exceptions, ensure worker stays alive
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('MonitorWorker closed gracefully.');
    }
  }
}
