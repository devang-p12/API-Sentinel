import { Injectable, Logger } from '@nestjs/common';
import {
  GrafanaHealthStatus,
  GrafanaDataSource,
  GrafanaDashboardSummary,
} from './interfaces/grafana.interface';

@Injectable()
export class GrafanaService {
  private readonly logger = new Logger(GrafanaService.name);

  // Server-only credentials — NEVER exposed to clients or stored in frontend variables
  private readonly grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3002';
  private readonly adminUser = process.env.GRAFANA_ADMIN_USER || 'admin';
  private readonly adminPassword = process.env.GRAFANA_ADMIN_PASSWORD || 'admin';

  private get authHeader(): string {
    const creds = Buffer.from(`${this.adminUser}:${this.adminPassword}`).toString('base64');
    return `Basic ${creds}`;
  }

  /**
   * Health check for internal Grafana connectivity.
   * Performs an HTTP probe to the Grafana /api/health endpoint.
   * Never exposes credentials in the response.
   */
  async checkHealth(): Promise<GrafanaHealthStatus> {
    const start = Date.now();
    const checkedAt = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${this.grafanaUrl}/api/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return {
          status: 'degraded',
          connected: false,
          latencyMs,
          error: `HTTP ${response.status}: ${response.statusText}`,
          checkedAt,
        };
      }

      const body = (await response.json()) as any;
      const databaseStatus = body.database || 'ok';
      const isHealthy = databaseStatus === 'ok';

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        connected: true,
        latencyMs,
        version: body.version || '11.3.0',
        database: databaseStatus,
        commit: body.commit,
        checkedAt,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const isAbort = err.name === 'AbortError';
      const errorMessage = isAbort ? 'Connection timed out (4000ms)' : err.message;

      this.logger.warn(`Internal Grafana health check failed: ${errorMessage}`);

      return {
        status: 'down',
        connected: false,
        latencyMs,
        error: errorMessage,
        checkedAt,
      };
    }
  }

  /**
   * Fetches provisioned and configured data sources from internal Grafana.
   * Verifies Prometheus and PostgreSQL internal connections.
   */
  async getDataSources(): Promise<GrafanaDataSource[]> {
    try {
      const response = await fetch(`${this.grafanaUrl}/api/datasources`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to list Grafana datasources: HTTP ${response.status}`);
        return [];
      }

      const data = (await response.json()) as any[];
      return data.map((ds) => ({
        id: ds.id,
        uid: ds.uid,
        name: ds.name,
        type: ds.type,
        url: ds.url,
        isDefault: !!ds.isDefault,
        jsonData: ds.jsonData,
      }));
    } catch (err: any) {
      this.logger.warn(`Could not reach Grafana to list datasources: ${err.message}`);
      return [];
    }
  }

  /**
   * Verifies if Prometheus is configured as a Grafana data source.
   */
  async getPrometheusDataSource(): Promise<GrafanaDataSource | null> {
    const datasources = await this.getDataSources();
    const prom = datasources.find(
      (ds) => ds.type === 'prometheus' || ds.name.toLowerCase().includes('prometheus'),
    );
    return prom || null;
  }

  /**
   * Retrieves list of internal engineering and observability dashboards.
   */
  async getInternalDashboards(): Promise<GrafanaDashboardSummary[]> {
    try {
      const response = await fetch(`${this.grafanaUrl}/api/search?type=dash-db`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to query Grafana dashboards: HTTP ${response.status}`);
        return [];
      }

      const list = (await response.json()) as any[];
      return list.map((d) => ({
        id: d.id,
        uid: d.uid,
        title: d.title,
        uri: d.uri,
        url: d.url,
        slug: d.slug,
        type: d.type,
        tags: d.tags || [],
        isStarred: !!d.isStarred,
      }));
    } catch (err: any) {
      this.logger.warn(`Could not reach Grafana to search dashboards: ${err.message}`);
      return [];
    }
  }

  /**
   * Loads an internal dashboard by UID.
   */
  async getDashboardByUid(uid: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.grafanaUrl}/api/dashboards/uid/${uid}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader,
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Could not fetch dashboard ${uid}: ${err.message}`);
      return null;
    }
  }

  /**
   * Creates or updates an internal engineering dashboard in Grafana.
   */
  async createOrUpdateDashboard(
    dashboard: any,
    folderUid?: string,
  ): Promise<{ uid: string; url: string; status: string }> {
    try {
      const payload = {
        dashboard,
        folderUid: folderUid || undefined,
        overwrite: true,
      };

      const response = await fetch(`${this.grafanaUrl}/api/dashboards/db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grafana API returned HTTP ${response.status}: ${errorText}`);
      }

      const resJson = (await response.json()) as any;
      return {
        uid: resJson.uid || dashboard.uid,
        url: resJson.url || '',
        status: resJson.status || 'success',
      };
    } catch (err: any) {
      this.logger.warn(`Failed to create or update internal dashboard: ${err.message}`);
      throw err;
    }
  }
}
