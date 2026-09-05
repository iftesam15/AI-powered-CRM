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
import { useLogin } from "@/features/auth/api/mutations";
import { loginSchema } from "@/features/auth/schemas";
import { ApiError } from "@/lib/api-client";

type LoginValues = z.output<typeof loginSchema>;

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const login = useLogin(redirectTo);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const rateLimited = login.error instanceof ApiError && login.error.status === 429;

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
        className="space-y-5"
      >
        {login.error ? (
          <FormAlert
            tone="error"
            title={rateLimited ? "Account temporarily locked" : "Could not sign in"}
          >
            {login.error.message}
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <FormLabel>Password</FormLabel>
                <Link
                  href={routes.forgotPassword}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input {...field} type="password" autoComplete="current-password" />
              </FormControl>
              <FormDescription className="sr-only">
                Enter the password for your CRM account.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <SubmitButton
          pending={login.isPending}
          pendingLabel="Signing in"
          className="w-full"
          size="lg"
        >
          Sign in
        </SubmitButton>
      </form>
    </Form>
  );
}
