import { z } from 'zod';

export const registerApiSchema = z.object({
  name: z.string().min(1, 'API Name is required').max(255),
  description: z.string().optional().default(''),
  baseUrl: z.string().url('Base URL must be a valid URL (e.g., https://api.example.com)'),
  version: z.string().optional().default('v1'),
  environment: z.enum(['development', 'staging', 'production']).optional().default('development'),
  authentication: z.enum(['none', 'api-key', 'bearer', 'oauth2']).optional().default('api-key'),
  authConfig: z.record(z.any()).optional().default({}),
  scopes: z.object({
    read: z.boolean().optional().default(true),
    write: z.boolean().optional().default(false),
    delete: z.boolean().optional().default(false),
  }).optional().default({ read: true, write: false, delete: false }),
  apiKey: z.string().optional().nullable(),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ).optional().default([]),
  requestBody: z.any().optional(),
  expectedStatus: z.number().int().min(100).max(599).optional().default(200),
  applicationId: z.number().int().positive().optional().nullable(),
});

export type RegisterApiInput = z.infer<typeof registerApiSchema>;
