import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { icon: typeof Info; className: string }> = {
  error: {
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/8 text-destructive",
  },
  success: {
    icon: CheckCircle2,
    className: "border-chart-5/40 bg-chart-5/10 text-foreground",
  },
  info: {
    icon: Info,
    className: "border-border bg-muted text-muted-foreground",
  },
};

/**
 * Inline, in-flow feedback for form submissions. Errors that belong to a single
 * field render under that field instead; this is for whole-form outcomes such
 * as bad credentials or a locked account.
 */
export function FormAlert({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? <p className="font-medium leading-tight">{title}</p> : null}
        <div className="leading-relaxed [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>
      </div>
    </div>
  );
}
