import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SchemaMonitoringService } from './schema-monitoring.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class SchemaMonitoringController {
  constructor(private readonly schemaService: SchemaMonitoringService) {}

  @Get('apis/:id/schemas')
  getSchemasForApi(
    @CurrentUser() user: any,
    @Param('id') apiId: string,
    @Query('environmentId') environmentId?: string,
  ) {
    return this.schemaService.getSchemasForApi(
      apiId,
      user.organizationId,
      environmentId,
    );
  }

  @Post('apis/:id/schemas/check')
  checkResponseContract(
    @CurrentUser() user: any,
    @Param('id') apiId: string,
    @Body()
    dto: {
      endpoint: string;
      method?: string;
      environmentId?: string;
      statusCode?: number;
      responseBody: any;
      autoBaselineIfMissing?: boolean;
    },
  ) {
    return this.schemaService.processResponse({
      organizationId: user.organizationId,
      apiId,
      environmentId: dto.environmentId,
      endpoint: dto.endpoint,
      method: dto.method || 'GET',
      statusCode: dto.statusCode ?? 200,
      responseBody: dto.responseBody,
      autoBaselineIfMissing: dto.autoBaselineIfMissing !== false,
    });
  }

  @Get('schemas')
  getAllSchemas(@CurrentUser() user: any) {
    return this.schemaService.getAllSchemasForOrganization(user.organizationId);
  }

  @Get('schemas/changes/all')
  getAllChanges(
    @CurrentUser() user: any,
    @Query('severity') severity?: string,
    @Query('apiId') apiId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schemaService.getAllChangesForOrganization(user.organizationId, {
      severity,
      apiId,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('schemas/:id')
  getSchema(
    @CurrentUser() user: any,
    @Param('id') schemaId: string,
  ) {
    return this.schemaService.getSchemaById(schemaId, user.organizationId);
  }

  @Get('schemas/:id/versions')
  getSchemaVersions(
    @CurrentUser() user: any,
    @Param('id') schemaId: string,
  ) {
    return this.schemaService.getSchemaVersions(schemaId, user.organizationId);
  }

  @Get('schemas/:id/changes')
  getSchemaChanges(
    @CurrentUser() user: any,
    @Param('id') schemaId: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    return this.schemaService.getSchemaChanges(schemaId, user.organizationId, {
      severity,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post('schemas/:id/approve-baseline/:versionId')
  approveBaseline(
    @CurrentUser() user: any,
    @Param('id') schemaId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.schemaService.approveNewBaseline(
      schemaId,
      versionId,
      user.organizationId,
      user.userId,
    );
  }
}
