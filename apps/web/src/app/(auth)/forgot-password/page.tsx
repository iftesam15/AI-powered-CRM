import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter your work email and we will send a link to set a new password.
        </p>
      </header>

      <ForgotPasswordForm />
    </div>
  );
}
