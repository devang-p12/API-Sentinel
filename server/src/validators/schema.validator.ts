import { z } from 'zod';

export const apiIdParamSchema = z.object({
  apiId: z.coerce
    .number({ invalid_type_error: 'API ID must be a positive integer' })
    .int('API ID must be an integer')
    .positive('API ID must be a positive integer'),
});

export const changeIdParamSchema = z.object({
  changeId: z.coerce
    .number({ invalid_type_error: 'Change ID must be a positive integer' })
    .int('Change ID must be an integer')
    .positive('Change ID must be a positive integer'),
});

export const getSchemaQuerySchema = z.object({
  environment: z
    .string({ required_error: 'Environment is required' })
    .trim()
    .min(1, 'Environment is required'),
});

export const getSchemaHistoryQuerySchema = z.object({
  environment: z
    .string({ required_error: 'Environment is required' })
    .trim()
    .min(1, 'Environment is required'),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be an integer between 1 and 100' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(50),
});

export const getSchemaChangesQuerySchema = z.object({
  environment: z
    .string({ required_error: 'Environment is required' })
    .trim()
    .min(1, 'Environment is required'),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be an integer between 1 and 100' })
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(50),
  offset: z.coerce
    .number({ invalid_type_error: 'Offset must be an integer greater than or equal to 0' })
    .int('Offset must be an integer')
    .min(0, 'Offset cannot be negative')
    .optional()
    .default(0),
});

export const getRecentChangesQuerySchema = z.object({
  environment: z
    .string({ required_error: 'Environment is required' })
    .trim()
    .min(1, 'Environment is required'),
  minutes: z.coerce
    .number({ invalid_type_error: 'Minutes must be an integer between 1 and 1440' })
    .int('Minutes must be an integer')
    .min(1, 'Minutes must be at least 1')
    .max(1440, 'Minutes cannot exceed 1440')
    .optional()
    .default(60),
});

export type ApiIdParamInput = z.infer<typeof apiIdParamSchema>;
export type ChangeIdParamInput = z.infer<typeof changeIdParamSchema>;
export type GetSchemaQueryInput = z.infer<typeof getSchemaQuerySchema>;
export type GetSchemaHistoryQueryInput = z.infer<typeof getSchemaHistoryQuerySchema>;
export type GetSchemaChangesQueryInput = z.infer<typeof getSchemaChangesQuerySchema>;
export type GetRecentChangesQueryInput = z.infer<typeof getRecentChangesQuerySchema>;
