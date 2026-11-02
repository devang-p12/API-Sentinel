import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NormalizedSchemaNode,
  ProcessResponseOptions,
  SchemaComparisonResult,
} from './interfaces/schema-monitoring.interface';
import { SchemaNormalizer } from './schema-normalizer';
import { SchemaDiffEngine } from './schema-diff-engine';

@Injectable()
export class SchemaMonitoringService {
  private readonly logger = new Logger(SchemaMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes raw JSON response body into structural schema AST.
   */
  public normalizePayload(payload: any): NormalizedSchemaNode {
    return SchemaNormalizer.extractSchema(payload);
  }

  /**
   * Pure deterministic comparison between baseline schema and current schema.
   */
  public compareSchemas(
    baseline: NormalizedSchemaNode,
    current: NormalizedSchemaNode,
  ): SchemaComparisonResult {
    return SchemaDiffEngine.compare(baseline, current);
  }

  /**
   * Analyzes an API HTTP response against the established contract baseline:
   * 1. Extracts normalized schema representation.
   * 2. If no baseline exists, establishes initial baseline (Requirement 1).
   * 3. Compares response against baseline, recording differences (Requirement 2 & 4).
   * 4. Stores schema versions (Requirement 3).
   * 5. Flags breaking vs non-breaking changes (Requirement 5).
   */
  async processResponse(
    options: ProcessResponseOptions,
  ): Promise<
    SchemaComparisonResult & {
      schemaId: string;
      versionId?: string;
      isNewBaseline: boolean;
    }
  > {
    const {
      organizationId,
      apiId,
      environmentId,
      monitorConfigId,
      endpoint,
      method = 'GET',
      statusCode,
      responseBody,
      autoBaselineIfMissing = true,
    } = options;

    // We only capture schemas for successful responses (typically 2xx)
    if (statusCode < 200 || statusCode >= 300) {
      const normalizedCurrent = this.normalizePayload(responseBody);
      return {
        hasChanges: false,
        hasBreakingChanges: false,
        changeCount: 0,
        changes: [],
        summary: `HTTP ${statusCode} response skipped for contract schema evaluation.`,
        normalizedCurrent,
        schemaId: '',
        isNewBaseline: false,
      };
    }

    const normalizedCurrent = this.normalizePayload(responseBody);
    const checksum = SchemaNormalizer.computeChecksum(normalizedCurrent);

    // Find or create ApiSchema entry
    let schema = await this.prisma.apiSchema.findFirst({
      where: {
        organizationId,
        apiId,
        environmentId: environmentId || null,
        endpoint,
        method: method.toUpperCase(),
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!schema) {
      schema = await this.prisma.apiSchema.create({
        data: {
          organizationId,
          apiId,
          environmentId: environmentId || null,
          monitorConfigId: monitorConfigId || null,
          endpoint,
          method: method.toUpperCase(),
        },
        include: {
          versions: true,
        },
      });
      this.logger.log(
        `Created new ApiSchema for endpoint ${method.toUpperCase()} ${endpoint} (API: ${apiId})`,
      );
    }

    // Identify active baseline version
    let baselineVersion = schema.versions.find((v) => v.isBaseline);

    // Case 1: Initial Baseline Creation (Requirement 1)
    if (!baselineVersion) {
      if (!autoBaselineIfMissing) {
        return {
          hasChanges: false,
          hasBreakingChanges: false,
          changeCount: 0,
          changes: [],
          summary: 'No active baseline established for endpoint.',
          normalizedCurrent,
          schemaId: schema.id,
          isNewBaseline: false,
        };
      }

      const initialVersion = await this.prisma.schemaVersion.create({
        data: {
          schemaId: schema.id,
          versionNumber: 1,
          isBaseline: true,
          normalizedSchema: normalizedCurrent as any,
          samplePayload: responseBody,
          checksum,
          approvedAt: new Date(),
        },
      });

      await this.prisma.apiSchema.update({
        where: { id: schema.id },
        data: { activeBaselineVersionId: initialVersion.id },
      });

      this.logger.log(
        `Established initial baseline v1 for schema ${schema.id} (${method} ${endpoint})`,
      );

      return {
        hasChanges: false,
        hasBreakingChanges: false,
        changeCount: 0,
        changes: [],
        summary: 'Initial contract baseline established successfully.',
        normalizedCurrent,
        normalizedBaseline: normalizedCurrent,
        schemaId: schema.id,
        versionId: initialVersion.id,
        isNewBaseline: true,
      };
    }

    // Case 2: Compare against established active baseline (Requirement 2)
    const baselineNode = baselineVersion.normalizedSchema as unknown as NormalizedSchemaNode;
    const diffResult = this.compareSchemas(baselineNode, normalizedCurrent);

    let newVersionId: string | undefined;

    // Case 3: If differences detected, store new SchemaVersion & SchemaChange records (Requirement 3 & 4)
    if (diffResult.hasChanges) {
      const nextVersionNumber = (schema.versions[0]?.versionNumber || 1) + 1;

      const newVersion = await this.prisma.schemaVersion.create({
        data: {
          schemaId: schema.id,
          versionNumber: nextVersionNumber,
          isBaseline: false,
          normalizedSchema: normalizedCurrent as any,
          samplePayload: responseBody,
          checksum,
        },
      });
      newVersionId = newVersion.id;

      // Store detected changes in PostgreSQL
      if (diffResult.changes.length > 0) {
        await this.prisma.schemaChange.createMany({
          data: diffResult.changes.map((c) => ({
            schemaId: schema.id,
            versionId: newVersion.id,
            fieldPath: c.fieldPath,
            changeType: c.changeType as any,
            severity: c.severity as any,
            previousType: c.previousType || null,
            currentType: c.currentType || null,
            description: c.description,
            isBreaking: c.isBreaking,
          })),
        });
      }

      this.logger.warn(
        `Detected ${diffResult.changes.length} contract change(s) for ${method} ${endpoint}: ${diffResult.summary}`,
      );
    }

    return {
      ...diffResult,
      schemaId: schema.id,
      versionId: newVersionId,
      isNewBaseline: false,
    };
  }

  /**
   * Approves a new schema version as the active baseline (Requirement 6).
   */
  async approveNewBaseline(
    schemaId: string,
    versionId: string,
    organizationId: string,
    approvedByUserId?: string,
  ) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
    });

    if (!schema) {
      throw new NotFoundException(`Schema ${schemaId} not found in organization.`);
    }

    const targetVersion = await this.prisma.schemaVersion.findFirst({
      where: { id: versionId, schemaId },
    });

    if (!targetVersion) {
      throw new NotFoundException(`Schema version ${versionId} not found under schema.`);
    }

    // Unset existing baseline flag
    await this.prisma.schemaVersion.updateMany({
      where: { schemaId, isBaseline: true },
      data: { isBaseline: false },
    });

    // Set new baseline
    const updated = await this.prisma.schemaVersion.update({
      where: { id: versionId },
      data: {
        isBaseline: true,
        approvedAt: new Date(),
        createdByUserId: approvedByUserId || null,
      },
    });

    // Update parent pointer
    await this.prisma.apiSchema.update({
      where: { id: schemaId },
      data: { activeBaselineVersionId: versionId },
    });

    this.logger.log(
      `Approved schema version ${targetVersion.versionNumber} (${versionId}) as new baseline for schema ${schemaId}`,
    );

    return updated;
  }

