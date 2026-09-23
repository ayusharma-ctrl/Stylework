import { z } from 'zod';
export const signinSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.trim().toLowerCase()),
  })
  .strict();
export type SigninDto = z.infer<typeof signinSchema>;
