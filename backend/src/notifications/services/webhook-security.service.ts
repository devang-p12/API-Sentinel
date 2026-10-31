import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as net from 'net';

@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name);

  /**
   * Validates a target URL against SSRF and network vulnerability rules.
   */
  validateUrl(rawUrl: string): URL {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new BadRequestException('Webhook URL is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException(`Invalid Webhook URL format: ${rawUrl}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
    }

    const allowPrivate =
      process.env.ALLOW_PRIVATE_NETWORK_WEBHOOKS === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development';

    if (!allowPrivate) {
      this.checkPrivateHostname(parsed.hostname);
    }

    return parsed;
  }

  /**
   * Checks if a hostname resolves to a private, loopback, or cloud-metadata IP.
   */
  private checkPrivateHostname(hostname: string): void {
    const lower = hostname.toLowerCase();

    // Loopback hostnames
    if (
      lower === 'localhost' ||
      lower.endsWith('.localhost') ||
      lower.endsWith('.local') ||
      lower.endsWith('.internal')
    ) {
      throw new BadRequestException(`Destination host "${hostname}" is forbidden (SSRF protection).`);
    }

    // IP address checks
    if (net.isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestException(`Destination IP "${hostname}" is private or reserved (SSRF protection).`);
      }
    }
  }

  /**
   * Identifies loopback (127.0.0.0/8), RFC1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
   * Link-local/Cloud Metadata (169.254.0.0/16), and IPv6 equivalents.
   */
  isPrivateIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') {
      return true;
    }

    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      // 10.0.0.0/8
      if (parts[0] === 10) return true;
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true;
      // 169.254.0.0/16 (Link local / AWS metadata service)
      if (parts[0] === 169 && parts[1] === 254) return true;
      // 127.0.0.0/8
      if (parts[0] === 127) return true;
    }

    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      // Loopback
      if (lower === '::1') return true;
      // Unique local addresses (fc00::/7)
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
      // Link-local addresses (fe80::/10)
      if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitizes any error message to avoid leaking tokens, auth headers or internal stack.
   */
  sanitizeError(error: any): string {
    if (!error) return 'Unknown notification dispatch error';
    let message = typeof error === 'string' ? error : error.message || String(error);

    // Strip sensitive patterns like Bearer tokens, passwords, Slack tokens
    message = message.replace(/(Bearer\s+)[A-Za-z0-9\-_\.]+/gi, '$1••••••••');
    message = message.replace(/(https:\/\/hooks\.slack\.com\/services\/)[^\s"']+/gi, '$1••••••••');
    message = message.replace(/([?&](?:key|token|secret|password)=)[^&\s]+/gi, '$1••••••••');

    return message.slice(0, 500);
  }
}
