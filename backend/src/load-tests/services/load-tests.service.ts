import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  HttpMethod,
  LoadTest,
  LoadTestMode,
  LoadTestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LOAD_TEST_BULL_QUEUE } from '../../queue/queue.constants';
import { CreateLoadTestDto } from '../dto/create-load-test.dto';
import { QueryLoadTestsDto } from '../dto/query-load-tests.dto';
import { K6ExecutionService } from './k6-execution.service';

@Injectable()
export class LoadTestsService {
  private readonly logger = new Logger(LoadTestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly k6ExecutionService: K6ExecutionService,
    @Inject(LOAD_TEST_BULL_QUEUE) private readonly loadTestQueue: Queue,
  ) {}

  /**
   * Initiates a new load test, applies safety limits, persists record, and queues BullMQ job.
   */
  async create(dto: CreateLoadTestDto, userId?: string) {
    const maxVus = parseInt(process.env.LOAD_TEST_MAX_VUS || '500', 10);
    const maxDuration = parseInt(process.env.LOAD_TEST_MAX_DURATION || '3600', 10);
    const maxRequests = parseInt(process.env.LOAD_TEST_MAX_REQUESTS || '1000000', 10);

    const vus = dto.virtualUsers || 10;
    if (vus > maxVus) {
      throw new BadRequestException(
        `Virtual users (${vus}) exceeds server limit of ${maxVus}.`,
      );
    }

    const mode = dto.mode || LoadTestMode.DURATION;
    let duration = dto.duration;
    let requestCount = dto.requestCount;

    if (mode === LoadTestMode.DURATION) {
      duration = duration || 60;
      if (duration > maxDuration) {
        throw new BadRequestException(
          `Duration (${duration}s) exceeds server limit of ${maxDuration}s.`,
        );
      }
    } else if (mode === LoadTestMode.REQUEST_COUNT) {
      if (!requestCount || requestCount < 1) {
        throw new BadRequestException(
          'Request count must be specified and at least 1 in REQUEST_COUNT mode.',
        );
      }
      if (requestCount > maxRequests) {
        throw new BadRequestException(
          `Request count (${requestCount}) exceeds server limit of ${maxRequests}.`,
        );
      }
    }

    // Verify Project
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    // Verify API if provided
    if (dto.apiId) {
      const api = await this.prisma.api.findFirst({
        where: { id: dto.apiId, projectId: dto.projectId },
      });
      if (!api) {
        throw new NotFoundException(
          `API with ID ${dto.apiId} not found in project ${dto.projectId}`,
        );
      }
    }

    // Verify Environment if provided
    if (dto.environmentId) {
      const env = await this.prisma.environment.findUnique({
        where: { id: dto.environmentId },
      });
      if (!env) {
        throw new NotFoundException(
          `Environment with ID ${dto.environmentId} not found`,
        );
      }
    }

    // Create LoadTest record in database with status QUEUED
    const loadTest = await this.prisma.loadTest.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        projectId: dto.projectId,
        apiId: dto.apiId || null,
        environmentId: dto.environmentId || null,
        createdBy: userId || null,
        method: dto.method || HttpMethod.GET,
        url: dto.url.trim(),
        headers: (dto.headers || {}) as Prisma.InputJsonValue,
        queryParams: (dto.queryParams || {}) as Prisma.InputJsonValue,
        body: dto.body || null,
        authentication: (dto.authentication || {}) as Prisma.InputJsonValue,
        virtualUsers: vus,
        duration: duration || null,
        requestCount: requestCount || null,
        mode,
        timeout: dto.timeout || 5,
        status: LoadTestStatus.QUEUED,
      },
    });

    // Enqueue job into BullMQ
    try {
      await this.loadTestQueue.add(
        'run-load-test',
        { loadTestId: loadTest.id },
        {
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
      this.logger.log(`Enqueued load test job for testId=${loadTest.id} ("${loadTest.name}")`);
    } catch (queueErr: any) {
      this.logger.error(`Failed to enqueue load test ${loadTest.id}: ${queueErr.message}`, queueErr.stack);
      await this.prisma.loadTest.update({
        where: { id: loadTest.id },
        data: {
          status: LoadTestStatus.FAILED,
          errorMessage: `Failed to queue execution job: ${queueErr.message}`,
        },
      });
      throw new BadRequestException('Failed to queue load test execution.');
    }

    return {
      id: loadTest.id,
      name: loadTest.name,
      status: loadTest.status,
      createdAt: loadTest.createdAt,
    };
  }

  /**
   * Retrieves list of historical load tests with filtering and pagination.
   */
  async findAll(query: QueryLoadTestsDto) {
    const where: Prisma.LoadTestWhereInput = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.apiId) {
      where.apiId = query.apiId;
    }
    if (query.environmentId) {
      where.environmentId = query.environmentId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search && query.search.trim().length > 0) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { url: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.loadTest.findMany({
        where,
        include: {
          api: { select: { id: true, name: true } },
          environment: { select: { id: true, name: true, baseUrl: true } },
          project: { select: { id: true, name: true } },
          result: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.loadTest.count({ where }),
    ]);

    return {
      items,
      total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    };
  }

  /**
   * Retrieves a single load test with full result, samples, and live progress if RUNNING.
   */
  async findOne(id: string) {
    const loadTest = await this.prisma.loadTest.findUnique({
      where: { id },
      include: {
        api: true,
        environment: true,
        project: true,
        result: true,
        samples: {
          orderBy: { relativeSeconds: 'asc' },
        },
      },
    });

    if (!loadTest) {
      throw new NotFoundException(`Load test with ID ${id} not found`);
    }

    let liveProgress = null;
    if (loadTest.status === LoadTestStatus.RUNNING) {
      liveProgress = this.k6ExecutionService.getLiveProgress(id);
    }

    return {
      ...loadTest,
      liveProgress,
    };
  }

  /**
   * Cancels a queued or running load test safely.
   */
  async cancel(id: string) {
    const loadTest = await this.prisma.loadTest.findUnique({
      where: { id },
    });

    if (!loadTest) {
      throw new NotFoundException(`Load test with ID ${id} not found`);
    }

    if (
      loadTest.status === LoadTestStatus.COMPLETED ||
      loadTest.status === LoadTestStatus.FAILED ||
      loadTest.status === LoadTestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel load test because it is already in ${loadTest.status} state.`,
      );
    }

    if (loadTest.status === LoadTestStatus.QUEUED) {
      await this.prisma.loadTest.update({
        where: { id },
        data: {
          status: LoadTestStatus.CANCELLED,
          errorMessage: 'Cancelled by user before worker began execution.',
          completedAt: new Date(),
        },
      });
      return { message: 'Load test cancelled successfully', status: LoadTestStatus.CANCELLED };
    }

    // If RUNNING, stop process
    await this.k6ExecutionService.cancel(id);

    await this.prisma.loadTest.update({
      where: { id },
      data: {
        status: LoadTestStatus.CANCELLED,
        errorMessage: 'Cancelled by user during execution.',
        completedAt: new Date(),
      },
    });

    return { message: 'Load test cancelled successfully', status: LoadTestStatus.CANCELLED };
  }

  /**
   * Deletes a load test. Cancels if currently running.
   */
  async delete(id: string) {
    const loadTest = await this.prisma.loadTest.findUnique({
      where: { id },
    });

    if (!loadTest) {
      throw new NotFoundException(`Load test with ID ${id} not found`);
    }

    if (loadTest.status === LoadTestStatus.RUNNING) {
      await this.k6ExecutionService.cancel(id);
    }

    await this.prisma.loadTest.delete({
      where: { id },
    });

    return { message: 'Load test deleted successfully' };
  }
}
