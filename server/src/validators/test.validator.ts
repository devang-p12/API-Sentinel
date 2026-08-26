import { z } from 'zod';

export const runTestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string().url('Must be a valid URL'),
  headers: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean()
  })).optional(),
  params: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean()
  })).optional(),
  body: z.string().optional(),
  authType: z.enum(['none', 'bearer', 'basic', 'api-key']).optional(),
  credentials: z.object({
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKeyKey: z.string().optional(),
    apiKeyValue: z.string().optional()
  }).optional(),
  timeout: z.number().optional().default(5000)
});
