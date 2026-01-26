import { z } from 'zod';
import { insertHabitSchema, habits, habitEvents, dailyHabitStatus, habitDebts } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  habits: {
    list: {
      method: 'GET' as const,
      path: '/api/habits',
      responses: {
        200: z.array(z.custom<any>()), // Returns HabitWithStatus
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/habits',
      input: insertHabitSchema,
      responses: {
        201: z.custom<typeof habits.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/habits/:id',
      responses: {
        200: z.custom<typeof habits.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/habits/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    logEvent: {
      method: 'POST' as const,
      path: '/api/habits/:id/events', // Avoidance only
      input: z.object({ notes: z.string().optional() }),
      responses: {
        201: z.custom<typeof habitEvents.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    confirmCleanDay: {
      method: 'POST' as const,
      path: '/api/habits/:id/clean-day', // Avoidance only
      input: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      responses: {
        200: z.object({ debt: z.number(), message: z.string() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    completeDaily: {
      method: 'POST' as const,
      path: '/api/habits/:id/complete', // Build only
      input: z.object({ 
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        completed: z.boolean() 
      }),
      responses: {
        200: z.custom<typeof dailyHabitStatus.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
