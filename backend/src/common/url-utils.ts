import { BadRequestException } from '@nestjs/common';
import { EnvironmentType } from '@prisma/client';

/**
 * Validates that a URL is a valid HTTP/HTTPS URL and trims trailing slashes.
 */
export function validateAndNormalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new BadRequestException('Base URL is required and must be a string');
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException(
      `Invalid URL format: "${trimmed}". Must be a valid URL (e.g. https://api.example.com or http://localhost:4000)`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `Invalid URL protocol "${parsed.protocol}". Only "http:" and "https:" are allowed`,
    );
  }

  // Normalize: remove trailing slash from origin+pathname if pathname is just '/'
  const normalized = trimmed.replace(/\/+$/, '');
  return normalized;
}

/**
 * Strips sensitive embedded credentials (e.g. user:password@host -> user:***@host).
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}

/**
 * Masks internal/sensitive hosts so URLs are not exposed unnecessarily (Requirement 3).
 * e.g., https://internal-payment-svc.corp.domain.com:8443 -> https://in***.corp.domain.com:8443
 */
export function maskUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    let maskedHost = host;

    // Mask hostname segments if long or internal
    if (host === 'localhost' || host === '127.0.0.1') {
      maskedHost = host;
    } else {
      const parts = host.split('.');
      if (parts.length >= 2) {
        parts[0] = parts[0].length > 3 ? `${parts[0].slice(0, 3)}***` : '***';
        maskedHost = parts.join('.');
      } else if (host.length > 4) {
        maskedHost = `${host.slice(0, 3)}***`;
      }
    }

    const portStr = parsed.port ? `:${parsed.port}` : '';
    const pathStr = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${maskedHost}${portStr}${pathStr}`;
  } catch {
    return url;
  }
}

/**
 * Infers an EnvironmentType from environment naming heuristics if not explicitly supplied.
 */
export function inferEnvironmentType(name: string): EnvironmentType {
  const lower = name.toLowerCase();
  if (lower.includes('prod')) return EnvironmentType.PRODUCTION;
  if (lower.includes('stag')) return EnvironmentType.STAGING;
  if (lower.includes('uat')) return EnvironmentType.UAT;
  if (lower.includes('dev')) return EnvironmentType.DEVELOPMENT;
  return EnvironmentType.CUSTOM;
}
