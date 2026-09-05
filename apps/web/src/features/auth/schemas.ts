import { z } from "zod";

/**
 * Mirrors the Pydantic schemas in the backend `auth` module. The backend stays
 * authoritative: these rules exist to give immediate inline feedback, not to
 * decide what is accepted.
 */

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

const newPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((value) => /[a-zA-Z]/.test(value), "Include at least one letter.")
  .refine((value) => /[0-9]/.test(value), "Include at least one number.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is missing its token."),
    password: newPassword,
    confirmPassword: z.string().min(1, "Repeat your new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
