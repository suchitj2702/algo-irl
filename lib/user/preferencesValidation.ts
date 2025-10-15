import { z } from 'zod';

export const UserPreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    darkMode: z.boolean().optional(),
    language: z.string().min(2).max(10).optional(),
    notifications: z
      .object({
        email: z.boolean().optional(),
        push: z.boolean().optional(),
      })
      .optional(),
    accessibility: z
      .object({
        fontScale: z.number().min(0.5).max(2).optional(),
        reduceMotion: z.boolean().optional(),
      })
      .optional(),
  })
  .catchall(z.unknown());

export type UserPreferencesPayload = z.infer<typeof UserPreferencesSchema>;
