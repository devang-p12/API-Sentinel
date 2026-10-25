import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface AlertDimensions {
  apiId?: string | null;
  environmentId?: string | null;
  monitorId?: string | null;
  labels?: Record<string, any> | null;
}

@Injectable()
export class AlertFingerprintService {
  /**
   * Generates a deterministic, unique SHA-256 fingerprint for an alert rule
   * and its scoped dimensions. Used for deduplication and active instance tracking.
   */
  generateFingerprint(alertRuleId: string, dimensions: AlertDimensions = {}): string {
    const sortedLabels = dimensions.labels
      ? Object.keys(dimensions.labels)
          .sort()
          .map((k) => `${k}=${String(dimensions.labels![k])}`)
          .join(',')
      : '';

    const raw = [
      alertRuleId,
      dimensions.apiId || '',
      dimensions.environmentId || '',
      dimensions.monitorId || '',
      sortedLabels,
    ].join('|');

    return createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }
}