  /**
   * Retrieves schema details by ID with active baseline.
   */
  async getSchemaById(schemaId: string, organizationId: string) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        changes: {
          orderBy: { detectedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!schema) {
      throw new NotFoundException(`Schema ${schemaId} not found in organization.`);
    }

    return schema;
  }

  /**
   * Lists schemas configured for a given API.
   */
  async getSchemasForApi(
    apiId: string,
    organizationId: string,
    environmentId?: string,
  ) {
    const where: any = { apiId, organizationId };
    if (environmentId) where.environmentId = environmentId;

    return this.prisma.apiSchema.findMany({
      where,
      include: {
        versions: {
          where: { isBaseline: true },
          take: 1,
        },
        _count: {
          select: {
            changes: true,
            versions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Lists historical changes recorded for a schema.
   */
  async getSchemaChanges(
    schemaId: string,
    organizationId: string,
    options?: { severity?: string; limit?: number },
  ) {
    await this.getSchemaById(schemaId, organizationId);

    const where: any = { schemaId };
    if (options?.severity) {
      where.severity = options.severity;
    }

    return this.prisma.schemaChange.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: options?.limit || 50,
      include: {
        version: {
          select: {
            versionNumber: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Lists all versions for a schema.
   */
  async getSchemaVersions(schemaId: string, organizationId: string) {
    await this.getSchemaById(schemaId, organizationId);

    return this.prisma.schemaVersion.findMany({
      where: { schemaId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Lists all schemas configured across the entire organization.
   */
  async getAllSchemasForOrganization(organizationId: string) {
    return this.prisma.apiSchema.findMany({
      where: { organizationId },
      include: {
        api: {
          select: { id: true, name: true },
        },
        environment: {
          select: { id: true, name: true, baseUrl: true },
        },
        versions: {
          where: { isBaseline: true },
          take: 1,
        },
        changes: {
          orderBy: { detectedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            changes: true,
            versions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Lists all schema changes across the entire organization.
   */
  async getAllChangesForOrganization(
    organizationId: string,
    options?: { severity?: string; apiId?: string; limit?: number },
  ) {
    const where: any = {
      schema: {
        organizationId,
        ...(options?.apiId ? { apiId: options.apiId } : {}),
      },
    };
    if (options?.severity && options.severity !== 'ALL') {
      where.severity = options.severity;
    }

    return this.prisma.schemaChange.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: options?.limit || 100,
      include: {
        schema: {
          include: {
            api: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
          },
        },
        version: {
          select: {
            versionNumber: true,
            createdAt: true,
          },
        },
      },
    });
  }
}
