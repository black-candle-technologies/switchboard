// src/lib/validation.ts
import { z } from "zod";

export const UserInput = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
});

export type UserInput = z.infer<typeof UserInput>;
