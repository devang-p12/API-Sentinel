import { z } from 'zod';

/**
 * Validates that a standard 5-field cron expression executes at most once every 24 hours.
 * Format: minute hour day-of-month month day-of-week
 * 
 * Rules for >= 24 hour interval:
 * 1. Minute field must be a single static integer (0-59), no intervals (*, /, ,)
 * 2. Hour field must be a single static integer (0-23), no intervals (*, /, ,)
 * 3. Day / Month / Day-of-week can be * or specific days (daily, weekly, monthly are all >= 24h)
 */
export function validateMinimum24Hours(cronExpr: string): boolean {
  if (!cronExpr || typeof cronExpr !== 'string') return false;
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minute, hour] = parts;

  // Minute must be a single integer 0-59
  if (!/^\d+$/.test(minute)) return false;
  const minuteNum = parseInt(minute, 10);
  if (minuteNum < 0 || minuteNum > 59) return false;

  // Hour must be a single integer 0-23
  if (!/^\d+$/.test(hour)) return false;
  const hourNum = parseInt(hour, 10);
  if (hourNum < 0 || hourNum > 23) return false;

  return true;
}

export const runSingleLoadTestSchema = z.object({
  apiId: z.number({ required_error: 'API ID is required' }).int().positive(),
  virtualUsers: z
    .number()
    .int()
    .min(1, 'Virtual Users must be at least 1')
    .max(5000, 'Virtual Users cannot exceed 5,000 for single API testing')
    .default(10),
  duration: z
    .string()
    .regex(/^\d+(s|m)$/, 'Duration must be in seconds (e.g., "10s", "30s") or minutes (e.g., "1m", "5m")')
    .default('10s'),
  timeout: z.string().regex(/^\d+(s|m)$/).optional().default('10s'),
  expectedStatus: z.number().int().min(100).max(599).optional(),
});

export type RunSingleLoadTestInput = z.infer<typeof runSingleLoadTestSchema>;

export const runAllLoadTestsSchema = z.object({
  virtualUsers: z
    .number()
    .int()
    .min(1, 'Virtual Users must be at least 1')
    .max(1000, 'Virtual Users cannot exceed 1,000 per API for run-all batch testing')
    .default(10),
  duration: z
    .string()
    .regex(/^\d+(s|m)$/, 'Duration must be in seconds (e.g., "10s", "30s") or minutes (e.g., "1m", "5m")')
    .default('10s'),
  concurrency: z
    .number()
    .int()
    .min(1, 'Concurrency must be at least 1 API test at a time')
    .max(10, 'Concurrency cannot exceed 10 simultaneous API tests')
    .default(2),
  environment: z.enum(['development', 'staging', 'production', 'all']).optional().default('all'),
});

export type RunAllLoadTestsInput = z.infer<typeof runAllLoadTestsSchema>;

export const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  cronExpression: z
    .string()
    .trim()
    .refine(validateMinimum24Hours, {
      message:
        'Scheduled testing interval must be strictly at least 24 hours (e.g., "0 0 * * *" for daily midnight, or specific hour and minute once per day). Sub-daily schedules (hourly, every X minutes) are not allowed.',
    }),
  virtualUsers: z
    .number()
    .int()
    .min(1, 'Virtual Users must be at least 1')
    .max(500, 'Virtual Users cannot exceed 500 per API for scheduled testing')
    .default(20),
  duration: z
    .string()
    .regex(/^\d+(s|m)$/, 'Duration must be in seconds (e.g., "15s") or minutes (e.g., "1m")')
    .default('15s'),
  concurrency: z
    .number()
    .int()
    .min(1, 'Concurrency must be at least 1 API test')
    .max(5, 'Concurrency cannot exceed 5 simultaneous API tests for scheduled runs')
    .default(2),
});

export type ScheduleConfigInput = z.infer<typeof scheduleConfigSchema>;
