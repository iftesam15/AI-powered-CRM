import { z } from "zod";

/**
 * Mirrors the Pydantic schemas in the backend `users` module. The backend stays
 * authoritative: these rules exist to give immediate inline feedback, not to
 * decide what is accepted.
 */

const roles = ["admin", "sales_manager", "sales_rep", "read_only"] as const;

export const roleSchema = z.enum(roles);

const email = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .max(255, "Use 255 characters or fewer.")
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

const fullName = z
  .string()
  .trim()
  .min(1, "Enter the person's name.")
  .max(255, "Use 255 characters or fewer.");

/**
 * Twelve characters, matching the reset form. The API accepts eight, so this is
 * the stricter of the two and the one a person actually meets — an initial
 * password handed to a colleague is worth holding to the same bar as one they
 * choose themselves.
 */
const initialPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((value) => /[a-zA-Z]/.test(value), "Include at least one letter.")
  .refine((value) => /[0-9]/.test(value), "Include at least one number.");

export const createUserSchema = z.object({
  email,
  fullName,
  role: roleSchema,
  password: initialPassword,
});

export const editUserSchema = z.object({
  fullName,
  role: roleSchema,
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type CreateUserValues = z.output<typeof createUserSchema>;
export type EditUserInput = z.input<typeof editUserSchema>;
export type EditUserValues = z.output<typeof editUserSchema>;
