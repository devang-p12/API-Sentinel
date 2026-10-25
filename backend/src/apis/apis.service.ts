import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiDto } from './dto/create-api.dto';

@Injectable()
export class ApisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateApiDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
    }

    return this.prisma.api.create({
      data: {
        name: dto.name,
        description: dto.description,
        projectId: dto.projectId,
      },
      include: {
        environments: true,
      },
    });
  }

  async findAll(projectId?: string) {
    return this.prisma.api.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        environments: {
          include: {
            monitors: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const api = await this.prisma.api.findUnique({
      where: { id },
      include: {
        environments: {
          include: {
            monitors: true,
          },
        },
      },
    });

    if (!api) {
      throw new NotFoundException(`API with ID ${id} not found`);
    }

    return api;
  }
}
