import { NextResponse } from "next/server";
import { z } from "zod";

import { loginSchema } from "@/features/auth/schemas";
import { login } from "@/server/auth-service";
import { writeSessionCookies } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Check the details you entered.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ detail: result.detail }, { status: result.status });
  }

  await writeSessionCookies({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return NextResponse.json(result.session);
}
