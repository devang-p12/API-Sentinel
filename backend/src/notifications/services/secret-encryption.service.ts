import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class SecretEncryptionService {
  private readonly logger = new Logger(SecretEncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const rawKey =
      process.env.NOTIFICATION_ENCRYPTION_KEY ||
      process.env.SECRET_ENCRYPTION_KEY ||
      'api-sentinel-notification-master-key-32b!';
    // Derive a fixed 32-byte key using SHA-256
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM
   * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
   */
  encrypt(plainText: string): string {
    if (!plainText) return plainText;
    if (plainText.startsWith('enc:v1:')) return plainText; // already encrypted

    try {
      const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err: any) {
      this.logger.error(`Failed to encrypt secret: ${err.message}`);
      throw new Error('Encryption error');
    }
  }

  /**
   * Decrypts ciphertext formatted as enc:v1:<iv>:<tag>:<ciphertext>
   */
  decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.startsWith('enc:v1:')) {
      return cipherText;
    }

    try {
      const parts = cipherText.split(':');
      if (parts.length !== 5) {
        throw new Error('Malformed encrypted secret payload');
      }
      const [, , ivHex, tagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      this.logger.error(`Failed to decrypt secret: ${err.message}`);
      return '[DECRYPTION_FAILED]';
    }
  }

  /**
   * Encrypts sensitive fields within a contact point configuration object.
   */
  encryptConfig(config: Record<string, any>): Record<string, any> {
    if (!config || typeof config !== 'object') return config;
    const result: Record<string, any> = { ...config };

    if (typeof result.webhookUrl === 'string') {
      result.webhookUrl = this.encrypt(result.webhookUrl);
    }
    if (typeof result.url === 'string') {
      result.url = this.encrypt(result.url);
    }
    if (typeof result.token === 'string') {
      result.token = this.encrypt(result.token);
    }
    if (typeof result.password === 'string') {
      result.password = this.encrypt(result.password);
    }
    if (result.headers && typeof result.headers === 'object') {
      const encryptedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.headers)) {
        if (
          typeof v === 'string' &&
          (k.toLowerCase().includes('auth') ||
            k.toLowerCase().includes('token') ||
            k.toLowerCase().includes('secret') ||
            k.toLowerCase().includes('key'))
        ) {
          encryptedHeaders[k] = this.encrypt(v);
        } else {
          encryptedHeaders[k] = v as string;
        }
      }
      result.headers = encryptedHeaders;
    }

    return result;
  }

  /**
   * Decrypts sensitive fields in configuration for background worker use.
   */
  decryptConfig(config: Record<string, any>): Record<string, any> {
    if (!config || typeof config !== 'object') return config;
    const result: Record<string, any> = { ...config };

    if (typeof result.webhookUrl === 'string') {
      result.webhookUrl = this.decrypt(result.webhookUrl);
    }
    if (typeof result.url === 'string') {
      result.url = this.decrypt(result.url);
    }
    if (typeof result.token === 'string') {
      result.token = this.decrypt(result.token);
    }
    if (typeof result.password === 'string') {
      result.password = this.decrypt(result.password);
    }
    if (result.headers && typeof result.headers === 'object') {
      const decryptedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.headers)) {
        if (typeof v === 'string') {
          decryptedHeaders[k] = this.decrypt(v);
        } else {
          decryptedHeaders[k] = v as string;
        }
      }
      result.headers = decryptedHeaders;
    }

    return result;
  }

  /**
   * Masks a URL or secret token for safe UI display and GET APIs.
   */
  maskSecret(val: string): string {
    if (!val) return '';
    const clean = val.startsWith('enc:v1:') ? this.decrypt(val) : val;

    // If it's a URL (like Slack webhook or custom webhook)
    try {
      const u = new URL(clean);
      const pathname = u.pathname;
      if (pathname.length > 8) {
        const visiblePrefix = pathname.slice(0, Math.min(8, Math.floor(pathname.length / 2)));
        return `${u.origin}${visiblePrefix}••••••••`;
      }
      return `${u.origin}/••••••••`;
    } catch {
      // It's a token or password
      if (clean.length <= 4) return '••••••••';
      return `${clean.slice(0, 2)}••••••••${clean.slice(-2)}`;
    }
  }

  /**
   * Produces a sanitized, masked configuration safe for GET responses.
   */
  maskConfig(config: Record<string, any>): Record<string, any> {
    if (!config || typeof config !== 'object') return config;
    const masked: Record<string, any> = { ...config };

    if (masked.webhookUrl) {
      masked.webhookUrl = this.maskSecret(masked.webhookUrl);
    }
    if (masked.url) {
      masked.url = this.maskSecret(masked.url);
    }
    if (masked.token) {
      masked.token = '••••••••';
    }
    if (masked.password) {
      masked.password = '••••••••';
    }
    if (masked.headers && typeof masked.headers === 'object') {
      const maskedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(masked.headers)) {
        if (
          k.toLowerCase().includes('auth') ||
          k.toLowerCase().includes('token') ||
          k.toLowerCase().includes('secret') ||
          k.toLowerCase().includes('key')
        ) {
          maskedHeaders[k] = '••••••••';
        } else {
          maskedHeaders[k] = v as string;
        }
      }
      masked.headers = maskedHeaders;
    }

    return masked;
  }
}
