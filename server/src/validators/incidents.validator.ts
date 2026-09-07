import { z } from 'zod';

export const listIncidentsQuerySchema = z.object({
  api_id: z.coerce.number().int().positive('api_id must be a positive integer').optional(),
  environment: z.string().optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'all']).optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL', 'all']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const acknowledgeIncidentSchema = z.object({
  note: z.string().trim().max(1000, 'Note cannot exceed 1000 characters').optional(),
});

export const resolveIncidentSchema = z.object({
  note: z.string().trim().max(1000, 'Note cannot exceed 1000 characters').optional(),
});

export const addIncidentNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
});

export type ListIncidentsQueryInput = z.infer<typeof listIncidentsQuerySchema>;
export type AcknowledgeIncidentInput = z.infer<typeof acknowledgeIncidentSchema>;
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;
export type AddIncidentNoteInput = z.infer<typeof addIncidentNoteSchema>;
