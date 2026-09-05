import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { requestPasswordReset } from "@/server/auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Enter a valid email address.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  const { devToken } = await requestPasswordReset(parsed.data.email);

  // The response is identical whether or not the address exists, so the form
  // cannot be used to discover which emails belong to a tenant.
  return NextResponse.json({
    accepted: true,
    devToken: env.NEXT_PUBLIC_USE_MOCK_API ? devToken : null,
  });
}
