import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnvironmentDto, apiIdOverride?: string) {
    const targetApiId = apiIdOverride || dto.apiId;

    if (!targetApiId) {
      throw new BadRequestException('apiId is required to register an environment');
    }

    const api = await this.prisma.api.findUnique({
      where: { id: targetApiId },
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

    return this.prisma.environment.create({
      data: {
        name: trimmedName,
        baseUrl: dto.baseUrl.trim(),
        variables: dto.variables ?? {},
        apiId: targetApiId,
      },
      include: {
        monitors: true,
      },
    });
  }

  async findAll(apiId?: string) {
    if (apiId) {
      const api = await this.prisma.api.findUnique({
        where: { id: apiId },
      });

      if (!api) {
        throw new NotFoundException(`API with ID ${apiId} not found`);
      }
    }

    return this.prisma.environment.findMany({
      where: apiId ? { apiId } : undefined,
      include: {
        monitors: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const environment = await this.prisma.environment.findUnique({
      where: { id },
      include: {
        api: true,
        monitors: true,
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment with ID ${id} not found`);
    }

    return environment;
  }

  async update(id: string, dto: UpdateEnvironmentDto) {
    const existing = await this.prisma.environment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Environment with ID ${id} not found`);
    }

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

    return this.prisma.environment.update({
      where: { id },
      data: {
        name: trimmedName,
        baseUrl: dto.baseUrl !== undefined ? dto.baseUrl.trim() : undefined,
        variables: dto.variables,
      },
      include: {
        monitors: true,
      },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.environment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Environment with ID ${id} not found`);
    }

    return this.prisma.environment.delete({
      where: { id },
    });
  }
}
