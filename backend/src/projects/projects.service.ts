import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, organizationId: string) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizationId,
      },
      include: {
        apis: true,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      include: {
        apis: {
          include: {
            environments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        apis: {
          include: {
            environments: {
              include: {
                monitors: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
