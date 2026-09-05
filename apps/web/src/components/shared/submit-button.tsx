"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

/**
 * Keeps the button width stable while pending so the layout does not jump, and
 * blocks double submits. The tactile `:active` nudge lives on the base Button
 * variant, so every button in the app gets it rather than just this one.
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean; pendingLabel?: string }) {
  return (
    <Button
      type="submit"
      aria-busy={pending}
      disabled={pending || disabled}
      className={className}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
