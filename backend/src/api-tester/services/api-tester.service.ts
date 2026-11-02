import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiRequestExecutionService } from './api-request-execution.service';
import { ExecuteRequestDto } from '../dto/execute-request.dto';
import { CreateCollectionDto, UpdateCollectionDto } from '../dto/create-collection.dto';
import { SaveRequestDto, UpdateSavedRequestDto } from '../dto/save-request.dto';
import { ApiExecutionResult, ApiRequestConfig } from '../interfaces/api-request-config.interface';

@Injectable()
export class ApiTesterService {
  private readonly logger = new Logger(ApiTesterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executionService: ApiRequestExecutionService,
  ) {}

  /**
   * Execute a request, optionally pulling environment configuration and recording history.
   */
  async executeRequest(dto: ExecuteRequestDto, organizationId?: string): Promise<ApiExecutionResult> {
    const mergedVariables: Record<string, string> = { ...(dto.variables || {}) };
    let targetUrl = dto.url;

    // If an environment is specified, load its baseUrl and configured variables
    if (dto.environmentId) {
      const env = await this.prisma.environment.findFirst({
        where: {
          id: dto.environmentId,
          ...(organizationId ? { organizationId } : {}),
        },
      });

      if (env) {
        if (env.baseUrl && !mergedVariables['baseUrl']) {
          mergedVariables['baseUrl'] = env.baseUrl.replace(/\/+$/, '');
        }

        if (env.variables && typeof env.variables === 'object') {
          for (const [k, v] of Object.entries(env.variables)) {
            if (!(k in mergedVariables) && v !== undefined && v !== null) {
              mergedVariables[k] = String(v);
            }
          }
        }

        // If targetUrl is relative or a path like "/users", resolve against baseUrl
        if (env.baseUrl && (targetUrl.startsWith('/') || !targetUrl.includes('://'))) {
          const base = env.baseUrl.replace(/\/+$/, '');
          const path = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
          targetUrl = `${base}${path}`;
        }
      }
    }

    const config: ApiRequestConfig = {
      method: dto.method,
      url: targetUrl,
      queryParams: dto.queryParams,
      headers: dto.headers,
      body: dto.body,
      bodyType: dto.bodyType,
      auth: dto.auth,
      timeout: dto.timeout,
      variables: mergedVariables,
      tests: dto.tests,
      projectId: dto.projectId,
      apiId: dto.apiId,
      environmentId: dto.environmentId,
    };

    const result = await this.executionService.execute(config);

    // Persist to history if enabled (default true)
    if (dto.saveToHistory !== false) {
      try {
        await this.prisma.apiRequestHistory.create({
          data: {
            projectId: dto.projectId || null,
            apiId: dto.apiId || null,
            environmentId: dto.environmentId || null,
            organizationId: organizationId || null,
            method: dto.method,
            url: dto.url,
            status: result.status,
            statusText: result.statusText,
            durationMs: result.durationMs,
            sizeBytes: result.size,
            error: result.error || null,
            requestSummary: {
              method: dto.method,
              url: dto.url,
              hasBody: !!dto.body,
              bodyType: dto.bodyType || 'none',
              hasAuth: !!dto.auth && dto.auth.type !== 'none',
              authType: dto.auth?.type || 'none',
              testsCount: dto.tests?.length || 0,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to record API request history: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Request History Operations
   */
  async getHistory(organizationId?: string, projectId?: string, limit = 50) {
    return this.prisma.apiRequestHistory.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        project: { select: { id: true, name: true } },
        api: { select: { id: true, name: true } },
        environment: { select: { id: true, name: true, baseUrl: true } },
      },
    });
  }

  async clearHistory(organizationId?: string, projectId?: string) {
    const result = await this.prisma.apiRequestHistory.deleteMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(projectId ? { projectId } : {}),
      },
    });
    return { count: result.count, message: 'History cleared successfully' };
  }

  /**
   * Collections Operations
   */
  async getCollections(organizationId?: string, projectId?: string) {
    return this.prisma.apiCollection.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        requests: {
          orderBy: { createdAt: 'asc' },
          include: {
            api: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true, baseUrl: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCollection(dto: CreateCollectionDto, organizationId?: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    return this.prisma.apiCollection.create({
      data: {
        projectId: dto.projectId,
        organizationId: project.organizationId,
        name: dto.name,
        description: dto.description || null,
      },
      include: {
        requests: true,
      },
    });
  }

  async updateCollection(id: string, dto: UpdateCollectionDto, organizationId?: string) {
    const exists = await this.prisma.apiCollection.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!exists) throw new NotFoundException(`Collection ${id} not found`);

    return this.prisma.apiCollection.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        requests: true,
      },
    });
  }

  async deleteCollection(id: string, organizationId?: string) {
    const exists = await this.prisma.apiCollection.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!exists) throw new NotFoundException(`Collection ${id} not found`);

    await this.prisma.apiCollection.delete({ where: { id } });
    return { message: 'Collection deleted successfully' };
  }

  /**
   * Saved Requests Operations
   */
  async saveRequest(dto: SaveRequestDto, organizationId?: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: dto.projectId,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    return this.prisma.savedApiRequest.create({
      data: {
        projectId: dto.projectId,
        organizationId: project.organizationId,
        collectionId: dto.collectionId || null,
        apiId: dto.apiId || null,
        environmentId: dto.environmentId || null,
        name: dto.name,
        description: dto.description || null,
        method: dto.method,
        url: dto.url,
        headers: dto.headers || {},
        queryParams: dto.queryParams || {},
        body: dto.body || null,
        bodyType: dto.bodyType || 'json',
        auth: dto.auth || {},
        tests: dto.tests || [],
        timeout: dto.timeout || 10000,
      },
      include: {
        collection: true,
        api: true,
        environment: true,
      },
    });
  }

  async getSavedRequest(id: string, organizationId?: string) {
    const req = await this.prisma.savedApiRequest.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        collection: true,
        api: true,
        environment: true,
        project: true,
      },
    });
    if (!req) throw new NotFoundException(`Saved request ${id} not found`);
    return req;
  }

  async updateSavedRequest(id: string, dto: UpdateSavedRequestDto, organizationId?: string) {
    const exists = await this.prisma.savedApiRequest.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!exists) throw new NotFoundException(`Saved request ${id} not found`);

    return this.prisma.savedApiRequest.update({
      where: { id },
      data: {
        ...(dto.collectionId !== undefined ? { collectionId: dto.collectionId } : {}),
        ...(dto.apiId !== undefined ? { apiId: dto.apiId } : {}),
        ...(dto.environmentId !== undefined ? { environmentId: dto.environmentId } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.method ? { method: dto.method } : {}),
        ...(dto.url ? { url: dto.url } : {}),
        ...(dto.headers ? { headers: dto.headers } : {}),
        ...(dto.queryParams ? { queryParams: dto.queryParams } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.bodyType ? { bodyType: dto.bodyType } : {}),
        ...(dto.auth ? { auth: dto.auth } : {}),
        ...(dto.tests ? { tests: dto.tests } : {}),
        ...(dto.timeout ? { timeout: dto.timeout } : {}),
      },
      include: {
        collection: true,
        api: true,
        environment: true,
      },
    });
  }

  async deleteSavedRequest(id: string, organizationId?: string) {
    const exists = await this.prisma.savedApiRequest.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!exists) throw new NotFoundException(`Saved request ${id} not found`);

    await this.prisma.savedApiRequest.delete({ where: { id } });
    return { message: 'Saved request deleted successfully' };
  }
}
