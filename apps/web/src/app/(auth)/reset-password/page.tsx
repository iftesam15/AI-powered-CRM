import Link from "next/link";
import type { Metadata } from "next";

import { FormAlert } from "@/components/shared/form-alert";
import { ResetPasswordForm } from "@/features/auth";
import { routes } from "@/config/routes";

export const metadata: Metadata = { title: "Set a new password" };

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Reset links work once and expire one hour after they are sent.
        </p>
      </header>

      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5">
          <FormAlert tone="error" title="This link is incomplete">
            The reset token is missing from the address. Open the link straight from the
            email, or request a new one.
          </FormAlert>
          <Link
            href={routes.forgotPassword}
            className="inline-block text-sm font-medium underline underline-offset-4"
          >
            Request a new reset link
          </Link>
        </div>
      )}
    </div>
  );
}
