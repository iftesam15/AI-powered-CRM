"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/shared/form-alert";
import { SubmitButton } from "@/components/shared/submit-button";
import { routes } from "@/config/routes";
import { useForgotPassword } from "@/features/auth/api/mutations";
import { forgotPasswordSchema } from "@/features/auth/schemas";

type ForgotValues = z.output<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const request = useForgotPassword();

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  if (request.isSuccess) {
    return (
      <div className="space-y-5">
        <FormAlert tone="success" title="Check your inbox">
          If an account exists for that address, a reset link is on its way. The link
          works once and expires in one hour.
        </FormAlert>

        {request.data.devToken ? (
          <FormAlert tone="info" title="Local mock mode">
            No mail server is running, so use this link directly:{" "}
            <Link href={routes.resetPassword(request.data.devToken)}>
              open the reset page
            </Link>
          </FormAlert>
        ) : null}

        <Link
          href={routes.login}
          className="inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => request.mutate(values))}
        className="space-y-5"
      >
        {request.error ? (
          <FormAlert tone="error" title="Could not send the link">
            {request.error.message}
          </FormAlert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="gap-2">
              <FormLabel>Work email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  spellCheck={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton
          pending={request.isPending}
          pendingLabel="Sending"
          className="w-full"
          size="lg"
        >
          Send reset link
        </SubmitButton>

        <Link
          href={routes.login}
          className="inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </form>
    </Form>
  );
}
