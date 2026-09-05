"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/shared/form-alert";
import { SubmitButton } from "@/components/shared/submit-button";
import { routes } from "@/config/routes";
import { useResetPassword } from "@/features/auth/api/mutations";
import { resetPasswordSchema } from "@/features/auth/schemas";

type ResetValues = z.output<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const reset = useResetPassword();

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  if (reset.isSuccess) {
    return (
      <div className="space-y-5">
        <FormAlert tone="success" title="Password updated">
          Your password has been changed and every other session was signed out.
        </FormAlert>
        <Link
          href={routes.login}
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ token: resetToken, password }) =>
          reset.mutate({ token: resetToken, password }),
        )}
        className="space-y-5"
      >
        {reset.error ? (
          <FormAlert tone="error" title="Could not reset the password">
            {reset.error.message}{" "}
            <Link href={routes.forgotPassword}>Request a new link</Link>
          </FormAlert>
        ) : null}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="gap-2">
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="new-password" autoFocus />
              </FormControl>
              <FormDescription>
                At least 12 characters, including a letter and a number.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="gap-2">
              <FormLabel>Repeat new password</FormLabel>
              <FormControl>
                <Input {...field} type="password" autoComplete="new-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton
          pending={reset.isPending}
          pendingLabel="Updating"
          className="w-full"
          size="lg"
        >
          Update password
        </SubmitButton>
      </form>
    </Form>
  );
}
