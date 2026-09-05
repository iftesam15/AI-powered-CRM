import { NextResponse } from "next/server";
import { z } from "zod";

import { resetPasswordSchema } from "@/features/auth/schemas";
import { resetPassword } from "@/server/auth-service";
import { clearSessionCookies } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Check the password you entered.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ detail: result.detail }, { status: result.status });
  }

  // A password change invalidates existing sessions on the backend, so drop the
  // cookies here too rather than leaving a stale token in the browser.
  await clearSessionCookies();

  return new NextResponse(null, { status: 204 });
}
