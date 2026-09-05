"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with the real error reporter once observability lands.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-4 px-6 sm:px-16">
      <p className="text-sm font-medium text-destructive">Something went wrong</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        The page could not be loaded
      </h1>
      <p className="max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
        Try again. If it keeps happening, share this reference with your administrator:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {error.digest ?? "no-digest"}
        </code>
      </p>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </main>
  );
}
