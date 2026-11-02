import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestExecutionService } from '../request-execution/request-execution.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestExecutionService: RequestExecutionService,
  ) {}

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

    // Build candidate endpoint variants to ensure 100% reliable matching across full URLs, relative paths, and trailing slashes
    const endpointVariants = new Set<string>();
    endpointVariants.add(endpoint);
    endpointVariants.add(endpoint.trim());

    try {
      const dummyBase = 'http://sentinel.local';
      const parsed = new URL(
        endpoint.startsWith('http://') || endpoint.startsWith('https://')
          ? endpoint
          : `${dummyBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`,
      );
      const pn = parsed.pathname;
      endpointVariants.add(pn);
      endpointVariants.add(pn.replace(/\/+$/, '') || '/');
      endpointVariants.add(pn.replace(/^\/+/, ''));
      if (!pn.endsWith('/')) endpointVariants.add(`${pn}/`);
      if (!pn.startsWith('/')) endpointVariants.add(`/${pn}`);
    } catch {
      // ignore url parse error
    }

    // Find ApiSchema entry (try with apiId first, then fallback across organization if needed)
    let schema = await this.prisma.apiSchema.findFirst({
      where: {
        organizationId,
        ...(apiId ? { apiId } : {}),
        method: method.toUpperCase(),
        OR: [
          { endpoint: { in: Array.from(endpointVariants) } },
          ...(monitorConfigId ? [{ monitorConfigId }] : []),
        ],
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!schema && apiId) {
      // Fallback: search without strict apiId restriction in case probe was triggered under environment or different api container
      schema = await this.prisma.apiSchema.findFirst({
        where: {
          organizationId,
          method: method.toUpperCase(),
          OR: [
            { endpoint: { in: Array.from(endpointVariants) } },
            ...(monitorConfigId ? [{ monitorConfigId }] : []),
          ],
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });
    }

    if (!schema) {
      if (!autoBaselineIfMissing) {
        return {
          hasChanges: false,
          hasBreakingChanges: false,
          changeCount: 0,
          changes: [],
          summary: 'No active baseline established for endpoint.',
          normalizedCurrent,
          schemaId: '',
          isNewBaseline: false,
        };
      }

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

    // Case 3: If differences detected, store new SchemaVersion & SchemaChange records
    if (diffResult.hasChanges) {
      const latestVersion = schema.versions[0];
      const isAlreadyRecorded = latestVersion && latestVersion.checksum === checksum;

      if (isAlreadyRecorded) {
        // This exact schema drift state was already recorded in latestVersion.
        // Return diffResult without duplicating version numbers and change rows on every recurring probe ping!
        return {
          ...diffResult,
          schemaId: schema.id,
          versionId: latestVersion.id,
          isNewBaseline: false,
        };
      }

      const nextVersionNumber = (latestVersion?.versionNumber || 1) + 1;

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
    } else {
      // Endpoint conforms to baseline!
      // If there were unacknowledged changes from previous transient drift, resolve/acknowledge them
      const latestVersion = schema.versions[0];
      if (latestVersion && !latestVersion.isBaseline) {
        await this.prisma.schemaChange.updateMany({
          where: { schemaId: schema.id, isAcknowledged: false },
          data: { isAcknowledged: true },
        });
      }
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

  /**
   * Directly establishes an active contract base schema for an API endpoint.
   * Can either probe the endpoint live or accept a user-provided sample JSON / AST payload.
   */
  async setBaseSchema(options: {
    organizationId: string;
    apiId: string;
    environmentId?: string;
    endpoint: string;
    method?: string;
    samplePayload?: any;
    headers?: Record<string, string>;
    body?: any;
    queryParams?: Record<string, any>;
    fetchLive?: boolean;
    userId?: string;
  }) {
    const {
      organizationId,
      apiId,
      environmentId,
      endpoint,
      method = 'GET',
      headers = {},
      body,
      queryParams,
      fetchLive,
      userId,
    } = options;

    if (!apiId || !endpoint) {
      throw new BadRequestException('API ID and endpoint are required to establish a schema baseline.');
    }

    // Verify API belongs to organization
    const apiRecord = await this.prisma.api.findFirst({
      where: { id: apiId, organizationId },
      include: {
        environments: true,
      },
    });

    if (!apiRecord) {
      throw new NotFoundException(`API with ID ${apiId} not found in organization.`);
    }

    let payloadToUse = options.samplePayload;

    if (fetchLive || payloadToUse === undefined) {
      // Resolve target URL
      let targetUrl = endpoint.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        const selectedEnv = environmentId
          ? apiRecord.environments.find((e) => e.id === environmentId)
          : apiRecord.environments[0];

        const baseUrl = selectedEnv?.baseUrl || apiRecord.environments?.[0]?.baseUrl;
        if (!baseUrl) {
          throw new BadRequestException(
            'Unable to determine base URL. Please provide a full URL (e.g. https://api.com/users) or configure a Base URL on the environment.',
          );
        }
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
        targetUrl = `${cleanBase}${cleanPath}`;
      }

      this.logger.log(`Fetching live baseline from ${method.toUpperCase()} ${targetUrl}`);

      const execResult = await this.requestExecutionService.execute({
        method: method.toUpperCase(),
        url: targetUrl,
        headers,
        body,
        queryParams,
        timeoutMs: 15000,
      });

      if (!execResult.statusCode || execResult.statusCode < 200 || execResult.statusCode >= 300) {
        throw new BadRequestException(
          `Target endpoint returned HTTP ${execResult.statusCode || 'N/A'}: ${execResult.error || 'Expected 2xx successful response to establish contract baseline.'}`,
        );
      }

      payloadToUse =
        execResult.body !== undefined && execResult.body !== null
          ? execResult.body
          : execResult.rawBody
          ? JSON.parse(execResult.rawBody)
          : {};
    } else if (typeof payloadToUse === 'string') {
      try {
        payloadToUse = JSON.parse(payloadToUse);
      } catch (err: any) {
        throw new BadRequestException(`Invalid JSON payload provided: ${err.message}`);
      }
    }

    const normalized = this.normalizePayload(payloadToUse);
    const checksum = SchemaNormalizer.computeChecksum(normalized);

    // Upsert or find ApiSchema
    let schema = await this.prisma.apiSchema.findFirst({
      where: {
        organizationId,
        apiId,
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
          endpoint,
          method: method.toUpperCase(),
        },
        include: {
          versions: true,
        },
      });
    } else if (environmentId && schema.environmentId !== environmentId) {
      schema = await this.prisma.apiSchema.update({
        where: { id: schema.id },
        data: { environmentId },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });
    }

    // Unset prior baselines
    await this.prisma.schemaVersion.updateMany({
      where: { schemaId: schema.id, isBaseline: true },
      data: { isBaseline: false },
    });

    const nextVer = (schema.versions?.[0]?.versionNumber || 0) + 1;
    const newVersion = await this.prisma.schemaVersion.create({
      data: {
        schemaId: schema.id,
        versionNumber: nextVer,
        isBaseline: true,
        normalizedSchema: normalized as any,
        samplePayload: payloadToUse,
        checksum,
        createdByUserId: userId || null,
        approvedAt: new Date(),
      },
    });

    await this.prisma.apiSchema.update({
      where: { id: schema.id },
      data: { activeBaselineVersionId: newVersion.id },
    });

    // Mark existing drift issues as acknowledged for this new baseline
    await this.prisma.schemaChange.updateMany({
      where: { schemaId: schema.id, isAcknowledged: false },
      data: { isAcknowledged: true },
    });

    this.logger.log(
      `Set new active baseline v${nextVer} for schema ${schema.id} (${method.toUpperCase()} ${endpoint})`,
    );

    return {
      schema,
      version: newVersion,
      samplePayload: payloadToUse,
      normalizedSchema: normalized,
    };
  }

  /**
   * Verifies current schema against established active baseline by making a live HTTP call.
   * Records detected drift and returns comparison result.
   */
  async verifySchemaNow(
    schemaId: string,
    organizationId: string,
    options?: {
      headers?: Record<string, string>;
      body?: any;
      queryParams?: Record<string, any>;
    },
  ) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
      include: {
        api: {
          include: {
            environments: true,
          },
        },
        environment: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!schema) {
      throw new NotFoundException(`Schema contract with ID ${schemaId} not found.`);
    }

    const baselineVersion =
      schema.versions.find((v) => v.id === schema.activeBaselineVersionId) ||
      schema.versions.find((v) => v.isBaseline);

    if (!baselineVersion) {
      throw new BadRequestException('No active baseline established for this schema contract.');
    }

    let targetUrl = schema.endpoint.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const baseUrl =
        schema.environment?.baseUrl ||
        schema.api?.environments?.[0]?.baseUrl;

      if (!baseUrl) {
        throw new BadRequestException('Unable to resolve base URL for API endpoint.');
      }
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const cleanPath = targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`;
      targetUrl = `${cleanBase}${cleanPath}`;
    }

    const execResult = await this.requestExecutionService.execute({
      method: schema.method.toUpperCase(),
      url: targetUrl,
      headers: options?.headers,
      body: options?.body,
      queryParams: options?.queryParams,
      timeoutMs: 15000,
    });

    if (!execResult.statusCode) {
      throw new BadRequestException(`Failed to reach endpoint: ${execResult.error || 'Network connection failed'}`);
    }

    const responseBody =
      execResult.body !== undefined && execResult.body !== null
        ? execResult.body
        : execResult.rawBody
        ? JSON.parse(execResult.rawBody)
        : {};

    const diffResult = await this.processResponse({
      organizationId,
      apiId: schema.apiId,
      environmentId: schema.environmentId || undefined,
      endpoint: schema.endpoint,
      method: schema.method,
      statusCode: execResult.statusCode,
      responseBody,
      autoBaselineIfMissing: false,
    });

    return {
      ...diffResult,
      statusCode: execResult.statusCode,
      durationMs: execResult.durationMs,
      endpoint: targetUrl,
      method: schema.method,
    };
  }

  /**
   * Acknowledges a detected schema drift / change event.
   */
  async acknowledgeChange(changeId: string, organizationId: string) {
    const change = await this.prisma.schemaChange.findFirst({
      where: {
        id: changeId,
        schema: { organizationId },
      },
    });

    if (!change) {
      throw new NotFoundException(`Schema change record ${changeId} not found.`);
    }

    const updated = await this.prisma.schemaChange.update({
      where: { id: changeId },
      data: { isAcknowledged: true },
    });

    return { success: true, change: updated };
  }

  /**
   * Directly modifies the baseline schema definition of a schema contract.
   */
  async modifyBaseSchema(
    schemaId: string,
    organizationId: string,
    dto: {
      schemaJson?: any;
      samplePayload?: any;
    },
    userId?: string,
  ) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!schema) {
      throw new NotFoundException(`Schema contract ${schemaId} not found.`);
    }

    let normalized: NormalizedSchemaNode;
    let samplePayload: any = dto.samplePayload;

    if (dto.schemaJson !== undefined && dto.schemaJson !== null) {
      let rawJson = dto.schemaJson;
      if (typeof rawJson === 'string') {
        try {
          rawJson = JSON.parse(rawJson);
        } catch (err: any) {
          throw new BadRequestException(`Invalid schema JSON: ${err.message}`);
        }
      }

      // If rawJson is already a NormalizedSchemaNode:
      if (rawJson && typeof rawJson === 'object' && rawJson.type && typeof rawJson.type === 'string') {
        normalized = rawJson as NormalizedSchemaNode;
      } else {
        // It's a sample JSON payload
        normalized = this.normalizePayload(rawJson);
        if (!samplePayload) samplePayload = rawJson;
      }
    } else if (dto.samplePayload !== undefined && dto.samplePayload !== null) {
      let rawPayload = dto.samplePayload;
      if (typeof rawPayload === 'string') {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch (err: any) {
          throw new BadRequestException(`Invalid sample payload JSON: ${err.message}`);
        }
      }
      samplePayload = rawPayload;
      normalized = this.normalizePayload(rawPayload);
    } else {
      throw new BadRequestException('Either schemaJson or samplePayload must be provided.');
    }

    const checksum = SchemaNormalizer.computeChecksum(normalized);
    const nextVersionNumber = (schema.versions[0]?.versionNumber || 0) + 1;

    // Unset prior baseline flags
    await this.prisma.schemaVersion.updateMany({
      where: { schemaId: schema.id, isBaseline: true },
      data: { isBaseline: false },
    });

    const newVersion = await this.prisma.schemaVersion.create({
      data: {
        schemaId: schema.id,
        versionNumber: nextVersionNumber,
        isBaseline: true,
        normalizedSchema: normalized as any,
        samplePayload: samplePayload ?? null,
        checksum,
        createdByUserId: userId || null,
        approvedAt: new Date(),
      },
    });

    await this.prisma.apiSchema.update({
      where: { id: schema.id },
      data: { activeBaselineVersionId: newVersion.id },
    });

    // Mark previous unacknowledged changes as acknowledged since the user established a new baseline
    await this.prisma.schemaChange.updateMany({
      where: { schemaId: schema.id, isAcknowledged: false },
      data: { isAcknowledged: true },
    });

    this.logger.log(
      `User modified base schema for ${schema.id}. Established v${nextVersionNumber} as new baseline.`,
    );

    return {
      success: true,
      schema,
      version: newVersion,
    };
  }

  /**
   * Promotes the latest detected schema version as the active baseline contract.
   */
  async setCurrentAsBaseline(
    schemaId: string,
    organizationId: string,
    userId?: string,
  ) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!schema) {
      throw new NotFoundException(`Schema contract ${schemaId} not found.`);
    }

    if (!schema.versions || schema.versions.length === 0) {
      throw new BadRequestException('No schema versions recorded yet for this endpoint.');
    }

    const latestVersion = schema.versions[0];
    if (latestVersion.isBaseline) {
      return {
        success: true,
        schemaId: schema.id,
        versionId: latestVersion.id,
        versionNumber: latestVersion.versionNumber,
        message: 'Current schema is already the active baseline.',
      };
    }

    await this.approveNewBaseline(schema.id, latestVersion.id, organizationId, userId);

    // Also acknowledge outstanding changes
    await this.prisma.schemaChange.updateMany({
      where: { schemaId: schema.id, isAcknowledged: false },
      data: { isAcknowledged: true },
    });

    return {
      success: true,
      schemaId: schema.id,
      versionId: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      message: `Version v${latestVersion.versionNumber} successfully set as new baseline contract.`,
    };
  }

  /**
   * Acknowledges all outstanding changes for a schema.
   */
  async acknowledgeAllForSchema(schemaId: string, organizationId: string) {
    const schema = await this.prisma.apiSchema.findFirst({
      where: { id: schemaId, organizationId },
    });
    if (!schema) {
      throw new NotFoundException(`Schema contract ${schemaId} not found.`);
    }
    const result = await this.prisma.schemaChange.updateMany({
      where: { schemaId, isAcknowledged: false },
      data: { isAcknowledged: true },
    });
    return { success: true, count: result.count };
  }
}
