import { z } from 'zod';
import { canonicalJson } from '../../common/crypto';

export const eventIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9._-]+$/);

export const leadDataSchema = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase())
      .nullable()
      .optional()
      .default(null),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/)
      .nullable()
      .optional()
      .default(null),
    company: z.string().trim().max(160).nullable().optional().default(null),
    campaign: z.string().trim().max(160).nullable().optional().default(null),
    metadata: z
      .record(z.string().max(100), z.json())
      .default({})
      .refine((v) => Buffer.byteLength(canonicalJson(v)) <= 16384, 'Metadata exceeds 16 KiB'),
  })
  .strict()
  .refine((v) => !!(v.email || v.phone), 'At least one contact method is required');

export const webhookSchema = z
  .object({
    eventId: eventIdSchema,
    externalLeadId: z.string().trim().min(1).max(128),
    version: z.number().int().min(1).max(2147483647),
    occurredAt: z.iso.datetime({ offset: true }),
    data: leadDataSchema,
  })
  .strict();

export type WebhookDto = z.infer<typeof webhookSchema>;
