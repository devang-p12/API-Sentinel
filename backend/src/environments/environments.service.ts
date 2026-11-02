import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import {
  validateAndNormalizeUrl,
  sanitizeUrl,
  maskUrl,
  inferEnvironmentType,
} from '../common/url-utils';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to format environment for safe exposure (Requirement 3).
   */
  private formatEnvironment(env: any) {
    return {
      ...env,
      baseUrl: sanitizeUrl(env.baseUrl),
      maskedBaseUrl: maskUrl(env.baseUrl),
    };
  }

  async create(
    dto: CreateEnvironmentDto,
    organizationId: string,
    apiIdOverride?: string,
  ) {
    const targetApiId = apiIdOverride || dto.apiId;

    if (!targetApiId) {
      throw new BadRequestException('apiId is required to register an environment');
    }

    const api = await this.prisma.api.findFirst({
      where: { id: targetApiId, organizationId },
    });

    if (!api) {
      throw new NotFoundException(`API with ID ${targetApiId} not found`);
    }

    const trimmedName = dto.name.trim();

    // Check unique constraint within the API scope
    const existing = await this.prisma.environment.findUnique({
      where: {
        apiId_name: {
          apiId: targetApiId,
          name: trimmedName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Environment with name "${trimmedName}" already exists for this API`,
      );
    }

    const normalizedUrl = validateAndNormalizeUrl(dto.baseUrl);
    const envType = dto.type || inferEnvironmentType(trimmedName);

    const created = await this.prisma.environment.create({
      data: {
        name: trimmedName,
        baseUrl: normalizedUrl,
        type: envType,
        variables: dto.variables ?? {},
        apiId: targetApiId,
        organizationId,
      },
      include: {
        monitors: true,
      },
    });

    return this.formatEnvironment(created);
  }

  async findAll(organizationId: string, apiId?: string) {
    if (apiId) {
      const api = await this.prisma.api.findFirst({
        where: { id: apiId, organizationId },
      });

      if (!api) {
        throw new NotFoundException(`API with ID ${apiId} not found`);
      }
    }

    const environments = await this.prisma.environment.findMany({
      where: {
        organizationId,
        ...(apiId ? { apiId } : {}),
      },
      include: {
        monitors: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return environments.map((env) => this.formatEnvironment(env));
  }

  async findOne(id: string, organizationId: string) {
    const environment = await this.prisma.environment.findFirst({
      where: { id, organizationId },
      include: {
        api: true,
        monitors: true,
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment with ID ${id} not found`);
    }

    return this.formatEnvironment(environment);
  }

  async update(id: string, dto: UpdateEnvironmentDto, organizationId: string) {
    const existing = await this.findOne(id, organizationId);

    const trimmedName = dto.name !== undefined ? dto.name.trim() : undefined;

    if (trimmedName && trimmedName !== existing.name) {
      const conflict = await this.prisma.environment.findUnique({
        where: {
          apiId_name: {
            apiId: existing.apiId,
            name: trimmedName,
          },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Environment with name "${trimmedName}" already exists for this API`,
        );
      }
    }

    const normalizedUrl =
      dto.baseUrl !== undefined ? validateAndNormalizeUrl(dto.baseUrl) : undefined;
    const envType = dto.type !== undefined ? dto.type : undefined;

    const updated = await this.prisma.environment.update({
      where: { id },
      data: {
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(normalizedUrl !== undefined ? { baseUrl: normalizedUrl } : {}),
        ...(envType !== undefined ? { type: envType } : {}),
        ...(dto.variables !== undefined ? { variables: dto.variables } : {}),
      },
      include: {
        monitors: true,
      },
    });

    return this.formatEnvironment(updated);
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    await this.prisma.environment.delete({
      where: { id },
    });

    return { message: 'Environment deleted successfully', id };
  }
}

