import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-4 px-6 sm:px-16">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        This page does not exist
      </h1>
      <p className="max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
        The link may be out of date, or the record may have been deleted or moved to
        another owner.
      </p>
      <Button asChild className="mt-2">
        <Link href={routes.dashboard}>Back to dashboard</Link>
      </Button>
    </main>
  );
}
