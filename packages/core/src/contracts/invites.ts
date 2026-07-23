import { z } from "zod";

export const createInviteRequestSchema = z.object({
  email: z.string().email(),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

export const inviteSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  email: z.string(),
  role: z.literal("bookkeeper"),
  expiresAt: z.number().int(),
});
export type Invite = z.infer<typeof inviteSchema>;
